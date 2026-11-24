# T-3.VISUAL — Catalis Visual & Motion System

**Task:** visual redesign + motion upgrade of all five routes.
**Principle:** redesign the experience, preserve the product behaviour.
**Reference:** `DESIGN (1).md` (Catalis style reference, read in full). It is a visual and motion
reference, not a product spec: no pricing, testimonials, blog, newsletter, logo bar, or invented
statistics were carried over.

**Dial (antislop Part 3):** ENERGY 2 / RHYTHM 2 / MOTION 2.
Reason — this is a working tool, so the canvas stays calm and the type does the talking (2, not 3);
workspace pages repeat one deliberate composition so the user learns it once, while the two public
pages (`/`, `/how-it-works`) vary their composition (2, not 1); motion explains state changes and
never decorates data (2, not 3).

---

## A. Audit (Tahap A)

Verified in the repository, not assumed:

| Item | State |
|---|---|
| Branch / HEAD | `redesign/fuelplate-ui`, `9b62e3d`, working tree dirty with the user's own changes. No commit, push, or deploy. |
| Previous visual language | `DESIGN.md` + `app/globals.css`: warm paper (`#f3f1eb`), sage accent, Fraunces serif headings. Light + dark themes both shipping. |
| Reference file | Not in the repo. Found at `/home/nando/Downloads/DESIGN (1).md` and read in full. |
| Fonts | `next/font/google` is the existing loader. `Inter Tight` and `Instrument Serif` are both present in `next/dist/compiled/@next/font/dist/google/font-data.json`, so no new package is needed and no font file is installed by hand. |
| Motion library | `framer-motion@14.14.0` already a dependency. |
| Reduced motion | `lib/motion/use-reduced-motion.ts` (hydration-safe `useSyncExternalStore`, server snapshot `false`) already adopted everywhere. |
| Motion tokens | `lib/motion/tokens.ts` (`DURATION`, `EASE`, `STAGGER`). |
| Shared UI | `components/ui/primitives.tsx` (`Button`, `ButtonLink`, `Chip`, `Panel`, `Eyebrow`, `FIELD`), `components/ui/workspace-nav.tsx`, `components/ui/theme-toggle.tsx`, `components/motion/reveal.tsx`, `components/motion/score-bar.tsx`, `components/recommendations/score-breakdown.tsx`. |
| Routes | `/`, `/p/[code]/members`, `/p/[code]/members/[id]`, `/p/[code]/tasks`, `/p/[code]/result`, `/how-it-works`. The member profile route also gets the new language so the five public routes do not break their own internal links. |
| Playwright | Not a repo dependency. Browser verification uses the existing npx cache module; `package.json` untouched. |
| Baseline tests | typecheck PASS, lint 0/0, `vitest run --exclude test/integration/**` 287 passed + 4 skipped (22 files). |

### Notes taken from the reference that are *not* applied, with the reason

| Reference element | Not applied because |
|---|---|
| Count-up statistics (80%, $70k, 99) | R-17/R-36: invented numbers. Product numbers here are computed; animating them would delay reading real data. |
| Infinite testimonial marquee | No testimonials exist, and a loop longer than 5 s needs a pause control (R-39). |
| Hero corner brackets + three layered dashboard cards | Hero cards are the reference's finance-product imagery. On `/` the focal point is the project form, which is the real product. |
| 4-column footer link index | This product has three destinations; a four-column index would be empty structure (R-05). |
| Rotating star, 12–20 s infinite | R-19: endless decorative loop. The star is static, and it earns its place as the accent-word marker, which is a real typographic job. |
| Parallax card drift | No card composition to drift, and it would fight the matrix. |
| Newsletter form | No newsletter exists. |

---

## B. Design mapping (Tahap B)

