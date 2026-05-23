-- 0002_seed_household.sql — Install-time seed.
-- Inserts 1 household, 2 parents, 2 kids (Lia, Yael), 6 sample tasks, 6 sample
-- rewards, and 8 starter badges. Every row uses a fixed UUID + ON CONFLICT DO
-- NOTHING so the migration is idempotent; deploy-prod.sh (Phase 1) prompts for
-- real values and UPDATEs the placeholder identity rows by their known UUIDs.
--
-- IMPORTANT — the parent password_hash and kid pin_hash values below are
-- well-formed but UNMATCHABLE Argon2id placeholders (salt + hash = all-zero
-- bytes). They satisfy NOT NULL but never verify. Per BUILD-PLAN.md Phase 1,
-- deploy-prod.sh prompts the admin for real parent passwords; per Phase 2, the
-- admin sets each kid's PIN via /admin/kids/<id>/pin. Until then, no one can
-- log in as a parent or as a kid — which is the intended "no credentials yet"
-- state after first install.

-- ---------- HOUSEHOLD ----------
INSERT INTO household (id, name, tz, locale_default)
VALUES ('11111111-1111-1111-1111-111111111111', 'My Household', 'Asia/Jerusalem', 'he')
ON CONFLICT (id) DO NOTHING;

-- ---------- PARENTS (admins) ----------
-- Email + password_hash are placeholders; deploy-prod.sh prompts and UPDATEs.
INSERT INTO "user" (id, household_id, email, password_hash, name, locale, role)
VALUES
  ('22222222-2222-2222-2222-222222222201',
   '11111111-1111-1111-1111-111111111111',
   'mom@reco.local',
   '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
   'Mom', 'he', 'admin'),
  ('22222222-2222-2222-2222-222222222202',
   '11111111-1111-1111-1111-111111111111',
   'dad@reco.local',
   '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
   'Dad', 'he', 'admin')
ON CONFLICT (id) DO NOTHING;

