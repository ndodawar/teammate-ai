'use client';

import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { DURATION, EASE } from '@/lib/motion/tokens';

/**
 * Pinned storytelling (T-5.10-REDESIGN).
 *
 * The reference's device, re-pointed at an explanation that genuinely has an
 * order: a task being divided, a score being computed, a stage being reached.
 * While the section passes, one visual stays put and the step text advances.
 *
 * Three rules govern everything below.
 *
 * 1. **The page never stops scrolling.** The pin is `position: sticky` on a
 *    child, not a scroll lock. There is no `overflow: hidden`, no wheel
 *    listener, no scroll hijack: the document scrolls at exactly the speed the
 *    browser wants, and the section is merely tall enough (one viewport per
 *    step) for the reader to spend time in it. At the end the sticky element
 *    releases by itself, because its track ends. Nothing has to hand control
 *    back.
 *
 * 2. **It is desktop-only, and it disappears under reduced motion.** Below
 *    `lg` the steps are an ordinary stacked list, because a pinned viewport on
 *    a 390px phone is a trap: the reader cannot see the step and the visual at
 *    the same time. Under reduced motion the pinned branch is not rendered at
 *    all, so there is no scroll-linked movement to be bothered by.
 *
 * 3. **Nothing is fake.** The `steps` and the `visual` are the caller's own
 *    copy and the caller's own figures. This component supplies only the
 *    choreography: which step is current, and how far into it we are.
 *
 * Progress is a MotionValue, so a step change is the only thing that ever
 * touches React state, and only when the derived index actually changes.
 */

export type PinnedStep = {
  /** Short label for the step list, e.g. "Susun tugas". */
  label: string;
  /** The heading shown beside the visual while this step is current. */
  title: string;
  /** One paragraph, the step's own explanation. */
  body: string;
};

/**
 * The sticky visual's content, as *data* rather than as a render prop.
 *
 * A render prop (`visual: (state) => ReactNode`) was the first design, and it
 * is wrong here for a concrete reason: `PinnedStory` is a client component, and
 * `/how-it-works` is a server component. React cannot serialise a function
 * across that boundary, so the page failed to prerender with "Functions cannot
 * be passed directly to Client Components". A descriptor crosses it cleanly and
 * has the further benefit that the diagram is one implementation rather than
 * one per caller, so the two pinned sections cannot drift apart visually.
 *
 * `rows` is whatever the caller's explanation actually consists of: the four
 * steps of the product flow, or the four weighted terms of the score. `total`
 * is optional and only rendered when the caller's subject really has a sum.
 */
export type PinnedVisual = {
  /** Heading above the diagram. */
  label: string;
  /** Optional single-line legend, printed top-right. */
  aside?: string;
  rows: {
    /** The short code or number shown in the tile, e.g. "K" or "01". */
    code: string;
    /** The row's name. */
    label: string;
    /** Optional middle column: a weight, a duration, a stage. */
    meta?: string;
    /** Optional right column: a product, a count. */
    value?: string;
    /** The row's accent colour, when the caller has one per row. */
    hue?: string;
  }[];
  /** Optional closing line, e.g. "0,32 + 0,18 + 0,10 + 0,04 = 0,64". */
  total?: { label: string; value: string };
  /** Optional footnote under the diagram. */
  note?: string;
};

/** Which step is current at `progress` (0..1). Exported for testing. */
export function stepAt(progress: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isFinite(progress)) return 0;
  const scaled = Math.min(0.999999, Math.max(0, progress)) * count;
  return Math.min(count - 1, Math.floor(scaled));
}

/** True when the viewport is wide enough for the pinned layout. */
const DESKTOP = '(min-width: 1024px)';

/**
 * The height the sticky stage is allowed to occupy: the viewport minus the
 * compact bar it docks under. `100dvh` rather than `100vh`, so a phone's
 * collapsing browser chrome cannot make the stage taller than the screen.
 *
 * `0.86` keeps the stage window-slotted rather than edge-to-edge. A full-height
 * reading window turned a centred 380px diagram into a small object floating in
 * roughly 700px of empty canvas, which read as unfinished rather than calm. The
 * track height below is adjusted by the same fraction so the number of steps
 * per viewport of scrolling is unchanged.
 */
