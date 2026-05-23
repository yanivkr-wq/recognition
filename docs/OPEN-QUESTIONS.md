# Reco — Open Questions & Assumptions

> Things still TBD or assumed-but-unconfirmed at Gate 2. Each item is one of: a question for Lily, an assumption I'm proceeding under (to be confirmed), or a v2-backlog candidate I've intentionally deferred. Resolve before or during the relevant phase.

---

## Resolved at Gate 2 (2026-05-20)

| # | Question | Resolution |
|---|---|---|
| **Q1** | Brand palette + visual identity | **LOCKED at Gate 3 (2026-05-21):** Concept 5 — Plush, with the Embroidered Patch badge architecture. Full design system codified in [`BRANDBOOK.md`](./BRANDBOOK.md) (canonical Markdown) + [`brandbook.html`](./brandbook.html) (visual companion). All future UI work must conform. |
| **Q2** | Long-term task bonus reversal on undo | **Bonus reverses with the undo.** Undoing the goal-crossing progress entry reverses both per-unit coins AND the bonus. Subsequent goal-cross fires the bonus again. Cleaner ledger semantics; prevents bonus-farming. |
| **Q3** | Reward `image_path` storage | **Same volume as evidence**, different subdir (`/var/lib/reco/rewards/`). Admin-uploadable from the reward form. Served by the session-gated worker route. |
| **Q4** | Birthday handling | **Auto-award a yearly "Birthday {year}" badge** on the kid's birthday. Daily-reset cron handles. `kid_badge.awarded_for_year` column distinguishes years so the same Birthday badge series accrues annually. No birthday bonus coins in v1 — just the badge. |
| **Q5** | Parent profile picker | **Shared admin, no picker.** Two parents log in via email+password; both see the same admin view. Audit feed attributes each action by parent name. |
| **Q6** | Kid avatar art | **Admin-uploadable in v1.** `kid.avatar_image_path`. Parent uploads from their photo gallery during kid creation/edit. Built-in cartoon gallery deferred to v2. |
| **Q7** | Cookster visual reference | **Design fresh.** Reco's look is its own. We inherit Cookster's PWA + i18n PATTERNS (already in docs) but not its visual identity. |
| **Q8** | URL shortener for WhatsApp links | **Yes, include.** `reco.my-restart.co.il/g/<token>` redirects to deep links. Cleaner messages + future analytics surface. |

All Gate-2-blocking open questions are resolved. The following are remaining open items that are NOT blocking Gate 3.

---

## Assumptions (proceeding under, flag if wrong)

### A1. Anthropic key for Reco minted but not used in v1
Mint `ANTHROPIC_API_KEY_RECO` during `deploy-prod.sh` even though Reco has no AI features in v1. Ready for v2 if we ever add things like "AI-suggested age-appropriate tasks" or "summarize kid's week."

### A2. Twilio Sandbox is sufficient for v1
The Sandbox WhatsApp number works for the household's 4 phones (2 parents, possibly 2 kids). Production Twilio WhatsApp number (requires Meta verification) is v2-or-later.

### A3. No offline support
PWA is minimal pass-through SW. Tasks completed while offline will fail (network error UI). Kids in this household have home WiFi; cellular gaps are rare. Address only if real-world use shows it's a problem.

### A4. ICU `he-IL` locale is fine for Hebrew sorting + comparison
Same as the other two apps. Hebrew niqqud (vowel points) not an issue for kids' rewards/tasks; if it ever is, normalize at the app layer (strip niqqud before equality checks).

### A5. Single household, multi-tenant-ready schema
Every row carries `household_id`. v1 is single-household. v2 SaaS-form would need: per-tenant Twilio (Sandbox is account-scoped), per-tenant Sentry tagging, billing/quota. Not in scope.

### A6. Audit log retention forever
Audit rows accumulate at ~few-per-day; ~10k rows/year × ~500 bytes = 5 MB/year. Trivial. No purge cron.

### A7. Daily summary email is OFF by default
`SUMMARY_ENABLED=false` initial; opt-in via admin settings. Avoids inbox clutter while we tune signal-to-noise.

### A8. Streak engine doesn't fire mid-day "you advanced!" notifications
Streak advancement is a midnight-reset event, not a real-time event. Kid sees current streak on the campaign card any time; the celebratory "you advanced!" lives in the next day's bell.

### A9. The same daily template can NOT be completed multiple times per day for extra coins
Partial unique index enforces. If a parent wants "earn 5 coins each time you help" semantics, that's a long-term task with `per_unit_coins=5`, not a daily task.

