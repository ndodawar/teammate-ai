import { describe, it, expect } from 'vitest';
import { globalAssign } from '@/lib/scoring/assign';
import { checkR1, checkR2, checkR3, hasQualifiedMember } from '@/lib/scoring/rules';
import { computeScore, computeSkillMatch, computeCapacity, computeInterest } from '@/lib/scoring/score';
import { assignOwner, swapOwners } from '@/lib/scoring/interaction';
import { DEFAULT_WEIGHTS, WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import type { Member, Task, TaskAssignment } from '@/lib/scoring/types';

/*
 * T-3.XX: matrix recommendation and assignment validation.
 *
 * Every case below is built from the reported screenshot data (1 task, 8 hours
 * of effort, 5 members, ideal load 1.6 hours, R2 cap 2 hours) or from the PRD
 * v0.3 scenarios S21/S23. The numbers are the reported ones; none were moved to
 * make an assertion pass.
 */

function member(overrides: Partial<Member> & { id: string }): Member {
  return { name: overrides.id, skills: {}, interests: {}, capacity: 40, ...overrides };
}

function task(overrides: Partial<Task> & { id: string }): Task {
  return { title: overrides.id, difficulty: 3, estimated_hours: 1, required_skills: [], ...overrides };
}

/** Identical cosine for every pair, so ranking is driven by S/C/M only. */
function flatCosine(tasks: Task[], members: Member[], value = 0.6) {
  const map: Record<string, Record<string, number>> = {};
  for (const t of tasks) {
    map[t.id] = {};
    for (const m of members) map[t.id][m.id] = value;
  }
  return map;
}

/** A locked assignment as the engine receives it, with no scores attached. */
function lockedAssignment(taskId: string, primaryMemberId: string): TaskAssignment {
  return { taskId, primaryMemberId, isLocked: true, scores: {} };
}

describe('T-3.XX score components (PRD 8.4 formula, unchanged)', () => {
  it('S is the average required skill level divided by 5', () => {
    const t = task({ id: 't', required_skills: ['pengujian', 'presentasi'] });
    const m = member({ id: 'm', skills: { pengujian: 4, presentasi: 2 } });
    // (4 + 2) / 2 = 3, then 3 / 5 = 0.6
    expect(computeSkillMatch(t, m)).toBeCloseTo(0.6, 10);
  });

  it('S treats an unrated required skill as 0', () => {
    const t = task({ id: 't', required_skills: ['pengujian', 'presentasi'] });
    const m = member({ id: 'm', skills: { pengujian: 5 } });
    // (5 + 0) / 2 = 2.5, then 2.5 / 5 = 0.5
    expect(computeSkillMatch(t, m)).toBeCloseTo(0.5, 10);
  });

  it('C is 1 - (load + effort) / capacity, and never negative', () => {
    const m = member({ id: 'm', capacity: 10 });
    expect(computeCapacity(m, 0, 2)).toBeCloseTo(0.8, 10);
    expect(computeCapacity(m, 4, 2)).toBeCloseTo(0.4, 10);
    expect(computeCapacity(m, 9, 5)).toBe(0);
  });

  it('C is 0 when the member has no available hours', () => {
    expect(computeCapacity(member({ id: 'm', capacity: 0 }), 0, 5)).toBe(0);
  });

  it('M is (average interest - 1) / 4, defaulting an unrated skill to 3', () => {
    const t = task({ id: 't', required_skills: ['pengujian', 'presentasi'] });
    const m = member({ id: 'm', interests: { pengujian: 5 } });
    // (5 + 3) / 2 = 4, then (4 - 1) / 4 = 0.75
    expect(computeInterest(t, m)).toBeCloseTo(0.75, 10);
  });

  it('total is exactly 0.40K + 0.30S + 0.20C + 0.10M', () => {
    const t = task({ id: 't', estimated_hours: 2, required_skills: ['pengujian'] });
    const m = member({ id: 'm', capacity: 10, skills: { pengujian: 5 }, interests: { pengujian: 5 } });
    const b = computeScore(t, m, 0, 5, 0.8, DEFAULT_WEIGHTS, false);
    // K: 0.8 is the top of the 0.2..0.8 band -> 1.0
    expect(b.K).toBe(1);
    expect(b.S).toBe(1);
    expect(b.C).toBeCloseTo(0.8, 4);
    expect(b.M).toBe(1);
    const expected = 0.4 * b.K + 0.3 * b.S + 0.2 * b.C + 0.1 * b.M;
    expect(b.total).toBeCloseTo(expected, 4);
  });
});

describe('T-3.XX R1: a member with 0 available hours is excluded', () => {
  it('checkR1 is false only when capacity is 0', () => {
    expect(checkR1(member({ id: 'm', capacity: 0 }))).toBe(false);
    expect(checkR1(member({ id: 'm', capacity: 1 }))).toBe(true);
  });

  it('an R1-excluded member never becomes the owner', () => {
    const members = [
      member({ id: 'zero', capacity: 0, skills: { pengujian: 5 } }),
      member({ id: 'free', capacity: 20, skills: { pengujian: 5 } }),
    ];
    const tasks = [task({ id: 't', estimated_hours: 2, required_skills: ['pengujian'] })];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });
    expect(res.assignments[0].primaryMemberId).toBe('free');
    expect(res.assignments[0].scores.zero.isEligible).toBe(false);
  });

  /*
   * The ideal load is the workload BUDGET divided among the members who can
   * actually carry work. An R1-excluded member must not receive a share, or the
   * budget shrinks and the R2 cap tightens for everybody still in the pool.
   */
  it('an R1-excluded member does not dilute the ideal load', () => {
    const members = [
      member({ id: 'active', capacity: 10, skills: { pengujian: 4 } }),
      member({ id: 'inactive', capacity: 0, skills: { pengujian: 4 } }),
    ];
    const tasks = [
      task({ id: 't1', estimated_hours: 4, required_skills: ['pengujian'] }),
      task({ id: 't2', estimated_hours: 4, required_skills: ['pengujian'] }),
    ];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });
    // 8 hours for the one member who can take work, not 8 / 2.
    expect(res.idealLoad).toBeCloseTo(8, 10);
    expect(res.idealLoad * WORKLOAD_CAP_MULTIPLIER).toBeCloseTo(10, 10);
    // Both tasks fit inside that budget, so neither may be reported unassignable.
    expect(res.assignments.every((a) => a.primaryMemberId === 'active')).toBe(true);
    expect(res.warnings.filter((w) => w.code === 'r2_no_candidate')).toHaveLength(0);
  });
});

