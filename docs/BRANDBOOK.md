# Reco — Brandbook (v1)

> **The locked design system for Reco.** Every new feature must conform to this document.
>
> **Locked:** 2026-05-21.
> **Concept:** Plush (Child Reward-inspired).
> **Badge architecture:** Embroidered Patch.
> **Companion:** [`brandbook.html`](./brandbook.html) — visual showroom of every rule below.
>
> **Contract:** If you're a future Claude session, a designer, or a developer touching any user-facing surface in Reco, **read this document before designing or coding the surface.** Deviations require explicit re-confirmation from Lily and a brandbook revision (see §14).

---

## Table of contents

0. [How to use this document](#0-how-to-use-this-document)
1. [Brand identity](#1-brand-identity)
2. [Color system](#2-color-system)
3. [Typography](#3-typography)
4. [Iconography](#4-iconography)
5. [Badge architecture — Embroidered Patch (locked)](#5-badge-architecture--embroidered-patch-locked)
6. [Component library](#6-component-library)
7. [Layout & spacing](#7-layout--spacing)
8. [Bilingual & RTL rules](#8-bilingual--rtl-rules)
9. [Motion & interaction](#9-motion--interaction)
10. [Voice & tone](#10-voice--tone)
11. [Accessibility](#11-accessibility)
12. [Common patterns (recipes)](#12-common-patterns-recipes)
13. [What NOT to do](#13-what-not-to-do)
14. [Version & governance](#14-version--governance)

---

## 0. How to use this document

This is the **contract** for everything Reco's UI looks and feels like.

**When designing a new feature:**
1. Read §1 (brand identity) and §10 (voice & tone) first — understand who Reco is.
2. Pick components from §6 before inventing new ones.
3. Follow §2 (color), §3 (typography), §7 (layout), and §11 (accessibility) rules — these are not suggestions.
4. If your feature involves icons, see §4 — use existing icons before designing new ones; if you need a new icon, follow the production sourcing rules in §4.5.
5. If your feature involves badges, see §5 — this is the locked architecture.
6. If your feature involves text shown to the user, see §10 — voice rules differ for kid vs admin.
7. Reference §12 (recipes) for common composite UI patterns.

**When you can't find a rule:** ask Lily, then add the answer to the brandbook (see §14).

**When the brandbook conflicts with the live code:** the brandbook wins. File the discrepancy as a bug.

---

## 1. Brand identity

### Name

**Reco.** Always spelled this way. Not "RECO," not "reco" (lowercase only inside CSS class names or code identifiers). User-facing: capital R, lowercase eco.

In Hebrew: brand mark stays **Reco** in Latin characters. Do not transliterate to רקו or רעקו. The Latin wordmark is part of the brand mark, even on Hebrew screens.

### Codename vs brand

- **Codename:** `Recognition`. Used only in code paths and infra (`/opt/recognition`, the GitHub repo name, the `recognition-pg` Postgres container).
- **Brand (kid-facing):** `Reco`. Everywhere a user sees the app name.

### Audience

- **Primary users (kids):** Lia and Yael, currently ages 9–11. Confident readers. Bilingual (Hebrew + English). Used to Duolingo-class UX vocabulary (streaks, hearts, leagues).
- **Admin users (parents):** Two parents, shared admin view. Email + password login. They both consume Reco notifications and approve evidence.

### Working tone

- **Kid:** warm, soft, encouraging. Not babyish. Not edgy. Closer to *Apple Activity rings + Studio Ghibli* than to *Roblox + Cocomelon*.
- **Admin:** utilitarian, attribution-clear, calm. Both parents always see each other's actions; the tone is collegial, not authoritative.

### One-sentence positioning

> *Reco is the soft, cheerful place where Lia and Yael earn coins for everyday wins, save up for the rewards they actually want, and collect badges that fill in over the year.*

---

## 2. Color system

Five families: **brand colors**, **kid-identity colors**, **semantic colors**, **surfaces**, **accents**. All values below are the production-locked hex codes. Use them via the CSS custom properties (variables) listed.

### 2.1 Brand colors

| Token | Hex | Use |
|---|---|---|
| `--pink` | `#FF6B9D` | Primary CTA · brand mark accent · primary attention |
| `--pink-dark` | `#E94B7F` | Hover/pressed for `--pink` · pink shadows |
| `--pink-pale` | `#FFE0EB` | Soft pink container background |
| `--pink-soft` | `#FFF0F6` | Soft pink surface tint (cards) |

Pink is Reco's primary brand color. It belongs to the action layer: primary buttons, the "submit for approval" CTA, the kid's earned-now ribbon, the brand wordmark when colored.

### 2.2 Kid-identity colors

Each kid carries her own color throughout the entire app. The mapping is **locked at install** and never changes after.

| Kid | Token | Hex | Use |
|---|---|---|---|
| **Lia** | `--peach` | `#FF9F7A` | Lia's avatar, chips, accent, House Crimson tier |
| Lia softs | `--peach-pale` | `#FFE5D8` | Lia avatar background, sibling-card tint |
| **Yael** | `--sky` | `#6EC9F4` | Yael's avatar, chips, accent, House Azure tier |
| Yael softs | `--sky-pale` | `#DBEFFB` | Yael avatar background, sibling-card tint |
| Yael deeper | `--sky-dark` | `#3DA8DD` | Yael's text accent in sibling feeds |

**Rule:** Lia's name in text is always set in `--ink` (not peach). The peach is the surrounding chrome (avatar background, badge ribbon, accent strip). Same for Yael with sky.

### 2.3 Semantic colors

| Token | Hex | Meaning |
|---|---|---|
| `--mint` | `#4ED9A5` | Success · completed task · received redemption · positive ledger entry |
| `--mint-dark` | `#2EB683` | Mint shadows · earned-coin text emphasis |
| `--mint-pale` | `#D6F5E8` | Success container tint |
| `--mint-soft` | `#EBFAF3` | Soft success surface (e.g., completed task row) |
| `--yellow` | `#FFD75E` | Coin gold · highlights · reward emphasis |
| `--yellow-dark` | `#E8B927` | Yellow shadows · gold ring around coin |
| `--yellow-pale` | `#FFF3D6` | Yellow container tint (campaign banner) |
| `--lavender` | `#B59FE5` | Campaigns · long-term tasks · "magic" surfaces |
| `--lavender-dark` | `#8B72CE` | Lavender shadows · campaign emphasis |
| `--lavender-pale` | `#ECE4F8` | Lavender container tint |

**Color-as-meaning contract:**
- **Mint = success.** Anything completed, confirmed, approved, received.
- **Pink = action.** Anything the user is about to do.
- **Yellow = currency.** Anything coin-related.
- **Lavender = campaigns / long-term.** Anything time-boxed or accumulating.
- **Sky = Yael.** **Peach = Lia.** Don't reuse for unrelated meanings.

### 2.4 Surfaces

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FAF8F5` | App background (warm cream off-white) — NEVER pure white at the app level |
| `--card` | `#FFFFFF` | Card/sheet/modal background |
| `--ink` | `#2D2A4A` | Primary text · primary icons · darkened panels (in patches/locked states) |
| `--ink-soft` | `#6E6B89` | Secondary text · subtitles |
| `--ink-faded` | `#A8A6BB` | Tertiary text · disabled · placeholder |
| `--rule` | `#EFEDF5` | Hairline rules · soft borders |
| `--rule-soft` | `#F7F5FA` | Even softer rule · alternate row tint |

### 2.5 Accent reds (caution / denial)

| Token | Hex | Use |
|---|---|---|
| Pink-dark `--pink-dark` | `#E94B7F` | Denial of evidence, refunded redemption, retry-needed states. **Do not use red `#FF0000` or `#F00` anywhere.** |

Reco does not have a "red." Denial uses pink-dark + a kind tone (see §10 voice).

### 2.6 Color combinations to use

✅ **Lia card:** `--peach-pale` background + `--peach` accent + `--ink` text
✅ **Yael card:** `--sky-pale` background + `--sky-dark` accent + `--ink` text
✅ **Completed task:** `--mint-soft` background + `--mint-pale` border + `--mint-dark` text
✅ **Pending evidence (active):** white card + `--pink` border + `--ink` text + `--pink` highlight
✅ **Campaign card:** white card + `--lavender-pale` border + `--lavender-dark` accent
✅ **Coin context:** anywhere yellow ring `--yellow` + `--yellow-dark` shadow

### 2.7 Color combinations NOT to use

❌ Pink + red — Reco doesn't have red.
❌ Two kid colors on the same component — never blend peach + sky (visually muddy).
❌ Lavender on background — lavender is for campaigns, not chrome.
❌ Pure black (`#000`) — use `--ink` `#2D2A4A` (warm dark purple).
❌ Pure white (`#FFF`) at app background level — use `--bg` `#FAF8F5`.

---

## 3. Typography

### 3.1 Fonts (production)

| Family | Source | Use | Weights used |
|---|---|---|---|
| **Fredoka** | Google Fonts | Latin display, English headlines, numbers | 500, 600, 700 |
| **Heebo** | Google Fonts | Hebrew display + body, all numbers in tabular contexts | 400, 500, 700, 800, 900 |
| **Quicksand** | Google Fonts | Latin body, English secondary text | 500, 600, 700 |

**Fallback stack** for every CSS rule:

```css
font-family: 'Fredoka', 'Quicksand', 'Heebo', system-ui, sans-serif;
```

For Hebrew-specific rules:

```css
font-family: 'Heebo', system-ui, sans-serif;
```

### 3.2 Type scale

| Class name | Family/weight | Size (px) | Line height | Use |
|---|---|---|---|---|
| `.display-en-bold` | Fredoka 700 | 28–56 | 1.0–1.05 | Latin headlines (kid screens) |
| `.display-en` | Fredoka 600 | 18–28 | 1.05–1.15 | Latin sub-headlines |
| `.display-he-bold` | Heebo 900 | 28–56 | 1.0–1.05 | Hebrew headlines |
| `.display-he` | Heebo 800 | 18–28 | 1.05–1.15 | Hebrew sub-headlines |
| `.body-he` | Heebo 500 | 13–16 | 1.4 | Hebrew body text |
| `.body-en` | Quicksand 600 | 13–16 | 1.4 | Latin body text |
| `.num` | Heebo 800, tabular-nums | 14–88 | 1.0 | All numbers (wallet, counts, progress) |
| (caption) | Heebo 500 / Quicksand 500 | 10–11 | 1.3 | Captions, metadata |

**Numbers always tabular.** Use `font-feature-settings: "tnum"` so digits align in columns. Wallet balances, ledger amounts, progress fractions, dates — all tabular. Never proportional.

### 3.3 Numbers stay LTR in Hebrew context

In `dir="rtl"` text, embed numbers and other Latin tokens inside `<span dir="ltr">` if they don't auto-resolve. Most browsers handle this with Unicode Bidi, but force it for:

- Wallet balances mid-sentence: `יתרה: <span dir="ltr">47</span> מטבעות`
- Time strings: `<span dir="ltr">17:00</span>`
- Dates: `<span dir="ltr">2026-05-21</span>`
- Brand "Reco": `<span dir="ltr">Reco</span>`

### 3.4 Selective bolding

Reco's display style uses **selective bold within headlines** — bolding the key word, not the whole sentence. Pattern: regular display weight for connecting words, bold display weight for the noun the kid cares about.

Examples:

> זמן ל**מטבעות** — לכי קדימה!
> Get your **tokens** today
> תיכף ת**ניצחי**

This shows up across hero headers and home screens. It's a signature move; use it.

### 3.5 Mixing Hebrew + English on the same screen

When both languages must appear (mostly the language toggle preview), match the type weight tier across languages:

- Hebrew display 900 ⟷ Latin display (Fredoka) 700
- Hebrew body 500 ⟷ Latin body (Quicksand) 600

Never use the same font (Heebo) for both — Latin glyphs in Heebo are technically supported but lack character. Always pair Heebo (HE) with Fredoka/Quicksand (Latin).

---

## 4. Iconography

Reco has **four icon families.** Each has its own visual rules, drawing style, and production sourcing strategy. **Do not mix families** — a UI surface uses icons from one family at a time (with the documented exceptions).

### 4.1 Family 1 — Character avatars

**What they are:** illustrated character heads representing each kid. Flat-illustrated, soft palette, friendly personality details.

**Locked characters (v1):**
- **Lia = Fox** (peach + cream + dark eye dots)
- **Yael = Bunny** (sky + cream + pink nose)

**Drawing rules:**
- No outlines on the head shape itself; rely on filled silhouettes.
- 2 colors per character + dark eyes/mouth detail.
- Cheek blush (peach for fox, sky-pink for bunny) at 0.4–0.6 opacity.
- Eye highlight: 1 small white dot per eye.

**Where used:**
- Profile picker cards
- Top-left of kid home, kid task list, kid wallet
- Sibling activity chip
- Admin "kids" list

**Where NOT used:** anywhere that isn't a kid-identity context. Don't put a fox avatar in a generic icon slot.

**Future expansion (v2):** kids can pick from a gallery of 6–8 character avatars. The 2 starter characters (fox, bunny) are the install seed.

**Files:** `<symbol id="av-fox">`, `<symbol id="av-bunny">` in the canonical SVG library.

### 4.2 Family 2 — Task icons

**What they are:** clean flat-illustrated objects representing common chores. Sit inside small pastel-colored circles or rounded squares.

**Style rules:**
- 2-color silhouettes with `--ink` line accents (~2px stroke).
- Rounded shapes, soft corners, no sharp angles.
- Placed inside a 36–40px container with a pastel background (matching task category color where relevant).

**Locked icons (v1 seed):**
- Bed (make-bed task)
- Toothbrush (brush teeth)
- Croissant (breakfast)
- Shirt (get dressed)
- Camera (evidence required indicator)
- Notebook + pencil (homework)

**Where used:**
- Task cards (timeline, list, detail)
- Bell notifications about specific tasks
- Admin task template editor

**Production sourcing:** hand-rolled SVG, kept simple. Consistency rules in `/packages/shared/src/icons/tasks/`.

**Files:** `<symbol id="ic-bed">`, `<symbol id="ic-tooth">`, `<symbol id="ic-food">`, `<symbol id="ic-shirt">`, `<symbol id="ic-cam">`, etc.

### 4.3 Family 3 — Badge emblems

**What they are:** the heart of Reco's collection mechanic. Flat-illustrated, multi-color (3–5 colors), reward-pack aesthetic. They sit inside the Embroidered Patch wrapper (see §5).

**Locked emblem set (v1):**

| Emblem | When earned | Primary color |
|---|---|---|
| **Crown** | "King of Tasks" — streak campaign master | Gold + pink jewels |
| **Trophy** | 100-task milestone | Gold + brown base |
| **Medal-with-ribbon** | Reading milestones | Gold + pink/sky ribbon |
| **Diamond** | 30-day streak | Sky-blue + white facets |
| **Certificate** | End-of-year campaign completion | White + red seal |
| **Gift box** | Yearly birthday badge (auto-awarded) | Yellow + pink ribbon |
| **Star** | 500-task milestone | Gold + white center |
| **Torch** | 10-campaign completion | Gray base + pink/yellow flame |

**Style rules:**
- Flat shapes, NO gradients except for the optional white-stripe shine.
- 3–5 fill colors per emblem from the Reco palette only.
- No black outlines — rely on color contrast.
- Each emblem ~60×60 viewBox; sits inside a 100×100 patch.

**Production sourcing (after v1 hand-roll):**
- Phase 9 polish task: license **Flaticon "Reward" / "Achievement" pack** (or equivalent — Iconscout, Streamline). Replace hand-rolled emblems with licensed icons that match Reco's palette.
- Each licensed emblem must be re-colored to use Reco palette tokens (no off-palette colors).
- Document the source pack + license terms in `/docs/LICENSES.md` (forthcoming).

**Files:** `<symbol id="em-crown">`, `<symbol id="em-trophy">`, etc.

### 4.4 Family 4 — Reward icons

**What they are:** illustrated objects representing redeemable rewards. Same visual grammar as badge emblems (flat, multi-color, no gradients) but at a larger scale (80×80 viewBox) and placed inside pastel tile backgrounds, not embroidered patches.

**Locked reward set (v1 seed):**

| Reward | Cost | Primary color | Bg tile color |
|---|---|---|---|
| **Wrapped candy** | 2 ¢ | Pink + white stripes | `--pink-soft` |
| **Phone (screen time)** | 5 ¢ | Sky body, white screen, pink play icon | `--sky-soft` |
| **Ice cream cone** | 8 ¢ | Pink scoop + mint scoop + gold cone + red cherry | `--mint-soft` |
| **Pillow (sleepover)** | 50 ¢ | Lavender + moon + Z's | `--lavender-soft` |
| **Movie ticket** | 100 ¢ | Pink + white | `--yellow-pale` |
| **Game controller** | 300 ¢ | Lavender body + multi-color buttons | `--peach-pale` |

**Same production sourcing strategy as §4.3** (Phase 9: license a real pack).

**Files:** `<symbol id="rw-candy">`, `<symbol id="rw-phone">`, etc.

### 4.5 Family 5 — UI line icons

**What they are:** quiet, utility line icons for navigation, status, and chrome. **Stroke-based**, not filled. ~2px stroke, rounded line caps.

**Locked set:**
- Home (house silhouette)
- Checklist (clipboard + checkmark)
- Shopping bag (for shop tab)
- Star outline (for campaigns tab)
- Shield outline (for badges tab)
- Bell (for notifications)
- Search (magnifying glass)
- Hamburger (3 lines)
- Settings (gear)
- Camera (filled, used as task icon — exception)
- Chevron (left/right arrow)
- Plus / minus (add/subtract)
- Clock (reminder)
- Lock (locked state overlay)

**Style rules:**
- 2px stroke at 24×24 viewBox base.
- `--ink-soft` for inactive, `--pink` for active.
- Background container (when used): 34×34 rounded-xl, pastel tint, transparent → pink-pale on active.

**Source:** custom SVG. Lucide or Phosphor "Light" style as reference but redrawn to match Reco's softness.

### 4.6 Icon usage rules — the family map

| Surface | Allowed icon families |
|---|---|
| Profile picker | Avatars only (family 1) |
| Kid home top bar | Avatar (family 1) + UI lines (family 5) |
| Task card | Task icons (family 2) + UI lines (family 5) for status |
| Task detail | Task icon (family 2) + camera (family 5) for upload |
| Wallet stats card | UI line + coin glyph (special) |
| Shop tile | Reward icon (family 4) only |
| Badge tile (patch) | Badge emblem (family 3) only |
| Campaign card | Badge emblem (family 3) + UI lines (family 5) |
| Sibling activity chip | Avatar (family 1) + badge emblem (family 3) at small size |
| Bottom tab bar | UI lines (family 5) only |

**The exception:** the coin glyph. The gold coin (`<symbol id="ic-coin">`) is its own special icon that appears across all families. It's the only icon that crosses boundaries.

---

## 5. Badge architecture — Embroidered Patch (locked)

**This is the locked badge design.** Every badge in Reco — earned, locked, or future — uses the Embroidered Patch architecture.

### 5.1 Anatomy

```
                     ┌──────────────────────┐
                     │  ◌◌◌◌◌◌◌◌◌◌◌◌◌◌◌    │  ← OUTER RING
                     │ ◌                  ◌ │     pastel matching the
                     │◌    ┌─────────┐    ◌│     badge category
                     │◌    │         │    ◌│
                     │◌    │ EMBLEM  │    ◌│  ← INNER FIELD (white)
                     │◌    │  (SVG)  │    ◌│     contains the illustrated
                     │◌    │         │    ◌│     emblem from family 3
                     │◌    └─────────┘    ◌│
                     │ ◌                  ◌ │  ← DASHED STITCH BORDER
                     │  ◌◌◌◌◌◌◌◌◌◌◌◌◌◌◌    │     2.5px dashed in primary
                     └──────────┬───────────┘     category color
                            ┌───┴───┐
                            │ ×12  │           ← WHITE COUNT CHIP
                            └───────┘             pinned at bottom-center
                                                  Fredoka 700, 11px
```

### 5.2 Layers (from outside in)

1. **Outer ring** — solid pastel circle (the badge's primary category-color soft tone, e.g., `--pink-pale` for action badges, `--mint-pale` for streak badges, `--yellow-pale` for milestone badges).
2. **White spacer ring** — 10–14px white band between outer ring and stitched border.
3. **Inner field** — white circle with a 2.5px dashed border in the badge's primary category color. The dashed border evokes embroidery / iron-on patch.
4. **Emblem** — the illustrated emblem SVG from family 3, centered. ~56% of the patch width.
5. **Count chip** — small white pill pinned to the bottom-center of the patch, half-overlapping the outer ring. Contains `×N` where N is the earn count.

### 5.3 Sizes

| Context | Diameter | Inner field | Emblem width | Count chip |
|---|---|---|---|---|
| Badge grid (kid screen, 4-col) | 90px | 64px | 36px | 9px / 2px padding |
| Badge grid (kid screen, 3-col) | 100px | 70px | 40px | 10px / 2.5px padding |
| Hero badge (detail view) | 200px | 160px | 88px | 11px / 3px padding |
| Sibling chip avatar | 28px (no count chip) | — | full | — |
| Campaign-reward preview | 56px | 40px | 24px | (no count chip) |

### 5.4 States

| State | Outer ring | Dashed border | Emblem | Count chip |
|---|---|---|---|---|
| **Earned** | category pastel | category color | full color | white pill, ink text |
| **Locked** | `--rule` (gray) | `--ink-faded` dashed | grayscale + 50% opacity | absent · replaced by lock overlay |
| **Just-earned (celebration)** | category pastel + animated glow | category color + animation | full color + bounce | "NEW!" pill in `--pink` |

**Lock overlay** for locked badges: a 36px circle of `rgba(45,42,74,0.85)` centered on the emblem, with a small white lock icon inside.

### 5.5 Color mapping (badge → category)

| Badge | Outer ring | Dashed border |
|---|---|---|
| Crown (King of Tasks) | `--pink-pale` | `--pink` |
| Trophy (100-task milestone) | `--yellow-pale` | `--yellow-dark` |
| Medal (reading milestone) | `--sky-pale` | `--sky` |
| Diamond (30-day streak) | `--sky-pale` | `--sky-dark` |
| Certificate (year completion) | `--peach-pale` | `--peach` |
| Gift (birthday) | `--lavender-pale` | `--lavender` |
| Star (500-task milestone) | `--peach-pale` | `--peach` |
| Torch (10 campaigns) | `--yellow-pale` | `--peach` |

**Rule:** category color is set at badge-template creation time and stored in `badge.color_token` (text). The brandbook governs the canonical mapping.

### 5.6 Layout in grids

- **Kid badge collection page:** 4-column grid, 12–16px gap. Badges tile uniformly. Count chip is part of the grid item.
- **Campaign card with reward preview:** single 56px patch inline next to the campaign title.
- **Sibling activity chip:** 28px patch only (no count, no lock state — context is "just earned").
- **Just-earned modal:** centered 200px hero patch with confetti border (Phase 9).

### 5.7 What patches don't do

- Patches do NOT use the 3D silver-shield wrapper from Plush v1/v2 (that was rejected at Gate 3 in favor of the patch).
- Patches do NOT come with hanging ribbons (rejected — that was the "hanging medal" alternative).
- Patches are NEVER rectangular. Always circular.
- Patches do NOT show date earned, bonus coins, or campaign source on the tile itself — that information lives on the badge detail page (tap the patch).

---

## 6. Component library

These are the building blocks. Use them. Don't invent new components unless you've tried to compose existing ones.

### 6.1 Buttons

| Variant | Background | Text | Shadow | Use |
|---|---|---|---|---|
| **`btn-pink`** | `--pink` | white | `0 4px 12px rgba(255,107,157,.35)` | Primary CTA — "send for approval", "redeem", "complete task" |
| **`btn-mint`** | `--mint` | white | `0 4px 12px rgba(78,217,165,.3)` | Confirmation CTA — "I got it", "approve evidence" |
| **`btn-white`** | white | `--ink` | `0 1px 2px rgba(45,42,74,.05)` + 1.5px `--rule` border | Secondary CTA — "cancel", "edit", filter toggles |
| **`btn-ink`** (rare) | `--ink` | white | — | Modal close, danger confirmation |

**Shape:** all buttons are pill-shaped (border-radius: 999px).

**Sizes:**
- Small: `py-1.5 px-3 text-[11px]`
- Medium: `py-2 px-4 text-[12-13px]`
- Large (CTA): `py-3 px-6 text-[15-16px]`

**State:** hover shifts `transform: translateY(-1px)` and brightens shadow. Pressed: `translateY(0)` instant.

**Font:** Heebo 800.

### 6.2 Cards

| Variant | Background | Border | Shadow | Use |
|---|---|---|---|---|
| **`card-soft`** | white | 1px `--rule` | `0 4px 12px rgba(45,42,74,.06)` | Default card — tasks, stats, redemption rows |
| **`card-pink`** | `--pink-soft` | 1px `--pink-pale` | inherit | Pink-tinted card — active task, evidence pending |
| **`card-mint`** | `--mint-soft` | 1px `--mint-pale` | inherit | Completed task, received redemption |
| **`card-sky`** | `--sky-soft` | 1px `--sky-pale` | inherit | Yael's sibling chip, Yael's identity context |
| **`card-yellow`** | `--yellow-pale` | 1px `#FFE9A8` | inherit | Campaign banner, reward emphasis |
| **`card-lavender`** | `--lavender-soft` | 1px `--lavender-pale` | inherit | Campaign detail, magic-feel cards |

**Radius:** all cards `border-radius: 20px` (some use 24px for hero cards).

**Padding:** default 12–16px. Hero cards 20–24px.

### 6.3 Pills

| Variant | Background | Text | Use |
|---|---|---|---|
| **`pill-mint`** | `--mint-pale` | `--mint-dark` | success state, completed count |
| **`pill-pink`** | `--pink-pale` | `--pink-dark` | active/pending state |
| **`pill-sky`** | `--sky-pale` | `--sky-dark` | Yael identity, time chips |
| **`pill-yellow`** | `--yellow-pale` | `--yellow-dark` | coin amount inline |
| **`pill-lavender`** | `--lavender-pale` | `--lavender-dark` | campaign / long-term |
| **`pill-grey`** | `--rule` | `--ink-soft` | metadata, neutral |

**Shape:** `border-radius: 999px`. **Padding:** `3px 10px`. **Font:** Heebo 700, 11px.

### 6.4 Progress bars

```html
<div class="pb-track">
  <div class="pb-fill" style="width: 38%; background: gradient-or-solid;"></div>
</div>
```

- Track: `--rule`, height 8px, `border-radius: 999px`.
- Fill: gradient from category color to a related color (e.g., `linear-gradient(90deg, var(--lavender), var(--lavender-dark))`).
- Always rounded at both ends.
- No animations beyond `transition: width 300ms ease`.

### 6.5 Vertical timeline (task list)

```
│
●─── completed task (mint dot, solid fill)
│
●─── completed task
│
◐─── active task (white dot, pink border with glow)
│
○─── pending task (white dot, gray border)
│
```

- Rail: 2px wide `--rule` line, on the right edge in RTL contexts.
- Dot: 14px circle, 3px border.
  - Done: `--mint` filled, `--mint` border.
  - Active: white filled, `--pink` border, `0 0 0 4px var(--pink-pale)` glow.
  - Pending: white filled, `--rule` border.

### 6.6 Tab bar (bottom nav)

5 tabs, grid, white background, 1px top border.

```
[ Home  ][ Tasks ][ Shop ][ Quests ][ Badges ]
```

- Each tab: vertical, icon on top (34×34 container) + label below.
- Active: icon container background = `--pink-pale`, label color = `--pink`.
- Inactive: container transparent, label `--ink-faded`.
- Font: Heebo 700, 10px.

### 6.7 Avatar

Always circular. Always overflow-hidden. Always contains the kid's character SVG from family 1.

```html
<div class="rounded-full overflow-hidden" style="width: 48px; aspect-ratio: 1;">
  <svg viewBox="0 0 100 100"><use href="#av-fox"/></svg>
</div>
```

Common sizes: 28px (sibling chip), 40px (admin lists), 48px (home top bar), 80–88px (profile picker).

### 6.8 Coin badge

```html
<svg width="16" height="16" viewBox="0 0 32 32"><use href="#ic-coin"/></svg>
```

Always paired with a number when shown in context. Inline format: `<coin> <number>` for "8 ¢" style display.

---

## 7. Layout & spacing

### 7.1 Phone frame standard

All design previews assume **390px viewport width** (iPhone 13/14/15 baseline). Tablet (iPad) is a horizontal-stretch of the same mobile design — not a new layout.

### 7.2 Spacing scale

Use Tailwind's default 4px-based spacing. Common values used:

| px | Tailwind | Use |
|---|---|---|
| 4px | `gap-1` | tight icon+text in pills |
| 8px | `gap-2`, `p-2` | tight grids, pill padding |
| 12px | `gap-3`, `p-3` | card padding, list row gap |
| 16px | `gap-4`, `p-4`, `mx-4` | section padding, default container margin |
| 20px | `p-5` | hero card padding |
| 24px | `mt-6` | section spacing |
| 32px | `mt-8` | major section break |
| 48px | `pt-12` | screen top padding |

### 7.3 Safe areas

- **Top safe area:** 14px above content (below the notch / status bar).
- **Bottom safe area:** 28px below the tab bar (for iPhone home-indicator).
- **Side padding:** default 20px (`px-5`) from screen edge.

### 7.4 Border radius scale

| Radius | Use |
|---|---|
| 8px | pills (when not 999px), small inline elements |
| 12px | icon containers (34×34) |
| 16px | small cards, tile interiors |
| 20px | default card |
| 24px | hero card |
| 28px | tile (shop/badge if rectangular variant ever used) |
| 999px | buttons, all pills |
| 44px | phone frame outer (visual only) |

### 7.5 Shadows

Five elevation levels:

| Level | CSS |
|---|---|
| 0 (flat) | none |
| 1 (hairline) | `0 1px 2px rgba(45,42,74,.05)` |
| 2 (card) | `0 4px 12px rgba(45,42,74,.06)` |
| 3 (CTA) | `0 4px 12px rgba(255,107,157,.35)` (pink) or `(78,217,165,.3)` (mint) |
| 4 (modal) | `0 30px 80px rgba(45,42,74,.15)` |

Never use solid black shadows. Always tint with the brand ink color at low opacity.

---

## 8. Bilingual & RTL rules

### 8.1 Direction primitives

- App's `<html dir>` flips between `rtl` (Hebrew, default) and `ltr` (English).
- All CSS uses **logical properties** — `padding-inline-start`, `margin-inline-end`, never `padding-left`/`margin-right`.
- Tailwind shortcuts: use `ps-*` / `pe-*` / `ms-*` / `me-*` (start/end), not `pl-*` / `pr-*`.

### 8.2 What flips, what doesn't

| Element | Flips in RTL? |
|---|---|
| Text alignment | ✅ Yes — right-align in RTL by default |
| Layout direction (rows) | ✅ Yes — auto via flexbox |
| Icons that depict direction (arrows, chevrons) | ✅ Yes — flip horizontally |
| Brand wordmark "Reco" | ❌ No — stays in Latin LTR even in Hebrew context |
| Numbers | ❌ No — Latin digits stay LTR |
| Coin/heart/star symbols | ❌ No — no inherent direction |
| Avatar character art | ❌ No — fox stays facing forward |
| Badge emblems | ❌ No — they're objects, no inherent direction |
| Progress bar fill | ✅ Yes — fills from right in RTL, left in LTR |
| Vertical timeline rail | ✅ Yes — rail on right in RTL, left in LTR |

### 8.3 Language switcher

Toggle lives in settings only. Per-kid language preference (Lia could be Hebrew while Yael is English). Persists in `kid.locale`.

### 8.4 Content rules

- All strings in `/packages/shared/src/i18n/dictionaries/{he,en}.json`.
- No hardcoded Hebrew or English in component code.
- A missing dictionary key is a TypeScript error.
- Bilingual UI never shows both languages on the same screen except the dev-only language preview.

---

## 9. Motion & interaction

### 9.1 Touch targets

- Minimum hit area: **44×44px** (Apple HIG minimum). Smaller visual elements (e.g., pills) must have transparent padding extending to 44px.
- Spacing between touch targets: minimum 8px.

### 9.2 Default transitions

```css
transition: transform .15s ease, background-color .15s ease, opacity .15s ease;
```

Faster than 150ms feels twitchy; slower than 250ms feels laggy. 150ms is the default.

### 9.3 Feedback patterns

| Event | Feedback |
|---|---|
| Tap on button | `transform: translateY(1px)` briefly, then back |
| Tap on task card to complete | Card slides into the "completed" mint background; checkmark animates in (300ms) |
| Earn coins | Coin counter increments with a brief scale pulse (1.0 → 1.1 → 1.0 over 400ms) |
| Earn a badge | Centered modal with the patch animating in + confetti border (Phase 9 polish) |
| Pull-to-refresh | Standard iOS-style spinner; tint = `--pink` |
| Error / failed submission | Card shake animation (10px x 3 cycles over 300ms); never red flash |

### 9.4 What NOT to animate

- Long page-transitions (no slow page slides).
- Decorative elements that aren't communicating state.
- Anything > 500ms unless it's a celebration moment.

---

## 10. Voice & tone

### 10.1 Kid-facing copy (Hebrew + English)

**Tone:** warm, encouraging, soft. Direct without being curt. Celebrates small wins. Names emotions without overplaying them.

**Do:**
- "תיכף תקבלי את התג שלך!" / "You're so close to earning your badge!"
- "Mom approved! +20 coins."
- "השלמת את כל המשימות של היום 🎉"
- "5 days in a row — keep going!"

**Don't:**
- Baby talk ("yay good job sweetie!!!") — Lia and Yael are 9–11.
- Aggressive gamification ("CRUSHED IT!! +50 XP!!!")
- Negative framing on misses ("you failed your streak").
- Sarcasm or jokes that punch down.

**Hebrew specifics:** address the kid in second person feminine (`את`) by default since both kids are girls. If a kid is added in the future who uses masculine, this is configured per-kid.

### 10.2 Parent-facing admin copy

**Tone:** calm, utilitarian, attribution-clear. Both parents see the same view, so language is collegial (no "you" vs "the other parent" framing).

**Do:**
- "Lia submitted homework — tap to review."
- "Mom approved this 2 min ago."
- "Joker action by Dad: +5 coins to Yael (reason: helped clean kitchen)."

**Don't:**
- Authoritative language ("YOU must approve this").
- Hide attribution (always show which parent did what).
- Use kid-tone (no emoji, no exclamation overload).

### 10.3 Denial / error messages

- **Never** say "Wrong!" or "Failed!" to a kid.
- **Always** offer a path forward.
- For evidence denial, parent enters a reason and the kid sees it in the parent's voice ("Mom needs a clearer photo — try again 🙂").
- Soft denial wording: "Try again", "Not yet", "Let's get another shot".

### 10.4 Numbers in copy

- Always tabular when shown in counts/balances.
- Always with the unit when ambiguous: "5 coins" / "5 ¢", not just "5".
- For approximate stats use "about" / "כ-": "about 12 days left".

---

## 11. Accessibility

### 11.1 Color contrast

Minimum WCAG AA (4.5:1 for body text, 3:1 for large text and UI components).

Checked combinations:
- `--ink` on `--bg`: ✅ 15.2:1
- `--ink` on `--card`: ✅ 16.7:1
- `--ink-soft` on `--bg`: ✅ 7.1:1
- white on `--pink`: ✅ 3.5:1 (large text only — never use white on pink for body)
- `--mint-dark` on `--mint-soft`: ✅ 8.4:1
- `--ink` on `--lavender-soft`: ✅ 13.8:1

**Pink CTA button text:** must be white AND ≥16px AND bold (Heebo 800). The combination passes AA for large text.

### 11.2 Touch targets

44×44px minimum (see §9.1).

### 11.3 Screen reader

- All meaningful icons have `aria-label` or are paired with visible text.
- Decorative icons get `aria-hidden="true"`.
- The whole SVG icon library uses `<symbol>` definitions and is wrapped in an `aria-hidden` root SVG to avoid pollution.
- Kid avatars in profile picker have `aria-label="ליה" / aria-label="Lia"` (per locale).

### 11.4 Kid text density

- No screen has more than 30 words of body copy.
- Headlines max 4 words.
- Subtitles max 8 words.
- If you need more content, break into multiple sections or use disclosure (tap to expand).

### 11.5 Reduced motion

Respect `prefers-reduced-motion`. Replace all animations >150ms with instant transitions. Confetti / celebration moments degrade to a static "🎉" badge with no motion.

---

## 12. Common patterns (recipes)

These are pre-composed recipes for common UI surfaces. Use them. Compose new ones from these before inventing.

### 12.1 Task card (daily task in timeline)

```
┌─────────────────────────────────────────┐
│  [icon]   Task title              +N¢   │
│            subtitle                      │
└─────────────────────────────────────────┘
```

- Container: `card-soft` if pending, `card-mint` if done, `card-pink` if active.
- Icon: 36–40px container with pastel background, task icon (family 2) inside.
- Title: `display-he-bold` 14–15px in `--ink`.
- Subtitle: `body-he` 10–11px in `--ink-soft`. Shows time/status.
- Coin reward: `pill-yellow` or `pill-mint` on the right, with coin glyph + `+N`.

### 12.2 Reward shop tile

```
┌─────────────────┐
│                 │
│   [reward icon] │
│                 │
├─────────────────┤
│ Title           │
│ [coin] N   [→]  │
└─────────────────┘
```

- Container: `card-soft`.
- Reward icon background: pastel tile matching reward category (e.g., `--pink-soft` for candy).
- Icon: family 4 reward icon.
- Title: `display-he-bold` 14px.
- Cost row: coin glyph + `num` 14px on the left; `btn-pink` micro-button on the right.

### 12.3 Embroidered badge tile (in collection grid)

See §5 for full anatomy. Always:
- Use the patch wrapper.
- Show count chip if earned, lock overlay if locked.
- Below the patch: badge name in `display-he-bold` 11px.

### 12.4 Sibling activity chip

```
┌────────────────────────────────────────┐
│ [avatar]  Yael earned reading badge!   │
│           12 min ago         [emblem]  │
└────────────────────────────────────────┘
```

- Container: `card-sky` if Yael, `card-pink` (slightly) if Lia.
- Avatar: family 1, 36–40px.
- Text: bold (the sibling's name + the badge name) + body (timestamp).
- Right-side: small badge emblem (family 3) at 28px in a colored circle.

### 12.5 Campaign banner

```
┌────────────────────────────────────────┐
│ [patch]  CAMPAIGN · ACTIVE             │
│          Campaign title                 │
│          Encouraging subtitle           │
└────────────────────────────────────────┘
```

- Container: `card-yellow` for upcoming, `card-lavender` for active long-term.
- Left: 48–56px patch showing the campaign's reward emblem.
- Text: small uppercase label (`display-en` 10px) + headline + subtitle.

### 12.6 Wallet stats card

See §6.2 (card-soft) — small card with metric.

### 12.7 Modal / sheet (mobile)

- Background: `card` (white) with `border-radius: 24px` on top corners only.
- Animates from bottom on mobile (drawer style).
- Backdrop: `rgba(45,42,74,.4)` blur.
- Close button: top-right corner, 36px circle with × icon.

### 12.8 Empty state

When a list is empty:
- Centered illustration (a simple drawing matching context — e.g., empty trophy case for badges).
- Headline `display-he-bold` 18px — "אין עדיין תגים" / "No badges yet".
- Subtitle `body-he` 13px in `--ink-soft` — encouragement to start a campaign.
- Optional `btn-pink` CTA to navigate to the action.

---

## 13. What NOT to do

### Don'ts (locked rules)

- ❌ **Never use pure black.** Use `--ink` (`#2D2A4A`).
- ❌ **Never use pure white at app background level.** Use `--bg` (`#FAF8F5`). White is for cards only.
- ❌ **Never use the color red.** Use `--pink-dark` for denial states.
- ❌ **Never mix kid colors on the same component.** Lia is peach, Yael is sky. Never both.
- ❌ **Never use emoji for badges or rewards in production.** Use the SVG emblem set or the licensed icon pack.
- ❌ **Never use a font outside Fredoka / Heebo / Quicksand.** No exceptions.
- ❌ **Never use proportional numerals in counts or balances.** Always tabular.
- ❌ **Never write Hebrew + English on the same kid-facing screen** (except the dev-only language preview).
- ❌ **Never use 3D shields or hanging medals for badges.** Embroidered patch only.
- ❌ **Never animate longer than 500ms** unless it's a celebration moment.
- ❌ **Never use red flashes / shake effects for denial.** Use soft pink + kind copy.
- ❌ **Never hardcode user-facing strings in component code.** Always use the dictionary.
- ❌ **Never put a kid avatar in a non-kid context.** Avatars represent identity, not decoration.
- ❌ **Never alter the locked palette tokens.** Add new tokens via §14, don't redefine `--pink`.
- ❌ **Never use `padding-left`/`margin-right`** in CSS. Logical properties only.

---

## 14. Version & governance

### 14.1 Current version

**Brandbook v1.0** — locked 2026-05-21.

### 14.2 How to update

The brandbook is the contract. Updating it means changing the contract.

**Process:**
1. Open a PR that includes both the brandbook change AND the code change implementing it.
2. The PR description must explain *why* (what changed about Reco's strategy that required the brandbook change).
3. Lily approves.
4. Bump the brandbook version in the title (`v1.1`, etc.).
5. Add a "what changed" entry to the changelog at the bottom of this section.

### 14.3 What requires a brandbook update

- Any new color token (must add to §2).
- Any new font weight or font family (must add to §3).
- Any new icon family or major icon (must add to §4).
- Any new component (must add to §6).
- Any change to badge architecture (the whole §5 is currently locked).
- Any voice/tone exception (must add to §10).

### 14.4 What does NOT require a brandbook update

- Adding a new badge emblem within the family 3 style (e.g., a 9th badge for "1000 tasks") — just follow the existing rules.
- Adding a new task icon within the family 2 style.
- Composing existing components into new patterns (recipes — but consider adding to §12 if reused).

### 14.5 Companion documents

- **`brandbook.html`** — visual showroom of all components. Update alongside this document.
- **`/packages/shared/src/design-tokens/`** — TypeScript export of all tokens. Code uses these, not raw hex.
- **`CLAUDE.md`** at repo root — instructs future Claude sessions to read this document.

### 14.6 Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-21 | Initial lock. Plush concept + Embroidered Patch badge architecture. |

---

*This brandbook is the contract. Read it before designing. Cite it in PRs. Update it when the brand evolves. The brandbook wins when in conflict with code or with prior decisions.*
