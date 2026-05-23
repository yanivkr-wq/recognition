/**
 * Drizzle definitions for task_completion (daily) + long_term_progress.
 *
 * Both tables carry circular FKs to submission + ledger_entry that are set
 * post-CREATE in 0001_init.sql §16 — left as bare uuid columns here. The
 * single-active-row-per-day invariant on task_completion is enforced by the
 * partial unique index task_completion_assignment_date_active (also in
 * 0001_init.sql §17); the column shape is identical, just with undone_at
 * carrying the soft-delete signal.
 */

import { pgTable, uuid, text, timestamp, integer, date } from 'drizzle-orm/pg-core';
import { household } from './tenancy';
import { kid } from './kids';
import { taskAssignment } from './tasks';

export type ApprovalStatus = 'auto_approved' | 'pending' | 'approved' | 'denied';

export const taskCompletion = pgTable('task_completion', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  assignmentId: uuid('assignment_id')
    .notNull()
    .references(() => taskAssignment.id, { onDelete: 'restrict' }),
  kidId: uuid('kid_id')
    .notNull()
    .references(() => kid.id, { onDelete: 'cascade' }),
  completionDate: date('completion_date').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  undoneAt: timestamp('undone_at', { withTimezone: true }),
  // Circular FKs — added in 0001_init.sql §16.
  evidenceSubmissionId: uuid('evidence_submission_id'),
  ledgerCreditId: uuid('ledger_credit_id'),
  approvalStatus: text('approval_status').$type<ApprovalStatus>().notNull().default('auto_approved'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const longTermProgress = pgTable('long_term_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  assignmentId: uuid('assignment_id')
    .notNull()
    .references(() => taskAssignment.id, { onDelete: 'restrict' }),
  kidId: uuid('kid_id')
    .notNull()
    .references(() => kid.id, { onDelete: 'cascade' }),
  progressDate: date('progress_date').notNull(),
  quantity: integer('quantity').notNull(),
  loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
  undoneAt: timestamp('undone_at', { withTimezone: true }),
  // Circular FKs — added in 0001_init.sql §16.
  evidenceSubmissionId: uuid('evidence_submission_id'),
  ledgerCreditId: uuid('ledger_credit_id'),
  approvalStatus: text('approval_status').$type<ApprovalStatus>().notNull().default('auto_approved'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TaskCompletion = typeof taskCompletion.$inferSelect;
export type TaskCompletionInsert = typeof taskCompletion.$inferInsert;
export type LongTermProgress = typeof longTermProgress.$inferSelect;
export type LongTermProgressInsert = typeof longTermProgress.$inferInsert;
