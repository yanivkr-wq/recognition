-- 0001_init.sql — Reco initial schema (23 domain tables + Auth.js + __migrations).
-- Source of truth: docs/SCHEMA.md, locked at Gate 2 on 2026-05-20.
-- The wallet is an APPEND-ONLY ledger: never UPDATE/DELETE ledger_entry rows.
-- Authorization is enforced at the app boundary (we are NOT on Supabase, so no RLS).
-- Circular FKs (submission ↔ task_completion ↔ ledger_entry ↔ redemption) are added
-- via ALTER TABLE after the tables exist; see the "circular FKs" section below.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. TENANCY & USERS  (docs/SCHEMA.md §1)
-- ============================================================================

CREATE TABLE household (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  tz              TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  locale_default  TEXT NOT NULL DEFAULT 'he',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "user" (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  email                 TEXT NOT NULL UNIQUE,
  email_verified_at     TIMESTAMPTZ,
  password_hash         TEXT NOT NULL,
  name                  TEXT NOT NULL,
  phone_e164            TEXT,
  locale                TEXT NOT NULL DEFAULT 'he',
  role                  TEXT NOT NULL CHECK (role IN ('admin')),
  quiet_hours_start     TIME NOT NULL DEFAULT '21:00',
  quiet_hours_end       TIME NOT NULL DEFAULT '07:00',
  failed_login_count    INT NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. KIDS & DEVICE TRUST  (docs/SCHEMA.md §2)
-- ============================================================================

CREATE TABLE kid (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL,
  color               TEXT NOT NULL,
  avatar_image_path   TEXT,
  locale              TEXT NOT NULL DEFAULT 'he',
  pin_hash            TEXT NOT NULL,
  pin_failed_count    INT NOT NULL DEFAULT 0,
  pin_locked_until    TIMESTAMPTZ,
  birthdate           DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at         TIMESTAMPTZ,
  UNIQUE (household_id, slug)
);

CREATE TABLE device_trust (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  kid_id              UUID NOT NULL REFERENCES kid(id) ON DELETE CASCADE,
  device_label        TEXT NOT NULL,
  trust_token_hash    TEXT NOT NULL,
  user_agent_fp       TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at          TIMESTAMPTZ,
  UNIQUE (kid_id, trust_token_hash)
);

-- ============================================================================
-- 3. TASKS: TEMPLATES, ASSIGNMENTS, REMINDERS  (docs/SCHEMA.md §3)
-- ============================================================================

CREATE TABLE task_template (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                    UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  kind                            TEXT NOT NULL CHECK (kind IN ('daily', 'long_term')),
  title_he                        TEXT NOT NULL,
  title_en                        TEXT NOT NULL,
  description_he                  TEXT,
  description_en                  TEXT,
  icon_key                        TEXT NOT NULL,
  color                           TEXT NOT NULL DEFAULT '#94a3b8',
  coin_value                      INT NOT NULL CHECK (coin_value >= 0),
  evidence_required               BOOLEAN NOT NULL DEFAULT FALSE,
  long_term_unit_label_he         TEXT,
  long_term_unit_label_en         TEXT,
  long_term_per_unit_coins        INT,
  long_term_goal_quantity         INT,
  long_term_bonus_on_complete     INT,
  display_order                   INT NOT NULL DEFAULT 0,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at                     TIMESTAMPTZ,
  CHECK (
    (kind = 'daily'
       AND long_term_unit_label_he IS NULL
       AND long_term_unit_label_en IS NULL
       AND long_term_per_unit_coins IS NULL
       AND long_term_goal_quantity IS NULL
       AND long_term_bonus_on_complete IS NULL)
    OR
    (kind = 'long_term'
       AND long_term_unit_label_he IS NOT NULL
       AND long_term_unit_label_en IS NOT NULL
       AND long_term_per_unit_coins IS NOT NULL
       AND long_term_goal_quantity IS NOT NULL)
  )
);

CREATE TABLE task_assignment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  template_id     UUID NOT NULL REFERENCES task_template(id) ON DELETE RESTRICT,
  kid_id          UUID NOT NULL REFERENCES kid(id) ON DELETE CASCADE,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at     TIMESTAMPTZ,
  UNIQUE (template_id, kid_id)
);

CREATE TABLE task_reminder (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  assignment_id       UUID NOT NULL REFERENCES task_assignment(id) ON DELETE CASCADE,
  fire_time           TIME NOT NULL,
  days_of_week        SMALLINT NOT NULL DEFAULT 127
                        CHECK (days_of_week BETWEEN 0 AND 127),
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, fire_time)
);

