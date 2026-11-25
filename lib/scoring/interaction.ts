import { Member, Task, TaskAssignment, AssignmentWarning, CandidateScore } from '@/lib/scoring/types';
import { DEFAULT_WEIGHTS, WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import { checkR1, checkR2, checkR3 } from '@/lib/scoring/rules';

/**
 * Everything FR-10, FR-11, FR-14, FR-16, FR-17, FR-18 and FR-21 need that does
 * not require React or the DOM.
 *
 * Rules enforced here:
 *   - the weights always sum to 1 and are never renormalised away from what the
 *     user dragged;
 *   - locked tasks (R5) never change owner, whatever the weights or a move does;
 *   - one undo step, and it restores the actual assignment data, not just the
 *     rendered result;
 *   - every local interaction is synchronous, so it cannot touch the network.
 */

export type Weights = { K: number; S: number; C: number; M: number };
export type WeightKey = keyof Weights;

export const DEFAULT_HYBRID_WEIGHTS: Weights = { ...DEFAULT_WEIGHTS };

/** Two decimals is the slider step; this is the tolerance for "sums to 100%". */
const WEIGHT_EPSILON = 0.0005;

/**
 * Moves one weight and redistributes the difference across the others in
 * proportion to their current share. The result always sums to 1.
 */
export function redistributeWeights(
  weights: Weights,
  key: WeightKey,
  rawValue: number,
  lockedKeys: WeightKey[] = []
): Weights {
  if (lockedKeys.includes(key)) return weights;

  const value = Math.min(1, Math.max(0, rawValue));
  const others = (Object.keys(weights) as WeightKey[]).filter((k) => k !== key);

  const movable = others.filter((k) => !lockedKeys.includes(k));
  if (movable.length === 0) return weights;

  const next: Weights = { ...weights, [key]: value };
  const diff = value - weights[key];
  const movableSum = movable.reduce((sum, k) => sum + weights[k], 0);

  if (diff === 0) return weights;

  if (movableSum > 0) {
    for (const k of movable) {
      next[k] = Math.max(0, weights[k] - diff * (weights[k] / movableSum));
    }
  } else {
    for (const k of movable) {
      next[k] = Math.max(0, (1 - value) / movable.length);
    }
  }

  // Floating point drift: normalise over the weights that may still move, so a
  // fixed weight keeps exactly the value the caller set.
  const fixedSum = lockedKeys.reduce((sum, k) => sum + (next[k] ?? 0), 0);
  const total = (Object.keys(next) as WeightKey[]).reduce((sum, k) => sum + next[k], 0);

  if (Math.abs(total - 1) > WEIGHT_EPSILON) {
    const remaining = 1 - fixedSum;
    const movableSumNow = movable.reduce((sum, k) => sum + next[k], 0);
    for (const k of movable) {
      next[k] = movableSumNow > 0 ? (next[k] / movableSumNow) * remaining : remaining / movable.length;
    }
  }

  return next;
}

/** True when the four weights sum to 1 within the slider's precision. */
export function weightsSumToOne(weights: Weights): boolean {
  const total = weights.K + weights.S + weights.C + weights.M;
  return Math.abs(total - 1) <= WEIGHT_EPSILON;
}

/** Percentage value for display, from a 0-1 weight. */
export function weightPercent(value: number): number {
  return Math.round(value * 100);
}

/**
 * The four weights as one honest total. Rounding each to a whole percent can
 * sum to 99 or 101, so the label says which one it is instead of hiding it.
 */
export function weightSumLabel(weights: Weights): string {
  const sum = weightPercent(weights.K) + weightPercent(weights.S) + weightPercent(weights.C) + weightPercent(weights.M);
  if (sum === 100) return 'Σ 100%';
  return `Σ ${sum}% (pembulatan dari 100%)`;
}

/**
 * True when the four rounded labels add up to exactly 100%. The UI uses this for
 * the warning colour, so it must not depend on the label's wording.
 */
export function weightSumIsExact(weights: Weights): boolean {
  const sum = weightPercent(weights.K) + weightPercent(weights.S) + weightPercent(weights.C) + weightPercent(weights.M);
  return sum === 100;
}

export interface AssignmentState {
  /** The assignment array handed to `globalAssign` (lock + owner intent). */
  assignments: TaskAssignment[];
  /** Weight set the score column was produced with. */
  weights: Weights;
}

export interface UndoEntry {
  label: string;
  state: AssignmentState;
}

/** One step only: FR-21 asks for the last action, not a history tree. */
export function pushUndo(prev: UndoEntry | null, entry: UndoEntry): UndoEntry {
  void prev;
  return entry;
}

/** Applies an undo entry, or returns `null` when there is nothing to undo. */
export function applyUndo(entry: UndoEntry | null): UndoEntry | null {
  return entry;
}

// ---------------------------------------------------------------------------
// FR-11 / FR-18: owner changes
// ---------------------------------------------------------------------------

export type MoveSource = 'select' | 'alternative' | 'accept' | 'swap' | 'whatif' | 'drag';

/**
 * T-6.09: validates that an assignment change (move or lock) does not violate
 * PRD hard rules R2 and R3.
 *
 * `intended` is the full post-change owner map (taskId -> memberId). Load has to
 * be measured against the state the user is about to commit, not against the
 * current one: during a swap both owners move at once, and checking each task
 * against the OLD assignments double-counts the task being handed over and
 * rejects swaps that 1.25 x ideal actually allows.
 */
function validateChange(
  targetTaskId: string,
  targetMemberId: string,
  tasks: Task[],
  members: Member[],
  intended: Record<string, string>
): { ok: boolean; reason?: string } {
  const task = tasks.find((t) => t.id === targetTaskId);
  const member = members.find((m) => m.id === targetMemberId);
  if (!task || !member) return { ok: false, reason: 'Data tidak valid.' };

  // R1: capacity check
  if (!checkR1(member)) {
    return { ok: false, reason: `Anggota ${member.name} memiliki jam tersedia 0 (R1).` };
  }

  // R3: only members with a required skill at level >= 3 are candidates.
  const pool = checkR3(task, members);
  const inPool = pool.some((m) => m.id === member.id);
  if (!inPool) {
    return { ok: false, reason: `Anggota ${member.name} tidak memiliki skill wajib pada level 3 (R3).` };
  }

  // R2: workload cap, measured on the intended final state (excluding this task).
  // The divisor matches the engine: only members who pass R1 carry a share of
  // the work, otherwise a member with 0 hours would shrink everyone's R2 cap.
  const totalEffort = tasks.reduce((sum, t) => sum + t.estimated_hours, 0);
  const loadBearingMembers = members.filter((m) => checkR1(m));
  const idealLoad = loadBearingMembers.length > 0 ? totalEffort / loadBearingMembers.length : 0;
  const currentLoad = Object.entries(intended)
    .filter(([taskId, memberId]) => memberId === targetMemberId && taskId !== targetTaskId)
    .reduce((sum, [taskId]) => sum + (tasks.find((t) => t.id === taskId)?.estimated_hours ?? 0), 0);

  if (!checkR2(member, task, currentLoad, idealLoad)) {
    const limit = idealLoad * WORKLOAD_CAP_MULTIPLIER;
    return {
      ok: false,
      reason: `Penugasan melanggar R2: beban ${member.name} menjadi ${(currentLoad + task.estimated_hours).toFixed(2)} jam (batas: ${limit.toFixed(2)} jam).`,
    };
  }

  return { ok: true };
}

/** Current taskId -> memberId map, the baseline a move is validated against. */
function ownerMap(assignments: TaskAssignment[]): Record<string, string> {
  return Object.fromEntries(assignments.map((a) => [a.taskId, a.primaryMemberId]));
}

/**
 * Sets a task's owner. A manual change also locks the task: PRD US-11/FR-11 say
 * a decision the user made by hand must survive the next recalculation.
 * Accepting the engine's own recommendation does not lock, because the user is
 * agreeing with the engine rather than overriding it.
 */
export function assignOwner(
  assignments: TaskAssignment[],
  taskId: string,
  memberId: string,
  options: { lock: boolean; tasks: Task[]; members: Member[] }
): { next: TaskAssignment[]; changed: boolean; error?: string } {
  const target = assignments.find((a) => a.taskId === taskId);
  if (!target) return { next: assignments, changed: false };

  /*
   * R5 / US-12: a locked task keeps its owner until the user unlocks it. The
   * engine honours this on recompute, but this path is the direct edit and used
   * to hand the task to someone else anyway, so the screen and the stored
   * assignments disagreed. Unlocking on its own is still allowed.
   */
  if (target.isLocked && target.primaryMemberId !== memberId && !options.lock) {
    return {
      next: assignments,
      changed: false,
      error: 'Tugas terkunci (R5). Buka kunci terlebih dahulu untuk mengganti penanggung jawab.',
    };
  }

  const nextLocked = options.lock ? true : target.isLocked;
  const changed = target.primaryMemberId !== memberId || target.isLocked !== nextLocked;
  if (!changed) return { next: assignments, changed: false };

  // Enforce R2/R3 for non-locked changes
  const validation = validateChange(taskId, memberId, options.tasks, options.members, {
    ...ownerMap(assignments),
    [taskId]: memberId,
  });
  if (!validation.ok) {
    return { next: assignments, changed: false, error: validation.reason };
  }

  return {
    next: assignments.map((a) =>
      a.taskId === taskId ? { ...a, primaryMemberId: memberId, isLocked: nextLocked } : a
    ),
    changed: true,
  };
}

export function toggleLockState(
  assignments: TaskAssignment[],
  taskId: string
): { next: TaskAssignment[]; locked: boolean } | null {
  const target = assignments.find((a) => a.taskId === taskId);
  if (!target) return null;
  const locked = !target.isLocked;
  return {
    next: assignments.map((a) => (a.taskId === taskId ? { ...a, isLocked: locked } : a)),
    locked,
  };
}

/**
 * Two task owners exchange places. A swap is only meaningful when both tasks are
 * unlocked; swapping a locked task would silently break R5.
 */
export function swapOwners(
  assignments: TaskAssignment[],
  taskAId: string,
  taskBId: string,
  options: { tasks: Task[]; members: Member[] }
): { next: TaskAssignment[]; ok: boolean; reason?: string } {
  const a = assignments.find((x) => x.taskId === taskAId);
  const b = assignments.find((x) => x.taskId === taskBId);
  if (!a || !b) return { next: assignments, ok: false, reason: 'Tugas tidak ditemukan.' };
  if (taskAId === taskBId) return { next: assignments, ok: false, reason: 'Pilih dua tugas berbeda.' };
  if (a.isLocked || b.isLocked) {
    return {
      next: assignments,
      ok: false,
      reason: 'Salah satu tugas terkunci (R5). Buka kunci terlebih dahulu untuk menukar.',
    };
  }

  // Validate both sides against the state the swap would produce.
  const intended = {
    ...ownerMap(assignments),
    [taskAId]: b.primaryMemberId,
    [taskBId]: a.primaryMemberId,
  };
  const vA = validateChange(taskAId, b.primaryMemberId, options.tasks, options.members, intended);
  if (!vA.ok) return { next: assignments, ok: false, reason: vA.reason };
  const vB = validateChange(taskBId, a.primaryMemberId, options.tasks, options.members, intended);
  if (!vB.ok) return { next: assignments, ok: false, reason: vB.reason };

  const next = assignments.map((x) => {
    if (x.taskId === taskAId) return { ...x, primaryMemberId: b.primaryMemberId };
    if (x.taskId === taskBId) return { ...x, primaryMemberId: a.primaryMemberId };
    return x;
  });
  return { next, ok: true };
}

// ---------------------------------------------------------------------------
// FR-16: event log payloads
// ---------------------------------------------------------------------------

export type EventType =
  | 'recommendation_created'
  | 'recommendation_accepted'
  | 'assignment_changed'
  | 'assignment_swapped'
  | 'assignment_locked'
  | 'assignment_unlocked'
  | 'recommendation_fallback'
  | 'export_generated'
  | 'system_error';

/**
 * Builds the payload for one event. Only nicknames are personal data here, which
 * is what PRD §6.4 allows; every id is a UUID, never an email or a note.
 */
export function buildEventPayload(
  type: EventType,
  detail: Record<string, string | number | boolean | null | undefined>
): Record<string, string | number | boolean | null> {
  const payload: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (value === undefined) continue;
    // A note is free text and may hold personal data; never log it.
    if (key === 'note' || key === 'description') continue;
    payload[key] = value;
  }
  return payload;
}

