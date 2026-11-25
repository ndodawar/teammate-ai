'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { DURATION, EASE } from '@/lib/motion/tokens';
import { WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import { describeOverCap } from '@/lib/scoring/interaction';
import type { AssignmentResult, Member, Task } from '@/lib/scoring/types';

/**
 * T-UI-FINAL-01: the recommendation dashboard, written for the person reading it.
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
 *
 * The copy follows one rule: name the outcome first, the rule code second. A
 * student does not know what R2 is, so the card says "Beban kerja melebihi
 * batas" and prints "R2" only in the small margin. Nothing on this page invented
 * a figure; every sentence is assembled from engine output.
 */

/**
 * The five hard constraints in the words a user can act on.
 *
 * `code` stays visible as small secondary text so an examiner can still map the
 * sentence back to PRD R1–R5, and so the existing tests and the export keep
 * talking about the same rules.
 */
export const RULE_PLAIN: Readonly<Record<'R1' | 'R2' | 'R3' | 'R4' | 'R5', string>> = {
  R1: 'Anggota tidak memiliki waktu tersedia.',
  R2: 'Beban kerja melebihi batas.',
  R3: 'Belum ada anggota dengan kemampuan minimum yang dibutuhkan.',
  R4: 'Setiap tugas hanya memiliki satu penanggung jawab.',
  R5: 'Tugas ini dikunci dan tidak akan berubah otomatis.',
};

/** The four score components in the words a user can act on. */
export const COMPONENT_PLAIN: Readonly<Record<'K' | 'S' | 'C' | 'M', string>> = {
  K: 'Kemiripan kebutuhan tugas',
  S: 'Kesesuaian kemampuan',
  C: 'Ketersediaan kapasitas',
  M: 'Minat anggota',
};

/**
 * The three load standings, as one exhaustive value.
 *
 * The threshold is the R2 ceiling the engine enforces (1,25 × beban ideal), not
 * a number chosen for the bar: "mendekati batas" starts at 80% of that ceiling.
 */
export type LoadStanding = 'dalam-batas' | 'mendekati-batas' | 'melebihi-batas';

export function loadStanding(load: number, capHours: number): LoadStanding {
  // A non-positive cap means the engine could not derive a limit; anything held
  // above zero hours is then over it rather than silently "within bounds".
  if (capHours <= 0) return load > 0 ? 'melebihi-batas' : 'dalam-batas';
  if (load > capHours) return 'melebihi-batas';
  if (load >= capHours * 0.8) return 'mendekati-batas';
  return 'dalam-batas';
}

/**
 * A status label that never relies on colour alone.
 *
 * The mark is a different glyph per state (`✓`, `!`, `×`) and the label is
 * always spelled out, so the meaning survives a greyscale printout, a colour
 * blind reader, and a projector with the contrast turned down.
 */
export function StatusPill({
  standing,
  label,
  size = 'sm',
}: {
  standing: LoadStanding;
  label: string;
  size?: 'sm' | 'md';
}) {
  const mark = standing === 'dalam-batas' ? '✓' : standing === 'mendekati-batas' ? '!' : '×';
  const tone =
    standing === 'dalam-batas'
      ? 'bg-ok-surface text-ok'
      : standing === 'mendekati-batas'
        ? 'bg-warn-surface text-warn'
        : 'bg-danger-surface text-danger';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ${tone} ${
        size === 'md' ? 'px-2.5 py-1 text-[11.5px]' : 'px-2 py-0.5 text-[10.5px]'
      }`}
    >
      <span aria-hidden="true" className="font-mono text-[11px] leading-none">
        {mark}
      </span>
      {label}
    </span>
  );
}

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
  /*
   * A percentage only exists when there is something to divide by. Printing
   * "0%" for an empty project would claim a measurement that was never taken, so
   * the figure is omitted rather than defaulted.
   */
  const completion = totalTasks > 0 ? Math.round((assigned / totalTasks) * 100) : null;

  return (
    <section
      className="glass-solid rounded-[var(--radius-card)] p-4 sm:p-5"
      aria-label="Ringkasan hasil pembagian"
      data-testid="result-summary"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-2.5">
        <h2 className="heading text-[14px] text-ink">Ringkasan hasil</h2>
        {completion !== null && (
          <p className="text-[12px] text-muted" data-testid="completion-line">
            <span className="font-mono text-[15px] font-semibold tabular-nums text-ink" data-numeric>
              {completion}%
            </span>{' '}
            tugas sudah punya penanggung jawab
          </p>
        )}
      </header>

      {/*
        The allocation bar states the one fact a student needs first: how much
        of the work is settled. It is a ratio of two real counts, so its width is
        information, not decoration. The same numbers are printed beside it, so
        the bar never has to be read for anyone who cannot see it.
      */}
      <div
        className="mt-3 h-[7px] w-full overflow-hidden rounded-full bg-line"
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

      {/*
        The four indicators the ticket asks for, then two supporting load
        figures. They stay in one grid so a projector shows all six without a
        scroll, and the two that carry a verdict keep their tone in the label
        text as well as the number.
      */}
      <dl className="mt-3.5 grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4">
        <Stat label="Total tugas" value={String(summary.totalTasks)} unit="tugas" />
        <Stat label="Total anggota" value={String(summary.totalMembers)} unit="orang" />
        <Stat
          label="Tugas berhasil dibagikan"
          value={String(assigned)}
          unit="tugas"
          detail={completion !== null ? `${completion}% dari seluruh tugas` : undefined}
          tone={assigned > 0 ? 'ok' : 'neutral'}
        />
        <Stat
          label="Tugas perlu penyesuaian"
          value={String(needsAttention)}
          unit="tugas"
          detail={
            needsAttention === 0
              ? 'semua tugas sudah punya pemilik'
              : 'lihat alasan di tiap kartu tugas'
          }
          tone={needsAttention > 0 ? 'warn' : 'neutral'}
        />
      </dl>

      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-3 sm:grid-cols-3">
        <Stat
          label="Total beban terpasang"
          value={summary.totalLoad.toFixed(0)}
          unit="jam"
          detail={`dari ${summary.totalCapacity} jam tersedia`}
        />
        <Stat
          label="Beban ideal per anggota"
          value={summary.idealLoad.toFixed(2)}
          unit="jam"
          detail="total jam tugas ÷ jumlah anggota"
        />
        <Stat
          label="Batas beban per anggota"
          value={summary.capHours.toFixed(2)}
          unit="jam"
          detail="1,25 × beban ideal"
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
  idealLoad,
  capHours,
}: {
  breakdown: { K: number; S: number; C: number; M: number; total: number };
  weights: { K: number; S: number; C: number; M: number };
  isFallback: boolean;
  memberName: string;
  /** Ideal load the engine used, so the disclosure can show the division. */
  idealLoad?: number;
  /** R2 ceiling the engine used (1,25 × ideal), for the same reason. */
  capHours?: number;
}) {
  const [open, setOpen] = useState(false);

  const parts = [
    {
      letter: 'K',
      label: COMPONENT_PLAIN.K,
      plain: 'seberapa dekat kebutuhan tugas dengan profil anggota',
      raw: breakdown.K,
      weight: isFallback ? 0 : weights.K,
      color: 'var(--k)',
    },
    {
      letter: 'S',
      label: COMPONENT_PLAIN.S,
      plain: 'seberapa tinggi kemampuan yang diminta tugas',
      raw: breakdown.S,
      weight: weights.S,
      color: 'var(--s)',
    },
    {
      letter: 'C',
      label: COMPONENT_PLAIN.C,
      plain: 'seberapa lapang jam anggota setelah tugas ini',
      raw: breakdown.C,
      weight: weights.C,
      color: 'var(--c)',
    },
    {
      letter: 'M',
      label: COMPONENT_PLAIN.M,
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
        className="flex min-h-[36px] w-full items-center justify-between gap-2 rounded-md px-1 text-left text-[12px] font-medium text-ink transition-colors duration-200 hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <span>Lihat rincian perhitungan</span>
        <span aria-hidden="true" className="font-mono text-[12px] text-muted">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="space-y-3 pt-2" data-testid="score-detail">
          <p className="text-[11.5px] leading-relaxed text-muted">
            Skor {memberName} dihitung dari empat komponen. Setiap komponen bernilai 0 sampai 100,
            lalu dikalikan bobotnya dan dijumlahkan.
          </p>
          <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
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
          <p className="font-mono text-[11px] tabular-nums text-ink" data-numeric data-testid="score-formula">
            {formula}
          </p>
          <p className="text-[11px] leading-relaxed text-muted">
            Total = {Math.round(breakdown.total * 100)} poin. Skor ini hanya perbandingan antar
            anggota; kelayakan ditentukan aturan R1 sampai R5.
            {isFallback ? ' Mode cadangan aktif: K tidak dihitung.' : ''}
          </p>

          {/*
            The academic block. It stays inside this disclosure because it answers
            "how exactly", not "what happened", and a presentation should not have
            to scroll past it. Nothing here is new information: the ideal load and
            the cap are the same two figures the engine used.
          */}
          <div className="space-y-2 rounded-[var(--radius-input)] bg-mist px-3 py-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
              Dasar perhitungan
            </p>
            <dl className="space-y-1 text-[11px] leading-relaxed">
              <div>
                <dt className="inline font-medium text-ink">Beban ideal</dt>
                <dd className="inline text-muted">
                  {' '}
                  = total jam seluruh tugas ÷ jumlah anggota
                  {typeof idealLoad === 'number' ? ` = ${idealLoad.toFixed(2)} jam` : ''}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-ink">Batas beban</dt>
                <dd className="inline text-muted">
                  {' '}
                  = 1,25 × beban ideal
                  {typeof capHours === 'number' ? ` = ${capHours.toFixed(2)} jam` : ''}
                </dd>
              </div>
            </dl>
            <ul className="space-y-1 border-t border-line pt-2 text-[10.5px] leading-relaxed text-muted">
              {(Object.keys(RULE_PLAIN) as Array<keyof typeof RULE_PLAIN>).map((code) => (
                <li key={code}>
                  <span className="font-mono font-semibold text-ink">{code}</span> — {RULE_PLAIN[code]}
                </li>
              ))}
            </ul>
          </div>
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
  /*
   * "Melebihi batas" has two distinct causes and they must not be merged: the
   * R2 ceiling counts the whole team, the capacity is this person's own weekly
   * hours. Whichever broke decides the sentence, so the reader is told which
   * number to change.
   */
  const overCap = load > capHours;
  const overCapacity = load > capacity;
  const standing = loadStanding(load, Math.min(capHours, capacity));
  const axis = Math.max(capHours, capacity, load, 0.0001);
  const ratio = Math.max(0, Math.min(1, load / axis));
  const fill =
    standing === 'melebihi-batas'
      ? 'var(--danger)'
      : standing === 'mendekati-batas'
        ? 'var(--warn)'
        : 'var(--ok)';
  const howMuchOver = Number((load - Math.min(capHours, capacity)).toFixed(2));
  const statusLabel =
    standing === 'melebihi-batas'
      ? 'Melebihi batas'
      : standing === 'mendekati-batas'
        ? 'Mendekati batas'
        : 'Dalam batas';
  const explanation = overCapacity
    ? `melewati jam tersedia ${capacity} jam sebanyak ${howMuchOver} jam`
    : overCap
      ? `melewati batas beban ${capHours.toFixed(2)} jam sebanyak ${howMuchOver} jam`
      : standing === 'mendekati-batas'
        ? `sudah memakai ${Math.round((load / Math.max(capHours, 0.0001)) * 100)}% dari batas beban`
        : `sisa ${Number(Math.max(0, Math.min(capHours, capacity) - load).toFixed(2))} jam sebelum batas`;

  return (
    <div className="space-y-1.5" data-testid={`load-row-${name}`} data-standing={standing}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="truncate text-[12.5px] font-medium text-ink">
          {name}
          {isAfterSimulation && <span className="ml-1 text-[10px] font-normal text-muted">(simulasi)</span>}
        </span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted" data-numeric>
          {load.toFixed(1)} / {capacity} jam
        </span>
      </div>
      <div className="h-[6px] w-full overflow-hidden rounded-full bg-line">
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
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <StatusPill standing={standing} label={statusLabel} />
        <span className="text-[10.5px] leading-snug text-muted">{explanation}</span>
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
  /**
   * One sentence in user language, already assembled from this member's real
   * breakdown by the caller. Absent when there is no owner to describe; the card
   * then explains the missing assignment instead of inventing a recommendation.
   */
  ownerReason?: string | null;
}

/**
 * The plain-language sentence for a valid assignment.
 *
 * Built from the same `matchingSkills` the engine's own explanation uses, so the
 * sentence names exactly the skills that cleared the R3 floor — never a skill the
 * member merely listed. When nothing cleared the floor the sentence says that
 * instead of praising an ability that was not there.
 */
export function assignmentReason(input: {
  memberName: string;
  matchedSkills: string[];
  requiredSkills: string[];
  score: number;
}): string {
  const skills = input.matchedSkills.join(' dan ');
  if (input.matchedSkills.length > 0) {
    return `Direkomendasikan kepada ${input.memberName} karena kemampuan ${skills} paling sesuai dengan kebutuhan tugas ini, dan kapasitasnya masih mencukupi. Skor kecocokan ${Math.round(
      input.score * 100
    )}%.`;
  }
  if (input.requiredSkills.length === 0) {
    return `Direkomendasikan kepada ${input.memberName} karena tugas ini tidak mensyaratkan kemampuan khusus, dan kapasitasnya masih mencukupi. Skor kecocokan ${Math.round(
      input.score * 100
    )}%.`;
  }
  return `Direkomendasikan kepada ${input.memberName} sebagai kandidat terbaik untuk tugas ini. Skor kecocokan ${Math.round(
    input.score * 100
  )}%.`;
}

/** The three outcomes a task card can show, as one explicit value. */
export type TaskCardStatus = 'dibagikan' | 'perlu-penyesuaian' | 'belum-dibagikan';

export function taskCardStatus(data: TaskCardData): TaskCardStatus {
  if (data.ownerName === null) return 'belum-dibagikan';
  if (data.ownerIsEligible === false) return 'perlu-penyesuaian';
  return 'dibagikan';
}

const CARD_STATUS_COPY: Record<TaskCardStatus, { label: string; standing: LoadStanding }> = {
  dibagikan: { label: 'Sudah dibagikan', standing: 'dalam-batas' },
  'perlu-penyesuaian': { label: 'Perlu penyesuaian', standing: 'mendekati-batas' },
  'belum-dibagikan': { label: 'Belum dapat dibagikan', standing: 'melebihi-batas' },
};

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
  // `ownerIsEligible` is read through `taskCardStatus`, which is the single
  // place the three-way verdict is decided; destructuring it again here would
  // create a second branch that could disagree with the status pill.
  const { task, ownerName, ownerScore, alternativeName, alternativeScore, warnings } = data;
  const status = taskCardStatus(data);
  const statusCopy = CARD_STATUS_COPY[status];
  const isAllocated = status !== 'belum-dibagikan';
  /*
   * T-FINAL-QA-01: an owner the engine assigned as a best-effort R3 fallback has
   * `isEligible: false`. The card must not print that name as if the rules were
   * satisfied, so the verdict travels with the name.
   */
  const ownerUnqualified = status === 'perlu-penyesuaian';
  const impossible = warnings.find((w) => w.code === 'r2_no_candidate' && w.detail?.exceedsCapAlone);
  const r3Warning = warnings.find((w) => w.code === 'r3_no_candidate');
  const overCap = impossible?.detail
    ? describeOverCap({
        taskHours: impossible.detail.taskHours,
        idealLoad: impossible.detail.idealLoad,
        capHours: impossible.detail.capHours,
      })
    : null;

  return (
    <article
      className={`surface-card rounded-[var(--radius-card)] p-4 sm:p-5 ${
        status === 'belum-dibagikan' ? 'shadow-[inset_0_0_0_1px_var(--danger)]' : ''
      }`}
      data-testid={`task-card-${task.id}`}
      data-allocated={isAllocated ? 'true' : 'false'}
      data-status={status}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-line pb-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-ink">{task.title}</h3>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted" data-numeric>
            Estimasi {task.estimated_hours} jam · tingkat kesulitan {task.difficulty} dari 5
          </p>
        </div>
        <StatusPill standing={statusCopy.standing} label={statusCopy.label} size="md" />
      </header>

      {isAllocated ? (
        <div className="grid gap-x-5 gap-y-3 pt-3 sm:grid-cols-2">
          {/* Who actually receives the task, as the largest text on the card. */}
          <div className="min-w-0">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Penanggung jawab
            </p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-[17px] font-semibold leading-tight text-ink">{ownerName}</span>
              {ownerScore !== null && (
                <span className="font-mono text-[11.5px] tabular-nums text-muted" data-numeric>
                  skor kecocokan {Math.round(ownerScore * 100)}%
                </span>
              )}
            </p>
            {/*
              The verdict sits directly under the name, not only in the note at the
              bottom. A reader who stops after the first line still learns that this
              name is a suggestion, not a qualified assignment.
            */}
            {ownerUnqualified && (
              <p
                className="mt-1 text-[11px] font-semibold leading-snug text-warn"
                data-testid={`card-owner-unqualified-${task.id}`}
              >
                Belum memenuhi aturan: saran terbaik, bukan penugasan final
              </p>
            )}
          </div>

          {/* The alternative stays a separate, labelled column from the score. */}
          <div className="min-w-0">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Alternatif
            </p>
            {alternativeName ? (
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13.5px] font-medium text-ink">{alternativeName}</span>
                {alternativeScore !== null && (
                  <span className="font-mono text-[11px] tabular-nums text-muted" data-numeric>
                    skor {Math.round(alternativeScore * 100)}%
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-[12px] text-muted">Tidak ada alternatif yang memenuhi aturan</p>
            )}
          </div>
        </div>
      ) : (
        /*
         * The unassigned card. The old one printed "GUGUR R2" over four numbers
         * and left the reader to work out what to do. This states the same four
         * figures in one sentence with a comparison they can act on, then names
         * the rule in the margin.
         */
        <div className="pt-3" data-testid={`card-unassigned-${task.id}`}>
          <p className="text-[13.5px] leading-relaxed text-ink">
            {impossible?.detail && overCap
              ? `Estimasi pekerjaan membutuhkan ${impossible.detail.taskHours} jam, sedangkan batas beban yang diizinkan ${impossible.detail.capHours.toFixed(
                  2
                )} jam. Tugas perlu dibagi menjadi beberapa bagian atau estimasinya diperiksa kembali.`
              : r3Warning
                ? 'Belum ada anggota yang memenuhi seluruh aturan untuk tugas ini. Saran terbaik tidak dijadikan penanggung jawab karena aturannya belum terpenuhi.'
                : 'Tidak ada anggota yang bisa menerima tugas ini tanpa melewati batas beban. Periksa beban anggota lain atau pecah tugas ini.'}
          </p>

          {impossible?.detail && overCap && (
            <dl
              className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-[var(--radius-input)] bg-danger-surface px-3 py-2.5 sm:grid-cols-4"
              data-testid={`card-r2-${task.id}`}
            >
              <div>
                <dt className="text-[10.5px] text-danger/80">Total estimasi</dt>
                <dd className="font-mono text-[13px] font-semibold tabular-nums text-danger" data-numeric>
                  {impossible.detail.taskHours} jam
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-danger/80">Beban ideal</dt>
                <dd className="font-mono text-[13px] font-semibold tabular-nums text-danger" data-numeric>
                  {impossible.detail.idealLoad.toFixed(2)} jam
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-danger/80">Batas beban</dt>
                <dd className="font-mono text-[13px] font-semibold tabular-nums text-danger" data-numeric>
                  {impossible.detail.capHours.toFixed(2)} jam
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-danger/80">Selisih</dt>
                <dd className="font-mono text-[13px] font-semibold tabular-nums text-danger" data-numeric>
                  +{overCap.excessHours.toFixed(2)} jam
                </dd>
              </div>
            </dl>
          )}

          <p className="mt-2 text-[10.5px] text-fog">
            <span className="font-mono font-semibold">
              {impossible ? 'R2' : r3Warning ? 'R3' : 'R2'}
            </span>{' '}
            — {RULE_PLAIN[impossible ? 'R2' : r3Warning ? 'R3' : 'R2']}
          </p>
        </div>
      )}

      {/*
        The reason, in the words a student would use. Only rendered when the
        caller has a real sentence for a named owner; an unassigned task already
        got its explanation above, and repeating a guess here would be the fake
        recommendation the rules forbid.
      */}
      {isAllocated && data.ownerReason && status === 'dibagikan' && (
        <p
          className="mt-3 border-l-2 border-ok pl-2.5 text-[12px] leading-relaxed text-ink"
          data-testid={`card-reason-${task.id}`}
        >
          {data.ownerReason}
        </p>
      )}
      {isAllocated && data.ownerReason && status === 'perlu-penyesuaian' && (
        <p
          className="mt-3 border-l-2 border-warn pl-2.5 text-[12px] leading-relaxed text-ink"
          data-testid={`card-reason-${task.id}`}
        >
          {data.ownerReason}
        </p>
      )}

      {/* Kept as the technical footnote, not the headline. */}
      <p className="pt-2.5 font-mono text-[10px] tabular-nums text-fog" data-numeric>
        Batas beban {capHours.toFixed(2)} jam · beban ideal {idealLoad.toFixed(2)} jam · R2
      </p>

      {r3Warning && isAllocated && (
        <div className="mt-2.5 rounded-[var(--radius-input)] bg-warn-surface px-3 py-2" data-testid={`card-r3-${task.id}`}>
          <p className="text-[11.5px] leading-relaxed text-warn">
            {RULE_PLAIN.R3} Saran di atas adalah kandidat terbaik yang ada, tetapi belum memenuhi R3.
          </p>
        </div>
      )}

      {/* Actions reuse the existing handlers; they are not a second code path. */}
      {(onAccept || onLock || onMove || onSplit) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-3">
          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              className="inline-flex min-h-[34px] items-center rounded-full bg-card px-3 text-[11.5px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-200 hover:shadow-[inset_0_0_0_1px_var(--ink)] max-sm:min-h-[44px]"
            >
              Terima rekomendasi
            </button>
          )}
          {onSplit && (
            <button
              type="button"
              onClick={onSplit}
              className="inline-flex min-h-[34px] items-center rounded-full bg-card px-3 text-[11.5px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-200 hover:shadow-[inset_0_0_0_1px_var(--ink)] max-sm:min-h-[44px]"
            >
              Pecah tugas
            </button>
          )}
          {onMove && (
            <button
              type="button"
              onClick={onMove}
              className="inline-flex min-h-[34px] items-center rounded-full bg-card px-3 text-[11.5px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-200 hover:shadow-[inset_0_0_0_1px_var(--ink)] max-sm:min-h-[44px]"
            >
              Pindahkan
            </button>
          )}
          {onLock && (
            <button
              type="button"
              onClick={onLock}
              className="inline-flex min-h-[34px] items-center rounded-full bg-card px-3 text-[11.5px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-200 hover:shadow-[inset_0_0_0_1px_var(--ink)] max-sm:min-h-[44px]"
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
