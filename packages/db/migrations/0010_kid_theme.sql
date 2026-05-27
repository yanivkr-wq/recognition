-- 0010_kid_theme.sql — per-player app-wide theme (Lily's request:
-- "let end users pick a theme that recolors the entire app").
--
-- Stores the player's chosen theme ('bubblegum' | 'ocean' | 'sunset').
-- The theme recolors surfaces + the action accent on the player's own
-- surfaces; semantic colors (mint=success, yellow=currency,
-- lavender=campaigns) stay fixed per BRANDBOOK. Defaults to 'bubblegum'
-- (the original pink/cream look) so existing players are unchanged.

ALTER TABLE kid
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'bubblegum';

COMMENT ON COLUMN kid.theme IS
  'App-wide theme the player picked: bubblegum | ocean | sunset. '
  'Recolors surfaces + action accent on the player''s surfaces.';
