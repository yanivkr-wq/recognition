# Phase 4 — Exit audit

> Long-term tasks + progress logging + per-unit earn + bonus-on-completion +
> bonus-reversal-on-undo. Locked 2026-05-22.
>
> Status: **ALL EXIT CRITERIA MET.** Phase 5 (evidence upload + parent approval)
> is next per [`docs/BUILD-PLAN.md`](BUILD-PLAN.md). Phase 5 is HIGH-risk —
> minors' photos + FCFS approval concurrency.

---

## BUILD-PLAN.md Phase 4 — exit criteria status

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Kid can log "+5 pages" against the "Read 100 pages" task. 5 coins land immediately. | **Verified in browser** | Logged into Lia's profile (`/he/pick/lia`, PIN 1234) → kid home shows the seeded long-term "קריאה" (Read a book) task with progress bar at 0/100 עמודים. Typed `20` into the quantity input + tapped "תיעוד" → balance pulses 0 → 20, progress bar fills to 20%, "+20 ×" undo chip appears in the today-entries row. The Vitest invariant test `logProgressOperation — per-unit earn > posts a single earn for quantity × per_unit_coins (1 coin/page)` covers the +5/+5 shape too. |
| 2 | Repeated logging accumulates. At cumulative quantity ≥ 100, bonus coins land via a separate `earn` ledger entry. | **Verified in browser + Vitest** | Followed +20 with +80 in the same browser session → balance jumped 20 → 150 (per-unit 80 + bonus 50), progress bar to 100%, "הושלם!" mint pill replaced the input form, both `+20 ×` and `+80 ×` chips remain. Vitest test `posts the bonus and marks the assignment completed on goal cross` asserts the bonus entry has `kind='earn'` with `long_term_progress_id=<crossing row>` and `task_assignment.long_term_completed_at` flipped to non-null. |
| 3 | Undo of a progress row reverses the per-unit coins only (bonus stays if previously earned and not consumed by goal recomputation). | **Resolved + verified** | The open question in the BUILD-PLAN ("what if a kid logs +5 → bonus fires → kid undoes the +5?") is resolved as: **the bonus reverses too whenever the undo drops total below goal, regardless of which row was undone.** Browser test: from the "completed" state at 100/100 (balance 150), tapped the `+80 ×` chip → balance 150 → 20 (−80 per-unit + −50 bonus), progress 100% → 20%, "הושלם!" pill gone, input form re-appears. Both Vitest tests `reverses BOTH per-unit AND bonus when undo drops total below goal` and `reverses bonus + reopens even if the undo target is NOT the crossing row` cover the edge case. The cycle test `re-crossing the goal posts a fresh bonus entry` proves the cycle is repeatable. |

---

## Sub-milestone deliverable map

