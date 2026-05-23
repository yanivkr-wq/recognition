-- 2026-05-23 — Age-appropriate task + reward bulk load (Lia age 10, Yael age 12).
--
-- One-shot data load. NOT a migration — does not run automatically on fresh
-- installs (the 0002_seed_household.sql migration covers the small starter set).
-- Run manually on prod after first deploy:
--   docker exec -i reco-pg psql -U reco -d reco -f /opt/recognition/packages/db/seeds/2026-05-23_age_appropriate_tasks.sql
--
-- Idempotent via ON CONFLICT DO NOTHING + fixed UUIDs. Safe to re-run.
--
-- Content source: Lily's age-appropriate guidelines on 2026-05-23 — 15 tasks
-- per kid scaled by age, plus 10 household-wide rewards spanning both age
-- price points. Existing 6 seed tasks + 6 seed rewards remain (archive via
-- admin if unwanted).

BEGIN;

-- ── LIA (age 10) — 15 daily tasks ──────────────────────────────────────────
INSERT INTO task_template (
  id, household_id, kind, title_he, title_en, description_he, description_en,
  icon_key, color, coin_value, evidence_required, display_order
) VALUES
  ('71000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'daily',
   'לסדר מיטה בבוקר', 'Make the bed', NULL, NULL,
   'ic-bed', '#FFE5D8', 5, FALSE, 100),
  ('71000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'daily',
   'לצחצח שיניים בלי תזכורת', 'Brush teeth without a reminder', NULL, NULL,
   'ic-tooth', '#DBEFFB', 5, FALSE, 101),
  ('71000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'daily',
   'לאסוף צעצועים', 'Tidy up toys', NULL, NULL,
   'ic-broom', '#ECE4F8', 10, FALSE, 102),
  ('71000001-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'daily',
   'להכין תיק לבית ספר', 'Pack the school bag', NULL, NULL,
   'ic-book', '#FFF3D6', 10, FALSE, 103),
  ('71000001-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'daily',
   'לקרוא 15 דקות', 'Read for 15 minutes', NULL, NULL,
   'ic-book', '#ECE4F8', 10, FALSE, 104),
  ('71000001-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'daily',
   'לעזור לערוך שולחן', 'Help set the table', NULL, NULL,
   'ic-meal', '#FFF3D6', 10, FALSE, 105),
  ('71000001-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'daily',
   'לקפל כביסה קטנה', 'Fold a small laundry load', NULL, NULL,
   'ic-shirt', '#FFE0EB', 15, FALSE, 106),
  ('71000001-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'daily',
   'להשקות צמחים', 'Water the plants', NULL, NULL,
   'ic-plant', '#EBFAF3', 10, FALSE, 107),
  ('71000001-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'daily',
   'יום בלי ריב', 'A day without a fight', NULL, NULL,
   'ic-sparkle', '#FFE5D8', 15, FALSE, 108),
  ('71000001-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'daily',
   'לעזור לאחות', 'Help your sister', NULL, NULL,
   'ic-pet', '#EBFAF3', 15, FALSE, 109),
  ('71000001-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'daily',
   'להכין ארוחת ערב קלה', 'Make a light dinner', NULL, NULL,
   'ic-food', '#FFF3D6', 20, FALSE, 110),
  ('71000001-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'daily',
   'שיעורי בית בזמן', 'Homework done on time', 'צלמי תמונה של המחברת', 'Snap a photo of the notebook',
   'ic-homework', '#ECE4F8', 30, TRUE, 111),
  ('71000001-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', 'daily',
   'לסיים ספר', 'Finish a book', NULL, NULL,
   'ic-book', '#ECE4F8', 40, FALSE, 112),
  ('71000001-0000-0000-0000-00000000000e', '11111111-1111-1111-1111-111111111111', 'daily',
   'סדר חדר מלא', 'Tidy the whole room', NULL, NULL,
   'ic-house', '#DBEFFB', 50, FALSE, 113),
  ('71000001-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111', 'daily',
   'ללמוד מיומנות חדשה', 'Learn a new skill', NULL, NULL,
   'ic-star', '#FFF3D6', 60, FALSE, 114)
ON CONFLICT (id) DO NOTHING;

-- Assign all Lia tasks to Lia. Note `id::text LIKE` — Postgres's LIKE doesn't
-- operate on the uuid type directly; we cast to text for the prefix match.
INSERT INTO task_assignment (household_id, template_id, kid_id, enabled)
SELECT '11111111-1111-1111-1111-111111111111',
       t.id,
       '33333333-3333-3333-3333-333333333301',
       TRUE
FROM task_template t
WHERE t.id::text LIKE '71000001-%'
ON CONFLICT (template_id, kid_id) DO NOTHING;

