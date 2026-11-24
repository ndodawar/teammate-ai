'use client';

import { motion, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { useRef, type ElementType, type ReactNode } from 'react';
import { DURATION, EASE, SCROLL } from '@/lib/motion/tokens';

/**
 * Motion primitives (Catalis-derived), scroll-driven.
 *
 * Two invariants that must never be broken:
 *  1. Nothing may be invisible at first paint under `prefers-reduced-motion`.
 *     When the user asks for less motion we return the plain element — not a
 *     motion element with `initial={false}` — so no opacity:0 style is ever
 *     emitted during SSR or the first client render.
 *  2. `motion[as]` must not be called inline. `motion.div` etc. are stable
 *     proxies, but indexing them per-render inside a component creates fresh
 *     elements that lose their animation state. We resolve them once, at module
 *     scope.
 *
 * Why `whileInView` rather than a scroll-position listener: a scroll listener
 * that calls setState re-renders React on every frame of every scroll, which is
 * exactly the jank DESIGN.md §5.3 asks us to avoid. IntersectionObserver-backed
 * `whileInView` costs nothing per frame, and the genuinely scroll-*linked*
 * effects (parallax, the step progress bar) use `useScroll` with `target` so
 * they only recompute while their own element is on screen.
 */
const MOTION_TAGS = {
  div: motion.div,
  section: motion.section,
  ul: motion.ul,
  ol: motion.ol,
  li: motion.li,
  p: motion.p,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  span: motion.span,
  tr: motion.tr,
  tbody: motion.tbody,
} as const;

export type MotionTag = keyof typeof MOTION_TAGS;

/*
 * T-5.15: the entrance primitives now delegate to `scroll-reveal.tsx`, which
 * drives GSAP ScrollTrigger.
 *
 * The framer-motion implementations that lived here were built on variant
 * propagation (a parent carrying `initial="hidden" whileInView="visible"` with
 * `variants`-only children). Measured in this app, framer-motion 14.14.0
 * resolves that subtree straight to its final state: an isolated route showed
 * the child pinned at `translateY(26.87px)` for all 170 sampled frames, while the
 * same motion written as direct props animated normally. The result was that
 * every RevealGroup, MaskLine and DrawRule in the product sat at its arrived
 * state from the first frame, which is the "motion is gone" report.
 *
 * Re-exporting rather than rewriting 40+ call sites keeps the diff honest: the
 * public API (`RevealGroup`, `RevealItem`, `MaskLine`, `DrawRule`) is unchanged,
 * so no page has to be touched to pick up the fix.
 */
export { MaskLine, DrawRule, RevealGroup } from './scroll-reveal';

/**
 * Single item inside a RevealGroup.
 *
 * Kept for source compatibility: `RevealGroup` now reveals its direct children
 * itself, so this is a plain wrapper that supplies nothing but the element. Any
 * item rendered inside a `RevealGroup` is revealed in sequence by the group.
 */
export function RevealItem({
  children,
  className,
  as = 'div',
  role,
}: {
  children: ReactNode;
  className?: string;
  as?: MotionTag;
  role?: string;
}) {
  const Plain = as as ElementType;
  return (
    <Plain className={className} role={role}>
      {children}
    </Plain>
  );
}

/**
 * Standalone entrance for content that is inserted after an interaction:
 * validation errors, success panels, save confirmations.
 *
 * Designed to sit directly inside `AnimatePresence`; carries its own exit.
 */
export function RevealOnce({
  children,
  className,
  as = 'div',
  role,
}: {
  children: ReactNode;
  className?: string;
  as?: MotionTag;
  role?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const Comp = MOTION_TAGS[as];

  if (reduced) {
    const Plain = as as 'div';
    return (
      <Plain className={className} role={role}>
        {children}
      </Plain>
    );
  }

  return (
    <Comp
      className={className}
      role={role}
      data-motion-reveal=""
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: DURATION.feedback, ease: EASE.out }}
    >
      {children}
    </Comp>
  );
}

/**
 * Decorative float for non-interactive elements only (reference: 6-8s cycle,
 * translateY max ~6-8px, phase offset so two elements never move together).
 * Never wrap a button, input, score, matrix, or load bar in this.
 */
