/**
 * Empat metode pembanding (PRD §8):
 *
 *   1. hybrid  — engine asli `globalAssign` (mode cadangan bila cos tidak ada).
 *   2. random  — greedy posisi acak dengan seed tetap; diulang N kali, semua
 *                hasil dilaporkan (bukan hanya yang terbaik).
 *   3. round-robin — urut tugas (effort desc, sama seperti engine) lalu gilir
 *                anggota dalam urutan tetap; dokumentasi urutan di bawah.
 *   4. manual  — aturan baseline transparan yang ditetapkan SEBELUM melihat hasil
 *                hybrid, dan tidak diubah sesudahnya. Ini baseline pembanding,
 *                BUKAN ground truth.
 *
 * Setiap metode mengembalikan bentuk yang sama (`MethodResult`) sehingga metrik
 * dapat dihitung seragam. Manual & round-robin sengaja TIDAK menghormati R1–R5
 * sepenuhnya — itu bagian dari pertanyaan evaluasi, bukan bug harness.
 */

import { Member, Task, TaskAssignment } from '@/lib/scoring/types';
import { globalAssign } from '@/lib/scoring/assign';
import { checkR1, checkR2, checkR3 } from '@/lib/scoring/rules';
import { computeScore } from '@/lib/scoring/score';
import { FALLBACK_WEIGHTS } from '@/lib/scoring/constants';
import { makeRng, hashSeed, Rng } from './prng';
import { EVAL_CONFIG } from './config';

export type MethodName = 'hybrid' | 'random' | 'round-robin' | 'manual';

/** Pemetaan taskId → memberId untuk satu penugasan. */
export type AssignMap = Record<string, string>;

export interface MethodResult {
  method: MethodName;
  /** Untuk random: satu hasil per pengulangan. Metode lain: satu entri. */
  runs: MethodRun[];
}

export interface MethodRun {
  method: MethodName;
  /** Seed yang dipakai (untuk random) atau null. */
  seed: number | null;
  /** runIndex untuk random (0..N-1), 0 untuk metode deterministik. */
  repeat: number;
  assignments: AssignMap;
  /** Jiwa tanggungan per anggota (jam), dihitung dari assignments. */
  loads: Record<string, number>;
  idealLoad: number;
}

/**
 * Aturan baseline MANUAL, ditulis sebelum hasil hybrid dijalankan (lihat
 * eval/reports/C_METHODS.md §Manual untuk bukti timestamp/urutan). Aturannya:
 *
 *   Urutkan tugas seperti engine (estimated_hours desc). Untuk setiap tugas,
 *   pilih anggota dengan skor "kecocokan profil" tertinggi, di mana skor itu
 *   = jumlah level pada skill wajib yang dikuasai (>=3) DIBAGI 5, ditambah
 *   bonus 0,5 bila anggota masih punya sisa jam (capacity - load - hours > 0)
 *   dan belum melewati 1,25x ideal. Seri dipatahkan oleh sisa jam lebih besar,
 *   lalu nama (alfabetis) agar deterministik. Metode ini sengaja "naif": ia
 *   memakai info skill & kapasitas yang juga dilihat manusia, tetapi TIDAK
 *   memakai K (cosine/embedding) maupun bobot sistem.
 */
function manualFitScore(task: Task, member: Member, load: number, idealLoad: number): number {
  const matched = task.required_skills.filter((s) => (member.skills[s] ?? 0) >= 3);
  const levelSum = matched.reduce((acc, s) => acc + (member.skills[s] ?? 0), 0);
  const skillPart = matched.length > 0 ? levelSum / (5 * Math.max(1, matched.length)) : 0;
  const newLoad = load + task.estimated_hours;
  const withinR2 = newLoad <= idealLoad * 1.25 && newLoad <= member.capacity;
  const hasRoom = member.capacity > 0 && member.capacity - newLoad >= 0;
  const bonus = withinR2 && hasRoom ? 0.5 : 0;
  return skillPart + bonus;
}

/** Urutan tugas yang dipakai SEMUA metode yang berurutan (engine memakai ini juga). */
export function sortTasksLikeEngine(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => b.estimated_hours - a.estimated_hours);
}

export function computeLoads(members: Member[], tasks: Task[], map: AssignMap): Record<string, number> {
  const loads: Record<string, number> = {};
  members.forEach((m) => (loads[m.id] = 0));
  for (const t of tasks) {
    const mid = map[t.id];
    if (mid && loads[mid] !== undefined) loads[mid] += t.estimated_hours;
  }
  return loads;
}

