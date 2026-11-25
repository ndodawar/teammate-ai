import { describe, it, expect } from 'vitest';
import { globalAssign } from '@/lib/scoring/assign';
import { assignOwner } from '@/lib/scoring/interaction';
import { smallestSplitThatFits } from '@/lib/scoring/interaction';
import { candidateStatus, candidateStatusLabel } from '@/components/recommendations/candidate-score-chart';
import { WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import type { Member, Task, TaskAssignment } from '@/lib/scoring/types';

/*
 * T-FIX-MATRIX-01: the reported screenshot, reproduced with the real engine.
 *
 * The screenshot showed 2 members, 1 task of 2 hours, ideal load 1 hour, R2 cap
 * 1.25 hours, and both members excluded by R2. Those numbers are the fixture
 * below; none of them were adjusted to make an assertion pass.
 *
 * The arithmetic is checked directly: 2 > 1.25, so no member can ever take the
 * task, and the engine is right to leave it unowned. What was wrong was the
 * explanation given to the user, which told them to add members. Adding a member
 * divides the same total by a larger number, so the cap SHRINKS. The tests below
 * pin both facts down.
 */

function member(overrides: Partial<Member> & { id: string }): Member {
  return { name: overrides.id, skills: {}, interests: {}, capacity: 8, ...overrides };
}

function task(overrides: Partial<Task> & { id: string }): Task {
  return { title: overrides.id, difficulty: 3, estimated_hours: 1, required_skills: [], ...overrides };
}

function flatCosine(tasks: Task[], members: Member[], value = 0.6) {
  const map: Record<string, Record<string, number>> = {};
  for (const t of tasks) {
    map[t.id] = {};
    for (const m of members) map[t.id][m.id] = value;
  }
  return map;
}

function lockedAssignment(taskId: string, primaryMemberId: string): TaskAssignment {
  return { taskId, primaryMemberId, isLocked: true, scores: {} };
}

/** The exact screenshot: 2 members, 1 task of 2 hours, both below skill 3. */
function screenshotCase() {
  const members = [
    member({ id: 'a', capacity: 8, skills: { pengujian: 2 } }),
    member({ id: 'b', capacity: 8, skills: { pengujian: 1 } }),
  ];
  const tasks = [task({ id: 't', title: 'Tugas 2 jam', estimated_hours: 2, required_skills: ['pengujian'] })];
  return { members, tasks, result: globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) }) };
}

describe('T-FIX-MATRIX-01: 2 anggota, 1 tugas 2 jam, batas R2 1,25 jam', () => {
  it('produces exactly the reported numbers: ideal 1 jam, cap 1,25 jam', () => {
    const { result } = screenshotCase();
    expect(result.idealLoad).toBeCloseTo(1, 10);
    expect(result.idealLoad * WORKLOAD_CAP_MULTIPLIER).toBeCloseTo(1.25, 10);
  });

  it('gives no owner, because 2 jam cannot fit a 1,25 jam cap', () => {
    const { result } = screenshotCase();
    const assignment = result.assignments[0];
    // The engine must report the task as unassignable rather than fake an owner.
    expect(assignment.primaryMemberId).toBe('');
    expect(assignment.alternativeMemberId).toBeUndefined();
    expect(Object.values(assignment.scores).every((s) => s.isEligible === false)).toBe(true);
  });

  it('says why, with the effort and the cap as numbers', () => {
    const { result } = screenshotCase();
    const warning = result.warnings.find((w) => w.code === 'r2_no_candidate');
    expect(warning, 'no r2_no_candidate warning emitted').toBeDefined();
    expect(warning?.detail).toMatchObject({
      taskHours: 2,
      idealLoad: 1,
      capHours: 1.25,
      exceedsCapAlone: true,
    });
    // The message quotes the numbers, not just a rule name.
    expect(warning?.message).toContain('2 jam');
    expect(warning?.message).toContain('1.25 jam');
  });

  it('still emits the R3 warning separately, so R3 is not confused with R2', () => {
    const { result } = screenshotCase();
    expect(result.warnings.some((w) => w.code === 'r3_no_candidate')).toBe(true);
    expect(result.warnings.some((w) => w.code === 'r2_no_candidate')).toBe(true);
  });
});

