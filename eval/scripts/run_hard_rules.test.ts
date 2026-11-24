/**
 * Validasi hard rule R1–R5 pada mesin ASLI (`globalAssign`, `computeScore`,
 * `checkR1`–`checkR3`). Setiap aturan punya skenario "valid" dan "edge".
 *
 * Output: eval/results/hard_rules.json + penggalan ke laporan D.
 * Tidak mengubah aturan; bila perilaku tidak sesuai PRD, hasilnya dicatat apa
 * adanya (termasuk kasus yang tidak didefinisikan PRD).
 */

import { it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Member, Task, SkillTag } from '@/lib/scoring/types';
import { globalAssign } from '@/lib/scoring/assign';
import { checkR1, checkR2, checkR3 } from '@/lib/scoring/rules';

const T = (s: string) => s as SkillTag;

interface RuleCase {
  rule: 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
  kind: 'valid' | 'edge' | 'undefined';
  name: string;
  members: Member[];
  tasks: Task[];
  locked?: { taskId: string; memberId: string }[];
  /** Assertion terhadap hasil `globalAssign`. */
  assert: (res: ReturnType<typeof globalAssign>) => { pass: boolean; detail: string };
}

const results: unknown[] = [];

const cases: RuleCase[] = [
  // ---------------- R1 ----------------
  {
    rule: 'R1', kind: 'valid', name: 'Anggota capacity 0 tidak menjadi kandidat meski skill tertinggi',
    members: [
      { id: 'm0', name: 'Zero', capacity: 0, skills: { [T('koordinasi')]: 5 } },
      { id: 'm1', name: 'Normal', capacity: 40, skills: { [T('koordinasi')]: 3 } },
    ],
    tasks: [{ id: 't1', title: 'Koord', estimated_hours: 4, difficulty: 2, required_skills: [T('koordinasi')] }],
    assert: (res) => {
      const primary = res.assignments[0].primaryMemberId;
      return { pass: primary !== 'm0' && primary === 'm1', detail: `primary=${primary} (harap m1)` };
    },
  },
  {
    rule: 'R1', kind: 'edge', name: 'Semua anggota capacity 0 → tidak ada kandidat sah',
    members: [
      { id: 'm0', name: 'Z1', capacity: 0, skills: { [T('presentasi')]: 5 } },
      { id: 'm1', name: 'Z2', capacity: 0, skills: { [T('presentasi')]: 4 } },
    ],
    tasks: [{ id: 't1', title: 'Talk', estimated_hours: 3, difficulty: 2, required_skills: [T('presentasi')] }],
    assert: (res) => {
      const a = res.assignments[0];
      const s0 = a.scores['m0'];
      const s1 = a.scores['m1'];
      const noEligible = !s0.isEligible && !s1.isEligible;
      return { pass: noEligible, detail: `eligible m0=${s0.isEligible}, m1=${s1.isEligible}; engine tetap menugaskan primary=${a.primaryMemberId || '(kosong)'}` };
    },
  },
  {
    rule: 'R1', kind: 'edge', name: 'capacity negatif (di luar validasi) — perilaku engine',
    members: [
      { id: 'm0', name: 'Neg', capacity: -5, skills: { [T('koordinasi')]: 5 } },
      { id: 'm1', name: 'Pos', capacity: 40, skills: { [T('koordinasi')]: 3 } },
    ],
    tasks: [{ id: 't1', title: 'K', estimated_hours: 2, difficulty: 1, required_skills: [T('koordinasi')] }],
    assert: (res) => {
      const primary = res.assignments[0].primaryMemberId;
      return { pass: primary === 'm1', detail: `checkR1(-5)=${checkR1({ id: 'x', name: 'x', capacity: -5, skills: {} })}; primary=${primary}` };
    },
  },

  // ---------------- R2 ----------------
  {
    rule: 'R2', kind: 'valid', name: 'Beban di bawah 1,25x ideal → lolos',
    members: [
      { id: 'm1', name: 'A', capacity: 40, skills: { [T('pengujian')]: 4 } },
      { id: 'm2', name: 'B', capacity: 40, skills: { [T('pengujian')]: 4 } },
    ],
    tasks: [
      { id: 't1', title: 'T1', estimated_hours: 6, difficulty: 3, required_skills: [T('pengujian')] },
      { id: 't2', title: 'T2', estimated_hours: 6, difficulty: 3, required_skills: [T('pengujian')] },
    ],
    assert: (res) => {
      const ideal = res.idealLoad;
      const over = Object.values(res.memberLoads).filter((l) => l > ideal * 1.25);
      return { pass: over.length === 0, detail: `ideal=${ideal}, loads=${JSON.stringify(res.memberLoads)}` };
    },
  },
  {
    rule: 'R2', kind: 'edge', name: 'Tidak ada kandidat yang memenuhi R2 (kapasitas & 1,25x ideal)',
    members: [
      { id: 'm1', name: 'Small', capacity: 4, skills: { [T('desain sistem')]: 4 } },
      { id: 'm2', name: 'Tiny', capacity: 3, skills: { [T('desain sistem')]: 3 } },
    ],
    tasks: [{ id: 't1', title: 'Big', estimated_hours: 10, difficulty: 4, required_skills: [T('desain sistem')] }],
    assert: (res) => {
      const a = res.assignments[0];
      const anyEligible = Object.values(a.scores).some((s) => s.isEligible);
      // Catat: engine masuk jalur absoluteBest dan tetap menugaskan walau semua gagal R2.
      return {
        pass: !anyEligible && a.primaryMemberId !== '',
        detail: `tidak ada eligible=${!anyEligible}; engine tetap menugaskan primary=${a.primaryMemberId} (jalur absoluteBest, R2 dilanggar)`,
      };
    },
  },
  {
    rule: 'R2', kind: 'edge', name: 'Batas R2 berbasis capacity: anggota muat 1,25x ideal tapi tak muat capacity',
    members: [
      { id: 'm1', name: 'LowCap', capacity: 8, skills: { [T('koordinasi')]: 5 } },
      { id: 'm2', name: 'Normal', capacity: 40, skills: { [T('koordinasi')]: 5 } },
    ],
    tasks: [
      { id: 't1', title: 'T1', estimated_hours: 9, difficulty: 3, required_skills: [T('koordinasi')] },
      { id: 't2', title: 'T2', estimated_hours: 9, difficulty: 3, required_skills: [T('koordinasi')] },
    ],
    assert: (res) => {
      // ideal = 9; 1.25*ideal = 11.25; LowCap capacity 8 < 9 → tak boleh dapat t1.
      const t1 = res.assignments.find((x) => x.taskId === 't1')!;
      const r2LowCap = checkR2(
        { id: 'm1', name: 'LowCap', capacity: 8, skills: {} },
        { id: 't1', title: 'T1', estimated_hours: 9, difficulty: 3, required_skills: [] },
        0,
        9
      );
      return {
        pass: t1.primaryMemberId !== 'm1',
        detail: `checkR2(LowCap,t1)=${r2LowCap} (capacity 8 < 9); t1 primary=${t1.primaryMemberId} (harap bukan m1)`,
      };
    },
  },

  // ---------------- R3 ----------------
  {
    rule: 'R3', kind: 'valid', name: 'Hanya anggota level>=3 pada skill wajib yang jadi kandidat',
    members: [
      { id: 'm1', name: 'Qualified', capacity: 40, skills: { [T('pemrograman backend')]: 3 } },
      { id: 'm2', name: 'Unqualified', capacity: 40, skills: { [T('pemrograman backend')]: 2 } },
      { id: 'm3', name: 'Spare', capacity: 40, skills: { [T('pemrograman backend')]: 3 } },
    ],
    // Volume cukup agar ideal ≈ 4 jam (4 tugas × 3 jam / 3 anggota = 4), task target 4 jam
    // muat R2 (max 5). Dengan begitu kegagalan R2 tidak menutupi efek R3.
    tasks: [
      { id: 't1', title: 'API', estimated_hours: 4, difficulty: 2, required_skills: [T('pemrograman backend')] },
      { id: 't2', title: 'T2', estimated_hours: 3, difficulty: 2, required_skills: [T('pemrograman backend')] },
      { id: 't3', title: 'T3', estimated_hours: 3, difficulty: 2, required_skills: [T('pemrograman backend')] },
      { id: 't4', title: 'T4', estimated_hours: 2, difficulty: 2, required_skills: [T('pemrograman backend')] },
    ],
    assert: (res) => {
      const a = res.assignments.find((x) => x.taskId === 't1')!;
      // Unqualified (m2) TIDAK boleh eligible pada t1 (R3), apa pun status R2-nya.
      return {
        pass: !a.scores['m2'].isEligible && a.primaryMemberId !== 'm2',
        detail: `ideal=${res.idealLoad} max=${(res.idealLoad * 1.25).toFixed(2)}; m2 eligible=${a.scores['m2'].isEligible} (harap false karena level 2 < 3); t1 primary=${a.primaryMemberId}`,
      };
    },
  },
  {
    rule: 'R3', kind: 'valid', name: 'Multi-skill: cukup salah satu skill >=3 (any, bukan all)',
    members: [
      { id: 'm1', name: 'HalfQualified', capacity: 40, skills: { [T('penulisan akademik')]: 4, [T('riset literatur')]: 1 } },
      { id: 'm2', name: 'None', capacity: 40, skills: { [T('penulisan akademik')]: 2, [T('riset literatur')]: 2 } },
    ],
    tasks: [{ id: 't1', title: 'Paper', estimated_hours: 5, difficulty: 3, required_skills: [T('penulisan akademik'), T('riset literatur')] }],
    assert: () => {
      const pool = checkR3({ id: 't1', title: 'Paper', estimated_hours: 5, difficulty: 3, required_skills: [T('penulisan akademik'), T('riset literatur')] }, [
        { id: 'm1', name: 'HalfQualified', capacity: 40, skills: { [T('penulisan akademik')]: 4, [T('riset literatur')]: 1 } },
        { id: 'm2', name: 'None', capacity: 40, skills: { [T('penulisan akademik')]: 2, [T('riset literatur')]: 2 } },
      ]);
      // Uji R3 langsung: pool hanya berisi m1 (punya 1 skill >=3), bukan m2.
      return { pass: pool.length === 1 && pool[0].id === 'm1', detail: `pool=[${pool.map((m) => m.id).join(',')}] (harap hanya m1)` };
    },
  },
  {
    rule: 'R3', kind: 'edge', name: 'Tidak ada kandidat level>=3 → pool = semua anggota (peringatan)',
    members: [
      { id: 'm1', name: 'A', capacity: 40, skills: { [T('data dan machine learning')]: 2 } },
      { id: 'm2', name: 'B', capacity: 40, skills: { [T('data dan machine learning')]: 2 } },
    ],
    tasks: [{ id: 't1', title: 'ML', estimated_hours: 4, difficulty: 2, required_skills: [T('data dan machine learning')] }],
    assert: (res) => {
      const pool = checkR3({ id: 't1', title: 'ML', estimated_hours: 4, difficulty: 2, required_skills: [T('data dan machine learning')] }, [
        { id: 'm1', name: 'A', capacity: 40, skills: { [T('data dan machine learning')]: 2 } },
        { id: 'm2', name: 'B', capacity: 40, skills: { [T('data dan machine learning')]: 2 } },
      ]);
      const a = res.assignments[0];
      return { pass: pool.length === 2 && a.primaryMemberId !== '', detail: `pool=${pool.length} (harap 2 = fallback); primary=${a.primaryMemberId}` };
    },
  },
  {
    rule: 'R3', kind: 'edge', name: 'Tugas tanpa skill wajib → semua kandidat (S=1.0)',
    members: [{ id: 'm1', name: 'A', capacity: 40, skills: {} }],
    tasks: [{ id: 't1', title: 'General', estimated_hours: 2, difficulty: 1, required_skills: [] }],
    assert: (res) => {
      const a = res.assignments[0];
      return { pass: a.scores['m1'].isEligible && a.scores['m1'].breakdown.S === 1, detail: `S=${a.scores['m1'].breakdown.S} (harap 1.0 untuk tanpa skill)` };
    },
  },

  // ---------------- R4 ----------------
  {
    rule: 'R4', kind: 'valid', name: 'Setiap tugas punya tepat satu penanggung jawab',
    members: [
      { id: 'm1', name: 'A', capacity: 40, skills: { [T('pengujian')]: 4 } },
      { id: 'm2', name: 'B', capacity: 40, skills: { [T('pengujian')]: 4 } },
    ],
    tasks: [
      { id: 't1', title: 'T1', estimated_hours: 4, difficulty: 2, required_skills: [T('pengujian')] },
      { id: 't2', title: 'T2', estimated_hours: 4, difficulty: 2, required_skills: [T('pengujian')] },
    ],
    assert: (res) => {
      const oneEach = res.assignments.every((a) => typeof a.primaryMemberId === 'string' && a.primaryMemberId.length > 0);
      const noDup = new Set(res.assignments.map((a) => a.taskId)).size === res.assignments.length;
      return { pass: oneEach && noDup, detail: `oneEach=${oneEach}, unique task=${noDup}, count=${res.assignments.length}` };
    },
  },
  {
    rule: 'R4', kind: 'edge', name: 'Tugas tidak ada pemilik sah (semua capacity 0) → primary bisa kosong/salah',
    members: [{ id: 'm0', name: 'Zero', capacity: 0, skills: { [T('pengujian')]: 5 } }],
    tasks: [{ id: 't1', title: 'T1', estimated_hours: 4, difficulty: 2, required_skills: [T('pengujian')] }],
    assert: (res) => {
      const a = res.assignments[0];
      // absoluteBest tetap memilih m0 meski R1 gagal → satu pemilik tapi R1 dilanggar. Catat.
      return { pass: a.primaryMemberId === 'm0', detail: `satu pemilik=${a.primaryMemberId}; catat: R4 terpenuhi secara struktural walau R1 dilanggar` };
    },
  },

  // ---------------- R5 ----------------
  {
    rule: 'R5', kind: 'valid', name: 'Tugas terkunci mempertahankan pemilik setelah perhitungan ulang',
    members: [
      { id: 'm1', name: 'A', capacity: 40, skills: { [T('desain antarmuka')]: 3 } },
      { id: 'm2', name: 'B', capacity: 40, skills: { [T('desain antarmuka')]: 5 } },
    ],
    tasks: [{ id: 't1', title: 'UI', estimated_hours: 6, difficulty: 3, required_skills: [T('desain antarmuka')] }],
    locked: [{ taskId: 't1', memberId: 'm1' }],
    assert: (res) => {
      const a = res.assignments[0];
      return { pass: a.primaryMemberId === 'm1' && a.isLocked, detail: `primary=${a.primaryMemberId} (harap m1 meski B level 5), locked=${a.isLocked}` };
    },
  },
  {
    rule: 'R5', kind: 'edge', name: 'Tugas terkunci ke anggota yang kemudian jadi tak layak — tetap dipertahankan',
    members: [
      { id: 'm1', name: 'Weak', capacity: 40, skills: { [T('koordinasi')]: 1 } },
      { id: 'm2', name: 'Strong', capacity: 40, skills: { [T('koordinasi')]: 5 } },
    ],
    tasks: [{ id: 't1', title: 'K', estimated_hours: 5, difficulty: 3, required_skills: [T('koordinasi')] }],
    locked: [{ taskId: 't1', memberId: 'm1' }],
    assert: (res) => {
      const a = res.assignments[0];
      return { pass: a.primaryMemberId === 'm1', detail: `primary=${a.primaryMemberId} (harap m1 terkunci meski tidak layak R3)` };
    },
  },
  {
    rule: 'R5', kind: 'edge', name: 'Beban dari tugas terkunci ikut dihitung ke ideal & R2 anggota lain',
    members: [
      { id: 'm1', name: 'Locked', capacity: 40, skills: { [T('koordinasi')]: 4 } },
      { id: 'm2', name: 'Free', capacity: 40, skills: { [T('koordinasi')]: 4 } },
    ],
    tasks: [
      { id: 't1', title: 'Big locked', estimated_hours: 18, difficulty: 4, required_skills: [T('koordinasi')] },
      { id: 't2', title: 'Small', estimated_hours: 6, difficulty: 2, required_skills: [T('koordinasi')] },
    ],
    locked: [{ taskId: 't1', memberId: 'm1' }],
    assert: (res) => {
      const t2 = res.assignments.find((a) => a.taskId === 't2')!;
      return { pass: t2.primaryMemberId === 'm2', detail: `loads=${JSON.stringify(res.memberLoads)}; t2 hasil ke ${t2.primaryMemberId} (harap m2 karena m1 sudah 18)` };
    },
  },
];

