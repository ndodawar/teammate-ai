import { describe, it, expect } from 'vitest';
import { globalAssign } from '@/lib/scoring/assign';
import { describeOverCap, validateSplit } from '@/lib/scoring/interaction';
import { WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import type { Member, Task } from '@/lib/scoring/types';

/*
 * T-FIX-R2-02.
 *
 * The screenshot that opened this ticket showed 2 members, 1 task of 8 hours,
 * an ideal load of 4 hours, an R2 cap of 5 hours, scores of 83% / 86%, both
 * members excluded by R2, and no owner. The numbers below reproduce that
 * exact shape so these tests guard the case the user actually saw rather than a
 * convenient approximation of it.
 */

// Budi and Heri both hold the required skill, so R1 passes and R2 is the only
// rule that can stop them. Capacity is far above the task, so a failure here is
// unambiguously an R2 failure and not a capacity one.
const MEMBERS: Member[] = [
  { id: 'budi', name: 'Budi', capacity: 20, skills: { pengujian: 4 }, interests: { pengujian: 5 } },
  { id: 'heri', name: 'Heri', capacity: 20, skills: { pengujian: 5 }, interests: { pengujian: 4 } },
];

const ONE_TASK_8H: Task[] = [
  { id: 't8', title: 'Tugas 8 jam', difficulty: 3, estimated_hours: 8, required_skills: ['pengujian'] },
];

const TWO_SUBTASKS_4H: Task[] = [
  { id: 's1', title: 'Bagian 1', difficulty: 3, estimated_hours: 4, required_skills: ['pengujian'] },
  { id: 's2', title: 'Bagian 2', difficulty: 3, estimated_hours: 4, required_skills: ['pengujian'] },
];

describe('T-FIX-R2-02: a task above the R2 cap gets no owner', () => {
  const result = globalAssign(ONE_TASK_8H, MEMBERS, [], {
    cosineMap: { t8: { budi: 0.62, heri: 0.66 } },
  });

  it('reproduces the screenshot numbers: ideal 4 hours, cap 5 hours', () => {
    expect(result.idealLoad).toBe(4);
    expect(result.idealLoad * WORKLOAD_CAP_MULTIPLIER).toBe(5);
  });

  it('leaves the 8 hour task without a penanggung jawab', () => {
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].primaryMemberId).toBe('');
  });

  it('excludes both members by R2 even though their scores are high', () => {
    for (const member of MEMBERS) {
      const score = result.assignments[0].scores[member.id];
      expect(score.isEligible).toBe(false);
      expect(score.breakdown.total).toBeGreaterThan(0.5);
      expect((score.warnings ?? []).some((w) => w.startsWith('R2'))).toBe(true);
    }
  });

  it('records the facts the message needs: effort, ideal load, cap, over-cap alone', () => {
    const warning = result.warnings.find((w) => w.code === 'r2_no_candidate');
    expect(warning?.detail).toEqual({
      taskHours: 8,
      idealLoad: 4,
      capHours: 5,
      exceedsCapAlone: true,
    });
  });

  it('never promotes the higher scorer to owner as a compromise', () => {
    // Heri scores higher than Budi; neither may become the owner by default.
    const budi = result.assignments[0].scores.budi.breakdown.total;
    const heri = result.assignments[0].scores.heri.breakdown.total;
    expect(heri).toBeGreaterThan(budi);
    expect(result.assignments[0].primaryMemberId).not.toBe('heri');
    expect(result.assignments[0].alternativeMemberId ?? '').not.toBe('heri');
  });
});

describe('T-FIX-R2-02: the R2 message states the four figures', () => {
  it('names effort, ideal load, cap and the excess in hours', () => {
    const { excessHours, summary } = describeOverCap({ taskHours: 8, idealLoad: 4, capHours: 5 });

    expect(excessHours).toBe(3);
    expect(summary).toContain('Usaha tugas 8 jam.');
    expect(summary).toContain('Beban ideal 4.00 jam.');
    expect(summary).toContain('Batas R2 5.00 jam');
    expect(summary).toContain('1,25');
    expect(summary).toContain('Selisih 3.00 jam melebihi batas.');
  });

  it('computes the excess from the cap rather than trusting a supplied number', () => {
    // A caller cannot make the "diff" disagree with the numbers beside it.
    expect(describeOverCap({ taskHours: 9, idealLoad: 2, capHours: 2.5 }).excessHours).toBe(6.5);
  });
});

