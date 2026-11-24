'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

/**
 * Smooth scrolling + the single ScrollTrigger clock (T-5.15).
 *
 * Why Lenis and not scroll-snap, a wheel listener, or `position: fixed` panels:
 * the reader keeps the native scrollbar, native keyboard paging, native
 * back/forward and native touch inertia. Lenis only *interpolates* the wheel
 * and keyboard deltas the browser already computed; it never swallows an event
 * and never takes over `scrollTop` in a way the browser cannot undo. Removing it
 * leaves a perfectly scrollable page.
 *
 * Why ScrollTrigger is driven from Lenis and not from `requestAnimationFrame`:
 * two animation loops asking `scrollY` in the same frame produce the classic
 * "pinned panel stutters by one frame" artefact. `lenis.on('scroll', ...)` +
 * `gsap.ticker.add` gives ScrollTrigger exactly one clock, so the sticky stage
 * and the smooth scroll can never disagree about where the page is.
 *
 * Everything here is skipped when the reader asks for reduced motion, when the
 * pointer is coarse (touch devices already have momentum; smoothing it on top
 * makes a phone feel laggy), or when the browser lacks what we need.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';
const FINE_POINTER = '(hover: hover) and (pointer: fine)';

let registered = false;

/** Registers ScrollTrigger once. Safe to call from several components. */
export function ensureScrollTrigger() {
  if (registered) return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reducedMql = window.matchMedia(REDUCED);
    const pointerMql = window.matchMedia(FINE_POINTER);

    ensureScrollTrigger();

    let lenis: Lenis | null = null;

    // ScrollTrigger's own `scrollerProxy` is unnecessary: Lenis (>=1.x) drives
    // the real `window.scrollY` by default, so ScrollTrigger reads the true
    // position and we only need to hand it the same frame.
    const tick = (time: number) => {
      lenis?.raf(time * 1000);
    };

    const start = () => {
      if (lenis) return;
      if (reducedMql.matches || !pointerMql.matches) return;

      lenis = new Lenis({
        // A long, quiet glide. `expoOut` decelerates hard at the end, which is
        // what makes a 900ms settle feel controlled rather than floaty; a linear
        // ease reads as "the page is lagging".
        duration: 0.9,
        easing: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
        // Touch devices keep native momentum. Smoothing a touch flick as well
        // doubles the deceleration and feels broken on a phone.
        smoothWheel: true,
        syncTouch: false,
        // Anchor links (`#harga`, `#cara-kerja`) must still jump to the right
        // place. Lenis handles them itself so it can animate instead of snapping.
        anchors: { offset: -96 },
      });

      /*
       * Exposed for the verification harness (T-5.17). Lenis keeps its own
       * animated target and re-writes `scrollTop` every frame, so a scripted
       * `scrollTo` during a screenshot run lands somewhere other than the
       * requested pixel unless the instance can be stopped. This is a read-only
       * handle for tooling: nothing in the app reads it, and it does not change
       * how Lenis behaves for a real reader. Typed as `unknown` on `window`
       * because there is no ambient declaration for it and inventing one would
       * be a type the project does not actually rely on.
       */
      (window as unknown as { __lenis?: unknown }).__lenis = lenis;

      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      ScrollTrigger.refresh();
    };

    const stop = () => {
      if (!lenis) return;
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenis = null;
      (window as unknown as { __lenis?: unknown }).__lenis = null;
      ScrollTrigger.refresh();
    };

    const sync = () => {
      if (reducedMql.matches || !pointerMql.matches) stop();
      else start();
    };

    sync();
    reducedMql.addEventListener('change', sync);
    pointerMql.addEventListener('change', sync);

    return () => {
      reducedMql.removeEventListener('change', sync);
      pointerMql.removeEventListener('change', sync);
      stop();
    };
  }, []);

  return null;
}
