'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { DURATION, EASE } from '@/lib/motion/tokens';

type Pref = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'theme_preference';

function resolve(pref: Pref): 'light' | 'dark' {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Light / dark switch (DESIGN.md §7).
 *
 * The visual half of the toggle is a sun and a moon; the third state ('system')
 * follows the OS and is what the user gets until they press it. Persisted under
 * `theme_preference`; layout.tsx applies the same key before first paint.
 */
export function ThemeToggle() {
  const [pref, setPref] = useState<Pref>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');
  const reduced = usePrefersReducedMotion();

  /*
   * Read the applied theme rather than writing state from an effect: the
   * pre-hydration script in layout.tsx has already put `data-theme` on <html>,
   * so the toggle only needs to mirror it.
   */
  useEffect(() => {
    const apply = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      const current: Pref = stored === 'light' || stored === 'dark' ? stored : 'system';
      const applied = document.documentElement.getAttribute('data-theme');
      setPref(current);
      setResolved(applied === 'dark' ? 'dark' : 'light');
    };
    apply();
  }, []);

  // Keep 'system' in sync with OS changes.
  useEffect(() => {
    if (pref !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next = resolve('system');
      setResolved(next);
      document.documentElement.setAttribute('data-theme', next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [pref]);

  function toggle() {
    // A single press always yields an explicit preference; the third click
    // returns to following the system.
    const next: Pref = pref === 'system' ? (resolved === 'dark' ? 'light' : 'dark') : pref === 'dark' ? 'light' : 'system';
    setPref(next);
    const nextResolved = resolve(next);
    setResolved(nextResolved);
    document.documentElement.setAttribute('data-theme', nextResolved);
    localStorage.setItem(STORAGE_KEY, next);
  }

  const label =
    pref === 'system'
      ? `Ikuti sistem (${resolved === 'dark' ? 'gelap' : 'terang'}) — klik untuk beralih`
      : pref === 'dark'
        ? 'Mode gelap aktif — klik untuk beralih ke terang'
        : 'Mode terang aktif — klik untuk mengikuti sistem';

  return (
    <motion.button
      type="button"
      onClick={toggle}
      // Pinned so SSR and hydration agree (see components/ui/primitives.tsx).
      tabIndex={0}
      whileTap={reduced ? undefined : { scale: 0.94 }}
      transition={{ duration: DURATION.feedback, ease: EASE.out }}
      aria-label={label}
      title={label}
      className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface hover:text-ink cursor-pointer"
    >
      <span aria-hidden="true" className="relative block h-[15px] w-[15px]">
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute inset-0 h-[15px] w-[15px]"
          animate={{ opacity: resolved === 'light' ? 1 : 0, rotate: resolved === 'light' ? 0 : -50 }}
          transition={{ duration: reduced ? 0 : DURATION.data, ease: EASE.out }}
        >
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4" />
        </motion.svg>
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute inset-0 h-[15px] w-[15px]"
          animate={{ opacity: resolved === 'dark' ? 1 : 0, rotate: resolved === 'dark' ? 0 : 50 }}
          transition={{ duration: reduced ? 0 : DURATION.data, ease: EASE.out }}
        >
          <path d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a6.8 6.8 0 0 0 10.8 10.8z" />
        </motion.svg>
      </span>
      {pref !== 'system' && (
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1/2 h-[2px] w-[9px] -translate-x-1/2 rounded-full bg-accent"
        />
      )}
    </motion.button>
  );
}
