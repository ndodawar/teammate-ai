import type { Member, Task, EngineReason, ScoreBreakdown } from './types';
import { checkR1, skillLevelFor } from './rules';

/**
 * FR-09: a factual sentence about one task/member pair, built only from the
 * project's own data.
 *
 * The template reason produced during assignment (`generateExplanation`) claims
 * "sisa kapasitas yang memadai" unconditionally, and calls a score of 0%
 * "dengan skor kesesuaian 0%". Both statements contradict the numbers printed
 * next to them, so the matrix does not render them. This function replaces them
 * with a sentence whose every clause is derived from the same breakdown the
 * user sees, and every clause can be traced to a field of the dataset.
 *
 * Scoring, ordering and selection are untouched: only the sentence changes.
 */

export interface ReasonInput {
  task: Task;
  member: Member;
  breakdown: ScoreBreakdown;
  isPrimary: boolean;
  isFallback: boolean;
}

/** Skills the task requires where the member's level reaches the R3 floor (3). */
export function matchingSkills(task: Task, member: Member): string[] {
  // T-ROOT-CAUSE-03: resolved through the shared normalisation, so the reason
  // sentence names exactly the skills R3 accepted.
  return task.required_skills.filter((skill) => skillLevelFor(member, skill) >= 3);
}

/** Skills the task requires that the member has not rated at all. */
export function missingSkills(task: Task, member: Member): string[] {
  return task.required_skills.filter((skill) => skillLevelFor(member, skill) === 0);
}

function joinSkills(skills: string[]): string {
  return skills.join(', ');
}

/**
 * The same sentence the assignment engine would produce from this breakdown,
 * word for word equivalent in content but never claiming capacity that is not
 * there. Kept separate from `generateExplanation` so the engine contract (and
 * its tests) stay untouched.
 */
export function memberReason(input: ReasonInput): string {
  const { task, member, breakdown } = input;
  const score = Math.round(breakdown.total * 100);
  const matched = matchingSkills(task, member);
  const missing = missingSkills(task, member);

  const skillClause =
    matched.length > 0
      ? `menguasai ${joinSkills(matched)}`
      : task.required_skills.length > 0
        ? `belum menilai ${joinSkills(task.required_skills.filter((s) => !matched.includes(s))) || 'skill wajib'} di level 3 atau lebih`
        : 'tidak membutuhkan skill khusus';

  const capacityClause =
    member.capacity <= 0
      ? 'tidak memiliki jam tersedia sehingga gugur pada R1'
      : breakdown.C <= 0
        ? 'tidak menyisakan kapasitas untuk tugas sebesar ini'
        : `menyisakan ${Math.round(breakdown.C * 100)}% kapasitas`;

  const interestClause =
    breakdown.M >= 0.75
      ? 'dan berminat tinggi pada pekerjaan ini'
      : breakdown.M >= 0.25
        ? 'dengan minat sedang'
        : 'dengan minat rendah';

  const lead = input.isFallback
    ? `${member.name} ${skillClause}, ${capacityClause} ${interestClause}; komponen konten (K) tidak dihitung pada mode cadangan`
    : `${member.name} ${skillClause}, ${capacityClause} ${interestClause}`;

  if (missing.length > 0 && matched.length > 0) {
    return `${lead}. Belum dinilai: ${joinSkills(missing)}. Skor ${score}%.`;
  }
  return `${lead}. Skor ${score}%.`;
}

/**
 * Why this member is (or is not) the recommendation. Explains the hard rules in
 * the order the engine applies them, using only values from the run.
 */
export function engineReason(input: ReasonInput): EngineReason {
  const { task, member, breakdown, isPrimary, isFallback } = input;

  if (!checkR1(member)) {
    return {
      code: 'r1',
      headline: 'Gugur pada R1: jam tersedia 0',
      detail: 'Aturan R1 mengeluarkan anggota tanpa sisa kapasitas dari kandidat.',
    };
  }

  if (breakdown.total <= 0 && breakdown.C <= 0) {
    return {
      code: 'r2',
      headline: `Gagal syarat kapasitas: tugas ${task.estimated_hours} jam, sisa ${member.capacity === 0 ? 0 : Math.max(0, member.capacity)} jam`,
      detail: `Beban setelah menerima tugas ini melewati batas R2 (1,25× beban ideal) atau jam tersedia anggota, sehingga skornya 0${
        isFallback ? '' : ' pada mode ini'
      }.`,
    };
  }

  if (isPrimary) {
    return {
      code: 'primary',
      headline:
        breakdown.S <= 0 && task.required_skills.length > 0
          ? 'Rekomendasi utama, tanpa skill wajib yang cocok (R3 tidak menemukan kandidat level 3)'
          : 'Rekomendasi utama: skor tertinggi di antara kandidat yang lolos R1 dan R2',
      detail: isFallback
        ? `Dihitung dari bobot cadangan S 50% · C 33% · M 17%.`
        : 'Dihitung dari bobot hybrid K 40% · S 30% · C 20% · M 10%.',
    };
  }

  return {
    code: 'alternative',
    headline: 'Alternatif: kandidat layak dengan skor berikutnya',
    detail:
      breakdown.S <= 0 && task.required_skills.length > 0
        ? 'Skor skill 0 karena tidak ada skill wajib yang dikuasai di level 3 atau lebih; tetap kandidat karena R3 tidak menemukan anggota yang memenuhi.'
        : 'Masih lolos R1 dan R2, sehingga aman dipilih bila rekomendasi utama tidak bisa diambil.',
  };
}

/** Uppercase first letter, for sentences that start with a clause. */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
