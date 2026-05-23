/**
 * Kid-auth constants — cookie names, expiries, lockout thresholds.
 *
 * Two cookies, both HttpOnly + SameSite=Lax + Secure-in-prod:
 *   `reco-kid-session` — short-lived JWT (24h). Carries kid_id + household_id
 *     so middleware can resolve the principal without a DB hit.
 *   `reco-kid-trust`   — opaque random token (90d). Hashed copy lives in
 *     device_trust. Lets the kid skip PIN on a remembered browser.
 */

export const KID_SESSION_COOKIE = 'reco-kid-session';
export const KID_TRUST_COOKIE = 'reco-kid-trust';

export const KID_SESSION_MAX_AGE_S = 60 * 60 * 24;          // 24h
export const KID_TRUST_MAX_AGE_S = 60 * 60 * 24 * 90;       // 90d

export const PIN_LOCKOUT_THRESHOLD = 5;
export const PIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;      // 15 min