/** Hybrid memakai engine asli apa adanya. */
export function runHybrid(members: Member[], tasks: Task[]): MethodResult {
  const res = globalAssign(tasks, members, [], { isFallback: true });
  const assignments: AssignMap = {};
  for (const a of res.assignments) if (a.primaryMemberId) assignments[a.taskId] = a.primaryMemberId;
  return {
    method: 'hybrid',
    runs: [
      {
        method: 'hybrid',
        seed: null,
        repeat: 0,
        assignments,
        loads: computeLoads(members, tasks, assignments),
        idealLoad: res.idealLoad,
      },
    ],
  };
}

/**
 * Random: urutan tugas tetap (effort desc), lalu setiap tugas diberi anggota
 * acak. Diulang `randomRepeats` kali dengan seed turunan berbeda-beda.
 */
export function runRandom(members: Member[], tasks: Task[], scenarioId: string): MethodResult {
  const ordered = sortTasksLikeEngine(tasks);
  const idealLoad = tasks.reduce((s, t) => s + t.estimated_hours, 0) / members.length;
  const runs: MethodRun[] = [];
  for (let r = 0; r < EVAL_CONFIG.randomRepeats; r++) {
    const seed = hashSeed(EVAL_CONFIG.masterSeed, 'random', scenarioId, r);
    const rng: Rng = makeRng(seed);
    const assignments: AssignMap = {};
    for (const t of ordered) {
      assignments[t.id] = members[Math.floor(rng() * members.length)].id;
    }
    runs.push({
      method: 'random',
      seed,
      repeat: r,
      assignments,
      loads: computeLoads(members, tasks, assignments),
      idealLoad,
    });
  }
  return { method: 'random', runs };
}

/**
 * Round-robin: urut tugas (effort desc), anggota dicoba menurut urutan tetap
 * (urutan input `members`, dokumentasikan bahwa urutan ini adalah urutan
 * tampilan anggota project). Penunjuk bergerak +1 tiap tugas, TIDAK
 * memperhatikan skill. Bila anggota giliran berkapasitas 0 (R1), tetap
 * diberikan (round-robin adalah baseline buta aturan) — dicatat sebagai
 * pelanggaran, bukan diperbaiki.
 */
export function runRoundRobin(members: Member[], tasks: Task[]): MethodResult {
  const ordered = sortTasksLikeEngine(tasks);
  const idealLoad = tasks.reduce((s, t) => s + t.estimated_hours, 0) / members.length;
  const assignments: AssignMap = {};
  let cursor = 0;
  for (const t of ordered) {
    assignments[t.id] = members[cursor % members.length].id;
    cursor++;
  }
  return {
    method: 'round-robin',
    runs: [
      {
        method: 'round-robin',
        seed: null,
        repeat: 0,
        assignments,
        loads: computeLoads(members, tasks, assignments),
        idealLoad,
      },
    ],
  };
}

/** Manual: aturan baseline transparan (lihat docblock manualFitScore). */
export function runManual(members: Member[], tasks: Task[]): MethodResult {
  const ordered = sortTasksLikeEngine(tasks);
  const idealLoad = tasks.reduce((s, t) => s + t.estimated_hours, 0) / members.length;
  const loads: Record<string, number> = {};
  members.forEach((m) => (loads[m.id] = 0));
  const assignments: AssignMap = {};
  for (const t of ordered) {
    const best = [...members].sort((a, b) => {
      const d = manualFitScore(t, b, loads[b.id], idealLoad) - manualFitScore(t, a, loads[a.id], idealLoad);
      if (Math.abs(d) > 1e-9) return d;
      const roomD = (b.capacity - loads[b.id]) - (a.capacity - loads[a.id]);
      if (Math.abs(roomD) > 1e-9) return roomD;
      return a.name.localeCompare(b.name);
    })[0];
    assignments[t.id] = best.id;
    loads[best.id] += t.estimated_hours;
  }
  return {
    method: 'manual',
    runs: [
      {
        method: 'manual',
        seed: null,
        repeat: 0,
        assignments,
        loads,
        idealLoad,
      },
    ],
  };
}

export function runAllMethods(members: Member[], tasks: Task[], scenarioId: string): MethodResult[] {
  return [runHybrid(members, tasks), runRandom(members, tasks, scenarioId), runRoundRobin(members, tasks), runManual(members, tasks)];
}

// Re-ekspor untuk dipakai metrik tanpa impor ganda.
export { globalAssign, checkR1, checkR2, checkR3, computeScore, FALLBACK_WEIGHTS };
export type { Member, Task, TaskAssignment };
