import { Member, Task, SkillLevelMap, SkillTag } from './types';
import { WORKLOAD_CAP_MULTIPLIER, SKILL_TAXONOMY } from './constants';

export function checkR1(member: Member): boolean {
  return member.capacity > 0;
}

/**
 * T-ROOT-CAUSE-03: the canonical form of a skill name.
 *
 * Members store skills as free text (the profile form is a plain input whose
 * placeholder suggests "Frontend, Python, Desain UI"), while a task's
 * `required_skills` is validated against `SKILL_TAXONOMY`. Every lookup used to
 * be an exact string comparison, so "Penulisan Akademik", "penulisan_akademik"
 * and "penulisan  akademik" were three different skills that matched nothing.
 * The result was a score whose S component was silently 0 while the member held
 * the skill at level 5 — and, when nobody matched, an R3 warning that looked
 * like missing ability rather than a spelling difference.
 *
 * Normalising here, not at the input, keeps the stored data as the user wrote
 * it and fixes every reader at once: R3, S, M, the explanation and the export
 * all resolve names through this function.
 */
export function normalizeSkillName(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

/**
 * The member's skill map keyed by normalized name, so a taxonomy tag and a
 * hand-typed label meet in the middle. Built on demand rather than cached,
 * because rosters are small and a stale cache would be worse than the cost.
 *
 * When two stored labels normalize to the same skill, the highest level wins:
 * a real ability must not be lost to a duplicate row.
 */
export function canonicalSkills(member: Member): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [rawName, level] of Object.entries(member.skills ?? {})) {
    if (typeof level !== 'number' || !Number.isFinite(level)) continue;
    const key = normalizeSkillName(rawName);
    if (!key) continue;
    if (out[key] === undefined || level > out[key]) out[key] = level;
  }
  return out;
}

/** The level this member holds for a task's required skill, 0 when absent. */
export function skillLevelFor(member: Member, skill: string): number {
  const skills = canonicalSkills(member);
  const direct = skills[normalizeSkillName(skill)];
  if (direct !== undefined) return direct;
  return 0;
}

/** True when a stored label resolves to a known taxonomy tag. */
export function isTaxonomySkill(raw: string): raw is SkillTag {
  return (SKILL_TAXONOMY as readonly string[]).includes(normalizeSkillName(raw));
}

/** Skills the member has stored that no taxonomy tag accounts for. */
export function unmatchedSkillNames(member: Member): string[] {
  const taxonomy = new Set(SKILL_TAXONOMY.map((tag) => normalizeSkillName(tag)));
  return Object.keys(member.skills ?? {}).filter(
    (raw) => !taxonomy.has(normalizeSkillName(raw))
  );
}

/** Convenience for the UI: a member's skills with taxonomy names restored. */
export function normalizedSkillMap(member: Member): SkillLevelMap {
  const out: SkillLevelMap = {};
  for (const tag of SKILL_TAXONOMY) {
    const level = skillLevelFor(member, tag);
    if (level > 0) out[tag] = level;
  }
  return out;
}

export function checkR2(member: Member, task: Task, currentLoad: number, idealLoad: number): boolean {
  const newLoad = currentLoad + task.estimated_hours;
  const maxAllowed = idealLoad * WORKLOAD_CAP_MULTIPLIER;
  return newLoad <= maxAllowed && newLoad <= member.capacity;
}

export function checkR3(task: Task, members: Member[]): Member[] {
  // R3: Jika ada anggota dengan minimal satu skill wajib berlevel 3 atau lebih, hanya anggota tersebut yang menjadi kandidat.
  // Jika tidak ada, sistem tetap memberikan rekomendasi terbaik dengan peringatan.
  const qualifiedMembers = members.filter(member => {
    if (task.required_skills.length === 0) return true;
    return task.required_skills.some(skill => skillLevelFor(member, skill) >= 3);
  });

  if (qualifiedMembers.length > 0) {
    return qualifiedMembers;
  }
  return members; // Fallback to all members with a warning
}

/**
 * T-6.09: true when the task actually has an R3-qualified member.
 *
 * `checkR3` returns the WHOLE roster when nobody qualifies, because PRD 8.2 R3
 * still asks for a best-effort recommendation. That fallback pool must never be
 * read as "everyone satisfies R3": the T-6.09 report was exactly that — a member
 * with no required skill at level >= 3 shown as a normal candidate. Callers use
 * this predicate to tell a satisfied R3 apart from the fallback, so eligibility
 * and the user-facing warning stay honest.
 */
export function hasQualifiedMember(task: Task, members: Member[]): boolean {
  if (task.required_skills.length === 0) return true;
  return members.some(member =>
    task.required_skills.some(skill => skillLevelFor(member, skill) >= 3)
  );
}

export function checkR4(assignmentsCount: number): boolean {
  return assignmentsCount === 1;
}

export function checkR5(isLocked: boolean): boolean {
  return isLocked;
}