const STAGE_H = 'calc((100dvh - var(--site-nav-h-compact)) * 0.86)';
const STAGE_FRACTION = 0.86;

function useIsDesktop(): boolean {
  // Starts `false` so server and first client render agree. The observer
  // corrects it immediately after mount, before any scroll can be measured.
  const [wide, setWide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(DESKTOP);
    const read = () => setWide(mql.matches);
    read();
    mql.addEventListener('change', read);
    return () => mql.removeEventListener('change', read);
  }, []);

  return wide;
}

export function PinnedStory({
  id,
  eyebrow,
  heading,
  lede,
  steps,
  visual,
  visualLabel,
}: {
  id: string;
  eyebrow: string;
  heading: ReactNode;
  lede: string;
  steps: PinnedStep[];
  /** The sticky diagram's content. Serialisable, so a server route can pass it. */
  visual: PinnedVisual;
  /** Accessible description of what the sticky visual shows. */
  visualLabel: string;
}) {
  const reduced = usePrefersReducedMotion();
  const wide = useIsDesktop();
  const pinned = wide && !reduced && steps.length > 1;

  return (
    <section id={id} aria-labelledby={`${id}-title`}>
      {/* When the track is pinned, the header carries the track's top padding:
          the sticky stage holds the viewport for the whole track, so only the
          track (not the header) has to sit flush under the bar. Measured with
          the padding still on the header there was a band of dead space
          between the heading and the stage, above the viewport, so the reader
          scrolled through nothing before the story began. */}
      <div
        className={`mx-auto w-full max-w-[1240px] px-6 sm:px-8 lg:px-16 ${
          pinned ? 'pt-16 lg:pt-24' : 'py-16 lg:py-24'
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <p className="eyebrow flex items-center gap-2">
              <span aria-hidden="true" className="pinned-dot" />
              {eyebrow}
            </p>
            <h2
              id={`${id}-title`}
              className="heading max-w-[22ch] text-[clamp(1.75rem,3.2vw,2.5rem)] text-ink"
            >
              {heading}
            </h2>
          </div>
          <p className="max-w-[38ch] text-[13.5px] leading-relaxed text-muted">{lede}</p>
        </div>
      </div>

      {pinned ? (
        <PinnedTrack id={id} steps={steps} visual={visual} visualLabel={visualLabel} />
      ) : (
        <StackedSteps id={id} steps={steps} visual={visual} visualLabel={visualLabel} />
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Desktop: the pin
 *
 * The track is one viewport per step and the stage inside it is sticky, so the
 * stage is on screen for the whole track and then leaves with it. One viewport
 * of travel per step is the shortest distance that still lets a reader read a
 * step without feeling rushed.
 * ------------------------------------------------------------------------- */
function PinnedTrack({
  id,
  steps,
  visual,
  visualLabel,
}: {
  id: string;
  steps: PinnedStep[];
  visual: PinnedVisual;
  visualLabel: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    // `end end` finishes exactly when the track's bottom meets the viewport
    // bottom, which is the same moment the sticky stage is released, so the
    // final step gets its full turn instead of being cut off.
    //
    // `start start` would only become true once the track's top reached the
    // viewport top. The track's top *is* the stage's resting position, one
    // header below the viewport top, so that offset left the first step pinned
    // at 0% until the reader had scrolled the gap away.
    //
    // `start end` (the track's top meeting the viewport *bottom*) is the other
    // extreme, and it was worse: the whole entrance counted as progress, so the
    // first step was already spent by the time the stage docked. `start 0.08`
    // puts 0% on the frame where the stage has just docked under the bar, which
    // is the frame the story begins.
    offset: ['start 0.08', 'end end'],
  });

  const [step, setStep] = useState(0);

  // Only the step boundary writes state. Scroll position itself never does.
  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (value) => {
      const next = stepAt(value, steps.length);
      setStep((current) => (current === next ? current : next));
    });
    return unsubscribe;
  }, [scrollYProgress, steps.length]);

  const local = useTransform(scrollYProgress, (value) => {
    if (!Number.isFinite(value)) return 0;
    const scaled = Math.min(0.999999, Math.max(0, value)) * steps.length;
    return scaled - Math.floor(scaled);
  });

  return (
    <div
      ref={trackRef}
      className="pinned-track relative"
      style={{ height: `${steps.length * STAGE_FRACTION * 100}vh` }}
      data-pinned-track={id}
    >
      <div
        className="pinned-stage sticky z-10"
        style={{ height: STAGE_H, minHeight: STAGE_H }}
      >
        <div className="mx-auto w-full max-w-[1240px] px-6 sm:px-8 lg:px-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
            {/* The visual holds its place. It is the constant the text reads
                against, which is the whole reason for pinning it. */}
            <div className="lg:col-span-7 lg:order-2" aria-label={visualLabel} role="img">
              <PinnedDiagram visual={visual} step={step} />
            </div>

            {/* The steps cross-fade in place, so nothing below the fold moves. */}
            <div className="lg:col-span-5 lg:order-1">
              <ol className="pinned-steps space-y-1">
                {steps.map((item, index) => {
                  const active = index === step;
                  const done = index < step;
                  return (
                    <li key={item.label}>
                      <div className="pinned-step" data-active={active ? 'true' : 'false'}>
                        <span className="pinned-step-rail" aria-hidden="true">
                          <span
                            className="pinned-step-fill"
                            style={{
                              transform: `scaleY(${done ? 1 : active ? 1 : 0})`,
                              opacity: done ? 0.35 : active ? 1 : 0,
                            }}
                          />
                        </span>
                        <div className="min-w-0 pb-4">
                          <p className="pinned-step-label">
                            <span className="font-mono tabular-nums" data-numeric>
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </p>
                          <motion.div
                            initial={false}
                            animate={{ height: active ? 'auto' : 0, opacity: active ? 1 : 0 }}
                            transition={{ duration: DURATION.layout, ease: EASE.out }}
                            style={{ overflow: 'hidden' }}
                            aria-hidden={!active}
                          >
                            <p className="heading pt-1 text-[15.5px] text-ink">{item.title}</p>
                            <p className="max-w-[36ch] pt-1 text-[12.5px] leading-relaxed text-muted">
                              {item.body}
                            </p>
                          </motion.div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* The progress indicator: one bar per step, filling with the
                  real scroll position. It is the honest readout of where the
                  reader is, not a decoration. */}
              <div className="mt-5 flex gap-1.5" aria-hidden="true">
                {steps.map((item, index) => (
                  <StepBar key={item.label} index={index} step={step} local={local} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBar({
  index,
  step,
  local,
}: {
  index: number;
  step: number;
  local: MotionValue<number>;
}) {
  const scaleX = useTransform(local, (value) => (index < step ? 1 : index === step ? value : 0));

  return (
    <span className="relative block h-[2px] flex-1 overflow-hidden rounded-full bg-line">
      <motion.span
        className="absolute inset-0 origin-left rounded-full bg-accent-strong"
        style={{ scaleX }}
        data-numeric
      />
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * The diagram
 *
 * One implementation for both pinned sections. It prints the caller's rows and
 * lights the row the reader is on. When `step` is -1 (the stacked mobile branch
 * renders it once, with no reader position) every row renders at rest.
 * ------------------------------------------------------------------------- */
function PinnedDiagram({ visual, step }: { visual: PinnedVisual; step: number }) {
  const reduced = usePrefersReducedMotion();
  const activeIndex = step >= 0 ? Math.min(step, visual.rows.length - 1) : -1;

  return (
    <div className="pinned-visual">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="eyebrow shrink-0">{visual.label}</p>
        {visual.aside ? (
          <p
            className="hidden font-mono text-[11px] tabular-nums text-muted sm:block"
            data-numeric
          >
            {visual.aside}
          </p>
        ) : null}
      </div>
      {/* The legend is the first thing to go on a narrow plate: at 320px it took
          the width the row values need, wrapping "score = Σ bobot × nilai" onto
          two lines and truncating every row label. The figures themselves stay,
          since they are the arithmetic; only the legend about them folds. */}

      <ul className="mt-3 space-y-2">
        {visual.rows.map((row, index) => {
          const active = index === activeIndex;
          const passed = activeIndex >= 0 && index < activeIndex;
          const hue = row.hue ?? 'var(--accent-strong)';
          return (
            <li
              key={row.code}
              className="flex items-center gap-3 rounded-[var(--radius-plate)] border px-3.5 py-2.5 transition-[border-color,background-color] duration-200 ease-[var(--ease-out-expo)]"
              style={{
                borderColor: active ? hue : 'var(--line)',
                backgroundColor: active ? 'var(--mist)' : 'transparent',
              }}
              data-active={active ? 'true' : 'false'}
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] font-mono text-[11px] font-medium"
                style={{
                  backgroundColor: active || passed ? hue : 'var(--cloud)',
                  color: active || passed ? '#ffffff' : 'var(--muted)',
                }}
                data-numeric
              >
                {row.code}
              </span>
              {/* The label wraps instead of truncating. Truncation produced
                  "Kemiripan..." and "Sisa kapa..." at 320px, which makes the
                  diagram unreadable exactly where it is the only explanation. */}
              <span className="min-w-0 flex-1 text-[12.5px] font-medium text-ink sm:truncate">
                {row.label}
              </span>
              {row.meta ? (
                <span
                  className="hidden shrink-0 font-mono text-[11.5px] tabular-nums text-muted sm:block lg:hidden xl:block"
                  data-numeric
                >
                  {row.meta}
                </span>
              ) : null}
              {/* The meta column is the first thing to go when the plate is
                  narrow: between 1024 and 1280px the pinned diagram shares the
                  row with the step list, and four columns wrapped "score = Σ
                  bobot × nilai" onto two lines. Below that and above it there is
                  room, so it returns. The product stays either way: it is the
                  arithmetic, not a label. */}
              {row.value ? (
                <span
                  className="w-10 shrink-0 text-right font-mono text-[11.5px] font-medium tabular-nums"
                  style={{ color: active || passed ? hue : 'var(--fog)' }}
                  data-numeric
                >
                  {row.value}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {visual.total ? (
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line pt-3">
          <span className="text-[12px] font-medium text-ink">{visual.total.label}</span>
          <span
            className="font-mono text-[11px] font-medium tabular-nums text-accent-strong sm:text-[14px]"
            data-numeric
          >
            {visual.total.value}
          </span>
        </div>
      ) : null}

      {visual.note ? (
        <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-relaxed text-muted">
          {visual.note}
        </p>
      ) : null}

      {/* The diagram's own progress line: a 2px track that fills as the reader
          moves between rows, so the visual reports position too and not only
          the list beside it. It is the last child and its own block, so it can
          never sit on top of the total the way an absolutely placed bar did. */}
      <div className="mt-3 h-[2px] overflow-hidden rounded-full bg-line" aria-hidden="true">
        <motion.span
          className="block h-full origin-left rounded-full bg-accent-strong"
          initial={false}
          animate={{
            scaleX: reduced ? 1 : (activeIndex + 1) / Math.max(1, visual.rows.length),
          }}
          transition={{ duration: DURATION.layout, ease: EASE.out }}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Mobile / reduced motion: an ordinary stack
 *
 * Same copy, same order, no pin. The visual appears once, above the steps, so
 * a phone reader gets the diagram and then the sequence rather than a diagram
 * that keeps disappearing.
 * ------------------------------------------------------------------------- */
function StackedSteps({
  id,
  steps,
  visual,
  visualLabel,
}: {
  id: string;
  steps: PinnedStep[];
  visual: PinnedVisual;
  visualLabel: string;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="mx-auto w-full max-w-[1240px] px-6 pb-16 sm:px-8 lg:px-16">
      {/* The diagram above carries the same bottom margin as the gap between
          steps, so the visual reads as the first item of one list rather than
          as a card with a stray gap under it. */}
      <div className="mb-6" aria-label={visualLabel} role="img" data-pinned-stacked={id}>
        <PinnedDiagram visual={visual} step={-1} />
      </div>
      <ol className="space-y-6">
        {steps.map((item, index) => (
          <motion.li
            key={item.label}
            data-motion-reveal=""
            className="flex gap-4"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: DURATION.reveal, ease: EASE.out }}
          >
            <span
              aria-hidden="true"
              className="mt-1 font-mono text-[11px] tabular-nums text-fog"
              data-numeric
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="heading text-[15.5px] text-ink">{item.title}</p>
              <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-muted">{item.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
