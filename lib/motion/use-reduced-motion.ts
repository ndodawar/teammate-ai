'use client';

import { useSyncExternalStore } from 'react';

/**
 * Hydration-safe `prefers-reduced-motion`.
 *
 * framer-motion's `useReducedMotion()` reads a module-level value that is `false`
 * during SSR and flips to `true` on the client once the media query resolves. A
 * component that branches on it (e.g. "render a plain element under reduced
 * motion") therefore produces two different trees on server and client, and React
 * reports a hydration mismatch — exactly what happened on `/` under reduced
 * motion.
 *
 * `useSyncExternalStore` solves this by design: the server snapshot is always
 * `false`, so the first client render matches the server HTML, and the real
 * media-query value is read immediately afterwards without any hydration error.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

/** The server never knows the preference, so it always renders the animated tree. */
function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
