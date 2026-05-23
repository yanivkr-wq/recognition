/**
 * Argon2id password hashing + verification.
 *
 * Parameters match the Argon2id placeholder in 0002_seed_household.sql
 * (m=19456, t=2, p=1) so verification of seeded rows uses the same algorithm
 * profile. `verify()` returns false on parse errors instead of throwing — the
 * caller only cares whether the supplied password matches.
 */

import 'server-only';
import { verify, hash } from '@node-rs/argon2';

// Argon2id is @node-rs/argon2's default for hash(); we omit `algorithm` here
// because importing the `Algorithm` const enum trips isolatedModules.
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}
