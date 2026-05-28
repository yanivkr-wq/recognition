/**
 * Coarse device fingerprint — readable signature of (OS family, browser
 * family, major accept-language). Recorded into device_trust for human-
 * legible audit ("this trust cookie was issued from an iPhone running
 * Safari, he locale") rather than used as a strict equality gate at verify
 * time — see verifyDeviceTrust for the why.
 *
 * Original implementation hashed the WHOLE user-agent + accept-language
 * string. The comment claimed "coarseness is intentional" but a SHA-256 of
 * the full UA is the opposite of coarse: any byte difference (iOS patch
 * version bump, PWA vs Safari mode, Apple's Private Relay header churn)
 * produced a different hash and silently invalidated the trust cookie. Lily
 * reported "remember me on this device" never actually remembered her on
 * her iPhone PWA — that's why.
 *
 * Edge-runtime safe: no Node-specific APIs.
 */

export async function computeDeviceFingerprint(headers: Headers): Promise<string> {
  const ua = headers.get('user-agent') ?? '';
  const al = headers.get('accept-language') ?? '';
  return `${detectOs(ua)}/${detectBrowser(ua)}/${majorLang(al)}`;
}

function detectOs(ua: string): string {
  if (/iPhone/i.test(ua)) return 'iphone';
  if (/iPad/i.test(ua)) return 'ipad';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X/i.test(ua)) return 'mac';
  if (/Linux/i.test(ua)) return 'linux';
  return 'other';
}

function detectBrowser(ua: string): string {
  // Chrome on iOS uses CriOS, Edge on iOS uses EdgiOS, Firefox on iOS uses
  // FxiOS — check those before the generic Safari fallback or we'd label
  // every iOS browser as Safari.
  if (/CriOS|Chrome/i.test(ua)) return 'chrome';
  if (/EdgiOS|Edg\//i.test(ua)) return 'edge';
  if (/FxiOS|Firefox/i.test(ua)) return 'firefox';
  if (/Safari/i.test(ua)) return 'safari';
  return 'other';
}

function majorLang(al: string): string {
  // "he-IL,he;q=0.9,en-US;q=0.8" → "he"
  const first = al.split(',')[0] ?? '';
  return first.split('-')[0]?.toLowerCase() ?? '';
}
