/**
 * AES-256-GCM helper for at-rest encryption of small sensitive strings.
 *
 * Future Reco columns that may need this (none in v1 schema, but kept ready):
 * stored phone numbers, OAuth refresh tokens if we ever wire OAuth, transient
 * one-time codes. The pattern matches Family_Tasks_Hub's encrypt.ts so a
 * MASTER_KEY rotation tool can later operate across both apps.
 *
 * MASTER_KEY must be 32 raw bytes encoded as base64 (44 chars). Generate with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Output format: base64(iv ‖ tag ‖ ciphertext). IV is random per call.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is the GCM standard.
const TAG_LENGTH = 16; // 128-bit auth tag.
const KEY_LENGTH = 32; // AES-256.

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.MASTER_KEY;
  if (!raw) {
    throw new Error('MASTER_KEY env var is required for encrypt/decrypt');
  }
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== KEY_LENGTH) {
    throw new Error(
      `MASTER_KEY must decode to ${KEY_LENGTH} bytes; got ${decoded.length}. ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  cachedKey = decoded;
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('encrypted payload too short to be valid');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Test-only: clear the cached key so a test that swaps MASTER_KEY picks up
 * the new value. Do not call from production code.
 */
export function __resetKeyCacheForTesting(): void {
  cachedKey = null;
}
