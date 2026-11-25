'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { DURATION, EASE } from '@/lib/motion/tokens';
import { WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import { describeOverCap } from '@/lib/scoring/interaction';
import type { AssignmentResult, Member, Task } from '@/lib/scoring/types';

/**
 * T-UI-MATRIX-01: the recommendation dashboard that sits above the matrix.
 *
 * Every figure on this page comes from ONE `AssignmentResult`. The caller passes
 * the same object it hands to the matrix and the chart, so the summary, the task
 * cards and the full matrix cannot drift apart: there is no second calculation
 * and no separate fetch.
 *
 * The split between "score" and "eligibility" is the point of the whole screen.
 * A score is a comparison between members; eligibility is whether the rules let
 * that member take the task. They are printed in separate, labelled places, and
 * a member is only ever called "penanggung jawab" when the engine actually
 * assigned them (`primaryMemberId`).
 */

/** One summary figure. Rendered as a definition pair, not a floating card. */
function Stat({
  label,
  value,
  unit,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'ok'
          ? 'text-ok'
          : 'text-ink';
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-[10.5px] leading-snug text-muted">{label}</dt>
      <dd className={`font-mono text-[17px] font-semibold leading-none tabular-nums ${toneClass}`} data-numeric>
        {value}
        {unit && <span className="ml-0.5 text-[10.5px] font-normal text-muted">{unit}</span>}
      </dd>
      {detail && <p className="text-[10px] leading-snug text-fog">{detail}</p>}
    </div>
  );
}

export interface DashboardSummary {
  totalTasks: number;
  totalMembers: number;
  assigned: number;
  needsAttention: number;
  totalLoad: number;
  totalCapacity: number;
  capHours: number;
  idealLoad: number;
}

/**
 * Derives the summary from the engine result. Exported so the test can assert
 * the counts against a real `globalAssign` run rather than a hand-written
 * fixture.
 */
export function summarise(
  result: AssignmentResult,
  members: Member[],
  tasks: Task[]
): DashboardSummary {
  const assigned = result.assignments.filter((a) => a.primaryMemberId !== '').length;
  const totalLoad = Object.values(result.memberLoads).reduce((sum, load) => sum + load, 0);
  const totalCapacity = members.reduce((sum, m) => sum + m.capacity, 0);
  return {
    totalTasks: tasks.length,
    totalMembers: members.length,
    assigned,
    // "Needs attention" is a count of tasks the engine could not place, not an
    // estimate: it is the remainder of the same subtraction.
    needsAttention: tasks.length - assigned,
    totalLoad,
    totalCapacity,
    capHours: result.idealLoad * WORKLOAD_CAP_MULTIPLIER,
    idealLoad: result.idealLoad,
  };
}

export function ResultSummary({ summary }: { summary: DashboardSummary }) {
  const reduced = usePrefersReducedMotion();
  const { assigned, needsAttention, totalTasks } = summary;

  return (
    <section
      className="glass-solid rounded-[var(--radius-card)] p-4"
      aria-label="Ringkasan hasil pembagian"
      data-testid="result-summary"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2.5">
        <h2 className="heading text-[13.5px] text-ink">Ringkasan hasil</h2>
        <p className="text-[11px] text-muted">
          {assigned} dari {totalTasks} tugas mendapat penanggung jawab
        </p>
      </header>

      {/*
        The allocation bar states the one fact a student needs first: how much
        of the work is settled. It is a ratio of two real counts, so its width is
        information, not decoration. The same numbers are printed beside it, so
        the bar never has to be read for anyone who cannot see it.
      */}
      <div
        className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={`${assigned} tugas berhasil dialokasikan, ${needsAttention} tugas perlu perhatian, dari ${totalTasks} tugas.`}
      >
        {reduced ? (
          <div
            className="h-full origin-left rounded-full bg-ok"
            style={{ transform: `scaleX(${totalTasks > 0 ? assigned / totalTasks : 0})` }}
          />
        ) : (
          <motion.div
            data-motion-reveal=""
            className="h-full w-full origin-left rounded-full bg-ok"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: totalTasks > 0 ? assigned / totalTasks : 0 }}
            transition={{ duration: DURATION.data, ease: EASE.out }}
          />
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Stat label="Total tugas" value={String(summary.totalTasks)} unit="tugas" />
        <Stat label="Total anggota" value={String(summary.totalMembers)} unit="orang" />
        <Stat
          label="Berhasil dialokasikan"
          value={String(assigned)}
          unit="tugas"
          tone={assigned > 0 ? 'ok' : 'neutral'}
        />
        <Stat
          label="Perlu perhatian"
          value={String(needsAttention)}
          unit="tugas"
          tone={needsAttention > 0 ? 'warn' : 'neutral'}
        />
        <Stat
          label="Total beban terpasang"
          value={summary.totalLoad.toFixed(0)}
          unit="jam"
          detail={`dari ${summary.totalCapacity} jam tersedia`}
        />
        <Stat
          label="Batas R2 per anggota"
          value={summary.capHours.toFixed(2)}
          unit="jam"
          detail={`1,25 × beban ideal ${summary.idealLoad.toFixed(2)} jam`}
        />
      </dl>
    </section>
  );
}

/** One component's contribution line inside the disclosure. */
function ContributionRow({
  letter,
  label,
  plain,
  raw,
  weight,
  color,
}: {
  letter: string;
  label: string;
  plain: string;
  raw: number;
  weight: number;
  color: string;
}) {
  const contribution = raw * weight;
  return (
    <div className="space-y-1">
      <dt className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="font-mono text-[10.5px] font-bold" style={{ color }}>
          {letter}
        </span>
        <span className="text-[11.5px] font-medium text-ink">{label}</span>
        <span className="text-[10.5px] text-muted">{plain}</span>
      </dt>
      <dd className="space-y-1">
        <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] tabular-nums" data-numeric>
          <span className="text-ink">{Math.round(raw * 100)}</span>
          <span className="text-muted">
            × {Math.round(weight * 100)}% = {contribution.toFixed(1)} poin
          </span>
        </div>
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full w-full origin-left rounded-full"
            style={{ transform: `scaleX(${Math.max(0, Math.min(1, raw))})`, backgroundColor: color }}
          />
        </div>
      </dd>
    </div>
  );
}

