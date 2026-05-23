-- 0005_phase7p5_deadline_time.sql — time-bound daily tasks (Lily's Fix 12a).
--
-- Adds an optional deadline TIME to task_template. When set, a daily task
-- can only be completed by the kid BEFORE that wall-clock time in the
-- household timezone. After the deadline passes (with no completion that
-- day), the task is "locked" — server rejects the complete-action with a
-- typed `deadline_passed` error and the kid card greys out.
--
-- Admin recourse: a parent can complete a missed task on the kid's behalf
-- via the new server action (sub-7.5 in CHANGELOG). That posts the earn
-- + an audit row attributing the admin.
--
-- Nullable by design — most tasks don't need a deadline. Existing rows
-- get NULL = no deadline, no behavior change.
--
-- Only daily templates honor this. Long-term has its own time semantics
-- (running quantity across the whole window) — a daily deadline doesn't
-- map. The app-layer guard ignores `deadline_time` on long-term rows.

ALTER TABLE task_template
  ADD COLUMN IF NOT EXISTS deadline_time TIME;

COMMENT ON COLUMN task_template.deadline_time IS
  'Optional wall-clock deadline for daily tasks. The kid can only complete '
  'this task today if the current Asia/Jerusalem time is at or before this '
  'time. NULL = no deadline. Long-term templates ignore this.';
