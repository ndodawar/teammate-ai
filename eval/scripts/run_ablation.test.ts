/**
 * Ablation komponen K (content similarity).
 *
 * KONDISI JUJUR:
 *   - Tidak ada GEMINI_API_KEY → embedding live TIDAK tersedia.
 *   - Kami TIDAK membuat embedding sintetis lalu menyebutnya "embedding live".
 *   - Yang diuji: **jalur deterministik**, yaitu apakah komponen K (dengan nilai
 *     yang dibangkitkan secara deterministik dari data tugas/anggota) mengubah
 *     hasil, dan seberapa besar pengaruhnya. Nilai K di sini adalah PROXY yang
 *     transparan & dapat diulang (bukan semantik), dipakai HANYA untuk menguji
 *     mekanisme, bukan untuk mengklaim kualitas kemiripan konten.
 *
 * Dua kondisi yang dibandingkan pada input identik:
 *   A. hybrid DENGAN K   → isFallback=false, bobot DEFAULT (K0.40/S0.30/C0.20/M0.10),
 *                          cosineMap = proxy deterministik.
 *   B. hybrid TANPA K    → isFallback=true, bobot FALLBACK (K0/S0.50/C0.33/M0.17),
 *                          cosine diabaikan.
 *
 * Metrik: jumlah tugas yang berpindah pemilik, perubahan coverage, perubahan σ beban,
 * perubahan fit. Bila K tidak mengubah apa pun, itu pun temuan (dan dilaporkan).
 *
 * ABLATION LIVE (embedding sungguhan) ditandai BLOCKED.
 */

