/**
 * Metrik evaluasi (PRD §7). Semua rumus ditulis eksplisit di sini dan di
 * eval/reports/E_SKILL_COVERAGE.md / F_LOAD_BALANCE.md.
 *
 * Prinsip:
 *   - "skill coverage" TIDAK dicampur dengan cosine similarity. Coverage adalah
 *     hitungan skill wajib yang benar-benar dikuasai anggota yang ditugaskan.
 *   - "load balance" bukan sekadar total sama; dihitung stddev, selisih terhadap
 *     ideal, dan jumlah pelanggaran R2 per anggota.
 *   - "hard-rule compliance" memakai mesin aturan asli (checkR1/checkR2/checkR3)
 *     + pemeriksaan struktural R4/R5.
 *   - "fit" adalah ukuran kecocokan penugasan terhadap profil (skill+minat),
 *     bukan skor internal sistem (total) sebagai pembenaran diri.
 */

import { SKILL_TAXONOMY, Member, Task } from '@/lib/scoring/types';
import { checkR1, checkR2, checkR3 } from '@/lib/scoring/rules';
import { computeSkillMatch, computeInterest } from '@/lib/scoring/score';
import { AssignMap, MethodRun } from './methods';

// ---------------------------------------------------------------------------
// E. Skill coverage
// ---------------------------------------------------------------------------

export interface SkillCoverage {
  /** Jumlah (skill wajib × tugas) yang terpenuhi: level anggota >= 3. */
  satisfiedUnits: number;
  /** Total (skill wajib × tugas). */
  totalUnits: number;
  /** satisfiedUnits / totalUnits; 1 bila totalUnits = 0. */
  coverage: number;
  /** Tugas di mana SEMUA skill wajibnya terpenuhi. */
  tasksFullyCovered: number;
  /** Tugas yang punya >=1 skill wajib tak terpenuhi (atau semua tak punya). */
  tasksWithGap: number;
  /** Skill yang tidak ada di SKILL_TAXONOMY pada tugas mana pun (data hygiene). */
  unknownSkills: string[];
}

/**
 * Definisi coverage:
 *   unit = (task, skill) untuk setiap skill di task.required_skills.
 *   unit "terpenuhi" bila level anggota penanggung jawab pada skill itu >= 3
 *   (ambang R3). Skill yang tidak dimiliki anggota = level 0 (dianggap tidak
 *   terpenuhi) — TIDAK dibuang dari penyebut. Itulah cara "skill tidak tersedia"
 *   ditangani: dihitung sebagai gap, bukan diabaikan.
 */
export function skillCoverage(members: Member[], tasks: Task[], map: AssignMap): SkillCoverage {
  const byId = new Map(members.map((m) => [m.id, m]));
  let satisfied = 0;
  let total = 0;
  let fully = 0;
  let gap = 0;
  const unknown = new Set<string>();
  const taxonomy = new Set<string>(SKILL_TAXONOMY);
  for (const t of tasks) {
    const member = byId.get(map[t.id] ?? '');
    let taskGap = false;
    if (t.required_skills.length === 0) {
      total += 0; // tugas tanpa skill tidak dihitung di penyebut
    }
    for (const skill of t.required_skills) {
      if (!taxonomy.has(skill)) unknown.add(skill);
      total += 1;
      const level = member ? member.skills[skill] ?? 0 : 0;
      if (level >= 3) satisfied += 1;
      else taskGap = true;
    }
    if (t.required_skills.length > 0) {
      if (taskGap) gap += 1;
      else fully += 1;
    }
  }
  return {
    satisfiedUnits: satisfied,
    totalUnits: total,
    coverage: total === 0 ? 1 : satisfied / total,
    tasksFullyCovered: fully,
    tasksWithGap: gap,
    unknownSkills: [...unknown],
  };
}

// ---------------------------------------------------------------------------
// F. Load balance
// ---------------------------------------------------------------------------

export interface LoadBalance {
  idealLoad: number;
  /** totalEffort / members.length */
  loads: { memberId: string; name: string; load: number; capacity: number; deviation: number; overR2: boolean }[];
  /** stddev populasi dari load: sqrt(mean((load_i - mean)^2)). */
  stdDev: number;
  /** variance populasi = stdDev^2. */
  variance: number;
  /**
   * max |load_i - ideal|. Dipakai sebagai "deviation from ideal" karena idealLoad
   * adalah target engine sendiri.
   */
  maxDeviationFromIdeal: number;
  /** mean(|load_i - ideal|). */
  meanAbsDeviationFromIdeal: number;
  /**
   * Jumlah anggota yang LOAD-nya melewati 1,25×ideal (yaitu pelanggaran R2
   * sebagai batas beban). Catatan: R2 engine juga memakai batas `capacity`,
   * jadi angka ini bisa < pelanggaran R2 efektif; lihat overCapacityCount.
   */
  overR2Count: number;
  /** Jumlah anggota yang load-nya melewati capacity-nya. */
  overCapacityCount: number;
  /** Jumlah anggota berkapasitas 0 yang tetap diberi tugas (pelanggaran R1). */
  zeroCapacityAssigned: number;
}

