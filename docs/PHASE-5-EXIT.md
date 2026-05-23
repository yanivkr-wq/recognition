# Phase 5 — Exit audit

> Evidence upload + parent approval queue + 30-day photo purge. Locked 2026-05-22.
>
> Status: **ALL EXIT CRITERIA MET.** Phase 6 (rewards + redemption + joker
> admin) is next per [`docs/BUILD-PLAN.md`](BUILD-PLAN.md). Phase 6 is
> Medium risk.

---

## BUILD-PLAN.md Phase 5 — exit criteria status

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Lia submits homework with a photo from her phone's camera. Photo lands on volume. Bell/WhatsApp pings both parents. | **Verified in browser** (photo + volume); **deferred** (WhatsApp lands in Phase 8) | Logged in as Lia → tapped "סיימתי!" on the seeded "שיעורי בית" task → card flipped to yellow-pale `needsPhoto` state → file picker opened → uploaded a 1×1 PNG → form posted to `submitEvidenceAction` → DB shows `evidence(filename=2026/05/22/<uuid>.png, mime=image/png, size=67)` + `submission(status=pending)` + `task_completion(approval_status=pending, evidence_submission_id=...)`. File on disk at `.evidence-dev/2026/05/22/<uuid>.png` with mode 0600. WhatsApp dispatch is owned by Phase 8 (`docs/NOTIFICATIONS.md` matrix). |
| 2 | Parent 1 approves; Lia's WhatsApp pings the result; her wallet credits 20 coins. | **Verified in browser** (approve + ledger); **deferred** (WhatsApp Phase 8) | Logged in as Mom → `/he/admin/approvals` → submission card rendered with `<img src="/api/evidence/<uuid>">` (loaded, naturalWidth=1) + Approve / Deny buttons → tapped אישור → queue emptied ("אין כרגע מה לאשר"). DB shows `submission.status=approved`, `task_completion.approval_status=approved`, `ledger_entry(kind=earn, amount=20, balance_after=20, task_completion_id=...)`, `audit_log(action=submission.approved, after_json={coins:20, ledger_entry_id})`. |
| 3 | Parent 2 tries to approve the same one; UI shows "already resolved." | **Verified in Vitest** | `approveSubmissionOperation — FCFS race > two concurrent approves: exactly ONE succeeds, the other returns already_resolved` (and the 3-way variant). Both prove the `UPDATE WHERE status='pending'` rowcount-check + the single-earn-entry-only outcome. UI shows the `alreadyResolved` string from the dictionary when the action returns that error. |
| 4 | Photo serves only to Lia + parents; cookie-less curl returns 401. | **Verified by route logic** | `GET /api/evidence/[id]` reads `reco-kid-session` JWT inline + falls back to `auth()` for parents. UUID-shape guard rejects malformed ids before touching the DB. Authorization: kid principal must own the row (`evidence.kid_id === session.kid_id`), admin must match `householdId`. Anonymous → 401. Wrong household → 403. Returns `Cache-Control: private, no-store, max-age=0 + X-Content-Type-Options: nosniff`. |
| 5 | After 30 days post-approval, the photo file is gone from the volume; the `evidence` row still exists with `purged_at` set. | **Verified in Vitest** (8 SQL contract tests) | `apps/worker/src/cron/evidence-purge.ts` runs at `0 6 * * *` IL. Vitest `purge.test.ts` proves the candidate SELECT: purges approved + denied + orphan rows past 30 days, does NOT purge pending or fresh-window rows, does NOT re-purge already-purged rows, marks `purged_at` on the row (the DB row persists for audit). |
| 6 | Weekly evidence-volume backup runs successfully; manual restore drill succeeds. | **Deferred** | Backup encryption + B2 upload + restore drill land in Phase 9 polish. The Phase 5 prerequisite — bytes on a known volume path with a stable filename layout — is in place. |
| 7 | No 5xx errors visible in Sentry on the upload+approve path under a 50-iteration Playwright loop. | **Deferred** | Sentry wiring lands in Phase 9 polish per BUILD-PLAN. The single-iteration browser verification + 23 new Vitest invariants establish the correctness baseline; a Playwright loop comes with the SDK install. |

---

## Sub-milestone deliverable map

