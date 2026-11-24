'use client';

import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { DURATION, EASE } from '@/lib/motion/tokens';

/**
 * Animated score bar.
 *
 * The bar fills with `scaleX` (DESIGN.md §5.2, Catalis: transform-only motion)
 * from 0 to the real computed value. The numeric label renders the actual value
 * immediately, so the motion never delays reading the data and no fake number is
 * ever shown mid-animation.
 *
 * Because the fill starts at scaleX(0), it must not be allowed to render at 0
 * for users who disabled motion — in that case we render the final width with
 * no animation wrapper at all.
 *
 * `color` takes a CSS colour token (see globals.css: --k/--s/--c/--m) so the
 * component hues stay meaningful across both themes.
 */
export function ScoreBar({
  label,
  value,
  color,
  disabled,
}: {
  label: string;
  value: number;
  color: string;
  disabled?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <div className={`space-y-1 ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex items-baseline justify-between gap-1 font-mono text-[10px] tabular-nums">
        <span className="font-medium uppercase tracking-[0.06em] text-muted">{label}</span>
        <span className="text-ink">{(value * 100).toFixed(0)}</span>
      </div>
      <div className="h-[4px] w-full overflow-hidden rounded-full bg-line">
        {reduced ? (
          <div
            className="h-full w-full origin-left rounded-full"
            style={{ transform: `scaleX(${clamped})`, backgroundColor: color }}
          />
        ) : (
          <motion.div
            data-motion-reveal=""
            className="h-full w-full origin-left rounded-full"
            style={{ backgroundColor: color }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: clamped }}
            transition={{ duration: DURATION.data, ease: EASE.out }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Workload meter for a member. Animates width via `scaleX` and switches to the
 * warning colour past the R2 threshold (1.25× ideal load).
 */
export function LoadMeter({
  ratio,
  isOver,
  isR2Over,
}: {
  ratio: number;
  isOver: boolean;
  isR2Over: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const clamped = Math.max(0, Math.min(1, ratio));
  const fill = isR2Over ? 'var(--danger)' : isOver ? 'var(--warn)' : 'var(--accent)';

  return (
    <div className="h-[6px] w-full overflow-hidden rounded-full bg-line">
      {reduced ? (
        <div
          className="h-full w-full origin-left rounded-full"
          style={{ transform: `scaleX(${clamped})`, backgroundColor: fill }}
        />
      ) : (
        <motion.div
          data-motion-reveal=""
          className="h-full w-full origin-left rounded-full"
          style={{ backgroundColor: fill }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: clamped }}
          transition={{ duration: DURATION.data, ease: EASE.out }}
        />
      )}
    </div>
  );
}