-- ============================================================================
-- 4. EVIDENCE  (created before submission; docs/SCHEMA.md §5)
-- ============================================================================

CREATE TABLE evidence (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  kid_id              UUID NOT NULL REFERENCES kid(id) ON DELETE CASCADE,
  filename            TEXT NOT NULL,
  mime_type           TEXT NOT NULL,
  size_bytes          INT NOT NULL CHECK (size_bytes > 0 AND size_bytes < 10485760),
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  purged_at           TIMESTAMPTZ
);

-- ============================================================================
-- 5. SUBMISSIONS  (FKs to task_completion / long_term_progress added later)
-- ============================================================================

CREATE TABLE submission (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  kid_id                      UUID NOT NULL REFERENCES kid(id) ON DELETE CASCADE,
  -- exactly one of these is non-null (FKs added in the "circular FKs" section):
  task_completion_id          UUID,
  long_term_progress_id       UUID,
  evidence_id                 UUID REFERENCES evidence(id) ON DELETE SET NULL,
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'denied')),
  submitted_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at                 TIMESTAMPTZ,
  resolved_by_user_id         UUID REFERENCES "user"(id) ON DELETE SET NULL,
  deny_reason                 TEXT,
  resubmit_of_submission_id   UUID REFERENCES submission(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (task_completion_id IS NOT NULL AND long_term_progress_id IS NULL)
    OR
    (task_completion_id IS NULL AND long_term_progress_id IS NOT NULL)
  ),
  CHECK (
    (status = 'denied' AND deny_reason IS NOT NULL) OR status <> 'denied'
  )
);

-- ============================================================================
-- 6. TASK COMPLETIONS & LONG-TERM PROGRESS  (docs/SCHEMA.md §4)
-- ============================================================================