// ---------------------------------------------------------------------------
// FR-14: export
// ---------------------------------------------------------------------------

export interface ExportRow {
  task: string;
  hours: number;
  effort: number;
  primary: string;
  alternative: string;
  total: string;
  K: string;
  S: string;
  C: string;
  M: string;
  locked: 'ya' | 'tidak';
  reason: string;
}

export const EXPORT_HEADER = [
  'Tugas',
  'Jam',
  'Effort',
  'Penanggung Jawab',
  'Alternatif',
  'Total',
  'K',
  'S',
  'C',
  'M',
  'Terkunci',
  'Alasan',
] as const;

/**
 * RFC 4180 quoting: wrap every field, double the quotes inside it, and keep a
 * prefix for values a spreadsheet would otherwise interpret.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: ExportRow[]): string {
  const lines = [EXPORT_HEADER.map(csvField).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.task,
        String(row.hours),
        String(row.effort),
        row.primary,
        row.alternative,
        row.total,
        row.K,
        row.S,
        row.C,
        row.M,
        row.locked,
        row.reason,
      ]
        .map(csvField)
        .join(',')
    );
  }
  // CRLF is what RFC 4180 and spreadsheet applications expect.
  return lines.join('\r\n');
}

export function toPlainText(
  rows: ExportRow[],
  meta: {
    code: string;
    isFallback: boolean;
    weights: Weights;
    idealLoad: number;
    loads: { name: string; load: number; capacity: number; over: boolean }[];
  }
): string {
  // Report the weights the scores were actually produced with. Printing a fixed
  // "S 0,50 / C 0,33 / M 0,17" header after the user moved the sliders made the
  // exported file contradict its own numbers.
  const split = `K ${weightPercent(meta.weights.K)}% / S ${weightPercent(meta.weights.S)}% / C ${weightPercent(meta.weights.C)}% / M ${weightPercent(meta.weights.M)}%`;
  const mode = meta.isFallback ? `Cadangan (${split})` : `Hybrid (${split})`;

  const assignmentLines = rows.map(
    (r) =>
      `${r.task} | ${r.primary}${r.alternative ? ` | alternatif: ${r.alternative}` : ''} | ${r.total}% | K ${r.K} S ${r.S} C ${r.C} M ${r.M} | ${r.locked === 'ya' ? 'terkunci' : 'bebas'}`
  );

  const loadLines = meta.loads.map(
    (l) => `${l.name}: ${l.load} jam dari ${l.capacity} jam${l.over ? ' (melewati batas)' : ''}`
  );

  return [
    `Pembagian tugas proyek ${meta.code}`,
    mode,
    `Beban ideal: ${meta.idealLoad.toFixed(1)} jam per anggota`,
    '',
    'PENUGASAN',
    ...assignmentLines,
    '',
    'BEBAN ANGGOTA',
    ...loadLines,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// FR-17: before/after comparison
// ---------------------------------------------------------------------------

export interface Snapshot {
  label: string;
  primaryByTask: Record<string, string>;
  totalByTask: Record<string, number>;
  loadByMember: Record<string, number>;
}

export interface ComparisonRow {
  taskId: string;
  taskTitle: string;
  fromMember: string;
  toMember: string;
  changed: boolean;
}

export interface LoadDelta {
  memberId: string;
  memberName: string;
  from: number;
  to: number;
  delta: number;
}

/**
 * Compares a baseline snapshot with the current assignment. Only tasks whose
 * owner actually changed are reported as changed; a score-only difference is
 * reported separately so the two are never conflated.
 */
