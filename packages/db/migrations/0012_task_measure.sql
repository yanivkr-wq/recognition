-- 0012_task_measure.sql — measure a journey + its tasks in a real unit, so
-- progress is the sum of completed amounts vs the target (Lily's spec:
-- "read 100 pages", "practice 120 hours"; a 15-hour task adds 15/120).
--
--   - task_template.measure_amount: how much ONE completion of this task adds
--     to a journey it feeds (e.g. 15). NULL = no measure (the task earns coins
--     but doesn't count toward journeys, e.g. "set the table").
--   - task_template.measure_unit / campaign.measure_unit: a display label
--     (hours / pages / …). No auto-conversion — the journey + its tasks share
--     one unit; the bar just sums numbers.
--
-- Backfill: existing daily tasks get measure_amount = coin_value so journeys
-- that already feed off them keep their current progress.

ALTER TABLE task_template
  ADD COLUMN IF NOT EXISTS measure_amount INTEGER,
  ADD COLUMN IF NOT EXISTS measure_unit TEXT;

ALTER TABLE campaign
  ADD COLUMN IF NOT EXISTS measure_unit TEXT;

UPDATE task_template
   SET measure_amount = coin_value
 WHERE kind = 'daily' AND measure_amount IS NULL;

COMMENT ON COLUMN task_template.measure_amount IS
  'Amount one completion contributes to a journey it feeds. NULL = no measure.';
COMMENT ON COLUMN task_template.measure_unit IS
  'Display unit label for the measure (hours / pages / …).';
COMMENT ON COLUMN campaign.measure_unit IS
  'Display unit label for the journey target (hours / pages / …).';