export function Floating({
  children,
  className,
  delay = 0,
  amplitude = 6,
}: {
  children: ReactNode;
  className?: string;
  /** Phase offset in seconds. */
  delay?: number;
  amplitude?: number;
}) {
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      data-motion-reveal=""
      animate={{ y: [0, -amplitude, 0] }}
      transition={{ duration: 7, ease: 'easeInOut', repeat: Infinity, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
 * Scroll-linked primitives
 * ------------------------------------------------------------------------- */

/**
 * Scroll progress of one element through the viewport, 0 → 1.
 *
 * Returned as a MotionValue, not React state: it is written straight to a
 * transform by the consuming component, so scrolling never re-renders React.
 * `target` keeps the value tied to that element's own travel, so a section
 * completes its motion within itself instead of over the whole page.
 *
 * Under reduced motion the value is pinned at 1, which makes every consumer
 * render its "arrived" state: nothing depends on scrolling to become visible.
 * Consumers should still *not render* a scroll decoration under reduced motion
 * where a pinned value would misrepresent state (see the "Alur Produk" rail).
 */
export function useSectionProgress<T extends HTMLElement = HTMLDivElement>(
  options?: { offset?: readonly [string, string]; spring?: boolean; enabled?: boolean },
) {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();
  /*
   * `enabled` exists because a target ref can be mounted *later* than the hook:
   * a section that only renders once data has loaded has no DOM node on the
   * first render, and framer-motion throws "Target ref is defined but not
   * hydrated" when it tries to measure one. Passing `enabled: false` until the
   * node exists keeps the hook call order stable while never asking motion to
   * measure a ref that is not attached yet.
   */
  const enabled = options?.enabled ?? true;
  const { scrollYProgress } = useScroll(
    enabled
      ? {
          target: ref,
          offset: (options?.offset ?? SCROLL.section) as unknown as ['start 0.85', 'start 0.45'],
        }
      : {},
  );
  const eased = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  const ONE = useTransform(eased, () => 1);

  return { ref, progress: reduced ? ONE : scrollYProgress, smooth: eased, reduced };
}

/* ---------------------------------------------------------------------------
 * Scroll-driven worked example
 * ------------------------------------------------------------------------- */

export type ScoreTerm = { code: string; weight: string; component: string; product: string; hue: string };

/**
 * The K/S/C/M terms of one worked example, accumulated as the reader scrolls.
 *
 * This is the `progress` device from the reference applied where it earns its
 * keep: the reader watches the four weighted terms sum to the final score, so
 * the arithmetic is understood rather than merely printed. It is scroll-linked,
 * not scroll-hijacked: the page scrolls exactly as far as it always did, the
 * terms simply arrive in step with the reader's own position.
 *
 * The full sum is always present as text in the DOM from first paint, so the
 * value is readable by a screen reader, by a search engine, and by anyone who
 * never scrolls. What scrolls is only the emphasis (opacity and a 2px lift),
 * never the information. Under reduced motion every term renders at rest.
 */
export function ScoreWalkthrough({ terms, total }: { terms: ScoreTerm[]; total: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  // The window is long on purpose: the reader must be able to stop anywhere in
  // the section and see a stable state. `start 0.9` means the first term is
  // already legible before any scrolling happens.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.9', 'end 0.55'],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 130, damping: 30, restDelta: 0.001 });

  /*
   * Each term owns one fifth of the window and the last fifth belongs to the
   * closing formula, so the sequence is: K, then K+S, then +C, then +M, then the
   * full expression resolves with the total. Every term reaches full opacity
   * well before the next one starts, which is what makes each step readable
   * rather than a continuous fade.
   */
  const segment = 0.8 / terms.length;
  const ranges = terms.map((_, index) => {
    const start = index * segment;
    return { start, end: start + segment * 0.75 };
  });
  const formulaProgress = useTransform(smooth, [0.8, 1], [0, 1]);

  return (
    <div ref={ref} className="space-y-4">
      <ol
        className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] bg-line sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Empat suku skor"
      >
        {terms.map((term, index) => (
          <TermRow
            key={term.code}
            term={term}
            index={index}
            progress={smooth}
            range={ranges[index]}
            reduced={reduced}
          />
        ))}
      </ol>

      {/*
       * The closing expression. It assembles term by term behind the same scroll
       * value, which is the "semua komponen bertemu" beat: the reader watches the
       * four terms become one sum. Each term is a plain span with its own
       * opacity, so the text is complete in the DOM from first paint and a screen
       * reader reads the whole equation at once.
       */}
      <p
        className="overflow-x-auto rounded-[var(--radius-card)] bg-card px-5 py-4 font-mono text-[12.5px] leading-loose tabular-nums shadow-[inset_0_0_0_1px_var(--line)] sm:text-[13.5px]"
        data-numeric
      >
        {terms.map((term, index) => (
          <FormulaTerm
            key={term.code}
            term={term}
            index={index}
            progress={formulaProgress}
            reduced={reduced}
          />
        ))}
        <span className="text-muted">= </span>
        <FormulaTotal total={total} progress={formulaProgress} reduced={reduced} />
      </p>
    </div>
  );
}

/** One weighted term of the closing expression, seated in behind the scroll. */
function FormulaTerm({
  term,
  index,
  progress,
  reduced,
}: {
  term: ScoreTerm;
  index: number;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  // Staggered lead-in inside the final segment: term 0 resolves first.
  const start = index * 0.14;
  const opacity = useTransform(progress, [start, start + 0.34], [0.28, 1]);
  const x = useTransform(progress, [start, start + 0.34], [3, 0]);

  const body = (
    <>
      {index > 0 && <span className="text-muted"> + </span>}
      <span style={{ color: term.hue }}>{term.weight}</span>
      <span className="text-ink">{term.component}</span>
    </>
  );

  if (reduced) return <span>{body}</span>;

  return (
    <motion.span data-motion-scroll="" className="inline-block" style={{ opacity, x }}>
      {body}
    </motion.span>
  );
}

/** The total: the last thing to arrive, and the loudest value on the line. */
function FormulaTotal({
  total,
  progress,
  reduced,
}: {
  total: string;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const opacity = useTransform(progress, [0.55, 0.9], [0.3, 1]);
  const scale = useTransform(progress, [0.55, 0.9], [0.97, 1]);

  const body = <strong className="font-medium text-accent-strong">{total}</strong>;

  if (reduced) return body;

  return (
    <motion.span
      data-motion-scroll=""
      className="inline-block origin-left"
      style={{ opacity, scale }}
    >
      {body}
    </motion.span>
  );
}

function TermRow({
  term,
  index,
  progress,
  range,
  reduced,
}: {
  term: ScoreTerm;
  index: number;
  progress: MotionValue<number>;
  range: { start: number; end: number };
  reduced: boolean;
}) {
  // Two properties, and only two: the cell lifts 7px and darkens-in as its turn
  // arrives. The value itself is never faded below 0.34, so it stays readable at
  // any scroll position and cannot be mistaken for missing data.
  const opacity = useTransform(progress, [range.start, range.end], [0.34, 1]);
  const y = useTransform(progress, [range.start, range.end], [7, 0]);
  // The active accent bar: 0 until this term's turn, then it fills.
  const bar = useTransform(progress, [range.start, range.end], [0, 1]);

  const body = (
    <>
      {!reduced && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[2px] origin-top rounded-full"
          style={{ backgroundColor: term.hue, scaleY: bar, opacity: 0.9 }}
        />
      )}
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[13px] font-medium" style={{ color: term.hue }}>
          {term.code}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted">{term.weight}</span>
        <span className="sr-only">, suku {index + 1} dari 4</span>
      </span>
      <span className="font-mono text-[12.5px] tabular-nums text-ink" data-numeric>
        × {term.component} = <strong className="font-medium">{term.product}</strong>
      </span>
    </>
  );

  if (reduced) {
    return <li className="relative flex flex-col gap-1.5 bg-card px-4 py-3.5">{body}</li>;
  }

  return (
    <motion.li
      data-motion-scroll=""
      className="relative flex flex-col gap-1.5 bg-card px-4 py-3.5"
      style={{ opacity, y }}
    >
      {body}
    </motion.li>
  );
}
