/**
 * In-app feedback table (Drizzle).
 *
 * Submitted by either principal (kid or admin) from a floating button; only
 * admins triage on /admin/feedback. submitted_by_kid_id / submitted_by_user_id
 * are mutually-exclusive nullable FKs (one set per principal); submitter_label
 * is denormalized so the admin list survives a deleted kid/user row.
 *
 * image_path is a relative filename on the shared evidence volume (feedback/
 * subdir), mirroring reward images. status flows new → in_progress →
 * in_validation → completed. See migration 0007_feedback.sql for the CHECKs.
 */

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { household, user } from './tenancy';
import { kid } from './kids';

export type FeedbackCategory = 'bug' | 'ui_ux' | 'feature';
export type FeedbackStatus = 'new' | 'in_progress' | 'in_validation' | 'completed';

export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'restrict' }),
    submittedByKidId: uuid('submitted_by_kid_id').references(() => kid.id, {
      onDelete: 'set null',
    }),
    submittedByUserId: uuid('submitted_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    submitterLabel: text('submitter_label').notNull(),
    category: text('category').$type<FeedbackCategory>().notNull(),
    body: text('body').notNull(),
    imagePath: text('image_path'),
    status: text('status').$type<FeedbackStatus>().notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byStatus: index('feedback_household_status_created_idx').on(
      table.householdId,
      table.status,
      table.createdAt,
    ),
  }),
);

export type Feedback = typeof feedback.$inferSelect;
export type FeedbackInsert = typeof feedback.$inferInsert;