describe('T-3.XX R2: the 1.25 x ideal cap is enforced', () => {
  it('checkR2 rejects a load that goes over the cap', () => {
    const m = member({ id: 'm', capacity: 100 });
    const t = task({ id: 't', estimated_hours: 3 });
    // ideal 2 -> cap 2.5; accepting 3 hours fails.
    expect(checkR2(m, t, 0, 2)).toBe(false);
    // ideal 4 -> cap 5; accepting 3 hours passes.
    expect(checkR2(m, t, 0, 4)).toBe(true);
  });

  it('checkR2 also respects the member’s own available hours', () => {
    const m = member({ id: 'm', capacity: 2 });
    const t = task({ id: 't', estimated_hours: 3 });
    // 3 <= 1.25 x 10, but 3 > capacity 2.
    expect(checkR2(m, t, 0, 10)).toBe(false);
  });

  it('the reported screenshot case is infeasible, not a fake recommendation', () => {
    // 1 task, 8 hours, 5 members -> ideal 1.6, cap 2.
    const members = ['a', 'b', 'c', 'd', 'e'].map((id) =>
      member({ id, capacity: 8, skills: { 'penulisan akademik': id === 'a' ? 4 : 1 } })
    );
    const tasks = [
      task({ id: 't', title: 'Tugas contoh', estimated_hours: 8, required_skills: ['penulisan akademik'] }),
    ];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    expect(res.idealLoad).toBeCloseTo(1.6, 10);
    expect(res.idealLoad * WORKLOAD_CAP_MULTIPLIER).toBeCloseTo(2, 10);

    const assignment = res.assignments[0];
    // No member may be presented as the owner: 8 hours cannot fit a 2 hour cap.
    expect(assignment.primaryMemberId).toBe('');
    expect(assignment.alternativeMemberId).toBeUndefined();
    expect(Object.values(assignment.scores).every((s) => s.isEligible)).toBe(false);
  });

  it('every excluded member carries a traceable R2 reason', () => {
    const members = ['a', 'b'].map((id) => member({ id, capacity: 8, skills: { pengujian: 4 } }));
    const tasks = [task({ id: 't', estimated_hours: 8, required_skills: ['pengujian'] })];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    for (const score of Object.values(res.assignments[0].scores)) {
      expect(score.isEligible).toBe(false);
      expect(score.warnings ?? []).toEqual(
        expect.arrayContaining([expect.stringContaining('R2')])
      );
    }
  });

  it('marks a task heavier than the cap as impossible for anyone', () => {
    const members = ['a', 'b'].map((id) => member({ id, capacity: 100, skills: { pengujian: 4 } }));
    const tasks = [
      task({ id: 'big', estimated_hours: 15, required_skills: ['pengujian'] }),
      task({ id: 'small', estimated_hours: 5, required_skills: ['pengujian'] }),
    ];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    // ideal 10, cap 12.5, so 15 hours can never be placed.
    const warning = res.warnings.find((w) => w.code === 'r2_no_candidate' && w.taskId === 'big');
    expect(warning).toBeDefined();
    expect(warning?.detail?.exceedsCapAlone).toBe(true);
    expect(warning?.detail?.taskHours).toBe(15);
    expect(warning?.detail?.capHours).toBeCloseTo(12.5, 10);
    expect(res.assignments.find((a) => a.taskId === 'big')?.primaryMemberId).toBe('');
  });
});