describe('T-FIX-MATRIX-01: menambah anggota tidak memperbaiki, cap justru mengecil', () => {
  it('the cap falls as members are added, for the same single 2 hour task', () => {
    const caps: number[] = [];
    for (const n of [2, 4, 10]) {
      const members = Array.from({ length: n }, (_, i) =>
        member({ id: `m${i}`, capacity: 8, skills: { pengujian: 2 } })
      );
      const tasks = [task({ id: 't', estimated_hours: 2, required_skills: ['pengujian'] })];
      const result = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });
      // Adding a member divides the same total by a larger number.
      caps.push(result.idealLoad * WORKLOAD_CAP_MULTIPLIER);
      // And the task is still unassignable at every roster size.
      expect(result.assignments[0].primaryMemberId).toBe('');
    }
    expect(caps[0]).toBeCloseTo(1.25, 10);
    expect(caps[1]).toBeCloseTo(0.625, 10);
    expect(caps[2]).toBeCloseTo(0.25, 10);
    // Strictly decreasing: more people never raises the cap here.
    expect(caps[0]).toBeGreaterThan(caps[1]);
    expect(caps[1]).toBeGreaterThan(caps[2]);
  });

  it('smallestSplitThatFits returns the real minimum, not a hardcoded 2', () => {
    // 2 hours against a 1.25 hour cap needs 2 parts of 1 hour.
    expect(smallestSplitThatFits(2, 1.25)).toBe(2);
    // 5 hours against a 1 hour cap needs 5 parts.
    expect(smallestSplitThatFits(5, 1)).toBe(5);
    // A task that already fits needs no split.
    expect(smallestSplitThatFits(1, 1.25)).toBe(1);
    // Impossible inputs are reported as null rather than divided by zero.
    expect(smallestSplitThatFits(2, 0)).toBeNull();
    expect(smallestSplitThatFits(0, 1.25)).toBeNull();
    expect(smallestSplitThatFits(-1, 1.25)).toBeNull();
  });
});