| Sub | What landed | Key files |
|---|---|---|
| **4a** | Migration `0003_phase4_long_term.sql` adds `task_assignment.long_term_completed_at TIMESTAMPTZ` (nullable). Drizzle field added in `tasks.ts`. | [`packages/db/migrations/0003_phase4_long_term.sql`](../packages/db/migrations/0003_phase4_long_term.sql), [`packages/db/src/schema/tasks.ts`](../packages/db/src/schema/tasks.ts) |
| **4b** | `logProgressOperation` + `undoLongTermProgressOperation` — in-tx primitives, called by the web server actions. Both go through the same `ledgerPost()` writer from Phase 3 (no second ledger writer; the grep guard still holds). | [`packages/db/src/long-term/log-progress.ts`](../packages/db/src/long-term/log-progress.ts), [`packages/db/src/long-term/undo-progress.ts`](../packages/db/src/long-term/undo-progress.ts), [`apps/web/src/lib/long-term/actions.ts`](../apps/web/src/lib/long-term/actions.ts) |
| **4c** | 16 Vitest invariants — input validation (kind/quantity/ownership), per-unit earn accumulation, goal-cross + bonus, bonus reversal on undo (both crossing-row + non-crossing-row paths), the cross→undo→re-cross cycle. | [`packages/db/src/long-term/log-progress.test.ts`](../packages/db/src/long-term/log-progress.test.ts) — 16 new tests. Combined ledger + long-term suite: **47/47 pass.** |
| **4d** | `LongTermTaskCard` — progress bar (lavender gradient per BRANDBOOK §2.3 + §6.4), per-unit + bonus chip header, today's entries with per-row undo, hidden input form when completed. Kid home renders a "יעדים ארוכי טווח" section under the daily list. | [`apps/web/src/app/[lang]/_components/long-term-task-card.tsx`](../apps/web/src/app/[lang]/_components/long-term-task-card.tsx), [`apps/web/src/app/[lang]/_components/kid-home.tsx`](../apps/web/src/app/[lang]/_components/kid-home.tsx), [`apps/web/src/app/[lang]/page.tsx`](../apps/web/src/app/[lang]/page.tsx) |
| **4e** | Admin task-form gains a `kind` radio (daily / long-term) with conditional fields. Edit-mode disables the radio (kind change would silently invalidate existing completion/progress rows). | [`apps/web/src/app/[lang]/admin/tasks/_components/task-form.tsx`](../apps/web/src/app/[lang]/admin/tasks/_components/task-form.tsx), [`apps/web/src/lib/admin-tasks/actions.ts`](../apps/web/src/lib/admin-tasks/actions.ts) |
| **4f** | This document + CHANGELOG entry. | [`docs/PHASE-4-EXIT.md`](PHASE-4-EXIT.md), [`CHANGELOG.md`](../CHANGELOG.md) |

---

## Browser verification end-to-end

Captured during the 4d/4e sub-milestones (Asia/Jerusalem dev box, throwaway pg
on port 5433, Lia PIN `1234`, Mom password `test123`):

| Step | URL | Outcome |
|---|---|---|
| Pick Lia → enter `1234` | `/he/pick/lia` | Kid home renders. Daily section shows 5 tasks (make bed, brush teeth, breakfast, dress, homework — with "צריך תמונה" pill on homework). Long-term section shows "קריאה" with `0 / 100 עמודים`, "1 ל עמודים · קיבלת בונוס: 50". |
| Type `20` in the +N input + tap "תיעוד" | `/he/` | Balance pulses 0 → 20 (Heebo tabular nums, scale-1.1 animation per BRANDBOOK §9.3). Progress bar fills to 20%. `+20 ×` chip appears in the today-entries row. |
| Type `80` + tap "תיעוד" (crosses goal) | `/he/` | Balance 20 → 150 (per-unit 80 + bonus 50). Progress bar to 100%. "הושלם!" mint-dark pill replaces the input form. Both `+20 ×` and `+80 ×` chips remain. |
| Tap `+80 ×` chip (undo crossing row) | `/he/` | Balance 150 → 20 (−80 per-unit + −50 bonus). Progress bar 100% → 20%. "הושלם!" gone, input form back. Only `+20 ×` chip remains. |
| Parent login mom@reco.local / test123 → `/he/admin/tasks/new` | `/he/admin/tasks/new` | Form renders with kind radio (daily checked, long_term unchecked). `coinValue` field present, long-term fieldset absent. |
| Click "יעד ארוך טווח" radio | (no nav) | Form re-renders: `coinValue` hidden, 5 long-term fields appear inside the lavender fieldset. |
| Fill Meditation/30/60-min/2-coin-per-min + submit | `/he/admin/tasks` (303) | New row `kind=long_term, per_unit=2, goal=60, bonus=30, unit_he=דקות, unit_en=minutes` lands in `task_template`. |
| `GET /he/admin/tasks/<new-id>/edit` | `/he/admin/tasks/<id>/edit` | Form pre-fills every long-term field. Both radios disabled (per `mode === 'edit'`). |

Screenshots captured: kid home with both sections + long-term progress at 20% (after the bonus reversal), admin edit form with disabled kind radios + filled long-term fields.

---

## Risks + mitigations (BUILD-PLAN Phase 4 risks)

