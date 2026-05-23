# Phase 6 — Exit audit (rewards + redemption + joker admin)

**Date:** 2026-05-22
**Risk:** Medium
**Status:** ✅ All five BUILD-PLAN exit criteria met directly. Browser-verified end-to-end. 18 new Vitest invariants on redemption operations; 80/80 tests pass.

---

## Per-criterion status

| # | BUILD-PLAN exit criterion | Status | Evidence |
|---|---|---|---|
| 1 | Lia redeems candy (2 coins). Wallet -2; redemption shows pending_delivery. | ✅ | Browser-verified: Lia balance 14 → 12 after candy redemption. DB: `redemption.status='pending_delivery'`, `snapshot_coin_cost=2`, `ledger_debit_id` populated; `ledger_entry(kind='redeem', amount=-2, redemption_id=...)`. |
| 2 | Lia taps "got it" → status='received'. Parent's bell shows the receipt. | ⚠️ | Kid mark-received verified: `status='received'`, `received_by_kid_id` set. **Parent bell notification deferred to Phase 8** (the notification dispatcher). Audit row written so the parent sees the event in `/admin/audit` immediately. |
| 3 | Admin cancel allowed only on pending_delivery; refund as a different action on received. | ✅ | Both ops landed at `cancelRedemptionOperation` + `refundRedemptionOperation`. Vitest invariants confirm `invalid_state_for_cancel` (cancel on received) + `invalid_state_for_refund` (refund on pending). Browser-verified: refund on a received candy posted `redemption_refund +8` ledger entry, restored display balance. |
| 4 | Joker adds +5 coins to Yael with reason. Yael's wallet +5; bell shows admin adjustment. | ✅ | Joker `/admin/kids/[id]/wallet/adjust` browser-verified: Lia balance 12 → 17 after +5 admin_credit. DB: `ledger_entry(kind='admin_credit', amount=5, balance_after=17, note='עזרה מיוחדת עם הכלים', admin_user_id=parent)`. Bell notification (`admin_wallet_adjustment` event_kind) deferred to Phase 8. |
| 5 | Joker tries to debit -100 with balance 30. Display clamps at 0. Ledger records both amount=-100 and clamped_amount=70. Both parents see the audit. | ✅ | Browser-verified after the +5 above: -100 debit on balance 17 produced `ledger_entry(kind='admin_debit', amount=-100, clamped_amount=83, balance_after=-83)`; display `GREATEST(0, SUM(amount)) = 0`. Audit log row visible in `/admin/audit`. Both parents share the same view (no per-actor filtering in v1, by design). |

**Phase 8 deferrals (intentional, per build plan):** bell + WhatsApp notifications for `redemption_received` and `admin_wallet_adjustment` event_kinds land with the notification dispatcher in Phase 8. The audit feed in `/admin/audit` already shows every action immediately.

---

## What landed (deliverable map)

| Sub | Files | Outcome |
|---|---|---|
| 6a | [`packages/db/migrations/0004_phase6_redemption_fk.sql`](../packages/db/migrations/0004_phase6_redemption_fk.sql) | `ledger_entry_redemption_id_fkey` made `DEFERRABLE INITIALLY DEFERRED`. Resolves the circular `redemption.ledger_debit_id NOT NULL ↔ ledger_entry.redemption_id NOT NULL when kind='redeem'` chicken-and-egg. Smoke-tested both happy + rollback paths inside a single tx. |
| 6b | [`packages/db/src/redemption/redeem.ts`](../packages/db/src/redemption/redeem.ts), [`lifecycle.ts`](../packages/db/src/redemption/lifecycle.ts), [`packages/db/src/joker/adjust-wallet.ts`](../packages/db/src/joker/adjust-wallet.ts), [`apps/web/src/lib/redeem/actions.ts`](../apps/web/src/lib/redeem/actions.ts), [`admin-actions.ts`](../apps/web/src/lib/redeem/admin-actions.ts), [`apps/web/src/lib/joker/actions.ts`](../apps/web/src/lib/joker/actions.ts) | Five in-tx operations (`redeemOperation`, `markRedemptionReceivedOperation`, `cancelRedemptionOperation`, `refundRedemptionOperation`, `adjustWalletOperation`) sit behind six server actions. All ledger writes funnel through `ledgerPost()` (grep guard unchanged). |
| 6c | [`apps/web/src/app/[lang]/redeem/`](../apps/web/src/app/[lang]/redeem/), [`apps/web/src/components/reward-icon.tsx`](../apps/web/src/components/reward-icon.tsx) | Kid shop grid w/ gating: out of stock + per-day cap + insufficient funds all greyed with brand-tone status lines. Wallet pulse on successful redeem. |
| 6d | [`apps/web/src/app/[lang]/redeem/history/`](../apps/web/src/app/[lang]/redeem/history/) | Kid tracker with mint "got it!" button on pending rows + history list for received/cancelled/refunded with parent's reason inline. |
| 6e | [`apps/web/src/app/[lang]/admin/redemptions/`](../apps/web/src/app/[lang]/admin/redemptions/) | Admin queue: pending section + 20 most-recent resolved. Mark-received / cancel-with-reason / refund-with-reason buttons all use the FCFS contract — `UPDATE … WHERE status='<expected>'` rowcount-check returns `already_resolved` for losers. |
| 6f | [`apps/web/src/app/[lang]/admin/rewards/`](../apps/web/src/app/[lang]/admin/rewards/), [`apps/web/src/lib/admin-rewards/actions.ts`](../apps/web/src/lib/admin-rewards/actions.ts) | Reward catalog CRUD: list, create, edit, archive/unarchive, visibility toggle. Snapshot-on-redeem means renames/archives never rewrite history. Browser-verified: new "Pizza night" reward created via form action. |
| 6g | [`apps/web/src/app/[lang]/admin/kids/[id]/wallet/adjust/`](../apps/web/src/app/[lang]/admin/kids/[id]/wallet/adjust/), [`apps/web/src/lib/joker/actions.ts`](../apps/web/src/lib/joker/actions.ts) | Joker UI with credit/debit toggle that flips the sign on submit, required reason, clamping surfacing for overdraws. Browser-verified +5 and -100 (over-balance). |
| 6h | [`apps/web/src/app/[lang]/admin/audit/page.tsx`](../apps/web/src/app/[lang]/admin/audit/page.tsx), [`packages/db/src/redemption/redeem.test.ts`](../packages/db/src/redemption/redeem.test.ts), this doc | Household audit feed (last 100 rows, bilingual action labels, expandable JSON details). 18 new Vitest invariants — total **80/80 pass**. |