export function loadBalance(members: Member[], tasks: Task[], map: AssignMap, idealLoad: number): LoadBalance {
  const loads: Record<string, number> = {};
  members.forEach((m) => (loads[m.id] = 0));
  for (const t of tasks) {
    const mid = map[t.id];
    if (mid && loads[mid] !== undefined) loads[mid] += t.estimated_hours;
  }
  const values = members.map((m) => loads[m.id]);
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length || 1);
  const stdDev = Math.sqrt(variance);
  const perMember = members.map((m) => {
    const load = loads[m.id];
    const r2Limit = idealLoad * 1.25;
    return {
      memberId: m.id,
      name: m.name,
      load,
      capacity: m.capacity,
      deviation: Number((load - idealLoad).toFixed(4)),
      overR2: load > r2Limit,
    };
  });
  const deviations = perMember.map((p) => Math.abs(p.load - idealLoad));
  return {
    idealLoad: Number(idealLoad.toFixed(4)),
    loads: perMember,
    stdDev: Number(stdDev.toFixed(4)),
    variance: Number(variance.toFixed(4)),
    maxDeviationFromIdeal: deviations.length ? Number(Math.max(...deviations).toFixed(4)) : 0,
    meanAbsDeviationFromIdeal: deviations.length ? Number((deviations.reduce((a, b) => a + b, 0) / deviations.length).toFixed(4)) : 0,
    overR2Count: perMember.filter((p) => p.overR2).length,
    overCapacityCount: perMember.filter((p) => p.load > p.capacity).length,
    zeroCapacityAssigned: members.filter((m) => m.capacity <= 0 && loads[m.id] > 0).length,
  };
}

// ---------------------------------------------------------------------------
// D. Hard-rule compliance per penugasan
// ---------------------------------------------------------------------------

export interface HardRuleCheck {
  /** Setiap tugas punya tepat satu penanggung jawab (R4, struktural). */
  r4SingleOwner: boolean;
  /** Tidak ada anggota kapasitas 0 yang ditugaskan (R1). */
  r1Violations: number;
  /**
   * Jumlah tugas yang penanggung jawabnya melanggar batas R2 versi FINAL:
   * load akhir anggota > 1,25×ideal ATAU load akhir > capacity. Ini mengukur
   * hasil akhir distribusi, berbeda dari checkR2 saat-saat-assign (greedy).
   */
  r2FinalViolations: number;
  /** Tugas di mana penanggung jawab tidak punya skill wajib level >=3 padahal ADA anggota lain yang punya (R3 dilanggar). */
  r3Violations: number;
  /** Tugas yang tak punya kandidat level>=3 sama sekali (R3 tak dapat dipenuhi; kondisi "warning" PRD). */
  r3NoCandidateTasks: number;
  /** Tugas terkunci (R5) — dicek terpisah; di sini hanya dihitung jumlahnya. */
  lockedTasks: number;
}

export function hardRules(
  members: Member[],
  tasks: Task[],
  map: AssignMap,
  idealLoad: number,
  lockedTaskIds: Set<string>
): HardRuleCheck {
  const byId = new Map(members.map((m) => [m.id, m]));
  // Load akhir
  const loads: Record<string, number> = {};
  members.forEach((m) => (loads[m.id] = 0));
  for (const t of tasks) {
    const mid = map[t.id];
    if (mid && loads[mid] !== undefined) loads[mid] += t.estimated_hours;
  }
  let r1 = 0;
  let r2final = 0;
  let r3 = 0;
  let r3NoCand = 0;
  let r4Single = true;
  for (const t of tasks) {
    const mid = map[t.id];
    if (!mid || !byId.has(mid)) {
      r4Single = false; // tidak ada pemilik → bukan tepat satu
      continue;
    }
    const member = byId.get(mid)!;
    if (!checkR1(member)) r1 += 1;
    const finalLoad = loads[mid];
    if (finalLoad > idealLoad * 1.25 || finalLoad > member.capacity) r2final += 1;
    // R3: apakah ada anggota (mana pun) dengan skill wajib >=3?
    const anyQualified = members.some((m) => t.required_skills.some((s) => (m.skills[s] ?? 0) >= 3));
    if (t.required_skills.length > 0 && !anyQualified) {
      r3NoCand += 1;
    } else {
      const assigneeQualified = t.required_skills.length === 0 || t.required_skills.some((s) => (member.skills[s] ?? 0) >= 3);
      if (!assigneeQualified) r3 += 1;
    }
  }
  return {
    r4SingleOwner: r4Single,
    r1Violations: r1,
    r2FinalViolations: r2final,
    r3Violations: r3,
    r3NoCandidateTasks: r3NoCand,
    lockedTasks: tasks.filter((t) => lockedTaskIds.has(t.id)).length,
  };
}

