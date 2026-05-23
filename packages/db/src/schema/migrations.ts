/**
 * Drizzle definition of the migration tracking table.
 *
 * Owned by src/migrate.ts. Exposed here so other packages can query "has
 * 0042_foo been applied?" without re-implementing the table shape.
 */

import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const __migrations = pgTable('__migrations', {
  filename: text('filename').primaryKey(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MigrationRow = typeof __migrations.$inferSelect;
