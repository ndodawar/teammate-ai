'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Scroll Craft engine adapter (T-5.17).
 *
 * The engine (`public/scrollcraft/vendor/scrollcraft.js`) is a vanilla, zero
 * dependency runtime that reads `data-sc-*` attributes off markup the page
 * already rendered. It is **never edited**: the file is a byte-identical copy of
 * `.agents/skills/scroll-craft/engine/scrollcraft.js`, and that is a test, not a
 * promise (see `test/ui/scrollcraft-engine.test.ts`).
 *
 * This component is the only place the engine is mounted. It exists because the
 * engine predates React: `ScrollCraft.mount(root)` queries the DOM once, so it
 * has to run after the route's markup is in the document, and it has to be torn
 * down when that markup is replaced, or two copies of the rAF loop, the scroll
 * listener and both IntersectionObservers survive every navigation. The engine
 * ships `destroy()` for exactly this, and calling it is the whole reason this
 * file exists rather than a `<script>` tag in the layout.
 *
 * Why a `requestAnimationFrame` before mounting: `useEffect` runs after commit
 * but before the browser has necessarily laid out fonts and images, and the
 * engine measures act heights at mount time. One frame later the sticky stages
 * have real heights, so `read()` starts from correct geometry instead of
 * correcting itself on the first scroll.
 *
 * Why that is not enough, and what `remeasure()` is for: one frame is still too
 * early when an earlier section on the same page grows *after* mount. On the
 * homepage the product-alur story above the score ledger expands its own scroll
 * track on the client, which moved the ledger 2259px down the document — the
 * engine had measured it at 2036 and never looked again, so the ledger read
 * `--sc-p: 1` from the moment it entered the viewport and the reader saw a
 * finished total instead of the count. `ResizeObserver` on the document body
 * calls the engine's own `layout()` when the page's content height changes,
 * which is exactly the hook the engine documents for a framework integration.
 * The engine file itself is untouched; re-measuring is the adapter's job.
 *
 * Under `prefers-reduced-motion` the engine still mounts. That is deliberate and
 * matches the skill: reduced motion means fewer and gentler devices, not none.
 * The engine drops every video fetch, zeroes translation and disables pointer
 * devices on its own, while cues still fade so comprehension survives. Removing
 * it entirely would leave `[data-sc-cue]` elements at the `opacity: 0` that
 * `scrollcraft.css` sets as their pre-paint state, which is the exact
 * "element left behind at opacity 0" failure the task forbids.
 */

/** The shape of the global the engine publishes. Kept minimal on purpose. */
type ScrollCraftApi = { destroy: () => void; layout: () => void; read: () => void };

type ScrollCraftGlobal = {
  mount: (root?: Element | Document | string, opts?: Record<string, unknown>) => ScrollCraftApi;
  reduce: boolean;
  instances: ScrollCraftApi[];
};

declare global {
  interface Window {
    ScrollCraft?: ScrollCraftGlobal;
  }
}

const ENGINE_SRC = '/scrollcraft/vendor/scrollcraft.js';

/**
 * Loads the engine once per document. A module-level promise is the cache: the
 * script tag itself is stable, so several consumers resolving it concurrently all
 * await the same load rather than appending three tags.
 */
let enginePromise: Promise<ScrollCraftGlobal> | null = null;