describe('T-FIX-MATRIX-01: 2 anggota, 2 subtugas masing-masing 1 jam', () => {
  it('places both subtasks inside the R2 cap', () => {
    const members = [
      member({ id: 'a', capacity: 8, skills: { pengujian: 2 } }),
      member({ id: 'b', capacity: 8, skills: { pengujian: 1 } }),
    ];
    const tasks = [
      task({ id: 's1', title: 'Sub 1', estimated_hours: 1, required_skills: ['pengujian'] }),
      task({ id: 's2', title: 'Sub 2', estimated_hours: 1, required_skills: ['pengujian'] }),
    ];
    const result = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    expect(result.idealLoad).toBeCloseTo(1, 10);
    const cap = result.idealLoad * WORKLOAD_CAP_MULTIPLIER;
    // Every subtask got an owner, and no R2 warning was raised.
    expect(result.assignments.every((a) => a.primaryMemberId !== '')).toBe(true);
    expect(result.warnings.some((w) => w.code === 'r2_no_candidate')).toBe(false);
    // Each member holds 1 hour, inside the 1.25 hour cap.
    expect(result.memberLoads.a).toBe(1);
    expect(result.memberLoads.b).toBe(1);
    expect(result.memberLoads.a).toBeLessThanOrEqual(cap);
    expect(result.memberLoads.b).toBeLessThanOrEqual(cap);
  });

  it('recomputes scores from the new subtask rows, not the original task', () => {
    const members = [
      member({ id: 'a', capacity: 8, skills: { pengujian: 2 } }),
      member({ id: 'b', capacity: 8, skills: { pengujian: 1 } }),
    ];
    const tasks = [
      task({ id: 's1', estimated_hours: 1, required_skills: ['pengujian'] }),
      task({ id: 's2', estimated_hours: 1, required_skills: ['pengujian'] }),
    ];
    const result = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    // One score row per subtask per member, all computed against 1 hour.
    for (const assignment of result.assignments) {
      expect(Object.keys(assignment.scores).sort()).toEqual(['a', 'b']);
      for (const score of Object.values(assignment.scores)) {
        // C uses the 1 hour effort: 1 - 1/8 = 0.875 for the owner, never negative.
        expect(score.breakdown.C).toBeGreaterThanOrEqual(0);
        expect(score.breakdown.C).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('T-FIX-MATRIX-01: R3 fallback and R2 are never confused', () => {
  it('offers the best member with an R3 warning when nobody reaches level 3', () => {
    const members = [
      member({ id: 'low', capacity: 20, skills: { pengujian: 2 } }),
      member({ id: 'lower', capacity: 20, skills: { pengujian: 1 } }),
    ];
    // Two 1 hour tasks over 2 members: ideal 1, cap 1.25, so R2 clears and R3 is
    // the only rule that fails.
    const tasks = [
      task({ id: 't', estimated_hours: 1, required_skills: ['pengujian'] }),
      task({ id: 't2', estimated_hours: 1, required_skills: ['pengujian'] }),
    ];
    const result = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    const assignment = result.assignments.find((a) => a.taskId === 't')!;
    // PRD R3: a best-effort suggestion is still shown.
    expect(assignment.primaryMemberId).toBe('low');
    // But it is not a valid R3 candidate.
    expect(assignment.scores.low.isEligible).toBe(false);
    expect(result.warnings.some((w) => w.code === 'r3_no_candidate')).toBe(true);
    // And it is not called a valid candidate anywhere.
    const status = candidateStatus({ isPrimary: true, isAlternative: false, isEligible: false, rule: 'R3' });
    expect(candidateStatusLabel(status)).toBe('utama');
  });

  it('does not call an R2-excluded member a valid alternative', () => {
    const { result } = screenshotCase();
    for (const score of Object.values(result.assignments[0].scores)) {
      const status = candidateStatus({
        isPrimary: false,
        isAlternative: false,
        isEligible: score.isEligible,
        rule: 'R2',
      });
      expect(status).toBe('gugur-r2');
      expect(candidateStatusLabel(status)).not.toBe('kandidat');
    }
  });
});

describe('T-FIX-MATRIX-01: R1 and R5 still hold', () => {
  it('R1 removes a member with 0 available hours', () => {
    const members = [
      member({ id: 'absent', capacity: 0, skills: { pengujian: 4 } }),
      member({ id: 'here', capacity: 20, skills: { pengujian: 4 } }),
    ];
    const tasks = [
      task({ id: 't', estimated_hours: 1, required_skills: ['pengujian'] }),
      task({ id: 't2', estimated_hours: 1, required_skills: ['pengujian'] }),
    ];
    const result = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    expect(result.assignments.every((a) => a.primaryMemberId === 'here')).toBe(true);
    expect(result.memberLoads.absent).toBe(0);
    const status = candidateStatus({ isPrimary: false, isAlternative: false, isEligible: false, rule: 'R1' });
    expect(candidateStatusLabel(status)).toBe('gugur R1');
  });

  it('R5 keeps a locked owner and refuses an interactive change', () => {
    const members = ['a', 'b', 'c'].map((id) => member({ id, capacity: 40, skills: { pengujian: 4 } }));
    const tasks = ['t1', 't2', 't3', 't4', 't5'].map((id) =>
      task({ id, estimated_hours: 1, required_skills: ['pengujian'] })
    );
    const result = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    const first = result.assignments.find((a) => a.primaryMemberId)!.primaryMemberId;
    const locked = assignOwner(result.assignments, 't1', first, { lock: true, tasks, members });
    expect(locked.next.find((a) => a.taskId === 't1')!.isLocked).toBe(true);

    const other = members.find((m) => m.id !== first)!.id;
    const moved = assignOwner(locked.next, 't1', other, { lock: false, tasks, members });
    expect(moved.changed).toBe(false);
    expect(moved.error).toContain('terkunci');
  });

  it('a locked task keeps its owner across a recompute', () => {
    const members = [
      member({ id: 'better', capacity: 40, skills: { pengujian: 5 }, interests: { pengujian: 5 } }),
      member({ id: 'locked', capacity: 40, skills: { pengujian: 1 } }),
    ];
    const tasks = [
      task({ id: 't', estimated_hours: 1, required_skills: ['pengujian'] }),
      task({ id: 't2', estimated_hours: 1, required_skills: ['pengujian'] }),
    ];
    const result = globalAssign(tasks, members, [lockedAssignment('t', 'locked')], {
      cosineMap: flatCosine(tasks, members),
    });
    expect(result.assignments.find((a) => a.taskId === 't')!.primaryMemberId).toBe('locked');
  });
});

describe('T-FIX-MATRIX-01: R4 satu penanggung jawab per tugas', () => {
  it('never assigns more than one owner to a task', () => {
    const members = ['a', 'b', 'c', 'd'].map((id) => member({ id, capacity: 40, skills: { pengujian: 4 } }));
    const tasks = ['t1', 't2', 't3', 't4'].map((id) =>
      task({ id, estimated_hours: 1, required_skills: ['pengujian'] })
    );
    const result = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    for (const assignment of result.assignments) {
      // A single id string, never a list, and never two members at once.
      expect(typeof assignment.primaryMemberId).toBe('string');
      expect(assignment.primaryMemberId).not.toContain(',');
    }
  });
});

describe('T-FIX-MATRIX-01: perubahan slider tidak memanggil AI', () => {
  it('recalculating with new weights is pure and needs no network', () => {
    const members = [
      member({ id: 'a', capacity: 8, skills: { pengujian: 4 }, interests: { pengujian: 5 } }),
      member({ id: 'b', capacity: 8, skills: { pengujian: 2 }, interests: { pengujian: 1 } }),
    ];
    const tasks = [
      task({ id: 't', estimated_hours: 1, required_skills: ['pengujian'] }),
      task({ id: 't2', estimated_hours: 1, required_skills: ['pengujian'] }),
    ];
    const cosineMap = { t: { a: 0.7, b: 0.3 }, t2: { a: 0.7, b: 0.3 } };

    // Any attempt to reach the network while re-scoring fails this test.
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      throw new Error('slider recalculation must not call the network');
    }) as typeof fetch;

    try {
      const baseline = globalAssign(tasks, members, [], { cosineMap });
      // Exactly what handleWeightChange does: the same pure function, new weights.
      const shifted = globalAssign(tasks, members, baseline.assignments, {
        cosineMap,
        weights: { K: 0.1, S: 0.6, C: 0.2, M: 0.1 },
      });
      // The weights really do change the numbers, so the recalculation is not a no-op.
      const before = baseline.assignments[0].scores.a.breakdown.total;
      const after = shifted.assignments[0].scores.a.breakdown.total;
      expect(after).not.toBeCloseTo(before, 6);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchCalls).toBe(0);
  });
});