/**
 * The K/S/C/M disclosure. Collapsed by default so a student meets the verdict
 * first and the arithmetic only when they ask for it, per the ticket's point 4.
 */
export function ScoreDetail({
  breakdown,
  weights,
  isFallback,
  memberName,
}: {
  breakdown: { K: number; S: number; C: number; M: number; total: number };
  weights: { K: number; S: number; C: number; M: number };
  isFallback: boolean;
  memberName: string;
}) {
  const [open, setOpen] = useState(false);

  const parts = [
    {
      letter: 'K',
      label: 'Kemiripan konten',
      plain: 'seberapa mirip deskripsi tugas dengan profil anggota',
      raw: breakdown.K,
      weight: isFallback ? 0 : weights.K,
      color: 'var(--k)',
    },
    {
      letter: 'S',
      label: 'Kecocokan skill',
      plain: 'seberapa tinggi level skill yang diminta tugas',
      raw: breakdown.S,
      weight: weights.S,
      color: 'var(--s)',
    },
    {
      letter: 'C',
      label: 'Sisa kapasitas',
      plain: 'seberapa lapang jam anggota setelah tugas ini',
      raw: breakdown.C,
      weight: weights.C,
      color: 'var(--c)',
    },
    {
      letter: 'M',
      label: 'Minat',
      plain: 'seberapa tinggi minat anggota pada pekerjaan ini',
      raw: breakdown.M,
      weight: weights.M,
      color: 'var(--m)',
    },
  ];

  const formula = isFallback
    ? `Skor = ${Math.round(weights.S * 100)}% S + ${Math.round(weights.C * 100)}% C + ${Math.round(weights.M * 100)}% M`
    : `Skor = ${Math.round(weights.K * 100)}% K + ${Math.round(weights.S * 100)}% S + ${Math.round(weights.C * 100)}% C + ${Math.round(weights.M * 100)}% M`;

  return (
    <div className="border-t border-line pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[32px] w-full items-center justify-between gap-2 rounded-md px-1 text-left text-[11.5px] font-medium text-ink transition-colors duration-200 hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <span>Rincian perhitungan K, S, C, M</span>
        <span aria-hidden="true" className="font-mono text-[11px] text-muted">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="space-y-2 pt-2" data-testid="score-detail">
          <p className="text-[10.5px] leading-relaxed text-muted">
            Skor {memberName} dihitung dari empat komponen. Setiap komponen bernilai 0 sampai 100,
            lalu dikalikan bobotnya dan dijumlahkan.
          </p>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {parts.map((part) => (
              <ContributionRow
                key={part.letter}
                letter={part.letter}
                label={part.label}
                plain={part.plain}
                raw={part.raw}
                weight={part.weight}
                color={part.color}
              />
            ))}
          </dl>
          <p className="font-mono text-[10.5px] tabular-nums text-ink" data-numeric data-testid="score-formula">
            {formula}
          </p>
          <p className="text-[10px] leading-relaxed text-muted">
            Total = {Math.round(breakdown.total * 100)} poin. Skor ini hanya perbandingan antar
            anggota; kelayakan ditentukan aturan R1 sampai R5.
            {isFallback ? ' Mode cadangan aktif: K tidak dihitung.' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * A load bar for one member, with the numbers printed beside it. The bar is
 * scaled against the R2 ceiling so the threshold is visible on the same axis:
 * a bar that reaches the end is a member at the cap, not an arbitrary maximum.
 */
export function MemberLoadRow({
  name,
  load,
  capacity,
  capHours,
  isAfterSimulation,
}: {
  name: string;
  load: number;
  capacity: number;
  capHours: number;
  isAfterSimulation?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const overCap = load > capHours;
  const overCapacity = load > capacity;
  const axis = Math.max(capHours, capacity, load, 0.0001);
  const ratio = Math.max(0, Math.min(1, load / axis));
  const fill = overCapacity ? 'var(--danger)' : overCap ? 'var(--warn)' : 'var(--accent)';
  const status = overCapacity
    ? `melewati jam tersedia (${capacity} jam)`
    : overCap
      ? `melampaui batas R2 (${capHours.toFixed(2)} jam)`
      : 'dalam batas';

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="truncate text-[11.5px] font-medium text-ink">
          {name}
          {isAfterSimulation && <span className="ml-1 text-[10px] font-normal text-muted">(simulasi)</span>}
        </span>
        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted" data-numeric>
          {load.toFixed(1)} / {capacity} jam
        </span>
      </div>
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-line">
        {reduced ? (
          <div
            className="h-full origin-left rounded-full"
            style={{ transform: `scaleX(${ratio})`, backgroundColor: fill }}
          />
        ) : (
          <motion.div
            data-motion-reveal=""
            className="h-full w-full origin-left rounded-full"
            style={{ backgroundColor: fill }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: ratio }}
            transition={{ duration: DURATION.data, ease: EASE.out }}
          />
        )}
      </div>
      <p className={`text-[10px] leading-snug ${overCap || overCapacity ? 'font-semibold text-danger' : 'text-muted'}`}>
        {overCap || overCapacity ? 'Melewati batas: ' : 'Dalam batas: '}
        {status}
      </p>
    </div>
  );
}

/**
 * One task's recommendation card. The owner is only named when the engine set
 * `primaryMemberId`; otherwise the card says the task is not allocated and shows
 * the R2 arithmetic from the engine's own `detail`.
 */
export interface TaskCardData {
  task: Task;
  ownerName: string | null;
  ownerScore: number | null;
  /**
   * The engine's verdict for `ownerName` (`CandidateScore.isEligible`).
   *
   * `null` when there is no owner. This is what lets the card refuse to present
   * an R3 best-effort owner as an ordinary one: the engine assigned them, but the
   * rules were not met, so the label says so right next to the name instead of
   * only in a note at the bottom of the card.
   */
  ownerIsEligible?: boolean | null;
  alternativeName: string | null;
  alternativeScore: number | null;
  /** Engine warnings for this task, verbatim. */
  warnings: AssignmentResult['warnings'];
}

export function TaskRecommendationCard({
  data,
  capHours,
  idealLoad,
  onAccept,
  onLock,
  onMove,
  onSplit,
  children,
}: {
  data: TaskCardData;
  capHours: number;
  idealLoad: number;
  onAccept?: () => void;
  onLock?: () => void;
  onMove?: () => void;
  onSplit?: () => void;
  /** The score disclosure and anything else the caller attaches. */
  children?: React.ReactNode;
}) {
  const { task, ownerName, ownerScore, ownerIsEligible, alternativeName, alternativeScore, warnings } = data;
  const isAllocated = ownerName !== null;
  /*
   * T-FINAL-QA-01: an owner the engine assigned as a best-effort R3 fallback has
   * `isEligible: false`. The card must not print that name as if the rules were
   * satisfied, so the verdict travels with the name.
   */
  const ownerUnqualified = isAllocated && ownerIsEligible === false;
  const impossible = warnings.find((w) => w.code === 'r2_no_candidate' && w.detail?.exceedsCapAlone);
  const r3Warning = warnings.find((w) => w.code === 'r3_no_candidate');

  return (
    <article
      className="surface-card rounded-[var(--radius-card)] p-3.5"
      data-testid={`task-card-${task.id}`}
      data-allocated={isAllocated ? 'true' : 'false'}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-2">
        <h3 className="min-w-0 text-[13px] font-semibold leading-snug text-ink">{task.title}</h3>
        <p className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted" data-numeric>
          {task.estimated_hours} jam · effort {task.difficulty}/5
        </p>
      </header>

      <div className="grid gap-x-4 gap-y-2 pt-2.5 sm:grid-cols-2">
        {/* Who actually receives the task. Empty when the rules allowed no one. */}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.08em] text-muted">Penanggung jawab</p>
          {isAllocated ? (
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-[13px] font-semibold text-ink">{ownerName}</span>
              {ownerScore !== null && (
                <span className="font-mono text-[10.5px] tabular-nums text-muted" data-numeric>
                  skor {Math.round(ownerScore * 100)}%
                </span>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] font-semibold text-danger">
              Tidak layak dialokasikan
            </p>
          )}
          {/*
            The verdict sits directly under the name, not only in the note at the
            bottom. A reader who stops after the first line still learns that this
            name is a suggestion, not a qualified assignment.
          */}
          {ownerUnqualified && (
            <p
              className="mt-1 text-[10.5px] font-semibold leading-snug text-warn"
              data-testid={`card-owner-unqualified-${task.id}`}
            >
              Belum memenuhi aturan: saran terbaik, bukan penugasan final
            </p>
          )}
        </div>

        {/* The eligibility verdict, separate from the score column beside it. */}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.08em] text-muted">Alternatif</p>
          {alternativeName ? (
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-[12px] font-medium text-ink">{alternativeName}</span>
              {alternativeScore !== null && (
                <span className="font-mono text-[10.5px] tabular-nums text-muted" data-numeric>
                  skor {Math.round(alternativeScore * 100)}%
                </span>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-[11.5px] text-muted">
              Tidak ada alternatif yang memenuhi aturan
            </p>
          )}
        </div>
      </div>

      {/*
        The cap itself, printed on the card, so a reader never has to scroll to
        another panel to learn what "melebihi batas" means for this task.
      */}
      <p className="pt-2 font-mono text-[10px] tabular-nums text-fog" data-numeric>
        Batas R2 {capHours.toFixed(2)} jam · beban ideal {idealLoad.toFixed(2)} jam
      </p>

      {/*
        The reason block. For an infeasible task it carries the four numbers from
        `describeOverCap`, computed from the engine's own detail, so the sentence
        and the figures beside it cannot disagree.
      */}
      {impossible?.detail && (
        <div className="mt-2.5 rounded-[var(--radius-input)] bg-danger-surface px-2.5 py-2" data-testid={`card-r2-${task.id}`}>
          <p className="text-[11.5px] font-semibold text-danger">Tidak layak dialokasikan</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-danger">
            Tugas belum dapat dialokasikan karena estimasi usaha melebihi batas beban anggota.
            Pecah tugas menjadi beberapa subtugas atau periksa kembali estimasi usahanya.
          </p>
          <p className="mt-1 font-mono text-[10.5px] tabular-nums text-danger" data-numeric>
            {
              describeOverCap({
                taskHours: impossible.detail.taskHours,
                idealLoad: impossible.detail.idealLoad,
                capHours: impossible.detail.capHours,
              }).summary
            }
          </p>
        </div>
      )}

      {r3Warning && (
        <div className="mt-2.5 rounded-[var(--radius-input)] bg-warn-surface px-2.5 py-2" data-testid={`card-r3-${task.id}`}>
          <p className="text-[11.5px] font-semibold text-warn">R3 tidak menemukan kandidat level 3</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-warn">
            Belum ada anggota yang menguasai skill wajib tugas ini pada level 3 atau lebih. Saran di
            atas adalah kandidat terbaik yang ada, tetapi belum memenuhi R3.
          </p>
        </div>
      )}

      {/* Actions reuse the existing handlers; they are not a second code path. */}
      {(onAccept || onLock || onMove || onSplit) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2.5">
          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              className="inline-flex min-h-[32px] items-center rounded-full bg-card px-2.5 text-[11px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-200 hover:shadow-[inset_0_0_0_1px_var(--ink)] max-sm:min-h-[44px]"
            >
              Terima rekomendasi
            </button>
          )}
          {onSplit && (
            <button
              type="button"
              onClick={onSplit}
              className="inline-flex min-h-[32px] items-center rounded-full bg-card px-2.5 text-[11px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-200 hover:shadow-[inset_0_0_0_1px_var(--ink)] max-sm:min-h-[44px]"
            >
              Pecah tugas
            </button>
          )}
          {onMove && (
            <button
              type="button"
              onClick={onMove}
              className="inline-flex min-h-[32px] items-center rounded-full bg-card px-2.5 text-[11px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-200 hover:shadow-[inset_0_0_0_1px_var(--ink)] max-sm:min-h-[44px]"
            >
              Pindahkan
            </button>
          )}
          {onLock && (
            <button
              type="button"
              onClick={onLock}
              className="inline-flex min-h-[32px] items-center rounded-full bg-card px-2.5 text-[11px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-200 hover:shadow-[inset_0_0_0_1px_var(--ink)] max-sm:min-h-[44px]"
            >
              Kunci
            </button>
          )}
        </div>
      )}

      {children}
    </article>
  );
}
