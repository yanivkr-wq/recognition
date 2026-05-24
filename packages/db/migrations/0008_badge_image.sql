-- 0008_badge_image.sql — optional custom image for a badge (Lily's request:
-- "let me upload my own as well").
--
-- When set, the uploaded image replaces the em-* SVG emblem everywhere the
-- badge renders (kid badges page, campaign card, admin list, form preview).
-- Relative filename on the shared evidence volume under badges/, mirroring
-- reward + feedback images. NULL = use the SVG emblem (icon_key).

ALTER TABLE badge
  ADD COLUMN IF NOT EXISTS image_path TEXT;

COMMENT ON COLUMN badge.image_path IS
  'Optional admin-uploaded custom badge image (relative volume filename). '
  'When set it overrides the em-* SVG emblem in icon_key.';
