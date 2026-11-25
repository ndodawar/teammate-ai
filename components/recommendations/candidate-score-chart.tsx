'use client';

import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { DURATION, EASE } from '@/lib/motion/tokens';

/**
 * Candidate score chart for one task (DESIGN.md §5.2, PRD FR-08/FR-09).
 *
 * Why a stacked bar per candidate rather than a separate chart per component:
 * the reader has one question, "who fits this task best, and why". A stacked bar
 * answers both at once, because the total height is the final score and the
 * segment split shows which component produced it. Four side-by-side charts
 * would answer "what is K for everyone" and leave the reader to add the columns
 * up by hand.
 *
 * The bar is horizontal so member names stay readable without rotation, and the
 * segment order is fixed (K, S, C, M) so two bars are always comparable.
 *
 * Accessibility: the value of every segment is printed next to its bar in
 * `tabular-nums`, every bar carries an `aria-label` spelling out the whole
 * breakdown, and exclusion is signalled by a text label plus a strike marker,
 * not by colour alone. Segments use the --k/--s/--c/--m tokens, which are
 * contrast-verified for both themes in globals.css.
 */

export interface ChartComponent {
  key: 'K' | 'S' | 'C' | 'M';
  label: string;
  color: string;
  /** Weight actually applied, so a fallback run shows K as not counted. */
  weight: number;
}

export interface ChartRow {
  memberId: string;
  name: string;
  /** Component values on the 0..1 scale the engine produced. */
  K: number;
  S: number;
  C: number;
  M: number;
  total: number;
  isPrimary: boolean;
  isAlternative: boolean;
  isEligible: boolean;
  /** Rule that excluded the member, already derived from engine warnings. */
  rule?: string;
}

