'use client';

import { useState } from 'react';

/**
 * Inline score breakdown rendered in the cell it belongs to (DESIGN.md §5.2).
 *
 * It deliberately is not a tooltip: a tooltip would cover the numbers next to it
 * and cannot hold four bars plus a reason on a phone. The panel opens under the
 * focused cell, stays in the document flow, and is reachable by keyboard because
 * the cell itself is a button.
 *
 * Under `prefers-reduced-motion` the panel is simply present; the reveal is an
 * opacity/translate step of 120 ms, never a block on input.
 */
export interface BreakdownValue {
  K: number;
  S: number;
  C: number;
  M: number;
  total: number;
}

const COMPONENTS = [
  { key: 'K' as const, label: 'Kemiripan konten', color: 'var(--k)', weightHybrid: 0.4, weightFallback: 0 },
  { key: 'S' as const, label: 'Kecocokan skill', color: 'var(--s)', weightHybrid: 0.3, weightFallback: 0.5 },
  { key: 'C' as const, label: 'Sisa kapasitas', color: 'var(--c)', weightHybrid: 0.2, weightFallback: 0.33 },
  { key: 'M' as const, label: 'Minat', color: 'var(--m)', weightHybrid: 0.1, weightFallback: 0.17 },
];

export function ScoreBreakdown({
  value,
  weights,
  isFallback,
  contributions,
}: {
  value: BreakdownValue;
  weights: { K: number; S: number; C: number; M: number };
  isFallback: boolean;
  contributions?: boolean;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
      {COMPONENTS.map((component) => {
        const raw = value[component.key];
        const weight = isFallback ? component.weightFallback : weights[component.key];
        const effectiveWeight = isFallback && component.key === 'K' ? 0 : weight;
        const contribution = raw * effectiveWeight;
        return (
          <div key={component.key} className="space-y-1">
            <dt className="flex items-baseline justify-between gap-1">
              <span className="font-mono text-[10px] font-bold" style={{ color: component.color }}>
                {component.key}
              </span>
              <span className="truncate text-[10px] text-muted">{component.label}</span>
            </dt>
            <dd className="space-y-1">
              <div className="flex items-baseline justify-between gap-1 font-mono text-[11px] tabular-nums">
                <span className="text-ink">{Math.round(raw * 100)}</span>
                <span className="text-muted">×{Math.round(effectiveWeight * 100)}%</span>
              </div>
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full w-full origin-left rounded-full"
                  style={{ transform: `scaleX(${Math.max(0, Math.min(1, raw))})`, backgroundColor: component.color }}
                />
              </div>
              {contributions && (
                <p className="font-mono text-[9.5px] tabular-nums text-muted" data-numeric>
                  = {(contribution * 100).toFixed(1)} poin
                </p>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** A `<details>`-free disclosure used inside matrix rows; keeps its own state. */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  return {
    open,
    show: () => setOpen(true),
    hide: () => setOpen(false),
    toggle: () => setOpen((v) => !v),
    set: setOpen,
  };
}
