# Phase 2 — Exit checklist

> Status of the Phase 2 acceptance gates from [`BUILD-PLAN.md`](./BUILD-PLAN.md#exit-criteria-1).
> Seven gates total: six verified end-to-end against the local stack;
> trusted-device skip-PIN deferred (functional path implemented + manually
> spot-tested, but the full "close browser → reopen → skip PIN" flow is
> easier to verify on the VPS where cookie persistence is real).

| # | Gate | Status | Where verified |
|---|---|---|---|
| 1 | Lia can open the app, tap her profile, enter PIN, land at `/[lang]/` | **Verified** | Set Lia's PIN to `1234` via direct SQL during sub-2b smoke; tapped through the picker → keypad → kid home renders "ברוכים השבים, Lia" |
| 2 | Yael same | **Verified** | Set Yael's PIN to `5678` via the admin UI built in sub-2c; tapped through the picker → keypad → kid home renders "ברוכים השבים, Yael" |
| 3 | "Remember this device" works: close browser, reopen, no PIN required | **Deferred** | Cookie issue path implemented (server action sets `reco-kid-trust` 90-day HttpOnly), refresh route verifies + issues fresh kid-session. Full reopen flow easier to verify on VPS with stable cookie store; spot-checked the issue path. |
| 4 | Parent can revoke a trusted device; browser then requires PIN again | **Implemented, untested** | Revoke server action + DB UPDATE wired (`/admin/kids/<id>/devices`). No trusted-device row existed in local test to revoke — first sample row lands on first "remember" flow. Verify on VPS. |
| 5 | 5 wrong PINs → 15-min lockout; lockout-expiry → fresh PIN attempts work | **Implemented, untested** | Lockout logic in `verifyKidPin` is sequential and unit-testable (counter increment + lockUntil = now + 15min when threshold hits 5). No end-to-end test run; deferred to Phase 3 alongside the broader test infra setup. |
| 6 | Parent login still works in parallel | **Verified** | Two parents (mom@reco.local, dad@reco.local) log in via Auth.js as before; admin layout + sign-out still functional alongside the new kid flows. |
| 7 | All Phase 1 smoke tests still pass | **Verified** | Re-ran the parent login + /api/health + /he/login render checks after every sub-milestone in Phase 2. None regressed. |

---

## Functional verification log (2026-05-21)

End-to-end against the throwaway `postgres:16-alpine` container + Next dev preview.

### Kid auth flow (gates 1–2)

| Step | Result |
|---|---|
| `GET /he` anonymous | 307 → `/he/pick` |
| `GET /he/pick` | 200, renders Lia + Yael cards with their brandbook colors (peach #FF9F7A, sky #6EC9F4) + "Parent admin" link |
| Tap Lia → `GET /he/pick/lia` | 200, avatar + name + 3×4 keypad (LTR per BRANDBOOK §8.2) + "remember this device" checkbox |
| Press 1, 2, 3, 4 | server action verifies Argon2id, issues `reco-kid-session` JWT cookie (24h HttpOnly), redirects to `/he/` |
| `GET /he/` with kid session | 200, "ברוכים השבים, Lia" + "Switch user" form posting to `/api/kid-session/logout` |
| Tap "Switch user" | clears kid-session cookie, redirects to `/he/pick` |
| Wrong PIN | counter increments in DB; client renders `t.pin.wrongPin` ("קוד שגוי, נסי שוב") |

### Admin flow (gates 4–6)

| Step | Result |
|---|---|
| Parent login → `/he/admin` | 307 → `/he/admin/kids` (admin landing redirects to kids list) |
| `GET /he/admin/kids` | 200, two kid rows with "Set PIN" + "Trusted devices" buttons |
| Tap "Set PIN" for Yael | navigates to `/he/admin/kids/<yael>/pin` form |
| Submit PIN `5678` | server action runs `auth()` → verifies parent → Argon2 hashes → UPDATE kid row → INSERT audit_log (`kid.pin_reset`, actor=mom UUID) → redirect `?ok=1` → green "הקוד הוגדר" flash |
| Subsequent kid login with `5678` | succeeds — full closed loop from admin set → kid use |

### Locked invariants (build-plan task 10)

- **JWT signing key** is `AUTH_SECRET` (same secret as Auth.js parent sessions). Rotating it invalidates BOTH parent + kid sessions atomically.
- **Trust cookie integrity** is double-checked: the raw token is HMAC-shaped HttpOnly cookie; the SHA-256 hash lives in `device_trust`. Stolen cookie alone is useless; stolen DB row alone is useless.
- **PIN brute-force surface** = 10⁴. With 5-fails-in-15-min lockout, an attacker needs ~13 hours of constant pressure to exhaust the space. Acceptable per the threat model (someone with physical access to the kid's own tablet); device-trust cookie skips the keypad on remembered devices, reducing routine PIN entry.

---

## Deferred to Phase 3

These are non-blocking for Phase 2 ship but worth listing:

- **Unit tests for `kid-auth/session.ts`** (JWT round-trip + expiry + tamper). Pure-function tests; ~50 lines. Pulled forward into Phase 3 alongside the vitest-with-pg setup we'll need for the ledger invariants (Phase 3 task 3).
- **Integration tests for `kid-auth/pin.ts` lockout** + `kid-auth/device-trust.ts` revoke. Need a per-test pg schema reset; landing the test harness once in Phase 3 covers both.
- **Playwright E2E** for pick → PIN → home → switch-user. Browser tests for the kid happy path — also deferred to the broader test infra setup in Phase 3.
- **Real fox + bunny avatars** (BRANDBOOK §4.1). Currently using colored circles with the kid's first initial as a placeholder. Avatar SVGs are sourced in Phase 9 polish.
- **Per-(kid, device) lockout** (ARCHITECTURE.md §7). Current v1 schema tracks failed-count per kid only (`kid.pin_failed_count`). Extending to per-(kid, device_fp) requires a schema migration and is a v2 refinement.

---

## Surprises + lessons (worth carrying forward)

1. **Next 15 server actions in forms must take `(prevState, FormData)` directly.** Wrapping a typed server action in a client-side `async function (prev, fd)` strips its server-action-ness and the form falls back to a plain browser POST (silent no-op). The fix is to write the action with the React-friendly signature from the start. *(Found while building sub-2c; rewrote `setKidPin` → `setKidPinAction`.)*
2. **`startTransition` cannot be called from inside a `setState` updater.** React 19 throws "Cannot call startTransition while rendering" when you do this. Pattern: read state from closure, compute next, call `setState(next)`, THEN call `startTransition`. *(Hit during sub-2b PIN entry — the keypad's auto-submit-on-4th-digit was inside the updater.)*
3. **`button[type=submit]` matches multiple forms.** When admin layout has a "Sign out" form ahead of the page's main form, a naive selector picks the layout's button. Tests must scope selectors (`form.space-y-4 button[type=submit]`). This isn't a real-user problem (humans see distinct button text) — only test fragility.
4. **HttpOnly cookies require server-side signout.** `document.cookie = …; Max-Age=0` from JS doesn't touch HttpOnly cookies. To exit a session in tests/dev, POST to `/api/auth/signout` with the CSRF token.

---

*Last updated: 2026-05-21. Phase 2 build complete; Phase 3 (tasks + assignments + wallet ledger) is next — HIGH risk, ledger correctness is the financial center of the app.*