-- ---------- KIDS ----------
-- pin_hash is a placeholder (always fails verify). Admin sets a real PIN in Phase 2.
-- color values are locked at install per BRANDBOOK §2.2: Lia=peach, Yael=sky.
INSERT INTO kid (id, household_id, name, slug, color, locale, pin_hash)
VALUES
  ('33333333-3333-3333-3333-333333333301',
   '11111111-1111-1111-1111-111111111111',
   'Lia', 'lia', '#FF9F7A', 'he',
   '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  ('33333333-3333-3333-3333-333333333302',
   '11111111-1111-1111-1111-111111111111',
   'Yael', 'yael', '#6EC9F4', 'he',
   '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
ON CONFLICT (id) DO NOTHING;

-- ---------- SAMPLE TASKS ----------
-- 5 daily + 1 long-term. Icon keys correspond to BRANDBOOK §4.2 family-2 SVG ids.
INSERT INTO task_template (
  id, household_id, kind,
  title_he, title_en,
  description_he, description_en,
  icon_key, color, coin_value, evidence_required,
  long_term_unit_label_he, long_term_unit_label_en,
  long_term_per_unit_coins, long_term_goal_quantity, long_term_bonus_on_complete,
  display_order
) VALUES
  ('55555555-5555-5555-5555-555555555501',
   '11111111-1111-1111-1111-111111111111', 'daily',
   'להציע את המיטה', 'Make bed',
   NULL, NULL,
   'ic-bed', '#FFE5D8', 5, FALSE,
   NULL, NULL, NULL, NULL, NULL,
   10),
  ('55555555-5555-5555-5555-555555555502',
   '11111111-1111-1111-1111-111111111111', 'daily',
   'לצחצח שיניים', 'Brush teeth',
   NULL, NULL,
   'ic-tooth', '#DBEFFB', 3, FALSE,
   NULL, NULL, NULL, NULL, NULL,
   20),
  ('55555555-5555-5555-5555-555555555503',
   '11111111-1111-1111-1111-111111111111', 'daily',
   'ארוחת בוקר', 'Breakfast',
   NULL, NULL,
   'ic-food', '#FFF3D6', 3, FALSE,
   NULL, NULL, NULL, NULL, NULL,
   30),
  ('55555555-5555-5555-5555-555555555504',
   '11111111-1111-1111-1111-111111111111', 'daily',
   'להתלבש', 'Get dressed',
   NULL, NULL,
   'ic-shirt', '#FFE0EB', 3, FALSE,
   NULL, NULL, NULL, NULL, NULL,
   40),
  ('55555555-5555-5555-5555-555555555505',
   '11111111-1111-1111-1111-111111111111', 'daily',
   'שיעורי בית', 'Homework',
   'צלמי תמונה של המחברת', 'Snap a photo of your notebook',
   'ic-homework', '#ECE4F8', 20, TRUE,
   NULL, NULL, NULL, NULL, NULL,
   50),
  ('55555555-5555-5555-5555-555555555506',
   '11111111-1111-1111-1111-111111111111', 'long_term',
   'קריאה', 'Read a book',
   'מטבע על כל עמוד, בונוס בסיום', '1 coin per page, bonus on completion',
   'ic-book', '#ECE4F8', 0, FALSE,
   'עמודים', 'pages',
   1, 100, 50,
   60)
ON CONFLICT (id) DO NOTHING;

-- ---------- SAMPLE REWARDS ----------
-- Costs + bg tile colors per BRANDBOOK §4.4.
INSERT INTO reward_item (
  id, household_id, title_he, title_en, description_he, description_en,
  icon_key, color, coin_cost, stock_quantity, max_per_kid_per_day,
  display_order, visible_to_kids
) VALUES
  ('66666666-6666-6666-6666-666666666601',
   '11111111-1111-1111-1111-111111111111',
   'סוכריה', 'Wrapped candy', NULL, NULL,
   'rw-candy', '#FFF0F6', 2, NULL, 1, 10, TRUE),
  ('66666666-6666-6666-6666-666666666602',
   '11111111-1111-1111-1111-111111111111',
   'זמן מסך', 'Screen time', NULL, NULL,
   'rw-phone', '#EDF6FD', 5, NULL, 2, 20, TRUE),
  ('66666666-6666-6666-6666-666666666603',
   '11111111-1111-1111-1111-111111111111',
   'גלידה', 'Ice cream cone', NULL, NULL,
   'rw-icecream', '#EBFAF3', 8, NULL, NULL, 30, TRUE),
  ('66666666-6666-6666-6666-666666666604',
   '11111111-1111-1111-1111-111111111111',
   'לישון אצל חברה', 'Sleepover', NULL, NULL,
   'rw-pillow', '#F6F1FC', 50, NULL, NULL, 40, TRUE),
  ('66666666-6666-6666-6666-666666666605',
   '11111111-1111-1111-1111-111111111111',
   'כרטיס סרט', 'Movie ticket', NULL, NULL,
   'rw-movie', '#FFF3D6', 100, NULL, NULL, 50, TRUE),
  ('66666666-6666-6666-6666-666666666606',
   '11111111-1111-1111-1111-111111111111',
   'משחק וידאו', 'Game controller', NULL, NULL,
   'rw-controller', '#FFE5D8', 300, NULL, NULL, 60, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ---------- 8 STARTER BADGES ----------
-- Locked emblem set per BRANDBOOK §4.3 + color mapping per §5.5 (dashed-border
-- color). Hebrew titles use feminine forms because both kids are girls
-- (BRANDBOOK §10.1).
INSERT INTO badge (
  id, household_id, title_he, title_en, description_he, description_en,
  icon_key, color, awarded_via, display_order
) VALUES
  ('44444444-4444-4444-4444-444444444401',
   '11111111-1111-1111-1111-111111111111',
   'מלכת המשימות', 'King of Tasks',
   'אלופת קמפיין רצף', 'Streak campaign master',
   'em-crown',   '#FF6B9D', 'campaign', 10),
  ('44444444-4444-4444-4444-444444444402',
   '11111111-1111-1111-1111-111111111111',
   '100 משימות', '100 Tasks',
   'אבן דרך — 100 משימות', '100-task milestone',
   'em-trophy',  '#E8B927', 'campaign', 20),
  ('44444444-4444-4444-4444-444444444403',
   '11111111-1111-1111-1111-111111111111',
   'אלופת קריאה', 'Reading Champion',
   'אבן דרך — קריאה', 'Reading milestone',
   'em-medal',   '#6EC9F4', 'campaign', 30),
  ('44444444-4444-4444-4444-444444444404',
   '11111111-1111-1111-1111-111111111111',
   '30 ימים ברצף', '30-Day Streak',
   'רצף של 30 ימים', '30-day streak',
   'em-diamond', '#3DA8DD', 'campaign', 40),
  ('44444444-4444-4444-4444-444444444405',
   '11111111-1111-1111-1111-111111111111',
   'תעודת הצטיינות', 'Year Completion',
   'סיום קמפיין שנתי', 'End-of-year campaign completion',
   'em-cert',    '#FF9F7A', 'campaign', 50),
  ('44444444-4444-4444-4444-444444444406',
   '11111111-1111-1111-1111-111111111111',
   'יום הולדת', 'Birthday',
   'תג שנתי שמתחדש כל יום הולדת', 'Yearly birthday badge',
   'em-gift',    '#B59FE5', 'campaign', 60),
  ('44444444-4444-4444-4444-444444444407',
   '11111111-1111-1111-1111-111111111111',
   '500 משימות', '500 Tasks',
   'אבן דרך — 500 משימות', '500-task milestone',
   'em-star',    '#FF9F7A', 'campaign', 70),
  ('44444444-4444-4444-4444-444444444408',
   '11111111-1111-1111-1111-111111111111',
   '10 קמפיינים', '10 Campaigns',
   'סיום 10 קמפיינים', '10 campaigns completed',
   'em-torch',   '#FF9F7A', 'campaign', 80)
ON CONFLICT (id) DO NOTHING;
