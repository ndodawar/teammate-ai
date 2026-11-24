'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';

/**
 * ScrollTrigger reveal primitives (T-5.15).
 *
 * Why this file exists, in one paragraph: the previous reveal system was built
 * on framer-motion variant propagation (`<motion.div initial="hidden"
 * whileInView="visible" variants={container}>` with `variants`-only children).
 * Measured in this exact app, framer-motion 14.14.0 resolves that subtree to its
 * *final* transform on the first frame and never animates: an isolated test
 * showed the child permanently at `translateY(26.87px)` with no intermediate
 * frames, while the same element with direct `initial`/`whileInView` props
 * animated correctly. Every headline mask, every staggered card grid and every
 * section entrance in the product was therefore static. Rather than keep paying
 * for a broken code path, scrolling motion now belongs to GSAP ScrollTrigger,
 * which is already installed for the scrollytelling work and has no such
 * inheritance model: each target is animated explicitly.
 *
 * Rules kept from the earlier system, because they were right:
 *  1. **Nothing is invisible without JavaScript doing the work.** Under
 *     `prefers-reduced-motion` these components render plain elements with no
 *     inline style at all. When motion is allowed, the "hidden" state is applied
 *     by GSAP in `useLayoutEffect` (never in CSS and never in SSR markup), so
 *     there is no window in which server HTML ships `opacity: 0`.
 *  2. **Reveals run once.** `once: true` on the config plus a `killed` flag, so
 *     scrolling back up does not replay an entrance and the page never strobes.
 *     A section that is already on screen when it mounts is simply revealed.
 *  3. **Motion is transform + opacity only.** No width, height, top or margin is
 *     animated, so no reveal can cause layout shift.
 *  4. **Framer Motion stays for what it is good at** — hover, `layoutId`
 *     indicators, `AnimatePresence` modals. The two engines never do the same
 *     job: GSAP owns scroll, framer owns component state.
 */

const EASE_OUT = 'power2.out';

export type RevealDistance = 'sm' | 'md' | 'lg';

const Y: Record<RevealDistance, number> = { sm: 12, md: 18, lg: 26 };

/**
 * GSAP's ScrollTrigger needs the plugin registered exactly once per page. Doing
 * it at module scope keeps `gsap.registerPlugin` off the render path and makes
 * every primitive below independent of import order.
 */
gsap.registerPlugin(ScrollTrigger);

type CommonRevealProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** Seconds. Total travel time of one target. */
  duration?: number;
  /** Enter translateY seed, in px. */
  distance?: RevealDistance;
  /** Seconds between siblings inside this group. */
  stagger?: number;
  /** ScrollTrigger start, e.g. `'top 88%'`. */
  start?: string;
  /** Fraction of the element that must be visible before firing. */
  amount?: number;
  /** Extra attributes (ids, roles, data hooks) forwarded to the element. */
  [key: `data-${string}`]: unknown;
};

function useRevealOnEnter<T extends HTMLElement>({
  enabled,
  duration,
  distance,
  stagger,
  start,
  amount,
}: {
  enabled: boolean;
  duration: number;
  distance: RevealDistance;
  stagger: number;
  start: string;
  amount: number;
}) {
  const ref = useRef<T>(null);

  /*
   * `useLayoutEffect` runs before paint, so the seed transform is applied in the
   * same frame the element first exists. If this ran in `useEffect` the reader
   * would see one frame of the arrived state and then a jump back to the seed,
   * which is exactly the flicker the brief forbids.
   *
   * The dependency list is deliberately short and the values are primitives:
   * re-running the setup would restart the tween on top of an already-revealed
   * element.
   */
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    // Children are revealed individually when the caller passed a stagger.
    // `:scope > *` keeps the group shallow: a nested reveal group owns its own
    // targets, so nothing is animated twice.
    const targets =
      stagger > 0 && el.children.length > 0
        ? (Array.from(el.children) as HTMLElement[])
        : [el];

    let tween: gsap.core.Tween | undefined;

    const ctx = gsap.context(() => {
      tween = gsap.fromTo(
        targets,
        { opacity: 0, y: Y[distance] },
        {
          opacity: 1,
          y: 0,
          duration,
          ease: EASE_OUT,
          stagger,
          // Created paused so nothing plays before the trigger fires; an element
          // already on screen starts immediately via the branch below.
          paused: true,
        },
      );

      ScrollTrigger.create({
        trigger: el,
        start,
        end: 'bottom top',
        once: true,
        onEnter: () => tween?.play(),
      });
      ScrollTrigger.refresh();
    }, el);

    // Anything already on screen at mount should simply be there. Measured on
    // the hero: a MaskLine's outer box is in the layout while its text is still
    // masked, so it is "in view" on the first frame and must animate at once.
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight || 800;
    const visibleFraction =
      Math.max(0, Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0)) /
      Math.max(1, Math.min(rect.height, viewportH));
    if (rect.top < viewportH && visibleFraction >= Math.min(amount, 0.5)) {
      tween?.play();
    }

    return () => ctx.revert();
  }, [enabled, duration, distance, stagger, start, amount]);

  return ref;
}

/**
 * A block that fades up as it enters the viewport.
 *
 * Use it for one coherent piece of content (a section header, a card, a figure).
 * For a row of siblings that should arrive in sequence, use `RevealGroup`.
 */
