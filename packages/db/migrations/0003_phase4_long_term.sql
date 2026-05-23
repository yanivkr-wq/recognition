-- 0003_phase4_long_term.sql — adds the completion marker for long-term tasks.
--
-- A long-term task (e.g., "read 100 pages") is conceptually "done" when its
-- cumulative quantity (SUM of active long_term_progress rows) crosses
-- long_term_goal_quantity. BUILD-PLAN.md Phase 4 task 2 specified adding
-- a flag on task_assignment so the kid's home + admin views can show
-- "Done!" without re-summing on every render.
--
-- The flag is nullable: NULL means not-yet-completed (the common case). A
-- non-null timestamp records when the assignment crossed the goal. On
-- bonus-reversal (kid undoes the row that pushed total back below goal),
-- the flag is cleared back to NULL — see undoLongTermProgressOperation
-- in packages/db/src/long-term/undo-progress.ts.
--
-- No DB-level CHECK constraint links long_term_completed_at to a kind —
-- it just stays NULL forever for daily assignments (which is fine).

ALTER TABLE task_assignment
  ADD COLUMN IF NOT EXISTS long_term_completed_at TIMESTAMPTZ;
