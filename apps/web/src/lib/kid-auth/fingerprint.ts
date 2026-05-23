/**
 * Coarse device fingerprint — SHA-256 hex of (user-agent || accept-language).
 *
 * Coarseness is intentional. We want the fingerprint to survive minor browser
 * updates (Chrome bumps a patch version) but change when the kid switches
 * device or browser. This is a sanity check against trust-cookie theft, not
 * a full anti-fraud signal — see ARCHITECTURE.md §7. Edge-runtime safe: uses
 * Web Crypto only, no Node-specific APIs.
 */

export async function computeDeviceFingerprint(headers: Headers): Promise<string> {
  const ua = headers.get('user-agent') ?? '';
  const al = headers.get('accept-language') ?? '';
  const raw = `${ua}|${al}`;
  const data = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hash)).slice(0, 32); // 128 bits is plenty
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}