// ---------------------------------------------------------------------------
// "Fit" — kecocokan penugasan terhadap profil (bukan skor internal)
// ---------------------------------------------------------------------------

export interface FitScore {
  /** mean computeSkillMatch atas semua tugas (0..1). */
  meanSkillMatch: number;
  /** mean computeInterest atas semua tugas (0..1), minat default 3 → 0.5. */
  meanInterest: number;
  /** (meanSkillMatch + meanInterest)/2 — kecocokan profil rata-rata. */
  fit: number;
}

export function fitScore(members: Member[], tasks: Task[], map: AssignMap): FitScore {
  const byId = new Map(members.map((m) => [m.id, m]));
  if (tasks.length === 0) return { meanSkillMatch: 0, meanInterest: 0, fit: 0 };
  let s = 0;
  let m = 0;
  for (const t of tasks) {
    const member = byId.get(map[t.id] ?? '');
    if (!member) continue;
    s += computeSkillMatch(t, member);
    m += computeInterest(t, member);
  }
  const meanSkillMatch = s / tasks.length;
  const meanInterest = m / tasks.length;
  return {
    meanSkillMatch: Number(meanSkillMatch.toFixed(4)),
    meanInterest: Number(meanInterest.toFixed(4)),
    fit: Number(((meanSkillMatch + meanInterest) / 2).toFixed(4)),
  };
}

// ---------------------------------------------------------------------------
// Perbandingan: jumlah perubahan manual (jarak terhadap hybrid? tidak — terhadap
// solusi yang "memenuhi aturan"). Kita hitung berapa tugas harus diubah agar
// semua hard rule terpenuhi menggunakan perbaikan greedy sederhana.
// ---------------------------------------------------------------------------

/**
 * "Manual changes needed": berapa banyak tugas yang harus dipindahkan agar hasil
 * bebas pelanggaran R1 (anggota kapasitas 0) dan R3 (ada kandidat level>=3 tapi
 * bukan penanggung jawabnya). Ini ukuran usaha koreksi minimum, bukan jarak ke
 * hybrid. Tidak mengubah engine; hanya menghitung.
 */
export function manualChangesNeeded(members: Member[], tasks: Task[], map: AssignMap, idealLoad: number): number {
  const byId = new Map(members.map((m) => [m.id, m]));
  let changes = 0;
  for (const t of tasks) {
    const member = byId.get(map[t.id] ?? '');
    const r1Bad = !member || !checkR1(member);
    const anyQualified = members.some((m) => t.required_skills.some((s) => (m.skills[s] ?? 0) >= 3));
    const assigneeQualified = !member || t.required_skills.length === 0 || t.required_skills.some((s) => (member.skills[s] ?? 0) >= 3);
    const r3Bad = anyQualified && !assigneeQualified;
    if (r1Bad || r3Bad) changes += 1;
  }
  void idealLoad;
  return changes;
}

// ---------------------------------------------------------------------------
// Agregasi terhadap satu MethodResult (semua run)
// ---------------------------------------------------------------------------

export interface RunMetrics {
  skillCoverage: SkillCoverage;
  loadBalance: LoadBalance;
  hardRules: HardRuleCheck;
  fit: FitScore;
  manualChanges: number;
}

export function metricsForRun(
  members: Member[],
  tasks: Task[],
  run: MethodRun,
  lockedTaskIds: Set<string>
): RunMetrics {
  return {
    skillCoverage: skillCoverage(members, tasks, run.assignments),
    loadBalance: loadBalance(members, tasks, run.assignments, run.idealLoad),
    hardRules: hardRules(members, tasks, run.assignments, run.idealLoad, lockedTaskIds),
    fit: fitScore(members, tasks, run.assignments),
    manualChanges: manualChangesNeeded(members, tasks, run.assignments, run.idealLoad),
  };
}

export { checkR1, checkR2, checkR3 };