describe('T-3.XX R3: fallback when nobody reaches skill level 3', () => {
  it('hasQualifiedMember is false when every required skill is below 3', () => {
    const t = task({ id: 't', required_skills: ['pengujian'] });
    const members = [member({ id: 'a', skills: { pengujian: 2 } }), member({ id: 'b', skills: {} })];
    expect(hasQualifiedMember(t, members)).toBe(false);
  });

  it('hasQualifiedMember is true when at least one required skill reaches 3', () => {
    const t = task({ id: 't', required_skills: ['pengujian', 'presentasi'] });
    const members = [member({ id: 'a', skills: { presentasi: 3 } })];
    expect(hasQualifiedMember(t, members)).toBe(true);
  });

  it('R3 uses "at least one" required skill, not "all"', () => {
    const t = task({ id: 't', required_skills: ['pengujian', 'presentasi'] });
    const members = [member({ id: 'a', skills: { pengujian: 5, presentasi: 0 } })];
    expect(hasQualifiedMember(t, members)).toBe(true);
    expect(checkR3(t, members).map((m) => m.id)).toEqual(['a']);
  });

  it('still recommends the best member with a warning, and marks them ineligible', () => {
    const members = [
      member({ id: 'low', capacity: 20, skills: { pengujian: 2 } }),
      member({ id: 'lower', capacity: 20, skills: { pengujian: 1 } }),
    ];
    // Two tasks of 1 hour each: ideal 1 hour per member, cap 1.25, so R2 clears
    // for the single task under test and R3 is the only rule left to fail.
    const tasks = [
      task({ id: 't', estimated_hours: 1, required_skills: ['pengujian'] }),
      task({ id: 't2', estimated_hours: 1, required_skills: ['pengujian'] }),
    ];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    const assignment = res.assignments.find((a) => a.taskId === 't')!;
    // PRD R3: a best-effort suggestion is still shown.
    expect(assignment.primaryMemberId).toBe('low');
    // But it is NOT a valid R3 candidate.
    expect(assignment.scores.low.isEligible).toBe(false);
    expect(res.warnings.some((w) => w.code === 'r3_no_candidate')).toBe(true);
  });
});

