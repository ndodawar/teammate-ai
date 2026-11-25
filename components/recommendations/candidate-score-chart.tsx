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

/**
 * The five states the matrix must distinguish (T-FIX-MATRIX-01 point 10).
 *
 * Derived in one place so the chart, the panel and the matrix cell cannot
 * disagree. The order matters: an R1 exclusion is decided before any score is
 * computed, and an R3 warning applies only to a member who is otherwise
 * eligible, so a member excluded by R2 is never called a "valid alternative".
 */
export type CandidateStatus = 'primary' | 'alternative' | 'candidate' | 'gugur-r1' | 'gugur-r2' | 'gugur-r3' | 'gugur';

export function candidateStatus(row: {
  isPrimary: boolean;
  isAlternative: boolean;
  isEligible: boolean;
  rule?: string;
}): CandidateStatus {
  if (row.isPrimary) return 'primary';
  if (row.isAlternative) return 'alternative';
  if (row.isEligible) return 'candidate';
  if (row.rule === 'R1') return 'gugur-r1';
  if (row.rule === 'R2') return 'gugur-r2';
  if (row.rule === 'R3') return 'gugur-r3';
  return 'gugur';
}

/** Short Indonesian label for a status, used as visible text, never colour. */
export function candidateStatusLabel(status: CandidateStatus): string {
  switch (status) {
    case 'primary':
      return 'utama';
    case 'alternative':
      return 'alternatif';
    case 'candidate':
      return 'kandidat';
    case 'gugur-r1':
      return 'gugur R1';
    case 'gugur-r2':
      return 'gugur R2';
    case 'gugur-r3':
      return 'gugur R3';
    default:
      return 'gugur';
  }
}

/**
 * T-UI-FINAL-01: the eligibility column in the words a user can read.
 *
 * "gugur R2" is a code, not a sentence. This is the same five states the matrix
 * distinguishes, spelled out; the code still travels in `code` so an examiner can
 * map the row back to the PRD without the reader having to decode it first.
 */
export function candidateEligibilityPlain(status: CandidateStatus): {
  label: string;
  code?: string;
  reason: string;
} {
  switch (status) {
    case 'primary':
      return { label: 'Penanggung jawab', reason: 'Memenuhi semua aturan dan skor tertinggi.' };
    case 'alternative':
      return { label: 'Alternatif', reason: 'Layak menerima tugas ini sebagai pilihan kedua.' };
    case 'candidate':
      return { label: 'Layak', reason: 'Memenuhi aturan, tetapi skornya belum tertinggi.' };
    case 'gugur-r1':
      return {
        label: 'Tidak layak',
        code: 'R1',
        reason: 'Anggota tidak memiliki waktu tersedia.',
      };
    case 'gugur-r2':
      return { label: 'Tidak layak', code: 'R2', reason: 'Beban kerja melebihi batas.' };
    case 'gugur-r3':
      return {
        label: 'Tidak layak',
        code: 'R3',
        reason: 'Belum ada kemampuan minimum yang dibutuhkan.',
      };
    default:
      return { label: 'Tidak layak', reason: 'Tidak memenuhi aturan penugasan.' };
  }
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
    <div className="space-y-3">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Perbandingan skor kandidat per komponen K, S, C, M. Nilai total adalah skor akhir
          yang dipakai mesin, dan setiap komponen ditampilkan dengan bobot yang benar-benar
          diterapkan.
        </caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="pb-1.5 pr-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
              Anggota
            </th>
            <th scope="col" className="pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
              Skor kecocokan
            </th>
            <th scope="col" className="pb-1.5 pl-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
              Kelayakan
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const width = Math.max(0.02, row.total / maxTotal);
            const status = candidateStatus(row);
            const plain = candidateEligibilityPlain(status);
            /*
             * The spoken text carries the role in full, because the visible
             * column is short by design. Without this the screen reader named the
             * numbers and left out the verdict.
             */
            const ariaStatus = `${plain.label}${plain.code ? `, ${plain.code}` : ''}. ${plain.reason}`;

            return (
              <tr
                key={row.memberId}
                data-testid={`chart-row-${row.memberId}`}
                className="border-b border-line/60 align-top last:border-b-0"
              >
                <th scope="row" className="w-[132px] py-2 pr-2 text-left align-top font-normal">
                  <span className="block text-[13px] font-semibold leading-snug text-ink">{row.name}</span>
                  {!row.isEligible && plain.reason && (
                    <span className="mt-0.5 block text-[10.5px] leading-snug text-muted">
                      {plain.reason}
                    </span>
                  )}
                  {row.isEligible && status === 'candidate' && (
                    <span className="mt-0.5 block text-[10.5px] leading-snug text-muted">
                      {plain.reason}
                    </span>
                  )}
                </th>
                <td className="py-2 align-top">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div
                        className="flex h-[12px] w-full overflow-hidden rounded-sm bg-line"
                        role="img"
                        aria-label={`${row.name}: ${ariaStatus} ${components
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
                      <p className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0 font-mono text-[10.5px] tabular-nums text-muted" data-numeric>
                        {components.map((component) => (
                          <span key={component.key}>
                            <span style={{ color: component.color }}>{component.key}</span>{' '}
                            {Math.round(row[component.key] * 100)}
                          </span>
                        ))}
                      </p>
                    </div>
                    <span className="w-[42px] shrink-0 text-right font-mono text-[15px] font-bold tabular-nums text-ink" data-numeric>
                      {Math.round(row.total * 100)}
                      <span className="text-[10px] font-normal">%</span>
                    </span>
                  </div>
                </td>
                <td className="w-[112px] py-2 pl-2 text-right align-top">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                      row.isEligible ? 'bg-ok-surface text-ok' : 'bg-warn-surface text-warn'
                    }`}
                  >
                    <span aria-hidden="true" className="mr-1 font-mono">
                      {row.isEligible ? '✓' : '×'}
                    </span>
                    {plain.label}
                  </span>
                  {plain.code && (
                    <span className="mt-0.5 block font-mono text-[10px] text-fog">{plain.code}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="space-y-1.5 border-t border-line pt-2.5">
        <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5">
          {components.map((component) => (
            <li key={component.key} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="block h-[3px] w-3.5 rounded-full"
                style={{ backgroundColor: component.color }}
              />
              <span className="text-[10.5px] text-muted">
                <span className="font-mono font-bold" style={{ color: component.color }}>
                  {component.key}
                </span>{' '}
                {component.label} · bobot {Math.round(component.weight * 100)}%
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[10.5px] leading-relaxed text-muted">
          Panjang batang mengikuti skor akhir; potongannya adalah kontribusi tiap komponen.
          {isFallback
            ? ' Mode cadangan aktif: K tidak dihitung, sehingga bobot K 0%.'
            : ' Skor = 0,40K + 0,30S + 0,20C + 0,10M.'}
          {typeof capHours === 'number' && typeof idealLoad === 'number'
            ? ` Batas beban ${capHours.toFixed(2)} jam (1,25 × beban ideal ${idealLoad.toFixed(2)} jam).`
            : ''}
        </p>
        <p className="text-[10.5px] leading-relaxed text-muted">
          Kelayakan ditentukan aturan, bukan oleh skor. Anggota berskor tinggi tetap tidak layak
          bila melewati batas beban atau tidak memenuhi kemampuan minimum. Status ditandai dengan
          teks, bukan hanya warna.
        </p>
      </div>
    </div>
  );
}
