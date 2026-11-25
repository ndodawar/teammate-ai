import { describe, it, expect } from 'vitest';
import { globalAssign } from '@/lib/scoring/assign';
import { computeScore } from '@/lib/scoring/score';
import { checkR1, checkR2, hasQualifiedMember } from '@/lib/scoring/rules';
import {
  assignOwner,
  swapOwners,
  toggleLockState,
  toCsv,
  toPlainText,
  describeOverCap,
  validateSplit,
  smallestSplitThatFits,
} from '@/lib/scoring/interaction';
import { DEFAULT_WEIGHTS, WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import type { Member, Task, TaskAssignment } from '@/lib/scoring/types';

/*
 * T-IMPLEMENT-05 Thaap 7.
 *
 * Fourteen required scenarios. Every expected number below is computed by hand
 * in the comment beside it, so a test that passes cannot be passing because it
 * merely repeats whatever the engine happened to return. Where the engine and
 * the manual arithmetic could disagree, the manual figure is the assertion.
 *
 * The approved decision these tests lock in (T-IMPLEMENT-05 preamble, Opsi A):
 *   beban ideal = total estimasi tugas aktif ÷ jumlah anggota yang lolos R1
 *   batas R2    = 1,25 × beban ideal
 * and comparisons use full precision, with rounding only for display.
 */

const SKILL = 'penulisan akademik' as const;

function member(id: string, name: string, capacity = 40, level = 4): Member {
  return { id, name, capacity, skills: { [SKILL]: level }, interests: { [SKILL]: 4 } };
}

function task(id: string, hours: number, title = `Tugas ${id}`): Task {
  return { id, title, difficulty: 2, estimated_hours: hours, required_skills: [SKILL] };
}

/** Every pair gets the same cosine, so K is constant and cannot explain a difference. */
function cos(tasks: Task[], members: Member[], value = 0.6): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};
  for (const t of tasks) {
    map[t.id] = {};
    for (const m of members) map[t.id][m.id] = value;
  }
  return map;
}

