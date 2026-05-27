-- 0009_player_messages.sql — admin → player popup messages (Lily's request).
--
-- An admin composes a short message that appears as a dismissible popup on the
-- player's home, within a [start_date, end_date] window (IL dates, inclusive).
-- kid_id NULL = broadcast to every player in the household. Dismissal is
-- per-player ("do not show again") so a broadcast can be dismissed by each kid
-- independently — tracked in player_message_dismissal.

CREATE TABLE IF NOT EXISTS player_message (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id       UUID NOT NULL REFERENCES household(id) ON DELETE RESTRICT,
  kid_id             UUID REFERENCES kid(id) ON DELETE CASCADE,  -- NULL = all players
  title              TEXT,
  body               TEXT NOT NULL,
  start_date         DATE NOT NULL,
  end_date           DATE NOT NULL,
  created_by_user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at        TIMESTAMPTZ,
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS player_message_household_window_idx
  ON player_message (household_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS player_message_dismissal (
  message_id   UUID NOT NULL REFERENCES player_message(id) ON DELETE CASCADE,
  kid_id       UUID NOT NULL REFERENCES kid(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, kid_id)
);