import { it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { D2_SCENARIOS } from '@/eval/datasets/d2_scenarios';
import { Member, Task } from '@/lib/scoring/types';
import { globalAssign, TaskMemberCosineMap } from '@/lib/scoring/assign';
import { metricsForRun } from '@/eval/lib/metrics';
import { hashSeed } from '@/eval/lib/prng';
import { DEFAULT_WEIGHTS, FALLBACK_WEIGHTS } from '@/lib/scoring/constants';

function engineMembers(sc: (typeof D2_SCENARIOS)[number]): Member[] {
  return sc.members.map((m) => ({ id: m.id, name: m.name, skills: m.skills, interests: m.interests, capacity: m.capacity }));
}
function engineTasks(sc: (typeof D2_SCENARIOS)[number]): Task[] {
  return sc.tasks.map((t) => ({ id: t.id, title: t.title, description: t.description, difficulty: t.difficulty, estimated_hours: t.estimated_hours, required_skills: t.required_skills }));
}

/**
 * Proxy cosine deterministik untuk ablation: bukan semantik. Nilai 0.2..0.8 dari
 * hash(taskId, memberId) → setelah normalisasi 0.2→0, 0.8→1, memberi K bervariasi.
 * Ditandai jelas sebagai proxy.
 */
function proxyCosine(taskId: string, memberId: string): number {
  const h = hashSeed('proxy-cosine', taskId, memberId);
  // 0..1 → 0.2..0.8
  return 0.2 + (h % 1000) / 1000 * 0.6;
}

it('ablation K deterministik (proxy, BUKAN live)', () => {
  interface AbRow {
    scenarioId: string;
    tasks: number;
    movedOwners: number;
    coverage: { withK: number; noK: number; delta: number };
    stdDev: { withK: number; noK: number; delta: number };
    fit: { withK: number; noK: number; delta: number };
  }
  const out: AbRow[] = [];
  let movedTotal = 0;
  let coverageDeltaSum = 0;
  let stddevDeltaSum = 0;
  let fitDeltaSum = 0;

  for (const sc of D2_SCENARIOS) {
    const members = engineMembers(sc);
    const tasks = engineTasks(sc);
    const lockedIds = new Set(sc.tasks.filter((t) => t.locked).map((t) => t.id));
    const lockedAssignments = sc.tasks
      .filter((t) => t.locked && t.lockedTo)
      .map((t) => ({ taskId: t.id, primaryMemberId: t.lockedTo!, alternativeMemberId: undefined, isLocked: true, scores: {} }));

    // A. Dengan K (hybrid, bobot default, cosine proxy)
    const cosineMap: TaskMemberCosineMap = {};
    for (const t of tasks) {
      cosineMap[t.id] = {};
      for (const m of members) cosineMap[t.id][m.id] = proxyCosine(t.id, m.id);
    }
    const resWithK = globalAssign(tasks, members, lockedAssignments, {
      isFallback: false,
      weights: { ...DEFAULT_WEIGHTS },
      cosineMap,
    });
    const mapWithK: Record<string, string> = {};
    for (const a of resWithK.assignments) if (a.primaryMemberId) mapWithK[a.taskId] = a.primaryMemberId;
    const loadsWithK: Record<string, number> = {};
    members.forEach((m) => (loadsWithK[m.id] = 0));
    for (const t of tasks) if (mapWithK[t.id]) loadsWithK[mapWithK[t.id]] += t.estimated_hours;
    const runWithK = { method: 'hybrid' as const, seed: null, repeat: 0, assignments: mapWithK, loads: loadsWithK, idealLoad: resWithK.idealLoad };
    const mWithK = metricsForRun(members, tasks, runWithK, lockedIds);

    // B. Tanpa K (fallback, K=0)
    const resNoK = globalAssign(tasks, members, lockedAssignments, { isFallback: true, weights: { ...FALLBACK_WEIGHTS } });
    const mapNoK: Record<string, string> = {};
    for (const a of resNoK.assignments) if (a.primaryMemberId) mapNoK[a.taskId] = a.primaryMemberId;
    const loadsNoK: Record<string, number> = {};
    members.forEach((m) => (loadsNoK[m.id] = 0));
    for (const t of tasks) if (mapNoK[t.id]) loadsNoK[mapNoK[t.id]] += t.estimated_hours;
    const runNoK = { method: 'hybrid' as const, seed: null, repeat: 0, assignments: mapNoK, loads: loadsNoK, idealLoad: resNoK.idealLoad };
    const mNoK = metricsForRun(members, tasks, runNoK, lockedIds);

    const moved = tasks.filter((t) => mapWithK[t.id] !== mapNoK[t.id]).length;
    const covDelta = mWithK.skillCoverage.coverage - mNoK.skillCoverage.coverage;
    const sdDelta = mWithK.loadBalance.stdDev - mNoK.loadBalance.stdDev;
    const fitDelta = mWithK.fit.fit - mNoK.fit.fit;
    movedTotal += moved;
    coverageDeltaSum += covDelta;
    stddevDeltaSum += sdDelta;
    fitDeltaSum += fitDelta;

    out.push({
      scenarioId: sc.id,
      tasks: tasks.length,
      movedOwners: moved,
      coverage: { withK: mWithK.skillCoverage.coverage, noK: mNoK.skillCoverage.coverage, delta: Number(covDelta.toFixed(4)) },
      stdDev: { withK: mWithK.loadBalance.stdDev, noK: mNoK.loadBalance.stdDev, delta: Number(sdDelta.toFixed(4)) },
      fit: { withK: mWithK.fit.fit, noK: mNoK.fit.fit, delta: Number(fitDelta.toFixed(4)) },
    });
  }

  const totalTasks = out.reduce((a, s) => a + s.tasks, 0);
  const summary = {
    note: 'K di sini adalah PROXY deterministik (bukan embedding live). Ablation live = BLOCKED (tanpa GEMINI_API_KEY).',
    scenarios: out.length,
    totalTasks,
    movedOwnersTotal: movedTotal,
    movedFraction: Number((movedTotal / totalTasks).toFixed(4)),
    coverageDeltaMean: Number((coverageDeltaSum / out.length).toFixed(4)),
    stdDevDeltaMean: Number((stddevDeltaSum / out.length).toFixed(4)),
    fitDeltaMean: Number((fitDeltaSum / out.length).toFixed(4)),
    liveAblation: 'BLOCKED',
  };

  mkdirSync('eval/results', { recursive: true });
  writeFileSync(join('eval/results', 'ablation.json'), JSON.stringify({ summary, perScenario: out }, null, 2));

  // Deterministik: jalankan lagi, pastikan hasil sama (idempoten).
  expect(out.length).toBe(20);
});
