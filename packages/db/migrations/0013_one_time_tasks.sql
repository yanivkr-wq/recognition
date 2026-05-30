-- 0013_one_time_tasks.sql — date-bound daily tasks (Lily's spec: "like a sale,
-- only today, clean the floor = 10 coins, first kid to complete gets them").
--
-- Existing daily tasks repeat every day. A ONE-TIME task is a daily task with
-- `available_date` set: it only appears for the kid on that specific date and
-- disappears the next day, regardless of whether anyone completed it.
--
--   - task_template.available_date  -- the only date the task is visible on
--                                      the kid home. NULL = repeats every day
--                                      (existing daily behaviour).
--   - task_template.max_completions_total -- cap across ALL kids in the
--                                      household. NULL = no cap (per-kid
--                                      max_per_day still applies). When set
--                                      to 1, the first kid to complete claims
--                                      the coins and the task vanishes for
--                                      everyone else (the kid-home query
--                                      filters it out once the cap is met).
--
-- The column is on task_template (not task_assignment) because the date /
-- cap is a property of the task itself — every kid the template is assigned
-- to sees the same window.

ALTER TABLE task_template
  ADD COLUMN IF NOT EXISTS available_date DATE,
  ADD COLUMN IF NOT EXISTS max_completions_total INTEGER;

-- Cheap lookup for the kid-home query that wants "templates available today".
CREATE INDEX IF NOT EXISTS task_template_available_date_idx
  ON task_template (available_date)
  WHERE available_date IS NOT NULL;

COMMENT ON COLUMN task_template.available_date IS
  'Single date a one-time daily task is visible on. NULL = repeats every day.';
COMMENT ON COLUMN task_template.max_completions_total IS
  'Cap on approved completions across all kids. NULL = uncapped (per-kid limit applies).';
