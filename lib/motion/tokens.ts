/**
 * Motion design tokens — single source of truth.
 * Derived from DESIGN.md §5.1, PRD §12.7, and the Catalis reference
 * (`DESIGN (1).md` → Motion Tokens). Decisions: docs/VISUAL-CATALIS.md §C.
 *
 * Durations are in seconds because Framer Motion expects seconds.
 *  - feedback: 100–140ms (hover / focus / press)
 *  - data:     160–240ms (slider, swap, lock, value changes)
 *  - reveal:   300–400ms (a single item entering)
 *  - line:     400–700ms (a display line unveiling behind its mask)
 *  - layout:   240–320ms (panel / layout movement)
 *
 * The work interactions (slider, lock, swap, undo) deliberately keep the short
 * `data` band: a data change may never be delayed by an entrance animation.
 * Only editorial surfaces use the longer `line`/`reveal` bands.
 */
export const DURATION = {
  feedback: 0.12,
  hover: 0.2,
  data: 0.2,
  reveal: 0.36,
  line: 0.62,
  layout: 0.28,
  /* T-5.13 (Master Design & Motion Specification §J). */
  entrance: 0.48,
  indicator: 0.28,
  nudge: 0.15,
  modalIn: 0.24,
  modalOut: 0.18,
  labelFade: 0.12,
  railWidth: 0.32,
} as const;

/**
 * Ease-out for entrances, standard for movement. No bounce, no elastic.
 * `out` is the reference's `cubic-bezier(0.22, 1, 0.36, 1)`; `outSoft` is the
 * same curve with a gentler tail for mask unveils, where a fast finish would
 * make the line snap into place.
 *
 * T-5.13 adds the three curves the master spec names explicitly. They are kept
 * separate from `out` rather than replacing it, because 56 components already
 * reference `out` and a silent retune of every one of them is not a redesign,
 * it is a regression nobody reviewed.
 */
export const EASE = {
  out: [0.22, 1, 0.36, 1] as [number, number, number, number],
  outSoft: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
  /** Page and card entrance: `cubic-bezier(0.16, 1, 0.3, 1)`. */
  entrance: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** Sidebar active indicator and icon nudge. */
  indicator: [0.25, 1, 0.5, 1] as [number, number, number, number],
  /** Card and row hover. */
  hover: [0.2, 0, 0, 1] as [number, number, number, number],
} as const;

/** Transition presets reused across workspace components. */
export const TRANSITION = {
  feedback: { duration: DURATION.feedback, ease: EASE.out },
  hover: { duration: DURATION.hover, ease: EASE.out },
  data: { duration: DURATION.data, ease: EASE.inOut },
  layout: { duration: DURATION.layout, ease: EASE.inOut },
  enter: { duration: DURATION.data, ease: EASE.out },
  reveal: { duration: DURATION.reveal, ease: EASE.out },
  line: { duration: DURATION.line, ease: EASE.outSoft },
  /* T-5.13 presets. */
  entrance: { duration: DURATION.entrance, ease: EASE.entrance },
  indicator: { duration: DURATION.indicator, ease: EASE.indicator },
  cardHover: { duration: DURATION.hover, ease: EASE.hover },
  nudge: { duration: DURATION.nudge, ease: EASE.indicator },
} as const;

/**
 * T-5.13 card entrance. One shared shape so every page enters the same way:
 * opacity 0 -> 1 with translateY(10px) -> 0 over 480ms, cards 45ms apart.
 */
export const ENTRANCE = {
  container: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
  },
  item: {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: DURATION.entrance, ease: EASE.entrance } },
  },
} as const;

/** Container stagger: 70ms between items, inside the 50–100ms reference band. */
export const STAGGER = {
  container: { hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } },
  item: {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: DURATION.reveal, ease: EASE.out } },
  },
} as const;

/**
 * Scroll choreography constants.
 *
 * Each section declares a *denominator* for its own scroll range so the reveal
 * completes within the section rather than over the whole document. Framer
 * Motion's `useScroll({ target, offset })` accepts the strings below; keeping
 * them here means one place decides how early a section starts moving.
 */
export const SCROLL = {
  /** Start as the section's top reaches 85% of the viewport, finish at 45%. */
  section: ['start 0.85', 'start 0.45'] as const,
  /** For tall sections: track the element through its own height. */
  through: ['start 0.9', 'end 0.55'] as const,
  /**
   * The bar that draws itself across a multi-step list.
   *
   * Deliberately wide (`start 0.95` → `end 0.25`). A short rail completes in a
   * tiny fraction of the viewport, so a narrow range made the line snap to full
   * length before the reader had scrolled to it. Spanning most of the viewport
   * gives the draw enough distance to actually be watched.
   */
  progress: ['start 0.95', 'end 0.25'] as const,
} as const;