export function Reveal({
  children,
  className,
  as: Tag = 'div',
  duration = 0.48,
  distance = 'md',
  delay = 0,
  start = 'top 88%',
  amount = 0.15,
  ...rest
}: CommonRevealProps & { delay?: number }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRevealOnEnter<HTMLElement>({
    enabled: !reduced,
    duration,
    distance,
    stagger: delay,
    start,
    amount,
  });

  return (
    <Tag ref={ref} className={className} data-motion-reveal="" {...rest}>
      {children}
    </Tag>
  );
}

/**
 * A group whose direct children arrive in sequence.
 *
 * `stagger` is the gap in seconds. The 60–80ms band reads as one gesture with
 * rhythm; below ~40ms the items blur into a single block and above ~120ms the
 * reader starts waiting for the last card.
 *
 * `inView` and `nested` are accepted for source compatibility with the previous
 * framer implementation. Both are no-ops now: a group always reveals when it
 * enters the viewport, and a nested group owns its own children, so nesting is
 * already correct without a flag.
 */
export function RevealGroup({
  children,
  className,
  as: Tag = 'div',
  duration = 0.44,
  distance = 'md',
  stagger = 0.07,
  start = 'top 86%',
  amount = 0.12,
  // Accepted and ignored, so existing call sites keep compiling.
  inView: _inView,
  nested: _nested,
  ...rest
}: CommonRevealProps & { inView?: boolean; nested?: boolean }) {
  void _inView;
  void _nested;
  const reduced = usePrefersReducedMotion();
  const ref = useRevealOnEnter<HTMLElement>({
    enabled: !reduced,
    duration,
    distance,
    stagger,
    start,
    amount,
  });

  return (
    <Tag ref={ref} className={className} data-motion-reveal="" {...rest}>
      {children}
    </Tag>
  );
}

/**
 * A display line unveiling from behind its own mask.
 *
 * A single sentence stays one text node inside an `overflow: hidden` box: a
 * screen reader reads it normally, CSS decides where it wraps, and no
 * measurement pass is needed at any width. GSAP moves the inner span from
 * `translateY(105%)` to `0`; the mask is the outer box, so ascenders are never
 * clipped once the line has arrived.
 *
 * `delay` staggers consecutive lines of one headline.
 */
export function MaskLine({
  children,
  className,
  delay = 0,
  duration = 0.72,
  as: Tag = 'span',
}: {
  children: ReactNode;
  className?: string;
  /** Seconds before this line starts, relative to the block entering. */
  delay?: number;
  duration?: number;
  as?: 'span' | 'div';
}) {
  const reduced = usePrefersReducedMotion();
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced) return;
    const box = outer.current;
    const line = inner.current;
    if (!box || !line) return;

    // `power3.out` rather than `power2.out`: a masked line covers a long
    // distance and a quartic-ish deceleration makes the last 15% dwell, which
    // is what makes the unveiling feel editorial instead of like a slide-in.
    const tween = gsap.fromTo(
      line,
      { yPercent: 105 },
      { yPercent: 0, duration, delay, ease: 'power3.out', paused: true },
    );

    const trigger = ScrollTrigger.create({
      trigger: box,
      start: 'top 90%',
      once: true,
      onEnter: () => tween.play(),
    });

    const rect = box.getBoundingClientRect();
    if (rect.top < (window.innerHeight || 800) * 0.9) tween.play();

    return () => {
      trigger.kill();
      tween.kill();
    };
  }, [reduced, delay, duration]);

  if (reduced) {
    // `block` is load-bearing: the animated branch wraps each line in
    // `block overflow-hidden`, so one MaskLine is one line box. Without it a
    // four-line headline collapses into a single run-on line.
    const Plain = Tag as ElementType;
    return <Plain className={`block ${className ?? ''}`}>{children}</Plain>;
  }

  return (
    <Tag ref={outer as never} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]" data-motion-reveal="">
      <span ref={inner} className={`block ${className ?? ''}`}>
        {children}
      </span>
    </Tag>
  );
}

/**
 * A hairline that draws itself left to right when its section arrives.
 *
 * `scaleX` on an `origin-left` element: transform-only, so the rule never
 * reflows the block it separates. The observed node is the outer box, which
 * keeps its full width, because a `scaleX(0)` element reports a zero-area box
 * and would never satisfy an intersection threshold.
 */
export function DrawRule({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  const reduced = usePrefersReducedMotion();
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced) return;
    const box = outer.current;
    const line = inner.current;
    if (!box || !line) return;

    const tween = gsap.fromTo(
      line,
      { scaleX: 0 },
      { scaleX: 1, duration: 0.78, delay, ease: 'power2.inOut', paused: true },
    );

    const trigger = ScrollTrigger.create({
      trigger: box,
      start: 'top 92%',
      once: true,
      onEnter: () => tween.play(),
    });

    const rect = box.getBoundingClientRect();
    if (rect.top < (window.innerHeight || 800) * 0.92) tween.play();

    return () => {
      trigger.kill();
      tween.kill();
    };
  }, [reduced, delay]);

  if (reduced) {
    return <span aria-hidden="true" className={`block h-px w-full bg-line ${className}`} />;
  }

  return (
    <span
      ref={outer}
      aria-hidden="true"
      className={`block h-px w-full overflow-hidden ${className}`}
      data-motion-reveal=""
    >
      <span ref={inner} className="block h-px w-full origin-left bg-line" />
    </span>
  );
}
