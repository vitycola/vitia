/**
 * Backend-dispatching repository facade.
 *
 * All application code (stores, routes, components) imports from here — never
 * directly from db/repositories/*.  The individual repository files contain
 * pure drizzle/SQLite implementations and have NO knowledge of which backend
 * is active (R6 compliance).
 *
 * Dispatch logic lives here, centralised, so repositories stay backend-agnostic.
 *
 * Design: openspec/changes/web-pwa-migration/design.md — Architecture Decision 4
 * Spec:   web-local-storage R6
 *
 * Usage:
 *   import * as foodsRepo from "@/db/repos/foods";
 *   import * as mealEntriesRepo from "@/db/repos/mealEntries";
 *   import * as profileRepo from "@/db/repos/profile";
 *
 * Or for named imports:
 *   import { getByDate, insertBulk } from "@/db/repos/mealEntries";
 */

export * as foods from "@/db/repos/foods";
export * as mealEntries from "@/db/repos/mealEntries";
export * as profile from "@/db/repos/profile";