| Page | Old UI (Fuelplate) | New (Catalis) | Function that must survive |
|---|---|---|---|
| `/` | Warm paper canvas, Fraunces serif H1, sage CTA, four hairline step cells, score-composition rows, giant serif footer wordmark. | White canvas + Mist bands. Inter Tight display H1 with one Instrument Serif *italic accent* word. Azure star marker above the eyebrow. Form panel is a floating card with measured shadow. Steps become a numbered register on Mist. Score composition becomes a K/S/C/M register with azure italic lead-in. Footer keeps the oversized wordmark as an ink-tinted graphic closer. | `POST /api/projects`, client-side validation (empty title, >100 chars, empty deadline), success block with code + link, `/how-it-works` link, theme toggle. |
| `/p/[code]/members` | Paper surfaces, serif H1, sage "cukup" banner. | Workspace chrome on white. Mist count/status plates. Roster is a register: hairline rows, tabular index, azure-tint hover. "Kelola tugas" band becomes an Azure Tint panel, not a green block. | `GET`/`POST /api/projects/[code]/members`, validation (empty, >60), `ready = members.length >= 2`, no member cap. |
| `/p/[code]/members/[id]` | Paper panels, serif H1, skill rows as sunken cards. | Same register language. Skill rows numbered, level/interest stay native `<select>`. | `GET`/`PUT` member, `memberProfileSchema`, all field limits, success/error banners. |
| `/p/[code]/tasks` | Paper panels, serif H1, chips, template drafts list, AI proposal panel. | Register rows on white with hairline dividers; skill chips become azure-tinted labels; the AI proposal panel is an Azure Tint card with a star marker. Progress bar uses `scaleX`. | All handlers unchanged: `loadTasks`, `handleSubmit`, `handleLoadTemplates`, `handleAiAnalysis`, `handleApplyAnalyses`, `handleDelete`, `taskSchema`, `SKILL_TAXONOMY`. |
| `/p/[code]/result` | Paper, serif H1, matrix with sage/clay row states, sage lock tint. | Matrix becomes the focal point of a white canvas. Row states: locked = Azure Tint + lock bar; changed-now = azure wash. Primary cell = Ink fill (Ink is the default action colour per the reference), not sage. Load meters keep `scaleX`. Fallback banner = amber, persistent. | Every scoring rule, keyboard shortcut, slider, what-if, lock, undo, export, comparison, event log. **No calculation code touched.** |
| `/how-it-works` | Paper, serif H1, formula block. | Editorial reference page: display hero with italic accent, formula as a bordered display line with azure italic lead-in words, R1–R5 as a numbered register, worked example in a Mist block. Section reveals on first visibility. | Static content only (FR-15). Formula text and worked example unchanged (they already match the PRD). |

---

## C. Tokens

### Colour (`app/globals.css`)

Semantic names are kept (`paper`, `card`, `ink`, `muted`, `line`, `accent`, …) so the 56 existing
class usages keep working while the values move to Catalis. Two names were added: `mist` (the
one-step-deeper surface the reference uses instead of borders) and `clay` keeps its role as the
"changed / attention" wash, now azure rather than terracotta.

| Role | Light | Dark |
|---|---|---|
| Canvas `paper` | `#ffffff` | `#0b1220` (Ink Deep family) |
| Mist `mist` / `surface` | `#f5f7fb` | `#111a2c` |
| Card `card` | `#ffffff` | `#131d31` |
| Ink `ink` | `#0b1220` | `#f2f5fb` |
| Slate `muted` | `#4a5568` | `#aab4c6` |
| Cloud `line` | `#e6eaf2` | `rgba(230,234,242,0.12)` |
| Azure `accent` | `#2f66ff` | `#7b9dff` |
| Azure Tint `sage` → tint | `#eaf0ff` | `#16234a` |
| Attention wash `clay` | `#eaf0ff` | `#1b2a52` |
| K / S / C / M | ink-shifted blue, green, amber, violet (unchanged meaning) | same hues, lightened |

Azure appears only on: the star marker, the italic accent word, the primary action fill, focus
ring, selected/active state, link hover, and the matrix's primary bar. Everything else is ink,
slate, fog, or a tint.

### Typography

| Role | Family | Weight | Size |
|---|---|---|---|
| display | Inter Tight | 500 | `clamp(40px, 6vw, 64px)`, tracking `-0.03em`, line-height 1.08 |
| heading | Inter Tight | 500 | 32–40px, tracking `-0.02em` |
| card title | Inter Tight | 500 | 20–22px, tracking `-0.01em` |
| italic accent | Instrument Serif | 400 italic | inherits size, azure |
| body | Inter | 400 | 16px / 1.6 |
| body-sm | Inter | 400 | 14px / 1.55 |
| caption | Inter | 400 | 12px / 1.5 |
| eyebrow | Inter | 500 | 12px, `0.04em`, uppercase |
| numeric | Geist Mono | 500 | any size, `tabular-nums` |

Reason: Inter Tight's tighter fit is what makes the reference's display lines feel editorial at
40–64 px; Instrument Serif italic is the closest available companion for the single accent word and
is already available through the existing loader. Geist Mono stays for numbers only, where
alignment matters more than warmth.

### Shape, spacing, elevation

Base 4px. Inputs 12px, icon plates 14px, cards 20–24px, large panels 28px, buttons pill.
Shadows are the reference's three levels only: `hairline` (`0 0 0 1px`), `soft`
(`0 1px 2px / 0 8px 24px`), `lift` (`0 2px 4px / 0 16px 40px`). Cards use `hairline` at rest and
`soft` on hover; only the homepage form panel and floating chrome use `lift`.

### Motion