-- ── YAEL (age 12) — 15 daily tasks ─────────────────────────────────────────
INSERT INTO task_template (
  id, household_id, kind, title_he, title_en, description_he, description_en,
  icon_key, color, coin_value, evidence_required, display_order
) VALUES
  ('72000002-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'daily',
   'לסדר חדר מלא', 'Tidy the whole room', NULL, NULL,
   'ic-house', '#DBEFFB', 15, FALSE, 200),
  ('72000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'daily',
   'להכין מערכת ותיק לבד', 'Pack schedule and bag on your own', NULL, NULL,
   'ic-book', '#FFF3D6', 10, FALSE, 201),
  ('72000002-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'daily',
   'להכין ארוחה פשוטה', 'Make a simple meal', NULL, NULL,
   'ic-food', '#FFF3D6', 25, FALSE, 202),
  ('72000002-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'daily',
   'לקרוא 30 דקות', 'Read for 30 minutes', NULL, NULL,
   'ic-book', '#ECE4F8', 15, FALSE, 203),
  ('72000002-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'daily',
   'לעזור עם הכביסה', 'Help with the laundry', NULL, NULL,
   'ic-shirt', '#FFE0EB', 20, FALSE, 204),
  ('72000002-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'daily',
   'לשמור על סדר שבוע שלם', 'Stay tidy for a whole week', NULL, NULL,
   'ic-broom', '#DBEFFB', 40, FALSE, 205),
  ('72000002-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'daily',
   'לבצע מטלה בלי שביקשו', 'Do a chore without being asked', NULL, NULL,
   'ic-sparkle', '#FFE5D8', 20, FALSE, 206),
  ('72000002-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'daily',
   'שעת לימוד עצמאי', 'One hour of independent study', NULL, NULL,
   'ic-pencil', '#ECE4F8', 25, FALSE, 207),
  ('72000002-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'daily',
   'יום בלי מסכים עד שעה מוגדרת', 'No screens until set time', NULL, NULL,
   'ic-sun', '#FFF3D6', 30, FALSE, 208),
  ('72000002-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'daily',
   'לעזור לאחות הקטנה בלימודים', 'Help your younger sister study', NULL, NULL,
   'ic-pet', '#EBFAF3', 25, FALSE, 209),
  ('72000002-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'daily',
   '30 דקות ספורט', '30 minutes of sport', NULL, NULL,
   'ic-bike', '#EBFAF3', 20, FALSE, 210),
  ('72000002-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'daily',
   'לחסוך כסף במשך שבוע', 'Save money for a week', NULL, NULL,
   'ic-wallet', '#FFF3D6', 35, FALSE, 211),
  ('72000002-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', 'daily',
   'לסיים ספר ארוך', 'Finish a long book', NULL, NULL,
   'ic-book', '#ECE4F8', 60, FALSE, 212),
  ('72000002-0000-0000-0000-00000000000e', '11111111-1111-1111-1111-111111111111', 'daily',
   'התמדה חודש בהרגל חדש', 'Stick to a new habit for a month', NULL, NULL,
   'ic-star', '#FFE5D8', 100, FALSE, 213),
  ('72000002-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111', 'daily',
   'פרויקט אישי גדול', 'Big personal project', NULL, NULL,
   'ic-medal', '#ECE4F8', 150, FALSE, 214)
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_assignment (household_id, template_id, kid_id, enabled)
SELECT '11111111-1111-1111-1111-111111111111',
       t.id,
       '33333333-3333-3333-3333-333333333302',
       TRUE
FROM task_template t
WHERE t.id::text LIKE '72000002-%'
ON CONFLICT (template_id, kid_id) DO NOTHING;

-- ── REWARDS (10 household-wide, both age tiers) ────────────────────────────
INSERT INTO reward_item (
  id, household_id, title_he, title_en, description_he, description_en,
  icon_key, color, coin_cost, stock_quantity, max_per_kid_per_day,
  display_order, visible_to_kids
) VALUES
  ('76000003-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'ממתק או קינוח', 'Candy or dessert', NULL, NULL,
   'rw-candy', '#FFF0F6', 50, NULL, 1, 100, TRUE),
  ('76000003-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'לבחור סרט משפחתי', 'Pick a family movie', NULL, NULL,
   'rw-movie', '#FFF3D6', 100, NULL, NULL, 101, TRUE),
  ('76000003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'חצי שעה נוספת מסך', 'Extra 30 minutes of screen time', NULL, NULL,
   'rw-phone', '#EDF6FD', 150, NULL, 1, 102, TRUE),
  ('76000003-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'פעילות מיוחדת עם הורה', 'Special activity with a parent', NULL, NULL,
   'rw-balloon', '#FFE5D8', 250, NULL, NULL, 103, TRUE),
  ('76000003-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
   'מתנה קטנה', 'Small gift', NULL, NULL,
   'rw-gift', '#F6F1FC', 400, NULL, NULL, 104, TRUE),
  ('76000003-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111',
   'לבחור ארוחת ערב', 'Pick dinner for the family', NULL, NULL,
   'rw-cookie', '#FFE0EB', 100, NULL, NULL, 105, TRUE),
  ('76000003-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111',
   'שעה נוספת עם חבר', 'Extra hour with a friend', NULL, NULL,
   'rw-balloon', '#EBFAF3', 200, NULL, NULL, 106, TRUE),
  ('76000003-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111',
   'לישון מאוחר בסופ"ש', 'Stay up late on the weekend', NULL, NULL,
   'rw-pillow', '#F6F1FC', 350, NULL, 1, 107, TRUE),
  ('76000003-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111',
   'יציאה מיוחדת', 'Special outing', NULL, NULL,
   'rw-balloon', '#FFE5D8', 500, NULL, NULL, 108, TRUE),
  ('76000003-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
   'מתנה משמעותית', 'Meaningful gift', NULL, NULL,
   'rw-trophy', '#FFF3D6', 800, NULL, NULL, 109, TRUE)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verify counts.
SELECT 'task_templates_added' AS what, count(*) AS n
  FROM task_template WHERE id::text LIKE '7%';
SELECT 'task_assignments_lia' AS what, count(*) AS n
  FROM task_assignment ta
  JOIN task_template tt ON tt.id = ta.template_id
  WHERE ta.kid_id = '33333333-3333-3333-3333-333333333301'
    AND tt.id::text LIKE '71000001-%';
SELECT 'task_assignments_yael' AS what, count(*) AS n
  FROM task_assignment ta
  JOIN task_template tt ON tt.id = ta.template_id
  WHERE ta.kid_id = '33333333-3333-3333-3333-333333333302'
    AND tt.id::text LIKE '72000002-%';
SELECT 'rewards_added' AS what, count(*) AS n
  FROM reward_item WHERE id::text LIKE '76000003-%';
