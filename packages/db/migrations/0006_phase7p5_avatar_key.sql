-- 0006_phase7p5_avatar_key.sql — preset avatar key (Lily's Fix 11).
--
-- The kid can pick a face from the inline avatar bank
-- (apps/web/src/components/avatar-library.tsx). This column stores the
-- chosen key (e.g. 'av-fox', 'av-bunny'). It's separate from
-- `avatar_image_path` (an admin-uploaded photo) so the two paths don't
-- collide. The Avatar renderer prefers `avatar_key` when set, then
-- `avatar_image_path`, then falls back to the initial-letter circle.
--
-- Nullable — existing rows + new kids land with NULL until they pick.

ALTER TABLE kid
  ADD COLUMN IF NOT EXISTS avatar_key TEXT;

COMMENT ON COLUMN kid.avatar_key IS
  'Optional preset avatar key from the inline avatar library (e.g. ''av-fox''). '
  'Kid-editable via /[lang]/avatar.';
