-- 0011_repeatable_tasks.sql — daily tasks completable more than once a day
-- (Lily: "some tasks can be done multiple times; journeys + balance should
-- count each one").
--
--   - task_template.max_per_day: how many times/day this daily task may be
--     completed. NULL = unlimited; default 1 (existing tasks stay once-a-day).
--   - task_completion.occurrence_ordinal: 1-based slot within (assignment,
--     date). Lets several active completions coexist for one day.
--
-- The double-claim guard moves from "one active completion per (assignment,
-- date)" to "one active completion per (assignment, date, occurrence_ordinal)"
-- — so a double-tap still can't claim the same slot twice, but N distinct
-- occurrences are allowed.

ALTER TABLE task_template
  ADD COLUMN IF NOT EXISTS max_per_day INTEGER DEFAULT 1;

ALTER TABLE task_completion
  ADD COLUMN IF NOT EXISTS occurrence_ordinal INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS task_completion_assignment_date_active;
CREATE UNIQUE INDEX task_completion_assignment_date_active
  ON task_completion(assignment_id, completion_date, occurrence_ordinal)
  WHERE undone_at IS NULL;

COMMENT ON COLUMN task_template.max_per_day IS
  'Times/day a daily task may be completed. NULL = unlimited; default 1.';
COMMENT ON COLUMN task_completion.occurrence_ordinal IS
  '1-based slot within (assignment, completion_date) for repeatable tasks.';
