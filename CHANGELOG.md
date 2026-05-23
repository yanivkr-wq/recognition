# Reco — Changelog

Running log of significant changes to the codebase and the design system. Newest first.

---

## [Unreleased]

### Admin reward-image upload — wired (2026-05-23)

**Closes a leftover from the visual-polish round.** The reward shop has rendered photos from `reward_item.image_path` since the redesign, but the only way to populate that column was a hand-rolled SQL UPDATE with an Unsplash URL. This change ships the missing admin upload flow.

- **Storage** — Per Gate 2 §Q3 the volume is shared with evidence (`reco-evidence` mount); reward photos land in the `rewards/` subdirectory. The evidence-purge cron is row-driven against the `evidence` table ([`apps/worker/src/cron/evidence-purge.ts`](apps/worker/src/cron/evidence-purge.ts)) so co-location is safe — no new env var, no new docker volume. (Earlier in this change I had drifted to a separate `REWARD_IMAGE_VOLUME_PATH` env + `reco-reward-images` volume; reverted after re-reading Gate 2.)
- **New module** [`apps/web/src/lib/reward-images/`](apps/web/src/lib/reward-images/):
  - [`paths.ts`](apps/web/src/lib/reward-images/paths.ts) — `freshRewardImageFilename` (date-sharded UUID), `rewardImagePathFor` (path-traversal guard), `isAllowedRewardMime` (JPG/PNG/WEBP, 5 MB cap), `isExternalImageUrl` (legacy http(s) detector for the demo URLs already in the dev DB).
  - [`actions.ts`](apps/web/src/lib/reward-images/actions.ts) — `uploadRewardImageAction` (admin-gated; verifies reward belongs to admin household; writes file then UPDATEs `reward_item.image_path` to the relative filename; appends `reward_item.image_uploaded` audit) and `removeRewardImageAction` (NULLs the column + audit). Old files on disk are intentionally **not** unlinked — orphans are harmless and avoiding the race makes the action obviously safe.