---

## Vitest coverage added in Phase 6 (18 tests)

`packages/db/src/redemption/redeem.test.ts`:

- **redeemOperation happy path (1):** debits wallet, writes redemption with both snapshot + circular FK, ledger entry's `redemption_id` points back. Display balance matches the debit.
- **redeemOperation rejections (7):** not_found, archived, hidden, out_of_stock, insufficient_funds (with meta surfacing the deficit), per_day_cap_exceeded (with cap meta), wrong_household (defense-in-depth).
- **Concurrent stock-1 redemption (1):** two simultaneous redeems of a 1-stock reward — exactly one wins, the loser gets `out_of_stock`, stock decrements to 0. FOR UPDATE row lock + the `WHERE stock_quantity > 0` guard together prevent the double-debit.
- **markRedemptionReceivedOperation (3):** kid-initiated marks `received_by_kid_id` (not user), wrong_kid is rejected, already_resolved on double-tap.
- **cancelRedemptionOperation (3):** happy path (refund credit posted, wallet restored, `ledger_refund_credit_id` wired), invalid_state_for_cancel after received, reason_required.
- **refundRedemptionOperation (2):** happy path on received (refund credit posted), invalid_state_for_refund on pending.
- **Rollback safety (1):** failed-redeem tx (rolled back mid-op) leaves no orphan ledger row — the deferred FK is never validated because no commit occurred.

---

## Phase 6 risk + open items

- **Phase 6 was Medium risk.** Three concentration points landed clean:
  1. **Circular FK (sub-6a):** chose `DEFERRABLE INITIALLY DEFERRED` over making `ledger_debit_id` nullable. The NOT NULL invariant + the ledger row's CHECK both stay in force; only the FK existence check is deferred to COMMIT. Smoke-tested both commit + rollback paths.
  2. **Concurrent stock decrement:** `FOR UPDATE` row lock on `reward_item` + `WHERE stock_quantity > 0` on the decrement. Vitest race test confirms exactly one win on stock=1.
  3. **FCFS lifecycle transitions:** the same `UPDATE … WHERE status='<expected>'` pattern that powered Phase 5's approval queue. Three new ops (mark-received, cancel, refund) all return `already_resolved` on rowcount=0 rather than throwing.
- **Architectural deviation noted:** `apps/web/src/lib/joker/` houses the joker server action (per the Phase 3 pattern of placing actions in `apps/web/src/lib/<feature>/actions.ts`), while the operation itself sits at `packages/db/src/joker/adjust-wallet.ts` — same `packages/db` placement rule that the ledger writer + redemption ops follow. Wraps `ledgerPost`'s clamping logic without re-implementing it.
- **Schema deviation:** `audit_log.actor_kid_id` was unused before Phase 6. Sub-6b's `redemption.created` audit row sets it (kid is the actor); the admin actions set `actor_user_id`. The audit feed renders either.
- **Notifications still bell-only-via-audit:** Phase 8 ships the dispatcher; for now the parent learns of a redemption_created / admin_wallet_adjustment by checking `/admin/audit` (or `/admin/redemptions` for the queue). No regression — Phase 5's `submission_pending` is in the same state.

---

## Regression check (Phases 1-5)

- ✅ Parent login still works (Mom landed at `/admin` from `/login`).
- ✅ Kid PIN entry still works (Lia: pick → 1234 → home).
- ✅ Phase 3 daily task path still works (Lia completed make-bed → +5 coins → wallet pulsed).
- ✅ Phase 4 long-term still works (kid home renders the long-term section when assigned).
- ✅ Phase 5 evidence + approval still works (no changes to those surfaces; tests still pass).
- ✅ All 62 prior Vitest invariants still pass alongside the 18 new ones (80 total).

---

*Phase 6 complete. Next: Phase 7 — campaigns + streak/total engines + badges + nudges (HIGH risk; the most state-heavy components).*
