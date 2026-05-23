/**
 * Round-trip + boundary tests for the AES-256-GCM encrypt helper.
 * Generates a fresh MASTER_KEY per test run; never reads a real key.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt, __resetKeyCacheForTesting } from './encrypt';

const originalEnv = process.env.MASTER_KEY;

beforeEach(() => {
  process.env.MASTER_KEY = randomBytes(32).toString('base64');
  __resetKeyCacheForTesting();
});

afterEach(() => {
  if (originalEnv === undefined) delete process.env.MASTER_KEY;
  else process.env.MASTER_KEY = originalEnv;
  __resetKeyCacheForTesting();
});

describe('encrypt / decrypt', () => {
  it('round-trips ASCII', () => {
    const plain = 'hello reco';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('round-trips Hebrew + emoji', () => {
    const plain = 'שלום ליה 🎉';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('produces a different ciphertext each call (random IV)', () => {
    const plain = 'same input';
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it('rejects an oversized payload that fails GCM auth', () => {
    const c = encrypt('genuine');
    const tampered = Buffer.from(c, 'base64');
    const lastIdx = tampered.length - 1;
    tampered.writeUInt8(tampered.readUInt8(lastIdx) ^ 0x01, lastIdx);
    expect(() => decrypt(tampered.toString('base64'))).toThrow();
  });

  it('rejects a payload shorter than iv + tag', () => {
    expect(() => decrypt(Buffer.alloc(8).toString('base64'))).toThrow(/too short/);
  });

  it('rejects a MASTER_KEY of the wrong length', () => {
    process.env.MASTER_KEY = Buffer.alloc(16).toString('base64');
    __resetKeyCacheForTesting();
    expect(() => encrypt('x')).toThrow(/32 bytes/);
  });

  it('rejects a missing MASTER_KEY', () => {
    delete process.env.MASTER_KEY;
    __resetKeyCacheForTesting();
    expect(() => encrypt('x')).toThrow(/MASTER_KEY/);
  });
});
