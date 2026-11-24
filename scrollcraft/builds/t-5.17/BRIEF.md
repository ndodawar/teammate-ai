# BRIEF: Teammate AI scroll-craft integration (T-5.17)

Self-authored under explicit creative delegation, not interviewed. The task
specifies the outcome (integrate Scroll Craft's standard across the existing
product), so the eight interview topics are answered from the product's own
brief and design system rather than from a new client.

## 0. What this is

Teammate AI divides group-project tasks by data: content similarity, skill fit,
remaining capacity, and interest. The score is deterministic (0.40K + 0.30S +
0.20C + 0.10M) with hard rules R1-R5, and AI only reads task text. The site is
Indonesian, editorial, "quiet luxury" (bone canvas, hairline rules, one
champagne-gold accent, Inter Tight display + one Instrument Serif italic word).

This is NOT a greenfield landing page. It is an existing working product with
six routes, a real API, a real scoring engine and a real form. The job is to
give that product a scroll experience without touching a single rule of
business logic. That constraint shapes every decision below: the page grammar
must be one that a *product* can carry, not one that only a marketing splash
can.

## 1. Vibe, in three to five words

Measured, editorial, tactile, quiet, certain. References from other media: a
well-set technical report, a letterpress proof sheet, a Swiss timetable.

## 2. The scroll journey

- Homepage: the promise and the form (first screen), then the four-step method
  as a staged argument, then the score composition as a proof plate, then the
  close.
- How it works: the opening claim, then the formula as a display line, then the
  five hard rules as a ruled list, then a worked example that unpacks term by
  term, then the AI's actual role.
- Workspace routes (members, tasks, results): ordinary product surfaces. Scroll
  motion here is functional and light. These are not landing pages and must not
  pretend to be.

## 3. Energy curve

Calm at the opening (the reader is here to do something), a build through the
method, a held peak at the score proof, and a settled close. The workspace
routes stay flat and functional on purpose.

## 4. Feeling, stage by stage, and the one moment to remember

```
1  Orientation   the promise, the form, and one lit surface. Nothing has moved yet.
2  Understanding the four steps advance one at a time while the plate holds still
3  Trust         the score components fill to their real weights, in order
4  Resolve       the reader knows exactly what happens next and where to start
```

The one moment: **watching the four weights arrive one after another and
landing on a total that is exactly 1.00.** It is the argument of the whole
product in one gesture, and it is the peak.

## 5. One thing no other site does

The **weight ledger**. As the reader scrolls the score section, each component
(K, S, C, M) arrives in turn, and a running total in the margin accumulates
0.40, then 0.70, then 0.90, then 1.00. The total is the real sum of the real
weights, computed from the page's own data, and it resolves to exactly one.
It exists only here because the product's whole credibility rests on those four
numbers adding up.

## 6. Aesthetic range

Premium-minimal / editorial. This is the product's existing register and the
task requires preserving it. Not brutalist, not maximalist: the design system
already decided this and DESIGN.md governs.

## 7. One unbroken world, or distinct scenes?

Distinct scenes. The product is a tool with pages, not a single camera flight.
A continuous world would fight the existing routes and the workspace chrome.

## 8. Assets

Supplied: the product's own logo mark, its colour tokens, its typography, and
its real copy and real numbers. No new imagery, no generated video, no paid
assets. The depth therefore has to come from typography, rules, layered CSS
surfaces and real data, not from photography. That is a deliberate fit with the
editorial register rather than a limitation to apologise for.

## Page grammar

**Chaptered editorial** (uniqueness.md 2.2) for the two public routes, and
**live surface** (2.3) for the workspace routes, because those routes *are*
the product running.

Why the other grammars lost, for the homepage and how-it-works:

- **Filmic one-shot**: forbids the visible sequence the method genuinely has,
  and requires one entry point. A product with a form and six routes is not one
  shot.
- **Live surface** on the public routes: banned here because the homepage's job
  is to explain, and the real surface is one click away. Using it twice would
  also collapse the fingerprint distance between the public and workspace
  routes.
- **Continuous world**: requires worldflight video. No video assets, and the
  task forbids adding paid assets without approval.
- **Typographic poster**: forbids the form. The homepage's primary action is a
  real form and it must stay.
- **Gallery/catalog**: there is no range of objects to walk.
- **Split stage**: there is no two-sided argument.
- **Rhythmic cutlist**: wrong register entirely for a tool that asks for trust.

Chaptered editorial fits because the product's case is made in chapters (the
method, the formula, the rules, the worked example) and because its bans
(no drift gradient, no scrub hero, no magnetic CTA, no centred hero copy) are
exactly the AI-landing-page defaults the task tells me not to produce.

## Signature move

**The weight ledger.** See section 5. Implemented as a page-local element
driven from the act's own `--sc-p` and the page's own real weight data. The
engine is not touched.

## Tell-someone sentence

"It's the site where the four score weights tick up in order and land on
exactly 1.00 while you watch."

## The peak

The weight ledger act, in the "Komposisi skor" section. It gets the largest
span on the page (2.6vh), the silence before it (the method act ends quietly),
and the most room.

## Authored silence

The first viewport of the method act is a ground-only frame: the plate is
present and lit, the copy arrives just after. This is intentional, not dead
scroll, and it is recorded here so the verification pass can tell it apart.

## Fingerprint gate

The registry was empty before this build (`scrollcraft/FINGERPRINTS.md`, seeded
by `workspace.mjs --ensure`), so there is nothing to clear against. The row is
appended after delivery.

## Constraint that outranks the skill

The task's section 12 forbids changing API, database, auth, score formula,
R1-R5, AI pipeline, assignment engine, calendar, export, what-if/lock/swap/undo,
and all routes. Nothing below touches any of them. Every scroll device is
presentational and additive: with JavaScript disabled or reduced motion on, the
pages read as plain documents with their full content and working controls.
