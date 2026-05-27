/**
 * Drizzle definitions for task templates, per-kid assignments, and reminders.
 *
 * `task_template.kind` discriminates daily vs long_term tasks; the DB-level
 * CHECK constraint enforces that the long_term_* columns are populated iff
 * kind = 'long_term' (see 0001_init.sql §3). Drizzle just exposes the union
 * type for callers.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  smallint,
  boolean,
  time,
  unique,
} from 'drizzle-orm/pg-core';
import { household } from './tenancy';
import { kid } from './kids';

export type TaskKind = 'daily' | 'long_term';

export const taskTemplate = pgTable('task_template', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  kind: text('kind').$type<TaskKind>().notNull(),
  titleHe: text('title_he').notNull(),
  titleEn: text('title_en').notNull(),
  descriptionHe: text('description_he'),
  descriptionEn: text('description_en'),
  iconKey: text('icon_key').notNull(),
  color: text('color').notNull().default('#94a3b8'),
  coinValue: integer('coin_value').notNull(),
  evidenceRequired: boolean('evidence_required').notNull().default(false),
  /** Times/day a daily task may be completed. NULL = unlimited; 1 = once
   *  (default). Only meaningful for kind='daily'. See 0011_repeatable_tasks. */
  maxPerDay: integer('max_per_day').default(1),
  /** Amount one completion contributes to a journey it feeds (e.g. 15). NULL =
   *  no measure → earns coins but doesn't count toward journeys. See 0012. */
  measureAmount: integer('measure_amount'),
  /** Display unit label for the measure (hours / pages / …). NULL = none. */
  measureUnit: text('measure_unit'),
  longTermUnitLabelHe: text('long_term_unit_label_he'),
  longTermUnitLabelEn: text('long_term_unit_label_en'),
  longTermPerUnitCoins: integer('long_term_per_unit_coins'),
  longTermGoalQuantity: integer('long_term_goal_quantity'),
  longTermBonusOnComplete: integer('long_term_bonus_on_complete'),
  /** Phase 7.5: optional daily deadline TIME in household tz. NULL = no
   *  deadline. Read as a string ('HH:MM:SS') from Postgres TIME columns. */
  deadlineTime: text('deadline_time'),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export const taskAssignment = pgTable(
  'task_assignment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'restrict' }),
    templateId: uuid('template_id')
      .notNull()
      .references(() => taskTemplate.id, { onDelete: 'restrict' }),
    kidId: uuid('kid_id')
      .notNull()
      .references(() => kid.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    // Phase 4 — set when SUM(quantity over active long_term_progress) first
    // crosses long_term_goal_quantity. Cleared on bonus-reversal undo.
    longTermCompletedAt: timestamp('long_term_completed_at', { withTimezone: true }),
  },
  (table) => ({
    templateKidUnq: unique('task_assignment_template_id_kid_id_key').on(
      table.templateId,
      table.kidId,
    ),
  }),
);

export const taskReminder = pgTable(
  'task_reminder',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'restrict' }),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => taskAssignment.id, { onDelete: 'cascade' }),
    fireTime: time('fire_time').notNull(),
    // 7-bit mask: bit 0 = Sunday … bit 6 = Saturday. 127 = every day.
    daysOfWeek: smallint('days_of_week').notNull().default(127),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assignmentFireTimeUnq: unique('task_reminder_assignment_id_fire_time_key').on(
      table.assignmentId,
      table.fireTime,
    ),
  }),
);

export type TaskTemplate = typeof taskTemplate.$inferSelect;
export type TaskTemplateInsert = typeof taskTemplate.$inferInsert;
export type TaskAssignment = typeof taskAssignment.$inferSelect;
export type TaskAssignmentInsert = typeof taskAssignment.$inferInsert;
export type TaskReminder = typeof taskReminder.$inferSelect;
export type TaskReminderInsert = typeof taskReminder.$inferInsert;
