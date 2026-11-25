import { describe, it, expect } from 'vitest';
import { globalAssign } from '@/lib/scoring/assign';
import { checkR2, checkR3, hasQualifiedMember, normalizeSkillName, canonicalSkills, skillLevelFor } from '@/lib/scoring/rules';
import { computeSkillMatch, computeScore } from '@/lib/scoring/score';
import { matchingSkills, missingSkills } from '@/lib/scoring/explain-local';
import { smallestSplitThatFits, validateSplit, describeOverCap, toCsv, toPlainText } from '@/lib/scoring/interaction';
import { WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import type { Member, Task } from '@/lib/scoring/types';

/*
 * T-ROOT-CAUSE-03.
 *
 * The report that opened this ticket: 4 tasks, 8 members, ideal load 0.75 h,
 * R2 cap 0.9375 h, scores 47–55%, every candidate "GUGUR R2", every task also
 * showing an R3 warning, S shown as 0, and 0 of 4 tasks allocated.
 *
 * Two independent root causes were confirmed and are pinned below:
 *
 *   R2 — arithmetic, not a bug. Total effort 6 h ÷ 8 members = 0.75 h ideal,
 *        cap 1.25 × 0.75 = 0.9375 h. A 1 h task alone exceeds 0.9375 h, so no
 *        member can take it. R2 is implemented exactly as PRD 5.2 defines it
 *        and is NOT loosened here.
 *
 *   R3/S — a real bug. Members store skills as free text while tasks store
 *        taxonomy tags, and every lookup was an exact string comparison. A
 *        member holding the skill at level 5 under "Penulisan Akademik" scored
 *        S = 0 against the tag "penulisan akademik" and failed R3. That is a
 *        name-mapping defect, and it is fixed at the source.
 */

const CAP_TOTAL = 6; // hours of work in the reported scenario
const CAP_MEMBERS = 8;

/** The exact roster shape from the report: 8 members, generous capacity. */
function roster(eight = true): Member[] {
  const skills = { 'penulisan akademik': 4, 'riset literatur': 4 };
  const interests = { 'penulisan akademik': 4, 'riset literatur': 4 };
  return Array.from({ length: eight ? CAP_MEMBERS : 2 }, (_, i) => ({
    id: `m${i + 1}`,
    name: `Anggota ${i + 1}`,
    capacity: 40,
    skills: { ...skills },
    interests: { ...interests },
  }));
}

/** Four tasks totalling 6 hours, the same shape as the report. */
const FOUR_TASKS: Task[] = [
  { id: 't1', title: 'Tugas 1', difficulty: 2, estimated_hours: 1, required_skills: ['penulisan akademik'] },
  { id: 't2', title: 'Tugas 2', difficulty: 2, estimated_hours: 1, required_skills: ['penulisan akademik'] },
  { id: 't3', title: 'Tugas 3', difficulty: 2, estimated_hours: 2, required_skills: ['penulisan akademik'] },
  { id: 't4', title: 'Tugas 4', difficulty: 2, estimated_hours: 2, required_skills: ['penulisan akademik'] },
];

function cosineFor(tasks: Task[], members: Member[], value = 0.6) {
  const map: Record<string, Record<string, number>> = {};
  for (const task of tasks) {
    map[task.id] = {};
    for (const member of members) map[task.id][member.id] = value;
  }
  return map;
}

describe('T-ROOT-CAUSE-03 — Fase 1: the R2 numbers reproduce exactly', () => {
  it('derives ideal 0.75 h and cap 0.9375 h from 6 h across 8 members', () => {
    const members = roster();
    // The fixture must total the reported workload, or the numbers below would
    // be coincidental rather than a reproduction of what the user saw.
    const fixtureTotal = FOUR_TASKS.reduce((sum, task) => sum + task.estimated_hours, 0);
    expect(fixtureTotal).toBe(CAP_TOTAL);
    const result = globalAssign(FOUR_TASKS, members, [], { cosineMap: cosineFor(FOUR_TASKS, members) });
    expect(result.idealLoad).toBe(0.75);
    expect(result.idealLoad * WORKLOAD_CAP_MULTIPLIER).toBe(0.9375);
  });

  it('leaves all four tasks unassigned, as the report described', () => {
    const members = roster();
    const result = globalAssign(FOUR_TASKS, members, [], { cosineMap: cosineFor(FOUR_TASKS, members) });
    expect(result.assignments.filter((a) => a.primaryMemberId === '')).toHaveLength(4);
    expect(result.warnings.filter((w) => w.code === 'r2_no_candidate')).toHaveLength(4);
  });

  it('proves the cause is the 1 h task exceeding the 0.9375 h cap', () => {
    const members = roster();
    const result = globalAssign(FOUR_TASKS, members, [], { cosineMap: cosineFor(FOUR_TASKS, members) });
    // Nothing was assigned, so every member's load is still 0: R2 fails on the
    // task's own effort, not on accumulated work.
    expect(Object.values(result.memberLoads).every((load) => load === 0)).toBe(true);
    expect(checkR2(members[0], FOUR_TASKS[0], 0, result.idealLoad)).toBe(false);
    expect(1 <= 0.9375).toBe(false);
  });

  it('records exceedsCapAlone so the UI can say the task is too big by itself', () => {
    const members = roster();
    const result = globalAssign(FOUR_TASKS, members, [], { cosineMap: cosineFor(FOUR_TASKS, members) });
    for (const warning of result.warnings.filter((w) => w.code === 'r2_no_candidate')) {
      expect(warning.detail?.exceedsCapAlone).toBe(true);
    }
  });

  it('explains the shares correctly: no single-task assignment is possible for n >= 2', () => {
    /*
     * Algebra, not opinion. One task of H hours shared by n members gives
     * ideal = H/n and cap = 1.25·H/n. The task fits only when H <= 1.25·H/n,
     * i.e. n <= 1.25. With 8 members no single task can ever fit the cap, no
     * matter how small its estimate, because the cap scales with the same
     * effort. This is why R2 must not be "fixed" by loosening it: the rule is
     * behaving as specified, and the multiplication is what makes a lone task
     * unassignable.
     */
    for (const n of [2, 4, 8, 20]) {
      expect(n <= WORKLOAD_CAP_MULTIPLIER).toBe(false);
    }
    // With a single member the task fits exactly at the cap boundary.
    expect(1 <= WORKLOAD_CAP_MULTIPLIER).toBe(true);
  });

  it('is limited by the ratio, not by the count of tasks', () => {
    /*
     * Verified against the engine, and the result is the important finding:
     * what makes a task placeable is `taskHours <= 1.25·total/n`, i.e. the
     * task's share of the whole workload, never the number of tasks.
     *
     *   8 members, 8 tasks × 1 h  -> total 8, ideal 1, cap 1.25 -> all 8 placed
     *   8 members, 4 tasks × 2 h  -> total 8, ideal 1, cap 1.25 -> none placed
     *
     * Same total, same cap; the 2 h task is 2× the ideal share and the 1 h task
     * is exactly 1×. So the fix for the reported 0/4 is to make each task's
     * share small enough, which splitting does, and never to widen the cap.
     */
    const members = roster();
    const oneHour: Task[] = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      title: `Bagian ${i + 1}`,
      difficulty: 2,
      estimated_hours: 1,
      required_skills: ['penulisan akademik'],
    }));
    const placed = globalAssign(oneHour, members, [], { cosineMap: cosineFor(oneHour, members) });
    expect(placed.idealLoad).toBe(1);
    expect(placed.assignments.filter((a) => a.primaryMemberId !== '')).toHaveLength(8);

    // Two hours per task: the same total effort, but no task fits its share.
    const twoHour: Task[] = Array.from({ length: 4 }, (_, i) => ({
      id: `b${i}`,
      title: `Bagian ${i + 1}`,
      difficulty: 2,
      estimated_hours: 2,
      required_skills: ['penulisan akademik'],
    }));
    const blocked = globalAssign(twoHour, members, [], { cosineMap: cosineFor(twoHour, members) });
    expect(blocked.idealLoad).toBe(1); // identical ideal load
    expect(blocked.assignments.filter((a) => a.primaryMemberId !== '')).toHaveLength(0);
  });

  it('places every part once each part fits the share', () => {
    // The reported case: 4 tasks of 2 h. Splitting each into 2 × 1 h gives
    // 8 tasks of 1 h, total still 8 h, and all of them are placed.
    const members = roster();
    const parts: Task[] = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`,
      title: `Bagian ${i + 1}`,
      difficulty: 2,
      estimated_hours: 1,
      required_skills: ['penulisan akademik'],
    }));
    const result = globalAssign(parts, members, [], { cosineMap: cosineFor(parts, members) });
    const totalAssigned = Object.values(result.memberLoads).reduce((sum, load) => sum + load, 0);
    // Total effort is preserved exactly: splitting moved hours, it did not create them.
    expect(totalAssigned).toBe(parts.reduce((sum, t) => sum + t.estimated_hours, 0));
  });

  it('excludes members with 0 available hours from the divisor (R1)', () => {
    // One of two members is unavailable, so the ideal load is 6/1 = 6 h, not 3.
    const members: Member[] = [
      { id: 'a', name: 'Sibuk', capacity: 0, skills: { 'penulisan akademik': 5 } },
      { id: 'b', name: 'Luang', capacity: 40, skills: { 'penulisan akademik': 5 } },
    ];
    const total = FOUR_TASKS.reduce((sum, t) => sum + t.estimated_hours, 0);
    const result = globalAssign(FOUR_TASKS, members, [], { cosineMap: cosineFor(FOUR_TASKS, members) });
    expect(result.idealLoad).toBe(total / 1);
  });
});

/** The engine's `skills` map is typed by taxonomy tag, but real data holds free
 * text labels. That mismatch is the defect under test, so the fixtures cast. */
const freeTextSkills = (map: Record<string, number>) => map as Member['skills'];

describe('T-ROOT-CAUSE-03 — Fase 2: skill name mapping is the real R3 / S=0 defect', () => {
  it('normalises case, spacing, underscore and hyphen', () => {
    expect(normalizeSkillName('Penulisan Akademik')).toBe('penulisan akademik');
    expect(normalizeSkillName('penulisan_akademik')).toBe('penulisan akademik');
    expect(normalizeSkillName('  PENULISAN   AKADEMIK ')).toBe('penulisan akademik');
    expect(normalizeSkillName('riset-literatur')).toBe('riset literatur');
  });

  it('reproduces the S = 0 defect the report saw', () => {
    const task: Task = {
      id: 't',
      title: 'T',
      difficulty: 2,
      estimated_hours: 1,
      required_skills: ['penulisan akademik'],
    };
    // A member who really holds the skill at level 5, stored with a capital.
    const member: Member = { id: 'm', name: 'Ani', capacity: 40, skills: freeTextSkills({ 'Penulisan Akademik': 5 }) };
    // Before normalisation this returned 0; it must now be 5/5 = 1.
    expect(computeSkillMatch(task, { ...member, skills: { 'penulisan akademik': 5 } })).toBe(1);
    expect(computeSkillMatch(task, member)).toBe(1);
  });

  it('gives the same S for every spelling of the same skill (case 5 of the ticket)', () => {
    const task: Task = { id: 't', title: 'T', difficulty: 2, estimated_hours: 1, required_skills: ['penulisan akademik'] };
    const spellings = ['penulisan akademik', 'Penulisan Akademik', 'PENULISAN AKADEMIK', 'penulisan_akademik', 'penulisan-akademik', ' penulisan  akademik '];
    const scores = spellings.map((name) =>
      computeSkillMatch(task, { id: 'm', name: 'Ani', capacity: 40, skills: freeTextSkills({ [name]: 4 }) })
    );
    // All identical, and all non-zero: no spelling may silently score 0.
    expect(new Set(scores).size).toBe(1);
    expect(scores[0]).toBeCloseTo(4 / 5, 10);
  });

  it('makes R3 and S agree for a differently-spelled skill', () => {
    const task: Task = { id: 't', title: 'T', difficulty: 2, estimated_hours: 1, required_skills: ['penulisan akademik'] };
    const member: Member = { id: 'm', name: 'Ani', capacity: 40, skills: freeTextSkills({ 'Penulisan_Akademik': 4 }) };
    expect(hasQualifiedMember(task, [member])).toBe(true);
    expect(checkR3(task, [member]).map((m) => m.id)).toEqual(['m']);
    expect(matchingSkills(task, [member].length ? member : member)).toEqual(['penulisan akademik']);
    expect(missingSkills(task, member)).toEqual([]);
    expect(computeSkillMatch(task, member)).toBeCloseTo(0.8, 10);
  });

  it('keeps the highest level when two labels collapse to one skill', () => {
    const member: Member = {
      id: 'm',
      name: 'Ani',
      capacity: 40,
      skills: freeTextSkills({ 'penulisan akademik': 2, 'Penulisan Akademik': 5 }),
    };
    expect(canonicalSkills(member)['penulisan akademik']).toBe(5);
    expect(skillLevelFor(member, 'penulisan akademik')).toBe(5);
  });

  it('still reports R3 when nobody truly reaches level 3 (no invented skill)', () => {
    const task: Task = { id: 't', title: 'T', difficulty: 2, estimated_hours: 1, required_skills: ['penulisan akademik'] };
    const members: Member[] = [
      { id: 'm1', name: 'A', capacity: 40, skills: { 'penulisan akademik': 2 } },
      { id: 'm2', name: 'B', capacity: 40, skills: freeTextSkills({ 'Penulisan Akademik': 1 }) },
    ];
    expect(hasQualifiedMember(task, members)).toBe(false);
    // Fallback pool is the whole roster, and eligibility is withheld.
    expect(checkR3(task, members)).toHaveLength(2);
    expect(computeSkillMatch(task, members[0])).toBeCloseTo(2 / 5, 10);
  });

  it('ignores non-numeric and blank skill entries instead of crashing', () => {
    const member: Member = {
      id: 'm',
      name: 'Ani',
      capacity: 40,
      skills: freeTextSkills({ 'penulisan akademik': 4, '': 5, 'riset literatur': null as unknown as number }),
    };
    expect(skillLevelFor(member, 'penulisan akademik')).toBe(4);
    expect(skillLevelFor(member, 'riset literatur')).toBe(0);
    expect(canonicalSkills(member)['']).toBeUndefined();
  });

  it('resolves interest labels through the same normalisation', () => {
    const task: Task = { id: 't', title: 'T', difficulty: 2, estimated_hours: 1, required_skills: ['penulisan akademik'] };
    const exact: Member = { id: 'm', name: 'A', capacity: 40, skills: { 'penulisan akademik': 5 }, interests: { 'penulisan akademik': 5 } };
    const spaced: Member = { id: 'm', name: 'A', capacity: 40, skills: { 'penulisan akademik': 5 }, interests: freeTextSkills({ 'Penulisan Akademik': 5 }) };
    const a = computeScore(task, exact, 0, 4, 0.5);
    const b = computeScore(task, spaced, 0, 4, 0.5);
    expect(a.M).toBe(b.M);
    expect(a.M).toBe(1);
  });
});

describe('T-ROOT-CAUSE-03 — Fase 3 & 6: assignment engine invariants', () => {
  it('scores every candidate and decides eligibility separately from the score', () => {
    const members = roster();
    const result = globalAssign(FOUR_TASKS, members, [], { cosineMap: cosineFor(FOUR_TASKS, members) });
    for (const assignment of result.assignments) {
      expect(Object.keys(assignment.scores)).toHaveLength(members.length);
      for (const score of Object.values(assignment.scores)) {
        // Score stays a real comparison value even when the member is ineligible.
        expect(score.breakdown.total).toBeGreaterThan(0);
        expect(score.isEligible).toBe(false);
      }
    }
  });

  it('keeps a high score visible but never treats it as a valid assignment (case 10)', () => {
    const members = roster();
    const result = globalAssign(FOUR_TASKS, members, [], { cosineMap: cosineFor(FOUR_TASKS, members) });
    const top = Object.values(result.assignments[0].scores).sort(
      (a, b) => b.breakdown.total - a.breakdown.total
    )[0];
    expect(top.breakdown.total).toBeGreaterThan(0.4);
    expect(top.isEligible).toBe(false);
    // The point of the whole screen: score never becomes an owner.
    expect(result.assignments[0].primaryMemberId).toBe('');
  });

  it('never assigns a member who violates R2', () => {
    const members = roster(false); // 2 members
    const tasks: Task[] = [
      { id: 'a', title: 'Besar', difficulty: 3, estimated_hours: 8, required_skills: ['penulisan akademik'] },
    ];
    const result = globalAssign(tasks, members, [], { cosineMap: cosineFor(tasks, members) });
    expect(result.assignments[0].primaryMemberId).toBe('');
    expect(result.memberLoads).toEqual({ m1: 0, m2: 0 });
  });

  it('accumulates load across tasks and never double-counts one task (cases 6 and 9)', () => {
    // 2 members, 4 tasks of 1 h: ideal 2, cap 2.5, so each member can hold 2.
    const members = roster(false);
    const tasks: Task[] = Array.from({ length: 4 }, (_, i) => ({
      id: `t${i}`,
      title: `T${i}`,
      difficulty: 2,
      estimated_hours: 1,
      required_skills: ['penulisan akademik'],
    }));
    const result = globalAssign(tasks, members, [], { cosineMap: cosineFor(tasks, members) });
    const assignedTasks = result.assignments.filter((a) => a.primaryMemberId !== '').length;
    const totalLoad = Object.values(result.memberLoads).reduce((sum, load) => sum + load, 0);
    // The summed load equals the summed effort of the tasks actually assigned,
    // exactly once each: no task counted twice, none counted zero times.
    expect(totalLoad).toBe(assignedTasks * 1);
    for (const load of Object.values(result.memberLoads)) {
      expect(load).toBeLessThanOrEqual(result.idealLoad * WORKLOAD_CAP_MULTIPLIER);
    }
  });

  it('gives each assignment at most one owner (R4) and a distinct task row', () => {
    const members = roster(false);
    const tasks: Task[] = Array.from({ length: 4 }, (_, i) => ({
      id: `t${i}`,
      title: `T${i}`,
      difficulty: 2,
      estimated_hours: 1,
      required_skills: ['penulisan akademik'],
    }));
    const result = globalAssign(tasks, members, [], { cosineMap: cosineFor(tasks, members) });
    const ids = result.assignments.map((a) => a.taskId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const assignment of result.assignments) {
      expect(typeof assignment.primaryMemberId).toBe('string');
    }
  });

  it('keeps R5: a locked task keeps its owner even when overloaded', () => {
    const members = roster(false);
    const tasks: Task[] = [
      { id: 'a', title: 'Kecil', difficulty: 2, estimated_hours: 1, required_skills: ['penulisan akademik'] },
      { id: 'b', title: 'Besar', difficulty: 3, estimated_hours: 9, required_skills: ['penulisan akademik'] },
    ];
    const locked = [{ taskId: 'b', primaryMemberId: 'm1', isLocked: true, scores: {} }];
    const result = globalAssign(tasks, members, locked, { cosineMap: cosineFor(tasks, members) });
    const big = result.assignments.find((a) => a.taskId === 'b')!;
    expect(big.primaryMemberId).toBe('m1');
    expect(big.isLocked).toBe(true);
    expect(result.warnings.some((w) => w.code === 'r2_locked_overload')).toBe(true);
  });

  it('recomputes from new input instead of reusing a previous result', () => {
    const members = roster();
    const first = globalAssign(FOUR_TASKS, members, [], { cosineMap: cosineFor(FOUR_TASKS, members) });
    expect(first.idealLoad).toBe(0.75);
    // Same roster, different workload: the ideal load must follow the input.
    const small = FOUR_TASKS.slice(0, 2); // 2 hours
    const second = globalAssign(small, members, [], { cosineMap: cosineFor(small, members) });
    expect(second.idealLoad).toBe(0.25);
    expect(second.idealLoad).not.toBe(first.idealLoad);
  });
});

describe('T-ROOT-CAUSE-03 — Fase 6 case 1 & 2: a 2 h task against a 0.9375 h cap', () => {
  it('is not forced onto any member (case 1)', () => {
    const members = roster();
    const tasks: Task[] = [
      { id: 'x', title: 'Laporan', difficulty: 3, estimated_hours: 2, required_skills: ['penulisan akademik'] },
    ];
    // Total effort is only this task, so ideal = 2/8 = 0.25 and cap = 0.3125.
    const result = globalAssign(tasks, members, [], { cosineMap: cosineFor(tasks, members) });
    expect(result.assignments[0].primaryMemberId).toBe('');
    expect(result.warnings[0].detail?.exceedsCapAlone).toBe(true);
    expect(result.warnings[0].detail?.capHours).toBeCloseTo(0.3125, 10);
  });

  it('states the four figures and the small split that would fit', () => {
    const detail = { taskHours: 2, idealLoad: 0.75, capHours: 0.9375 };
    const over = describeOverCap(detail);
    // describeOverCap rounds to 2 decimals for display, so assert the displayed
    // value rather than the unrounded one.
    expect(over.excessHours).toBe(1.06);
    expect(over.summary).toContain('0.94');
    // Each part must be <= 0.9375, so 2 h needs at least 3 parts.
    expect(smallestSplitThatFits(detail.taskHours, detail.capHours)).toBe(3);
  });

  it('can be allocated once split into parts that each fit (case 2)', () => {
    /*
     * Splitting does not change the total, so the ideal load and the cap stay
     * put. What makes parts placeable is that each part is no larger than its
     * share of the work. With 4 tasks of 2 h the ideal is 1 h and the cap
     * 1.25 h, so a 2 h part is still over; splitting each into 2 × 1 h makes
     * every part exactly 1 h, which fits — and R3 is satisfied by the roster,
     * which the ticket insists must be checked separately.
     */
    const members = roster();
    const parts: Task[] = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`,
      title: `Bagian ${i + 1}`,
      difficulty: 2,
      estimated_hours: 1,
      required_skills: ['penulisan akademik'] as Task['required_skills'],
    }));
    const result = globalAssign(parts, members, [], { cosineMap: cosineFor(parts, members) });
    // 8 h across 8 members: ideal 1 h, cap 1.25 h, and every part is 1 h.
    expect(result.idealLoad).toBe(1);
    expect(result.idealLoad * WORKLOAD_CAP_MULTIPLIER).toBe(1.25);
    const assigned = result.assignments.filter((a) => a.primaryMemberId !== '');
    expect(assigned).toHaveLength(8);
    expect(result.warnings.filter((w) => w.code === 'r2_no_candidate')).toHaveLength(0);
  });

  it('keeps the split total equal to the parent estimate', () => {
    expect(validateSplit([{ hours: '2' }, { hours: '1' }], 3).ok).toBe(true);
    const short = validateSplit([{ hours: '1' }, { hours: '1' }], 3);
    expect(short.ok).toBe(false);
    expect(short.error).toContain('kurang 1 jam');
    const over = validateSplit([{ hours: '2' }, { hours: '2' }], 3);
    expect(over.ok).toBe(false);
    expect(over.error).toContain('lebih 1 jam');
  });

  it('records that splitting does not fix R3 by itself', () => {
    // Same parts, but an unqualified roster: R3 still fails on every part.
    const members: Member[] = Array.from({ length: 8 }, (_, i) => ({
      id: `m${i + 1}`,
      name: `Anggota ${i + 1}`,
      capacity: 40,
      skills: { 'penulisan akademik': 1 },
    }));
    const tasks: Task[] = Array.from({ length: 4 }, (_, i) => ({
      id: `p${i}`,
      title: `Bagian ${i + 1}`,
      difficulty: 2,
      estimated_hours: 2,
      required_skills: ['penulisan akademik'] as Task['required_skills'],
    }));
    const result = globalAssign(tasks, members, [], { cosineMap: cosineFor(tasks, members) });
    expect(result.warnings.filter((w) => w.code === 'r3_no_candidate').length).toBeGreaterThan(0);
    // Nobody is presented as a qualified owner.
    for (const assignment of result.assignments) {
      for (const score of Object.values(assignment.scores)) {
        expect(score.isEligible).toBe(false);
      }
    }
  });
});

