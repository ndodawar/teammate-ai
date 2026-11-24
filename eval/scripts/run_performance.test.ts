/**
 * Performance (L) — bagian KOMPUTASI (in-process, tanpa jaringan).
 *
 * Mengukur:
 *   - pipeline no-AI: globalAssign atas skenario D2 (engine murni).
 *   - what-if: menukar/menugaskan ulang satu tugas + globalAssign ulang.
 *   - slider recompute: computeScore untuk seluruh pasangan task×member (inti
 *     kerja slider what-if lokal).
 *
 * Setiap metrik diulang `EVAL_CONFIG.perfIterations` kali; dilaporkan
 * min/median/P95/max/n — BUKAN satu hasil terbaik.
 *
 * Waktu jaringan/DB/render diukur terpisah (browser) dan dicatat di laporan L;
 * angka di sini murni komputasi algoritma.
 */

import { it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { D2_SCENARIOS } from '@/eval/datasets/d2_scenarios';
import { Member, Task } from '@/lib/scoring/types';
import { globalAssign } from '@/lib/scoring/assign';
import { computeScore } from '@/lib/scoring/score';
import { assignOwner, swapOwners } from '@/lib/scoring/interaction';
import { EVAL_CONFIG } from '@/eval/lib/config';

interface Stats { n: number; min: number; median: number; p95: number; max: number; mean: number }

function stats(samples: number[]): Stats {
  const s = [...samples].sort((a, b) => a - b);
  const n = s.length;
  const at = (q: number) => s[Math.min(n - 1, Math.floor(q * (n - 1)))];
  const mean = s.reduce((a, b) => a + b, 0) / n;
  return { n, min: Number(s[0].toFixed(3)), median: Number(at(0.5).toFixed(3)), p95: Number(at(0.95).toFixed(3)), max: Number(s[n - 1].toFixed(3)), mean: Number(mean.toFixed(3)) };
}

function engineMembers(sc: (typeof D2_SCENARIOS)[number]): Member[] {
  return sc.members.map((m) => ({ id: m.id, name: m.name, skills: m.skills, interests: m.interests, capacity: m.capacity }));
}
function engineTasks(sc: (typeof D2_SCENARIOS)[number]): Task[] {
  return sc.tasks.map((t) => ({ id: t.id, title: t.title, description: t.description, difficulty: t.difficulty, estimated_hours: t.estimated_hours, required_skills: t.required_skills }));
}

function timed(fn: () => void): number {
  const t = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - t) / 1e6; // ms
}

it('L: performa komputasi (min/median/P95/max, banyak iterasi)', () => {
  const N = EVAL_CONFIG.perfIterations;

  // ---- 1. pipeline no-AI (globalAssign) atas semua skenario D2 bersambung ----
  const assignmentsPipeline: number[] = [];
  for (let i = 0; i < N; i++) {
    const ms = timed(() => {
      for (const sc of D2_SCENARIOS) globalAssign(engineTasks(sc), engineMembers(sc), [], { isFallback: true });
    });
    assignmentsPipeline.push(ms);
  }
  const pipelineAll20 = stats(assignmentsPipeline);

  // Satu skenario (perkiraan baseline tunggal)
  const sc0 = D2_SCENARIOS[0];
  const perScenario: number[] = [];
  for (let i = 0; i < N; i++) perScenario.push(timed(() => globalAssign(engineTasks(sc0), engineMembers(sc0), [], { isFallback: true })));
  const pipelineOne = stats(perScenario);

  // ---- 2. what-if: assignOwner + globalAssign ulang ----
  const whatIf: number[] = [];
  for (let i = 0; i < N; i++) {
    const sc = D2_SCENARIOS[i % D2_SCENARIOS.length];
    const members = engineMembers(sc);
    const tasks = engineTasks(sc);
    const base = globalAssign(tasks, members, [], { isFallback: true });
    const existing = base.assignments.map((a) => ({ taskId: a.taskId, primaryMemberId: a.primaryMemberId, alternativeMemberId: a.alternativeMemberId, isLocked: a.isLocked, scores: a.scores }));
    const ms = timed(() => {
      const target = existing[0];
      const other = members.find((m) => m.id !== target.primaryMemberId)!;
      const changed = assignOwner(existing, target.taskId, other.id, { lock: false, tasks, members });
      globalAssign(tasks, members, changed.next, { isFallback: true });
    });
    whatIf.push(ms);
  }
  const whatIfStats = stats(whatIf);

  // ---- 3. slider recompute: computeScore seluruh pasangan task×member ----
  const slider: number[] = [];
  for (let i = 0; i < N; i++) {
    const sc = D2_SCENARIOS[i % D2_SCENARIOS.length];
    const members = engineMembers(sc);
    const tasks = engineTasks(sc);
    const ideal = tasks.reduce((a, t) => a + t.estimated_hours, 0) / members.length;
    const ms = timed(() => {
      for (const t of tasks) for (const m of members) computeScore(t, m, 0, ideal, 0.5, { K: 0.4, S: 0.3, C: 0.2, M: 0.1 }, false);
    });
    slider.push(ms);
  }
  const sliderStats = stats(slider);

  // ---- 4. swap (what-if alternatif) ----
  const swap: number[] = [];
  for (let i = 0; i < N; i++) {
    const sc = D2_SCENARIOS[i % D2_SCENARIOS.length];
    const members = engineMembers(sc);
    const tasks = engineTasks(sc);
    const base = globalAssign(tasks, members, [], { isFallback: true });
    const existing = base.assignments.map((a) => ({ taskId: a.taskId, primaryMemberId: a.primaryMemberId, alternativeMemberId: a.alternativeMemberId, isLocked: false, scores: a.scores }));
    swap.push(timed(() => { if (existing.length >= 2) swapOwners(existing, existing[0].taskId, existing[1].taskId, { tasks, members }); }));
  }
  const swapStats = stats(swap);

  const out = {
    config: { iterations: N, scenarios: D2_SCENARIOS.length },
    note: 'Durasi KOMPUTASI murni in-process (ms). Jaringan/DB/render diukur terpisah.',
    pipelineAll20Scenarios: pipelineAll20,
    pipelineOneScenario: pipelineOne,
    whatIf: whatIfStats,
    sliderRecompute: sliderStats,
    swap: swapStats,
  };
  mkdirSync('eval/results', { recursive: true });
  writeFileSync(join('eval/results', 'performance.json'), JSON.stringify(out, null, 2));

  // Target PRD: pipeline < 1000ms, slider < 100ms, what-if < 100ms.
  expect(pipelineAll20.p95).toBeLessThan(1000);
  expect(whatIfStats.p95).toBeLessThan(100);
  expect(sliderStats.p95).toBeLessThan(100);
});
