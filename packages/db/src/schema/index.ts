/**
 * Barrel export for every Drizzle table in Reco's schema.
 *
 * Consumers (apps/web, apps/worker) import named tables from `@reco/db` rather
 * than the individual files, so layout changes here don't ripple out. Order
 * is alphabetical-ish but grouped by domain to match docs/SCHEMA.md.
 */

export * from './tenancy';
export * from './kids';
export * from './tasks';
export * from './submissions';
export * from './completions';
export * from './rewards';
export * from './badges';
export * from './campaigns';
export * from './ledger';
export * from './notifications';
export * from './audit';
export * from './auth';
export * from './migrations';