| Risk | Mitigation |
|---|---|
| Bonus-reversal arithmetic drift across multiple cycles | The undo operation re-derives the bonus by finding the most recent unaudited bonus entry (kind=earn ∧ NOT a per-unit credit ∧ NOT already undone) — see `bonusRes` query in `undo-progress.ts`. The cycle test `re-crossing the goal posts a fresh bonus entry` asserts the second bonus entry's `id` differs from the first. |
| Concurrency between progress log + parent joker debit (Phase 6) | The per-kid `pg_advisory_xact_lock` in `ledger.post()` serializes all ledger writes per kid_id. A future joker debit while a kid is mid-progress-log will queue, not race. |
| Kid logs progress AFTER the assignment is marked completed | `already_done` error short-circuits before any DB write. Vitest `rejects logProgress once the assignment is completed (already_done)` covers it. |
| Admin changes a template's kind on an existing template | The update action rejects kind changes (`return 'invalid_long_term_fields'`) AND the edit form disables the radio. The form-level disable + server-side reject is defense-in-depth (per CLAUDE.md "never trust the UI alone"). |
| Long-term assignment with `bonus_on_complete IS NULL` or `0` | Bonus only posts if `(bonus ?? 0) > 0`. Test `does NOT post a bonus when bonus_on_complete is null/zero` asserts the assignment still marks completed without a bonus row — keeps the "goal reached" semantics independent of the bonus knob. |

---

## Deviations + notes for future sessions

- **`ledger.post()` is the single writer for the bonus too.** A separate `campaign_bonus` ledger kind exists in the schema for the Phase 7 campaign engine — it requires a `campaign_id` FK. Long-term task bonuses don't have a campaign, so they post as `kind=earn` with the triggering `long_term_progress_id`. The schema's CHECK constraint allows this (`earn` requires task_completion_id OR long_term_progress_id; doesn't bound the count per progress row).
- **Same-day undo only.** Long-term progress, like daily completions, can only be undone on the SAME calendar day in `Asia/Jerusalem`. Older rows are immutable history (consistent with the daily-task contract from Phase 3).
- **The "non-existent scenario" test.** Vitest `// Note on a NOT-tested scenario` documents why "undo while total stays above goal" can't happen in v1: once an assignment is `long_term_completed_at`, further `logProgress` calls error with `already_done`. If Phase 7 introduces "campaigns can keep accumulating past goal," revisit this.
- **The admin form's `kind` radio uses controlled state (`useState`).** Toggling re-renders the form to show/hide the long-term fieldset. The state lives client-side; the form's `kind` form field carries the actual value to the server. Setting it via the eval requires `.click()` on the radio (so React's onChange fires) + a brief await for React to commit the state.
- **Phase 3's exit-audit warning replayed here.** The admin layout's "Sign out" form has a `<button type="submit">` that's first in the DOM. Eval-based form submissions MUST scope the selector to the target form (e.g., `document.querySelector('input[name="longTermPerUnitCoins"]').closest('form')`) — otherwise `document.querySelector('button[type="submit"]')` clicks Sign-out and lands on `/he/login`. This bit twice; documented in the dev-helpers section of this audit.

---

## Phase 5 entry conditions

Per BUILD-PLAN §"Phase 5" entry criteria:

- [x] Phase 4 exit criteria met.
- [x] Long-term path doesn't conflict with the evidence-required flag on the template — the seed reading task is `evidence_required=false`, and the admin form passes the flag through to BOTH kinds. (Phase 5 will land the evidence-upload server action which keys off `template.evidence_required`, not `template.kind`.)
- [ ] `apps/worker/src/routes/evidence.ts` doesn't exist yet — Phase 5 task 2.
- [ ] B2 bucket `reco-evidence-backup` not provisioned yet — Phase 5 task 11 hand-off to deploy.

Phase 5 risks: minors' photos at rest, FCFS approval concurrency, photo-serving authorization on every byte request. ALL kid-side photo upload server actions will need the same `requireKid()` boundary + ownership join. See `docs/ARCHITECTURE.md` §9 for the upload + serve + purge contract.

---

*Last updated: 2026-05-22. Phase 4 complete. Phase 5 next (evidence upload + parent approval — HIGH risk).*