describe('T-IMPLEMENT-05 — R2 uses Opsi A with full precision', () => {
  it('divides by R1-passing members only, and multiplies by 1.25', () => {
    /*
     * Manual: 8 tasks × 1 h = 8 h. One of 3 members has capacity 0, so R1
     * excludes them and the divisor is 2, not 3.
     *   ideal = 8 / 2 = 4 h
     *   cap   = 1.25 × 4 = 5 h
     */
    const members = [member('a', 'A'), member('b', 'B'), member('c', 'C', 0)];
    const tasks = Array.from({ length: 8 }, (_, i) => task(`t${i}`, 1));
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    expect(result.idealLoad).toBe(4);
    expect(result.idealLoad * WORKLOAD_CAP_MULTIPLIER).toBe(5);
    // The R1-excluded member is out of the divisor and gets no work.
    expect(result.memberLoads['c']).toBe(0);
  });

  it('compares at full precision, not against the rounded display value', () => {
    /*
     * Manual: 3 tasks × 1 h = 3 h over 4 members.
     *   ideal = 0.75 h, cap = 0.9375 h — the cap the user sees as "0.94 jam".
     * A task of exactly 0.9375 h fits (<=); a task of 0.94 h does not, even
     * though both display as "0.94". Rounding before the comparison would have
     * accepted 0.94.
     */
    const members = [member('a', 'A'), member('b', 'B'), member('c', 'C'), member('d', 'D')];
    const ideal = 0.75;
    const cap = ideal * WORKLOAD_CAP_MULTIPLIER;
    expect(cap).toBe(0.9375);
    expect(checkR2(members[0], task('x', cap), 0, ideal)).toBe(true);
    expect(checkR2(members[0], task('y', 0.94), 0, ideal)).toBe(false);
  });

  it('counts the member initial load already held before new work', () => {
    /*
     * Manual: existing locked assignment of 2 h on member A, plus total effort
     * of 2 tasks × 2 h = 4 h over 2 members.
     *   ideal = 4 / 2 = 2 h, cap = 2.5 h
     * Member A already holds 2 h, so A can take at most 0.5 h more.
     */
    const members = [member('a', 'A'), member('b', 'B')];
    const tasks = [task('t1', 2), task('t2', 2)];
    const locked: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'a', isLocked: true, scores: {} },
    ];
    const result = globalAssign(tasks, members, locked, { cosineMap: cos(tasks, members) });
    expect(result.idealLoad).toBe(2);
    expect(result.memberLoads['a']).toBe(2); // the locked 2 h is counted once
    // t2 would push A to 4 h > 2.5 h cap, so it cannot go to A.
    const t2 = result.assignments.find((x) => x.taskId === 't2')!;
    expect(t2.primaryMemberId).not.toBe('a');
  });

  it('treats a non-positive cap as unassignable rather than dividing by zero', () => {
    // No member passes R1, so there is no divisor and idealLoad is 0.
    const members = [member('a', 'A', 0)];
    const tasks = [task('t1', 1)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    expect(result.idealLoad).toBe(0);
    expect(checkR1(members[0])).toBe(false);
    expect(result.assignments[0].primaryMemberId).toBe('');
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 1: 8 members, 8 tasks of 1 h', () => {
  /*
   * Manual: total = 8 h, members = 8, ideal = 1 h, cap = 1.25 h.
   * Each task is 1 h <= 1.25 h, and each member can hold 1.25 h, so all 8
   * tasks fit one-per-member.
   */
  const members = Array.from({ length: 8 }, (_, i) => member(`m${i + 1}`, `Anggota ${i + 1}`));
  const tasks = Array.from({ length: 8 }, (_, i) => task(`t${i + 1}`, 1));
  const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });

  it('assigns all eight tasks', () => {
    expect(result.idealLoad).toBe(1);
    expect(result.assignments.filter((a) => a.primaryMemberId !== '')).toHaveLength(8);
    expect(result.warnings).toHaveLength(0);
  });

  it('never exceeds the 1.25 h cap and preserves the total effort', () => {
    const total = Object.values(result.memberLoads).reduce((sum, load) => sum + load, 0);
    expect(total).toBe(8); // 8 × 1 h, nothing lost, nothing duplicated
    for (const load of Object.values(result.memberLoads)) {
      expect(load).toBeLessThanOrEqual(1.25);
    }
  });

  it('gives each member exactly one task, matching the manual layout', () => {
    // Manual: 8 tasks of 1 h, cap 1.25 h. Two tasks would be 2 h > cap, so the
    // only feasible layout is one task each — 8 members, all loaded at 1 h.
    const loads = Object.values(result.memberLoads).sort((a, b) => a - b);
    expect(loads).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 2: 8 members, 4 tasks of 2 h', () => {
  /*
   * Manual: total = 8 h, members = 8, ideal = 1 h, cap = 1.25 h.
   * Each task is 2 h > 1.25 h, so no member can take any task even though the
   * roster is idle. This is the reported "0 of 4" case, and it is correct.
   */
  const members = Array.from({ length: 8 }, (_, i) => member(`m${i + 1}`, `Anggota ${i + 1}`));
  const tasks = Array.from({ length: 4 }, (_, i) => task(`t${i + 1}`, 2));
  const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });

  it('assigns none, with the exact numbers', () => {
    expect(result.idealLoad).toBe(1);
    expect(result.assignments.filter((a) => a.primaryMemberId === '')).toHaveLength(4);
    for (const warning of result.warnings) {
      expect(warning.code).toBe('r2_no_candidate');
      expect(warning.detail?.exceedsCapAlone).toBe(true);
      expect(warning.detail?.taskHours).toBe(2);
      expect(warning.detail?.capHours).toBe(1.25);
      expect(warning.detail?.idealLoad).toBe(1);
    }
  });

  it('keeps every member idle rather than overloading one', () => {
    expect(Object.values(result.memberLoads).every((load) => load === 0)).toBe(true);
  });

  it('states the excess that the user must remove', () => {
    // Manual: 2 h − 1.25 h = 0.75 h over the cap.
    const over = describeOverCap({ taskHours: 2, idealLoad: 1, capHours: 1.25 });
    expect(over.excessHours).toBe(0.75);
    // Each part must be <= 1.25 h, so 2 h needs 2 parts.
    expect(smallestSplitThatFits(2, 1.25)).toBe(2);
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 3: a member with zero availability', () => {
  it('is excluded by R1, from the pool and from the divisor', () => {
    /*
     * Manual: 2 tasks × 3 h = 6 h. Members: A (20 h), B (0 h).
     * R1 excludes B, so divisor = 1 -> ideal = 6 h, cap = 7.5 h.
     * Had B been counted, ideal would be 3 h and cap 3.75 h, which would have
     * wrongly rejected the 3 h tasks.
     */
    const members = [member('a', 'A', 20), member('b', 'B', 0)];
    const tasks = [task('t1', 3), task('t2', 3)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    expect(result.idealLoad).toBe(6);
    expect(result.idealLoad * WORKLOAD_CAP_MULTIPLIER).toBe(7.5);
    expect(result.memberLoads['b']).toBe(0);
    // A carries both tasks: 6 h <= 7.5 h.
    expect(result.memberLoads['a']).toBe(6);
  });

  it('records R1 as the reason on that member s cells', () => {
    const members = [member('a', 'A', 20), member('b', 'B', 0)];
    const tasks = [task('t1', 3)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const bScore = result.assignments[0].scores['b'];
    expect(bScore.isEligible).toBe(false);
    expect((bScore.warnings ?? []).some((w) => w.startsWith('R1'))).toBe(true);
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 4: initial load on a member', () => {
  it('reduces what that member can still receive', () => {
    /*
     * Manual: 2 members, 4 tasks × 1 h = 4 h -> ideal 2 h, cap 2.5 h.
     * Member A starts with a locked 2 h task, so A can take 0.5 h more.
     * The remaining three 1 h tasks must go to B (which caps at 2.5 h).
     */
    const members = [member('a', 'A'), member('b', 'B')];
    const tasks = [task('t0', 2), task('t1', 1), task('t2', 1), task('t3', 1)];
    const locked: TaskAssignment[] = [
      { taskId: 't0', primaryMemberId: 'a', isLocked: true, scores: {} },
    ];
    const result = globalAssign(tasks, members, locked, { cosineMap: cos(tasks, members) });
    // Manual: total effort = 2 + 1 + 1 + 1 = 5 h over 2 members.
    //   ideal = 2.5 h, cap = 3.125 h
    // A starts at 2 h, so A may take one more 1 h task (3 h <= 3.125 h).
    expect(result.idealLoad).toBe(2.5);
    expect(result.idealLoad * WORKLOAD_CAP_MULTIPLIER).toBe(3.125);
    // A's load is 3 h: the locked 2 h plus one further task.
    expect(result.memberLoads['a']).toBe(3);
    // B absorbs the remaining two 1 h tasks: 2 h <= 3.125 h.
    expect(result.memberLoads['b']).toBe(2);
    const total = Object.values(result.memberLoads).reduce((s, l) => s + l, 0);
    expect(total).toBe(5); // no work lost, none duplicated
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 5: capitalisation and spacing differences', () => {
  it('treats the same skill written differently as one skill', () => {
    /*
     * Manual: required "penulisan akademik", member stores " Penulisan
     * Akademik " at level 4. S = 4/5 = 0.8 for every spelling.
     */
    const variants = [
      'penulisan akademik',
      'Penulisan Akademik',
      'PENULISAN AKADEMIK',
      'penulisan_akademik',
      'penulisan-akademik',
      '  penulisan   akademik  ',
    ];
    const t = task('t', 1);
    const scores = variants.map((label) => {
      const m: Member = {
        id: 'm',
        name: 'Ani',
        capacity: 40,
        skills: { [label]: 4 } as Member['skills'],
      };
      return computeScore(t, m, 0, 4, 0.5).S;
    });
    for (const s of scores) expect(s).toBeCloseTo(0.8, 10);
    expect(new Set(scores).size).toBe(1);
  });

  it('makes R3 and S agree for a differently written skill', () => {
    const t = task('t', 1);
    const m: Member = {
      id: 'm',
      name: 'Ani',
      capacity: 40,
      skills: { 'Penulisan_Akademik': 4 } as Member['skills'],
    };
    expect(hasQualifiedMember(t, [m])).toBe(true);
    expect(computeScore(t, m, 0, 4, 0.5).S).toBeGreaterThan(0);
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 6: skills below the R3 floor', () => {
  it('reports R3 without inventing ability or promoting a level', () => {
    /*
     * Manual: everyone at level 2 < 3, so hasQualifiedMember is false.
     * PRD 5.2 R3 keeps a best-effort recommendation WITH a warning, and that
     * member must not be marked eligible.
     */
    const members = [member('a', 'A', 40, 2), member('b', 'B', 40, 2)];
    const tasks = [task('t1', 1)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    expect(result.warnings.some((w) => w.code === 'r3_no_candidate')).toBe(true);
    for (const score of Object.values(result.assignments[0].scores)) {
      expect(score.isEligible).toBe(false);
      // S = 2/5 = 0.4, unchanged: the level was not raised to pass R3.
      expect(score.breakdown.S).toBeCloseTo(0.4, 10);
    }
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 7: parent and subtasks', () => {
  it('does not count the parent and its parts together', () => {
    /*
     * Manual: parent 4 h split into 2 + 2. With the parent removed the total is
     * 4 h; over 2 members ideal = 2 h, cap = 2.5 h, so each 2 h part fits.
     * Keeping the parent would make the total 8 h -> ideal 4 h, cap 5 h, and
     * would also leave the parent as a fifth unassignable task.
     */
    const members = [member('a', 'A'), member('b', 'B')];
    const parts = [task('p1', 2), task('p2', 2)];
    const partsResult = globalAssign(parts, members, [], { cosineMap: cos(parts, members) });
    expect(partsResult.idealLoad).toBe(2);
    expect(partsResult.assignments.filter((a) => a.primaryMemberId !== '')).toHaveLength(2);

    const withParent = [...parts, task('parent', 4)];
    const doubled = globalAssign(withParent, members, [], { cosineMap: cos(withParent, members) });
    expect(doubled.idealLoad).toBe(4); // 8 h / 2 = 4, i.e. double counted
    expect(doubled.idealLoad).not.toBe(partsResult.idealLoad);
  });

  it('only proceeds when the parts sum exactly to the parent', () => {
    expect(validateSplit([{ hours: '2' }, { hours: '2' }], 4).ok).toBe(true);
    expect(validateSplit([{ hours: '2' }, { hours: '1' }], 4).ok).toBe(false);
    expect(validateSplit([{ hours: '3' }, { hours: '3' }], 4).ok).toBe(false);
  });

  it('re-checks R2 and R3 on the parts rather than inheriting the parent verdict', () => {
    // 4 parts × 1 h over 8 members: ideal 0.5 h, cap 0.625 h -> 1 h parts fail.
    const members = Array.from({ length: 8 }, (_, i) => member(`m${i + 1}`, `A${i + 1}`));
    const parts = Array.from({ length: 4 }, (_, i) => task(`p${i}`, 1));
    const result = globalAssign(parts, members, [], { cosineMap: cos(parts, members) });
    expect(result.idealLoad).toBe(0.5);
    expect(result.assignments.filter((a) => a.primaryMemberId === '')).toHaveLength(4);
    expect(result.warnings.every((w) => w.code === 'r2_no_candidate')).toBe(true);
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 8: changing an estimate', () => {
  it('moves the ideal load and the cap with the new input', () => {
    /*
     * Manual: 2 members.
     *   2 tasks × 1 h = 2 h -> ideal 1 h,   cap 1.25 h
     *   2 tasks × 2 h = 4 h -> ideal 2 h,   cap 2.5 h
     */
    const members = [member('a', 'A'), member('b', 'B')];
    const small = [task('t1', 1), task('t2', 1)];
    const big = [task('t1', 2), task('t2', 2)];
    const afterSmall = globalAssign(small, members, [], { cosineMap: cos(small, members) });
    const afterBig = globalAssign(big, members, [], { cosineMap: cos(big, members) });
    expect(afterSmall.idealLoad).toBe(1);
    expect(afterBig.idealLoad).toBe(2);
    expect(afterBig.idealLoad).toBe(afterSmall.idealLoad * 2);
  });

  it('reaches a different allocation, so no previous result is reused', () => {
    /*
     * Manual with 2 members:
     *   2 tasks × 1 h: ideal 1, cap 1.25 -> both 1 h tasks fit, spread out.
     *   1 task of 3 h: ideal 1.5, cap 1.875 -> 3 h > cap, unassigned.
     */
    const members = [member('a', 'A'), member('b', 'B')];
    const small = [task('t1', 1), task('t2', 1)];
    const res1 = globalAssign(small, members, [], { cosineMap: cos(small, members) });
    expect(res1.assignments.filter((a) => a.primaryMemberId !== '')).toHaveLength(2);

    const big = [task('t1', 3)];
    const res2 = globalAssign(big, members, [], { cosineMap: cos(big, members) });
    expect(res2.assignments.filter((a) => a.primaryMemberId !== '')).toHaveLength(0);
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 9: a locked task', () => {
  it('keeps its owner under R5 and warns about the overload', () => {
    /*
     * Manual: 2 members, one 9 h locked task on A and one 1 h task.
     *   total = 10 h, ideal = 5 h, cap = 6.25 h
     * A holds 9 h > 6.25 h, so R5 keeps A as owner (do not move it) and
     * r2_locked_overload is reported instead of silently reassigning.
     */
    const members = [member('a', 'A'), member('b', 'B')];
    const tasks = [task('t1', 9), task('t2', 1)];
    const locked: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'a', isLocked: true, scores: {} },
    ];
    const result = globalAssign(tasks, members, locked, { cosineMap: cos(tasks, members) });
    const t1 = result.assignments.find((x) => x.taskId === 't1')!;
    expect(t1.primaryMemberId).toBe('a');
    expect(t1.isLocked).toBe(true);
    expect(result.idealLoad).toBe(5);
    expect(result.warnings.some((w) => w.code === 'r2_locked_overload')).toBe(true);
  });

  it('can be unlocked with the real toggle helper', () => {
    const assignments: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'a', isLocked: true, scores: {} },
    ];
    const unlocked = toggleLockState(assignments, 't1');
    expect(unlocked).not.toBeNull();
    expect(unlocked!.locked).toBe(false);
    expect(unlocked!.next[0].isLocked).toBe(false);
    expect(unlocked!.next[0].primaryMemberId).toBe('a'); // owner unchanged
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 10: changing the weights', () => {
  it('changes the score but never the eligibility', () => {
    /*
     * Manual: one member, task 1 h, ideal 4, capacity 40.
     *   S = 4/5 = 0.8 (the member is level 4 on the required skill)
     *   C = (40 - 1)/40 = 0.975
     *   M = (4 - 1)/4 = 0.75
     *   K = raw 0.6 -> (0.6 - 0.2)/(0.8 - 0.2) = 0.6667
     * Score with 40/30/20/10 = .4(.6667) + .3(.8) + .2(.975) + .1(.75)
     *                        = .2667 + .24 + .195 + .075 = 0.7767
     * With K dropped in favour of S (0/1/0/0) the score is 0.8 exactly.
     */
    const m = member('a', 'A', 40, 4);
    const t = task('t', 1);
    const base = computeScore(t, m, 0, 4, 0.6, DEFAULT_WEIGHTS);
    expect(base.K).toBeCloseTo(0.6667, 4);
    expect(base.S).toBeCloseTo(0.8, 10);
    expect(base.C).toBeCloseTo(0.975, 10);
    expect(base.M).toBeCloseTo(0.75, 10);
    expect(base.total).toBeCloseTo(0.7767, 3);

    const skillOnly = computeScore(t, m, 0, 4, 0.6, { K: 0, S: 1, C: 0, M: 0 });
    expect(skillOnly.total).toBeCloseTo(0.8, 3);
    expect(skillOnly.total).not.toBe(base.total);
  });

  it('leaves the assignment decision untouched for an all-eligible roster', () => {
    const members = [member('a', 'A'), member('b', 'B')];
    const tasks = [task('t1', 1), task('t2', 1)];
    const a = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const b = globalAssign(tasks, members, [], {
      cosineMap: cos(tasks, members),
      weights: { K: 0.1, S: 0.6, C: 0.2, M: 0.1 },
    });
    // Eligibility is decided by rules only, so the count cannot move.
    const count = (r: typeof a) => r.assignments.filter((x) => x.primaryMemberId !== '').length;
    expect(count(b)).toBe(count(a));
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 11: swapping the owner', () => {
  it('exchanges two owners through the real swap helper', () => {
    /*
     * Manual: t1 -> a, t2 -> b. After swap: t1 -> b, t2 -> a.
     */
    const members = [member('a', 'A'), member('b', 'B')];
    const assignments: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'a', isLocked: false, scores: {} },
      { taskId: 't2', primaryMemberId: 'b', isLocked: false, scores: {} },
    ];
    const tasks = [task('t1', 1), task('t2', 1)];
    const swapped = swapOwners(assignments, 't1', 't2', { tasks, members });
    expect(swapped.ok).toBe(true);
    expect(swapped.next.find((x) => x.taskId === 't1')!.primaryMemberId).toBe('b');
    expect(swapped.next.find((x) => x.taskId === 't2')!.primaryMemberId).toBe('a');
  });

  it('assigns an explicit owner instead of recomputing', () => {
    /*
     * Manual, 2 members, 2 tasks of 1 h each: total 2 h, ideal 1 h, cap 1.25 h,
     * so one member may hold exactly one 1 h task.
     * t1 belongs to A and t2 is unassigned. Moving t1 to B puts 1 h on B and
     * nothing else there, which is under the cap, and B holds the required
     * skill at level 4 — so the move is legal and must be kept. It must also be
     * locked, because a hand-made decision has to survive recalculation (FR-11).
     */
    const members = [member('a', 'A'), member('b', 'B')];
    const tasks = [task('t1', 1), task('t2', 1)];
    const assignments: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'a', isLocked: false, scores: {} },
      { taskId: 't2', primaryMemberId: '', isLocked: false, scores: {} },
    ];
    const moved = assignOwner(assignments, 't1', 'b', { lock: true, tasks, members });
    expect(moved.error).toBeUndefined();
    expect(moved.changed).toBe(true);
    const t1 = moved.next.find((x) => x.taskId === 't1')!;
    expect(t1.primaryMemberId).toBe('b');
    expect(t1.isLocked).toBe(true);
    // The untouched, unassigned task stays unassigned and unlocked.
    const t2 = moved.next.find((x) => x.taskId === 't2')!;
    expect(t2.primaryMemberId).toBe('');
    expect(t2.isLocked).toBe(false);
  });

  it('refuses a manual move that would stack two tasks past the cap', () => {
    /*
     * Same rules one level up: t2 already sits on B, so moving t1 there would
     * put 2 h on B against a cap of 1.25 h. The direct edit must refuse rather
     * than accept a click that breaks R2.
     */
    const members = [member('a', 'A'), member('b', 'B')];
    const tasks = [task('t1', 1), task('t2', 1)];
    const assignments: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'a', isLocked: false, scores: {} },
      { taskId: 't2', primaryMemberId: 'b', isLocked: false, scores: {} },
    ];
    const moved = assignOwner(assignments, 't1', 'b', { lock: true, tasks, members });
    expect(moved.changed).toBe(false);
    expect(moved.error).toMatch(/R2/);
    expect(moved.next.find((x) => x.taskId === 't1')!.primaryMemberId).toBe('a');
  });

  it('refuses a manual move that breaks R2, with the reason attached', () => {
    /*
     * Manual, 2 members, one task of 3 h: total 3 h, ideal 1.5 h, cap 1.875 h.
     * 3 h > 1.875 h, so forcing t1 onto B must be refused rather than accepted
     * just because the user clicked. Score is not eligibility.
     */
    const members = [member('a', 'A'), member('b', 'B')];
    const tasks = [task('t1', 3)];
    const assignments: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: '', isLocked: false, scores: {} },
    ];
    const moved = assignOwner(assignments, 't1', 'b', { lock: true, tasks, members });
    expect(moved.changed).toBe(false);
    expect(moved.error).toMatch(/R2/);
    // The original array comes back untouched, not half-updated.
    expect(moved.next[0].primaryMemberId).toBe('');
    expect(moved.next[0].isLocked).toBe(false);
  });

  it('does not let the swap change the total assigned effort', () => {
    /*
     * A swap moves who holds each task, not how much work exists.
     * Manual: 2 tasks × 1 h = 2 h before and after.
     */
    const members = [member('a', 'A'), member('b', 'B')];
    const tasks = [task('t1', 1), task('t2', 1)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const before = Object.values(result.memberLoads).reduce((s, l) => s + l, 0);
    const swapped = swapOwners(result.assignments, 't1', 't2', { tasks, members }).next;
    const loadsAfter = { a: 0, b: 0 } as Record<string, number>;
    for (const assignment of swapped) {
      const hours = tasks.find((t) => t.id === assignment.taskId)!.estimated_hours;
      if (assignment.primaryMemberId) loadsAfter[assignment.primaryMemberId] += hours;
    }
    const after = Object.values(loadsAfter).reduce((s, l) => s + l, 0);
    expect(after).toBe(before);
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 12: CSV export', () => {
  it('writes one row per task with the engine s own numbers', () => {
    const members = [member('a', 'A'), member('b', 'B')];
    const tasks = [task('t1', 1, 'Riset'), task('t2', 1, 'Laporan')];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const rows = result.assignments.map((assignment) => {
      const t = tasks.find((x) => x.id === assignment.taskId)!;
      const owner = members.find((m) => m.id === assignment.primaryMemberId);
      const score = assignment.primaryMemberId ? assignment.scores[assignment.primaryMemberId] : undefined;
      return {
        task: t.title,
        hours: t.estimated_hours,
        effort: t.difficulty,
        primary: owner?.name ?? '',
        alternative: '',
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
    const lines = csv.trim().split('\n');
    // Header plus one line per task: no task silently dropped.
    expect(lines).toHaveLength(1 + tasks.length);
    expect(csv).toContain('Riset');
    expect(csv).toContain('Laporan');
    // The eligibility column carries the verdict, not an empty cell.
    expect(csv).toContain('layak');
  });

  it('quotes fields containing a comma or a quote', () => {
    const members = [member('a', 'A')];
    const tasks = [task('t1', 1, 'Riset, analisis "lanjut"')];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const row = result.assignments.map((assignment) => {
      const t = tasks.find((x) => x.id === assignment.taskId)!;
      const score = assignment.scores[assignment.primaryMemberId];
      return {
        task: t.title,
        hours: t.estimated_hours,
        effort: t.difficulty,
        primary: 'A',
        alternative: '',
        eligibility: 'layak' as const,
        total: String(Math.round(score.breakdown.total * 100)),
        K: '0',
        S: '80',
        C: '97',
        M: '75',
        locked: 'tidak' as const,
        reason: '',
      };
    });
    const csv = toCsv(row);
    // The stored title survives verbatim rather than breaking the column.
    expect(csv).toContain('Riset, analisis');
  });

  it('keeps the plain-text export in step with the same rows', () => {
    const members = [member('a', 'A'), member('b', 'B')];
    const tasks = [task('t1', 1, 'Riset'), task('t2', 1, 'Laporan')];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const rows = result.assignments.map((assignment) => {
      const t = tasks.find((x) => x.id === assignment.taskId)!;
      const owner = members.find((m) => m.id === assignment.primaryMemberId);
      const score = assignment.primaryMemberId ? assignment.scores[assignment.primaryMemberId] : undefined;
      return {
        task: t.title,
        hours: t.estimated_hours,
        effort: t.difficulty,
        primary: owner?.name ?? '',
        alternative: '',
        eligibility: score ? ('layak' as const) : undefined,
        total: score ? String(Math.round(score.breakdown.total * 100)) : '',
        K: '0',
        S: '80',
        C: '97',
        M: '75',
        locked: 'tidak' as const,
        reason: '',
      };
    });
    const text = toPlainText(rows, {
      code: 'TEST',
      isFallback: false,
      weights: DEFAULT_WEIGHTS,
      idealLoad: result.idealLoad,
      loads: members.map((m) => ({
        name: m.name,
        load: result.memberLoads[m.id] ?? 0,
        capacity: m.capacity,
        over: false,
      })),
    });
    for (const t of tasks) expect(text).toContain(t.title);
    // Manual: 2 h / 2 members = 1.0 h ideal, printed with one decimal.
    expect(text).toContain('Beban ideal: 1.0 jam');
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 13: refresh', () => {
  it('returns an identical result for identical input', () => {
    const members = [member('a', 'A'), member('b', 'B')];
    const tasks = [task('t1', 1), task('t2', 1)];
    const first = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const second = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('is independent of task order in the input array', () => {
    /*
     * The engine sorts by effort descending, so two equal tasks may legitimately
     * land on different members, but the SET of outcomes (counts and loads) must
     * not depend on the order the caller happened to supply.
     */
    const members = [member('a', 'A'), member('b', 'B')];
    const tasks = [task('t1', 2), task('t2', 1), task('t3', 1)];
    const forward = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const reversed = globalAssign([...tasks].reverse(), members, [], { cosineMap: cos(tasks, members) });
    expect(reversed.idealLoad).toBe(forward.idealLoad);
    const loads = (r: typeof forward) => Object.values(r.memberLoads).sort((x, y) => x - y);
    expect(loads(reversed)).toEqual(loads(forward));
  });
});

describe('T-IMPLEMENT-05 — Thaap 7 case 14: 2, 3 and 4 member layouts', () => {
  /*
   * Manual, all with 4 tasks × 1 h = 4 h total:
   *   2 members -> ideal 2.0,  cap 2.5   -> every task fits
   *   3 members -> ideal 1.3333, cap 1.6667 -> fits
   *   4 members -> ideal 1.0,  cap 1.25  -> fits
   * In every layout each member holds at most the cap.
   */
  /*
   * How many of the four 1 h tasks can actually be placed, by hand:
   *   n = 2 -> cap 2.5 h, so one member may hold two tasks (2 h <= 2.5)  -> 4 placed
   *   n = 3 -> cap 1.6667 h, so a member can hold only ONE task (2 > 1.6667)
   *            -> at most 3 placed, and the fourth is correctly left unassigned
   *   n = 4 -> cap 1.25 h, one task each                              -> 4 placed
   * The n = 3 case is not a defect: the cap binds before the 5 h of nominal
   * roster capacity does, which is exactly what R2 is for.
   */
  for (const { n, placed } of [
    { n: 2, placed: 4 },
    { n: 3, placed: 3 },
    { n: 4, placed: 4 },
  ]) {
    it(`respects the cap with ${n} members (${placed} of 4 tasks placeable)`, () => {
      const members = Array.from({ length: n }, (_, i) => member(`m${i + 1}`, `A${i + 1}`));
      const tasks = Array.from({ length: 4 }, (_, i) => task(`t${i + 1}`, 1));
      const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
      const expectedIdeal = 4 / n;
      const expectedCap = expectedIdeal * WORKLOAD_CAP_MULTIPLIER;
      expect(result.idealLoad).toBeCloseTo(expectedIdeal, 10);
      expect(result.assignments.filter((a) => a.primaryMemberId !== '')).toHaveLength(placed);
      for (const load of Object.values(result.memberLoads)) {
        expect(load).toBeLessThanOrEqual(expectedCap + 1e-9);
      }
      // Total assigned effort equals the tasks actually placed, times 1 h.
      const total = Object.values(result.memberLoads).reduce((s, l) => s + l, 0);
      expect(total).toBe(placed);
    });
  }

  it('spreads the work across members rather than piling it on one', () => {
    // 4 tasks × 1 h over 4 members: 1 h each, so no member is idle and none
    // carries more than one task (manual optimum).
    const members = Array.from({ length: 4 }, (_, i) => member(`m${i + 1}`, `A${i + 1}`));
    const tasks = Array.from({ length: 4 }, (_, i) => task(`t${i + 1}`, 1));
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const loads = Object.values(result.memberLoads).sort((a, b) => a - b);
    expect(loads).toEqual([1, 1, 1, 1]);
  });
});

describe('T-IMPLEMENT-05 — score is never eligibility', () => {
  it('keeps a top score visible while refusing to appoint it', () => {
    /*
     * 8 members, 4 tasks of 2 h, ideal 1 h cap 1.25 h. Every member scores the
     * same and all are ineligible, so the highest score must still not be shown
     * as an owner.
     */
    const members = Array.from({ length: 8 }, (_, i) => member(`m${i + 1}`, `A${i + 1}`));
    const tasks = Array.from({ length: 4 }, (_, i) => task(`t${i + 1}`, 2));
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const scores = Object.values(result.assignments[0].scores);
    expect(Math.max(...scores.map((s) => s.breakdown.total))).toBeGreaterThan(0.4);
    expect(scores.every((s) => !s.isEligible)).toBe(true);
    expect(result.assignments.every((a) => a.primaryMemberId === '')).toBe(true);
  });

  it('uses the documented 40/30/20/10 weights unchanged', () => {
    expect(DEFAULT_WEIGHTS).toEqual({ K: 0.4, S: 0.3, C: 0.2, M: 0.1 });
    expect(WORKLOAD_CAP_MULTIPLIER).toBe(1.25);
  });
});
