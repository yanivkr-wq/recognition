-- 0007_feedback.sql — in-app feedback (Lily's feature request).
--
-- Any principal (kid or admin) can submit feedback via a floating button on
-- every surface; only admins triage it on /admin/feedback. We record WHO
-- submitted via two nullable FKs (one is set depending on principal) plus a
-- denormalized submitter_label so the admin list reads cleanly even if the
-- kid/user row is later removed (ON DELETE SET NULL keeps the feedback).
--
-- image_path is an optional relative filename on the shared evidence volume
-- (under feedback/), mirroring reward images. NULL = text-only feedback.
--
-- status flows new → in_progress → in_validation → completed. New rows land
-- as 'new' so the admin can triage.

CREATE TABLE IF NOT EXISTS feedback (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  submitted_by_kid_id   UUID REFERENCES kid(id) ON DELETE SET NULL,
  submitted_by_user_id  UUID REFERENCES "user"(id) ON DELETE SET NULL,
  submitter_label       TEXT NOT NULL,
  category              TEXT NOT NULL CHECK (category IN ('bug', 'ui_ux', 'feature')),
  body                  TEXT NOT NULL,
  image_path            TEXT,
  status                TEXT NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new', 'in_progress', 'in_validation', 'completed')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_household_status_created_idx
  ON feedback (household_id, status, created_at DESC);
