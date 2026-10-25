/**
 * Goal history orchestration — decides WHEN a goal history entry is written.
 * The pure rules live in lib/goalHistory.ts; persistence in db/repos/goalHistory.
 */

import * as goalHistoryRepo from "@/db/repos/goalHistory";
import * as mealEntriesRepo from "@/db/repos/mealEntries";
import type { UserProfile } from "@/db/schema";
import { todayISO } from "@/lib/date";
import {
  LOCAL_GOAL_OWNER,
  goalForDate,
  goalsEqual,
  pickGoals,
  timestampToLocalDate,
} from "@/lib/goalHistory";
import { isSyncEnabled } from "@/src/lib/supabase";
import { isDemoDevice } from "@/src/services/demoGuard";
import { useAuthStore } from "@/src/stores/useAuthStore";

// Writes are serialised so a boot-time backfill cannot interleave with a goal
// change and seed the history with the already-changed goals.
let _chain: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = _chain.then(fn);
  _chain = run.catch(() => {});
  return run;
}

// A signed-in device whose cloud history has not been pulled yet must not
// invent entries: on a fresh device a seed would be pushed as a bogus "goals
// were X since your first meal" row. Seeding waits for the first completed
// goal_history reconcile of the signed-in user.
let _reconciledFor: string | null = null;

/** Called by the sync service once the goal_history pull for `userId` succeeded. */
export function markGoalHistoryReconciled(userId: string): void {
  _reconciledFor = userId;
}

/** Forget the completed reconcile (sign-out / user switch): the next sign-in must pull again. */
export function resetGoalHistoryReconciled(): void {
  _reconciledFor = null;
}

/** Test helper alias of resetGoalHistoryReconciled. */
export const resetGoalHistoryReconciledForTests = resetGoalHistoryReconciled;

/** The account recording right now. Captured ONCE per operation. */
function ownerNow(): string {
  return useAuthStore.getState().userId ?? LOCAL_GOAL_OWNER;
}

function canSeedFor(owner: string): boolean {
  if (owner === LOCAL_GOAL_OWNER || !isSyncEnabled() || isDemoDevice()) return true;
  return _reconciledFor === owner;
}

/** True when seeding/repairing entries from the profile cannot fabricate cloud data. */
export function canSeedGoalHistory(): boolean {
  return canSeedFor(ownerNow());
}

// ── Pending seed ──────────────────────────────────────────────────────
// When a signed-in user changes goals before the first reconcile, the goals
// that applied BEFORE the change are stored locally as a "pending seed" (not
// enqueued) and its day is remembered here. After the cloud pull the sync
// service resolves it: cloud already has history -> the seed is dropped (the
// cloud is the truth); cloud empty -> the seed stays as the earliest entry and
// the reconcile pushes it. The old goals are therefore never lost and a
// fabricated row never overwrites real cloud history.

const PENDING_SEED_PREFIX = "vitia:goalHistory:pendingSeed:";

function getPendingSeed(userId: string): string | null {
  try {
    return localStorage.getItem(`${PENDING_SEED_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

function setPendingSeed(userId: string, day: string | null): void {
  try {
    if (day === null) localStorage.removeItem(`${PENDING_SEED_PREFIX}${userId}`);
    else localStorage.setItem(`${PENDING_SEED_PREFIX}${userId}`, day);
  } catch {
    // Storage unavailable: the seed simply stays as a regular local entry.
  }
}

/**
 * Resolve a pending seed after the cloud pull for `userId` (see above).
 */
export function resolvePendingGoalSeed(userId: string, cloudHasHistory: boolean): Promise<void> {
  return serialize(async () => {
    const day = getPendingSeed(userId);
    if (day === null) return;
    if (cloudHasHistory) await goalHistoryRepo.remove(day, userId);
    setPendingSeed(userId, null);
  });
}

/** Date the seed for `profile` would take: earliest meal entry, else profile creation. */
async function seedDate(profile: UserProfile): Promise<string> {
  const meals = await mealEntriesRepo.getAll();
  let earliestMealDate: string | null = null;
  for (const meal of meals) {
    if (earliestMealDate === null || meal.date < earliestMealDate) earliestMealDate = meal.date;
  }
  return earliestMealDate ?? timestampToLocalDate(profile.createdAt) ?? todayISO();
}

async function seedIfEmpty(profile: UserProfile, owner: string): Promise<boolean> {
  if (!canSeedFor(owner)) return false;

  const existing = await goalHistoryRepo.list(owner);
  if (existing.length > 0) return false;

  await goalHistoryRepo.record(
    { effectiveFrom: await seedDate(profile), ...pickGoals(profile) },
    owner
  );
  return true;
}

/**
 * Seed the history with the profile's current goals when it is empty.
 * effective_from is the date of the earliest meal entry, else the profile
 * creation date. Idempotent: does nothing once any entry exists, and (when
 * signed in with sync) does nothing until the cloud history has been pulled.
 * Returns true when an entry was seeded.
 */
export function backfillGoalHistory(profile: UserProfile): Promise<boolean> {
  const owner = ownerNow();
  return serialize(() => seedIfEmpty(profile, owner));
}

/**
 * Repair a gap: when the goals active today (per the history) differ from the
 * profile's current goals (a change that was never recorded), record a
 * corrective entry for today. Compares against the entry active today, not the
 * last one, so a future-dated entry cannot make this rewrite on every load.
 * Returns true when an entry was written.
 */
export function repairGoalGap(profile: UserProfile, today: string = todayISO()): Promise<boolean> {
  const owner = ownerNow();
  return serialize(async () => {
    if (!canSeedFor(owner)) return false;

    const existing = await goalHistoryRepo.list(owner);
    const active = goalForDate(existing, today);
    if (!active || goalsEqual(pickGoals(active), pickGoals(profile))) return false;

    await goalHistoryRepo.record({ effectiveFrom: today, ...pickGoals(profile) }, owner);
    return true;
  });
}

/**
 * Record `next`'s goals as of `today` when they differ from `previous`'s
 * (or when there is no previous profile: the initial onboarding entry).
 * A second change on the same day overwrites that day's entry. Returns true
 * when an entry was written.
 */
export function recordGoalChange(
  previous: UserProfile | null,
  next: UserProfile,
  today: string = todayISO()
): Promise<boolean> {
  const nextGoals = pickGoals(next);
  if (previous && goalsEqual(pickGoals(previous), nextGoals)) return Promise.resolve(false);

  const owner = ownerNow();
  return serialize(async () => {
    // An existing user's first change must not lose the goals that applied
    // before it: seed the old goals first (no-op when history already exists).
    if (previous && !(await seedIfEmpty(previous, owner)) && !canSeedFor(owner)) {
      await persistPendingSeed(previous, owner, today);
    }

    await goalHistoryRepo.record({ effectiveFrom: today, ...nextGoals }, owner);
    return true;
  });
}

/** Store the pre-change goals locally, not enqueued, until the first reconcile resolves them. */
async function persistPendingSeed(
  previous: UserProfile,
  owner: string,
  today: string
): Promise<void> {
  if ((await goalHistoryRepo.list(owner)).length > 0) return;

  const day = await seedDate(previous);
  // A seed on/after the change day would be overwritten by the real entry.
  if (day >= today) return;

  await goalHistoryRepo.record({ effectiveFrom: day, ...pickGoals(previous) }, owner, {
    enqueue: false,
  });
  setPendingSeed(owner, day);
}