### A10. Joker can adjust ledger but cannot delete entries
No DELETE on `ledger_entry` ever. All "corrections" are new entries (admin_credit / admin_debit / undo). The ledger truth is forever; the wallet display is `MAX(0, SUM)`.

### A11. Lia and Yael can each be in multiple active campaigns
No explicit cap on active enrollments per kid. UI groups them; campaign cards are stackable.

### A12. Notification rate limit is per-recipient, not per-kid-or-parent-tier
3 WhatsApp / 10 min applies the same to a kid as to a parent. If a parent gets 5 different pings (multiple submissions in flight), they'll see the throttle. Acceptable.

### A13. Backup encryption uses HKDF-derived sub-keys
`MASTER_KEY` → `HKDF(salt='reco-v1', info='db-backup')` and `HKDF(salt='reco-v1', info='evidence-backup')`. Sub-key compromise doesn't compromise the other. Standard pattern.

### A14. Photo uploads from the kid's PWA work on iOS Safari with `<input type="file" capture="environment">`
This is supported. Some older iOS versions had quirks; Lia and Yael are presumably on recent iPadOS/iOS.

### A15. The kid-trust cookie expires 90 days from issuance, NOT 90 days from last_seen
Conservative choice — a stolen cookie expires regardless of activity. To extend, kid re-enters PIN; new trust cookie minted.

### A16. PIN reset by parent invalidates all device-trust rows for that kid
Defense in depth: if PIN was compromised, the parent's reset should also invalidate trusted devices. Implemented in `/admin/kids/<id>/pin`'s submit action.

### A17. The 6 sample tasks at install are a starter, not a contract
Lily can edit/delete/replace any of them in admin immediately after deploy. No fixed list lives in the DB.

### A18. Backups don't include the evidence photo files in the DB nightly backup
DB backup is `pg_dump` of `reco` database only. Photos live on the volume and have their own weekly tarball backup. Restoring just the DB would leave you with `evidence` rows pointing to missing files — render shows a "photo no longer available" placeholder.

---

## V2 backlog (intentionally deferred)

| Idea | Trigger to consider | Rough size |
|---|---|---|
| Production Twilio WhatsApp number | Outgrowing Sandbox; want kid pings on numbers not in account-allowlist | M (Meta verification) |
| AI-assisted task suggestion ("based on Lia's week, suggest 3 new tasks") | When admin task entry feels tedious | M |
| Voice-note submission for kids who can't type/photograph evidence | If younger sibling joins later | M |
| iOS Share Target (other than camera) | Family_Tasks_Hub has this; Reco may not need it | S |
| Parent-to-parent chat about a kid's submission | If approval discussions happen out-of-band | S |
| Per-kid quiet hours (override household) | If kids' bedtimes diverge significantly | S |
| Badges that unlock features (e.g., "Master Reader" badge unlocks a special reward) | When cosmetic badges feel insufficient | M |
| Recurring campaigns (weekly resetting) | If a campaign type "every week, do X 3 times" is desired | M |
| Multi-household / SaaS form factor | If other families ask for access | XL |
| Custom kid avatars they design themselves | Kid agency request | M |
| Calendar view of historical wallet activity | If wallet-history scroll feels insufficient | S |
| Push notifications via Web Push (instead of WhatsApp) | If Twilio costs become annoying | M |
| "Goal saving" UI — kids reserve coins toward a big-ticket reward | If kid asks to "save" coins | M |
| Sibling-coop campaigns ("both kids must do X for 5 days") | If you want collaborative goals | M |
| Hebrew-Hebcal date overlays (e.g., Jewish holidays on the calendar) | If you add a calendar surface | S |

---

## Risk register (carry through phases)

| Risk | Phase | Mitigation |
|---|---|---|
| Ledger drift between code paths | 3+ | Single `ledger.post()` entry point; grep test in CI |
| Kid same-day undo gaming campaign streaks | 3, 7 | Streak engine is ledger-derived; retroactive undo correctly breaks |
| Photo permission leak | 5 | Worker-only mount, session-gated GET, 0700 perms |
| FCFS approval double-credit | 5 | Optimistic UPDATE with rowcount check |
| Streak freeze counter drift | 7 | Recompute from ledger; never trust the cached counter alone |
| Twilio rate limit exhaustion | 8 | In-memory rate limiter, deferred state, bell fallback |
| Quiet hours wrong on DST transitions | 8 | Local-TZ comparison via `date-fns-tz`; explicit tests on Mar/Oct |
| PWA cache staleness | 9 | Minimal pass-through SW; controllerchange update banner |
| Bilingual text overflow | 9 | Hebrew strings tend to be shorter; English overflows on small chips. Test with English on smallest device. |

---

*Last updated: 2026-05-20.*