function toExisting(tasks: Task[], locked?: { taskId: string; memberId: string }[]) {
  if (!locked) return [];
  return locked.map((l) => ({
    taskId: l.taskId,
    primaryMemberId: l.memberId,
    alternativeMemberId: undefined,
    isLocked: true,
    scores: {},
  }));
}

it('menjalankan seluruh kasus hard-rule pada engine asli', () => {
  const out: unknown[] = [];
  for (const c of cases) {
    const res = globalAssign(c.tasks, c.members, toExisting(c.tasks, c.locked), { isFallback: true });
    const verdict = c.assert(res);
    out.push({
      rule: c.rule,
      kind: c.kind,
      name: c.name,
      pass: verdict.pass,
      detail: verdict.detail,
      idealLoad: res.idealLoad,
      memberLoads: res.memberLoads,
      assignment: res.assignments.map((a) => ({ taskId: a.taskId, primary: a.primaryMemberId, locked: a.isLocked })),
    });
  }
  results.push(...out);
  mkdirSync('eval/results', { recursive: true });
  writeFileSync(join('eval/results', 'hard_rules.json'), JSON.stringify(out, null, 2));

  // R1 valid, R3 valid, R4 valid, R5 valid WAJIB lulus. Edge/undefined dicatat,
  // bukan digagalkan (menguji perilaku aktual, bukan memaksa lulus).
  const mandatory = (out as { rule: string; kind: string; pass: boolean }[]).filter((o) => o.kind === 'valid');
  for (const m of mandatory) expect(m.pass, `Valid case harus lulus: ${m.rule}`).toBe(true);
});