export function CandidateScoreChart({
  rows,
  components,
  isFallback,
  idealLoad,
  capHours,
}: {
  rows: ChartRow[];
  components: ChartComponent[];
  isFallback: boolean;
  /** Shown in the caption when a task cannot be placed. */
  idealLoad?: number;
  capHours?: number;
}) {
  const reduced = usePrefersReducedMotion();

  if (rows.length === 0) {
    return (
      <p className="text-[11px] leading-relaxed text-muted">
        Tidak ada anggota untuk dibandingkan pada tugas ini.
      </p>
    );
  }

  // Scale every bar against the largest total so the ranking is visible even
  // when all scores sit below 50%. The printed value is always the real score,
  // never the scaled one.
  const maxTotal = Math.max(...rows.map((r) => r.total), 0.0001);

  return (
    <div className="space-y-2.5">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Perbandingan skor kandidat per komponen K, S, C, M. Nilai total adalah skor akhir
          yang dipakai mesin, dan setiap komponen ditampilkan dengan bobot yang benar-benar
          diterapkan.
        </caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="pb-1 pr-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
              Anggota
            </th>
            <th scope="col" className="pb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
              Komposisi skor
            </th>
            <th scope="col" className="pb-1 pl-2 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const width = Math.max(0.02, row.total / maxTotal);
            const label = [
              row.isPrimary ? 'penanggung jawab' : row.isAlternative ? 'alternatif' : null,
              row.isEligible ? null : row.rule ? `gugur ${row.rule}` : 'gugur',
            ]
              .filter(Boolean)
              .join(', ');

            return (
              <tr
                key={row.memberId}
                data-testid={`chart-row-${row.memberId}`}
                className="border-b border-line/60 align-middle last:border-b-0"
              >
                <th scope="row" className="w-[112px] py-1.5 pr-2 text-left align-middle font-normal">
                  <span className="block truncate text-[11.5px] font-medium text-ink">{row.name}</span>
                  {label && (
                    <span
                      className={`mt-0.5 inline-block text-[9px] uppercase tracking-[0.05em] ${
                        row.isPrimary
                          ? 'font-semibold text-[var(--accent-strong)]'
                          : row.isEligible
                            ? 'text-muted'
                            : 'font-semibold text-fog'
                      }`}
                    >
                      {row.isEligible ? label : `\u2715 ${label}`}
                    </span>
                  )}
                </th>
                <td className="py-1.5 align-middle">
                  <div className="flex items-center gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div
                        className="flex h-[9px] w-full overflow-hidden rounded-sm bg-line"
                        role="img"
                        aria-label={`${row.name}: ${components
                          .map((c) => `${c.label} ${Math.round(row[c.key] * 100)} persen`)
                          .join(', ')}. Skor total ${Math.round(row.total * 100)} persen.`}
                      >
                        {/* One wrapper sets the total width; segments keep their
                            real proportions inside it. */}
                        {reduced ? (
                          <div className="flex h-full origin-left" style={{ width: `${width * 100}%` }}>
                            {components.map((component) => (
                              <span
                                key={component.key}
                                className="block h-full"
                                style={{
                                  width: `${Math.max(0, Math.min(1, row[component.key])) * 100}%`,
                                  backgroundColor: component.color,
                                }}
                              />
                            ))}
                          </div>
                        ) : (
                          <motion.div
                            data-motion-reveal=""
                            className="flex h-full origin-left"
                            style={{ width: `${width * 100}%` }}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: DURATION.data, ease: EASE.out }}
                          >
                            {components.map((component) => (
                              <span
                                key={component.key}
                                className="block h-full"
                                style={{
                                  width: `${Math.max(0, Math.min(1, row[component.key])) * 100}%`,
                                  backgroundColor: component.color,
                                }}
                              />
                            ))}
                          </motion.div>
                        )}
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0 font-mono text-[9.5px] tabular-nums text-muted" data-numeric>
                        {components.map((component) => (
                          <span key={component.key}>
                            <span style={{ color: component.color }}>{component.key}</span>{' '}
                            {Math.round(row[component.key] * 100)}
                          </span>
                        ))}
                      </p>
                    </div>
                    <span className="w-[34px] shrink-0 text-right font-mono text-[12px] font-bold tabular-nums text-ink" data-numeric>
                      {Math.round(row.total * 100)}
                      <span className="text-[9px] font-normal">%</span>
                    </span>
                  </div>
                </td>
                <td className="w-[38px] py-1.5 pl-2 text-right align-middle">
                  {row.isPrimary ? (
                    <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--accent-strong)]">
                      utama
                    </span>
                  ) : row.isAlternative ? (
                    <span className="text-[9px] uppercase tracking-[0.06em] text-ink">alt</span>
                  ) : (
                    <span className="text-[9px] uppercase tracking-[0.06em] text-fog">tidak</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="space-y-1 border-t border-line pt-2">
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {components.map((component) => (
            <li key={component.key} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="block h-[3px] w-3 rounded-full"
                style={{ backgroundColor: component.color }}
              />
              <span className="text-[10px] text-muted">
                <span className="font-mono font-bold" style={{ color: component.color }}>
                  {component.key}
                </span>{' '}
                {component.label} · bobot {Math.round(component.weight * 100)}%
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[10px] leading-relaxed text-muted">
          Panjang batang mengikuti skor akhir. Tinggi total adalah skor, potongannya adalah
          kontribusi tiap komponen.
          {isFallback
            ? ' Mode cadangan aktif: K tidak dihitung, sehingga bobot K 0%.'
            : ' Skor = 0,40K + 0,30S + 0,20C + 0,10M.'}
          {typeof capHours === 'number' && typeof idealLoad === 'number'
            ? ` Batas R2 ${capHours.toFixed(2)} jam (1,25 × beban ideal ${idealLoad.toFixed(2)} jam).`
            : ''}
        </p>
        <p className="text-[10px] leading-relaxed text-muted">
          Tanda ✕ berarti anggota tidak memenuhi aturan, dan huruf setelahnya menyebut aturan
          penyebabnya. Status tidak hanya dibedakan dengan warna.
        </p>
      </div>
    </div>
  );
}