function loadEngine(): Promise<ScrollCraftGlobal> {
  if (typeof window === 'undefined') return Promise.reject(new Error('server'));
  if (window.ScrollCraft) return Promise.resolve(window.ScrollCraft);
  if (enginePromise) return enginePromise;

  enginePromise = new Promise<ScrollCraftGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-sc-engine]`);
    const script = existing ?? document.createElement('script');

    const settle = () => {
      if (window.ScrollCraft) resolve(window.ScrollCraft);
      else reject(new Error('scrollcraft loaded without publishing window.ScrollCraft'));
    };

    if (existing && window.ScrollCraft) {
      settle();
      return;
    }

    script.addEventListener('load', settle, { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error(`failed to load ${ENGINE_SRC}`)),
      { once: true },
    );

    if (!existing) {
      script.src = ENGINE_SRC;
      script.async = true;
      script.dataset.scEngine = 'true';
      document.head.appendChild(script);
    }
  });

  // A failed load must not be cached as a permanent failure: a later mount (a
  // route change, a reconnection) should be able to retry.
  enginePromise.catch(() => {
    enginePromise = null;
  });

  return enginePromise;
}

export function ScrollCraftEngine() {
  const pathname = usePathname();
  const apiRef = useRef<ScrollCraftApi | null>(null);

  useEffect(() => {
    // SSR guard. The component renders nothing, so there is no hydration
    // surface to mismatch; this simply never runs on the server.
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let frame = 0;
    let settleFrames: number[] = [];
    let resizeObserver: ResizeObserver | null = null;
    // The last document height we successfully measured. A resize callback only
    // triggers a re-layout when the document's *own* height changed, which is
    // what a late-expanding section does; an observer firing for a nested
    // element that did not move anything must not cause churn.
    let measuredHeight = 0;

    /**
     * Tear down whatever is currently mounted, synchronously.
     *
     * This has to happen at the *top* of the effect, before the new route's
     * markup hydrates. The engine writes `sc-act--pinned`, a px height and
     * `--sc-p` onto every act element it is mounted over. When a reader arrives
     * at a route from another route (the normal case — the homepage's own "Cara
     * kerja" link, or any client navigation), the previous instance is still
     * live and still holding references to elements React is about to hydrate.
     * Destroying it inside the deferred mount callback is one frame too late:
     * React has already compared the engine's attributes against its server
     * HTML and logged a hydration mismatch. Measured exactly that way on
     * `/how-it-works` when `/` was visited first.
     */
    const teardown = () => {
      apiRef.current?.destroy();
      apiRef.current = null;
      resizeObserver?.disconnect();
      resizeObserver = null;
    };

    // Synchronous, first thing. See the comment on `teardown`.
    teardown();

    /**
     * Re-measure the act geometry. The engine caches `top` and `height` per act
     * at mount, and a section that grows afterwards silently invalidates both.
     */
    const remeasure = () => {
      const api = apiRef.current;
      if (cancelled || !api) return;
      const height = document.documentElement.scrollHeight;
      if (height === measuredHeight) return;
      measuredHeight = height;
      try {
        api.layout();
        api.read();
      } catch {
        // Geometry is an optimisation, never a requirement: if a re-measure
        // throws, the page keeps the positions it already had.
      }
    };

    loadEngine()
      .then((engine) => {
        if (cancelled) return;
        // Two frames, not one, and the reason is a real bug this fixed.
        //
        // One frame after the effect is still *during* a React render pass on
        // some routes: the engine's `mount` then adds `sc-act--pinned`, writes
        // `--sc-p` and a px height onto the act elements before React has
        // finished hydrating them. React compares that DOM against the server
        // HTML it is hydrating from, finds attributes it did not render, and
        // logs "a tree hydrated but some attributes ... didn't match" — measured
        // on `/how-it-works`, which was the first route where an act is also a
        // React sibling of a client boundary. Waiting one further frame puts
        // the mount after hydration, so React owns the tree it renders and the
        // engine only decorates it afterwards.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            if (cancelled) return;
            // A no-op in practice (the effect already tore down at its top) but
            // kept so a mount can never stack on a live instance.
            teardown();
            try {
              apiRef.current = engine.mount(document.body);
              measuredHeight = document.documentElement.scrollHeight;
            } catch {
              // A mount failure must never break the page. The markup below is
              // ordinary HTML and stays fully readable; only the motion is lost,
              // and the `[data-sc-cue]` pre-paint opacity is the one thing that
              // would be lost with it, so it is cleared below.
              apiRef.current = null;
              document.documentElement.classList.add('sc-ready');
              document
                .querySelectorAll<HTMLElement>('[data-sc-cue], [data-sc-in], [data-sc-stagger] > *')
                .forEach((el) => {
                  el.style.opacity = '1';
                  el.style.transform = 'none';
                });
              return;
            }

            // Two follow-up settles. A client section that expands its track
            // often does so on its own first effect or its own first frame, so
            // one immediate re-measure can still land before it. Cheap, bounded,
            // and idempotent; after this the ResizeObserver keeps it honest.
            settleFrames = [
              requestAnimationFrame(() => {
                remeasure();
                settleFrames.push(requestAnimationFrame(remeasure));
              }),
            ];

            if (typeof ResizeObserver !== 'undefined') {
              resizeObserver = new ResizeObserver(remeasure);
              resizeObserver.observe(document.body);
            }
          });
        });
      })
      .catch(() => {
        // Same fallback as above: readable content, no motion.
        if (cancelled) return;
        document.documentElement.classList.add('sc-ready');
        document
          .querySelectorAll<HTMLElement>('[data-sc-cue], [data-sc-in], [data-sc-stagger] > *')
          .forEach((el) => {
            el.style.opacity = '1';
            el.style.transform = 'none';
          });
      });

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      settleFrames.forEach((f) => cancelAnimationFrame(f));
      settleFrames = [];
      teardown();
    };
    // Re-mount on route change: the engine caches element references per mount,
    // so a new route's markup needs a new instance. `pathname` is the correct
    // dependency because every route change replaces the page subtree.
  }, [pathname]);

  return null;
}