CREATE TABLE task_completion (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  assignment_id               UUID NOT NULL REFERENCES task_assignment(id) ON DELETE RESTRICT,
  kid_id                      UUID NOT NULL REFERENCES kid(id) ON DELETE CASCADE,
  completion_date             DATE NOT NULL,
  completed_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  undone_at                   TIMESTAMPTZ,
  evidence_submission_id      UUID,  -- FK added later (circular)
  ledger_credit_id            UUID,  -- FK added later (circular)
  approval_status             TEXT NOT NULL DEFAULT 'auto_approved'
                                CHECK (approval_status IN ('auto_approved', 'pending', 'approved', 'denied')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE long_term_progress (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  assignment_id               UUID NOT NULL REFERENCES task_assignment(id) ON DELETE RESTRICT,
  kid_id                      UUID NOT NULL REFERENCES kid(id) ON DELETE CASCADE,
  progress_date               DATE NOT NULL,
  quantity                    INT NOT NULL CHECK (quantity > 0),
  logged_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  undone_at                   TIMESTAMPTZ,
  evidence_submission_id      UUID,  -- FK added later (circular)
  ledger_credit_id            UUID,  -- FK added later (circular)
  approval_status             TEXT NOT NULL DEFAULT 'auto_approved'
                                CHECK (approval_status IN ('auto_approved', 'pending', 'approved', 'denied')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. REWARDS  (docs/SCHEMA.md §6)
-- ============================================================================

CREATE TABLE reward_item (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  title_he                    TEXT NOT NULL,
  title_en                    TEXT NOT NULL,
  description_he              TEXT,
  description_en              TEXT,
  icon_key                    TEXT NOT NULL,
  image_path                  TEXT,
  color                       TEXT NOT NULL DEFAULT '#94a3b8',
  coin_cost                   INT NOT NULL CHECK (coin_cost > 0),
  stock_quantity              INT,
  max_per_kid_per_day         INT,
  display_order               INT NOT NULL DEFAULT 0,
  visible_to_kids             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at                 TIMESTAMPTZ
);

-- ============================================================================
-- 8. BADGES  (docs/SCHEMA.md §9)
-- ============================================================================

CREATE TABLE badge (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  title_he        TEXT NOT NULL,
  title_en        TEXT NOT NULL,
  description_he  TEXT,
  description_en  TEXT,
  icon_key        TEXT NOT NULL,
  color           TEXT NOT NULL,
  awarded_via     TEXT NOT NULL DEFAULT 'campaign'
                    CHECK (awarded_via IN ('campaign', 'manual')),
  display_order   INT NOT NULL DEFAULT 0,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. CAMPAIGNS  (docs/SCHEMA.md §8)
-- ============================================================================

CREATE TABLE campaign (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  title_he                    TEXT NOT NULL,
  title_en                    TEXT NOT NULL,
  description_he              TEXT,
  description_en              TEXT,
  kind                        TEXT NOT NULL CHECK (kind IN ('streak', 'total')),
  start_date                  DATE NOT NULL,
  end_date                    DATE NOT NULL,
  bonus_coins                 INT NOT NULL CHECK (bonus_coins >= 0),
  badge_id                    UUID REFERENCES badge(id) ON DELETE SET NULL,
  streak_target_days          INT CHECK (streak_target_days IS NULL OR streak_target_days > 0),
  streak_freezes_allowed      INT NOT NULL DEFAULT 1,
  streak_per_day_threshold    INT,
  total_target_quantity       INT CHECK (total_target_quantity IS NULL OR total_target_quantity > 0),
  nudge_cadence               TEXT NOT NULL DEFAULT 'standard'
                                CHECK (nudge_cadence IN ('standard', 'aggressive', 'gentle', 'silent')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at                 TIMESTAMPTZ,
  CHECK (end_date >= start_date),
  CHECK (
    (kind = 'streak' AND streak_target_days IS NOT NULL AND total_target_quantity IS NULL)
    OR
    (kind = 'total' AND total_target_quantity IS NOT NULL AND streak_target_days IS NULL)
  )
);

CREATE TABLE campaign_feeding_task (
  campaign_id     UUID NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  template_id     UUID NOT NULL REFERENCES task_template(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, template_id)
);

CREATE TABLE kid_badge (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id                  UUID NOT NULL REFERENCES kid(id) ON DELETE CASCADE,
  badge_id                UUID NOT NULL REFERENCES badge(id) ON DELETE RESTRICT,
  awarded_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  awarded_for_year        INT,
  source_campaign_id      UUID REFERENCES campaign(id) ON DELETE SET NULL,
  awarded_by_user_id      UUID REFERENCES "user"(id) ON DELETE SET NULL,
  -- NULLS NOT DISTINCT so non-yearly badges (awarded_for_year IS NULL) are still
  -- enforced as earn-once. Postgres ≥15 honors this; schema doc §9 describes
  -- the intent ("earned once" semantics) — this constraint encodes it.
  UNIQUE NULLS NOT DISTINCT (kid_id, badge_id, awarded_for_year)
);

CREATE TABLE campaign_enrollment (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  campaign_id                 UUID NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  kid_id                      UUID NOT NULL REFERENCES kid(id) ON DELETE CASCADE,
  enrolled_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_streak              INT NOT NULL DEFAULT 0,
  longest_streak              INT NOT NULL DEFAULT 0,
  freezes_used                INT NOT NULL DEFAULT 0,
  last_streak_advance_date    DATE,
  current_total               INT NOT NULL DEFAULT 0,
  completed_at                TIMESTAMPTZ,
  completed_kind              TEXT CHECK (completed_kind IN ('success', 'incomplete', 'cancelled')),
  bonus_ledger_id             UUID,  -- FK added later (circular)
  badge_award_id              UUID REFERENCES kid_badge(id) ON DELETE SET NULL,
  UNIQUE (campaign_id, kid_id)
);

-- ============================================================================
-- 10. NOTIFICATIONS  (docs/SCHEMA.md §10)
-- ============================================================================

CREATE TABLE notification_event (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  event_kind          TEXT NOT NULL CHECK (event_kind IN (
                        'task_reminder',
                        'submission_pending',
                        'submission_approved',
                        'submission_denied',
                        'new_redeem_item',
                        'campaign_nudge',
                        'campaign_completed',
                        'streak_freeze_used',
                        'streak_broken',
                        'redemption_received',
                        'redemption_refunded',
                        'admin_wallet_adjustment',
                        'sibling_badge_earned'
                      )),
  recipient_kid_id    UUID REFERENCES kid(id) ON DELETE CASCADE,
  recipient_user_id   UUID REFERENCES "user"(id) ON DELETE CASCADE,
  channel             TEXT NOT NULL CHECK (channel IN ('whatsapp', 'bell')),
  state               TEXT NOT NULL DEFAULT 'pending'
                        CHECK (state IN ('pending', 'sent', 'failed', 'skipped', 'deferred', 'rate_limited')),
  deferred_until      TIMESTAMPTZ,
  fire_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at             TIMESTAMPTZ,
  error_msg           TEXT,
  dedup_key           TEXT NOT NULL,
  provider_id         TEXT,
  payload_json        JSONB NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (recipient_kid_id IS NOT NULL AND recipient_user_id IS NULL)
    OR
    (recipient_kid_id IS NULL AND recipient_user_id IS NOT NULL)
  ),
  UNIQUE (dedup_key, channel)
);

CREATE TABLE campaign_nudge_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  campaign_id           UUID NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  kid_id                UUID NOT NULL REFERENCES kid(id) ON DELETE CASCADE,
  fired_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel               TEXT NOT NULL CHECK (channel IN ('whatsapp', 'bell')),
  message_text          TEXT,
  notification_event_id UUID REFERENCES notification_event(id) ON DELETE SET NULL
);

-- ============================================================================
-- 11. REDEMPTIONS  (ledger_* FKs added later; docs/SCHEMA.md §6)
-- ============================================================================

CREATE TABLE redemption (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  kid_id                      UUID NOT NULL REFERENCES kid(id) ON DELETE CASCADE,
  reward_item_id              UUID NOT NULL REFERENCES reward_item(id) ON DELETE RESTRICT,
  snapshot_title_he           TEXT NOT NULL,
  snapshot_title_en           TEXT NOT NULL,
  snapshot_coin_cost          INT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'pending_delivery'
                                CHECK (status IN ('pending_delivery', 'received', 'cancelled', 'refunded')),
  redeemed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at                 TIMESTAMPTZ,
  received_by_user_id         UUID REFERENCES "user"(id) ON DELETE SET NULL,
  received_by_kid_id          UUID REFERENCES kid(id) ON DELETE SET NULL,
  cancelled_at                TIMESTAMPTZ,
  cancelled_by_user_id        UUID REFERENCES "user"(id) ON DELETE SET NULL,
  cancel_reason               TEXT,
  refunded_at                 TIMESTAMPTZ,
  refunded_by_user_id         UUID REFERENCES "user"(id) ON DELETE SET NULL,
  refund_reason               TEXT,
  ledger_debit_id             UUID NOT NULL,  -- FK added later (circular)
  ledger_refund_credit_id     UUID,           -- FK added later (circular)
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (received_by_user_id IS NULL OR received_by_kid_id IS NULL),
  CHECK ((status = 'received' AND received_at IS NOT NULL) OR status <> 'received')
);

-- ============================================================================
-- 12. WALLET LEDGER  (docs/SCHEMA.md §7 — APPEND-ONLY)
-- ============================================================================

CREATE TABLE ledger_entry (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  kid_id                      UUID NOT NULL REFERENCES kid(id) ON DELETE RESTRICT,
  kind                        TEXT NOT NULL CHECK (kind IN (
                                'earn',
                                'campaign_bonus',
                                'redeem',
                                'redemption_refund',
                                'admin_credit',
                                'admin_debit',
                                'undo'
                              )),
  amount                      INT NOT NULL,
  clamped_amount              INT,
  balance_after               INT NOT NULL,
  task_completion_id          UUID REFERENCES task_completion(id) ON DELETE RESTRICT,
  long_term_progress_id       UUID REFERENCES long_term_progress(id) ON DELETE RESTRICT,
  redemption_id               UUID REFERENCES redemption(id) ON DELETE RESTRICT,
  campaign_id                 UUID REFERENCES campaign(id) ON DELETE RESTRICT,
  admin_user_id               UUID REFERENCES "user"(id) ON DELETE RESTRICT,
  undo_of_entry_id            UUID REFERENCES ledger_entry(id) ON DELETE RESTRICT,
  note                        TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (kind IN ('admin_credit', 'admin_debit') AND admin_user_id IS NOT NULL AND note IS NOT NULL)
    OR
    kind NOT IN ('admin_credit', 'admin_debit')
  ),
  CHECK (
    (kind = 'undo' AND undo_of_entry_id IS NOT NULL)
    OR kind <> 'undo'
  ),
  CHECK (
    (kind = 'earn' AND amount > 0
       AND (task_completion_id IS NOT NULL OR long_term_progress_id IS NOT NULL))
    OR kind <> 'earn'
  ),
  CHECK (
    (kind = 'redeem' AND amount < 0 AND redemption_id IS NOT NULL)
    OR kind <> 'redeem'
  ),
  CHECK (
    (kind = 'campaign_bonus' AND amount > 0 AND campaign_id IS NOT NULL)
    OR kind <> 'campaign_bonus'
  ),
  CHECK (
    (kind = 'redemption_refund' AND amount > 0 AND redemption_id IS NOT NULL)
    OR kind <> 'redemption_refund'
  ),
  CHECK (
    (kind = 'admin_credit' AND amount > 0)
    OR (kind = 'admin_debit' AND amount < 0)
    OR kind NOT IN ('admin_credit', 'admin_debit')
  )
);

-- ============================================================================
-- 13. AUDIT LOG  (docs/SCHEMA.md §11)
-- ============================================================================

CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  actor_user_id   UUID REFERENCES "user"(id) ON DELETE SET NULL,
  actor_kid_id    UUID REFERENCES kid(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  target_kind     TEXT NOT NULL,
  target_id       UUID,
  before_json     JSONB,
  after_json      JSONB,
  reason          TEXT,
  request_ip      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 14. AUTH.JS V5 TABLES  (docs/SCHEMA.md §12)
-- ============================================================================

CREATE TABLE session (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  expires       TIMESTAMPTZ NOT NULL,
  session_token TEXT NOT NULL UNIQUE
);

CREATE TABLE account (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          BIGINT,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  UNIQUE (provider, provider_account_id)
);

CREATE TABLE verification_token (
  identifier TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ============================================================================
-- 15. MIGRATIONS TRACKING  (docs/SCHEMA.md §12)
-- ============================================================================
-- The runner also creates this table at boot via CREATE TABLE IF NOT EXISTS;
-- defining it here makes a clean dump explicit.

CREATE TABLE IF NOT EXISTS __migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 16. CIRCULAR FOREIGN KEYS (added after every referenced table exists)
-- ============================================================================

ALTER TABLE submission
  ADD CONSTRAINT submission_task_completion_fk
    FOREIGN KEY (task_completion_id) REFERENCES task_completion(id) ON DELETE CASCADE;

ALTER TABLE submission
  ADD CONSTRAINT submission_long_term_progress_fk
    FOREIGN KEY (long_term_progress_id) REFERENCES long_term_progress(id) ON DELETE CASCADE;

ALTER TABLE task_completion
  ADD CONSTRAINT task_completion_evidence_submission_fk
    FOREIGN KEY (evidence_submission_id) REFERENCES submission(id) ON DELETE SET NULL;

ALTER TABLE task_completion
  ADD CONSTRAINT task_completion_ledger_credit_fk
    FOREIGN KEY (ledger_credit_id) REFERENCES ledger_entry(id) ON DELETE RESTRICT;

ALTER TABLE long_term_progress
  ADD CONSTRAINT long_term_progress_evidence_submission_fk
    FOREIGN KEY (evidence_submission_id) REFERENCES submission(id) ON DELETE SET NULL;

ALTER TABLE long_term_progress
  ADD CONSTRAINT long_term_progress_ledger_credit_fk
    FOREIGN KEY (ledger_credit_id) REFERENCES ledger_entry(id) ON DELETE RESTRICT;

ALTER TABLE campaign_enrollment
  ADD CONSTRAINT campaign_enrollment_bonus_ledger_fk
    FOREIGN KEY (bonus_ledger_id) REFERENCES ledger_entry(id) ON DELETE SET NULL;

ALTER TABLE redemption
  ADD CONSTRAINT redemption_ledger_debit_fk
    FOREIGN KEY (ledger_debit_id) REFERENCES ledger_entry(id) ON DELETE RESTRICT;

ALTER TABLE redemption
  ADD CONSTRAINT redemption_ledger_refund_credit_fk
    FOREIGN KEY (ledger_refund_credit_id) REFERENCES ledger_entry(id) ON DELETE SET NULL;

-- ============================================================================
-- 17. INDEXES  (docs/SCHEMA.md §14)
-- ============================================================================

-- Task completion: partial unique index = double-claim prevention.
CREATE UNIQUE INDEX task_completion_assignment_date_active
  ON task_completion(assignment_id, completion_date)
  WHERE undone_at IS NULL;
CREATE INDEX task_completion_kid_date
  ON task_completion(kid_id, completion_date);

-- Long-term progress (NOT unique — multiple logs per day allowed).
CREATE INDEX long_term_progress_assignment_date
  ON long_term_progress(assignment_id, progress_date)
  WHERE undone_at IS NULL;
CREATE INDEX long_term_progress_kid_date
  ON long_term_progress(kid_id, progress_date);

-- Submission queues.
CREATE INDEX submission_pending
  ON submission(household_id, submitted_at DESC)
  WHERE status = 'pending';
CREATE INDEX submission_kid_recent
  ON submission(kid_id, submitted_at DESC);

-- Evidence purge candidates.
CREATE INDEX evidence_purge_candidates
  ON evidence(uploaded_at)
  WHERE purged_at IS NULL;

-- Ledger.
CREATE INDEX ledger_kid_recent ON ledger_entry(kid_id, created_at DESC);
CREATE INDEX ledger_kid_kind ON ledger_entry(kid_id, kind);

-- Campaigns.
CREATE INDEX campaign_active
  ON campaign(household_id, end_date)
  WHERE archived_at IS NULL;
CREATE INDEX campaign_enrollment_active
  ON campaign_enrollment(kid_id, campaign_id)
  WHERE completed_at IS NULL;

-- Notifications.
CREATE INDEX notification_event_pending
  ON notification_event(channel, state, deferred_until)
  WHERE state IN ('pending', 'deferred');
CREATE INDEX notification_event_recipient_kid
  ON notification_event(recipient_kid_id, created_at DESC)
  WHERE recipient_kid_id IS NOT NULL;
CREATE INDEX notification_event_recipient_user
  ON notification_event(recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

-- Campaign nudge log.
CREATE INDEX campaign_nudge_log_recent
  ON campaign_nudge_log(campaign_id, kid_id, fired_at DESC);

-- Redemption.
CREATE INDEX redemption_kid_recent ON redemption(kid_id, redeemed_at DESC);
CREATE INDEX redemption_pending
  ON redemption(household_id, redeemed_at DESC)
  WHERE status = 'pending_delivery';

-- Audit log.
CREATE INDEX audit_log_household_recent
  ON audit_log(household_id, created_at DESC);
CREATE INDEX audit_log_target
  ON audit_log(target_kind, target_id, created_at DESC);

-- Session lookup.
CREATE INDEX session_user_id ON session(user_id);

-- Device trust active lookup.
CREATE INDEX device_trust_kid_active
  ON device_trust(kid_id)
  WHERE revoked_at IS NULL;
