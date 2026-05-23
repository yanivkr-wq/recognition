/**
 * Drizzle definition for the household-wide audit log.
 *
 * Every admin action that mutates state worth showing to the other parent
 * appends a row here. Both parents see the household feed in /admin/audit.
 * Reason is mandatory for wallet/ledger admin actions (enforced at the app
 * boundary; ledger_entry's CHECK constraint additionally requires `note` for
 * admin_credit/admin_debit).
 */

import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { household, user } from './tenancy';
import { kid } from './kids';

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  actorUserId: uuid('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
  actorKidId: uuid('actor_kid_id').references(() => kid.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: uuid('target_id'),
  beforeJson: jsonb('before_json'),
  afterJson: jsonb('after_json'),
  reason: text('reason'),
  // request_ip is INET in DB; Drizzle accepts string values, pg handles parsing.
  requestIp: text('request_ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type AuditLogInsert = typeof auditLog.$inferInsert;