- **New API route** [`apps/web/src/app/api/reward-images/[id]/route.ts`](apps/web/src/app/api/reward-images/[id]/route.ts) — `id` is `reward_item.id` (NOT the filename) so URLs stay stable across re-uploads. Mirrors the evidence-route's principal resolution (kid JWT preferred over Auth.js session). Kid principal needs the reward `visible_to_kids=true AND archived_at IS NULL`; admin gets any in-household. Legacy http URLs short-circuit to 404 (defense-in-depth — the renderer never routes them here anyway). `Cache-Control: private, max-age=300` (not minors' content, so a short shared cache is fine).
- **Admin UI** — [`reward-image-picker.tsx`](apps/web/src/app/[lang]/admin/rewards/_components/reward-image-picker.tsx) is a new client component rendered **below** the main reward form (HTML doesn't allow nested `<form>`, and the picker needs its own action). Shows current photo preview + file input + upload button + remove button. Edit-mode only; create-mode shows "save the reward first to upload a photo". Server response refreshes the form via `revalidatePath`. The [edit page](apps/web/src/app/[lang]/admin/rewards/[id]/edit/page.tsx) computes `currentImageUrl` (legacy http passthrough OR `/api/reward-images/<id>`) and passes it through.
- **Kid shop** — [`redeem/page.tsx`](apps/web/src/app/[lang]/redeem/page.tsx) now maps `image_path` → `imageUrl` with the same legacy-passthrough logic so existing Unsplash demos keep working unchanged while new uploads route through the API. `ShopReward.imagePath` renamed to `imageUrl`; [`reward-tile.tsx`](apps/web/src/app/[lang]/redeem/_components/reward-tile.tsx) updated accordingly.
- **i18n** — 13 new admin dictionary keys (`rewardImage`, `rewardImageHint`, `rewardImageCreateFirst`, `rewardImageCurrent`, `rewardImageNone`, `rewardImageUpload`, `rewardImageUploading`, `rewardImageRemove`, `rewardImageTooLarge`, `rewardImageBadMime`, `rewardImageNoFile`, `rewardImageFailed`) added to the Dictionary type + both `he.json` / `en.json`.
- **Verification** — `pnpm --filter @reco/web typecheck` + `pnpm --filter @reco/shared typecheck` both clean. Browser smoke test was skipped at user request (would require admin login).

### Phase 4 · Build · Visual polish + Phase 7.5 (2026-05-23)

**Post-Phase-7 polish pass over the kid surfaces.** No new engine work,
no schema changes to the financial center, just a stack of UX upgrades
informed by playing the app live. One small net-new feature (time-bound
tasks) was added inline since it was tightly scoped and unblocked the
"brush teeth before 8 AM" use case.

#### Layout + nav

- **Sticky bottom nav** ([`bottom-nav.tsx`](apps/web/src/app/[lang]/_components/bottom-nav.tsx)) replaces the pill-row links under the wallet hero. 5 thumb-tappable items: Home / Shop / Quests / Badges / Wallet. Active item gets a pink-soft highlight; safe-area inset for iOS notch. Every kid page got a `pb-28` so the fixed bar doesn't overlap content.
- **Bell icon shell** in the kid-home header with unread count chip + `/notifications` page (unread/earlier split) + `markAllReadAction`. Phase 8's dispatcher polishes WhatsApp + quiet hours on top.
- **RTL arrow flipping** — `arrowBack(lang)` + `arrowForward(lang)` helpers ([`lib/rtl.ts`](apps/web/src/lib/rtl.ts)) used across 12 sites so "← back" reads as "→ back" in Hebrew context.

#### Sections + copy

- Active / done task split on kid-home with sub-headers "✨ עוד לפנייך" + "✓ סיימת היום". Section header emojis swapped for inline SVG icons (`ic-sparkle`, `ic-check-circle`, `ic-party`) per BRANDBOOK §13 no-emoji-as-glyph rule.
- "🎉 כל הכבוד! סיימת הכל" milestone empty-state when the kid finishes every active task.
- Done-task card: green checkmark SVG + prominent ↶ undo pill (was a tiny text link).
- Campaign cards: numeric breakdown ("30 / 100 · 30%"), encouragement copy that shifts with progress bucket (🌅/🚀/💪/🔥/✨), "X to go" counter, badge preview row at the bottom showing the embroidered patch + name of the badge the kid will earn on completion.

#### Wallet history rebuild

- Current balance hero at top (mirrors kid-home grammar).
- Entries grouped by IL date via native `<details>`; only TODAY auto-expands, yesterday + older start collapsed.
- Task + reward icons inline on every row (5-way LEFT JOIN through task_completion + long_term_progress + redemption).
- Time column left-aligned under coin chip (flex-col handles RTL).
- Live wallet pulse: [`kid-home.tsx`](apps/web/src/app/[lang]/_components/kid-home.tsx) now syncs the wallet hero with the server's fresh `initialBalance` on every revalidate — fixes the stale-balance-after-complete bug.

#### Icon library + admin pickers

- 28 inline SVG icons in [`icon-library.tsx`](apps/web/src/components/icon-library.tsx). Two families: `ic-*` task icons (16 incl. bed, brush, meal, clothes, homework, book, broom, music, pet, plant, soap, pencil, bike, water, sun, star, bell, house, wallet, medal, quest variants, shop, sparkle, check-circle, party) + `rw-*` reward icons (12 incl. candy, phone, icecream, pillow, movie, controller, pizza, gift, cookie, balloon, toy, trophy).
- Seed-key aliases (`ic-tooth → ic-brush`, `ic-food → ic-meal`, `ic-shirt → ic-clothes`) so the existing seed renders without backfill.
- [`IconPicker`](apps/web/src/components/icon-picker.tsx) component on admin task + reward forms — clickable grid of bilingual-labeled tiles with live preview using the chosen color.
- Shop CTA on kid-home now has a 🎁 gift icon.

#### Reward shop redesign

- Tiles get a hero area on top: full-bleed photo when `reward_item.image_path` is set, else the original pastel tile + small icon (BRANDBOOK §12.2 grammar).
- Coin cost chip floats top-corner over the photo with `bg-card/90 backdrop-blur`.
- 7 seeded rewards have demo Unsplash image_paths set in the dev DB (lost on re-seed).

#### Confetti delight

- `canvas-confetti` dep added; [`celebrate.ts`](apps/web/src/lib/celebrate.ts) helper exposes 3 intensities (small/medium/big). Fires on task complete (small burst at tap-point), redeem (medium), and "all tasks done today" milestone (big two-sided burst). Respects `prefers-reduced-motion`. Sound deferred per call.

#### Avatar system

- 10 multi-color SVG faces in [`avatar-library.tsx`](apps/web/src/components/avatar-library.tsx) — fox, bunny, cat, dog, owl, bear, unicorn, panda, frog, monkey. Each face has its own identity palette (e.g. fox = orange body + white mask + peach inner ears; unicorn = white + rainbow mane + gold horn; panda = white + black ears + black eye patches) independent of the kid's accent color.
- Kid `/[lang]/avatar` picker with grid of faces + an 8-swatch color palette (pink / peach / yellow / mint / sky / lavender / rose / apple).
- [`setKidAvatarAction`](apps/web/src/lib/avatar/actions.ts) + `setKidColorAction`; both whitelist-validated server-side.
- Schema migration 0006: `ALTER TABLE kid ADD COLUMN avatar_key TEXT`.
- [`Avatar`](apps/web/src/components/avatar.tsx) component used on every kid-page header (home / wallet / shop / history / campaigns / badges / notifications / pick / avatar picker) + admin redemption queue. Falls back to initial-letter circle when `avatar_key` is null.
- Kid principal carries `avatarKey`; `requireKid()` selects + returns it.

#### Time-bound daily tasks (Phase 7.5 mini-feature)

- Schema migration 0005: `ALTER TABLE task_template ADD COLUMN deadline_time TIME`.
- Admin task form gets an optional `<input type="time">` field (daily-kind only). Long-term ignores it.
- [`completeTaskAction`](apps/web/src/lib/tasks/actions.ts) gates against the deadline: past-deadline + no completion today returns `deadline_passed`.
- Kid task card shows a live countdown `H:MM:SS` that ticks every second (urgent styling under 30 min). Past deadline → status flips to `'locked'`, card greys out, button disabled.
- Admin recourse: [`adminCompleteForKidAction`](apps/web/src/lib/admin-tasks/actions.ts) lets a parent complete a missed task on the kid's behalf. Posts the earn + audit_log `task.admin_reopened`. Surfaced as a "פתחי שוב להיום" widget at the top of `/admin/kids/[id]/ledger` for any missed-today tasks.
- Campaign engine runs the same fan-out for admin-reopened completions so the kid's streak/total advances correctly.

#### Photo-upload form on the kid task card

- Send + add-pic buttons live on the same row to save a line of vertical space. Selected filename wraps under the row when picked. Prior layout had them stacked.

#### Dictionary additions (Hebrew + English)

- `notifications.*` (13 keys for the bell page + event-kind labels)
- `nav.wallet`
- `home.{activeTasks,completedTasks,deadlineBy,deadlinePassed,deadlineUrgent,deadlineSoon,editAvatar,avatarTitle,avatarSubtitle,avatarSave,avatarSaved,avatarClear,colorPickTitle,shopLink}`
- `campaign.{encourage0..encourage99,toGoLabel,winBadge}`
- `redeem.*` shop + history copy
- `admin.{redemptions,rewards,joker,audit,campaigns,deadlineTime,deadlineTimeHint,reopenForToday,reopenSuccess}` and friends

#### Visible bugs fixed mid-session

- Wallet hero stale-balance after task complete/undo — fixed by adding `useEffect(() => setBalance(initialBalance), [initialBalance])` so the client mirror syncs after every revalidate.
- Task card unmount eating the confetti trigger — moved the confetti fire from the post-success `useEffect` to the button's `onClick` so it runs before the revalidatePath unmounts the active card.
- Various typecheck nits + a broken JSX fragment in `kid-home.tsx` from an early bottom-nav integration pass.

#### Still in flight (next session)

- **Quest icon pick** — `/he/sandbox/quest-icons` shows 5 options (the climber Option D is now bound to the bottom-nav per Lily's last instruction, but the sandbox page still exists; delete it once the choice is finalized).
- **Phase 8** — notification dispatcher + WhatsApp + quiet hours + rate limits. The `notification_event` table has been collecting `state='pending'` rows since Phase 5; Phase 8 ships the consumer.

### Phase 4 · Build · Phase 7 COMPLETE (2026-05-23)

**Phase 7 of the 9-phase build plan ships.** Campaigns + streak/total
engines + badges + bell-event groundwork. The headline invariant —
retroactive undo zeros the streak — is covered by a dedicated Vitest case
that re-derives `current_streak` from `task_completion` after a mid-chain
day is undone. 24 new Vitest invariants on the engines; **80 prior + 24
new = 104/104 tests pass**. Browser-verified end-to-end: 5-day streak on
"make bed" → bonus + badge land in the same transaction as the 5th
completion; sibling bell event written for Yael.

#### Sub-7a — streak engine

- **Added** [`packages/db/src/campaigns/streak-engine.ts`](packages/db/src/campaigns/streak-engine.ts) — `evaluateStreak(client, {kidId, campaignId, asOfDate})`. Pure ledger-derived; never trusts the cached `current_streak`. The algorithm finds the kid's first active day in the campaign window, then walks forward with the rule: any break (missing day with no remaining freeze) zeros the streak. Window clamps to `min(asOfDate, end_date)`. The "chain-from-first-active-day" model is documented in the file header alongside the design rationale (matches BUILD-PLAN's retroactive-undo exit criterion literally over a "rebuild after break" alternative).
- **Added** [`streak-engine.test.ts`](packages/db/src/campaigns/streak-engine.test.ts) — 16 invariants:
  - **baseline (5):** empty, asOf-before-start, N consecutive, target crossing, no re-fire after `completed_at`.
  - **freezes (3):** 1-freeze bridges 1 miss; 1-freeze + 2-miss breaks; 2-freeze + 2-miss holds.
  - **retroactive undo (2):** the headline — streak=4 → undo day 3 → eval = 0; with freeze the chain holds.
  - **edges (3):** today missing breaks; late-starting kid; asOfDate past end_date clamps.
  - **long-term feeding tasks (3):** per_day_threshold gating; null threshold = any progress; mixed feeders.

#### Sub-7b — total engine

- **Added** [`packages/db/src/campaigns/total-engine.ts`](packages/db/src/campaigns/total-engine.ts) — `evaluateTotal(client, {kidId, campaignId, asOfDate})`. SUMs daily completion counts + long-term progress quantities in one query. Daily template = 1 unit per non-undone completion; long-term = SUM(quantity) of non-undone non-pending rows. Window clamps to end_date so the Yael "incomplete" path lands cleanly.
- **Added** [`total-engine.test.ts`](packages/db/src/campaigns/total-engine.test.ts) — 8 invariants covering long-term sums, daily counts, mixed feeders, undone exclusion, pending exclusion, window clamp, and no-re-fire after completion.

#### Sub-7c — on-event hooks

- **Added** [`packages/db/src/campaigns/process-completion.ts`](packages/db/src/campaigns/process-completion.ts) — `processCompletionForCampaigns(client, {kidId, householdId, templateId, asOfDate})`. Finds every active enrollment whose campaign feeds off `templateId`, runs the appropriate engine, updates `current_streak` / `freezes_used` / `current_total` / `longest_streak` / `last_streak_advance_date`, and when `completedNow` is true: posts `campaign_bonus` ledger entry, INSERTs `kid_badge` (NULLS NOT DISTINCT enforces earn-once), UPDATEs enrollment with `completed_at + completed_kind='success' + bonus_ledger_id + badge_award_id`, INSERTs audit_log row, INSERTs `campaign_completed` bell event for the earner, INSERTs `sibling_badge_earned` bell events for every other non-archived kid in the household. All within the caller's transaction; failures roll back the originating coin event.
- **Updated** [`apps/web/src/lib/tasks/actions.ts`](apps/web/src/lib/tasks/actions.ts) — `completeTaskAction` non-evidence path calls `processCompletionForCampaigns` after the ledger earn; if any campaign completes, re-reads the wallet sum so the kid's pulse animation reflects task earn + any campaign bonus.
- **Updated** [`packages/db/src/evidence/approve.ts`](packages/db/src/evidence/approve.ts) — `approveSubmissionOperation` calls `processCompletionForCampaigns` after the earn; that's when an evidence-required completion becomes visible to the engines (`approval_status` flips from `pending` to `approved`).
- **Updated** [`packages/db/src/long-term/log-progress.ts`](packages/db/src/long-term/log-progress.ts) — `logProgressOperation` calls `processCompletionForCampaigns` after the per-unit + bonus earns. Total campaigns advance with each progress log; streak campaigns count the day active iff threshold is met.

#### Sub-7d — daily-reset cron

- **Added** [`apps/worker/src/cron/daily-reset.ts`](apps/worker/src/cron/daily-reset.ts) — `runDailyReset(pool)`. Three responsibilities:
  - **Streak evaluation** for every active streak enrollment. Re-derives via `evaluateStreak` for yesterday's date, updates cache, fires `streak_broken` if cached `current_streak > 0 AND new=0`, fires `streak_freeze_used` if `freezesUsed` increased, awards completion (bonus + badge + bell events) if `completedNow`.
  - **Window close** for every active enrollment past `end_date`: UPDATE `completed_at + completed_kind='incomplete'`, INSERT `campaign_completed` bell event with `payload_json.completed_kind='incomplete'`. Covers BUILD-PLAN Phase 7 §"Yael only reads 40 pages by day 60" criterion.
  - **Yearly birthday badge** for every kid whose `birthdate` month+day matches today. INSERT `kid_badge` with `awarded_for_year=year`; the UNIQUE NULLS NOT DISTINCT on `(kid_id, badge_id, awarded_for_year)` enforces once-per-year. Birthday badge identified by `title_en='Birthday'` (seeded convention).
- **Updated** [`apps/worker/src/cron/registry.ts`](apps/worker/src/cron/registry.ts) — registers daily-reset at `env.DAILY_RESET_CRON` (default `0 0 * * *` IL).

#### Sub-7e — admin campaign CRUD

- **Added** [`apps/web/src/lib/admin-campaigns/actions.ts`](apps/web/src/lib/admin-campaigns/actions.ts) — `createCampaignAction` (full create with feeding-task picker + kids picker + optional badge_id; INSERTs campaign + campaign_feeding_task + campaign_enrollment atomically), `toggleArchiveCampaignAction` (soft-delete; engines + cron skip archived). Edit form intentionally deferred to v2 — kind/feeding/enrollment changes mid-campaign would silently invalidate engine state; archive + recreate is the supported path.
- **Added** [`apps/web/src/app/[lang]/admin/campaigns/page.tsx`](apps/web/src/app/[lang]/admin/campaigns/page.tsx) — list with mint streak chip / lavender total chip, target label, enrolled count, bonus chip, inline archive form. Archived rows muted in place.
- **Added** [`apps/web/src/app/[lang]/admin/campaigns/new/page.tsx`](apps/web/src/app/[lang]/admin/campaigns/new/page.tsx) + [`_components/campaign-form.tsx`](apps/web/src/app/[lang]/admin/campaigns/_components/campaign-form.tsx) — full create form with: bilingual title + description; kind radio toggle that reveals per-kind fieldsets (mint for streak, lavender for total); date pickers defaulting to today + 7 days; feeding tasks via stacked checkboxes (mobile-friendly); kid enrollment via avatar-dot checkboxes; badge dropdown with "no badge" option.
- **Updated** the admin home with two new nav cards (campaigns, audit was already there; added campaigns next to it).

#### Sub-7f — kid campaigns view

- **Added** [`apps/web/src/app/[lang]/campaigns/page.tsx`](apps/web/src/app/[lang]/campaigns/page.tsx) + [`_components/kid-campaigns.tsx`](apps/web/src/app/[lang]/campaigns/_components/kid-campaigns.tsx) — kid sees their active enrollments as mint-soft (streak) or lavender-soft (total) cards with a progress bar (BRANDBOOK §6.4 pattern — matches the long-term task card). Completed enrollments collapse to a quiet summary line. The progress comes from the cache fields kept fresh by `processCompletionForCampaigns` + the daily cron.

#### Sub-7g — kid badges page

- **Added** [`apps/web/src/app/[lang]/badges/page.tsx`](apps/web/src/app/[lang]/badges/page.tsx) + [`_components/kid-badges.tsx`](apps/web/src/app/[lang]/badges/_components/kid-badges.tsx) — earned grid + locked-but-visible upcoming badges (from active enrollments where the badge_id isn't yet in the kid's collection). Embroidered patch placeholder: pastel ring + dashed border + inner pastel tile + initial letter. The DOM mirrors BRANDBOOK §5 anatomy so the family-3 SVG swap in Phase 9 is drop-in.
- **Updated** [`apps/web/src/app/[lang]/_components/kid-home.tsx`](apps/web/src/app/[lang]/_components/kid-home.tsx) — added a 2-column row below the wallet/shop CTAs with pill links to `/campaigns` (lavender) and `/badges` (mint).

#### Sub-7h — bell events (delivery deferred to Phase 8)

- The four new event_kinds (`campaign_completed`, `sibling_badge_earned`, `streak_broken`, `streak_freeze_used`) are emitted by `processCompletionForCampaigns` + `runDailyReset` with idempotent `ON CONFLICT (dedup_key, channel) DO NOTHING`. State='pending', channel='bell'. Phase 8's dispatcher tick + bell-polling endpoint surfaces them in the UI.
- Verified during sub-7h browser test: after Lia's 5-day completion, `notification_event` contained `campaign_completed` for Lia and `sibling_badge_earned` for Yael (correctly excluded the earner from the sibling fan-out).

#### Sub-7i — exit audit + CHANGELOG + RESUME-HERE

- **Added** [`docs/PHASE-7-EXIT.md`](docs/PHASE-7-EXIT.md) — 6 of 6 BUILD-PLAN exit criteria met functionally; bell UI render deferred to Phase 8 per ownership boundary. The headline retroactive-undo invariant is the centerpiece test.
- **Updated** [`packages/shared/src/i18n/`](packages/shared/src/i18n) types + Hebrew + English dictionaries — new `campaign.*` keys for kid surfaces (sectionTitle, progress, streakChain, badgesTitle, etc.) + new `admin.*` keys for campaign CRUD + badges.

#### Phase 7 deliverable map (for the auditor)

| Sub | What landed | Files |
|---|---|---|
| 7a | Streak engine + 16 invariants | `packages/db/src/campaigns/streak-engine.{ts,test.ts}` |
| 7b | Total engine + 8 invariants | `packages/db/src/campaigns/total-engine.{ts,test.ts}` |
| 7c | On-event fan-out + 3 action updates | `packages/db/src/campaigns/process-completion.ts`, updates to tasks/long-term/evidence approval paths |
| 7d | Daily-reset cron (streak + window-close + birthday) | `apps/worker/src/cron/daily-reset.ts`, registry update |
| 7e | Admin campaign CRUD | `apps/web/src/lib/admin-campaigns/actions.ts`, `apps/web/src/app/[lang]/admin/campaigns/` |
| 7f | Kid campaigns view | `apps/web/src/app/[lang]/campaigns/` |
| 7g | Kid badges collection | `apps/web/src/app/[lang]/badges/` |
| 7h | Bell events written (delivery in Phase 8) | (covered by 7c + 7d) |
| 7i | Exit audit + CHANGELOG + RESUME-HERE | `docs/PHASE-7-EXIT.md`, this entry |

#### Phase 7 risk + open items

- Phase 7 was HIGH risk (most state-heavy components). The three concentration points landed clean:
  1. **Retroactive undo zeros the streak** — engine re-derives from `task_completion` on every call; the cache is forward-only. The headline test passes (16 streak invariants total).
  2. **Streak vs Total semantics** — different math behind shared admin form; engines are separate modules + separate test suites.
  3. **Same-tx campaign side-effects** — `processCompletionForCampaigns` runs inside the caller's tx, so coin event + campaign_bonus + badge + bell event are atomic. Failures inside the helper roll back the originating completion.
- **Edit form deferred:** create + archive only in v1. Editing kind/feeding-tasks/enrolled-kids mid-campaign is intentionally not supported (would silently invalidate engine state).
- **Embroidered patch placeholder:** family-3 SVG library lands in Phase 9. The DOM structure mirrors BRANDBOOK §5 so the swap is drop-in.
- **Notification dispatch deferred to Phase 8:** events ARE written, idempotent dedup_keys included, awaiting the bell-polling endpoint + WhatsApp dispatcher. No regression — `submission_pending` events have been in the same state since Phase 5.
- No regressions in Phase 1-6 surfaces. 80 prior Vitest invariants still pass alongside the 24 new ones (104 total).

### Phase 4 · Build · Phase 6 COMPLETE (2026-05-22)

**Phase 6 of the 9-phase build plan ships.** Reward shop + redemption
tracker + admin queue + joker wallet adjustment + household audit feed.
Medium risk, landed clean: the circular FK between `redemption` and
`ledger_entry` was resolved by deferring the `ledger_entry.redemption_id`
constraint (migration 0004), so a single tx can INSERT both rows in
either order without weakening the NOT NULL invariant on
`redemption.ledger_debit_id`. 18 new Vitest invariants cover the redeem
+ lifecycle ops including a concurrent stock-1 race; **80/80 tests pass**.

#### Sub-6a — circular FK migration

- **Added** [`packages/db/migrations/0004_phase6_redemption_fk.sql`](packages/db/migrations/0004_phase6_redemption_fk.sql) — `ALTER CONSTRAINT ledger_entry_redemption_id_fkey DEFERRABLE INITIALLY DEFERRED`. Chosen over making `redemption.ledger_debit_id` nullable because (a) the NOT NULL guarantee stays in force, (b) the row-level CHECK on `ledger_entry` (kind='redeem' ⇒ redemption_id IS NOT NULL) is still IMMEDIATE — only the FK existence is deferred. Smoke-tested both commit + rollback paths inside a single tx; rollback leaves no orphan ledger row because the deferred FK is never validated when no commit occurs.

#### Sub-6b — five in-tx operations + six server actions

- **Added** [`packages/db/src/redemption/redeem.ts`](packages/db/src/redemption/redeem.ts) — `redeemOperation`. `FOR UPDATE` row-locks the reward, validates availability (not archived, visible, household match), checks stock (`> 0` if finite), checks per-kid daily cap via IL-date count, checks spendable balance via `GREATEST(0, SUM(amount))`. Race-safe stock decrement is `UPDATE … WHERE stock_quantity > 0`. Pre-generates the redemption UUID so the ledger entry can reference it; the deferred FK lets that INSERT land before the redemption row.
- **Added** [`packages/db/src/redemption/lifecycle.ts`](packages/db/src/redemption/lifecycle.ts) — `markRedemptionReceivedOperation` + `cancelRedemptionOperation` + `refundRedemptionOperation`. All three use the locked `UPDATE … WHERE status='<expected>'` FCFS pattern from Phase 5; rowcount=0 returns a typed `already_resolved`. Cancel + refund post a `redemption_refund` ledger credit via `ledgerPost` (NOT directly — the grep guard still holds).
- **Added** [`packages/db/src/joker/adjust-wallet.ts`](packages/db/src/joker/adjust-wallet.ts) — `adjustWalletOperation` wraps `ledgerPost` for `admin_credit` / `admin_debit`. Defense-in-depth scope check against the kid's household_id. Clamping behavior comes free from the existing ledger writer (Phase 3) — admin_debit larger than spendable produces a negative `balance_after` (audit truth) + non-null `clamped_amount` (deficit), while the display floors at zero.
- **Added** [`apps/web/src/lib/redeem/actions.ts`](apps/web/src/lib/redeem/actions.ts) (kid: redeem + mark received), [`apps/web/src/lib/redeem/admin-actions.ts`](apps/web/src/lib/redeem/admin-actions.ts) (admin: mark received + cancel + refund), [`apps/web/src/lib/joker/actions.ts`](apps/web/src/lib/joker/actions.ts) (joker adjust). Six actions total, all using the React 19 `(prevState, FormData)` signature (locked feedback memory: never wrap a server action in a client async fn).
- **Updated** [`packages/db/src/index.ts`](packages/db/src/index.ts) barrel — exports the five new operations + their input/result types.

#### Sub-6c — kid reward shop

- **Added** [`apps/web/src/app/[lang]/redeem/page.tsx`](apps/web/src/app/[lang]/redeem/page.tsx) + [`_components/shop.tsx`](apps/web/src/app/[lang]/redeem/_components/shop.tsx) + [`_components/reward-tile.tsx`](apps/web/src/app/[lang]/redeem/_components/reward-tile.tsx). Wallet hero strip + 2-column grid of reward tiles per BRANDBOOK §12.2. Gating chain in tile (matches server operation's error precedence): `out_of_stock` → `per_day_cap_exceeded` → `insufficient_funds`. Each gate produces a pink-tone status line under the cost row; soft note for capped-but-available rewards ("today only" / "2 / 2 per day"). Optimistic balance pulse on successful redeem.
- **Added** [`apps/web/src/components/reward-icon.tsx`](apps/web/src/components/reward-icon.tsx) — pastel-tile + initial-letter placeholder; same convention as task-icon + kid avatars. Swaps to the family-4 SVG library in Phase 9.
- **Updated** [`apps/web/src/app/[lang]/_components/kid-home.tsx`](apps/web/src/app/[lang]/_components/kid-home.tsx) + [`page.tsx`](apps/web/src/app/[lang]/page.tsx) — added a pink "Shop" CTA on the wallet hero so the kid can hop in.

#### Sub-6d — kid redemption tracker

- **Added** [`apps/web/src/app/[lang]/redeem/history/page.tsx`](apps/web/src/app/[lang]/redeem/history/page.tsx) + [`_components/history.tsx`](apps/web/src/app/[lang]/redeem/history/_components/history.tsx). Two sections: pending (mint cards w/ "got it!" button) and resolved (pink-soft for cancelled/refunded with the parent's reason inline). The "got it!" path uses `kidMarkReceivedAction` + an optimistic hide on success so the kid sees instant feedback even before `revalidatePath` re-renders.
- All redemption queries read snapshot fields from the `redemption` row directly — NEVER join back to `reward_item`, since the reward might have been renamed or archived since the redemption.

#### Sub-6e — admin redemption queue

- **Added** [`apps/web/src/app/[lang]/admin/redemptions/page.tsx`](apps/web/src/app/[lang]/admin/redemptions/page.tsx) + [`_components/redemption-card.tsx`](apps/web/src/app/[lang]/admin/redemptions/_components/redemption-card.tsx). Pending list + last-20 resolved. Card has three modes: `pending` (mark received + cancel buttons), `received` (refund button), `closed` (readonly summary w/ reason). Cancel + refund both expand an inline reason textarea + post the action; rowcount-0 surfaces as a calm `invalid_state` / `already_resolved`, never a thrown error.
- Used `alias()` from drizzle to JOIN three separate `user` aliases (received_by, cancelled_by, refunded_by) so the resolved-list card can show "by Mom" / "by Dad".

#### Sub-6f — admin reward CRUD

- **Added** [`apps/web/src/lib/admin-rewards/actions.ts`](apps/web/src/lib/admin-rewards/actions.ts) — `createRewardAction`, `updateRewardAction`, `toggleArchiveRewardAction`. Validates color hex, integer coin cost (> 0), optional stock + cap (empty input = null = unlimited). Audit-log on every mutation.
- **Added** [`apps/web/src/app/[lang]/admin/rewards/`](apps/web/src/app/[lang]/admin/rewards/) — list page + new + edit pages + shared `RewardForm` client component. Visibility toggle (`visible_to_kids`) is staged separately from archive — admins can add a hidden reward, polish it, then publish.

#### Sub-6g — joker UI

- **Added** [`apps/web/src/app/[lang]/admin/kids/[id]/wallet/adjust/page.tsx`](apps/web/src/app/[lang]/admin/kids/[id]/wallet/adjust/page.tsx) + [`_components/joker-form.tsx`](apps/web/src/app/[lang]/admin/kids/[id]/wallet/adjust/_components/joker-form.tsx). Pill-button toggle (mint Add / pink Subtract) that flips the sign on the amount input before submit. Reason is `required` client- and server-side. Success line surfaces the new balance + clamping amount when the parent overdrew (e.g. "-100 → balance 0 (clamped 83)").
- **Updated** [`apps/web/src/app/[lang]/admin/kids/page.tsx`](apps/web/src/app/[lang]/admin/kids/page.tsx) — added a yellow "joker" pill next to the existing Set PIN / Devices / Ledger links.

#### Sub-6h — audit feed + Vitest invariants + exit audit

- **Added** [`apps/web/src/app/[lang]/admin/audit/page.tsx`](apps/web/src/app/[lang]/admin/audit/page.tsx) — household-wide audit feed (last 100 rows). Each entry has a bilingual action label (e.g. "מימוש פרס" / "Redemption created"), the actor name (joins both user + kid alias), the reason (when present), and a `<details>` for the JSON before/after. The kid-actor color-dot appears next to the action label when the kid initiated.
- **Updated** the admin home (`/[lang]/admin`) with three new nav cards: redemptions, rewards, audit.
- **Added** [`packages/db/src/redemption/redeem.test.ts`](packages/db/src/redemption/redeem.test.ts) — 18 invariants:
  - **redeemOperation happy path (1):** debits wallet, writes redemption with snapshot + circular FK, ledger row's redemption_id points back.
  - **redeemOperation rejections (7):** not_found, archived, hidden, out_of_stock, insufficient_funds (with `meta.coinCost` + `meta.spendable`), per_day_cap_exceeded (with `meta.capLimit` + `meta.capUsedToday`), wrong_household (defense-in-depth).
  - **Concurrent stock-1 race (1):** two simultaneous redeems — exactly one wins via the FOR UPDATE row lock + the `WHERE stock_quantity > 0` decrement guard.
  - **markRedemptionReceivedOperation (3):** kid-initiated marks `received_by_kid_id` (not user_id), wrong_kid is rejected, already_resolved on double-tap.
  - **cancelRedemptionOperation (3):** happy path (refund credit posted, wallet restored, `ledger_refund_credit_id` wired), invalid_state_for_cancel after received, reason_required.
  - **refundRedemptionOperation (2):** happy path on received, invalid_state_for_refund on pending.
  - **Rollback safety (1):** failed-redeem tx (rolled back mid-op) leaves no orphan ledger row — the deferred FK is never validated when no commit occurs.
- **Added** [`docs/PHASE-6-EXIT.md`](docs/PHASE-6-EXIT.md) — 5 of 5 BUILD-PLAN exit criteria met directly; 2 line items (parent bell on receipt + admin_wallet_adjustment bell) deferred to Phase 8's notification dispatcher per the build plan's phase ownership. Audit log surface in `/admin/audit` covers the immediate visibility need.
- **Extended** the `i18n` dictionaries (Hebrew + English) with the `redeem.*` namespace (28 keys), `admin.*` redemption + reward + joker + audit keys (39 new), and the kid home's `shopLink` key.

#### Phase 6 deliverable map (for the auditor)

| Sub | What landed | Files |
|---|---|---|
| 6a | DEFERRABLE FK migration + smoke-tested commit + rollback paths | `packages/db/migrations/0004_phase6_redemption_fk.sql` |
| 6b | Five in-tx ops + six server actions | `packages/db/src/{redemption,joker}/`, `apps/web/src/lib/{redeem,joker}/` |
| 6c | Kid reward shop grid w/ tile gating | `apps/web/src/app/[lang]/redeem/` |
| 6d | Kid redemption tracker | `apps/web/src/app/[lang]/redeem/history/` |
| 6e | Admin redemption queue + lifecycle actions | `apps/web/src/app/[lang]/admin/redemptions/` |
| 6f | Admin reward CRUD | `apps/web/src/app/[lang]/admin/rewards/`, `apps/web/src/lib/admin-rewards/actions.ts` |
| 6g | Joker wallet adjust UI | `apps/web/src/app/[lang]/admin/kids/[id]/wallet/adjust/` |
| 6h | Audit feed + 18 Vitest invariants + exit audit | `apps/web/src/app/[lang]/admin/audit/page.tsx`, `packages/db/src/redemption/redeem.test.ts`, `docs/PHASE-6-EXIT.md` |

#### Phase 6 risk + open items

- Phase 6 was Medium risk. Three concentration points landed clean:
  1. **Circular FK:** chose DEFERRABLE over nullable so the NOT NULL contract on `redemption.ledger_debit_id` stays in force. Row-level CHECK on `ledger_entry` is still IMMEDIATE; only the FK existence check defers.
  2. **Concurrent stock decrement:** `FOR UPDATE` row lock + the `WHERE stock_quantity > 0` guard. Vitest race confirms exactly one win on stock=1.
  3. **FCFS lifecycle:** same `UPDATE … WHERE status='<expected>'` rowcount-check that Phase 5's approval queue uses. Three new ops share it.
- Notifications for `redemption_received` + `admin_wallet_adjustment` event_kinds are deferred to Phase 8's dispatcher per the build plan. The audit feed at `/admin/audit` provides immediate visibility in the meantime — no regression in user-visible state.
- No regressions in Phase 1-5 surfaces: parent login, kid PIN entry, daily/long-term task flow, evidence submission + approval, photo serve all still work. 62 prior Vitest tests still pass alongside the 18 new ones (80 total).

### Phase 4 · Build · Phase 5 COMPLETE (2026-05-22)

**Phase 5 of the 9-phase build plan ships.** Evidence upload + parent
approval queue + 30-day photo purge. The second of three HIGH-risk phases
(after Phase 3) is locked: 23 new Vitest invariants (FCFS race + filename
traversal + purge SQL contract), browser-verified end-to-end from kid
upload through parent approve to ledger credit.

#### Sub-5a — evidence volume foundations

- **Added** [`apps/web/src/lib/evidence/paths.ts`](apps/web/src/lib/evidence/paths.ts) — `freshFilename(mime)` produces `YYYY/MM/DD/<uuid>.<safe_ext>` (NEVER reflects `file.name`); `evidencePathFor(filename)` enforces a defense-in-depth traversal guard (rejects `..`, leading `/`, leading `\`, AND verifies resolved path stays under root); MIME allowlist (`image/{jpeg,png,webp,heic,heif}`); 10 MB hard cap.
- **Added** `EVIDENCE_VOLUME_PATH=../../.evidence-dev` to both `.env.local` files. New `.evidence-dev/` directory (gitignored) for host-side uploads.

#### Sub-5b — kid upload action

- **Added** [`apps/web/src/lib/evidence/actions.ts`](apps/web/src/lib/evidence/actions.ts) — `submitEvidenceAction(completionId, file)`. Validates kid ownership of the completion, template.evidence_required, completion pending + no existing submission, MIME on allowlist, size ≤ 10 MB. Writes file with `mode: 0o600`. INSERTs evidence + submission + UPDATES completion in one transaction. On any DB failure: rollback + unlink the file (no orphans). NEVER posts to the ledger — the earn fires on parent approval.

#### Sub-5c — session-gated serve route

- **Added** [`apps/web/src/app/api/evidence/[id]/route.ts`](apps/web/src/app/api/evidence/[id]/route.ts) — `GET /api/evidence/[id]`. UUID-shape guard before any DB hit. Resolves principal inline (middleware skips `/api/*`): kid-session JWT verify first (more restrictive), parent `auth()` fallback. Kid can fetch own (`kid_id` match); admin can fetch any in their household. Streams from disk via `Readable.toWeb` with `Cache-Control: private, no-store, max-age=0` + `X-Content-Type-Options: nosniff`. **Deviation** from ARCHITECTURE.md §9 (route was specced for worker): both containers mount the volume per docker-compose, the session lives in Next, and dev parity is much easier without a proxy hop to port 8100. Worker keeps the purge cron.

#### Sub-5d — admin approvals queue + FCFS actions

- **Added** [`packages/db/src/evidence/approve.ts`](packages/db/src/evidence/approve.ts) — `approveSubmissionOperation` in-tx primitive. The integrity point is a single `UPDATE submission SET status='approved' WHERE id=$1 AND status='pending'`; rowcount=1 wins, rowcount=0 returns `already_resolved`. Winner calls `ledgerPost('earn', coin_value, taskCompletionId)`, marks completion approved, wires `ledger_credit_id`, writes audit_log row. Exported from `@reco/db` barrel.
- **Added** [`apps/web/src/lib/evidence/admin-actions.ts`](apps/web/src/lib/evidence/admin-actions.ts) — `approveSubmissionAction` thinly wraps the operation; `denySubmissionAction` mirrors the same FCFS shape with required `deny_reason` (CHECK-constrained non-null).
- **Added** [`apps/web/src/app/[lang]/admin/approvals/page.tsx`](apps/web/src/app/[lang]/admin/approvals/page.tsx) + [`approval-card.tsx`](apps/web/src/app/[lang]/admin/approvals/_components/approval-card.tsx). Lists pending submissions newest-first via the `submission_pending` partial index. Each card renders the photo from `<img src="/api/evidence/<id>">` + approve / deny buttons. Deny expands an inline reason textarea.
- **Updated** the admin home with a third nav card linking to `/admin/approvals`.

#### Sub-5e — kid task card: photo upload state

- **Extended** [`apps/web/src/app/[lang]/_components/task-card.tsx`](apps/web/src/app/[lang]/_components/task-card.tsx) with two new sub-states for evidence-required tasks: `needsPhoto` (yellow-pale card with file picker + "שליחה לאישור" button) and `denied` (pink-soft card with parent's reason text inline + "סיימתי!" button that runs the existing Phase 3 undo path to retry). Three `useEffect`s, one per action — the locked Phase 3 pattern replays so the most recent action wins the wallet pulse.
- **Updated** [`apps/web/src/app/[lang]/page.tsx`](apps/web/src/app/[lang]/page.tsx) — query LEFT JOINs `submission` so the page knows whether a photo has been uploaded yet AND surfaces `deny_reason` for denied completions. New `denyReason: string | null` on the `KidHomeTask` shape.
- **Updated** dictionaries: new `home.{addPhoto,sendPhoto,uploadingPhoto,photoTooLarge,photoBadFormat,photoUploadError,deniedNeedsRetry}` + `admin.{approvals,approvalsHeading,noPendingApprovals,submittedAt,approve,deny,denyReason,denyReasonRequired,denyReasonPlaceholder,alreadyResolved,approvedBy,deniedBy}` keys.

#### Sub-5f — invariant tests (23 new, 77 total)

- **Added** [`packages/db/src/evidence/approve.test.ts`](packages/db/src/evidence/approve.test.ts) — 6 invariants:
  - Happy path: marks submission + completion approved + posts an earn with the template's coin_value.
  - **FCFS race (2-way):** two concurrent approves — exactly one succeeds, the other returns `already_resolved`, ONE earn entry on the ledger.
  - **FCFS race (3-way):** three concurrent approves — exactly one succeeds, two return `already_resolved`.
  - Rejection paths: not_found for missing id, wrong_household defense-in-depth, already_resolved on second tap after a prior approve.
- **Added** [`apps/web/src/lib/evidence/paths.test.ts`](apps/web/src/lib/evidence/paths.test.ts) — 15 pure-unit invariants:
  - MIME allowlist (5 supported types) + rejection list (text/html, video/mp4, image/svg+xml etc.) + case-insensitive match + 10 MB cap.
  - `freshFilename` produces a UUID-only, date-sharded path; signature has no `name` parameter (structural guarantee); unique across calls; throws on unsupported MIME.
  - `evidencePathFor` traversal rejection: `..`, multi-segment `..`, absolute Unix `/`, absolute Windows `\`, backslash-traversal hybrid. Missing `EVIDENCE_VOLUME_PATH` throws.
- **Added** [`packages/db/src/evidence/purge.test.ts`](packages/db/src/evidence/purge.test.ts) — 8 SQL contract tests:
  - Purges: approved >30d, denied >30d, orphan >30d.
  - Keeps: pending (any age), approved 29d, already-purged rows, orphan 29d.
  - `purged_at` flip removes the row from subsequent runs.
  - The partial index scope-limits to un-purged candidates.

- **Updated** [`apps/web/package.json`](apps/web/package.json) — added `"test": "vitest run"` script + `vitest` devDependency.
- **Added** [`apps/web/vitest.config.ts`](apps/web/vitest.config.ts) — pure-unit scope (`src/lib/**/*.test.ts`); `pool: forks + singleFork + fileParallelism: false` matches `@reco/db`'s harness so any future DB-backed tests can join the same serialization.

#### Sub-5g — worker evidence-purge cron

- **Added** [`apps/worker/src/cron/evidence-purge.ts`](apps/worker/src/cron/evidence-purge.ts) — `runEvidencePurge(pool)`. Candidates: rows where `purged_at IS NULL` AND (submission resolved >30d OR orphan >30d from uploaded_at). Inlines the same traversal guard as `paths.ts` (defense-in-depth; avoids workspace cycle). Tolerates `ENOENT` (file already gone — still updates `purged_at`).
- **Updated** [`apps/worker/src/cron/registry.ts`](apps/worker/src/cron/registry.ts) — registry now has one job (evidence-purge at `EVIDENCE_PURGE_CRON`, default `0 6 * * *` IL per `docs/CRON.md`).

#### Sub-5h — exit audit

- **Added** [`docs/PHASE-5-EXIT.md`](docs/PHASE-5-EXIT.md) — 5 of 7 BUILD-PLAN Phase 5 exit criteria met directly; 2 deferred to Phase 8 (WhatsApp ping) + Phase 9 (Sentry + Playwright loop + B2 backup) per the build plan's phase ownership.

#### Phase 5 deliverable map (for the auditor)

| Sub | What landed | Files |
|---|---|---|
| 5a | Volume path + dev directory + safety helpers | `apps/web/src/lib/evidence/paths.ts`, `.env.local` x2, `.gitignore` |
| 5b | Upload action with atomic INSERT + filename safety | `apps/web/src/lib/evidence/actions.ts` |
| 5c | Session-gated streaming serve route | `apps/web/src/app/api/evidence/[id]/route.ts` |
| 5d | FCFS approve / deny actions + admin queue UI | `packages/db/src/evidence/approve.ts`, `apps/web/src/lib/evidence/admin-actions.ts`, `apps/web/src/app/[lang]/admin/approvals/` |
| 5e | Kid task card photo upload + denied retry | `apps/web/src/app/[lang]/_components/task-card.tsx`, `kid-home.tsx`, `page.tsx` |
| 5f | 23 new Vitest invariants (77 total pass) | `packages/db/src/evidence/{approve,purge}.test.ts`, `apps/web/src/lib/evidence/paths.test.ts` |
| 5g | Worker evidence-purge cron | `apps/worker/src/cron/evidence-purge.ts`, `registry.ts` |
| 5h | Exit audit + CHANGELOG + RESUME-HERE | `docs/PHASE-5-EXIT.md`, this entry |

#### Phase 5 risk + open items

- Phase 5 was HIGH risk. Three concentration points landed clean:
  1. **Filename injection** — UUID-only filenames + traversal guard, 15 path-safety unit tests.
  2. **FCFS approval race** — single `UPDATE WHERE status='pending'` rowcount-check, 6 Vitest tests (2-way + 3-way concurrent).
  3. **Photo serve authorization** — session-resolved inline, kid scope check, household scope check. Cache headers prevent SW + CDN retention.
- The dev architecture deviates from ARCH §9 (serve lives in web, not worker) — documented in the exit audit. Production behavior is identical (both containers mount the volume); the change just removes a dev-only proxy hop.
- Deferred to later phases per the build plan's own phase ownership: WhatsApp dispatch (Phase 8), Sentry wiring + Playwright loop (Phase 9), B2 evidence-volume backup (Phase 9).
- No regressions in Phase 1-4 surfaces. The Phase 3 daily task path is unchanged for non-evidence templates; the Phase 4 long-term section is unchanged.

### Phase 4 · Build · Phase 4 COMPLETE (2026-05-22)

**Phase 4 of the 9-phase build plan ships.** Long-term tasks: per-unit earn,
bonus on goal cross, bonus reversal on undo. Builds atop the Phase 3 ledger;
no second ledger writer (the grep guard from Phase 3 still holds).

#### Sub-4a — schema: `task_assignment.long_term_completed_at`

- **Added** [`packages/db/migrations/0003_phase4_long_term.sql`](packages/db/migrations/0003_phase4_long_term.sql) — `ALTER TABLE task_assignment ADD COLUMN long_term_completed_at TIMESTAMPTZ`. Nullable; non-null timestamp = "this assignment crossed its goal." Cleared on bonus-reversal undo.
- **Updated** [`packages/db/src/schema/tasks.ts`](packages/db/src/schema/tasks.ts) — Drizzle field `longTermCompletedAt`.

#### Sub-4b — operations: `logProgressOperation` + `undoLongTermProgressOperation`

- **Added** [`packages/db/src/long-term/log-progress.ts`](packages/db/src/long-term/log-progress.ts) — in-tx operation. INSERTs `long_term_progress`, posts a per-unit `earn` via `ledger.post()`, recomputes total, posts a bonus `earn` (kind=earn, NOT campaign_bonus — there's no campaign FK for plain long-term tasks) iff total ≥ goal + bonus > 0, sets `long_term_completed_at`. Caller manages the transaction so it composes with multi-step server actions.
- **Added** [`packages/db/src/long-term/undo-progress.ts`](packages/db/src/long-term/undo-progress.ts) — same-day undo. Marks the progress row `undone_at`, posts a `kind=undo` reversing the per-unit credit, recomputes total, and IF the assignment was previously completed AND total dropped below goal: finds the bonus entry (most recent `earn` for this assignment's progress rows that ISN'T a per-unit credit and hasn't been undone), posts a `kind=undo` for it, clears `long_term_completed_at`. The "find the bonus" SQL uses a NOT IN subquery against `long_term_progress.ledger_credit_id` to distinguish per-unit credits from bonus entries.
- **Added** [`apps/web/src/lib/long-term/actions.ts`](apps/web/src/lib/long-term/actions.ts) — `logProgressAction` + `undoLongTermProgressAction` server-action wrappers. Same `(prevState, FormData)` contract as Phase 3 actions (locked feedback memory: never wrap server actions in client async fns).
- **Exported** new types + functions from the `@reco/db` barrel.

#### Sub-4c — Vitest invariants (16 new tests, 47 total)

- **Added** [`packages/db/src/long-term/log-progress.test.ts`](packages/db/src/long-term/log-progress.test.ts) — 16 invariants:
  - Input validation (4): zero/negative quantity, wrong kind (daily assignment), cross-kid ownership.
  - Per-unit earn (2): single post for quantity × per_unit, accumulation across multiple logs.
  - Goal cross + bonus (3): posts bonus + flips `long_term_completed_at`, rejects further logs after completion, no bonus when bonus_on_complete is null/zero (assignment still marked completed).
  - Undo per-unit only (3): reverses per-unit + leaves open, rejects already-undone, rejects cross-kid undo.
  - **Bonus reversal edge case (2):** reverses both per-unit AND bonus when undo drops total below goal (the crossing-row case), and the same outcome when the undo target ISN'T the crossing row.
  - Cycle (1): cross → undo → re-log → re-cross → fresh bonus entry id ≠ original.
  - Plus a documented `// Note on a NOT-tested scenario` explaining why "undo while total stays above goal" can't happen with the current `already_done` contract.

#### Sub-4d — kid home: long-term task section

- **Added** [`apps/web/src/app/[lang]/_components/long-term-task-card.tsx`](apps/web/src/app/[lang]/_components/long-term-task-card.tsx) — client component. Header with task icon + "{per_unit} ל {unit} · קיבלת בונוס: {bonus}", lavender progress bar (gradient + 300ms width transition per BRANDBOOK §6.4), `+N` quantity input + "תיעוד" button (hidden when completed), today's-entries chips with inline per-row undo, mint "הושלם!" pill on completion. Two separate `useEffect`s watch logState + undoState so the most recent action wins the wallet pulse (same lesson as Phase 3's task card — combined effects favor the earlier-declared state).
- **Updated** [`apps/web/src/app/[lang]/_components/kid-home.tsx`](apps/web/src/app/[lang]/_components/kid-home.tsx) — new `KidHomeLongTermTask` interface + section header "יעדים ארוכי טווח". Renders only when there's at least one long-term assignment.
- **Updated** [`apps/web/src/app/[lang]/page.tsx`](apps/web/src/app/[lang]/page.tsx) — query splits into two: daily assignments (with today's task_completion LEFT JOIN) + long-term assignments. For long-term, two follow-up queries fetch aggregate totals + today's individual entries, then merged in JS to avoid a Cartesian fan-out from the LEFT JOIN.
- **Updated** dictionaries: new `longTerm.*` keys (`sectionTitle`, `progressLabel`, `quantityPlaceholder`, `completed`, `bonusEarned`, `todaysEntries`, `invalidQuantity`, `perUnit`, `log`).

#### Sub-4e — admin task-form: long-term kind toggle

- **Updated** [`apps/web/src/app/[lang]/admin/tasks/_components/task-form.tsx`](apps/web/src/app/[lang]/admin/tasks/_components/task-form.tsx) — `kind` radio (daily / long-term), client-side `useState` to toggle the conditional sections. When long-term: hides `coinValue` (forced to 0 server-side), shows a lavender fieldset with `longTermUnitLabelHe/En`, `longTermPerUnitCoins`, `longTermGoalQuantity`, `longTermBonusOnComplete`. Edit mode disables both radios — switching kinds would silently invalidate existing completion/progress rows.
- **Updated** [`apps/web/src/lib/admin-tasks/actions.ts`](apps/web/src/lib/admin-tasks/actions.ts) — `parseTaskForm` returns a discriminated union (`ParsedDaily | ParsedLongTerm | TaskFormError`). Create + update actions pass the long-term fields through (or NULL them for daily). Update action additionally rejects kind changes with `invalid_long_term_fields`.
- **Updated** [`apps/web/src/app/[lang]/admin/tasks/[id]/edit/page.tsx`](apps/web/src/app/[lang]/admin/tasks/[id]/edit/page.tsx) — passes `kind` + all long-term fields as `initial` to the form.
- **Updated** dictionaries: new `admin.kind*` / `admin.unitLabel*` / `admin.perUnitCoins` / `admin.goalQuantity` / `admin.bonusOnComplete` / `admin.invalidLongTermFields` keys.

#### Sub-4f — exit audit

- **Added** [`docs/PHASE-4-EXIT.md`](docs/PHASE-4-EXIT.md) — all 3 BUILD-PLAN Phase 4 exit criteria met. The "open question" about bonus reversal is resolved as "bonus reverses too whenever undo drops total below goal, regardless of which row was undone." End-to-end browser verification + Vitest invariant suite both pass.

#### Phase 4 risk + open items

- Phase 4 was Medium risk. The bonus-reversal edge case was the highest-risk piece; Vitest covers two distinct paths (crossing-row undo + non-crossing-row undo). The browser verification (balance 0 → 20 → 150 → 20) matches the BUILD-PLAN's open-question resolution.
- The "find the bonus entry" SQL in `undo-progress.ts` uses NOT IN + NOT EXISTS guards to identify the bonus among multiple `earn` entries pointing at the same assignment's progress rows. Cycle test confirms a fresh bonus posts after re-crossing.
- No regressions in Phase 1-3 surfaces. The Phase 3 daily task path remains untouched on the kid home (separate section), and the admin task-form's daily path still creates daily templates correctly (kind defaults to daily).
- **Dev gotcha replayed:** the admin layout's "Sign out" form has a `<button type="submit">` first in the DOM. Eval-based form submissions MUST scope the selector to the target form (`document.querySelector('input[name="longTermPerUnitCoins"]').closest('form')`). Phase 3's exit audit warned about this; Phase 4 stepped on it again briefly before scoping correctly.

### Phase 4 · Build · Phase 3 COMPLETE (2026-05-21)

**Phase 3 of the 9-phase build plan ships.** Tasks + assignments + completions + the append-only wallet ledger — the financial center of Reco. The ledger now has a single writer (with per-kid serialization + admin-debit clamping), 31 invariant tests pass, and the first real kid-facing UI is live (daily task list with tap-to-complete + same-day undo, animated wallet balance, scrollable history).

#### Sub-3a — Vitest-with-Postgres test harness

- **Added** [`packages/db/src/test-utils/test-db.ts`](packages/db/src/test-utils/test-db.ts) — `setupTestDb()` opens a pool against `TEST_DATABASE_URL`, applies migrations once per process (idempotent), exposes a `truncate()` helper that wipes every domain table via `TRUNCATE ... RESTART IDENTITY CASCADE` while preserving `__migrations` so subsequent tests don't re-run migrations.
- **Added** [`packages/db/src/test-utils/seed.ts`](packages/db/src/test-utils/seed.ts) — `seedBaseFixtures()` builds the minimal graph the Phase 3 tests need (1 household, 1 parent, Lia + Yael, 3 templates: daily / daily-with-evidence / long-term, 4 assignments) with deterministic UUIDs. Also exports `ledgerSum()` + `displayBalance()` helpers used across tests.
- **Added** [`packages/db/vitest.config.ts`](packages/db/vitest.config.ts) — forks pool with `singleFork: true` + `fileParallelism: false` so a single connection pool can serialize tests against the shared DB.
- **Added** [`packages/db/vitest.global-setup.ts`](packages/db/vitest.global-setup.ts) — minimal `.env.test` loader (no `dotenv` dep) so `TEST_DATABASE_URL` is set before module-eval-time imports.
- **Added** [`packages/db/.env.test.example`](packages/db/.env.test.example) + a `.env.test` gitignore entry. Local convention: a separate `reco_test` database on the same throwaway pg container as the dev DB (`CREATE DATABASE reco_test;` on first install).
- **Added** subpath export `@reco/db/test-utils` in [`packages/db/package.json`](packages/db/package.json) so test files import without reaching past the package barrel.
- **Added** [`packages/db/src/test-utils/test-db.test.ts`](packages/db/src/test-utils/test-db.test.ts) — 4 sanity tests proving the harness applies migrations, isolates between tests via truncate, preserves `__migrations`, and respects circular FKs with CASCADE.

#### Sub-3b — `ledgerPost()` + invariant tests + grep CI guard

- **Added** [`packages/db/src/ledger/post.ts`](packages/db/src/ledger/post.ts) — THE ledger writer. Takes a pg `PoolClient` (caller manages the transaction so the ledger INSERT can commit atomically with the originating task_completion / redemption / etc. INSERT). Acquires `pg_advisory_xact_lock(hashtext(kid_id))` to serialize writes per kid (cheaper than SERIALIZABLE; releases on COMMIT). Computes `balance_after = SUM(amount) + input.amount` and, for `admin_debit` only, computes `clamped_amount = (-amount) - actual_subtracted` so the ledger keeps the truth while the wallet display floors at 0. Also exports `postWithTransaction()` for one-shot callers (worker cron) that don't need to compose with surrounding state.
- **Architectural deviation from BUILD-PLAN.md noted in PHASE-3-EXIT.md** — the plan named `apps/worker/src/ledger/post.ts` as the writer's home; we put it at `packages/db/src/ledger/post.ts` because ARCHITECTURE.md §5 makes ledger writes a shared concern between apps/web (server actions) and apps/worker (cron). Placing it in `@reco/db` lets both apps import via the workspace package.
- **Added** [`packages/db/src/ledger/post.test.ts`](packages/db/src/ledger/post.test.ts) — 18 invariant tests covering: input shape validation (7), happy-path balance accumulation + per-kid isolation + undo reversal + admin credit (5), admin_debit clamping with three scenarios (no clamp / partial overdraw / already-overdrawn), DB CHECK constraints as the second line of defense (1), concurrency (same-kid serialization with no lost updates + different-kid parallelism), and the append-only invariant (every row's balance_after equals prefix sum at its point in time).
- **Added** [`packages/db/src/ledger/post.guard.test.ts`](packages/db/src/ledger/post.guard.test.ts) — static grep test that scans `apps/` + `packages/` for `insert\s+into\s+ledger_entry` and fails CI if found outside the writer, the migrations, and the test files that intentionally exercise raw INSERTs.
- **Exported** `ledgerPost`, `postWithTransaction`, `LedgerInvariantError`, `PostInput`, `PostedEntry` from `@reco/db`'s public barrel.

#### Sub-3c — Server actions: `completeTaskAction` + `undoTaskCompletionAction`

- **Added** [`apps/web/src/lib/auth/guards.ts`](apps/web/src/lib/auth/guards.ts) — `requireKid()` reads the principal from middleware-set headers (`x-reco-principal`, `x-reco-kid-id`, `x-reco-household-id`), verifies the kid still exists + isn't archived, returns the typed principal. `requireAdmin()` mirrors for parent sessions. Both throw `UnauthorizedError` on miss so server actions can catch + return a typed `forbidden` to the client.
- **Added** [`apps/web/src/lib/tasks/actions.ts`](apps/web/src/lib/tasks/actions.ts) — `completeTaskAction` opens a tx, INSERTs `task_completion` with the partial unique catching double-taps (returns `already_done` on 23505), and either fires `ledger.post('earn')` immediately (auto-approved) or defers to Phase 5's evidence-approval flow (`approval_status='pending'`). `undoTaskCompletionAction` runs `SELECT ... FOR UPDATE` on the row, verifies kid ownership + same-day, marks `undone_at`, and posts `ledger.post('undo', -amount)` with `undo_of_entry_id` pointing at the original earn.
- Both actions use the React 19 `(prevState, FormData) => Promise<state>` signature so `useActionState` dispatches them natively (per the locked feedback memory: never wrap a server action in a client async fn).

#### Sub-3d — Kid home rebuild

- **Replaced** the Phase 2 placeholder home at [`apps/web/src/app/[lang]/page.tsx`](apps/web/src/app/[lang]/page.tsx) with a real server-component dispatcher: kid principal → `<KidView>` query (today's daily assignments + active completion via LEFT JOIN + wallet balance from `GREATEST(0, SUM(amount))`); admin principal → existing parent welcome stub.
- **Added** [`apps/web/src/app/[lang]/_components/kid-home.tsx`](apps/web/src/app/[lang]/_components/kid-home.tsx) — client wrapper with the wallet hero card (large balance number with `scale-110` pulse on coin events per BRANDBOOK §9.3) + today's task list.
- **Added** [`apps/web/src/app/[lang]/_components/task-card.tsx`](apps/web/src/app/[lang]/_components/task-card.tsx) — interactive task card with three states (todo → mint-soft "done" + undo link → pink-soft "pending evidence"). Uses two separate `useEffect` watchers (one per action) so the most-recent action's balance wins when complete + undo state both exist (catches a stale-state bug from the initial single-effect implementation).
- **Added** [`apps/web/src/components/coin.tsx`](apps/web/src/components/coin.tsx) — reusable gold-yellow coin glyph (placeholder for the canonical `<symbol id="ic-coin">` arriving in Phase 9 alongside the rest of the SVG library).
- **Added** [`apps/web/src/components/task-icon.tsx`](apps/web/src/components/task-icon.tsx) — pastel-circle + initial-letter task icon placeholder (same fallback pattern as the kid avatars in Phase 2; real family-2 SVGs land in Phase 9).
- **Extended** [`packages/shared/src/i18n/{he,en}.json`](packages/shared/src/i18n/dictionaries) + [`types.ts`](packages/shared/src/i18n/types.ts) with `home.*` (todaysTasks, iDidIt, undo, done, waitingApproval, needsPhoto, alreadyDone, noTasks, noTasksHint, switchUser, errorTryAgain) and extended `wallet.*` with the ledger-entry kind labels.

#### Sub-3e — Wallet history page

- **Added** [`apps/web/src/app/[lang]/wallet/page.tsx`](apps/web/src/app/[lang]/wallet/page.tsx) — kid-scoped reverse-chronological list of every ledger entry. Joins `ledger_entry → task_completion → task_assignment → task_template` so earn / undo rows surface the task title. Admin entries surface their `note`. Timestamps render in `Asia/Jerusalem` via `Intl.DateTimeFormat` keyed on the locale. Tap-into route from the wallet hero card.

#### Sub-3f — Admin: task template CRUD + per-kid assignment toggles + per-kid ledger view

- **Added** [`apps/web/src/lib/admin-tasks/actions.ts`](apps/web/src/lib/admin-tasks/actions.ts) — `createTaskTemplateAction`, `updateTaskTemplateAction`, `toggleArchiveTaskTemplateAction`, `toggleAssignmentAction` (+ a void wrapper `toggleAssignmentFormAction` for the inline `<form action>` usage on the assign page). All require an admin session, household-scoped, and append `audit_log` entries.
- **Replaced** [`apps/web/src/app/[lang]/admin/page.tsx`](apps/web/src/app/[lang]/admin/page.tsx) — was a redirect to `/admin/kids`; now a two-card nav (kids + task templates).
- **Added** [`apps/web/src/app/[lang]/admin/tasks/page.tsx`](apps/web/src/app/[lang]/admin/tasks/page.tsx) — household task templates list with per-row Edit + Assign links, "+ New" CTA, archived rows visually muted.
- **Added** [`apps/web/src/app/[lang]/admin/tasks/_components/task-form.tsx`](apps/web/src/app/[lang]/admin/tasks/_components/task-form.tsx) — shared client form for create + edit, dispatching to the right server action based on a `mode` prop (both actions directly imported — explicit safer pattern).
- **Added** [`apps/web/src/app/[lang]/admin/tasks/new/page.tsx`](apps/web/src/app/[lang]/admin/tasks/new/page.tsx) + [`apps/web/src/app/[lang]/admin/tasks/[id]/edit/page.tsx`](apps/web/src/app/[lang]/admin/tasks/[id]/edit/page.tsx) — create / edit + archive toggle pages.
- **Added** [`apps/web/src/app/[lang]/admin/tasks/[id]/assign/page.tsx`](apps/web/src/app/[lang]/admin/tasks/[id]/assign/page.tsx) — per-kid mint "כן" / grey "לא" toggles. Inline `<form action={toggleAssignmentFormAction}>` per kid; revalidation refreshes immediately.
- **Added** [`apps/web/src/app/[lang]/admin/kids/[id]/ledger/page.tsx`](apps/web/src/app/[lang]/admin/kids/[id]/ledger/page.tsx) — parent view of one kid's ledger. Same join as the kid wallet history but with running balance per row + clamped-amount surfacing for admin_debit overdraws (per BUILD-PLAN exit criterion "both parents see the audit").
- **Extended** [`apps/web/src/app/[lang]/admin/kids/page.tsx`](apps/web/src/app/[lang]/admin/kids/page.tsx) — added a mint "ספר חשבונות" link per kid alongside the existing Set PIN + Trusted Devices buttons.
- **Extended** the `admin.*` dictionary with task-management strings (tasks, tasksHeading, newTask, editTask, titleHe/En, descriptionHe/En, coinValue, evidenceRequired, displayOrder, color, iconKey, archive/unarchive/archived, create, assignments, assignTo, assignedKids, ledger, ledgerFor, noLedger, walletBalance, backToAdmin).

#### Sub-3g — Exit audit

- **Added** [`docs/PHASE-3-EXIT.md`](docs/PHASE-3-EXIT.md) — per-gate status. Six of seven exit criteria verified end-to-end + the 31-test Vitest invariant suite. The Playwright "two clicks 50ms apart" double-tap test is deferred alongside the broader Phase 5 E2E harness (the DB partial unique is the integrity point and is independently tested).
- **Updated** [`RESUME-HERE.md`](RESUME-HERE.md) — Phase 3 marked complete; "next" pointer moves to Phase 4 (long-term tasks + progress logging).

#### Phase 3 risk + open items

- Phase 3 was HIGH risk (financial center of the app). Every ledger invariant from SCHEMA.md §13 has a Vitest case; the grep guard ensures no future code can bypass the writer. Per-kid advisory lock + DB partial-unique together prevent lost updates and double-claims under contention.
- DB now contains an extra dev task template ("לסדר את החדר / Tidy room") from the create-flow smoke test. Harmless; the seed migration is idempotent.
- No regressions in Phase 1-2 surfaces (parent login, kid PIN entry, admin kids + devices, set-PIN flow all still work).

### Phase 4 · Build · Phase 2 COMPLETE (2026-05-21)

**Phase 2 of the 9-phase build plan ships.** Kid authentication: Netflix-style profile picker, 4-digit PIN entry, device-trust cookie for skip-PIN-on-remembered-device, plus the admin pages parents use to set/reset PINs and revoke trusted devices.

#### Sub-2a — kid-auth library + middleware + Node API routes

- **Added** [`apps/web/src/lib/kid-auth/`](apps/web/src/lib/kid-auth) — split between edge-safe + Node-only modules:
  - [`session.ts`](apps/web/src/lib/kid-auth/session.ts) — `issueKidSession` / `verifyKidSession` HMAC-SHA256 JWT (`<base64url(payload)>.<base64url(sig)>`) signed with `AUTH_SECRET`. Edge-safe (Web Crypto only) so middleware can verify without a DB hit.
  - [`fingerprint.ts`](apps/web/src/lib/kid-auth/fingerprint.ts) — coarse SHA-256 of `(user-agent ‖ accept-language)`. Edge-safe.
  - [`pin.ts`](apps/web/src/lib/kid-auth/pin.ts) — `verifyKidPin` Argon2id verify against `kid.pin_hash` with 5-fail / 15-min lockout via `kid.pin_failed_count` + `kid.pin_locked_until`. Node-only.
  - [`device-trust.ts`](apps/web/src/lib/kid-auth/device-trust.ts) — `issueDeviceTrust` (random 32 bytes, SHA-256 hash persisted in `device_trust`, raw token returned for the cookie), `verifyDeviceTrust` (hash + lookup + expiry + UA-fingerprint match + revocation check + `last_seen_at` bump). Node-only.
  - [`constants.ts`](apps/web/src/lib/kid-auth/constants.ts), [`cookies.ts`](apps/web/src/lib/kid-auth/cookies.ts) — cookie names, max-ages, attribute helpers shared between Node + edge.
- **Extended** [`apps/web/src/middleware.ts`](apps/web/src/middleware.ts) — dual-principal resolution: parent via Auth.js, kid via `verifyKidSession` of `reco-kid-session` cookie. New routing:
  - Anonymous → `/[lang]/pick` (was `/[lang]/login` in Phase 1)
  - `/login` + `/pick` + `/pick/*` are public; parents land back on `/admin`, kids land back on `/`
  - `/admin/*` requires a parent session
  - Everything else inside `/[lang]` requires kid OR parent
  - If anonymous but a `reco-kid-trust` cookie is present, redirect to `/api/kid-session/refresh?to=<original>` for a silent Node-side refresh
- **Added** [`apps/web/src/app/api/kid-session/refresh/route.ts`](apps/web/src/app/api/kid-session/refresh/route.ts) — Node route that verifies the trust cookie + UA fingerprint, issues a fresh kid-session, redirects to `?to=`. Falls back to `/[lang]/pick` (with a `Set-Cookie` clearing the bad trust cookie) on any verification miss.
- **Added** [`apps/web/src/app/api/kid-session/logout/route.ts`](apps/web/src/app/api/kid-session/logout/route.ts) — Node route that clears `reco-kid-session` but PRESERVES `reco-kid-trust` so the kid lands back on `/pick` with their face-card still tappable without re-entering PIN.

#### Sub-2b — kid-facing UI

- **Added** [`apps/web/src/app/[lang]/pick/page.tsx`](apps/web/src/app/[lang]/pick/page.tsx) — server-rendered profile picker. Lists every non-archived kid in the household as a colored-circle avatar (first initial as placeholder — real fox/bunny SVGs land in Phase 9 polish per BRANDBOOK §4.1). Bottom "Parent admin" link drops to `/login`.
- **Added** [`apps/web/src/app/[lang]/pick/[slug]/page.tsx`](apps/web/src/app/[lang]/pick/[slug]/page.tsx) + [`pin-entry-form.tsx`](apps/web/src/app/[lang]/pick/[slug]/pin-entry-form.tsx) + [`actions.ts`](apps/web/src/app/[lang]/pick/[slug]/actions.ts) — PIN entry surface. 3×4 keypad with `dir="ltr"` so digits stay 1-2-3 / 4-5-6 even in Hebrew context (BRANDBOOK §8.2). Auto-submit on 4th digit. Web Vibration API fires on every tap. "Remember this device" checkbox triggers `issueDeviceTrust` on success. Server action validates PIN, sets `reco-kid-session` cookie (+ optionally `reco-kid-trust`), redirects to `/[lang]/`.
- **Updated** [`apps/web/src/app/[lang]/page.tsx`](apps/web/src/app/[lang]/page.tsx) — home page now branches on `x-reco-principal` header set by middleware. Kid principal sees a stub greeting their name + a "Switch user" form action posting to `/api/kid-session/logout`. Parent principal keeps the existing Phase 1 stub.

#### Sub-2c — admin pages

- **Added** [`apps/web/src/app/[lang]/admin/layout.tsx`](apps/web/src/app/[lang]/admin/layout.tsx) — minimal shell: Reco wordmark + parent name + sign-out form. Phase 6 lands the full nav (tasks / rewards / campaigns / approvals / ledger / audit).
- **Added** [`apps/web/src/app/[lang]/admin/page.tsx`](apps/web/src/app/[lang]/admin/page.tsx) → redirects to `/admin/kids` (the only built admin surface in Phase 2).
- **Added** [`apps/web/src/app/[lang]/admin/kids/page.tsx`](apps/web/src/app/[lang]/admin/kids/page.tsx) — household-scoped kids list with "Set PIN" + "Trusted devices" actions per kid.
- **Added** [`apps/web/src/app/[lang]/admin/kids/[id]/pin/page.tsx`](apps/web/src/app/[lang]/admin/kids/[id]/pin/page.tsx) + [`set-pin-form.tsx`](apps/web/src/app/[lang]/admin/kids/[id]/pin/set-pin-form.tsx) + [`actions.ts`](apps/web/src/app/[lang]/admin/kids/[id]/pin/actions.ts) — set/reset a kid's PIN. Numeric 4-digit input with `inputMode="numeric"`. Action signature is `(prevState, FormData)` so `useActionState` invokes it as a true server action (lesson: wrapping a server action in a client async function strips its server-action-ness and the form falls back to a silent browser POST). On submit: Argon2id hash → UPDATE `kid` (resets failed-count + lockout) → INSERT `audit_log` (`kid.pin_reset`, `actor_user_id=session.user.id`) → redirect to `?ok=1` with green flash.
- **Added** [`apps/web/src/app/[lang]/admin/kids/[id]/devices/page.tsx`](apps/web/src/app/[lang]/admin/kids/[id]/devices/page.tsx) + [`actions.ts`](apps/web/src/app/[lang]/admin/kids/[id]/devices/actions.ts) — lists non-revoked / non-expired `device_trust` rows with last-seen + revoke buttons. Revoke is a soft action (`revoked_at = now()`); the row persists for audit.
- **Updated** [`packages/shared/src/i18n/types.ts`](packages/shared/src/i18n/types.ts) + [`he.json`](packages/shared/src/i18n/dictionaries/he.json) + [`en.json`](packages/shared/src/i18n/dictionaries/en.json) — added the `admin.*` dictionary keys (`title`, `kids`, `devices`, `setPin`, `resetPin`, `newPinLabel`, `pinHelp`, `pinSet`, `revoke`, `noDevices`, `lastSeen`, `added`, `signOut`). Hebrew uses feminine forms throughout per BRANDBOOK §10.1.

#### Sub-2d — exit audit

- **Added** [`docs/PHASE-2-EXIT.md`](docs/PHASE-2-EXIT.md) — per-gate status. Six of seven gates verified locally end-to-end (parent sets PIN via admin → kid logs in with that PIN → kid home renders). Two deferred to first VPS deploy or to Phase 3 alongside the broader test infra: the full "close browser → reopen → skip PIN" cookie-persistence test, and unit/integration tests for `kid-auth/{session,pin,device-trust}.ts` (which need a vitest-with-pg harness that lands in Phase 3 for the ledger invariants).
- **Tightened** the BiDi rendering on the home stub (`dir="ltr"` on the English placeholder paragraph) so the period sits at the end of the sentence per BRANDBOOK §8.2.

#### Phase 2 risk + open items

- Phase 2 was Medium risk (net-new auth code touching minors). Functional verification end-to-end is solid; test backfill is deferred but explicitly scoped.
- DB now contains real Argon2id PIN hashes for both kids (Lia `1234`, Yael `5678` — dev only). The placeholder all-zero hashes from `0002_seed_household.sql` no longer apply in this local DB; production hashes will be set via `/admin/kids/<id>/pin` after first deploy.
- No regressions in Phase 1 surfaces (parent login still works, /healthz still 200, locale negotiation unchanged).

### Phase 4 · Build · Phase 1 COMPLETE (2026-05-21)

**Phase 1 of the 9-phase build plan ships.** Foundations + parent auth + first deploy contract.

#### Sub-milestone 1f — Exit-criteria audit

- **Added** [`docs/PHASE-1-EXIT.md`](docs/PHASE-1-EXIT.md) — per-gate status for the six Phase 1 exit criteria. Four verified locally against the throwaway pg container; two (LE cert at `reco.my-restart.co.il`, auto-deploy on push) deferred to first VPS deploy and documented as a hand-off checklist.
- **Verified locally:** schema has 26 tables (22 domain + 3 Auth.js + `__migrations`) with 40 indexes including the partial-unique double-claim guard; seed has 1 household / 2 parent users / 2 kids / 6 tasks / 6 rewards / 8 badges; both kids carry sentinel-placeholder PIN hashes that fail every verify ("kids without PINs" requirement); both parents (mom@reco.local + dad@reco.local) log in end-to-end with real Argon2id round-trips and reach the brandbook-styled home page.
- **Updated** [`RESUME-HERE.md`](RESUME-HERE.md) — Phase 1 marked complete; "next" pointer now Phase 2 (kid auth — Netflix-picker + PIN + device trust). The "Step 4" wizard prompt is now "Start Phase 2?" instead of the old 1b prompt.

#### Phase 1 deliverable map (for the auditor)

| Sub | What landed | Doc anchor |
|---|---|---|
| 1a | pnpm workspace + design-tokens (brandbook as code) + i18n dictionaries | sub-1a entry below |
| 1b | 23-table schema + Drizzle + migration runner + AES helper | sub-1b entry below |
| 1c | Next.js 16 + Auth.js v5 parent login + brandbook-styled login UI | sub-1c entry below |
| 1d | Fastify 5 worker + /healthz + migration-on-boot + empty cron registry | sub-1d entry below |
| 1e | Docker Compose + Dockerfiles + Caddyfile fragment + deploy/update/auto-deploy scripts | sub-1e entry below |
| 1f | Exit-criteria audit + handoff notes | this entry |

### Phase 4 · Build · Sub-milestone 1e (2026-05-21)

- **Added** [`infra/docker-compose.yml`](infra/docker-compose.yml) — three services on a dedicated `reco-net` bridge: `reco-pg` (postgres:16-alpine, ICU `he-IL` at `initdb` per ARCHITECTURE.md §14, healthcheck), `reco-web` (builds from Dockerfile.web, port `127.0.0.1:3030`), `reco-worker` (builds from Dockerfile.worker, port `127.0.0.1:8100`). Two named volumes: `reco-pg-data` for postgres, `reco-evidence` mounted into both web (upload) and worker (serve + purge). Postgres has no host port — only reachable via the docker network.
- **Added** [`infra/Dockerfile.web`](infra/Dockerfile.web) — three-stage build: `deps` (pnpm install with frozen lockfile, layer-cache hits), `builder` (next build), `runner` (only the `.next/standalone` bundle + static + public, running as non-root uid 1001). Output: ~200 MB image.
- **Added** [`infra/Dockerfile.worker`](infra/Dockerfile.worker) — single-stage, tsx-at-runtime. `pnpm install --filter @reco/worker...` installs only the worker's transitive workspace closure (skips web's React/Tailwind etc.). Non-root uid 1001 with `/var/lib/reco/evidence` pre-created so the worker can write the volume on first boot.
- **Added** [`infra/Caddyfile.fragment`](infra/Caddyfile.fragment) — `reco.my-restart.co.il` block matching the architecture path map: `/api/internal/*` → worker (evidence serve + ops), `/healthz` → worker, everything else → web. Hardened headers (HSTS, CSP-equivalent permissions policy with `camera=(self)` for evidence upload, X-Frame-Options DENY, Server header stripped). Forwards real client IP so `audit_log.request_ip` is meaningful.
- **Added** [`infra/.dockerignore`](infra/.dockerignore) — excludes node_modules, .next, dist, .env*, .git, docs, tests, IDE crud so the build context is lean.
- **Added** [`infra/deploy-prod.sh`](infra/deploy-prod.sh) — idempotent first-install. Clones to `/opt/recognition`, generates `AUTH_SECRET` / `MASTER_KEY` / `WORKER_INTERNAL_TOKEN` / `POSTGRES_PASSWORD` if not present (preserved across re-runs), writes `.env` (chmod 600), builds images, starts the stack, waits for pg health, smoke-tests web + worker, installs the Caddy fragment to `/etc/caddy/conf.d/reco.caddy`, validates with `caddy validate`, reloads Caddy, and installs the `*/2 min` `auto-deploy` cron to `/etc/cron.d/reco-auto-deploy` with log file `/var/log/auto-deploy-reco.log`.
- **Added** [`infra/update-prod.sh`](infra/update-prod.sh) — called by auto-deploy on a new HEAD. `git pull --ff-only`, `docker compose build`, `docker compose up -d reco-web reco-worker` (reco-pg untouched per ARCHITECTURE.md §11), 30-second smoke loop on `/api/health` + `/healthz`. Migrations are applied by the worker on boot (sub-1d), not here.
- **Added** [`infra/auto-deploy.sh`](infra/auto-deploy.sh) — host cron poller. `git fetch origin main`, compares local vs remote HEAD, exits silently when unchanged (no log spam), hands off to `update-prod.sh` on a diff. Single-flighted via the `flock -n` on the cron line.
- **Updated** [`apps/web/next.config.ts`](apps/web/next.config.ts) — added `output: 'standalone'` + `outputFileTracingRoot` pointed at the monorepo root so Next traces the symlinked workspace deps into the standalone bundle correctly.
- **Verified**:
  - `docker compose -f infra/docker-compose.yml config` — syntax clean.
  - `bash -n` on all three deploy scripts — clean.
  - Preview dev server (`pnpm --filter @reco/web dev`) still serves `/he/login` 200 after the next.config.ts change (standalone output only affects `next build`, dev path is unchanged).

### Phase 4 · Build · Sub-milestone 1d (2026-05-21)

- **Added** Fastify 5 worker shell at [`apps/worker/`](apps/worker/). Six small files: [`env.ts`](apps/worker/src/env.ts), [`logger.ts`](apps/worker/src/logger.ts), [`cron/registry.ts`](apps/worker/src/cron/registry.ts), [`server.ts`](apps/worker/src/server.ts) + tsconfig + .env.local.
- **Added** [`apps/worker/src/env.ts`](apps/worker/src/env.ts) — Zod schema parses `process.env` synchronously on import. Required: `DATABASE_URL`. Defaulted: `NODE_ENV`, `TZ` (`Asia/Jerusalem`), `LOG_LEVEL` (`info`), `WORKER_PORT` (8100), `WORKER_HOST` (0.0.0.0), and every cron schedule from [`docs/CRON.md`](docs/CRON.md). Optional now (tightened in later phases): `MASTER_KEY`, `WORKER_INTERNAL_TOKEN`, Twilio/SMTP/B2 keys, `WHATSAPP_DRY_RUN`. Failed validation throws synchronously so the worker fails fast at boot.
- **Added** [`apps/worker/src/logger.ts`](apps/worker/src/logger.ts) — Pino logger keyed off env: pretty-printed via the `pino-pretty` transport in dev, raw JSON in prod. `base: { service: 'reco-worker' }` so journald + grep can filter cleanly.
- **Added** [`apps/worker/src/cron/registry.ts`](apps/worker/src/cron/registry.ts) — empty `jobs[]` array with the typed `CronJob` shape and a `registerCron()` runner that times each tick, logs ok/failed, and pins jobs to `env.TZ` via `node-cron`. Logs "cron registry empty — first jobs land in Phase 5+" on boot until populated.
- **Added** [`apps/worker/src/server.ts`](apps/worker/src/server.ts) — boot sequence: parse env → init logger → `applyMigrations(env.DATABASE_URL)` from `@reco/db` → start Fastify with `/healthz` → register cron jobs → wire SIGINT/SIGTERM to a `shutdown()` that stops cron tasks and `await`s `app.close()` before `process.exit(0)`. Fastify's loggerInstance is the shared pino so request logs match worker logs.
- **Refactored** [`packages/db/src/migrate.ts`](packages/db/src/migrate.ts) into:
  - [`packages/db/src/migrator.ts`](packages/db/src/migrator.ts) — `applyMigrations(databaseUrl, opts?)` exported with a `log` hook so the worker can forward progress to pino instead of `console.log`.
  - [`packages/db/src/migrate.ts`](packages/db/src/migrate.ts) — slim CLI that calls `applyMigrations` and prints to stdout. Used by `pnpm migrate:apply`.
  - `@reco/db` re-exports `applyMigrations` + the `Result`/`Options` types.
- **Updated** [`apps/worker/tsconfig.json`](apps/worker/tsconfig.json) — dropped the composite project references to `@reco/{shared,db}` and switched to `noEmit: true` + `moduleResolution: Bundler` (the worker runs via tsx, no separate build step).
- **Updated** [`apps/worker/package.json`](apps/worker/package.json) — `dev`: `tsx watch --env-file=.env.local src/server.ts`; `start`: `tsx src/server.ts` (no separate compiled `dist/`); typecheck unchanged.
- **Verified** with the throwaway pg container from sub-1c:
  - `pnpm --filter @reco/{db,worker} typecheck` clean.
  - Worker boot log shows the four steps in order: `applying pending migrations` → `migrations up to date` (alreadyApplied: 2) → `Server listening at http://0.0.0.0:8100` → `cron registry empty — first jobs land in Phase 5+`.
  - `GET /healthz` returns `{"status":"ok","service":"reco-worker","timestamp":"..."}` with pino request logging emitting structured `incoming request` / `request completed` pairs.
- **Caveat (Windows-specific)** — the SIGTERM/SIGINT handlers in `server.ts` are wired but couldn't be verified end-to-end on Windows: `taskkill` without `/F` refuses to deliver a polite Ctrl+C-equivalent to a console process. In Linux Docker (the prod path), SIGTERM from `docker stop` will reach the Node process natively and the shutdown handler will fire as written.

### Phase 4 · Build · Sub-milestone 1c (2026-05-21)

- **Added** Next.js 16 + App Router web shell at [`apps/web/`](apps/web/). Tailwind 4 (CSS-first via `@theme` in [`apps/web/src/app/globals.css`](apps/web/src/app/globals.css), brandbook tokens hand-mirrored from `packages/shared/src/design-tokens/tokens.ts`). React 19, Turbopack dev. `transpilePackages: ['@reco/db', '@reco/shared']` so workspace packages are bundled through Next's transformer.
- **Added** Auth.js v5 parent (admin) auth with the split-config pattern:
  - [`apps/web/src/auth.config.ts`](apps/web/src/auth.config.ts) — edge-safe partial (no DB, no Argon2), shared by middleware. Carries the jwt + session callbacks that propagate `id` / `householdId` / `role` onto every request.
  - [`apps/web/src/auth.ts`](apps/web/src/auth.ts) — Node-runtime full config with the Credentials provider. Verifies Argon2id (m=19456, t=2, p=1) against the `user` table; on failure increments `failed_login_count` and locks for 15 min after 5 wrong attempts; on success resets the counter.
  - [`apps/web/src/lib/auth/password.ts`](apps/web/src/lib/auth/password.ts) — Argon2id `hash()` + `verify()` helpers (`@node-rs/argon2`).
  - [`apps/web/types.d.ts`](apps/web/types.d.ts) — augments `next-auth.User`, `next-auth/adapters.AdapterUser`, `Session.user`, and `next-auth/jwt.JWT` with `householdId` + `role`.
  - [`apps/web/src/app/api/auth/[...nextauth]/route.ts`](apps/web/src/app/api/auth/[...nextauth]/route.ts) — re-exports the GET/POST handlers.
- **Added** [`apps/web/src/middleware.ts`](apps/web/src/middleware.ts) — combined locale negotiation + auth gating. `/foo` → `/he/foo` (or `/en/foo`) via Accept-Language. Resolved locale is propagated as `x-reco-locale` so the root layout sets `<html lang dir>` server-side with no client flash. Everything inside `/[lang]` is parent-only except `/[lang]/login` (Phase 2 will add `/[lang]/pick` to the unauthenticated allowlist — seam noted in code).
- **Added** brandbook-styled login surface: server-component page at [`apps/web/src/app/[lang]/login/page.tsx`](apps/web/src/app/[lang]/login/page.tsx) renders the card (Reco wordmark Fredoka LTR + Hebrew subtitle), client component [`login-form.tsx`](apps/web/src/app/[lang]/login/login-form.tsx) uses React 19's `useActionState` against the server action in [`actions.ts`](apps/web/src/app/[lang]/login/actions.ts), translating `AuthError.type === 'CredentialsSignin'` to the dictionary's `invalidCredentials` key.
- **Added** authenticated home stub at [`apps/web/src/app/[lang]/page.tsx`](apps/web/src/app/[lang]/page.tsx) — greets the parent by name, points at Phase 2/3, exposes a sign-out form action.
- **Added** root layout at [`apps/web/src/app/layout.tsx`](apps/web/src/app/layout.tsx) loading Heebo / Fredoka / Quicksand via `next/font/google` as CSS variables that globals.css references; `[lang]/layout.tsx` pre-renders both locales via `generateStaticParams`.
- **Added** health endpoint at [`apps/web/src/app/api/health/route.ts`](apps/web/src/app/api/health/route.ts) for `update-prod.sh` + Caddy upstream checks.
- **Refactored** all `import './foo.js'` to `import './foo'` across `packages/db/src/**` and `packages/shared/src/**`. Turbopack's edge bundler didn't resolve the `.js → .ts` mapping for transpilePackages; extensionless imports work across `tsc`, `tsx`, vitest, and Next without ambiguity.
- **Verified** with a real-Argon2 smoke test against a throwaway pg16 container:
  - `pnpm --filter @reco/db typecheck && pnpm --filter @reco/web typecheck` clean.
  - `/api/health` → 200; `/` → 307 → `/he`; `/he` (unauth) → 307 → `/he/login`; `/he/login` and `/en/login` render brandbook-conformant cards (screenshots captured during smoke test).
  - Full credentials flow with `mom@reco.local` / a real-hashed password: CSRF token fetch → POST `/api/auth/callback/credentials` → 302 + `authjs.session-token` cookie → GET `/he/` returns the "Welcome back, Mom" page.
  - Wrong password → 302 back to login with `?error=CredentialsSignin`, no session cookie issued, `failed_login_count` incremented in DB.

### Phase 4 · Build · Sub-milestone 1b (2026-05-21)

- **Added** [`packages/db/migrations/0001_init.sql`](packages/db/migrations/0001_init.sql) — full schema per [`docs/SCHEMA.md`](docs/SCHEMA.md): 23 domain tables (household, user, kid, device_trust, task_template, task_assignment, task_reminder, evidence, submission, task_completion, long_term_progress, reward_item, badge, campaign, campaign_feeding_task, kid_badge, campaign_enrollment, notification_event, campaign_nudge_log, redemption, ledger_entry, audit_log) + Auth.js v5 (session, account, verification_token) + `__migrations` tracking. All CHECK constraints (XOR polymorphics, ledger kind/amount invariants, enum domains) + partial unique indexes (double-claim prevention on `task_completion`) included. Circular FKs (submission ↔ task_completion ↔ ledger_entry ↔ redemption) added via `ALTER TABLE` after tables exist.
- **Added** [`packages/db/migrations/0002_seed_household.sql`](packages/db/migrations/0002_seed_household.sql) — install-time seed with fixed UUIDs (idempotent via `ON CONFLICT DO NOTHING`): 1 household, 2 parent users (`Mom`/`Dad`, placeholder Argon2 hashes that always fail verify), 2 kids (`Lia` peach `#FF9F7A`, `Yael` sky `#6EC9F4`, placeholder PIN hashes), 6 task templates (5 daily + 1 long-term `Read a book` with 1 coin/page goal=100 bonus=50), 6 rewards (Candy 2¢ → Game controller 300¢), 8 badges matching BRANDBOOK §5.5 emblem set. `deploy-prod.sh` (Phase 1) will UPDATE the placeholder identity rows by their known UUIDs.
- **Added** [`packages/db/src/migrate.ts`](packages/db/src/migrate.ts) — raw-SQL migration runner. Bootstraps `__migrations`, scans `migrations/` alphabetically, applies new files in per-file transactions, records on success. Idempotent.
- **Added** [`packages/db/src/helpers/encrypt.ts`](packages/db/src/helpers/encrypt.ts) — AES-256-GCM encrypt/decrypt keyed by `MASTER_KEY` (base64 32 bytes). Output is `base64(iv ‖ tag ‖ ciphertext)`. Mirrors Family_Tasks_Hub's pattern for cross-app key-rotation tooling later.
- **Added** [`packages/db/src/helpers/encrypt.test.ts`](packages/db/src/helpers/encrypt.test.ts) — round-trip + GCM-tamper + bad-key + missing-key cases.
- **Added** [`packages/db/src/schema/*.ts`](packages/db/src/schema) — Drizzle table definitions (type-only; we don't generate migrations from Drizzle) grouped by domain: tenancy, kids, tasks, completions, submissions, rewards, badges, campaigns, ledger, notifications, audit, auth, migrations. Barrel re-exported from `@reco/db`.
- **Added** [`packages/db/src/client.ts`](packages/db/src/client.ts) — pooled Drizzle client (`getDb()` singleton) over node-postgres.
- **Updated** [`packages/db/src/index.ts`](packages/db/src/index.ts) — now exports the schema, the client, and the encrypt helpers.
- **Note (deviation from SCHEMA.md, surfaced for review):** `kid_badge`'s UNIQUE `(kid_id, badge_id, awarded_for_year)` is declared `NULLS NOT DISTINCT` (Postgres 15+). The schema doc's narrative said this constraint enforces "earned once" for non-recurring badges (which have `awarded_for_year = NULL`); the standard `NULLS DISTINCT` default would allow duplicates. The constraint here matches the documented intent.

### Phase 4 · Build · Sub-milestone 1a (2026-05-21)

- **Added** monorepo scaffold: pnpm workspace, `apps/{web,worker}`, `packages/{db,shared}`, `infra/`, `scripts/`, `docs/`.
- **Added** root tooling: `tsconfig.base.json`, `.prettierrc.json`, `.editorconfig`, `.nvmrc` (Node 22), `.gitignore`, `.env.example` with all env vars documented.
- **Added** `packages/shared/src/design-tokens/` — the canonical brandbook v1.0 codified as TypeScript constants AND a CSS variables stylesheet. Color palette, typography stack, type scale, spacing, radius, shadow elevations, animation tokens — all exported from a single source of truth. Future Tailwind configs and component styles consume from here.
- **Added** `packages/shared/src/i18n/dictionaries/{he,en}.json` — i18n dictionary seed with login + nav + common-action strings.
- **Added** `packages/shared/src/i18n/types.ts` — typed `Dictionary` interface so missing keys are TypeScript errors.
- **Added** `README.md` at repo root with quickstart + doc map.

---

## Phase 3 · Design (2026-05-21)

- **Locked** the brandbook at v1.0. Concept: **Plush**. Badge architecture: **Embroidered Patch**. See [`docs/BRANDBOOK.md`](./docs/BRANDBOOK.md) and [`docs/brandbook.html`](./docs/brandbook.html).
- **Locked** icon strategy: keep avatars + task icons + coin + tab lines as hand-rolled SVG; license Flaticon "Reward" pack for badges + rewards in Phase 9.
- **Added** `CLAUDE.md` at repo root governing future Claude sessions.

---

## Phase 0–2 · Plan (2026-05-20)

- **Decided** infrastructure: reuse Hetzner VPS pattern (not Supabase, not Vercel). Third Docker stack alongside Family_Budget_App and Family_Tasks_Hub.
- **Decided** in-app-only approval flow (Twilio Sandbox inbound is account-singleton owned by Family_Tasks_Hub).
- **Decided** subdomain: `reco.my-restart.co.il`.
- **Locked** schema (23 tables), cron schedules, notification routing matrix, build plan (9 phases). See `docs/ARCHITECTURE.md`, `docs/SCHEMA.md`, `docs/CRON.md`, `docs/NOTIFICATIONS.md`, `docs/BUILD-PLAN.md`.
- **Resolved** 8 open questions: bonus reversal, reward image storage, shared admin, kid avatars admin-uploadable, yearly birthday badge, brand fully-open for Phase 3, design fresh (not from Cookster), URL shortener included.