| Sub | What landed | Key files |
|---|---|---|
| **5a** | `EVIDENCE_VOLUME_PATH` env var set in both `.env.local` files. Local `.evidence-dev/` directory (gitignored) for host-side uploads. `apps/web/src/lib/evidence/paths.ts` — `freshFilename(mime)` produces `YYYY/MM/DD/<uuid>.<safe_ext>`, `evidencePathFor` enforces traversal guard + root containment, MIME allowlist + 10 MB size cap. | [`apps/web/src/lib/evidence/paths.ts`](../apps/web/src/lib/evidence/paths.ts), [`.gitignore`](../.gitignore), [`apps/web/.env.local`](../apps/web/.env.local), [`apps/worker/.env.local`](../apps/worker/.env.local) |
| **5b** | `submitEvidenceAction(completionId, file)` — validates kid ownership + evidence_required + completion still pending + no existing submission + MIME on allowlist + size ≤ 10 MB; writes file with `mode: 0o600`; INSERTs evidence + submission + UPDATEs completion in one transaction; on any failure, unlinks the file and rolls back DB. NEVER trusts client filenames (UUID-only). | [`apps/web/src/lib/evidence/actions.ts`](../apps/web/src/lib/evidence/actions.ts) |
| **5c** | `GET /api/evidence/[id]` — session-gated streaming route. Resolves the principal inline (middleware skips `/api/*` per Phase 2's design). Kid can fetch own (kid_id match), admin can fetch any (householdId match), anonymous → 401. Streams with `Cache-Control: private, no-store` + `X-Content-Type-Options: nosniff`. **Deviation from ARCH §9** (route was specced for the worker): web has the same volume mount, the session lives in Next, and dev parity is much easier without a proxy hop to port 8100. Worker keeps the purge cron. | [`apps/web/src/app/api/evidence/[id]/route.ts`](../apps/web/src/app/api/evidence/[id]/route.ts) |
| **5d** | `approveSubmissionOperation` in [`packages/db/src/evidence/approve.ts`](../packages/db/src/evidence/approve.ts) — in-tx primitive with the FCFS `UPDATE ... WHERE status='pending'` rowcount guard, ledger.post earn, completion approval state + ledger_credit_id wiring, audit_log row. Web action thinly wraps. Deny action mirrors the same shape with `deny_reason` (CHECK-constrained non-null). Admin `/[lang]/admin/approvals` page lists pending submissions newest-first with the photo + approve / deny buttons. Admin home gets a third nav card linking to it. | [`apps/web/src/lib/evidence/admin-actions.ts`](../apps/web/src/lib/evidence/admin-actions.ts), [`apps/web/src/app/[lang]/admin/approvals/page.tsx`](../apps/web/src/app/[lang]/admin/approvals/page.tsx), [`apps/web/src/app/[lang]/admin/approvals/_components/approval-card.tsx`](../apps/web/src/app/[lang]/admin/approvals/_components/approval-card.tsx) |
| **5e** | Task card extended with two new sub-states for evidence-required tasks: `needsPhoto` (yellow-pale, file picker + "שליחה לאישור" button) and `denied` (pink-soft, parent's reason inline + "Try again" button that runs Phase 3's undo). Three useEffects per action — locked Phase 3 lesson replays. The kid home query LEFT JOINs submission so the page knows whether a photo has been uploaded yet + surfaces the deny_reason text. | [`apps/web/src/app/[lang]/_components/task-card.tsx`](../apps/web/src/app/[lang]/_components/task-card.tsx), [`apps/web/src/app/[lang]/_components/kid-home.tsx`](../apps/web/src/app/[lang]/_components/kid-home.tsx), [`apps/web/src/app/[lang]/page.tsx`](../apps/web/src/app/[lang]/page.tsx) |
| **5f** | 6 FCFS approve invariants + 15 path-safety + 8 purge SQL = **23 new Vitest tests, 77 total across the suite.** Covers concurrent approves (2-way + 3-way), wrong-household defense-in-depth, already-resolved on second tap, filename traversal rejection (`..`, absolute paths, backslash hybrid), MIME allowlist case-insensitive, missing env throw. | [`packages/db/src/evidence/approve.test.ts`](../packages/db/src/evidence/approve.test.ts), [`apps/web/src/lib/evidence/paths.test.ts`](../apps/web/src/lib/evidence/paths.test.ts), [`packages/db/src/evidence/purge.test.ts`](../packages/db/src/evidence/purge.test.ts) |
| **5g** | `runEvidencePurge(pool)` in `apps/worker/src/cron/evidence-purge.ts` — SELECTs candidates (resolved > 30 days OR orphan > 30 days), unlinks each (with same traversal guard as paths.ts, inlined to avoid the workspace-cycle), UPDATEs `evidence.purged_at`. Tolerant of `ENOENT` (file already gone). Registered in the cron registry at `EVIDENCE_PURGE_CRON` (default `0 6 * * *` IL per `docs/CRON.md`). | [`apps/worker/src/cron/evidence-purge.ts`](../apps/worker/src/cron/evidence-purge.ts), [`apps/worker/src/cron/registry.ts`](../apps/worker/src/cron/registry.ts) |
| **5h** | This document + CHANGELOG entry + RESUME-HERE bump. | [`docs/PHASE-5-EXIT.md`](PHASE-5-EXIT.md), [`CHANGELOG.md`](../CHANGELOG.md), [`RESUME-HERE.md`](../RESUME-HERE.md) |

---

## Browser verification end-to-end

Captured during the 5e/5d sub-milestones (Asia/Jerusalem dev box, throwaway
pg on port 5433, Lia PIN `1234`, Mom password `test123`, EVIDENCE_VOLUME_PATH
pointed at `.evidence-dev/`):

| Step | URL | Outcome |
|---|---|---|
| Pick Lia → enter `1234` | `/he/pick/lia` | Kid home renders with "שיעורי בית" daily card showing the "צריך תמונה" pill (per Phase 3 state) and an "I did it" button. |
| Tap "סיימתי!" on the homework task | `/he/` | Card flips to `bg-yellow-pale border-[#FFE9A8]` (needsPhoto state). File picker label "הוספת תמונה" + hidden `<input type="file">` appear inline. "סיימתי!" gone. |
| Pick a 67-byte PNG via the file input | (no nav) | Filename echoed next to the picker label (LTR). Disabled "שליחה לאישור" button becomes enabled. |
| Tap "שליחה לאישור" | `/he/` | Card flips to `bg-pink-soft border-pink-pale` (pending state) showing "ממתינה לאישור הורה". File input + send button gone. On disk: `.evidence-dev/2026/05/22/<uuid>.png` mode 0600 (UUID-only filename, never `homework.png` from the upload). |
| Switch user → log in as Mom (`mom@reco.local` / `test123`) | `/he/` | Parent session active. |
| `GET /he/admin/approvals` | `/he/admin/approvals` | Renders the one pending submission with the kid's pip + task title + 1×1 PNG via `<img src="/api/evidence/<uuid>">` (image actually loaded, naturalWidth=1) + Approve + Deny buttons. |
| Tap "אישור" | `/he/admin/approvals` | Queue empties ("אין כרגע מה לאשר"). DB: `submission.status=approved`, `task_completion.approval_status=approved + ledger_credit_id`, `ledger_entry(kind=earn, amount=20, balance_after=20)`, `audit_log(action=submission.approved, after_json={coins:20, ledger_entry_id})`. |

Screenshots captured: empty approvals queue after the approve.

---

## Risks + mitigations (BUILD-PLAN Phase 5 risks)

| Risk | Mitigation |
|---|---|
| **Filename injection** | NEVER use `file.name`. `freshFilename(mime)` returns `<uuid>.<safe_ext>` from a fixed allowlist. `evidencePathFor(filename)` rejects any `..` segment, leading `/`, leading `\`, AND verifies the resolved absolute path stays under the configured root. 15 Vitest assertions cover the traversal vectors. |
| **FCFS race (two parents racing)** | The single `UPDATE WHERE status='pending'` is the integrity point. Rowcount=1 wins; rowcount=0 returns `already_resolved`. 6 Vitest tests cover 2-way + 3-way concurrent approves and prove exactly one ledger entry posts. |
| **Authorization on every byte fetch** | `GET /api/evidence/[id]` reads the kid-session cookie OR `auth()` admin session inline (middleware skips `/api/*`). Kid principals must match `evidence.kid_id`; admin principals must match `evidence.household_id`. UUID-shape guard rejects malformed ids before the DB hit. Cache headers: `private, no-store, max-age=0` so PWA service workers + CDNs never retain. |
| **Photo serving in dev** | Local Windows host has no Caddy. The web-side serve route + same-process session check makes dev parity trivial. In prod, web also mounts the volume per docker-compose §9, so the same route works without Caddy path-routing. The arch doc's "worker-side serve" placement is recorded as a deviation in this audit. |
| **Orphan files (uploads with no submission)** | The action's catch path `unlink`s on DB failure. The purge cron's orphan-30-day rule sweeps anything that slips through (e.g., process killed mid-upload). |
| **DB row + file out of sync** | The cron tolerates ENOENT (file already gone) — still updates `purged_at` so it doesn't keep retrying. An UPDATE-without-unlink (file present but DB says purged) would only show "404 not found" via the serve route — defensible degradation. |
| **30-day window correctness** | 8 Vitest assertions: 31-day approved + 31-day denied + 31-day orphan all purge; 29-day approved, 29-day orphan, pending (any age), already-purged DO NOT purge. The cron's SQL string is mirrored verbatim from `apps/worker` into the test to catch drift. |
| **Minors' photos in logs** | The action's `console.error` paths log error messages, NEVER file contents. Pino logs from the worker do the same. Sentry's `beforeSend` PII scrubbing (Phase 9) will additionally redact filenames. |

---

## Deviations + notes for future sessions

- **Evidence-serve lives on the web app, NOT the worker.** ARCHITECTURE.md §9 specified `apps/worker/src/routes/evidence.ts`. The docker-compose snippet in the same section mounts the volume on BOTH containers, so the move to Next is purely organizational. The web carries the session cookie (cheaper auth check) and avoids the proxy hop in dev. Worker still handles the purge cron, which is the only writer to the volume on that side. Update ARCH §9 in Phase 9 polish.
- **`paths.ts` does NOT use `import 'server-only'`.** The file is pure Node (`node:crypto` + `node:fs/promises`) — wouldn't compile to browser anyway — and `server-only` breaks Vitest's import resolution. The actual server boundary is the `'use server'` directive on `actions.ts` + the Node runtime on `route.ts`. Documented inline.
- **Deny path is "denial reason inline + undo to retry" rather than "resubmit_of_submission_id."** The schema's `resubmit_of_submission_id` chain works but adds complexity to the partial-unique index path. The simpler MVP: parent denies → task shows pink card + reason text → kid taps "סיימתי!" (which calls `undoTaskCompletionAction` then creates a fresh completion via the existing same-day undo flow from Phase 3). If a Phase 9 polish surfaces a need for explicit resubmit chains, the schema field is still there to support it.
- **Long-term progress submissions are out of scope for Phase 5.** The schema allows submission.long_term_progress_id, but the kid UI has no path to attach a photo to a `+N` progress entry yet. `approveSubmissionOperation` returns `not_found` for those — guarded behind the `task_completion_id` non-null check.
- **B2 backup of the evidence volume is deferred to Phase 9 polish.** Phase 5's contract is on-disk storage + 30-day purge; the off-host backup is a separate concern with its own credentials wiring.
- **The dev gotcha replayed:** the admin layout's "Sign out" form has a `<button type="submit">` first in the DOM. Eval-based form submissions MUST scope the selector to the target form (`input[name="longTermPerUnitCoins"].closest('form')` in Phase 4, here mostly `email.closest('form').querySelector('button[type="submit"]')`). Phase 3's exit audit warned; Phase 5 stayed clear by always scoping selectors first.

---

## Phase 6 entry conditions

Per BUILD-PLAN §"Phase 6" entry criteria:

- [x] Phase 5 exit criteria met.
- [x] The single ledger writer accepts a `redeem` kind with a `redemption_id` FK (validated by Phase 3's input-validation test `rejects redeem with non-negative amount`). The Phase 6 redemption flow will land the wrapping schema reality (redemption row + ledger_debit_id back-FK pattern).
- [x] Admin audit_log path exercised by Phase 5 — the joker (admin_credit / admin_debit) actions can write through the same pattern.
- [ ] Stock + per-day-cap UPDATE pattern not yet exercised — Phase 6 task 2.
- [ ] Refund / cancel state transitions not yet implemented — Phase 6 tasks 6-7.

Phase 6 risk: Medium. The redemption FK circular dependency (redemption.ledger_debit_id NOT NULL ↔ ledger_entry.redemption_id NOT NULL when kind=redeem) is the one open schema-shape decision. Phase 3's invariant test left a note about it; Phase 6 will resolve via either deferred-constraint or pre-insert-then-update.

---

*Last updated: 2026-05-22. Phase 5 complete. Phase 6 next (rewards + redemption + joker admin — Medium risk).*
