'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { Task, Member, TaskAssignment, AssignmentResult } from '@/lib/scoring/types';
import { globalAssign } from '@/lib/scoring/assign';
import { DEFAULT_WEIGHTS, FALLBACK_WEIGHTS, WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import { memberReason, matchingSkills } from '@/lib/scoring/explain-local';
import { checkR1 } from '@/lib/scoring/rules';
import {
  redistributeWeights,
  weightPercent,
  assignOwner,
  toggleLockState,
  swapOwners,
  toCsv,
  toPlainText,
  compareSnapshots,
  describeOverCap,
  validateSplit,
  smallestSplitThatFits,
  weightSumLabel,
  weightSumIsExact,
  type Weights,
  type WeightKey,
  type ExportRow,
  type ExportEligibility,
  type Snapshot,
  type UndoEntry,
} from '@/lib/scoring/interaction';
import { recordEvent } from '@/lib/client/events';
import { RevealGroup, RevealItem } from '@/components/motion/reveal';
import { ScoreBreakdown } from '@/components/recommendations/score-breakdown';
import {
  ResultSummary,
  ScoreDetail,
  MemberLoadRow,
  TaskRecommendationCard,
  assignmentReason,
  RULE_PLAIN,
  summarise,
  type TaskCardData,
} from '@/components/recommendations/result-dashboard';
import {
  CandidateScoreChart,
  candidateStatus,
  candidateStatusLabel,
} from '@/components/recommendations/candidate-score-chart';
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
  /**
   * T-UI-MATRIX-01: two views over the SAME `currentResult`.
   *
   * "ringkasan" is the default because it answers the question a student
   * arrives with (who gets what). "matriks" keeps the full comparison table for
   * anyone who wants to check every member at once. Both read the identical
   * engine result, so switching cannot change a single number.
   */
  const [view, setView] = useState<'ringkasan' | 'matriks'>('ringkasan');

  /**
   * T-FIX-R2-02 point 3: the split flow.
   *
   * The database has no parent/subtask column (`tasks` in migration 001 has no
   * hierarchy) and `Task` carries none either, so this does NOT introduce one.
   * A split is expressed with the mechanism that already exists: the user
   * authors N plain tasks through the same POST the task page uses, and the
   * total must equal the parent's hours exactly. `splitParentId` only identifies
   * which row opened the panel; it is not persisted anywhere.
   */
  const [splitParentId, setSplitParentId] = useState<string | null>(null);
  const [splitRows, setSplitRows] = useState<{ hours: string }[]>([{ hours: '' }, { hours: '' }]);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [splitSubmitting, setSplitSubmitting] = useState(false);

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

  /**
   * Creates the subtasks the user described, then recomputes.
   *
   * Only the hours are authored here. Title, description and skills are taken
   * from the parent task so nothing is invented: the description is the parent's
   * own text, and the user edits it afterwards on the task page if a slice needs
   * its own wording. The total is checked by `validateSplit` before any request
   * is sent, because a split that silently adds or drops hours would change the
   * workload every later score is based on.
   */
  const submitSplit = async () => {
    // Read from state rather than taking arguments: passing render values into
    // a handler defined in the render body tripped the compiler's ref check.
    const parent = splitParentId ? taskById.get(splitParentId) : undefined;
    const parts = splitRows;
    if (!parent) return;
    const validation = validateSplit(parts, parent.estimated_hours);
    if (!validation.ok) {
      setSplitError(
        validation.error ?? Object.values(validation.rowErrors)[0] ?? 'Pembagian tugas belum sah.'
      );
      return;
    }

    setSplitError(null);
    setSplitSubmitting(true);
    try {
      for (const [index, part] of parts.entries()) {
        const res = await fetch(`/api/projects/${encodeURIComponent(resolvedCode)}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `${parent.title} (bagian ${index + 1})`,
            // The parent's own description, never a generated one.
            description: parent.description?.trim() || parent.title,
            estimated_hours: Number(part.hours),
            required_skills: parent.required_skills,
            effort: parent.difficulty,
            source: 'manual',
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || 'Gagal membuat subtugas.');
        }
      }

      /*
       * T-ROOT-CAUSE-03: the parent must not survive the split.
       *
       * The parts already sum to the parent's estimate, which `validateSplit`
       * enforces. Leaving the parent in place therefore counted the same work
       * twice: total effort became parent + parts, which inflated the ideal load
       * (total ÷ members) and with it the R2 cap, while the parent itself stayed
       * unassignable and kept its own R2 warning. Removing the parent after every
       * part is stored is what makes "the sum of the parts equals the original
       * estimate" true for the workload the engine actually sees.
       *
       * Deletion happens last and is skipped if any part failed, so a failed
       * split never destroys the original task.
       */
      const del = await fetch(
        `/api/projects/${encodeURIComponent(resolvedCode)}/tasks/${encodeURIComponent(parent.id)}`,
        { method: 'DELETE' }
      );
      if (!del.ok) {
        const json = await del.json().catch(() => ({}));
        // The parts exist, so the parent staying would double-count. Tell the
        // reader exactly which task to remove rather than silently regenerating.
        throw new Error(
          json.error ||
            `${parts.length} subtugas dibuat, tetapi tugas induk gagal dihapus. Hapus "${parent.title}" secara manual agar jamnya tidak terhitung dua kali.`
        );
      }

      setStatus({
        kind: 'ok',
        text: `${parent.title} dipecah menjadi ${parts.length} bagian dengan total ${parent.estimated_hours} jam, dan tugas induk sudah dihapus sehingga jamnya tidak terhitung dua kali. Skor dihitung ulang untuk tiap bagian.`,
      });
      setSplitParentId(null);
      setSplitRows([{ hours: '' }, { hours: '' }]);
      await fetchInitialData(resolvedCode);
    } catch (error) {
      setSplitError(error instanceof Error ? error.message : 'Gagal membuat subtugas.');
    } finally {
      setSplitSubmitting(false);
    }
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
      /*
       * T-FINAL-QA-01: carry the engine's own verdict into the export.
       *
       * An R3 fallback owner has `isEligible: false`; the card and the matrix
       * say "gugur R3", but the export used to print their name as an ordinary
       * "Penanggung Jawab". The verdict is read from the same
       * `CandidateScore.isEligible` the screen uses, so the two cannot disagree.
       */
      const eligibility: ExportEligibility | undefined = primary
        ? score?.isEligible
          ? 'layak'
          : 'tidak layak'
        : undefined;
      return {
        task: task.title,
        hours: task.estimated_hours,
        effort: task.difficulty,
        primary: primary?.name ?? '',
        alternative: alternative?.name ?? '',
        eligibility,
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

  /*
   * The chart legend must print the weights the scores were actually produced
   * with. A hardcoded 40/30/20/10 would contradict the sliders the moment the
   * user moves one, and in fallback mode K is not counted at all.
   */
  const chartComponents = [
    { key: 'K' as const, label: 'Kemiripan konten', color: 'var(--k)', weight: isFallback ? 0 : weights.K },
    { key: 'S' as const, label: 'Kecocokan skill', color: 'var(--s)', weight: weights.S },
    { key: 'C' as const, label: 'Sisa kapasitas', color: 'var(--c)', weight: weights.C },
    { key: 'M' as const, label: 'Minat', color: 'var(--m)', weight: weights.M },
  ];

  /*
   * Conditions that change what the matrix MEANS, stated once at the top
   * instead of repeated in every cell. Every branch reads engine output: the
   * warning codes and `detail` facts globalAssign already computed, plus the
   * roster's own capacity and skill levels. Nothing here re-derives R1/R2/R3,
   * so the banner can never disagree with the scores below it.
   */
  /**
   * T-UI-FINAL-01: every rule notice answers the same questions, in the same
   * order: what happened (`headline`, plain language), what it means for you
   * (`detail`), and what to do (`hint`). The rule code stays as small secondary
   * text so the sentence maps back to the PRD without becoming the message.
   * Only rules that actually fired appear; a rule that held is not mentioned,
   * because "R1 OK" everywhere is noise.
   */
  type RuleNotice = {
    key: string;
    tone: 'danger' | 'warn' | 'info';
    headline: string;
    detail: string;
    /** One actionable sentence. Optional: not every notice has a next step. */
    hint?: string;
  };
  const assignmentStatus: RuleNotice[] = (() => {
    const items: RuleNotice[] = [];

      const allR1Excluded = members.length > 0 && members.every((m) => !checkR1(m));
      if (allR1Excluded) {
        items.push({
          key: 'r1-all',
          tone: 'danger',
          headline: 'Tidak ada anggota yang punya waktu tersedia',
          detail:
            `Seluruh ${members.length} anggota memiliki jam tersedia 0, sehingga tidak satu pun bisa menerima tugas. Semua tugas tetap tanpa penanggung jawab.`,
          hint: 'Isi jam tersedia pada halaman Anggota, lalu hitung ulang.',
        });
      }

      const r1Excluded = members.filter((m) => !checkR1(m));
      if (r1Excluded.length > 0 && !allR1Excluded) {
        items.push({
          key: 'r1-some',
          tone: 'warn',
          headline: `${r1Excluded.length} anggota tidak ikut dibagi karena jam tersedia 0`,
          detail:
            `${r1Excluded.map((m) => m.name).join(', ')} tidak dihitung sebagai kandidat, sehingga tugas dibagi ke anggota yang tersisa.`,
          hint: 'Bila ada tugas yang akhirnya tidak terbagi, naikkan jam tersedia anggota ini.',
        });
      }

      const r2Warnings = currentResult.warnings.filter((w) => w.code === 'r2_no_candidate');
      const impossible = r2Warnings.filter((w) => w.detail?.exceedsCapAlone);
      const blocked = r2Warnings.filter((w) => w.detail && !w.detail.exceedsCapAlone);

      if (impossible.length > 0) {
        const w = impossible[0].detail!;
        /*
         * The old sentence here said "tambah anggota agar beban ideal naik".
         * That is backwards. Ideal load is total hours divided by the number of
         * members, so with the same work an extra member LOWERS the share and
         * therefore lowers the R2 cap. For one 2 hour task the cap falls from
         * 1.25 hours with 2 members to 0.63 with 4 and 0.25 with 10, which makes
         * the task harder to place, not easier. Telling the reader to add people
         * sent them down a path that cannot succeed.
         *
         * What does work is giving each member a smaller slice of the work, so
         * that the largest single task fits under the cap. The suggestion below
         * is computed from the same numbers the engine used, not written by hand.
         */
        const feasibleSplit = smallestSplitThatFits(w.taskHours, w.capHours);
        const overCapText = describeOverCap({
          taskHours: w.taskHours,
          idealLoad: w.idealLoad,
          capHours: w.capHours,
        });

        items.push({
          key: 'r2-impossible',
          tone: 'danger',
          headline: 'Ada tugas yang lebih besar dari batas beban anggota',
          detail:
            `Estimasi pekerjaan membutuhkan ${w.taskHours} jam, sedangkan batas beban yang diizinkan ${w.capHours.toFixed(2)} jam. ` +
            `Tugas perlu dibagi menjadi beberapa bagian atau estimasinya diperiksa kembali. ` +
            `${overCapText.summary}`,
          hint:
            (feasibleSplit !== null
              ? `Saat ini tiap bagian harus di bawah ${w.capHours.toFixed(2)} jam, jadi minimal ${feasibleSplit} bagian. `
              : '') +
            'Angka batas itu ikut berubah setelah tugas dipecah, karena beban ideal dihitung dari total jam dibagi jumlah anggota: tugas yang dipecah membuat rata-rata per anggota lebih kecil. Periksa lagi hasilnya setelah pemecahan. ' +
            'Menambah anggota tidak menyelesaikan masalah ini: anggota bertambah justru membuat batas beban makin kecil untuk total jam yang sama.',
        });
      }

      if (blocked.length > 0) {
        items.push({
          key: 'r2-blocked',
          tone: 'warn',
          headline: `${blocked.length} tugas belum mendapat penanggung jawab`,
          detail:
            `Tugas ini muat di bawah batas beban (${currentResult.idealLoad * WORKLOAD_CAP_MULTIPLIER > 0 ? (currentResult.idealLoad * WORKLOAD_CAP_MULTIPLIER).toFixed(2) : '0'} jam), ` +
            `tetapi setiap anggota yang memenuhi aturan sudah membawa beban lain sehingga beban kerjanya akan melebihi batas bila menerimanya. Tugas dibiarkan kosong, bukan dipaksakan ke anggota yang melanggar.`,
          hint: 'Kurangi beban anggota lain, atau pecah tugas ini menjadi bagian yang lebih kecil.',
        });
      }

      const r3Warnings = currentResult.warnings.filter((w) => w.code === 'r3_no_candidate');
      if (r3Warnings.length > 0) {
        items.push({
          key: 'r3-fallback',
          tone: 'warn',
          headline: `${r3Warnings.length} tugas belum punya anggota dengan kemampuan minimum`,
          detail:
            'Belum ada anggota dengan kemampuan minimum yang dibutuhkan tugas ini. Sistem tetap menampilkan saran terbaik yang tersedia, tetapi anggota itu belum memenuhi aturan sehingga bukan penugasan final.',
          hint: 'Naikkan level kemampuan anggota yang relevan pada halaman Anggota, atau periksa kembali kemampuan yang diminta tugas ini.',
        });
      }

      const lockedOverload = currentResult.warnings.filter((w) => w.code === 'r2_locked_overload');
      if (lockedOverload.length > 0) {
        items.push({
          key: 'r5-overload',
          tone: 'warn',
          headline: `${lockedOverload.length} tugas terkunci membuat beban anggota melebihi batas`,
          detail:
            'Tugas yang Anda kunci tetap dipegang pemiliknya meskipun bebannya melewati batas. Tugas yang dikunci tidak akan berubah otomatis.',
          hint: 'Buka kunci tugas tersebut bila ingin sistem mencarikan pemilik lain.',
        });
      }

      if (items.length === 0) {
        const unassigned = currentResult.assignments.filter((a) => !a.primaryMemberId).length;
        if (unassigned > 0) {
          items.push({
            key: 'unassigned',
            tone: 'warn',
            headline: `${unassigned} tugas belum punya penanggung jawab`,
            detail:
              'Setiap tugas hanya memiliki satu penanggung jawab, jadi tugas ini dibiarkan kosong daripada dibagi diam-diam ke beberapa orang.',
            hint: 'Lihat alasan pada kartu tugas atau baris matriks.',
          });
        } else {
          items.push({
            key: 'ok',
            tone: 'info',
            headline: 'Semua tugas sudah dibagikan dan memenuhi aturan',
            detail:
              'Setiap tugas punya tepat satu penanggung jawab, dan batas beban serta kemampuan minimum terpenuhi.',
            hint: 'Buka rincian perhitungan pada kartu tugas bila ingin melihat asal skornya.',
          });
        }
      }

      return items;
    })();

  /*
   * The task the "r2-impossible" banner is about, so its "Pecah tugas" button
   * opens the panel for that exact task rather than making the reader hunt for
   * the row. Derived from the same warnings, so it cannot point elsewhere.
   */
  const impossibleTaskId =
    currentResult.warnings.find((w) => w.code === 'r2_no_candidate' && w.detail?.exceedsCapAlone)
      ?.taskId ?? null;

  /*
   * T-UI-MATRIX-01: everything the dashboard shows is derived here, once, from
   * `currentResult`. The summary counts, the task cards and the matrix all read
   * these same objects, so the three views cannot disagree.
   */
  const summary = summarise(currentResult, members, tasks);

  const taskCards: TaskCardData[] = rows.map(({ task, assignment }) => {
    const owner = assignment.primaryMemberId ? memberById.get(assignment.primaryMemberId) : undefined;
    const ownerScore = assignment.primaryMemberId
      ? (assignment.scores[assignment.primaryMemberId]?.breakdown.total ?? null)
      : null;

    /*
     * An alternative only counts when the engine nominated one AND that member
     * is actually eligible. R3 fallback can nominate a member who does not meet
     * the rule; calling that a valid alternative would be the fake
     * recommendation the rules forbid.
     */
    const altId = assignment.alternativeMemberId;
    const altScore = altId ? assignment.scores[altId] : undefined;
    const altIsValid = Boolean(altId && altScore?.isEligible);

    const ownerBreakdown = assignment.primaryMemberId
      ? assignment.scores[assignment.primaryMemberId]?.breakdown
      : undefined;
    /*
     * T-UI-FINAL-01: the sentence a student would say. It is assembled from the
     * engine's own breakdown and from `matchingSkills`, the same helper the
     * engine's explanation uses, so the named abilities are exactly the ones that
     * cleared the R3 floor. No owner, no sentence: an unassigned task gets the
     * explanation the card already writes, never a fabricated recommendation.
     *
     * An ineligible R3 fallback gets no praise either: "paling sesuai" would be a
     * claim about abilities that did not meet the minimum.
     */
    const ownerReason =
      owner && ownerBreakdown && assignment.scores[owner.id]?.isEligible
        ? assignmentReason({
            memberName: owner.name,
            matchedSkills: matchingSkills(task, owner),
            requiredSkills: task.required_skills,
            score: ownerBreakdown.total,
          })
        : owner && ownerBreakdown
          ? `Saran terbaik saat ini adalah ${owner.name}, tetapi belum ada anggota yang memenuhi kemampuan minimum untuk tugas ini. Skor kecocokan ${Math.round(
              ownerBreakdown.total * 100
            )}%.`
          : null;

    return {
      task,
      ownerName: owner?.name ?? null,
      ownerScore,
      // The engine's own verdict, so the card can label an R3 fallback owner.
      ownerIsEligible: assignment.primaryMemberId
        ? (assignment.scores[assignment.primaryMemberId]?.isEligible ?? null)
        : null,
      ownerReason,
      alternativeName: altIsValid ? (memberById.get(altId!)?.name ?? null) : null,
      alternativeScore: altIsValid ? (altScore?.breakdown.total ?? null) : null,
      warnings: currentResult.warnings.filter((w) => w.taskId === task.id),
    };
  });

  const capHours = currentResult.idealLoad * WORKLOAD_CAP_MULTIPLIER;

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
                return (
                  <RevealItem as="li" key={member.id} className="space-y-1">
                    <MemberLoadRow
                      name={member.name}
                      load={load}
                      capacity={member.capacity}
                      capHours={capHours}
                    />
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

        {/* T-UI-FINAL-01: the heading names the outcome, and the sentence under it
            says what the system actually weighed. The technical basis (ideal load,
            1,25) is not repeated here — it lives in each card's disclosure, where
            someone asking "how" will look for it. */}
        <section className="min-w-0 flex-1" aria-label="Hasil pembagian tugas">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div className="space-y-1.5">
              <Eyebrow>FR-08 · FR-09 · FR-11 · FR-18</Eyebrow>
              <h1 className="display text-[clamp(1.65rem,2.6vw,2.15rem)] text-ink">
                Hasil Pembagian Tugas
              </h1>
              <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-muted">
                Sistem menganalisis kemampuan, minat, dan kapasitas anggota untuk memberikan
                rekomendasi pembagian tugas yang lebih terukur.
              </p>
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

          {/* T-UI-MATRIX-01 point 1: the four counts and the two load figures a
              student needs before reading any detail. Every value comes from
              `summarise(currentResult)`, the same result the cards and the matrix
              render, so the three cannot disagree. */}
          <ResultSummary summary={summary} />

          {/*
            T-UI-FINAL-01: these banners used to be four technical paragraphs that
            pushed the first task card below the fold. They still say exactly what
            the engine found — nothing is dropped — but each one leads with the
            outcome and keeps the rule code in the margin. The full rule text is in
            the per-card disclosure and in the list at the end of the summary view.
          */}
          {assignmentStatus.length > 0 && (
            <ul className="mt-3 space-y-2" data-testid="assignment-status">
              {assignmentStatus.map((s) => (
                <li
                  key={s.key}
                  data-testid={`status-${s.key}`}
                  className={`rounded-[var(--radius-input)] px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
                    s.tone === 'danger'
                      ? 'bg-danger-surface text-danger'
                      : s.tone === 'warn'
                        ? 'bg-warn-surface text-warn'
                        : 'bg-mist text-ink'
                  }`}
                >
                  <p className="font-semibold">
                    <span aria-hidden="true" className="mr-1.5 font-mono">
                      {s.tone === 'danger' ? '×' : s.tone === 'warn' ? '!' : '✓'}
                    </span>
                    {s.headline}
                  </p>
                  <p className="mt-1 leading-relaxed">{s.detail}</p>
                  {s.hint && <p className="mt-1 opacity-80">{s.hint}</p>}
                  {/* T-FIX-R2-02: when the problem is an oversized task, the
                      next step is to split it. The button opens the panel for the
                      task the banner is about, so the reader does not have to
                      find the row themselves. */}
                  {s.key === 'r2-impossible' && impossibleTaskId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSplitParentId(impossibleTaskId);
                        setSplitRows([{ hours: '' }, { hours: '' }]);
                        setSplitError(null);
                        setDetailTaskId(impossibleTaskId);
                      }}
                      className="mt-2 rounded-full bg-card px-2.5 py-1 text-[11.5px] font-semibold text-danger shadow-[inset_0_0_0_1px_var(--danger)] transition-colors duration-200 hover:bg-danger-surface"
                    >
                      Pecah tugas
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* T-UI-MATRIX-01 point 6: one switch between the two views. Both read
              `currentResult`, so this is a change of presentation only. Labels
              name what each view is for, and the counts keep the reader oriented
              while the body below swaps. */}
          <div
            className="mb-2 mt-2 flex flex-wrap items-center gap-1.5"
            role="tablist"
            aria-label="Pilih tampilan hasil"
          >
            {(
              [
                { key: 'ringkasan' as const, label: 'Ringkasan hasil', hint: `${rows.length} kartu` },
                { key: 'matriks' as const, label: 'Matriks lengkap', hint: 'semua perhitungan' },
              ]
            ).map((tab) => {
              const active = view === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`view-${tab.key}`}
                  id={`tab-${tab.key}`}
                  data-testid={`view-tab-${tab.key}`}
                  onClick={() => setView(tab.key)}
                  className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-[11.5px] font-medium transition-colors duration-200 max-sm:min-h-[44px] ${
                    active
                      ? 'bg-ink text-paper'
                      : 'bg-card text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:shadow-[inset_0_0_0_1px_var(--ink)]'
                  }`}
                >
                  {tab.label}
                  <span className={`font-mono text-[10px] tabular-nums ${active ? 'text-paper/70' : 'text-muted'}`} data-numeric>
                    {tab.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ---- View: ringkasan hasil (default) ---- */}
          {view === 'ringkasan' && (
            <div id="view-ringkasan" role="tabpanel" aria-labelledby="tab-ringkasan" className="mt-3 space-y-3">
              {/* Point 8: every member's load, against the R2 cap, on this view. */}
              <section className="glass-solid rounded-[var(--radius-card)] p-4 sm:p-5" data-testid="member-load-summary">
                <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-2">
                  <h2 className="heading text-[14px] text-ink">Beban anggota</h2>
                  <span className="font-mono text-[11px] tabular-nums text-muted" data-numeric>
                    batas beban {capHours.toFixed(2)} jam per anggota
                  </span>
                </header>
                <ul className="grid gap-x-6 gap-y-3.5 pt-3 sm:grid-cols-2 xl:grid-cols-3">
                  {members.map((member) => (
                    <li key={member.id}>
                      <MemberLoadRow
                        name={member.name}
                        load={currentResult.memberLoads[member.id] ?? 0}
                        capacity={member.capacity}
                        capHours={capHours}
                      />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-line pt-2.5 text-[11px] leading-relaxed text-muted">
                  Beban = jumlah estimasi jam tugas yang ditugaskan ke anggota. Angka setelah
                  &ldquo;tersedia&rdquo; adalah kapasitas jam anggota, bukan beban yang sudah dipakai.
                  Anggota dengan jam tersedia 0 tidak ikut dibagi.
                </p>
              </section>

              <h2 className="pt-1 text-[14px] font-semibold text-ink">Hasil pembagian per tugas</h2>

              {/* Points 2 and 7: one card per task, owner named only when the
                  engine assigned one, with a plain-language reason when it did. */}
              <div className="grid gap-3 xl:grid-cols-2">
              {taskCards.map((card) => {
                const assignment = byTaskId.get(card.task.id);
                const ownerId = assignment?.primaryMemberId ?? '';
                const ownerBreakdown = ownerId ? assignment?.scores[ownerId]?.breakdown : undefined;
                return (
                  <TaskRecommendationCard
                    key={card.task.id}
                    data={card}
                    capHours={capHours}
                    idealLoad={currentResult.idealLoad}
                    onAccept={
                      ownerId
                        ? () =>
                            applyOwnerChange(card.task.id, ownerId, {
                              lock: false,
                              label: 'Terima rekomendasi',
                              event: 'recommendation_accepted',
                            })
                        : undefined
                    }
                    onSplit={() => {
                      setSplitParentId(card.task.id);
                      setSplitRows([{ hours: '' }, { hours: '' }]);
                      setSplitError(null);
                      setDetailTaskId(card.task.id);
                    }}
                    onLock={
                      assignment
                        ? () => {
                            toggleLock(card.task.id);
                          }
                        : undefined
                    }
                    onMove={() => setDetailTaskId(card.task.id)}
                  >
                    {/* The K/S/C/M arithmetic and the rule text, folded away
                        until asked for. This is the academic block the ticket
                        requires to stay available. */}
                    {ownerBreakdown && (
                      <ScoreDetail
                        breakdown={ownerBreakdown}
                        weights={weights}
                        isFallback={isFallback}
                        memberName={memberById.get(ownerId)?.name ?? ''}
                        idealLoad={currentResult.idealLoad}
                        capHours={capHours}
                      />
                    )}
                  </TaskRecommendationCard>
                );
              })}
              </div>

              {/*
                The five rules in user language, once, at the bottom of the
                summary. They are reference material for the demonstration, not
                the message of the page, so they come after the results and can be
                folded away. The code stays visible so a reader can map each
                sentence back to the PRD.
              */}
              <details className="glass-solid rounded-[var(--radius-card)] px-4 py-3 sm:px-5">
                <summary className="cursor-pointer text-[13px] font-medium text-ink">
                  Aturan yang dipakai sistem (R1–R5)
                </summary>
                <dl className="mt-2.5 space-y-1.5">
                  {(Object.keys(RULE_PLAIN) as Array<keyof typeof RULE_PLAIN>).map((code) => (
                    <div key={code} className="flex gap-2 text-[12px] leading-relaxed">
                      <dt className="w-8 shrink-0 font-mono text-[11px] font-semibold text-muted">
                        {code}
                      </dt>
                      <dd className="text-ink">{RULE_PLAIN[code]}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </div>
          )}

          {/* ---- View: matriks lengkap ---- */}
          {view === 'matriks' && (
            <div id="view-matriks" role="tabpanel" aria-labelledby="tab-matriks">
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
                  {/* T-FIX-R2-02 point 1: the member columns are labelled for what
                      they hold (a comparison score) and the action column for the
                      decision (eligibility and owner), so a high percentage is not
                      read as an appointment. */}
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
                        {member.capacity} jam · skor kecocokan
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
                    Status kelayakan · penanggung jawab
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
                          {/* T-FIX-MATRIX-01 point 11: the row states the numbers
                              behind an unassigned task (effort, ideal load, R2 cap)
                              instead of the vague badge "R2: semua gugur", which
                              told the reader nothing they could act on. */}
                          {currentResult.warnings
                            .filter((w) => w.taskId === task.id)
                            .map((w, i) => (
                              <p
                                key={i}
                                className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9.5px] font-medium ${
                                  w.code === 'r2_locked_overload' || w.detail?.exceedsCapAlone
                                    ? 'bg-danger-surface text-danger'
                                    : 'bg-warn-surface text-warn'
                                }`}
                                title={w.message}
                                data-testid={`${w.code}-${task.id}`}
                              >
                                <span aria-hidden="true">{w.code === 'r2_locked_overload' ? '⚠' : '▲'}</span>
                                {w.code === 'r2_no_candidate'
                                  ? w.detail
                                    ? `R2: usaha ${w.detail.taskHours} jam > batas ${w.detail.capHours.toFixed(2)} jam`
                                    : 'R2: tidak ada kandidat'
                                  : w.code === 'r3_no_candidate'
                                    ? 'R3: tidak ada kandidat'
                                    : 'R2: beban berlebih'}
                              </p>
                            ))}
                          {currentResult.warnings.some((w) => w.taskId === task.id && w.detail) && (
                            <p className="text-[10px] leading-snug tabular-nums text-muted" data-numeric>
                              Beban ideal {currentResult.idealLoad.toFixed(2)} jam · batas R2{' '}
                              {(currentResult.idealLoad * WORKLOAD_CAP_MULTIPLIER).toFixed(2)} jam
                            </p>
                          )}
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
                        /*
                         * Name the rule that excluded this member instead of a
                         * bare "gugur". The warnings carry the rule prefix, so
                         * the cell stays consistent with the panel below it and
                         * the reader never has to guess why a score is greyed
                         * out. R1 wins when several rules apply, because it runs
                         * first and makes the others moot.
                         */
                        const rule = (score?.warnings ?? [])
                          .map((w) => w.match(/^(R[1-5])/)?.[1])
                          .find((r): r is string => Boolean(r));
                        /*
                         * One shared status per member (T-FIX-MATRIX-01 point 10):
                         * valid candidate, valid alternative, or excluded by R1,
                         * R2 or R3. Calling every non-owner "kandidat" hid the
                         * difference between a usable alternative and a member
                         * the rules had already removed.
                         */
                        const cellStatus = candidateStatus({
                          isPrimary,
                          isAlternative: false,
                          isEligible: Boolean(score?.isEligible),
                          rule,
                        });
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
                                    : `tidak memenuhi aturan${score?.warnings?.length ? `, ${score.warnings.join(' ')}` : ''}`
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
                              <span
                                className={`text-[9px] uppercase tracking-[0.06em] ${
                                  isPrimary ? 'font-semibold tracking-[0.08em] text-[var(--accent-strong)]' : ''
                                }`}
                              >
                                {candidateStatusLabel(cellStatus)}
                              </span>
                              {/*
                                T-FIX-R2-02 point 4: the reason lives on the
                                member's own row, not only in the panel below.
                                The text is the engine's warning verbatim, so the
                                cell cannot claim a different cause than the one
                                that actually excluded this member.
                              */}
                              {score && !score.isEligible && (score.warnings ?? []).length > 0 && (
                                <span
                                  className="block max-w-[13ch] text-[8.5px] leading-tight normal-case tracking-normal"
                                  data-testid={`reason-${task.id}-${member.id}`}
                                >
                                  {(score.warnings ?? [])[0]}
                                </span>
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

                            {/*
                              T-FIX-R2-02: splitting is offered on every row, not
                              only on infeasible ones. A task that is merely
                              awkward to place (or that the user simply wants to
                              break up) can be divided from here.
                            */}
                            <button
                              type="button"
                              data-testid={`split-${task.id}`}
                              onClick={() => {
                                setSplitParentId(task.id);
                                setSplitRows([{ hours: '' }, { hours: '' }]);
                                setSplitError(null);
                                setDetailTaskId(task.id);
                              }}
                              aria-expanded={splitParentId === task.id}
                              className="inline-flex h-7 items-center rounded-full bg-card px-2 text-[10px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-200 hover:shadow-[inset_0_0_0_1px_var(--ink)]"
                            >
                              Pecah
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

                    {/* The chart answers "who fits this task and why" in one
                        glance, before the written detail below. Every number is
                        the engine's breakdown; nothing is recomputed here. */}
                    <CandidateScoreChart
                      rows={members
                        .map((m) => {
                          const s = assignment.scores[m.id];
                          if (!s) return null;
                          const rule = (s.warnings ?? [])
                            .map((w) => w.match(/^(R[1-5])/)?.[1])
                            .find((r): r is string => Boolean(r));
                          return {
                            memberId: m.id,
                            name: m.name,
                            K: s.breakdown.K,
                            S: s.breakdown.S,
                            C: s.breakdown.C,
                            M: s.breakdown.M,
                            total: s.breakdown.total,
                            isPrimary: assignment.primaryMemberId === m.id,
                            isAlternative: assignment.alternativeMemberId === m.id,
                            isEligible: s.isEligible,
                            rule,
                          };
                        })
                        .filter((r): r is NonNullable<typeof r> => r !== null)}
                      components={chartComponents}
                      isFallback={isFallback}
                      idealLoad={currentResult.idealLoad}
                      capHours={currentResult.idealLoad * WORKLOAD_CAP_MULTIPLIER}
                    />

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

          {/*
            T-FIX-R2-02 point 3: "Pecah tugas".
            The user picks how the hours are divided; nothing is divided for
            them. The total must match the parent effort exactly or the split is
            refused, because changing the total would change the workload every
            score is built on. This reuses the existing task POST, so no
            hierarchy was added to the schema or the engine.
          */}
          {splitParentId && taskById.get(splitParentId) && (() => {
            const parent = taskById.get(splitParentId)!;
            const validation = validateSplit(splitRows, parent.estimated_hours);
            return (
              <section
                data-testid="split-panel"
                className="mt-2 rounded-[var(--radius-card)] bg-card p-4 shadow-[inset_0_0_0_1px_var(--line)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                  <h2 className="heading text-[14px] text-ink">Pecah tugas: {parent.title}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setSplitParentId(null);
                      setSplitError(null);
                    }}
                    className="rounded-full px-2 py-0.5 text-[11px] text-muted transition-colors duration-200 hover:bg-mist hover:text-ink"
                  >
                    Tutup
                  </button>
                </div>

                <p className="pt-2 text-[11.5px] leading-relaxed text-muted">
                  Estimasi tugas induk <span className="font-mono tabular-nums text-ink" data-numeric>{parent.estimated_hours} jam</span>.
                  Tentukan sendiri pembagian jamnya. Total semua bagian harus tepat{' '}
                  {parent.estimated_hours} jam; sistem tidak menambah atau mengurangi jam untuk Anda.
                  Setiap bagian disimpan sebagai tugas biasa dengan judul, deskripsi, dan skill yang
                  sama seperti induk. Setelah semua bagian tersimpan, tugas induk dihapus agar jamnya
                  tidak terhitung dua kali, lalu setiap bagian dinilai ulang terhadap R2 dan R3.
                </p>

                <ul className="space-y-1.5 pt-2">
                  {splitRows.map((row, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-[11.5px] text-muted">Bagian {index + 1}</span>
                      <input
                        type="number"
                        min={1}
                        max={parent.estimated_hours - 1}
                        step={1}
                        value={row.hours}
                        aria-label={`Estimasi jam bagian ${index + 1}`}
                        aria-invalid={validation.rowErrors[index] ? true : undefined}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSplitRows((prev) =>
                            prev.map((r, i) => (i === index ? { hours: value } : r))
                          );
                          setSplitError(null);
                        }}
                        className="h-8 w-24 rounded-lg bg-card px-2 font-mono text-[12px] tabular-nums text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                        data-numeric
                      />
                      <span className="text-[11px] text-muted">jam</span>
                      {validation.rowErrors[index] && (
                        <span className="text-[11px] text-danger">{validation.rowErrors[index]}</span>
                      )}
                      {splitRows.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setSplitRows((prev) => prev.filter((_, i) => i !== index))}
                          className="rounded-full px-2 py-0.5 text-[11px] text-muted hover:bg-mist hover:text-ink"
                        >
                          Hapus bagian
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                <p className="pt-2 font-mono text-[11px] tabular-nums text-muted" data-numeric>
                  Total {validation.total} jam ·{' '}
                  {validation.remaining === 0
                    ? 'sama dengan estimasi induk'
                    : validation.remaining > 0
                      ? `kurang ${validation.remaining} jam dari induk`
                      : `lebih ${Math.abs(validation.remaining)} jam dari induk`}
                </p>

                {splitError && (
                  <p role="alert" className="pt-1 text-[11.5px] font-medium text-danger">
                    {splitError}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSplitRows((prev) => [...prev, { hours: '' }])}
                  >
                    Tambah bagian
                  </Button>
                  <Button
                    type="button"
                    variant="solid"
                    size="sm"
                    disabled={!validation.ok || splitSubmitting}
                    onClick={submitSplit}
                  >
                    {splitSubmitting ? 'Membuat subtugas…' : 'Buat subtugas'}
                  </Button>
                </div>
              </section>
            );
          })()}
            </div>
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