`lib/motion/tokens.ts` is the single source of truth:
`EASE.out = cubic-bezier(0.22, 1, 0.36, 1)`, `EASE.outSoft = cubic-bezier(0.16, 1, 0.3, 1)`
(for mask unveils, where a fast tail would snap), `EASE.inOut = cubic-bezier(0.4, 0, 0.2, 1)`.
Bands: feedback 120 ms, hover 200 ms, data 200 ms, reveal 360 ms, **line 620 ms**, layout 280 ms,
stagger 70 ms. `line` is the only band above 400 ms and it is used exclusively by editorial
surfaces (headline masks, rule draws, bar growth); every work interaction stays on `data`.

`SCROLL` holds the three scroll ranges so one file decides how early a section starts moving.

#### The scroll mechanism, and why it is not a scroll listener

Two primitives, chosen per effect:

| Need | Mechanism | Why not the alternative |
|---|---|---|
| One-off entrance | `whileInView` (IntersectionObserver, `once: true`) | A scroll listener calling `setState` re-renders React on every frame of every scroll — DESIGN.md §5.3 forbids it. Observer-backed reveals cost nothing per frame. |
| Genuinely scroll-*linked* motion (hero drift, step rail draw, page progress) | `useScroll({ target })` + `useTransform` → written to `transform` only | Values go straight to the compositor; React never re-renders. Measured: ~2.8 DOM attribute writes per scroll frame, all style. |

**A trap worth recording.** `whileInView` observes the element it is attached to. If that element is
itself hidden at rest — a headline at `translateY(105%)` behind its mask, a rule at `scaleX(0)` — the
browser reports it as near-zero visible area, so a `amount: 0.2` threshold is never met and the reveal
*never fires*. `MaskLine` and `DrawRule` therefore put the observer on the **outer** box (which keeps
its layout size) and drive the inner element by variant. This was caught by instrumenting the
computed transform of the inner span, not by looking at a screenshot: the text was simply absent.

Reduced motion is handled twice on purpose: the hook returns plain elements so no `opacity:0` is
emitted during SSR, and a CSS rule forces `[data-motion-reveal]` visible at first paint regardless of
JS timing. Scroll-linked decorations are **not rendered at all** under reduced motion (a rail pinned
at 100% would claim a journey that has not happened), and the hero's drift/parallax is disabled.

---

## D. Why each decision (R-31)

- **White canvas, no gradient**: the numbers must be the brightest thing on the page; a background wash competes with the matrix. Reason written here because R-01 asks for one.
- **Azure for primary action instead of Ink**: measured against the alternating Mist/white page, an Ink fill and an Azure fill both pass contrast; Azure was chosen because the reference reserves Ink for text and Azure for the one action, and because it keeps Azure scarce rather than spreading it.
- **Italic accent on exactly one word per headline**: it is the reference's signature and it does a real job, it marks the noun the sentence is about (`kelompok`, `data`, `matriks`, `bobot`, `cadangan`).
- **Star marker above eyebrows**: it repeats the accent word's meaning, it is the identity motif, and it is static so it never pulls the eye away from data.
- **Matrix stays a table**: the reference's card language would destroy scanability across 7 tasks × N members. The table keeps hairlines, tabular numerals, a sticky row header, and internal horizontal scroll.
- **Text-roll only on pill buttons and nav CTAs**: inside the matrix, buttons are dense 28 px controls where a rolling label would move under the cursor while the user is working. Their labels stay still.
- **Floating motion only on the homepage form card**: it is a large, non-blocking target and the float is 7 s with ±5 px. It additionally **stops permanently** after ~4.2 s or on the first pointer-down / focus inside the panel: an indefinitely drifting form is hostile to aim at, and it made a synthetic click unable to resolve the target as stable. The decoration is an entrance gesture, not a permanent state.
- **Every text reveal keeps the sentence as one text node**: `MaskLine` masks a block and translates it; it never splits a heading into words or characters. Screen readers get one sentence, CSS wrapping is the real wrapping at every width, there is no measurement pass, and there is no hydration mismatch.
- **No theme removal**: the product ships light and dark; both were re-derived from the Catalis palette rather than deleted.

---

## E. Implemented per route

All five routes now speak one language: white canvas, Mist bands, Inter Tight display with a
single Instrument Serif italic accent word, hairline borders, azure used only for the star, the
accent word, the primary action, the focus ring and the selected/locked tint.

