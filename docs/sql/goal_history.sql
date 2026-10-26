-- goal_history: versioned calorie/macro goals, one row per effective day.
-- Mirrors the local `goal_history` table (db/migrations/0010_goal_history.sql)
-- and follows the conventions of .claude/supabase-setup.sql (text user_id /
-- timestamps). For the maintainer to review and apply manually in the
-- Supabase SQL Editor; it is NOT applied automatically.
--
-- IMPORTANT: apply this BEFORE releasing the app version that ships the local
-- goal_history table. Until the table exists every queued goal_history upsert
-- fails and is retried on every flush (and reconcile logs a warning).
--
-- Timestamps stay `text` like the rest of the schema, but default to the same
-- ISO-8601 UTC format the client writes (e.g. 2026-03-10T12:00:00.000Z) so
-- last-write-wins comparisons never mix formats.

create table if not exists goal_history (
  user_id           text not null,              -- auth.uid()::text
  effective_from    text not null               -- YYYY-MM-DD, device-local date the goals took effect
                      check (effective_from ~ '^\d{4}-\d{2}-\d{2}$'),
  calorie_goal      real not null check (calorie_goal >= 0 and calorie_goal <= 10000),
  protein_goal_g    real not null check (protein_goal_g >= 0 and protein_goal_g <= 1000),
  carbs_goal_g      real not null check (carbs_goal_g >= 0 and carbs_goal_g <= 1000),
  fat_goal_g        real not null check (fat_goal_g >= 0 and fat_goal_g <= 1000),
  use_manual_goals  boolean not null default false,
  created_at        text not null default (to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at        text not null default (to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  constraint goal_history_user_effective_from_key unique (user_id, effective_from)
);

alter table goal_history enable row level security;

-- Users can only read and write their own history rows
create policy "goal_history: select own"
  on goal_history
  for select
  to authenticated
  using (auth.uid()::text = user_id);

create policy "goal_history: insert own"
  on goal_history
  for insert
  to authenticated
  with check (auth.uid()::text = user_id);

create policy "goal_history: update own"
  on goal_history
  for update
  to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create policy "goal_history: delete own"
  on goal_history
  for delete
  to authenticated
  using (auth.uid()::text = user_id);