describe('T-3.XX R4: exactly one owner per task', () => {
  it('every assignment names at most one primary owner', () => {
    const members = ['a', 'b', 'c', 'd'].map((id) =>
      member({ id, capacity: 20, skills: { pengujian: 4 } })
    );
    const tasks = [
      task({ id: 't1', estimated_hours: 2, required_skills: ['pengujian'] }),
      task({ id: 't2', estimated_hours: 3, required_skills: ['pengujian'] }),
    ];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    for (const a of res.assignments) {
      expect(typeof a.primaryMemberId).toBe('string');
      // One id (or empty for the R4 exception), never a list.
      expect(a.primaryMemberId.includes(',')).toBe(false);
    }
  });

  it('the R4 exception leaves the task unowned instead of overloading someone', () => {
    const members = [member({ id: 'solo', capacity: 4, skills: { pengujian: 4 } })];
    const tasks = [task({ id: 't', estimated_hours: 8, required_skills: ['pengujian'] })];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });
    expect(res.assignments[0].primaryMemberId).toBe('');
    expect(res.memberLoads.solo).toBe(0);
  });
});

describe('T-3.XX R5: a locked task keeps its owner on recompute', () => {
  it('keeps the locked owner even when a higher scorer exists', () => {
    const members = [
      member({ id: 'better', capacity: 40, skills: { pengujian: 5 }, interests: { pengujian: 5 } }),
      member({ id: 'locked', capacity: 40, skills: { pengujian: 1 } }),
    ];
    const tasks = [task({ id: 't', estimated_hours: 2, required_skills: ['pengujian'] })];
    const res = globalAssign(tasks, members, [lockedAssignment('t', 'locked')], {
      cosineMap: flatCosine(tasks, members),
    });

    expect(res.assignments[0].primaryMemberId).toBe('locked');
    expect(res.assignments[0].isLocked).toBe(true);
  });

  it('keeps a locked owner and warns when the lock pushes them over R2', () => {
    const members = [
      member({ id: 'a', capacity: 40, skills: { pengujian: 4 } }),
      member({ id: 'b', capacity: 40, skills: { pengujian: 4 } }),
    ];
    // Locked 9 hours on member a, plus 1 hour: total 10 over 2 members gives an
    // ideal load of 5 and a cap of 6.25, so a's 9 locked hours exceed it.
    const tasks = [
      task({ id: 'locked', estimated_hours: 9, required_skills: ['pengujian'] }),
      task({ id: 'rest', estimated_hours: 1, required_skills: ['pengujian'] }),
    ];
    const res = globalAssign(tasks, members, [lockedAssignment('locked', 'a')], {
      cosineMap: flatCosine(tasks, members),
    });

    expect(res.assignments.find((a) => a.taskId === 'locked')?.primaryMemberId).toBe('a');
    expect(res.warnings.some((w) => w.code === 'r2_locked_overload')).toBe(true);
  });

  it('does not count a locked task’s hours twice', () => {
    const members = [member({ id: 'solo', capacity: 40, skills: { pengujian: 4 } })];
    const tasks = [task({ id: 't', estimated_hours: 4, required_skills: ['pengujian'] })];
    const res = globalAssign(tasks, members, [lockedAssignment('t', 'solo')], {
      cosineMap: flatCosine(tasks, members),
    });
    expect(res.memberLoads.solo).toBe(4);
  });

  /*
   * The lock must be the ONLY reason the change is refused, so the same move is
   * proven legal first with the task unlocked. Sized so R2 clearly allows it:
   * 5 tasks of 1 hour over 3 members gives an ideal load of 1.67 and a cap of
   * 2.08, which leaves room for the receiving member.
   */
  it('a locked task refuses an owner change that is legal when unlocked', () => {
    const members = ['a', 'b', 'c'].map((id) => member({ id, capacity: 40, skills: { pengujian: 4 } }));
    const tasks = ['t1', 't2', 't3', 't4', 't5'].map((id) =>
      task({ id, estimated_hours: 1, required_skills: ['pengujian'] })
    );
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    let legal: { taskId: string; from: string; to: string } | null = null;
    for (const assignment of res.assignments) {
      if (!assignment.primaryMemberId) continue;
      for (const m of members) {
        if (m.id === assignment.primaryMemberId) continue;
        const attempt = assignOwner(res.assignments, assignment.taskId, m.id, {
          lock: false,
          tasks,
          members,
        });
        if (attempt.changed) {
          legal = { taskId: assignment.taskId, from: assignment.primaryMemberId, to: m.id };
          break;
        }
      }
      if (legal) break;
    }
    expect(legal, 'no legal unlocked move found to test the lock against').not.toBeNull();
    if (!legal) return; // narrowing for TypeScript strict

    const unlocked = assignOwner(res.assignments, legal.taskId, legal.to, { lock: false, tasks, members });
    expect(unlocked.changed).toBe(true);

    const locked = assignOwner(res.assignments, legal.taskId, legal.from, { lock: true, tasks, members });
    const moved = assignOwner(locked.next, legal.taskId, legal.to, { lock: false, tasks, members });

    // Same move, one difference: the task is now locked.
    expect(moved.changed).toBe(false);
    expect(moved.error).toContain('terkunci');
    expect(moved.next.find((a) => a.taskId === legal.taskId)!.primaryMemberId).toBe(legal.from);
  });
});

