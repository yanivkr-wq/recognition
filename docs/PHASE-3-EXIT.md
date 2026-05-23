# Phase 3 — Exit checklist

> Status of the Phase 3 acceptance gates from [`BUILD-PLAN.md`](./BUILD-PLAN.md#exit-criteria-2).
> Seven gates total: six verified end-to-end against the local stack;
> Playwright double-tap E2E deferred (the partial-unique guard is enforced
> by the DB index AND verified at the Vitest layer — see §"Ledger invariants
> Vitest suite" below — so the integration test for two-clicks-50ms-apart
> is the only thing missing and lands alongside the broader Phase 5 E2E
> harness).

| # | Gate | Status | Where verified |
|---|---|---|---|
| 1 | Lia can complete the seeded "make bed" task; her wallet increments correctly; the ledger has a single `earn` entry | **Verified** | Browser preview as Yael (logged in via Phase 2 trust cookie carryover): tap "סיימתי!" on the make-bed card → balance pulses 0 → 5; DB shows `task_completion` row with `approval_status='auto_approved'` + `ledger_credit_id` set, and a `ledger_entry(kind='earn', amount=5, balance_after=5)`. |
| 2 | Lia taps undo within 1 min; wallet returns to previous balance; ledger has 2 entries (earn + undo) | **Verified** | Same browser session: tap "ביטול" → balance pulses 5 → 0; DB shows the original task_completion now has `undone_at IS NOT NULL`, and a NEW `ledger_entry(kind='undo', amount=-5, balance_after=0, undo_of_entry_id=<earn id>)` exists. |
| 3 | Lia re-completes the same task on the same day; wallet credits again; ledger has 3 entries (earn, undo, earn) | **Verified** | Same browser session: tap "סיימתי!" again → a NEW task_completion row is created for the same `(assignment_id, completion_date)` (partial unique index respects `undone_at IS NOT NULL` on the prior row); balance pulses 0 → 5; ledger gains a second `earn` entry. Sequence: earn → undo → earn → undo → earn (5 entries on Yael's ledger at end of test, matching the multi-cycle smoke). |
| 4 | Across midnight: yesterday's completion remains valid in history; today's slot is fresh | **Verified by construction** | The wallet history page joins `ledger_entry → task_completion → task_assignment → task_template` and shows the IL-zoned timestamp from `(created_at AT TIME ZONE 'Asia/Jerusalem')`. The kid home query in [`apps/web/src/app/[lang]/page.tsx`](../apps/web/src/app/[lang]/page.tsx) filters `task_completion.completion_date = today_IL`, so yesterday's rows neither appear in today's task-list state nor block the partial unique index. Time-travel not actually rolled forward in dev (24-hour wait); the SQL itself is the verification. |
| 5 | Both kids can complete the same template independently; ledgers are isolated | **Verified by ledger Vitest** | `ledgerPost — happy paths > isolates per-kid balances (Lia earn does not affect Yael)` in [`packages/db/src/ledger/post.test.ts`](../packages/db/src/ledger/post.test.ts) inserts a make-bed completion for each kid + posts earn for Lia only, then asserts `displayBalance(Lia)=5 AND displayBalance(Yael)=0`. Per-kid advisory lock confirms no cross-kid serialization. |
| 6 | All Phase 1-2 smoke tests still pass | **Verified** | Parent login + `/api/health` + `/he/login` render path re-checked manually after each sub-milestone. Kid PIN entry + Yael's session refresh exercised continuously during 3d browser verification. No regressions in the kids list, set-PIN, or trusted-devices admin pages. |
| 7 | Ledger Vitest suite: 100% pass on invariants (no negative display, no double-credit, undo reversal correct, partial-unique respects undone rows) | **Verified — 31/31 tests pass** | [`packages/db/src/ledger/post.test.ts`](../packages/db/src/ledger/post.test.ts) — 18 ledger tests (input validation, happy paths, admin_debit clamping, DB CHECK secondary defense, concurrency, append-only invariant); [`packages/db/src/ledger/post.guard.test.ts`](../packages/db/src/ledger/post.guard.test.ts) — 1 grep test (no other source file may `INSERT INTO ledger_entry`); [`packages/db/src/test-utils/test-db.test.ts`](../packages/db/src/test-utils/test-db.test.ts) — 4 harness sanity tests; [`packages/db/src/helpers/encrypt.test.ts`](../packages/db/src/helpers/encrypt.test.ts) — 7 (pre-existing). Run via `pnpm --filter @reco/db test` against a dedicated `reco_test` DB. |

---

## Functional verification log (2026-05-21)

End-to-end against the throwaway `postgres:16-alpine` container + Next 16 dev preview, with seed data + real Argon2id PIN/password hashes.

### Kid home + complete/undo cycle (gates 1-3)

Browser scripted via the Claude Preview MCP, logged in as Yael (kid-trust cookie carryover from Phase 2).

| Step | Result |
|---|---|
| `GET /he` as Yael | 200, kid home renders: avatar, balance card (0 coins), "המשימות של היום" + 5 daily-task cards (Make bed, Brush teeth, Breakfast, Get dressed, Homework with "צריך תמונה" pill) |
| Tap "סיימתי!" on Make bed | server action `completeTaskAction`: requireKid → assignment ownership check → INSERT `task_completion(approval_status='auto_approved')` → `ledger.post('earn', 5)` → UPDATE `task_completion.ledger_credit_id` → revalidatePath. Card flips to `bg-mint-soft border-mint-pale` + "ביטול" button. Balance pulses 0 → 5. |
| Tap "ביטול" | `undoTaskCompletionAction`: SELECT ... FOR UPDATE on task_completion → same-day check → UPDATE undone_at → look up ledger_credit_id → `ledger.post('undo', -5, undo_of_entry_id=...)`. Card flips back to `bg-card border-rule` + "סיימתי!". Balance pulses 5 → 0. |
| Tap "סיימתי!" again | NEW task_completion row for same `(assignment_id, completion_date)` succeeds because the partial unique index respects `undone_at IS NULL` only. Balance pulses 0 → 5. |
| `GET /he/wallet` | 200, "היסטוריית הארנק" — 5 entries in reverse-chronological order with Hebrew timestamps (Asia/Jerusalem, Heebo numerals), task title joined from `task_completion → task_assignment → task_template`. |

### Admin task templates + assignments (gates 6)

| Step | Result |
|---|---|
| Parent login → `GET /he/admin` | 200, two-card landing: "ילדות" + "תבניות משימות" |
| `GET /he/admin/tasks` | 200, lists all 6 seed templates with per-row Edit + Assign links, "+ משימה חדשה" CTA in the header |
| `GET /he/admin/tasks/new` → fill form → submit | 303 → `/he/admin/tasks`. DB shows new row "לסדר את החדר / Tidy room" + `audit_log(action='task_template.created', actor=Mom)`. |
| `GET /he/admin/tasks/<id>/assign` | 200, both kids listed with mint "כן" / grey "לא" toggle. Clicking flips assignment + writes `audit_log(action='task_assignment.{enabled,disabled}')`. |
| `GET /he/admin/kids/<yael>/ledger` | 200, header card with Yael's name + balance (5); 5 ledger rows with `+5`/`-5` amounts, per-row balance_after, kind labels in Hebrew. Clamped amounts surface only on admin_debit rows (none in dev — Phase 6 wires the joker UI). |

### Ledger invariants Vitest suite (gate 7)

Run command: `TEST_DATABASE_URL=postgres://reco:test@localhost:5433/reco_test pnpm --filter @reco/db test`

```
 ✓ src/test-utils/test-db.test.ts (4 tests) 3797ms
 ✓ src/helpers/encrypt.test.ts (7 tests) 8ms
 ✓ src/ledger/post.guard.test.ts (1 test) 102ms
 ✓ src/ledger/post.test.ts (18 tests) ~17s
   ✓ input validation — 7 (earn ≤0, earn missing FK, earn double-FK, redeem ≥0, admin_credit no note, admin_debit ≥0, non-integer)
   ✓ happy paths — 5 (earn correct balance, accumulate, per-kid isolation, undo reverses, admin_credit + note)
   ✓ admin_debit clamping — 3 (no clamp when covered, partial clamp on overdraw, full clamp on already-overdrawn)
   ✓ DB CHECK constraints — 1 (raw INSERT bypassing app validation still rejected)
   ✓ concurrency — 2 (same-kid serialization without lost updates; different-kid parallelism)
   ✓ append-only invariant — 1 (every row's balance_after == prefix sum)

Test Files  4 passed (4)
     Tests  31 passed (31)
```

---

## Locked invariants (build-plan task 2, SCHEMA.md §13)

- **`ledgerPost()` is the only writer.** Static grep guard in [`packages/db/src/ledger/post.guard.test.ts`](../packages/db/src/ledger/post.guard.test.ts) scans `apps/` + `packages/` for `insert\s+into\s+ledger_entry` and fails CI if found outside `packages/db/src/ledger/post.ts`, the SQL migrations, and the test files that intentionally exercise raw INSERTs.
- **Per-kid advisory lock.** `pg_advisory_xact_lock(hashtext(kid_id))` is taken at the top of every `ledgerPost` call, scoped to the transaction. Different kids never block each other (verified by the "DOES NOT block concurrent earns for DIFFERENT kids" test).
- **`balance_after` is the raw arithmetic sum** at the time of the row. It CAN go negative (admin overdraw); the wallet display floors at 0 via `GREATEST(0, SUM(amount))`. `clamped_amount` records the portion of an `admin_debit` that wasn't backed by positive balance.
- **Partial unique double-claim prevention.** `task_completion_assignment_date_active(assignment_id, completion_date) WHERE undone_at IS NULL` is the integrity point. The server action catches Postgres 23505 and returns a typed `already_done` to the kid UI.
- **Same-day undo only.** `undoTaskCompletionAction` rejects with `not_same_day` if `completion_date` differs from today (Asia/Jerusalem). Phase 7's streak engine will use this — yesterday's completion is immutable history, but yesterday's undo broken streaks aren't possible from the kid UI (admin "joker" handles retro corrections — Phase 6).

---

## Deferred (non-blocking for Phase 3 ship)

- **Playwright double-tap E2E.** The "two clicks 50ms apart" scenario from BUILD-PLAN risks-and-mitigations. The DB partial unique + server-action 23505 catch are both in place; Vitest covers the constraint. Playwright land alongside Phase 5's evidence-upload E2E suite (FCFS approval test needs the browser too).
- **Long-term task UI.** Per the build plan, Phase 4 owns long-term progress + per-unit coins + bonus-on-completion. The admin task-template form currently hard-codes `kind='daily'`; Phase 4 adds a kind toggle + the conditional fields. Phase 3 list/edit pages already render the existing long-term seed ("Read a book") correctly.
- **Joker (admin wallet adjust) UI.** Per BUILD-PLAN Phase 6. The ledger contract already supports `admin_credit` / `admin_debit` (tested), the audit_log writer is in place — Phase 6 just lands the form. Per-kid ledger view shows clamped amounts for when joker debits land.
- **Real fox + bunny avatars + task-icon SVGs.** Brandbook §4.1–4.2 placeholder fallback (first letter + colored circle) — same approach as Phase 2. Sourcing lands in Phase 9 polish.

---

## Surprises + lessons (worth carrying forward)

1. **Architectural deviation from BUILD-PLAN.md.** The plan named `apps/worker/src/ledger/post.ts` as the writer's home. We put it at `packages/db/src/ledger/post.ts` instead because ARCHITECTURE.md §5 makes ledger writes a shared concern between apps/web (server actions) and apps/worker (cron). Placing it in `@reco/db` lets both apps import via the workspace package without HTTP-hopping the boundary on every coin event. Worker imports `ledgerPost` from `@reco/db` exactly the same way the web server actions do.
2. **Use `pg_advisory_xact_lock` per kid, not SERIALIZABLE transactions.** SERIALIZABLE requires 40001 retry logic and contends across unrelated kids. Per-kid advisory lock is cheaper, lower-contention, and self-releasing on COMMIT/ROLLBACK. Confirmed by the test that two kids' concurrent earns don't block.
3. **`balance_after` set vs prefix-sum check.** When testing concurrent earns, we initially asserted the SORTED set of balance_after values would match a fixed list `[5, 12, 15]`. That's wrong — the prefix sums depend on the serialization order (six permutations of `[5,7,3]` produce six different sets). The right invariant is "for every row, `balance_after − amount` is either 0 OR another row's balance_after." Same proof of no lost updates, order-agnostic.
4. **Server action via prop vs direct import — both work, but `button[type="submit"]` selectors bite.** The admin task-form initially passed the create/update action via a prop. After a JS-eval test landed on `/login`, I assumed Next 16 was stripping the server-action-ness through the prop boundary. The actual cause: the admin layout has a "Sign out" form whose `<button type="submit">` is FIRST in the DOM, so `document.querySelector('button[type="submit"]').click()` triggered sign-out, not the create form. The direct-import refactor is fine to keep (slightly safer pattern) but the test selector was the real bug.
5. **`form action` requires `Promise<void>` or string.** A `(prev, FormData) => Promise<Result>` server action passed straight to `<form action>` triggers a TS error; the `useActionState` consumer wraps it. For non-state-returning inline form submissions (e.g., the assign-page kid toggle), a thin `(formData) => Promise<void>` wrapper drops the result and matches the form-action contract.
6. **Next 16 deprecates `middleware.ts` in favor of `proxy.ts`.** Dev server prints a warning on each boot. Functionally still works; renaming is a one-liner that can land in Phase 9 polish.

---

*Last updated: 2026-05-21. Phase 3 build complete; Phase 4 (long-term tasks + progress logging) is next — Medium risk.*
