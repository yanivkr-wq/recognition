# Reco — Postgres Schema (v1)

> Full schema for Reco's PostgreSQL 16 database (`reco-pg`). 23 tables. Single-tenant by design but multi-tenant-ready (every domain row has `household_id`). Migrations are raw SQL under `packages/db/migrations/`, tracked via `__migrations`. Drizzle types live in `packages/db/src/schema/`.
>
> Reco is **not** on Supabase; we do not have row-level security at the DB layer. **Authorization is enforced at the server-action and worker-route boundary.** Every domain query filters by `household_id` AND (for kid-scoped surfaces) `kid_id`. See `ARCHITECTURE.md` §8 for the kid/admin guard pattern.
>
> Naming: tables are singular (`task_template`, not `task_templates`), columns are `snake_case`, mapped to `camelCase` JS by Drizzle.

---

## Table of contents

1. [Tenancy & users](#1-tenancy--users)
2. [Kids & device trust](#2-kids--device-trust)
3. [Tasks: templates, assignments, reminders](#3-tasks-templates-assignments-reminders)
4. [Completions & long-term progress](#4-completions--long-term-progress)
5. [Submissions & evidence](#5-submissions--evidence)
6. [Rewards & redemptions](#6-rewards--redemptions)
7. [Wallet ledger](#7-wallet-ledger)
8. [Campaigns, enrollments, feeding tasks, nudges](#8-campaigns-enrollments-feeding-tasks-nudges)
9. [Badges](#9-badges)
10. [Notifications](#10-notifications)
11. [Audit log](#11-audit-log)
12. [System tables (Auth.js + migrations)](#12-system-tables)
13. [Invariants enforced at app layer](#13-invariants-enforced-at-app-layer)
14. [Indexes summary](#14-indexes-summary)
15. [Schema diagram](#15-schema-diagram)

---

## 1. Tenancy & users

### `household`

```sql
CREATE TABLE household (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  tz              TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  locale_default  TEXT NOT NULL DEFAULT 'he',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Single row in v1. `tz` is the household's clock for all "today is" calculations. Locale used for cron emails and unauthenticated email body fallback.

### `user` (parents/admins only)

```sql
CREATE TABLE "user" (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID NOT NULL REFERENCES household(id),
  email                 TEXT NOT NULL UNIQUE,
  email_verified_at     TIMESTAMPTZ,
  password_hash         TEXT NOT NULL,          -- Argon2 via @node-rs/argon2
  name                  TEXT NOT NULL,
  phone_e164            TEXT,                    -- nullable: a parent without WhatsApp opt-in is OK
  locale                TEXT NOT NULL DEFAULT 'he',
  role                  TEXT NOT NULL CHECK (role IN ('admin')),  -- 'admin' is the only role in v1
  quiet_hours_start     TIME NOT NULL DEFAULT '21:00',
  quiet_hours_end       TIME NOT NULL DEFAULT '07:00',
  failed_login_count    INT NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Auth.js v5 reads/writes this table for credentials login. `email` UNIQUE across the entire database (single household v1; multi-tenant migration would add `(household_id, email)` UNIQUE if needed). `locked_until` is 15-minute lockout window after 5 failed logins per (IP, email) — the IP is logged in `audit_log`, not stored here.

---

## 2. Kids & device trust

### `kid`

```sql
CREATE TABLE kid (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES household(id),
  name                TEXT NOT NULL,            -- "Lia", "Yael"
  slug                TEXT NOT NULL,            -- URL-safe lowercase, unique per household
  color               TEXT NOT NULL,            -- hex, used for chips/avatars
  avatar_image_path   TEXT,                     -- nullable; path on evidence volume under /var/lib/reco/avatars/
  locale              TEXT NOT NULL DEFAULT 'he',
  pin_hash            TEXT NOT NULL,            -- Argon2
  pin_failed_count    INT NOT NULL DEFAULT 0,
  pin_locked_until    TIMESTAMPTZ,
  birthdate           DATE,                     -- optional, for future age-gated features
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at         TIMESTAMPTZ,
  UNIQUE (household_id, slug)
);
```

Kid PIN: 4 digits, hashed with Argon2 (lower memory cost than user passwords — 4-digit space is small enough that we rely on rate-limiting, not hash cost). `pin_locked_until` is 15-min lockout after 5 wrong PINs per kid per device.

### `device_trust`

```sql
CREATE TABLE device_trust (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES household(id),
  kid_id              UUID NOT NULL REFERENCES kid(id),
  device_label        TEXT NOT NULL,            -- "Lia's iPad", set by parent in admin
  trust_token_hash    TEXT NOT NULL,            -- HMAC-SHA256 of (kid_id || device_fingerprint || nonce)
  user_agent_fp       TEXT NOT NULL,            -- coarse browser+OS fingerprint for sanity check
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,     -- 90-day rolling
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at          TIMESTAMPTZ,
  UNIQUE (kid_id, trust_token_hash)
);
```

On kid login with PIN: if "remember this device" is checked, server generates a random token, stores its hash, sets a signed cookie (HMAC by AUTH_SECRET) with the raw token. Subsequent visits: cookie → server hashes → looks up `device_trust`. Match + not expired + not revoked → kid-session JWT issued without PIN entry. Admin can revoke any row from `/admin/kids/<id>/devices`.

---

## 3. Tasks: templates, assignments, reminders

### `task_template`

```sql
CREATE TABLE task_template (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                    UUID NOT NULL REFERENCES household(id),
  kind                            TEXT NOT NULL CHECK (kind IN ('daily', 'long_term')),
  title_he                        TEXT NOT NULL,
  title_en                        TEXT NOT NULL,
  description_he                  TEXT,
  description_en                  TEXT,
  icon_key                        TEXT NOT NULL,                 -- references icons/{icon_key}.svg, served from /public
  color                           TEXT NOT NULL DEFAULT '#94a3b8',
  coin_value                      INT NOT NULL CHECK (coin_value >= 0),  -- for 'daily': per-completion. for 'long_term': leave 0 if per-unit applies.
  evidence_required               BOOLEAN NOT NULL DEFAULT FALSE,
  -- long-term only:
  long_term_unit_label_he         TEXT,                          -- e.g., "עמודים", "דקות"
  long_term_unit_label_en         TEXT,                          -- e.g., "pages", "minutes"
  long_term_per_unit_coins        INT,                           -- coins per unit, e.g., 1 coin per page
  long_term_goal_quantity         INT,                           -- e.g., goal of 100 pages total
  long_term_bonus_on_complete     INT,                           -- coins bonus when goal hit, additive to per-unit
  display_order                   INT NOT NULL DEFAULT 0,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at                     TIMESTAMPTZ,
  CHECK (
    (kind = 'daily' AND long_term_unit_label_he IS NULL AND long_term_unit_label_en IS NULL)
    OR
    (kind = 'long_term' AND long_term_unit_label_he IS NOT NULL AND long_term_unit_label_en IS NOT NULL
                         AND long_term_per_unit_coins IS NOT NULL AND long_term_goal_quantity IS NOT NULL)
  )
);
```

CHECK constraint ensures long-term tasks have their unit/goal/per-unit fields populated; daily tasks don't.

### `task_assignment`

```sql
CREATE TABLE task_assignment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES household(id),
  template_id     UUID NOT NULL REFERENCES task_template(id),
  kid_id          UUID NOT NULL REFERENCES kid(id),
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at     TIMESTAMPTZ,
  UNIQUE (template_id, kid_id)
);
```

A template is the shared definition ("homework", 20 coins, evidence required). An assignment is "Lia has this task in her list" — both kids can have the same template (each with their own `task_assignment` row, their own daily slot per day, their own coins).

### `task_reminder`

```sql
CREATE TABLE task_reminder (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES household(id),
  assignment_id       UUID NOT NULL REFERENCES task_assignment(id),
  fire_time           TIME NOT NULL,            -- e.g. '17:00' Asia/Jerusalem
  days_of_week        SMALLINT NOT NULL DEFAULT 127,  -- 7-bit mask: bit 0 = Sunday ... bit 6 = Saturday. 127 = every day.
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, fire_time)
);
```

NEW feature per Batch 5. Admin sets per-task-assignment reminders. Dispatcher tick (`*/5 min`) checks: for each enabled reminder where `today (IL) DOW` matches and `fire_time` has passed by ≤5 min ago, AND today's `task_completion` for the assignment is missing/incomplete → fire WhatsApp + bell to the kid. Idempotent via `notification_event.dedup_key = 'task_reminder:<reminder_id>:<YYYY-MM-DD>'`.

---

## 4. Completions & long-term progress

### `task_completion` (daily tasks only)

```sql
CREATE TABLE task_completion (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id),
  assignment_id               UUID NOT NULL REFERENCES task_assignment(id),
  kid_id                      UUID NOT NULL REFERENCES kid(id),           -- denormalized for query speed
  completion_date             DATE NOT NULL,             -- (completed_at AT TIME ZONE 'Asia/Jerusalem')::date
  completed_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  undone_at                   TIMESTAMPTZ,               -- non-null = currently undone (kid self-undo)
  evidence_submission_id      UUID REFERENCES submission(id),  -- non-null if task required evidence
  ledger_credit_id            UUID REFERENCES ledger_entry(id),  -- the 'earn' entry, populated on approval/no-evidence-needed
  approval_status             TEXT NOT NULL DEFAULT 'auto_approved'
                                CHECK (approval_status IN ('auto_approved', 'pending', 'approved', 'denied')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, completion_date)  -- at most one completion slot per assignment per day
);
```

The UNIQUE constraint is the **double-claim prevention**. Even if two requests race, only one INSERT succeeds.

- For a no-evidence task: INSERT row with `approval_status = 'auto_approved'` and immediately `ledger.post(earn, ...)` → store the `ledger_credit_id`.
- For an evidence-required task: INSERT row with `approval_status = 'pending'` and `evidence_submission_id` populated; do NOT post to ledger yet. On admin approval, UPDATE to `'approved'` and `ledger.post(...)`. On denial, UPDATE to `'denied'`; kid can submit a new completion (a new row with the same `(assignment_id, completion_date)` would violate UNIQUE — so denied completions are first soft-removed by setting `undone_at = now()`, and the resubmit creates a fresh row).

Wait — that doesn't work cleanly with UNIQUE. Re-think:

**Decision:** UNIQUE is on `(assignment_id, completion_date) WHERE undone_at IS NULL` (partial unique index). A completion row with `undone_at IS NOT NULL` is considered "vacated" — a new row for the same day can be created.

```sql
CREATE UNIQUE INDEX task_completion_assignment_date_active
  ON task_completion(assignment_id, completion_date)
  WHERE undone_at IS NULL;
```

This handles: kid completes → undoes → re-completes (each is a new row, only one active at a time).

### `long_term_progress`

```sql
CREATE TABLE long_term_progress (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id),
  assignment_id               UUID NOT NULL REFERENCES task_assignment(id),
  kid_id                      UUID NOT NULL REFERENCES kid(id),
  progress_date               DATE NOT NULL,
  quantity                    INT NOT NULL CHECK (quantity > 0),
  logged_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  undone_at                   TIMESTAMPTZ,
  evidence_submission_id      UUID REFERENCES submission(id),
  ledger_credit_id            UUID REFERENCES ledger_entry(id),
  approval_status             TEXT NOT NULL DEFAULT 'auto_approved'
                                CHECK (approval_status IN ('auto_approved', 'pending', 'approved', 'denied')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX long_term_progress_assignment_date
  ON long_term_progress(assignment_id, progress_date)
  WHERE undone_at IS NULL;
```

Many rows per assignment (a kid can log progress multiple times per day on the same long-term task). No UNIQUE on assignment+date — that's intentional. Total accumulated = `SUM(quantity) WHERE assignment_id = ? AND undone_at IS NULL AND approval_status IN ('auto_approved','approved')`.

---

## 5. Submissions & evidence

### `submission`

```sql
CREATE TABLE submission (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id),
  kid_id                      UUID NOT NULL REFERENCES kid(id),
  -- exactly one of these is non-null:
  task_completion_id          UUID REFERENCES task_completion(id),
  long_term_progress_id       UUID REFERENCES long_term_progress(id),
  evidence_id                 UUID REFERENCES evidence(id),  -- nullable: a submission can be "no photo, kid just asked for approval"
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'denied')),
  submitted_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at                 TIMESTAMPTZ,
  resolved_by_user_id         UUID REFERENCES "user"(id),
  deny_reason                 TEXT,                          -- required when status='denied'
  resubmit_of_submission_id   UUID REFERENCES submission(id),  -- chain of resubmits
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (task_completion_id IS NOT NULL AND long_term_progress_id IS NULL)
    OR
    (task_completion_id IS NULL AND long_term_progress_id IS NOT NULL)
  ),
  CHECK (
    (status = 'denied' AND deny_reason IS NOT NULL) OR status != 'denied'
  )
);

CREATE INDEX submission_pending
  ON submission(household_id, submitted_at DESC)
  WHERE status = 'pending';

CREATE INDEX submission_kid_recent
  ON submission(kid_id, submitted_at DESC);
```

The XOR CHECK enforces polymorphic FK integrity at the DB level. The pending-index is the parent's `/admin/approvals` queue feed.

### `evidence`

```sql
CREATE TABLE evidence (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES household(id),
  kid_id              UUID NOT NULL REFERENCES kid(id),
  filename            TEXT NOT NULL,                 -- relative path under /var/lib/reco/evidence/
  mime_type           TEXT NOT NULL,
  size_bytes          INT NOT NULL CHECK (size_bytes > 0 AND size_bytes < 10485760),  -- 10 MB cap
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  purged_at           TIMESTAMPTZ                     -- non-null = file deleted from disk; DB row kept for audit
);

CREATE INDEX evidence_purge_candidates
  ON evidence(uploaded_at)
  WHERE purged_at IS NULL;
```

No bytes in the DB. The `purged_at` cron updates this column after `unlink()`.

---

## 6. Rewards & redemptions

### `reward_item`

```sql
CREATE TABLE reward_item (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id),
  title_he                    TEXT NOT NULL,
  title_en                    TEXT NOT NULL,
  description_he              TEXT,
  description_en              TEXT,
  icon_key                    TEXT NOT NULL,
  image_path                  TEXT,                  -- optional; lives on the evidence volume under /var/lib/reco/rewards/
  color                       TEXT NOT NULL DEFAULT '#94a3b8',
  coin_cost                   INT NOT NULL CHECK (coin_cost > 0),
  stock_quantity              INT,                   -- nullable = unlimited
  max_per_kid_per_day         INT,                   -- nullable = unlimited (most rewards)
  display_order               INT NOT NULL DEFAULT 0,
  visible_to_kids             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at                 TIMESTAMPTZ
);
```

`visible_to_kids = false` is admin staging — add a reward, hide it until ready.
`stock_quantity` is the global counter (decremented on each redemption); useful for "limited drops" like a special movie night. NULL = unlimited.
`max_per_kid_per_day` limits e.g. "candy ≤ 1/day per kid" so the kid can't blow their wallet on candy.

### `redemption`

```sql
CREATE TABLE redemption (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id),
  kid_id                      UUID NOT NULL REFERENCES kid(id),
  reward_item_id              UUID NOT NULL REFERENCES reward_item(id),
  -- snapshot fields freeze the reward state at redemption time
  snapshot_title_he           TEXT NOT NULL,
  snapshot_title_en           TEXT NOT NULL,
  snapshot_coin_cost          INT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'pending_delivery'
                                CHECK (status IN ('pending_delivery', 'received', 'cancelled', 'refunded')),
  redeemed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at                 TIMESTAMPTZ,
  received_by_user_id         UUID REFERENCES "user"(id),
  received_by_kid_id          UUID REFERENCES kid(id),
  cancelled_at                TIMESTAMPTZ,
  cancelled_by_user_id        UUID REFERENCES "user"(id),
  cancel_reason               TEXT,
  refunded_at                 TIMESTAMPTZ,
  refunded_by_user_id         UUID REFERENCES "user"(id),
  refund_reason               TEXT,
  ledger_debit_id             UUID NOT NULL REFERENCES ledger_entry(id),  -- the 'redeem' entry; written at redeem time
  ledger_refund_credit_id     UUID REFERENCES ledger_entry(id),           -- the 'redemption_refund' entry, populated only if refunded
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (received_by_user_id IS NULL OR received_by_kid_id IS NULL)  -- never both
  ),
  CHECK (
    (status = 'received' AND received_at IS NOT NULL) OR status != 'received'
  )
);

CREATE INDEX redemption_kid_recent ON redemption(kid_id, redeemed_at DESC);
CREATE INDEX redemption_pending ON redemption(household_id, redeemed_at DESC) WHERE status = 'pending_delivery';
```

`status` transitions:
- `pending_delivery` (initial; coins already debited from ledger and shown as "reserved" but actually committed — see ledger semantics below)
- → `received` (kid or admin confirms hand-off)
- → `cancelled` (admin cancels before delivery; debit refunded via new ledger entry)
- → `refunded` (admin reverses AFTER delivery, e.g. "you ate the candy, but you broke a rule, I'm refunding the coins and you're paying it back via chores"; this is rare)

The snapshot fields are critical: renaming "Candy" to "Treats" in `reward_item` must NOT retroactively rename what Lia redeemed last week. Snapshot at redeem time.

---

## 7. Wallet ledger

**This is the heart of Reco.** The ledger is append-only. Wallet balance is a derived view (`SUM(amount)` over a kid's ledger, clamped at 0 for display). Streak engine derives from `task_completion` rows joined to ledger but the ledger is the audit trail.

### `ledger_entry`

```sql
CREATE TABLE ledger_entry (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id),
  kid_id                      UUID NOT NULL REFERENCES kid(id),
  kind                        TEXT NOT NULL CHECK (kind IN (
                                'earn',                    -- task completion or long-term progress
                                'campaign_bonus',          -- bonus on campaign completion
                                'redeem',                  -- spent on a reward
                                'redemption_refund',       -- coins returned on cancel/refund
                                'admin_credit',            -- joker positive adjustment
                                'admin_debit',             -- joker negative adjustment
                                'undo'                     -- reversal of a prior entry (kid self-undo)
                              )),
  amount                      INT NOT NULL,    -- signed: earn/credit/refund/bonus are positive, redeem/debit/undo are negative
  clamped_amount              INT,             -- when admin_debit would push balance < 0, this records the would-be deficit (kid never sees)
  balance_after               INT NOT NULL,    -- denormalized for fast balance reads; computed by trigger
  -- foreign keys to the originating event (exactly one of these is non-null for non-admin/non-undo kinds):
  task_completion_id          UUID REFERENCES task_completion(id),
  long_term_progress_id       UUID REFERENCES long_term_progress(id),
  redemption_id               UUID REFERENCES redemption(id),
  campaign_id                 UUID REFERENCES campaign(id),
  -- admin/undo specifics:
  admin_user_id               UUID REFERENCES "user"(id),     -- non-null for admin_credit/admin_debit
  undo_of_entry_id            UUID REFERENCES ledger_entry(id),  -- non-null for undo
  note                        TEXT,                              -- required when admin_user_id IS NOT NULL
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (kind IN ('admin_credit', 'admin_debit') AND admin_user_id IS NOT NULL AND note IS NOT NULL)
    OR
    kind NOT IN ('admin_credit', 'admin_debit')
  ),
  CHECK (
    (kind = 'undo' AND undo_of_entry_id IS NOT NULL)
    OR kind != 'undo'
  ),
  CHECK (
    (kind = 'earn' AND amount > 0 AND (task_completion_id IS NOT NULL OR long_term_progress_id IS NOT NULL))
    OR kind != 'earn'
  ),
  CHECK (
    (kind = 'redeem' AND amount < 0 AND redemption_id IS NOT NULL)
    OR kind != 'redeem'
  )
);

CREATE INDEX ledger_kid_recent ON ledger_entry(kid_id, created_at DESC);
CREATE INDEX ledger_kid_kind ON ledger_entry(kid_id, kind);
```

### `wallet_balance` (denormalized cache; optional in v1)

For 2 kids and < 10,000 ledger entries/year, recomputing balance via `SELECT SUM(amount) FROM ledger_entry WHERE kid_id=$1` is fast enough. We can skip the cache table in v1. If we add it later:

```sql
CREATE TABLE wallet_balance (
  kid_id              UUID PRIMARY KEY REFERENCES kid(id),
  balance             INT NOT NULL DEFAULT 0,
  last_entry_id       UUID REFERENCES ledger_entry(id),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Updated by trigger on `ledger_entry` insert. Skipped for v1 unless profiling shows a need.

### Display balance formula

```sql
-- For kid display:
SELECT GREATEST(0, COALESCE(SUM(amount), 0)) AS display_balance
FROM ledger_entry
WHERE kid_id = $1;
```

The GREATEST(0, …) is the "clamp to zero" rule: if admin debited more than the kid had, the ledger keeps the truth, the display floors at 0. Combined with `ledger_entry.clamped_amount`, the parent can see "you tried to subtract 50, only 30 was available" in the admin ledger view.

### Spendable balance (for redemption availability)

```sql
SELECT GREATEST(0, COALESCE(SUM(amount), 0)) AS spendable
FROM ledger_entry
WHERE kid_id = $1;
```

In v1 the ledger debits at redeem time (not at receive), so a pending_delivery redemption already shows as debited. No "reserved coins" concept — the redemption IS the debit. This is simpler. If a redemption is later cancelled or refunded, a new `redemption_refund` ledger entry credits it back.

---

## 8. Campaigns, enrollments, feeding tasks, nudges

### `campaign`

```sql
CREATE TABLE campaign (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id),
  title_he                    TEXT NOT NULL,
  title_en                    TEXT NOT NULL,
  description_he              TEXT,
  description_en              TEXT,
  kind                        TEXT NOT NULL CHECK (kind IN ('streak', 'total')),
  start_date                  DATE NOT NULL,
  end_date                    DATE NOT NULL,
  bonus_coins                 INT NOT NULL CHECK (bonus_coins >= 0),
  badge_id                    UUID REFERENCES badge(id),
  -- streak-only:
  streak_target_days          INT CHECK (streak_target_days IS NULL OR streak_target_days > 0),
  streak_freezes_allowed      INT NOT NULL DEFAULT 1,
  streak_per_day_threshold    INT,                          -- e.g., "read >= 3 pages" per day for the streak. NULL = "any completion counts".
  -- total-only:
  total_target_quantity       INT CHECK (total_target_quantity IS NULL OR total_target_quantity > 0),
  -- nudges:
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

CREATE INDEX campaign_active
  ON campaign(household_id, end_date)
  WHERE archived_at IS NULL;
```

### `campaign_feeding_task`

```sql
CREATE TABLE campaign_feeding_task (
  campaign_id     UUID NOT NULL REFERENCES campaign(id),
  template_id     UUID NOT NULL REFERENCES task_template(id),
  PRIMARY KEY (campaign_id, template_id)
);
```

M:M between campaigns and task templates. A daily task template can feed multiple campaigns simultaneously; one campaign can be fed by multiple task templates ("any reading task feeds the reading campaign"). Worker reads this on every completion to know which campaigns to advance.

### `campaign_enrollment`

```sql
CREATE TABLE campaign_enrollment (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                UUID NOT NULL REFERENCES household(id),
  campaign_id                 UUID NOT NULL REFERENCES campaign(id),
  kid_id                      UUID NOT NULL REFERENCES kid(id),
  enrolled_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- streak state (live, updated by daily-reset cron):
  current_streak              INT NOT NULL DEFAULT 0,
  longest_streak              INT NOT NULL DEFAULT 0,
  freezes_used                INT NOT NULL DEFAULT 0,
  last_streak_advance_date    DATE,
  -- total state (live, updated on each progress log):
  current_total               INT NOT NULL DEFAULT 0,
  -- terminal state:
  completed_at                TIMESTAMPTZ,
  completed_kind              TEXT CHECK (completed_kind IN ('success', 'incomplete', 'cancelled')),
  bonus_ledger_id             UUID REFERENCES ledger_entry(id),
  badge_award_id              UUID REFERENCES kid_badge(id),
  UNIQUE (campaign_id, kid_id)
);

CREATE INDEX campaign_enrollment_active
  ON campaign_enrollment(kid_id, campaign_id)
  WHERE completed_at IS NULL;
```

When kids enroll in (or are auto-enrolled in) a campaign, one row per (campaign, kid). Each kid has independent streak/total state.

### `campaign_nudge_log`

```sql
CREATE TABLE campaign_nudge_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES household(id),
  campaign_id         UUID NOT NULL REFERENCES campaign(id),
  kid_id              UUID NOT NULL REFERENCES kid(id),
  fired_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel             TEXT NOT NULL CHECK (channel IN ('whatsapp', 'bell')),
  message_text        TEXT,
  notification_event_id UUID REFERENCES notification_event(id)
);

CREATE INDEX campaign_nudge_log_recent
  ON campaign_nudge_log(campaign_id, kid_id, fired_at DESC);
```

Lets the nudge cron query "when did I last nudge this kid on this campaign?" to enforce cooldown.

---

## 9. Badges

### `badge`

```sql
CREATE TABLE badge (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES household(id),
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
```

V1: badges are cosmetic. They appear on the kid's `/badges` collection page. No feature-unlock semantics. Future v2: badges might unlock something.

### `kid_badge`

```sql
CREATE TABLE kid_badge (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id                  UUID NOT NULL REFERENCES kid(id),
  badge_id                UUID NOT NULL REFERENCES badge(id),
  awarded_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  awarded_for_year        INT,                                -- non-null for recurring/yearly badges (birthday)
  source_campaign_id      UUID REFERENCES campaign(id),       -- non-null if awarded by campaign completion
  awarded_by_user_id      UUID REFERENCES "user"(id),         -- non-null if manually awarded by admin
  UNIQUE (kid_id, badge_id, awarded_for_year)                 -- partial: same badge can recur yearly (e.g., Birthday 2026, Birthday 2027)
);
```

If admin manually awards a badge to a kid via `/admin/kids/<id>/badges/award`, `awarded_by_user_id` is set; `source_campaign_id` is null.

**Recurring badges (per Q4 decision):** the `Birthday` seed badge is awarded yearly. The daily-reset cron checks each kid's `birthdate` against today (month + day); if match AND no `kid_badge(kid_id, badge_id=birthday_badge_id, awarded_for_year=current_year)` exists, INSERT one and fire a `campaign_completed`-style notification ("🎂 Happy birthday, Lia! You earned the Birthday {year} badge."). For non-recurring badges, `awarded_for_year` is NULL and the UNIQUE constraint enforces "earned once" semantics.

---

## 10. Notifications

### `notification_event`

```sql
CREATE TABLE notification_event (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES household(id),
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
  recipient_kid_id    UUID REFERENCES kid(id),
  recipient_user_id   UUID REFERENCES "user"(id),
  channel             TEXT NOT NULL CHECK (channel IN ('whatsapp', 'bell')),
  state               TEXT NOT NULL DEFAULT 'pending'
                        CHECK (state IN ('pending', 'sent', 'failed', 'skipped', 'deferred', 'rate_limited')),
  deferred_until      TIMESTAMPTZ,
  fire_at             TIMESTAMPTZ NOT NULL DEFAULT now(),    -- when it became eligible
  sent_at             TIMESTAMPTZ,
  error_msg           TEXT,
  dedup_key           TEXT NOT NULL,                         -- e.g. 'task_reminder:<reminder_id>:<date>'
  provider_id         TEXT,                                  -- Twilio SID for whatsapp; null for bell
  payload_json        JSONB NOT NULL,                        -- localized message + metadata
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (recipient_kid_id IS NOT NULL AND recipient_user_id IS NULL)
    OR
    (recipient_kid_id IS NULL AND recipient_user_id IS NOT NULL)
  ),
  UNIQUE (dedup_key, channel)  -- channel-aware dedup; bell + whatsapp for same event ARE allowed
);

CREATE INDEX notification_event_pending
  ON notification_event(channel, state, deferred_until)
  WHERE state IN ('pending', 'deferred');

CREATE INDEX notification_event_recipient_kid
  ON notification_event(recipient_kid_id, created_at DESC)
  WHERE recipient_kid_id IS NOT NULL;

CREATE INDEX notification_event_recipient_user
  ON notification_event(recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;
```

`dedup_key` shape examples:
- `task_reminder:<reminder_id>:<YYYY-MM-DD>`
- `submission_pending:<submission_id>:<user_id>`
- `submission_approved:<submission_id>`
- `campaign_nudge:<campaign_id>:<kid_id>:<YYYY-MM-DD>`
- `new_redeem_item:<reward_item_id>:<kid_id>`

The UNIQUE constraint on (dedup_key, channel) prevents double-fires across cron ticks. INSERT ON CONFLICT DO NOTHING is the standard pattern in the dispatcher.

### `notification_preferences`

For v1 the per-user (`user`) quiet_hours_start/_end columns are inline on the user table. Kid quiet hours are derived from the household default (parents set them in admin, applied to all kids). If we later need per-kid override:

```sql
CREATE TABLE notification_preferences (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id            UUID NOT NULL REFERENCES household(id),
  kid_id                  UUID REFERENCES kid(id),
  user_id                 UUID REFERENCES "user"(id),
  quiet_hours_start       TIME,
  quiet_hours_end         TIME,
  channel_overrides       JSONB NOT NULL DEFAULT '{}',  -- e.g. {"task_reminder": ["bell"]} suppresses WhatsApp
  CHECK (
    (kid_id IS NOT NULL AND user_id IS NULL)
    OR (kid_id IS NULL AND user_id IS NOT NULL)
  )
);
```

Deferred to v1.5 if needed.

---

## 11. Audit log

### `audit_log`

```sql
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES household(id),
  actor_user_id   UUID REFERENCES "user"(id),         -- the parent who did it
  actor_kid_id    UUID REFERENCES kid(id),            -- non-null only for kid-side actions worth logging
  action          TEXT NOT NULL,                       -- e.g. 'wallet.admin_credit', 'task.archived', 'submission.approved'
  target_kind     TEXT NOT NULL,                       -- e.g. 'kid', 'task_template', 'submission'
  target_id       UUID,
  before_json     JSONB,
  after_json      JSONB,
  reason          TEXT,                                -- mandatory for wallet/ledger admin actions
  request_ip      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_household_recent
  ON audit_log(household_id, created_at DESC);

CREATE INDEX audit_log_target
  ON audit_log(target_kind, target_id, created_at DESC);
```

Every admin (joker) wallet action writes here in addition to the ledger entry. Both parents see the household's audit feed in `/admin/audit`.

---

## 12. System tables

### Auth.js v5 tables

Standard NextAuth v5 + Drizzle adapter shape. Reused as-is from family-tasks-hub:

- `session(id, user_id, expires, session_token)`
- `account(id, user_id, type, provider, provider_account_id, ...)` — not used in v1 (no OAuth) but the table exists.
- `verification_token(identifier, token, expires)` — used for password reset.

### Migrations tracking

```sql
CREATE TABLE __migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Migration applier records each file as applied. Idempotent re-runs.

---

## 13. Invariants enforced at app layer

These are invariants we deliberately did NOT encode as Postgres triggers (to keep migrations forward-only and to keep the DB inspectable). They're enforced by code paths and asserted by Vitest tests:

1. **`ledger.post()` is the only entry point for ledger writes.** No raw `INSERT INTO ledger_entry` anywhere in the codebase. Verified by a grep test in CI.
2. **`ledger.post()` computes `balance_after` atomically inside a serializable transaction.**
3. **A daily task completion can have at most ONE active row per (assignment, date).** Enforced by the partial unique index; the app layer also checks before INSERT for friendlier error messages.
4. **A kid's display balance never goes negative.** Display formula is `GREATEST(0, SUM(amount))`. The ledger truth can be negative (after admin overdraw); display is clamped.
5. **Approval state transitions are linear**: `pending` → `approved` | `denied`. No re-opening. A new submission must be created for a resubmit.
6. **Streak engine is purely derivable from `task_completion` + `long_term_progress` filtered by `undone_at IS NULL` and `approval_status IN ('auto_approved','approved')`.** `campaign_enrollment.current_streak` is a cache, recomputable from scratch by the daily-reset cron's logic if ever corrupted.
7. **`reward_item.stock_quantity` decrement is inside the same transaction as `redemption` INSERT and `ledger.post(redeem)`.** Race-safe: `UPDATE reward_item SET stock_quantity = stock_quantity - 1 WHERE id=$1 AND (stock_quantity IS NULL OR stock_quantity > 0) RETURNING stock_quantity`. If RETURNING is null, fail the redemption.
8. **A kid only completes their own task assignment.** Server action checks `assignment.kid_id == session.kid_id` BEFORE the INSERT and ALSO joins on it in the INSERT statement.
9. **An admin's reason string is required for wallet actions.** Server action requires non-empty `reason`; ledger CHECK constraint enforces at the DB level.
10. **All `notification_event` writes use INSERT ON CONFLICT (dedup_key, channel) DO NOTHING.** Idempotent across cron ticks.

---

## 14. Indexes summary

| Table | Index | Purpose |
|---|---|---|
| `user` | UNIQUE(email) | login lookup |
| `kid` | UNIQUE(household_id, slug) | profile-picker URL routing |
| `device_trust` | UNIQUE(kid_id, trust_token_hash) | trust lookup |
| `task_assignment` | UNIQUE(template_id, kid_id) | no-duplicate-assignment |
| `task_completion` | partial UNIQUE(assignment_id, completion_date) WHERE undone_at IS NULL | double-claim prevention |
| `task_completion` | (kid_id, completion_date) | wallet history + streak query |
| `long_term_progress` | (assignment_id, progress_date) WHERE undone_at IS NULL | total computation |
| `submission` | partial idx WHERE status='pending' | parent approval queue |
| `submission` | (kid_id, submitted_at DESC) | kid's own history |
| `evidence` | partial idx WHERE purged_at IS NULL | purge cron candidate scan |
| `ledger_entry` | (kid_id, created_at DESC) | wallet history view |
| `ledger_entry` | (kid_id, kind) | "how many earns/redeems this month" |
| `campaign` | partial idx WHERE archived_at IS NULL | active campaigns |
| `campaign_enrollment` | partial idx WHERE completed_at IS NULL | kid's active campaigns |
| `notification_event` | UNIQUE(dedup_key, channel) | dedup |
| `notification_event` | (channel, state, deferred_until) WHERE state IN ('pending','deferred') | dispatcher tick |
| `redemption` | (kid_id, redeemed_at DESC) | kid's redemption tracker |
| `audit_log` | (household_id, created_at DESC) | admin audit feed |

---

## 15. Schema diagram

```
                              household
                                  │
                ┌─────────────────┼──────────────────┐
                │                 │                  │
              user              kid               (task_template, reward_item,
            (parents)        (Lia, Yael)          campaign, badge) — household-scoped
                │                 │                                            
            session         device_trust                                       
                                  │                                            
                  ┌───────────────┼──────────────────┐                         
                  │               │                  │                         
              task_assignment──► task_reminder       │                         
                  │ (per kid)                        │                         
                  ▼                                   │                         
            task_completion (daily, 1/day max)        │                         
                  │                                   │                         
                  │   long_term_progress (many/day)   │                         
                  │       │                            │                         
                  ▼       ▼                            │                         
                  submission ───► evidence            │                         
                  │  (pending → approved/denied)      │                         
                  │                                   │                         
                  └───────────────┬───────────────────┘                         
                                  │                                              
                              ledger_entry                                       
                  (kind: earn / redeem / campaign_bonus /                        
                   admin_credit / admin_debit / undo /                           
                   redemption_refund)                                            
                                  │                                              
                                  ├──► redemption ───► reward_item               
                                  │                                              
                                  └──► campaign_enrollment ───► campaign         
                                              │                       │         
                                              │       campaign_feeding_task ──► task_template
                                              │                                  
                                              └──► kid_badge ───► badge          

                              notification_event
                              (recipient: kid OR user; channel: whatsapp OR bell)

                              audit_log
                              (every admin action; both parents see)
```

---

*Last updated: 2026-05-20. Companion to `ARCHITECTURE.md` §8 (auth) + §10.1-3 (flow diagrams). Schema is locked at Gate 2; changes require explicit re-confirmation.*