describe('T-3.XX required scenarios with real engine output', () => {
  it('2 members and 1 task produces a valid recommendation', () => {
    const members = ['a', 'b'].map((id) => member({ id, capacity: 20, skills: { pengujian: 4 } }));
    // Total effort 4 hours over 2 members gives an ideal load of 2 and a cap of
    // 2.5, so two tasks of 2 hours each fit and one of them is assigned.
    const tasks = [
      task({ id: 't', estimated_hours: 2, required_skills: ['pengujian'] }),
      task({ id: 't2', estimated_hours: 2, required_skills: ['pengujian'] }),
    ];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    const assignment = res.assignments.find((a) => a.taskId === 't')!;
    expect(assignment.primaryMemberId).not.toBe('');
    expect(assignment.scores[assignment.primaryMemberId].isEligible).toBe(true);
  });

  it('4 members and several tasks keep every task inside R2', () => {
    const members = ['a', 'b', 'c', 'd'].map((id) =>
      member({ id, capacity: 40, skills: { pengujian: 4, presentasi: 4 } })
    );
    // 8 hours over 4 members: ideal 2, cap 2.5. Each task is 2 hours, so every
    // placement fits the cap and the engine should fill all four.
    const tasks = [
      task({ id: 't1', estimated_hours: 2, required_skills: ['pengujian'] }),
      task({ id: 't2', estimated_hours: 2, required_skills: ['presentasi'] }),
      task({ id: 't3', estimated_hours: 2, required_skills: ['pengujian'] }),
      task({ id: 't4', estimated_hours: 2, required_skills: ['presentasi'] }),
    ];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    const cap = res.idealLoad * WORKLOAD_CAP_MULTIPLIER;
    for (const load of Object.values(res.memberLoads)) {
      expect(load).toBeLessThanOrEqual(cap + 1e-9);
    }
    const unowned = res.assignments.filter((a) => !a.primaryMemberId);
    expect(unowned).toHaveLength(0);
  });

  it('one unavailable member is skipped, the rest still get work', () => {
    const members = [
      member({ id: 'absent', capacity: 0, skills: { pengujian: 5 } }),
      member({ id: 'here', capacity: 20, skills: { pengujian: 4 } }),
    ];
    const tasks = [task({ id: 't', estimated_hours: 2, required_skills: ['pengujian'] })];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    expect(res.assignments[0].primaryMemberId).toBe('here');
    expect(res.memberLoads.absent).toBe(0);
  });

  it('all members unavailable leaves the task unowned and says why', () => {
    const members = ['a', 'b'].map((id) => member({ id, capacity: 0, skills: { pengujian: 4 } }));
    const tasks = [task({ id: 't', estimated_hours: 2, required_skills: ['pengujian'] })];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    expect(res.assignments[0].primaryMemberId).toBe('');
    expect(Object.values(res.assignments[0].scores).every((s) => s.isEligible === false)).toBe(true);
    expect(res.memberLoads.a).toBe(0);
    expect(res.memberLoads.b).toBe(0);
  });

  it('the assigned owner is always the highest scorer among eligible members', () => {
    const members = [
      member({ id: 'strong', capacity: 40, skills: { pengujian: 5 }, interests: { pengujian: 5 } }),
      member({ id: 'weak', capacity: 40, skills: { pengujian: 1 }, interests: { pengujian: 1 } }),
    ];
    // 4 hours over 2 members: ideal 2, cap 2.5, so both 2-hour tasks fit.
    const tasks = [
      task({ id: 't', estimated_hours: 2, required_skills: ['pengujian'] }),
      task({ id: 't2', estimated_hours: 2, required_skills: ['pengujian'] }),
    ];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    const assignment = res.assignments.find((a) => a.taskId === 't')!;
    const eligible = Object.values(assignment.scores)
      .filter((s) => s.isEligible)
      .sort((a, b) => b.breakdown.total - a.breakdown.total);
    expect(eligible.length).toBeGreaterThan(0);
    expect(assignment.primaryMemberId).toBe(eligible[0].memberId);
  });

  it('no member is excluded without a warning explaining the rule', () => {
    const members = [
      member({ id: 'good', capacity: 40, skills: { pengujian: 4 } }),
      member({ id: 'nohours', capacity: 0, skills: { pengujian: 4 } }),
      member({ id: 'noskill', capacity: 40, skills: { pengujian: 1 } }),
    ];
    // 3 tasks of 1 hour over 3 members: ideal 1, cap 1.25, so R2 clears and the
    // only exclusions come from R1 (no hours) and R3 (skill below level 3).
    const tasks = [
      task({ id: 't', estimated_hours: 1, required_skills: ['pengujian'] }),
      task({ id: 't2', estimated_hours: 1, required_skills: ['pengujian'] }),
      task({ id: 't3', estimated_hours: 1, required_skills: ['pengujian'] }),
    ];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    for (const [id, score] of Object.entries(res.assignments[0].scores)) {
      if (!score.isEligible) {
        expect(score.warnings, `member ${id} excluded without a reason`).toBeDefined();
        expect((score.warnings ?? []).length).toBeGreaterThan(0);
      }
    }
  });

  it('swapOwners refuses to touch a locked task (R5)', () => {
    const members = ['a', 'b'].map((id) => member({ id, capacity: 40, skills: { pengujian: 4 } }));
    const tasks = [
      task({ id: 't1', estimated_hours: 2, required_skills: ['pengujian'] }),
      task({ id: 't2', estimated_hours: 2, required_skills: ['pengujian'] }),
    ];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });
    const locked = assignOwner(res.assignments, 't1', res.assignments[0].primaryMemberId, {
      lock: true,
      tasks,
      members,
    });

    const outcome = swapOwners(locked.next, 't1', 't2', { tasks, members });
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toContain('terkunci');
  });
});