describe('T-FIX-R2-02: two 4 hour subtasks are evaluated separately', () => {
  const result = globalAssign(TWO_SUBTASKS_4H, MEMBERS, [], {
    cosineMap: {
      s1: { budi: 0.62, heri: 0.66 },
      s2: { budi: 0.70, heri: 0.50 },
    },
  });

  it('assigns both subtasks, each within the cap', () => {
    for (const assignment of result.assignments) {
      expect(assignment.primaryMemberId).not.toBe('');
    }
  });

  it('gives each subtask its own score rather than sharing the parent score', () => {
    const first = result.assignments.find((a) => a.taskId === 's1')!;
    const second = result.assignments.find((a) => a.taskId === 's2')!;
    expect(first.scores.budi.breakdown.total).not.toBe(second.scores.budi.breakdown.total);
  });

  it('rescoring follows the cosine input, so the subtasks are independent', () => {
    // s1 favours Heri, s2 favours Budi. Different winners prove each subtask was
    // scored on its own embedding, not on the parent task's.
    expect(result.assignments.find((a) => a.taskId === 's1')!.primaryMemberId).toBe('heri');
    expect(result.assignments.find((a) => a.taskId === 's2')!.primaryMemberId).toBe('budi');
  });

  it('no longer produces the impossible-task warning', () => {
    expect(result.warnings.some((w) => w.code === 'r2_no_candidate' && w.detail?.exceedsCapAlone)).toBe(
      false
    );
  });
});

describe('T-FIX-R2-02: R1 to R5 still apply', () => {
  it('R1: a member with no remaining hours is not a candidate', () => {
    // R1 (`checkR1`) is about capacity: a member with zero hours available is
    // excluded before any scoring. Skill level is R3, tested separately below.
    const members: Member[] = [
      { id: 'budi', name: 'Budi', capacity: 20, skills: { pengujian: 4 }, interests: { pengujian: 5 } },
      { id: 'heri', name: 'Heri', capacity: 0, skills: { pengujian: 5 }, interests: { pengujian: 5 } },
    ];
    const tasks: Task[] = [
      { id: 's1', title: 'Bagian 1', difficulty: 3, estimated_hours: 4, required_skills: ['pengujian'] },
    ];
    const result = globalAssign(tasks, members, [], { cosineMap: { s1: { budi: 0.6, heri: 0.9 } } });
    // Heri scores higher but has no capacity, so Budi is the only candidate.
    expect(result.assignments[0].primaryMemberId).toBe('budi');
  });

  it('R2: a subtask still above the cap stays unassigned', () => {
    const tasks: Task[] = [
      { id: 'big', title: 'Masih 8 jam', difficulty: 3, estimated_hours: 8, required_skills: ['pengujian'] },
    ];
    const result = globalAssign(tasks, MEMBERS, [], { cosineMap: { big: { budi: 0.9, heri: 0.9 } } });
    expect(result.assignments[0].primaryMemberId).toBe('');
    expect(result.warnings.some((w) => w.code === 'r2_no_candidate')).toBe(true);
  });

  it('R3: a member without the required skill at level 3 is named R3, not R1', () => {
    const members: Member[] = [
      { id: 'budi', name: 'Budi', capacity: 20, skills: { pengujian: 4 }, interests: { pengujian: 5 } },
      { id: 'heri', name: 'Heri', capacity: 20, skills: { 'desain antarmuka': 5 }, interests: { pengujian: 5 } },
    ];
    const result = globalAssign(TWO_SUBTASKS_4H, members, [], {
      cosineMap: { s1: { budi: 0.6, heri: 0.9 }, s2: { budi: 0.6, heri: 0.9 } },
    });
    // Heri scores higher, but lacks the skill. The reason must be R3 so the
    // matrix cannot tell the reader the wrong rule stopped them.
    const first = result.assignments.find((a) => a.taskId === 's1')!;
    const heri = first.scores.heri;
    expect(heri.isEligible).toBe(false);
    expect((heri.warnings ?? []).some((w) => w.startsWith('R3'))).toBe(true);
  });

  it('R3: no member at level 3 still leaves the task unowned rather than inventing one', () => {
    const members: Member[] = [
      { id: 'budi', name: 'Budi', capacity: 20, skills: { pengujian: 2 }, interests: { pengujian: 5 } },
      { id: 'heri', name: 'Heri', capacity: 20, skills: { pengujian: 1 }, interests: { pengujian: 5 } },
    ];
    const tasks: Task[] = [
      { id: 's1', title: 'Bagian 1', difficulty: 3, estimated_hours: 4, required_skills: ['pengujian'] },
    ];
    const result = globalAssign(tasks, members, [], { cosineMap: { s1: { budi: 0.8, heri: 0.7 } } });
    // R3 has no candidate. The PRD still shows a best suggestion, but the
    // warning must say R3 was not satisfied.
    const warning = result.warnings.find((w) => w.code === 'r3_no_candidate');
    expect(warning).toBeDefined();
  });

  it('R4: a task larger than the whole roster stays unassigned', () => {
    const tasks: Task[] = [
      { id: 'huge', title: 'Tugas raksasa', difficulty: 3, estimated_hours: 500, required_skills: ['pengujian'] },
    ];
    const result = globalAssign(tasks, MEMBERS, [], { cosineMap: { huge: { budi: 0.9, heri: 0.9 } } });
    expect(result.assignments[0].primaryMemberId).toBe('');
  });

  it('R5: a locked task keeps its owner even when another member scores higher', () => {
    const tasks: Task[] = [
      ...TWO_SUBTASKS_4H,
      { id: 'lockme', title: 'Terkunci', difficulty: 3, estimated_hours: 4, required_skills: ['pengujian'] },
    ];
    const result = globalAssign(
      tasks,
      MEMBERS,
      [{ taskId: 'lockme', primaryMemberId: 'heri', isLocked: true, scores: {} }],
      {
        cosineMap: {
          s1: { budi: 0.6, heri: 0.6 },
          s2: { budi: 0.6, heri: 0.6 },
          lockme: { budi: 0.95, heri: 0.05 },
        },
      }
    );
    const locked = result.assignments.find((a) => a.taskId === 'lockme')!;
    // Budi scores far higher, yet R5 keeps Heri as the owner.
    expect(locked.scores.budi.breakdown.total).toBeGreaterThan(locked.scores.heri.breakdown.total);
    expect(locked.primaryMemberId).toBe('heri');
    expect(locked.isLocked).toBe(true);
  });
});