| Route | What changed | What did not change |
|---|---|---|
| `/` | Editorial hero with italic `kelompok`; form panel on an azure-tint wash; numbered step register on a Mist band; score register with proportional bars; oversized footer wordmark | The single `POST /api/projects`, its validation, the success block and its links |
| `/p/[code]/members` | Display heading with italic `kelompok`; count/status as two figures split by a hairline; add form on canvas; roster as a register table on white with Mist header; readiness banner in azure tint | GET on mount, POST `{ name }`, 60-char limit, the 2-member rule, no member cap |
| `/p/[code]/members/[id]` | Editorial header with italic `anggota`; skill rows as a divided register inside a Mist plate; native `<select>` kept | `memberProfileSchema`, PUT payload, every field limit and error string |
| `/p/[code]/tasks` | Display heading with italic `tugas`; task register with hairline chips; AI proposal panel in azure tint; template drafts on a Mist header; 32px skill pills | Every handler, endpoint, `taskSchema` call, template flow and AI confirm-before-write rule |
| `/p/[code]/result` | Display heading with italic `penugasan`; primary cell = Ink fill; locked = azure tint; changed-now = azure wash; azure focus ring; sliders restyled with per-component hue tracks | All scoring, `globalAssign`, keyboard, what-if, lock, undo, export, comparison, event logging |
| `/how-it-works` | Editorial reference page: formula as a display line, component table, R1–R5 register, AI limits, worked example | Static content and every stated number |

### Defects found by browser instrumentation and fixed

1. **Nested reveal groups left at `opacity: 0`.** A Framer Motion variant child only animates
   while its own parent is mid-variant, so a `RevealGroup` inside a `RevealGroup` never ran its
   `whileInView` and the whole step grid and score register rendered as empty boxes. Fixed by a
   `nested` prop that gives the inner group its own `whileInView`.
2. **Footer wordmark clipped.** `leading-[0.78]` inside an `overflow-hidden` box cut the ascenders.
   Fixed by `leading-[0.9]` and cropping only the descender space.
3. **Range sliders rendered with no visible track.** The rewritten stylesheet dropped the old
   range styling while utility classes set `appearance: none`. Fixed with explicit track/thumb
   rules that inherit `color` from each slider, so K/S/C/M keep their own hue.
4. **`--cloud` was referenced but never defined.** Added to all three theme contexts (explicit
   light, explicit dark, `prefers-color-scheme`), which also restores the `bg-cloud` track fills.
5. **Three 404s in the production console on `/result`.** Navigation hrefs were built from
   `resolvedCode`, which is `''` until the params promise resolves, so Next prefetched
   `/p/members` instead of `/p/<code>/members`. Fixed by rendering no tab links until the code is
   known, and by skipping the tab container entirely while it is empty.
6. **Azure text on tinted plates under AA.** `#2F66FF` on Mist measured 4.38:1, below the 4.5 bar
   for body text. The formula plate on `/how-it-works` became `bg-card` (white, 4.70:1) and the
   worked-example result plus the `accent` chip moved to the new `accent-strong` step
   (`#1D4ED8` light / `#9FB4FF` dark), which reaches 6.70:1 on white and 5.87:1 on azure tint.
7. **Filled azure buttons failed on their own label.** White on `#2F66FF` is 4.70:1, but
   `#0B1220` on `#2F66FF` is only 2.79:1. `--accent-ink` is therefore white in the light theme
   (it flips to `#060A14` in dark, where the azure is the lighter `#7B9DFF`), and every filled
   primary action uses `bg-accent-strong` so its label clears AA at 6.70:1.
8. **Meta text at 11px sat at 3.02:1.** `--fog` was lightened past usefulness (`#8B95A7` on
   white). Darkened to `#5B6172` (6.18:1 on white, 5.76:1 on Mist); the dark-theme value
   `#8792A6` already passed at 5.36:1–5.97:1 and was left alone.
9. **Mobile row actions were 28px tall.** `Ubah`/`Hapus` on `/tasks` were below the comfortable
   touch height at 390px. `Button size="sm"` is now `h-8` with `max-sm:h-11`, so dense desktop
   rows keep their rhythm while a thumb gets a 44px target. The decorative `sr-only` checkbox
   inputs stay 1×1 by design; their visible `<label>` is the real target.

### Contrast: how the failure count is interpreted

`/tmp/pw/contrast-px.mjs` walks each text node's ancestry for a painted backdrop. It reports six
failures, all on the **active** workspace tab (`Anggota` / `Tugas` / `Matriks`), at 1.07:1 light and
1.08:1 dark. Those six are a **measurement artifact, not a defect**: the ink pill is an
absolutely-positioned *sibling* of the label, not an ancestor, so the walker never sees it. Two
independent methods disagree with the walker and agree with each other:

- Pixel sampling of the rendered navbar (`px2.mjs`, dark/light extremes per pill): 18.72:1 in
  the light theme, 17.14:1 in the dark theme, and 7.53:1 for inactive tabs.
- The corrected walk (`tabcheck2.mjs`), which includes the positioned sibling layer: 18.72:1
  light / 17.14:1 dark, inactive 7.02:1 / 8.32:1.

Every other pair passes; lowest passing ratios are 4.38 (`/`, 20px large-text threshold met),
4.70 (`/how-it-works`), 5.36–6.50 elsewhere.
