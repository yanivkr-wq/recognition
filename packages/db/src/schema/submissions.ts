/**
 * Drizzle definitions for kid submissions + uploaded evidence files.
 *
 * `submission` is a polymorphic parent of either a task_completion or a
 * long_term_progress row (XOR check at DB). FKs back to those two tables are
 * added by ALTER TABLE in 0001_init.sql §16; we leave them off in Drizzle
 * (Drizzle doesn't need them for query typing). `evidence` stores filesystem
 * metadata only — bytes live on the reco-evidence volume.
 */

import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { household } from './tenancy';
import { kid } from './kids';
import { user } from './tenancy';

export type SubmissionStatus = 'pending' | 'approved' | 'denied';

export const evidence = pgTable('evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  kidId: uuid('kid_id')
    .notNull()
    .references(() => kid.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  purgedAt: timestamp('purged_at', { withTimezone: true }),
});

export const submission = pgTable('submission', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  kidId: uuid('kid_id')
    .notNull()
    .references(() => kid.id, { onDelete: 'cascade' }),
  // Circular FKs — added in 0001_init.sql §16.
  taskCompletionId: uuid('task_completion_id'),
  longTermProgressId: uuid('long_term_progress_id'),
  evidenceId: uuid('evidence_id').references(() => evidence.id, { onDelete: 'set null' }),
  status: text('status').$type<SubmissionStatus>().notNull().default('pending'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedByUserId: uuid('resolved_by_user_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  denyReason: text('deny_reason'),
  resubmitOfSubmissionId: uuid('resubmit_of_submission_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Evidence = typeof evidence.$inferSelect;
export type EvidenceInsert = typeof evidence.$inferInsert;
export type Submission = typeof submission.$inferSelect;
export type SubmissionInsert = typeof submission.$inferInsert;
