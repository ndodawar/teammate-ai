'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { Task, Member, TaskAssignment, AssignmentResult } from '@/lib/scoring/types';
import { globalAssign } from '@/lib/scoring/assign';
import { DEFAULT_WEIGHTS, FALLBACK_WEIGHTS, WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import { memberReason } from '@/lib/scoring/explain-local';
import {
  redistributeWeights,
  weightPercent,
  assignOwner,
  toggleLockState,
  swapOwners,
  toCsv,
  toPlainText,
  compareSnapshots,
  describeR2,
  weightSumLabel,
  weightSumIsExact,
  type Weights,
  type WeightKey,
  type ExportRow,
  type Snapshot,
  type UndoEntry,
} from '@/lib/scoring/interaction';
import { recordEvent } from '@/lib/client/events';
import { LoadMeter } from '@/components/motion/score-bar';
import { RevealGroup, RevealItem } from '@/components/motion/reveal';
import { ScoreBreakdown } from '@/components/recommendations/score-breakdown';
import { DURATION, EASE } from '@/lib/motion/tokens';
import { WorkspaceShell } from '@/components/ui/workspace-shell';
import { Button, Chip, Eyebrow } from '@/components/ui/primitives';

/*
 * Route `/p/[code]/result` — the recommendation workspace.
 *
 * FR-08 matrix, FR-09 explanation, FR-10 sliders, FR-11 accept/swap/manual/lock,
 * FR-12 workload, FR-13 fallback, FR-14 export, FR-16 events, FR-17 comparison,
 * FR-18 what-if, FR-20 keyboard, FR-21 undo.
 *
 * Every recalculation below runs `globalAssign` in the browser. No handler calls
 * the network except the initial load and the event log, so moving a slider or
 * previewing a move cannot reach Gemini.
 */

type RowChange = { taskId: string; from: string; to: string };

const MOVE_OPTIONS_ID = 'whatif-move-options';

export function ResultClient({ params }: { params: Promise<{ code: string }> }) {
  const [resolvedCode, setResolvedCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingStagesDone, setLoadingStagesDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cosineMap, setCosineMap] = useState<Record<string, Record<string, number>>>({});
  const [isFallback, setIsFallback] = useState(false);
  const [computedAt, setComputedAt] = useState<string | null>(null);

  // Weights: hybrid values live in `hybridWeightsRef`; `weights` is what the
  // current mode actually uses, so a fallback session cannot overwrite them.
  const hybridWeightsRef = useRef<Weights>({ ...DEFAULT_WEIGHTS });
  const [weights, setWeights] = useState<Weights>({ ...DEFAULT_WEIGHTS });

  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [baseline, setBaseline] = useState<Snapshot | null>(null);

  // FR-21: one step.
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);
  /**
   * Weights before the current drag. A slider fires a change per pixel, so the
   * undo entry is captured once at the start of a drag and cleared when the drag
   * ends (pointer up / key up), otherwise Ctrl+Z would only step one pixel back.
   */
  const weightUndoRef = useRef<UndoEntry | null>(null);

  // FR-19: transient feedback that names what actually changed.
  const [status, setStatus] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [rowChanges, setRowChanges] = useState<RowChange[]>([]);
  // FR-10 / NFR-03: measured recompute cost, shown to the user as evidence.
  const [recalcMs, setRecalcMs] = useState<number | null>(null);
  const weightsStartedAtRef = useRef<number | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [logging, setLogging] = useState<'unknown' | 'ok' | 'failed'>('unknown');

  // FR-08 / FR-18 interaction state.
  const [focusedCell, setFocusedCell] = useState<{ taskId: string; memberId: string } | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ taskId: string; memberId: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ taskId: string; memberId: string } | null>(null);
  const [swapAnchor, setSwapAnchor] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const isInitialFetchDone = useRef(false);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    params.then((p) => setResolvedCode(p.code));
  }, [params]);

  // NFR-49: motion only while the process is running. Five stages appear 30 ms
  // apart, then the list holds and the last one stays marked "berjalan" until
  // data arrives, so the progress never claims to be finished early.
  useEffect(() => {
    if (!loading || reduced) return;
    const timers = [1, 2, 3, 4, 5].map((step) =>
      window.setTimeout(() => setLoadingStagesDone(step), (step - 1) * 30)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [loading, reduced]);

  const fetchInitialData = useCallback(async (projCode: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: projCode, weights: hybridWeightsRef.current }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat rekomendasi.');

      const loadedTasks: Task[] = json.tasks;
      const loadedMembers: Member[] = json.members;
      const fallback: boolean = json.isFallback;
      const initialWeights: Weights = fallback ? { ...FALLBACK_WEIGHTS } : hybridWeightsRef.current;

      setTasks(loadedTasks);
      setMembers(loadedMembers);
      setCosineMap(json.cosineMap);
      setIsFallback(fallback);
      setWeights(initialWeights);
      setAssignments(json.result.assignments);
      setComputedAt(new Date().toISOString());

      setBaseline({
        label: fallback ? 'Saat mode cadangan dimuat' : 'Saat rekomendasi dibuat',
        primaryByTask: Object.fromEntries(
          (json.result.assignments as TaskAssignment[]).map((a) => [a.taskId, a.primaryMemberId])
        ),
        totalByTask: Object.fromEntries(
          (json.result.assignments as TaskAssignment[]).map((a) => [
            a.taskId,
            a.scores[a.primaryMemberId]?.breakdown.total ?? 0,
          ])
        ),
        loadByMember: { ...(json.result.memberLoads as Record<string, number>) },
      });

      const logged = await recordEvent(projCode, 'recommendation_created', {
        isFallback: fallback,
        taskCount: loadedTasks.length,
        memberCount: loadedMembers.length,
      });
      setLogging(logged ? 'ok' : 'failed');

      if (fallback) {
        await recordEvent(projCode, 'recommendation_fallback', {
          isFallback: true,
          message: 'Mode cadangan aktif: komponen K dihilangkan.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (resolvedCode && !isInitialFetchDone.current) {
      isInitialFetchDone.current = true;
      void fetchInitialData(resolvedCode);
    }
  }, [resolvedCode, fetchInitialData]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  /**
   * The matrix as currently displayed. Recomputed synchronously on every local
   * change: weights, a lock, a manual move. `preview` deliberately is *not* an
   * input here, so a hover preview can never leak into the applied state.
   */
  const currentResult: AssignmentResult = useMemo(() => {
    return globalAssign(tasks, members, assignments, {
      weights,
      isFallback,
      cosineMap,
    });
  }, [tasks, members, assignments, weights, isFallback, cosineMap]);

  const displayed: AssignmentResult = useMemo(() => {
    if (!preview) return currentResult;
    const previewAssignments = assignOwner(assignments, preview.taskId, preview.memberId, {
      lock: true,
      tasks,
      members,
    });
    return globalAssign(tasks, members, previewAssignments.next, {
      weights,
      isFallback,
      cosineMap,
    });
  }, [preview, currentResult, assignments, tasks, members, weights, isFallback, cosineMap]);

  const resultFor = (taskId: string, assignmentsForRun: AssignmentResult) =>
    assignmentsForRun.assignments.find((a) => a.taskId === taskId);

  const byTaskId = useMemo(() => {
    const map = new Map<string, (typeof currentResult.assignments)[number]>();
    for (const a of currentResult.assignments) map.set(a.taskId, a);
    return map;
  }, [currentResult]);

  const rows = useMemo(() => {
    return tasks
      .map((task) => {
        const assignment = byTaskId.get(task.id);
        if (!assignment) return null;
        return { task, assignment };
      })
      .filter((r): r is { task: Task; assignment: TaskAssignment } => r !== null)
      .sort((a, b) => b.task.estimated_hours - a.task.estimated_hours);
  }, [tasks, byTaskId]);

  // ---------------------------------------------------------------------------
  // FR-10: weights
  // ---------------------------------------------------------------------------

  const lockedWeightKeys: WeightKey[] = isFallback ? ['K'] : [];

  const handleWeightChange = (key: WeightKey, value: number) => {
    if (isFallback && key === 'K') return;

    const before = currentResult.assignments;
    const nextWeights = redistributeWeights(weights, key, value, lockedWeightKeys);
    if (
      nextWeights.K === weights.K &&
      nextWeights.S === weights.S &&
      nextWeights.C === weights.C &&
      nextWeights.M === weights.M
    ) {
      return;
    }

    // FR-21: moving a slider is an action, so it must be undoable. Keep the
    // weights from before this drag, not the state at the last committed step.
    if (!weightUndoRef.current) weightUndoRef.current = snapshotForUndo('Ubah bobot');
    setUndoEntry(weightUndoRef.current);

    setWeights(nextWeights);
    if (!isFallback) hybridWeightsRef.current = nextWeights;

    const recalced = globalAssign(tasks, members, assignments, {
      weights: nextWeights,
      isFallback,
      cosineMap,
    });
    setAssignments(recalced.assignments);

    const changes: RowChange[] = [];
    for (const after of recalced.assignments) {
      const prev = before.find((a) => a.taskId === after.taskId);
      if (prev && prev.primaryMemberId !== after.primaryMemberId) {
        changes.push({
          taskId: after.taskId,
          from: memberById.get(prev.primaryMemberId)?.name ?? '—',
          to: memberById.get(after.primaryMemberId)?.name ?? '—',
        });
      }
    }
    setRowChanges(changes);

    setStatus(
      changes.length === 0
        ? {
            kind: 'ok',
            text: `Bobot diperbarui. Tidak ada penanggung jawab yang berubah (${changes.length} tugas).`,
          }
        : {
            kind: 'ok',
            text: `Bobot diperbarui. ${changes.length} tugas berpindah penanggung jawab.`,
          }
    );
  };

  const resetHybridWeights = () => {
    if (isFallback) return;
    setWeights({ ...DEFAULT_HYBRID_WEIGHTS_LOCAL });
    hybridWeightsRef.current = { ...DEFAULT_HYBRID_WEIGHTS_LOCAL };
    const recalced = globalAssign(tasks, members, assignments, {
      weights: { ...DEFAULT_HYBRID_WEIGHTS_LOCAL },
      isFallback,
      cosineMap,
    });
    setAssignments(recalced.assignments);
    setRowChanges([]);
    setStatus({ kind: 'ok', text: 'Bobot dikembalikan ke 40/30/20/10.' });
  };

  // ---------------------------------------------------------------------------
  // FR-11 / FR-21: undo + state changes
  // ---------------------------------------------------------------------------

  const snapshotForUndo = (label: string): UndoEntry => ({
    label,
    state: { assignments, weights },
  });

  // Ends a slider drag: the next drag snapshots the state again.
  const endWeightDrag = () => {
    weightUndoRef.current = null;
  };

  const applyOwnerChange = (
    taskId: string,
    memberId: string,
    options: { lock: boolean; label: string; event: 'recommendation_accepted' | 'assignment_changed' }
  ) => {
    const task = taskById.get(taskId);
    const previous = assignments.find((a) => a.taskId === taskId);
    const result = assignOwner(assignments, taskId, memberId, {
      lock: options.lock,
      tasks,
      members,
    });

    if (result.error) {
      setStatus({ kind: 'error', text: result.error });
      return;
    }

    if (!result.changed) {
      setStatus({ kind: 'warn', text: 'Penanggung jawab tidak berubah.' });
      return;
    }

    const entry = snapshotForUndo(options.label);
    setUndoEntry(entry);
    setAssignments(result.next);
    const recalced = globalAssign(tasks, members, result.next, { weights, isFallback, cosineMap });
    setAssignments(recalced.assignments);

    const fromName = previous ? memberById.get(previous.primaryMemberId)?.name ?? '—' : '—';
    const toName = memberById.get(memberId)?.name ?? '—';
    setRowChanges([{ taskId, from: fromName, to: toName }]);
    setStatus({
      kind: 'ok',
      text: `${task?.title ?? 'Tugas'}: ${fromName} → ${toName}. ${options.lock ? 'Tugas dikunci agar tidak berubah saat dihitung ulang.' : ''}`.trim(),
    });
    setPreview(null);
    setMoveTarget(null);
    setSwapAnchor(null);

    void recordEvent(resolvedCode, options.event, {
      taskId,
      taskTitle: task?.title,
      memberId,
      memberName: toName,
      previousMemberName: fromName,
      isFallback,
    }).then((ok) => setLogging(ok ? 'ok' : 'failed'));
  };

  const handleSwap = (targetTaskId: string) => {
    if (!swapAnchor) {
      setSwapAnchor(targetTaskId);
      setStatus({
        kind: 'warn',
        text: `Tugas "${taskById.get(targetTaskId)?.title ?? ''}" dipilih. Pilih "Tukar dengan" pada tugas lain.`,
      });
      return;
    }
    if (swapAnchor === targetTaskId) {
      setSwapAnchor(null);
      setStatus({ kind: 'warn', text: 'Pilihan tukar dibatalkan.' });
      return;
    }

    const result = swapOwners(assignments, swapAnchor, targetTaskId, { tasks, members });
    if (!result.ok) {
      setStatus({ kind: 'error', text: result.reason ?? 'Tidak dapat menukar tugas ini.' });
      return;
    }

    setUndoEntry(snapshotForUndo('Tukar penanggung jawab'));
    const recalced = globalAssign(tasks, members, result.next, { weights, isFallback, cosineMap });
    setAssignments(recalced.assignments);

    const titleA = taskById.get(swapAnchor)?.title ?? 'Tugas';
    const titleB = taskById.get(targetTaskId)?.title ?? 'Tugas';
    setRowChanges([
      { taskId: swapAnchor, from: '', to: '' },
      { taskId: targetTaskId, from: '', to: '' },
    ]);
    setSwapAnchor(null);
    setStatus({ kind: 'ok', text: `Penanggung jawab "${titleA}" dan "${titleB}" ditukar.` });
    void recordEvent(resolvedCode, 'assignment_swapped', {
      taskId: swapAnchor,
      taskTitle: titleA,
      memberName: titleB,
    }).then((ok) => setLogging(ok ? 'ok' : 'failed'));
  };

  const toggleLock = (taskId: string) => {
    const result = toggleLockState(assignments, taskId);
    if (!result) return;

    setUndoEntry(snapshotForUndo(result.locked ? 'Kunci tugas' : 'Buka kunci tugas'));
    const recalced = globalAssign(tasks, members, result.next, { weights, isFallback, cosineMap });
    setAssignments(recalced.assignments);
    setRowChanges([]);
    setStatus({
      kind: 'ok',
      text: `${taskById.get(taskId)?.title ?? 'Tugas'} ${result.locked ? 'dikunci: tidak akan berubah saat dihitung ulang (R5).' : 'dibuka kuncinya: ikut dihitung ulang.'}`,
    });
    void recordEvent(resolvedCode, result.locked ? 'assignment_locked' : 'assignment_unlocked', {
      taskId,
      taskTitle: taskById.get(taskId)?.title,
      memberName: memberById.get(assignments.find((a) => a.taskId === taskId)?.primaryMemberId ?? '')?.name,
    }).then((ok) => setLogging(ok ? 'ok' : 'failed'));
  };

  const undo = () => {
    if (!undoEntry) return;
    const label = undoEntry.label;
    setAssignments(undoEntry.state.assignments);
    setWeights(undoEntry.state.weights);
    if (!isFallback) hybridWeightsRef.current = undoEntry.state.weights;
    weightUndoRef.current = null;
    setUndoEntry(null);
    setRowChanges([]);
    setStatus({ kind: 'ok', text: `Diurungkan: ${label}.` });
  };

  // ---------------------------------------------------------------------------
  // FR-17: comparison against the state the recommendation was created in
  // ---------------------------------------------------------------------------

  const comparison = useMemo(() => {
    if (!baseline) return null;
    const memberNames = Object.fromEntries(members.map((m) => [m.id, m.name]));
    const taskTitles = Object.fromEntries(tasks.map((t) => [t.id, t.title]));
    const after: Snapshot = {
      label: 'Sekarang',
      primaryByTask: Object.fromEntries(currentResult.assignments.map((a) => [a.taskId, a.primaryMemberId])),
      totalByTask: Object.fromEntries(
        currentResult.assignments.map((a) => [a.taskId, a.scores[a.primaryMemberId]?.breakdown.total ?? 0])
      ),
      loadByMember: { ...currentResult.memberLoads },
    };
    return compareSnapshots(baseline, after, taskTitles, memberNames);
  }, [baseline, currentResult, members, tasks]);

  // ---------------------------------------------------------------------------
  // FR-14: export
  // ---------------------------------------------------------------------------

  const buildExportRows = useCallback((): ExportRow[] => {
    return rows.map(({ task, assignment }) => {
      const score = assignment.scores[assignment.primaryMemberId];
      const b = score?.breakdown ?? { K: 0, S: 0, C: 0, M: 0, total: 0 };
      const primary = memberById.get(assignment.primaryMemberId);
      const alternative = assignment.alternativeMemberId
        ? memberById.get(assignment.alternativeMemberId)
        : undefined;
      return {
        task: task.title,
        hours: task.estimated_hours,
        effort: task.difficulty,
        primary: primary?.name ?? '',
        alternative: alternative?.name ?? '',
        total: (b.total * 100).toFixed(0),
        K: (b.K * 100).toFixed(0),
        S: (b.S * 100).toFixed(0),
        C: (b.C * 100).toFixed(0),
        M: (b.M * 100).toFixed(0),
        locked: assignment.isLocked ? 'ya' : 'tidak',
        reason: primary
          ? memberReason({
              task,
              member: primary,
              breakdown: b,
              isPrimary: true,
              isFallback,
            })
          : '',
      };
    });
  }, [rows, memberById, isFallback]);

  const handleExportCsv = () => {
    const csv = toCsv(buildExportRows());
    // A BOM keeps Excel from reading UTF-8 names as mojibake.
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pembagian-tugas-${resolvedCode || 'proyek'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus({ kind: 'ok', text: `CSV diunduh: ${rows.length} tugas, sesuai penugasan yang berlaku.` });
    void recordEvent(resolvedCode, 'export_generated', { format: 'csv' }).then((ok) =>
      setLogging(ok ? 'ok' : 'failed')
    );
  };

  const handleCopyText = async () => {
    const text = toPlainText(buildExportRows(), {
      code: resolvedCode,
      isFallback,
      weights,
      idealLoad: currentResult.idealLoad,
      loads: members.map((m) => {
        const load = currentResult.memberLoads[m.id] ?? 0;
        return {
          name: m.name,
          load,
          capacity: m.capacity,
          over: load > m.capacity,
        };
      }),
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      setStatus({ kind: 'ok', text: 'Teks pembagian tugas disalin ke clipboard.' });
      window.setTimeout(() => setCopyState('idle'), 1800);
      void recordEvent(resolvedCode, 'export_generated', { format: 'text' }).then((ok) =>
        setLogging(ok ? 'ok' : 'failed')
      );
    } catch {
      setCopyState('failed');
      setStatus({ kind: 'error', text: 'Clipboard ditolak browser. Gunakan Ekspor CSV sebagai gantinya.' });
    }
  };

  // ---------------------------------------------------------------------------
  // FR-20: keyboard
  // ---------------------------------------------------------------------------

  const rowIndex = (taskId: string) => rows.findIndex((r) => r.task.id === taskId);

  const focusCellAt = (taskIndex: number, memberIndex: number) => {
    const task = rows[Math.max(0, Math.min(rows.length - 1, taskIndex))];
    const member = members[Math.max(0, Math.min(members.length - 1, memberIndex))];
    if (!task || !member) return;
    setFocusedCell({ taskId: task.task.id, memberId: member.id });
    const node = tableRef.current?.querySelector<HTMLButtonElement>(
      `[data-cell="${task.task.id}:${member.id}"]`
    );
    node?.focus();
  };

  const isTypingTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    // A range slider has no text buffer of its own, so Ctrl+Z there must undo the
    // app action (a weight change) instead of being swallowed. Text entry keeps
    // the browser's own undo.
    if (tag === 'input' && (el as HTMLInputElement).type === 'range') return false;
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      el.isContentEditable ||
      el.getAttribute('role') === 'textbox'
    );
  };

  // FR-10 / NFR-03: how long the last weight recompute actually took. The clock
  // is read in the handler and committed here, after the recalculated matrix has
  // been rendered, so the number is a real measurement rather than a guess.
  useEffect(() => {
    const started = weightsStartedAtRef.current;
    if (started === null) return;
    weightsStartedAtRef.current = null;
    setRecalcMs(Number((performance.now() - started).toFixed(2)));
  }, [weights]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      if (isTypingTarget(event.target)) return; // let the browser undo text fields
      if (!undoEntry) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleCellKeyDown = (event: React.KeyboardEvent, taskId: string, memberId: string) => {
    const taskIdx = rowIndex(taskId);
    const memberIdx = members.findIndex((m) => m.id === memberId);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusCellAt(taskIdx + 1, memberIdx);
        return;
      case 'ArrowUp':
        event.preventDefault();
        focusCellAt(taskIdx - 1, memberIdx);
        return;
      case 'ArrowRight':
        event.preventDefault();
        focusCellAt(taskIdx, memberIdx + 1);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        focusCellAt(taskIdx, memberIdx - 1);
        return;
      case 'Home':
        event.preventDefault();
        focusCellAt(taskIdx, 0);
        return;
      case 'End':
        event.preventDefault();
        focusCellAt(taskIdx, members.length - 1);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        applyOwnerChange(taskId, memberId, {
          lock: false,
          label: 'Terima rekomendasi',
          event: 'recommendation_accepted',
        });
        return;
      case 'l':
      case 'L':
        event.preventDefault();
        toggleLock(taskId);
        return;
      default:
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    const stages = [
      'Membaca profil anggota',
      'Membaca tugas proyek',
      'Menghitung K, S, C, dan M',
      'Menerapkan aturan R1 sampai R5',
      'Menyusun matriks',
    ];
    return (
      <WorkspaceShell code={resolvedCode}>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
          <Eyebrow>FR-07 · Menghitung rekomendasi</Eyebrow>
          <ol className="mt-4 space-y-2.5">
            {stages.map((stage, index) => (
              <li
                key={stage}
                className={`flex items-center gap-2.5 font-mono text-[11.5px] ${
                  index < loadingStagesDone ? 'text-ink' : 'text-muted/60'
                }`}
              >
                <span aria-hidden="true" className="w-4 text-right tabular-nums">
                  {index + 1}
                </span>
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${
                    index < loadingStagesDone - 1 ? 'bg-ok' : index === loadingStagesDone - 1 ? 'bg-accent' : 'bg-line-strong'
                  }`}
                />
                {stage}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-[11.5px] leading-relaxed text-muted">
            Perhitungan berjalan di server karena komponen K membutuhkan embedding teks tugas. Setelah
            data dimuat, slider dan what-if dihitung di browser tanpa permintaan jaringan.
          </p>
        </main>
      </WorkspaceShell>
    );
  }

  if (error) {
    return (
      <WorkspaceShell code={resolvedCode}>
        <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
          <div role="alert" className="space-y-2 rounded-xl bg-danger-surface p-4 shadow-[inset_0_0_0_1px_var(--danger)]">
            <p className="text-[13px] font-semibold text-danger">{error}</p>
            <p className="text-[12px] leading-relaxed text-danger">
              Periksa bahwa proyek memiliki minimal 2 anggota dan minimal 1 tugas, lalu muat ulang
              halaman.
            </p>
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" onClick={() => void fetchInitialData(resolvedCode)}>
                Muat ulang
              </Button>
              <a
                href={`/p/${encodeURIComponent(resolvedCode)}/members`}
                className="inline-flex h-7 items-center rounded-full bg-card px-3 text-[11.5px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]"
              >
                Lengkapi anggota
              </a>
            </div>
          </div>
        </main>
      </WorkspaceShell>
    );
  }

  if (rows.length === 0 || members.length === 0) {
    return (
      <WorkspaceShell code={resolvedCode}>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
          <h1 className="display text-[clamp(1.5rem,3vw,1.9rem)] text-ink">
            {tasks.length === 0 ? 'Belum ada tugas untuk dibagi' : 'Belum ada anggota untuk menerima tugas'}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            {tasks.length === 0
              ? 'Matriks muncul setelah proyek memiliki minimal satu tugas dengan estimasi jam.'
              : 'Tambahkan minimal dua anggota beserta skill, minat, dan jam tersedia sebelum menghitung.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`/p/${encodeURIComponent(resolvedCode)}/tasks`}
              className="inline-flex h-9 items-center rounded-full bg-accent-strong px-4 text-[13px] font-medium text-accent-ink transition-colors duration-200 hover:bg-ink"
            >
              Susun tugas
            </a>
            <a
              href={`/p/${encodeURIComponent(resolvedCode)}/members`}
              className="inline-flex h-9 items-center rounded-full bg-card px-4 text-[13px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-shadow duration-200 hover:shadow-[inset_0_0_0_1px_var(--ink)]"
            >
              Tambah anggota
            </a>
          </div>
        </main>
      </WorkspaceShell>
    );
  }

  const lockedCount = currentResult.assignments.filter((a) => a.isLocked).length;
  const changedNow = new Set(rowChanges.map((c) => c.taskId));
  const previewAssignment = preview ? resultFor(preview.taskId, displayed) : null;
  const previewTask = preview ? taskById.get(preview.taskId) : undefined;
  const previewMember = preview ? memberById.get(preview.memberId) : undefined;
  const previewCurrent = preview ? byTaskId.get(preview.taskId) : undefined;
  const previewCurrentScore = previewCurrent?.scores[previewCurrent.primaryMemberId]?.breakdown.total ?? 0;

  return (
    <div className="min-h-[100dvh] text-ink">
      <WorkspaceShell
        code={resolvedCode}
        actions={
          <>
            {isFallback && (
              <span className="hidden items-center gap-1 rounded-full bg-warn-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-warn shadow-[inset_0_0_0_1px_var(--warn)] sm:inline-flex">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warn" />
                Mode cadangan
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={!undoEntry}
              title="Urungkan satu langkah terakhir (Ctrl/Cmd+Z)"
            >
              Undo
              <span className="font-mono text-[10px] tabular-nums text-muted" data-numeric>
                {undoEntry ? 1 : 0}
              </span>
            </Button>
          </>
        }
      >

      {/* FR-13: persistent, not a toast. It disappears only when the mode does. */}
      {isFallback && (
        <div className="border-b border-line bg-warn-surface">
          <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2 sm:px-5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-warn">
              Mode cadangan aktif (tanpa AI)
            </span>
            <span className="text-[11.5px] text-warn">
              Komponen konten (K) tidak digunakan karena embedding teks tidak tersedia. Bobot: S 50% ·
              C 33% · M 17%. Semua angka berasal dari perhitungan S, C, dan M.
            </span>
          </div>
        </div>
      )}

      {/* The left padding at `lg` is a hub gutter, not decoration. The Radial
          Sidebar is a 56px fixed circle 18px from the left edge, vertically
          centred, so it floats *over* the page rather than beside it. At 1440px
          it landed squarely on the weight panel's copy and the "Beban anggota"
          heading — the panel's text was unreadable behind it, which the
          anti-slop rules forbid regardless of whose change caused it. Reserving
          5.5rem clears the hub (18 + 56 + 18) with room to spare. Below `lg` the
          dropdown keeps its default padding: the mobile hub sits above the flow
          at the top-right with a downward fan, so it needs no gutter. */}
      <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 px-3 py-4 sm:px-5 lg:flex-row lg:gap-5 lg:pl-[5.5rem]">
        {/* Instruments: weights + workload + mode.
            T-5.11: the sticky offset was a hard-coded 64px from before the nav
            redesign, so the panel docked 64px down regardless of what chrome sat
            above it. At lg the rail runs full height and there is no top bar, so
            the panel docks at the same 12px margin the rail uses. It is not
            sticky below lg at all: the panel stacks above the matrix there, and a
            sticky 390px card on a 844px phone would leave no room to read. */}
        <aside
          className="w-full shrink-0 space-y-3 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-24px)] lg:w-[304px] lg:overflow-y-auto thin-scroll"
          aria-label="Panel bobot dan beban"
        >
          <section className="glass-solid rounded-[var(--radius-card)] p-4">
            <header className="flex items-baseline justify-between gap-2 border-b border-line pb-2.5">
              <h2 className="heading text-[13.5px] text-ink">
                Bobot komponen
              </h2>
              <span
                className={`font-mono text-[10.5px] tabular-nums ${weightSumIsExact(weights) ? 'text-muted' : 'text-danger'}`}
                data-numeric
              >
                {weightSumLabel(weights)}
              </span>
            </header>

            <div className="space-y-3.5 pt-3">
              {(['K', 'S', 'C', 'M'] as const).map((key) => {
                const meta = {
                  K: { label: 'Kemiripan konten', color: 'var(--k)' },
                  S: { label: 'Kecocokan skill', color: 'var(--s)' },
                  C: { label: 'Sisa kapasitas', color: 'var(--c)' },
                  M: { label: 'Minat', color: 'var(--m)' },
                }[key];
                const disabled = isFallback && key === 'K';
                const percent = weightPercent(weights[key]);
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <label htmlFor={`weight-${key}`} className="flex items-baseline gap-1.5 text-[11.5px]">
                        <span
                          aria-hidden="true"
                          className="inline-block h-2 w-2 rounded-[2px]"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="font-mono font-bold text-ink">{key}</span>
                        <span className="text-muted">{meta.label}</span>
                      </label>
                      <span className="font-mono text-[11.5px] tabular-nums text-ink" data-numeric>
                        {percent}%
                      </span>
                    </div>
                    <input
                      id={`weight-${key}`}
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={weights[key]}
                      onChange={(e) => {
                        // `e.timeStamp` is the event clock, so no extra clock read
                        // is needed to measure the recompute.
                        weightsStartedAtRef.current = e.timeStamp;
                        handleWeightChange(key, Number(e.target.value));
                      }}
                      onPointerUp={endWeightDrag}
                      onBlur={endWeightDrag}
                      disabled={disabled}
                      aria-describedby={disabled ? `weight-${key}-note` : undefined}
                      aria-valuetext={`${percent} persen`}
                      className="h-6 w-full cursor-pointer appearance-none rounded-full bg-transparent disabled:cursor-not-allowed"
                      // `color` drives the thumb via currentColor in globals.css;
                      // `accentColor` keeps the native fallback consistent.
                      style={{ color: meta.color, accentColor: meta.color }}
                    />
                    {disabled && (
                      <p id={`weight-${key}-note`} className="text-[10px] leading-snug text-warn">
                        K tidak tersedia pada mode cadangan.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
              <p className="text-[10.5px] leading-snug text-muted">
                Dihitung di browser, tanpa memanggil layanan AI.
              </p>
              {!isFallback && (
                <button
                  type="button"
                  onClick={resetHybridWeights}
                  className="shrink-0 cursor-pointer rounded-full bg-card px-2 py-1 text-[10.5px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:shadow-[inset_0_0_0_1px_var(--ink)]"
                >
                  Reset 40/30/20/10
                </button>
              )}
            </div>
            {recalcMs !== null && (
              <p className="mt-1.5 font-mono text-[10px] tabular-nums text-muted" data-numeric>
                Hitung ulang terakhir: {recalcMs} ms
              </p>
            )}
          </section>

          <section className="glass-solid rounded-[var(--radius-card)] p-4">
            <header className="flex items-baseline justify-between gap-2 border-b border-line pb-2.5">
              <h2 className="heading text-[13.5px] text-ink">
                Beban anggota
              </h2>
              <span className="font-mono text-[10.5px] tabular-nums text-muted" data-numeric>
                ideal {currentResult.idealLoad.toFixed(1)} jam
              </span>
            </header>

            <RevealGroup as="ul" className="space-y-3 pt-3">
              {members.map((member) => {
                const load = currentResult.memberLoads[member.id] ?? 0;
                const r2Limit = currentResult.idealLoad * WORKLOAD_CAP_MULTIPLIER;
                const ratio = member.capacity > 0 ? load / member.capacity : 0;
                const overR2 = load > r2Limit;
                const overCapacity = load > member.capacity;
                return (
                  <RevealItem as="li" key={member.id} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold text-ink">{member.name}</span>
                      <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted" data-numeric>
                        {load} / {member.capacity} jam
                      </span>
                    </div>
                    <LoadMeter ratio={ratio} isOver={overCapacity || overR2} isR2Over={overR2} />
                    <p
                      className={`text-[10px] leading-snug ${overR2 || overCapacity ? 'font-semibold text-danger' : 'text-muted'}`}
                    >
                      {overR2 || overCapacity ? '⚠ ' : ''}
                      {describeR2(load, currentResult.idealLoad, member.capacity)}
                    </p>
                    {load > r2Limit && (
                      <p className="text-[10px] leading-snug text-danger">
                        Beban setelah menerima tugas melebihi {WORKLOAD_CAP_MULTIPLIER}× ideal ({r2Limit.toFixed(2)} jam).
                      </p>
                    )}
                  </RevealItem>
                );
              })}
            </RevealGroup>

            <p className="mt-3 border-t border-line pt-2.5 text-[10.5px] leading-snug text-muted">
              Beban = jumlah estimasi jam tugas yang ditugaskan. Anggota dengan jam 0 dikeluarkan oleh R1.
            </p>
          </section>

          <section className="glass-solid rounded-[var(--radius-card)] p-4">
            <h2 className="heading text-[13.5px] text-ink">Status proses</h2>
            <dl className="mt-2 space-y-1 text-[11px]">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Mode</dt>
                <dd className="font-mono font-semibold text-ink">
                  {isFallback ? 'Cadangan (S/C/M)' : 'Hybrid (K/S/C/M)'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Dihitung</dt>
                <dd className="font-mono tabular-nums text-ink" data-numeric>
                  {computedAt ? new Date(computedAt).toLocaleString('id-ID') : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Log kejadian</dt>
                <dd className="font-mono font-semibold text-ink">
                  {logging === 'ok' ? 'tercatat' : logging === 'failed' ? 'gagal dicatat' : 'menunggu'}
                </dd>
              </div>
            </dl>
            {logging === 'failed' && (
              <p className="mt-2 text-[10.5px] leading-snug text-danger">
                Kejadian tidak tercatat di server, tetapi penugasan Anda tetap berlaku. Coba lagi dengan
                aksi berikutnya.
              </p>
            )}
          </section>
        </aside>

        {/* Matrix */}
        <section className="min-w-0 flex-1" aria-label="Matriks rekomendasi">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1.5">
              <Eyebrow>FR-08 · FR-09 · FR-11 · FR-18</Eyebrow>
              <h1 className="display text-[clamp(1.5rem,2.4vw,1.9rem)] text-ink">
                Matriks <span className="accent-word">penugasan</span>
              </h1>
              <p className="max-w-[70ch] text-[12px] leading-relaxed text-muted">
                Setiap tugas punya satu penanggung jawab dan satu alternatif. Pilih sel untuk menerima,
                tekan L untuk mengunci, atau geser bobot untuk menghitung ulang di browser.
              </p>
              {/*
                Workload summary (T-5.04). The window's `play` move is the one
                motion beat on this page, and it is a single one-shot reveal of
                already-computed numbers, not a repeating animation: the reader
                sees the spread of work settle once and then it stays still. The
                figures are in the DOM from first paint, nothing is masked, and
                the sliders and matrix are untouched by it.
              */}
              <WorkloadSummary
                loads={members.map((member) => currentResult.memberLoads[member.id] ?? 0)}
                ideal={currentResult.idealLoad}
                reduced={reduced}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip tone="muted">
                <span className="font-mono tabular-nums text-ink" data-numeric>
                  {rows.length}
                </span>{' '}
                tugas
              </Chip>
              <Chip tone="muted">
                <span className="font-mono tabular-nums text-ink" data-numeric>
                  {members.length}
                </span>{' '}
                anggota
              </Chip>
              {lockedCount > 0 && (
                <Chip tone="accent">
                  <span className="font-mono tabular-nums" data-numeric>
                    {lockedCount}
                  </span>{' '}
                  terkunci
                </Chip>
              )}
            </div>
          </div>

          {/* FR-18: preview bar. It sits above the table, so it never covers a cell. */}
          <AnimatePresence>
            {preview && previewAssignment && previewTask && previewMember && (
              <motion.div
                key="preview"
                role="status"
                data-testid="whatif-preview"
                initial={reduced ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: reduced ? 0 : DURATION.data, ease: EASE.out }}
                className="mb-2 rounded-[var(--radius-input)] bg-accent-tint px-3.5 py-2.5 shadow-[inset_0_0_0_1px_var(--accent)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[12px] font-semibold text-ink">
                    Pratinjau: {previewTask.title} → {previewMember.name}
                  </p>
                  <p className="font-mono text-[11px] tabular-nums text-ink" data-numeric>
                    {(previewCurrentScore * 100).toFixed(0)}% →{' '}
                    {(previewAssignment.scores[previewMember.id]?.breakdown.total ?? 0) * 100 > 0
                      ? ((previewAssignment.scores[previewMember.id]?.breakdown.total ?? 0) * 100).toFixed(0)
                      : '0'}
                    %
                  </p>
                </div>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10.5px] tabular-nums text-ink/85" data-numeric>
                  {members.map((member) => {
                    const now = currentResult.memberLoads[member.id] ?? 0;
                    const next = displayed.memberLoads[member.id] ?? 0;
                    const delta = next - now;
                    if (delta === 0) return null;
                    return (
                      <li key={member.id}>
                        {member.name} {now} → {next} jam ({delta > 0 ? '+' : ''}
                        {delta})
                      </li>
                    );
                  })}
                  {members.every(
                    (m) => (displayed.memberLoads[m.id] ?? 0) === (currentResult.memberLoads[m.id] ?? 0)
                  ) && <li>Tidak ada beban yang berubah.</li>}
                </ul>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="accent"
                    onClick={() =>
                      applyOwnerChange(preview.taskId, preview.memberId, {
                        lock: true,
                        label: 'Pindahkan tugas (what-if)',
                        event: 'assignment_changed',
                      })
                    }
                  >
                    Terapkan perpindahan
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Cancelling dismisses the whole what-if gesture: leaving
                      // the "Pindahkan ke" menu open made the next click toggle
                      // it shut instead of reopening it.
                      setPreview(null);
                      setMoveTarget(null);
                      setStatus({ kind: 'ok', text: 'Pratinjau perpindahan dibatalkan. Tidak ada yang diubah.' });
                    }}
                  >
                    Batalkan
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* FR-19 feedback: names the change, not just a colour. */}
          <div className="mb-2 min-h-[1.5rem]" aria-live="polite" aria-atomic="true">
            {status && (
              <p
                className={`text-[11.5px] leading-snug ${
                  status.kind === 'error'
                    ? 'text-danger'
                    : status.kind === 'warn'
                      ? 'text-warn'
                      : 'text-ok'
                }`}
              >
                {status.text}
              </p>
            )}
          </div>

          {/* `relative` is load-bearing: the header's `sticky left-0` cells need a
              positioned scroll ancestor, otherwise the wide table escapes this box
              and the whole page scrolls sideways on a 390px viewport. */}
          <motion.div
            data-motion-reveal=""
            className="glass-solid relative overflow-x-auto rounded-[var(--radius-card)] thin-scroll"
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : DURATION.reveal, ease: EASE.out, delay: reduced ? 0 : 0.08 }}
          >
            <table ref={tableRef} className="w-full min-w-[760px] border-collapse" data-testid="matrix">
              <caption className="sr-only">
                Matriks penugasan: baris adalah tugas, kolom adalah anggota. Pilih sel untuk menerima
                rekomendasi. Tekan panah untuk berpindah sel, Enter untuk memilih, L untuk mengunci.
              </caption>
              <thead>
                <tr className="border-b border-line bg-mist text-left text-[10px] uppercase tracking-[0.1em] text-muted">
                  <th scope="col" className="sticky left-0 z-20 w-[190px] bg-mist px-3 py-2.5 font-medium">
                    Tugas
                  </th>
                  {members.map((member) => (
                    <th
                      key={member.id}
                      scope="col"
                      className="min-w-[104px] px-2 py-2.5 text-center align-bottom font-medium"
                    >
                      <span className="block truncate text-ink" title={member.name}>
                        {member.name}
                      </span>
                      <span className="block font-mono text-[9.5px] font-normal normal-case tabular-nums text-muted" data-numeric>
                        {member.capacity} jam
                      </span>
                    </th>
                  ))}
                  {/* Widened from 172px. The owner <select> and the Kunci /
                      Pindahkan / Tukar buttons share this column, and 172px was
                      narrow enough that a native <select> clipped real names to
                      "Ayu Pramesw…" — a name the reader cannot read is worse than
                      a slightly wider table. The matrix scrolls horizontally on
                      its own (`min-w-[760px]`), so the extra width costs nothing
                      on a narrow screen. */}
                  <th scope="col" className="w-[210px] px-3 py-2.5 font-semibold">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ task, assignment }) => {
                  const highlight = changedNow.has(task.id);
                  return (
                    <tr
                      key={task.id}
                      data-testid={`row-${task.id}`}
                      data-locked={assignment.isLocked ? 'true' : 'false'}
                      className={`border-b border-line align-top last:border-b-0 transition-colors duration-200 ${
                        assignment.isLocked ? 'bg-accent-tint' : ''
                      } ${highlight ? 'bg-sky' : ''}`}
                    >
                      <th
                        scope="row"
                        className={`sticky left-0 z-10 px-3 py-2 text-left align-top font-normal ${
                          assignment.isLocked ? 'bg-accent-tint' : highlight ? 'bg-sky' : 'bg-card'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <p className="text-[12.5px] font-medium leading-tight tracking-[-0.01em] text-ink">
                            {task.title}
                          </p>
                          <p className="font-mono text-[10px] tabular-nums text-muted" data-numeric>
                            {task.estimated_hours} jam · effort {task.difficulty}/5
                          </p>
                          {/* T-6.09: display task-level warnings (R2/R3) */}
                          {currentResult.warnings
                            .filter((w) => w.taskId === task.id)
                            .map((w, i) => (
                              <p
                                key={i}
                                className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9.5px] font-medium ${
                                  w.code === 'r2_locked_overload' ? 'bg-danger-surface text-danger' : 'bg-warn-surface text-warn'
                                }`}
                                title={w.message}
                                data-testid={`${w.code}-${task.id}`}
                              >
                                <span aria-hidden="true">{w.code === 'r2_locked_overload' ? '⚠' : '▲'}</span>
                                {w.code === 'r2_no_candidate'
                                  ? 'R2: semua gugur'
                                  : w.code === 'r3_no_candidate'
                                    ? 'R3: tidak ada kandidat'
                                    : 'R2: beban berlebih'}
                              </p>
                            ))}
                          {task.required_skills.length > 0 && (
                            <p className="text-[10.5px] leading-snug text-muted">
                              {task.required_skills.join(', ')}
                            </p>
                          )}
                          {assignment.isLocked && (
                            <p className="inline-flex items-center gap-1 rounded-sm bg-ink px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-paper">
                              terkunci · R5
                            </p>
                          )}
                        </div>
                      </th>

                      {members.map((member) => {
                        const score = assignment.scores[member.id];
                        const isPrimary = assignment.primaryMemberId === member.id;
                        const b = score?.breakdown ?? { K: 0, S: 0, C: 0, M: 0, total: 0 };
                        const percent = Math.round(b.total * 100);
                        const isFocused = focusedCell?.taskId === task.id && focusedCell?.memberId === member.id;
                        return (
                          <td key={member.id} className="border-l border-line/60 p-0 align-top">
                            <button
                              type="button"
                              data-cell={`${task.id}:${member.id}`}
                              data-testid={`cell-${task.id}-${member.id}`}
                              aria-pressed={isPrimary}
                              aria-label={`${task.title}, ${member.name}: ${
                                isPrimary
                                  ? 'penanggung jawab saat ini'
                                  : score?.isEligible
                                    ? 'kandidat alternatif'
                                    : 'tidak lolos aturan'
                              }, skor ${percent}%. Tekan Enter untuk menetapkan, L untuk mengunci.`}
                              onFocus={() => {
                                setFocusedCell({ taskId: task.id, memberId: member.id });
                                setDetailTaskId(task.id);
                              }}
                              onMouseEnter={() => setDetailTaskId(task.id)}
                              onClick={() =>
                                applyOwnerChange(task.id, member.id, {
                                  lock: false,
                                  label: 'Terima rekomendasi',
                                  event: 'recommendation_accepted',
                                })
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, task.id, member.id)}
                              className={`group flex h-full min-h-[62px] w-full cursor-pointer flex-col items-center justify-center gap-0.5 border-l-2 px-1.5 py-2 text-center transition-colors duration-[200ms] ease-[var(--ease-hover)] ${
                                isPrimary
                                  ? 'border-[var(--accent)] bg-accent-tint text-ink'
                                  : score?.isEligible
                                    ? 'border-transparent text-ink hover:bg-accent-tint/60'
                                    : 'border-transparent text-fog hover:bg-mist'
                              } ${isFocused ? 'outline outline-2 -outline-offset-2 outline-[var(--accent)]' : ''}`}
                              title={`${member.name}: K ${Math.round(b.K * 100)} · S ${Math.round(b.S * 100)} · C ${Math.round(b.C * 100)} · M ${Math.round(b.M * 100)}`}
                            >
                              <span
                                className={`font-mono font-bold leading-none tabular-nums ${isPrimary ? 'text-[15px]' : 'text-[13px]'}`}
                                data-numeric
                              >
                                {percent}
                                <span className="text-[9px] font-normal">%</span>
                              </span>
                              {isPrimary ? (
                                <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-strong)]">
                                  utama
                                </span>
                              ) : score?.isEligible ? (
                                <span className="text-[9px] uppercase tracking-[0.06em]">kandidat</span>
                              ) : (
                                <span className="text-[9px] uppercase tracking-[0.06em]">gugur</span>
                              )}
                              <span
                                aria-hidden="true"
                                className={`block h-[2px] w-8 rounded-full ${isPrimary ? 'bg-[var(--accent)]' : 'bg-cloud'}`}
                              >
                                <span
                                  className="block h-full origin-left rounded-full"
                                  style={{
                                    transform: `scaleX(${Math.max(0, Math.min(1, b.total))})`,
                                    backgroundColor: isPrimary ? 'var(--paper)' : 'var(--accent)',
                                  }}
                                />
                              </span>
                            </button>
                          </td>
                        );
                      })}

                      {/* The owner select used `w-full` alone, which clipped longer
                          member names in this narrow AKSI column ("Ayu Pramesw…"
                          with the real roster). A native <select> truncates its
                          own text with no tooltip, so the owner's name — the one
                          thing this control exists to show — became unreadable.
                          `min-w` lets the cell grow with the longest name while
                          `w-full` still fills a wide cell. */}
                      <td className="border-l border-line/60 px-2 py-2 align-top">
                        <div className="space-y-1.5">
                          <label className="sr-only" htmlFor={`assign-${task.id}`}>
                            Penanggung jawab untuk {task.title}
                          </label>
                          <select
                            id={`assign-${task.id}`}
                            value={assignment.primaryMemberId}
                            onChange={(e) =>
                              applyOwnerChange(task.id, e.target.value, {
                                lock: true,
                                label: 'Ganti penanggung jawab',
                                event: 'assignment_changed',
                              })
                            }
                            className="h-8 w-full min-w-[9.5rem] cursor-pointer rounded-lg bg-card px-2 text-[11.5px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-shadow duration-200 hover:shadow-[inset_0_0_0_1px_var(--fog)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                          >
                            {members
                              .filter((m) => m.capacity > 0)
                              .map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                          </select>

                          <div className="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              data-testid={`lock-${task.id}`}
                              onClick={() => toggleLock(task.id)}
                              aria-pressed={assignment.isLocked}
                              aria-label={
                                assignment.isLocked
                                  ? `Buka kunci ${task.title}`
                                  : `Kunci ${task.title}`
                              }
                              className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors duration-200 ${
                                assignment.isLocked
                                  ? 'bg-ink text-paper'
                                  : 'bg-card text-muted shadow-[inset_0_0_0_1px_var(--line-strong)] hover:text-ink hover:shadow-[inset_0_0_0_1px_var(--ink)]'
                              }`}
                            >
                              <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {assignment.isLocked ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                )}
                              </svg>
                              {assignment.isLocked ? 'Terkunci' : 'Kunci'}
                            </button>

                            <button
                              type="button"
                              data-testid={`move-${task.id}`}
                              onClick={() =>
                                setMoveTarget(moveTarget?.taskId === task.id ? null : { taskId: task.id, memberId: assignment.primaryMemberId })
                              }
                              aria-expanded={moveTarget?.taskId === task.id}
                              aria-controls={moveTarget?.taskId === task.id ? `${MOVE_OPTIONS_ID}-${task.id}` : undefined}
                              className="inline-flex h-7 items-center rounded-full bg-card px-2 text-[10px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-shadow duration-200 hover:shadow-[inset_0_0_0_1px_var(--ink)]"
                            >
                              Pindahkan ke
                            </button>

                            <button
                              type="button"
                              data-testid={`swap-${task.id}`}
                              onClick={() => handleSwap(task.id)}
                              aria-pressed={swapAnchor === task.id}
                              className={`inline-flex h-7 items-center rounded-full px-2 text-[10px] font-medium transition-colors duration-200 ${
                                swapAnchor === task.id
                                  ? 'bg-accent-strong text-accent-ink'
                                  : 'bg-card text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:shadow-[inset_0_0_0_1px_var(--ink)]'
                              }`}
                            >
                              {swapAnchor ? (swapAnchor === task.id ? 'Dipilih' : 'Tukar dengan') : 'Tukar'}
                            </button>
                          </div>

                          {moveTarget?.taskId === task.id && (
                            <ul
                              id={`${MOVE_OPTIONS_ID}-${task.id}`}
                              className="space-y-0.5 rounded-lg bg-mist p-1 shadow-[inset_0_0_0_1px_var(--line)]"
                            >
                              {members
                                .filter((m) => m.id !== assignment.primaryMemberId && m.capacity > 0)
                                .map((m) => (
                                  <li key={m.id}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreview({ taskId: task.id, memberId: m.id });
                                        setStatus({
                                          kind: 'ok',
                                          text: `Pratinjau: ${task.title} ke ${m.name}. Konfirmasi atau batalkan di atas tabel.`,
                                        });
                                      }}
                                      className={`w-full rounded px-1.5 py-1 text-left text-[11px] hover:bg-card ${
                                        preview?.taskId === task.id && preview.memberId === m.id
                                          ? 'bg-card font-semibold text-ink'
                                          : 'text-ink'
                                      }`}
                                    >
                                      {m.name}
                                    </button>
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>

          {/* FR-08 / FR-09: the breakdown panel lives under the table row it belongs to. */}
          {detailTaskId && byTaskId.get(detailTaskId) && (
            <section
              data-testid="breakdown-panel"
              aria-live="polite"
              className="mt-2 rounded-[var(--radius-card)] bg-card p-4 shadow-[inset_0_0_0_1px_var(--line)]"
            >
              {(() => {
                const task = taskById.get(detailTaskId);
                const assignment = byTaskId.get(detailTaskId);
                if (!task || !assignment) return null;
                const primaryScore = assignment.scores[assignment.primaryMemberId];
                const primaryMember = memberById.get(assignment.primaryMemberId);
                const alternative = assignment.alternativeMemberId
                  ? memberById.get(assignment.alternativeMemberId)
                  : undefined;
                const altScore = assignment.alternativeMemberId
                  ? assignment.scores[assignment.alternativeMemberId]
                  : undefined;
                return (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                      <h2 className="heading text-[14px] text-ink">
                        Rincian skor: {task.title}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setDetailTaskId(null)}
                        className="rounded-full px-2 py-0.5 text-[11px] text-muted transition-colors duration-200 hover:bg-mist hover:text-ink"
                      >
                        Tutup rincian
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                          Penanggung jawab · {primaryMember?.name ?? '—'}
                        </p>
                        {primaryScore && (
                          <div className="space-y-2">
                            <ScoreBreakdown
                              value={primaryScore.breakdown}
                              weights={weights}
                              isFallback={isFallback}
                              contributions
                            />
                            {primaryScore.warnings && primaryScore.warnings.length > 0 && (
                              <ul className="space-y-1 rounded-lg bg-danger-surface p-2">
                                {primaryScore.warnings.map((w, i) => (
                                  <li key={i} className="text-[10.5px] leading-snug text-danger">
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                      {altScore && alternative && (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                            Alternatif · {alternative.name}
                          </p>
                          <div className="space-y-2">
                            <ScoreBreakdown
                              value={altScore.breakdown}
                              weights={weights}
                              isFallback={isFallback}
                              contributions
                            />
                            {altScore.warnings && altScore.warnings.length > 0 && (
                              <ul className="space-y-1 rounded-lg bg-danger-surface p-2">
                                {altScore.warnings.map((w, i) => (
                                  <li key={i} className="text-[10.5px] leading-snug text-danger">
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {primaryScore && primaryMember && (
                      <p className="text-[12px] leading-relaxed text-ink">
                        <span className="font-semibold">Alasan. </span>
                        {memberReason({
                          task,
                          member: primaryMember,
                          breakdown: primaryScore.breakdown,
                          isPrimary: true,
                          isFallback,
                        })}
                      </p>
                    )}
                    <p className="text-[11px] leading-relaxed text-muted">
                      Skor akhir = {isFallback ? '0,50S + 0,33C + 0,17M' : '0,40K + 0,30S + 0,20C + 0,10M'} ×
                      100. Tugas ini{' '}
                      {assignment.isLocked
                        ? 'terkunci, sehingga tidak berubah saat dihitung ulang (R5).'
                        : 'tidak terkunci, sehingga ikut berubah bila bobot atau penugasan lain berubah.'}
                    </p>
                  </div>
                );
              })()}
            </section>
          )}

          {/* FR-14 export + FR-17 comparison */}
          <div className="mt-3 space-y-2 rounded-[var(--radius-card)] bg-card px-4 py-3 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {[
                  { k: 'K', label: 'konten', color: 'var(--k)' },
                  { k: 'S', label: 'skill', color: 'var(--s)' },
                  { k: 'C', label: 'kapasitas', color: 'var(--c)' },
                  { k: 'M', label: 'minat', color: 'var(--m)' },
                ].map((legend) => (
                  <li key={legend.k} className="flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-[2px]"
                      style={{ backgroundColor: legend.color }}
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      {legend.k} {legend.label}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowComparison((v) => !v)}
                  aria-expanded={showComparison}
                >
                  {showComparison ? 'Tutup perbandingan' : 'Bandingkan dengan awal'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}>
                  Ekspor CSV
                </Button>
                <Button type="button" variant="solid" size="sm" onClick={handleCopyText}>
                  {copyState === 'copied' ? 'Tersalin' : copyState === 'failed' ? 'Gagal menyalin' : 'Salin teks'}
                </Button>
              </div>
            </div>

            {showComparison && comparison && baseline && (
              <div data-testid="comparison" className="border-t border-line pt-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {baseline.label} → sekarang
                </h2>
                {comparison.changedCount === 0 ? (
                  <p className="mt-1 text-[12px] text-muted">
                    Tidak ada penanggung jawab yang berubah.
                    {comparison.scoreOnlyChanges > 0
                      ? ` ${comparison.scoreOnlyChanges} tugas berubah skor tanpa berganti penanggung jawab.`
                      : ''}
                  </p>
                ) : (
                  <div className="mt-1.5 overflow-x-auto thin-scroll">
                    <table className="w-full min-w-[520px] text-left text-[11.5px]">
                      <caption className="sr-only">
                        Perbandingan penanggung jawab sebelum dan sesudah perubahan
                      </caption>
                      <thead>
                        <tr className="text-[10px] uppercase tracking-[0.1em] text-muted">
                          <th scope="col" className="py-1 pr-2 font-semibold">Tugas</th>
                          <th scope="col" className="py-1 pr-2 font-semibold">Sebelum</th>
                          <th scope="col" className="py-1 font-semibold">Sesudah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.ownerChanges.map((row) => (
                          <tr key={row.taskId} className="border-t border-line">
                            <th scope="row" className="py-1 pr-2 text-left font-medium text-ink">
                              {row.taskTitle}
                            </th>
                            <td className="py-1 pr-2 text-muted">{row.fromMember}</td>
                            <td className="py-1 font-semibold text-ink">{row.toMember}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10.5px] tabular-nums text-muted" data-numeric>
                  {comparison.loadDeltas
                    .filter((d) => d.delta !== 0)
                    .map((d) => (
                      <li key={d.memberId}>
                        {d.memberName}: {d.from} → {d.to} jam ({d.delta > 0 ? '+' : ''}
                        {d.delta})
                      </li>
                    ))}
                  {comparison.loadDeltas.every((d) => d.delta === 0) && <li>Beban tidak berubah.</li>}
                </ul>
              </div>
            )}
          </div>

          <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
            Pintasan: panah untuk berpindah sel, <kbd>Enter</kbd> untuk menetapkan penanggung jawab,{' '}
            <kbd>L</kbd> untuk mengunci, <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Z</kbd> untuk mengurungkan.
            Pintasan tidak aktif saat fokus berada di kolom isian.
          </p>
        </section>
      </main>
      </WorkspaceShell>
    </div>
  );
}

const DEFAULT_HYBRID_WEIGHTS_LOCAL = { ...DEFAULT_WEIGHTS };

/**
 * Workload spread: one tick per member, on the same axis as the R2 ceiling.
 *
 * Reading the panel on the left tells you each member's hours, but not how the
 * group compares at a glance. These ticks are positioned on the actual ratio
 * (load / ideal) so a reader can see at once whether the work is spread evenly
 * or concentrated. It is a static scale after its entrance: no scroll link, no
 * loop, and the underlying numbers are printed beside it as real text.
 */
function WorkloadSummary({
  loads,
  ideal,
  reduced,
}: {
  loads: number[];
  ideal: number;
  reduced: boolean;
}) {
  if (loads.length === 0 || !Number.isFinite(ideal) || ideal <= 0) return null;
  // The axis ends at the R2 ceiling, which is the only threshold the product
  // applies, so every tick has a meaning rather than being a decoration.
  const ceiling = WORKLOAD_CAP_MULTIPLIER;
  const ratioOf = (load: number) => Math.max(0, Math.min(1, load / ideal / ceiling));

  return (
    <div className="mt-2.5 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-fog">Sebaran beban</span>
        <span className="font-mono text-[10px] tabular-nums text-fog" data-numeric>
          batas R2 = {ceiling}× ideal
        </span>
      </div>
      <div
        aria-hidden="true"
        className="relative h-3.5 w-full overflow-hidden rounded-[3px] bg-mist shadow-[inset_0_0_0_1px_var(--line)]"
      >
        {/* The ceiling hairline, so the reader can see what "over" means. */}
        <span className="absolute inset-y-0 right-0 w-px bg-line-strong" />
        {loads.map((load, index) => {
          const ratio = ratioOf(load);
          const over = load / ideal > ceiling;
          return (
            <motion.span
              key={index}
              className="absolute top-0.5 bottom-0.5 w-[2px] rounded-full"
              style={{
                left: `calc(${ratio * 100}% - 1px)`,
                backgroundColor: over ? 'var(--danger)' : 'var(--accent-strong)',
              }}
              initial={reduced ? false : { scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{
                duration: DURATION.data,
                ease: EASE.out,
                delay: index * 0.05,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