export function compareSnapshots(
  before: Snapshot,
  after: Snapshot,
  taskTitles: Record<string, string>,
  memberNames: Record<string, string>
): {
  ownerChanges: ComparisonRow[];
  changedCount: number;
  scoreOnlyChanges: number;
  loadDeltas: LoadDelta[];
} {
  const ownerChanges: ComparisonRow[] = [];
  let scoreOnlyChanges = 0;

  for (const taskId of Object.keys(after.primaryByTask)) {
    const fromMemberId = before.primaryByTask[taskId];
    const toMemberId = after.primaryByTask[taskId];
    if (!fromMemberId) continue;
    const changed = fromMemberId !== toMemberId;
    const scoreDelta = Math.abs((before.totalByTask[taskId] ?? 0) - (after.totalByTask[taskId] ?? 0));
    if (!changed && scoreDelta > 0.0005) scoreOnlyChanges += 1;
    if (changed) {
      ownerChanges.push({
        taskId,
        taskTitle: taskTitles[taskId] ?? taskId,
        fromMember: memberNames[fromMemberId] ?? fromMemberId,
        toMember: memberNames[toMemberId] ?? toMemberId,
        changed: true,
      });
    }
  }

  const loadDeltas: LoadDelta[] = Object.keys(after.loadByMember).map((memberId) => {
    const from = before.loadByMember[memberId] ?? 0;
    const to = after.loadByMember[memberId] ?? 0;
    return {
      memberId,
      memberName: memberNames[memberId] ?? memberId,
      from,
      to,
      delta: Number((to - from).toFixed(2)),
    };
  });

  return { ownerChanges, changedCount: ownerChanges.length, scoreOnlyChanges, loadDeltas };
}

/** R2 as a sentence: uses the same rule the engine applies (1,25 × ideal). */
export function describeR2(load: number, idealLoad: number, capacity: number): string {
  const r2Limit = Number((idealLoad * 1.25).toFixed(2));
  const overR2 = load > r2Limit;
  const overCapacity = load > capacity;
  if (overR2) {
    return `Melewati batas R2 (${r2Limit.toFixed(2)} jam).`;
  }
  if (overCapacity) {
    return `Melewati jam tersedia (${capacity} jam).`;
  }
  return `Dalam batas R2 (${r2Limit.toFixed(2)} jam).`;
}

export function taskTitleMap(tasks: Task[]): Record<string, string> {
  return Object.fromEntries(tasks.map((t) => [t.id, t.title]));
}

export function memberNameMap(members: Member[]): Record<string, string> {
  return Object.fromEntries(members.map((m) => [m.id, m.name]));
}