describe('T-ROOT-CAUSE-03 — Fase 6 case 9: export and reload stay consistent', () => {
  it('carries the same eligibility and loads into CSV and plain text', () => {
    const members = roster();
    const result = globalAssign(FOUR_TASKS, members, [], { cosineMap: cosineFor(FOUR_TASKS, members) });
    const rows = result.assignments.map((assignment) => {
      const task = FOUR_TASKS.find((t) => t.id === assignment.taskId)!;
      const owner = members.find((m) => m.id === assignment.primaryMemberId);
      const score = assignment.primaryMemberId
        ? assignment.scores[assignment.primaryMemberId]
        : undefined;
      return {
        task: task.title,
        hours: task.estimated_hours,
        effort: task.difficulty,
        primary: owner?.name ?? '',
        alternative: '',
        // No verdict can be claimed for a row with no owner.
        eligibility: score ? (score.isEligible ? ('layak' as const) : ('tidak layak' as const)) : undefined,
        total: score ? String(Math.round(score.breakdown.total * 100)) : '',
        K: score ? String(Math.round(score.breakdown.K * 100)) : '',
        S: score ? String(Math.round(score.breakdown.S * 100)) : '',
        C: score ? String(Math.round(score.breakdown.C * 100)) : '',
        M: score ? String(Math.round(score.breakdown.M * 100)) : '',
        locked: 'tidak' as const,
        reason: '',
      };
    });
    const csv = toCsv(rows);
    const text = toPlainText(rows, {
      code: 'TEST',
      isFallback: false,
      weights: { K: 0.4, S: 0.3, C: 0.2, M: 0.1 },
      idealLoad: result.idealLoad,
      loads: members.map((m) => ({
        name: m.name,
        load: result.memberLoads[m.id] ?? 0,
        capacity: m.capacity,
        over: false,
      })),
    });
    // Every task appears in both exports rather than vanishing when unassigned.
    for (const task of FOUR_TASKS) {
      expect(csv).toContain(task.title);
      expect(text).toContain(task.title);
    }
    // The exported load line matches the engine's ideal load, not a re-derivation.
    // toPlainText prints one decimal, so 0.75 appears as "0.8" (toFixed(1)).
    expect(text).toContain(`Beban ideal: ${result.idealLoad.toFixed(1)} jam per anggota`);
  });

  it('produces byte-identical output for the same input (reload determinism)', () => {
    const members = roster();
    const a = globalAssign(FOUR_TASKS, members, [], { cosineMap: cosineFor(FOUR_TASKS, members) });
    const b = globalAssign(FOUR_TASKS, members, [], { cosineMap: cosineFor(FOUR_TASKS, members) });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('T-ROOT-CAUSE-03 — Fase 4 & 6 case 6: split must not double-count effort', () => {
  /*
   * The split feature creates one task per part and (since this ticket) deletes
   * the parent, because the parts already sum to the parent's estimate. These
   * tests pin the arithmetic that makes that safe: with the parent gone, the
   * workload the engine sees is exactly what the user described; with the parent
   * kept, the same work is counted twice and the ideal load doubles.
   */
  const PARENT: Task = {
    id: 'parent',
    title: 'Laporan akhir',
    difficulty: 3,
    estimated_hours: 3,
    required_skills: ['penulisan akademik'],
  };
  const PARTS: Task[] = [
    { id: 'part1', title: 'Laporan akhir (bagian 1)', difficulty: 3, estimated_hours: 2, required_skills: ['penulisan akademik'] },
    { id: 'part2', title: 'Laporan akhir (bagian 2)', difficulty: 3, estimated_hours: 1, required_skills: ['penulisan akademik'] },
  ];

  it('keeps the total effort equal to the parent when the parent is removed', () => {
    const partsOnly = globalAssign(PARTS, roster(), [], { cosineMap: cosineFor(PARTS, roster()) });
    const partsTotal = PARTS.reduce((sum, t) => sum + t.estimated_hours, 0);
    // ideal = total ÷ members, so it reveals the total the engine actually used.
    expect(partsOnly.idealLoad).toBe(partsTotal / CAP_MEMBERS);
    expect(partsTotal).toBe(PARENT.estimated_hours);
  });

  it('counts the effort twice if the parent is left behind, which is the bug', () => {
    const withParent = [...PARTS, PARENT];
    const result = globalAssign(withParent, roster(), [], { cosineMap: cosineFor(withParent, roster()) });
    const doubledTotal = PARTS.reduce((sum, t) => sum + t.estimated_hours, 0) + PARENT.estimated_hours;
    expect(result.idealLoad).toBe(doubledTotal / CAP_MEMBERS);
    // 2× the real workload, so the ideal load and the cap are both inflated and
    // the parent shows up as an extra unassignable task.
    expect(result.idealLoad).toBe((PARENT.estimated_hours * 2) / CAP_MEMBERS);
  });

  it('rejects a split whose parts do not sum to the parent', () => {
    // The UI deletes the parent only after this validation passes.
    expect(validateSplit([{ hours: '2' }, { hours: '1' }], PARENT.estimated_hours).ok).toBe(true);
    expect(validateSplit([{ hours: '2' }, { hours: '2' }], PARENT.estimated_hours).ok).toBe(false);
    expect(validateSplit([{ hours: '1' }, { hours: '1' }], PARENT.estimated_hours).ok).toBe(false);
  });

  it('gives every part its own single owner', () => {
    /*
     * Parts only become placeable when each part is no larger than the average
     * share. Two parts of 2 h + 1 h across 8 members give ideal 0.375 h and cap
     * 0.47 h, so neither fits — the same ratio rule as above. With 8 h of parts
     * across 8 members the average share is 1 h and 1 h parts fit.
     */
    const members = roster();
    const placeable: Task[] = Array.from({ length: 8 }, (_, i) => ({
      id: `q${i}`,
      title: `Bagian ${i + 1}`,
      difficulty: 2,
      estimated_hours: 1,
      required_skills: ['penulisan akademik'],
    }));
    const result = globalAssign(placeable, members, [], { cosineMap: cosineFor(placeable, members) });
    expect(result.assignments).toHaveLength(8);
    for (const assignment of result.assignments) {
      expect(assignment.primaryMemberId).not.toBe('');
    }
    // R4: one owner per part, and no member appears twice on the same task.
    const ownedTasks = new Set(result.assignments.map((a) => a.taskId));
    expect(ownedTasks.size).toBe(8);
  });

  it('re-checks R3 for every part rather than inheriting the parent verdict', () => {
    // A roster qualified for the parent's skill is qualified for every part,
    // but the check runs per task — not once for the parent.
    const members = roster();
    for (const part of PARTS) {
      expect(hasQualifiedMember(part, members)).toBe(true);
    }
    // And with an unqualified roster, every part fails R3 on its own.
    const unqualified: Member[] = Array.from({ length: CAP_MEMBERS }, (_, i) => ({
      id: `u${i}`,
      name: `U${i}`,
      capacity: 40,
      skills: { 'penulisan akademik': 1 },
    }));
    for (const part of PARTS) {
      expect(hasQualifiedMember(part, unqualified)).toBe(false);
    }
  });
});