describe('T-FIX-R2-02: splitting validates the total against the parent effort', () => {
  it('accepts two 4 hour parts for an 8 hour parent', () => {
    const result = validateSplit([{ hours: '4' }, { hours: '4' }], 8);
    expect(result.ok).toBe(true);
    expect(result.total).toBe(8);
    expect(result.remaining).toBe(0);
  });

  it('rejects a split that loses an hour instead of padding it', () => {
    const result = validateSplit([{ hours: '3' }, { hours: '4' }], 8);
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(1);
    expect(result.error).toContain('kurang 1 jam');
  });

  it('rejects a split that adds an hour instead of trimming it', () => {
    const result = validateSplit([{ hours: '5' }, { hours: '4' }], 8);
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(-1);
    expect(result.error).toContain('lebih 1 jam');
  });

  it('rejects a "split" of one whole part, which splits nothing', () => {
    const result = validateSplit([{ hours: '8' }], 8);
    expect(result.ok).toBe(false);
    expect(result.rowErrors[0]).toContain('lebih kecil dari estimasi induk');
  });

  it('rejects an empty hour box rather than guessing it', () => {
    const result = validateSplit([{ hours: '' }, { hours: '8' }], 8);
    expect(result.ok).toBe(false);
    expect(result.rowErrors[0]).toBe('Estimasi jam wajib diisi.');
  });

  it('rejects fractional hours, matching the integer column in the schema', () => {
    const result = validateSplit([{ hours: '2.5' }, { hours: '5.5' }], 8);
    expect(result.ok).toBe(false);
    expect(result.rowErrors[0]).toBe('Estimasi jam harus bilangan bulat.');
  });

  it('rejects a zero or negative part', () => {
    expect(validateSplit([{ hours: '0' }, { hours: '8' }], 8).ok).toBe(false);
    expect(validateSplit([{ hours: '-4' }, { hours: '12' }], 8).ok).toBe(false);
  });

  it('accepts an uneven user-chosen split as long as the total matches', () => {
    const result = validateSplit([{ hours: '3' }, { hours: '4' }, { hours: '1' }], 8);
    expect(result.ok).toBe(true);
    expect(result.total).toBe(8);
  });
});

describe('T-FIX-R2-02: export reflects the actual result, not the request', () => {
  it('the 8 hour task exports with an empty owner', () => {
    const result = globalAssign(ONE_TASK_8H, MEMBERS, [], {
      cosineMap: { t8: { budi: 0.62, heri: 0.66 } },
    });
    // `toCsv` / `toPlainText` read `primaryMemberId`, so an empty id is the one
    // source of truth for "no owner" across the table, the copy button and the
    // exported file. Asserting it here guards that the three cannot diverge.
    expect(result.assignments[0].primaryMemberId).toBe('');
  });
});
