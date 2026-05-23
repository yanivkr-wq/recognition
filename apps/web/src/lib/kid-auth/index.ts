/**
 * Barrel for the kid-auth module.
 *
 * Splits intentionally between edge-safe and Node-only:
 *   ./session, ./fingerprint, ./constants, ./cookies — edge-safe; OK from middleware.
 *   ./pin, ./device-trust                            — Node only (Argon2 + pg).
 *
 * Importing this barrel from edge code will pull in Node-only modules and
 * fail at bundle time. Edge consumers should import the specific edge-safe
 * files directly (e.g. `from './kid-auth/session'`).
 */

export * from './constants';
export * from './session';
export * from './fingerprint';
export * from './cookies';
export * from './pin';
export * from './device-trust';
