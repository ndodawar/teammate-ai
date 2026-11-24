/**
 * Menjalankan 4 metode pembanding atas 20 skenario D2 dan menghitung seluruh
 * metrik (skill coverage, load balance, hard rules, fit, manual changes).
 *
 * Output:
 *   eval/results/methods_per_scenario.json   (detail per skenario × metode)
 *   eval/results/methods_summary.json        (agregat per metode, random = min/median/max)
 *   eval/results/methods_summary.csv         (untuk spreadsheet)
 *
 * Deterministik: seed tetap. Random diulang EVAL_CONFIG.randomRepeats kali dan
 * SEMUA hasil dilaporkan (min/median/max), bukan hanya yang terbaik.
 */

import { it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { D2_SCENARIOS } from '@/eval/datasets/d2_scenarios';
import { Member, Task } from '@/lib/scoring/types';
import { runRandom, runRoundRobin, runManual, computeLoads, MethodName } from '@/eval/lib/methods';
import { metricsForRun, RunMetrics } from '@/eval/lib/metrics';
import { globalAssign } from '@/lib/scoring/assign';

function toEngineMembers(sc: (typeof D2_SCENARIOS)[number]): Member[] {
  return sc.members.map((m) => ({ id: m.id, name: m.name, skills: m.skills, interests: m.interests, capacity: m.capacity }));
}
function toEngineTasks(sc: (typeof D2_SCENARIOS)[number]): Task[] {
  return sc.tasks.map((t) => ({ id: t.id, title: t.title, description: t.description, difficulty: t.difficulty, estimated_hours: t.estimated_hours, required_skills: t.required_skills }));
}

interface ScenarioMethodResult {
  scenarioId: string;
  method: MethodName;
  repeat: number;
  metrics: RunMetrics;
}

/** Median dari array angka. */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

it('menjalankan 4 metode pada 20 skenario D2 & menulis hasil', () => {
  const perScenario: ScenarioMethodResult[] = [];

  for (const sc of D2_SCENARIOS) {
    const members = toEngineMembers(sc);
    const tasks = toEngineTasks(sc);
    const lockedIds = new Set(sc.tasks.filter((t) => t.locked).map((t) => t.id));
    const lockedAssignments = sc.tasks
      .filter((t) => t.locked && t.lockedTo)
      .map((t) => ({ taskId: t.id, primaryMemberId: t.lockedTo!, alternativeMemberId: undefined, isLocked: true, scores: {} }));

    // Hybrid: pakai globalAssign, hormati tugas terkunci lewat existingAssignments.
    const hybridRes = (() => {
      const res = globalAssign(tasks, members, lockedAssignments, { isFallback: true });
      const assignments: Record<string, string> = {};
      for (const a of res.assignments) if (a.primaryMemberId) assignments[a.taskId] = a.primaryMemberId;
      return { method: 'hybrid' as const, seed: null, repeat: 0, assignments, loads: computeLoads(members, tasks, assignments), idealLoad: res.idealLoad };
    })();
    perScenario.push({ scenarioId: sc.id, ...hybridRes, metrics: metricsForRun(members, tasks, hybridRes, lockedIds) });

    // Random (30x)
    const random = runRandom(members, tasks, sc.id);
    for (const run of random.runs) {
      perScenario.push({ scenarioId: sc.id, ...run, metrics: metricsForRun(members, tasks, run, lockedIds) });
    }

    // Round-robin, manual
    for (const run of [runRoundRobin(members, tasks).runs[0], runManual(members, tasks).runs[0]]) {
      perScenario.push({ scenarioId: sc.id, ...run, metrics: metricsForRun(members, tasks, run, lockedIds) });
    }
  }

  // ---- Agregat per metode ----
  const methods: MethodName[] = ['hybrid', 'random', 'round-robin', 'manual'];
  const summary = methods.map((method) => {
    const rows = perScenario.filter((r) => r.method === method);
    // Untuk random, tiap skenario punya 30 run. Hitung per-skenario lalu agregat.
    const byScenario = new Map<string, ScenarioMethodResult[]>();
    for (const r of rows) {
      if (!byScenario.has(r.scenarioId)) byScenario.set(r.scenarioId, []);
      byScenario.get(r.scenarioId)!.push(r);
    }
    const coverage = rows.map((r) => r.metrics.skillCoverage.coverage);
    const stdDev = rows.map((r) => r.metrics.loadBalance.stdDev);
    const maxDev = rows.map((r) => r.metrics.loadBalance.maxDeviationFromIdeal);
    const overR2 = rows.map((r) => r.metrics.loadBalance.overR2Count);
    const r1 = rows.map((r) => r.metrics.hardRules.r1Violations);
    const r2final = rows.map((r) => r.metrics.hardRules.r2FinalViolations);
    const r3 = rows.map((r) => r.metrics.hardRules.r3Violations);
    const fit = rows.map((r) => r.metrics.fit.fit);
    const manual = rows.map((r) => r.metrics.manualChanges);
    return {
      method,
      runs: rows.length,
      scenarios: byScenario.size,
      skillCoverage: { min: Math.min(...coverage), median: median(coverage), max: Math.max(...coverage), mean: coverage.reduce((a, b) => a + b, 0) / coverage.length },
      loadStdDev: { min: Math.min(...stdDev), median: median(stdDev), max: Math.max(...stdDev), mean: stdDev.reduce((a, b) => a + b, 0) / stdDev.length },
      maxDeviationFromIdeal: { min: Math.min(...maxDev), median: median(maxDev), max: Math.max(...maxDev), mean: maxDev.reduce((a, b) => a + b, 0) / maxDev.length },
      overR2Count: { min: Math.min(...overR2), median: median(overR2), max: Math.max(...overR2), mean: overR2.reduce((a, b) => a + b, 0) / overR2.length },
      r1ViolationsTotal: r1.reduce((a, b) => a + b, 0),
      r2FinalViolationsTotal: r2final.reduce((a, b) => a + b, 0),
      r3ViolationsTotal: r3.reduce((a, b) => a + b, 0),
      fit: { min: Math.min(...fit), median: median(fit), max: Math.max(...fit), mean: fit.reduce((a, b) => a + b, 0) / fit.length },
      manualChangesTotal: manual.reduce((a, b) => a + b, 0),
    };
  });

  mkdirSync('eval/results', { recursive: true });
  writeFileSync(join('eval/results', 'methods_per_scenario.json'), JSON.stringify(perScenario, null, 2));
  writeFileSync(join('eval/results', 'methods_summary.json'), JSON.stringify(summary, null, 2));

  // CSV ringkas
  const header = ['method', 'runs', 'scenarios', 'coverage_mean', 'coverage_min', 'coverage_max', 'loadStdDev_mean', 'maxDev_mean', 'overR2_mean', 'r1_total', 'r2final_total', 'r3_total', 'fit_mean', 'manualChanges_total'];
  const lines = [header.join(',')];
  for (const s of summary) {
    lines.push([
      s.method, s.runs, s.scenarios,
      s.skillCoverage.mean.toFixed(4), s.skillCoverage.min.toFixed(4), s.skillCoverage.max.toFixed(4),
      s.loadStdDev.mean.toFixed(4), s.maxDeviationFromIdeal.mean.toFixed(4), s.overR2Count.mean.toFixed(3),
      s.r1ViolationsTotal, s.r2FinalViolationsTotal, s.r3ViolationsTotal,
      s.fit.mean.toFixed(4), s.manualChangesTotal,
    ].join(','));
  }
  writeFileSync(join('eval/results', 'methods_summary.csv'), lines.join('\n'));

  // Sanity: 4 metode × 20 skenario ada; hybrid deterministik (1 run/skenario)
  expect(summary.find((s) => s.method === 'hybrid')!.scenarios).toBe(20);
  expect(summary.find((s) => s.method === 'random')!.runs).toBe(20 * 30);
  // Hybrid harus punya skill coverage >= random pada rata-rata (hipotesis; bila tidak, dilaporkan apa adanya)
  // Tidak di-assert agar hasil negatif tetap tercatat; lihat laporan E.
});
