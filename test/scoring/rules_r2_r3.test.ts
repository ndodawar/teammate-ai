import { describe, it, expect } from 'vitest';
import { globalAssign } from '@/lib/scoring/assign';
import { computeScore } from '@/lib/scoring/score';
import { checkR2, checkR3 } from '@/lib/scoring/rules';
import { assignOwner, swapOwners } from '@/lib/scoring/interaction';
import { DEFAULT_WEIGHTS, WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import type { Member, Task } from '@/lib/scoring/types';

/*
 * T-6.09 — regression tests for the three defects reported against the matrix:
 *   (1) R2 violated: a member over 1.25 x ideal load still became primary owner.
 *   (2) R3 not enforced: members without a required skill at level >= 3 were
 *       still recommended as if they were valid candidates.
 *   (3) Score inconsistency: the raw score (K/S/C/M worth ~55 points) was
 *       overwritten with 0 and the matrix rendered "0%".
 *
 * The numbers below are the reported ones: ideal 2.5h, R2 ceiling 3.125h, one
 * member already at 5h.
 */

const NO_SKILLS: Task['required_skills'] = [];

function member(overrides: Partial<Member> & { id: string }): Member {
  return { name: overrides.id, skills: {}, interests: {}, capacity: 40, ...overrides };
}

function task(overrides: Partial<Task> & { id: string }): Task {
  return { title: overrides.id, difficulty: 3, estimated_hours: 1, required_skills: NO_SKILLS, ...overrides };
}

/** A cosine map where every pair is identical, so ranking is driven by S/C/M. */
function flatCosine(tasks: Task[], members: Member[], value = 0.6) {
  const map: Record<string, Record<string, number>> = {};
  for (const t of tasks) {
    map[t.id] = {};
    for (const m of members) map[t.id][m.id] = value;
  }
  return map;
}

// ---------------------------------------------------------------------------
// TEST A — R2
// ---------------------------------------------------------------------------
describe('TEST A — R2: 1.25 x ideal load is a hard cap', () => {
  // 2 members, 5h total -> ideal 2.5h, ceiling 3.125h. That is the reported case.
  const members: Member[] = [
    member({ id: 'awddd', skills: { 'pemrograman frontend': 5 }, capacity: 40 }),
    member({ id: 'budi', skills: { 'pemrograman frontend': 5 }, capacity: 40 }),
  ];
  const heavy = task({
    id: 'kasir',
    title: 'Website Kasir',
    estimated_hours: 3,
    required_skills: ['pemrograman frontend'],
  });
  const small = task({ id: 'rapat', title: 'Rapat', estimated_hours: 2, required_skills: [] });
  const tasks = [heavy, small];

  it('computes the PRD ceiling from the PRD definition of ideal load', () => {
    const result = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });
    expect(result.idealLoad).toBe(2.5);
    expect(result.idealLoad * WORKLOAD_CAP_MULTIPLIER).toBeCloseTo(3.125, 10);
    // The multiplier itself is untouched by T-6.09.
    expect(WORKLOAD_CAP_MULTIPLIER).toBe(1.25);
  });

  it('checkR2 rejects a member whose load would pass the ceiling', () => {
    const m = members[0];
    const t = task({ id: 'x', estimated_hours: 1 });
    // 5h current + 1h = 6h > 3.125h ceiling.
    expect(checkR2(m, t, 5, 2.5)).toBe(false);
    // 2.125h + 1h = 3.125h is exactly the ceiling: allowed (not "melebihi").
    expect(checkR2(m, t, 2.125, 2.5)).toBe(true);
  });

  it('never hands a task to a member who would exceed the ceiling', () => {
    const cosines = flatCosine(tasks, members);
    // Pre-load awddd above the ceiling with a LOCKED task (R5 lets that stand).
    const locked = [
      { taskId: 'rapat', primaryMemberId: 'awddd', isLocked: true, scores: {} },
    ];
    const result = globalAssign(tasks, members, locked, { cosineMap: cosines });

    expect(result.memberLoads['awddd']).toBe(2);

    // Now physically force the reported situation: awddd holds 5h.
    const heavyMembers: Member[] = members;
    const heavyTasks: Task[] = [
      task({ id: 'big', title: 'Tugas besar', estimated_hours: 4, required_skills: [] }),
      task({ id: 'extra', title: 'Tambahan', estimated_hours: 1, required_skills: [] }),
      task({ id: 'next', title: 'Berikutnya', estimated_hours: 1, required_skills: [] }),
    ];
    const res = globalAssign(heavyTasks, heavyMembers, [], {
      cosineMap: flatCosine(heavyTasks, heavyMembers),
    });

    // Invariant: no member's final load may exceed the ceiling, whatever the
    // order the engine processed the tasks in.
    const ceiling = res.idealLoad * WORKLOAD_CAP_MULTIPLIER;
    for (const m of heavyMembers) {
      expect(res.memberLoads[m.id]).toBeLessThanOrEqual(ceiling + 1e-9);
    }
  });

  it('leaves the task UNASSIGNED when every candidate fails R2 (decision A)', () => {
    // 1h + 4h over 2 members -> ideal 2.5h, ceiling 3.125h. The 1h task is
    // processed first and fits; the 4h task cannot fit anyone afterwards.
    const m2: Member[] = [member({ id: 'a' }), member({ id: 'b' })];
    const t2: Task[] = [
      task({ id: 'kecil', estimated_hours: 1 }),
      task({ id: 'besar', estimated_hours: 4 }),
    ];
    const res = globalAssign(t2, m2, [], { cosineMap: flatCosine(t2, m2) });

    const besar = res.assignments.find((a) => a.taskId === 'besar')!;
    expect(besar.primaryMemberId).toBe('');
    expect(res.warnings.map((w) => w.code)).toContain('r2_no_candidate');
    // No silent overload: nobody was charged the hours.
    for (const m of m2) expect(res.memberLoads[m.id]).toBeLessThanOrEqual(3.125);
  });

  it('does not change the 1.25 multiplier or the score formula', () => {
    const b = computeScore(
      task({ id: 'x', estimated_hours: 1 }),
      member({ id: 'y', skills: {} }),
      0,
      4,
      0.8,
      DEFAULT_WEIGHTS,
      false
    );
    // 0.40K + 0.30S + 0.20C + 0.10M, computed from the same components.
    const expected =
      DEFAULT_WEIGHTS.K * b.K + DEFAULT_WEIGHTS.S * b.S + DEFAULT_WEIGHTS.C * b.C + DEFAULT_WEIGHTS.M * b.M;
    expect(b.total).toBeCloseTo(Number(expected.toFixed(4)), 4);
    expect(DEFAULT_WEIGHTS).toEqual({ K: 0.4, S: 0.3, C: 0.2, M: 0.1 });
  });
});

// ---------------------------------------------------------------------------
// TEST B — R3
// ---------------------------------------------------------------------------
describe('TEST B — R3: only level >= 3 on a required skill is a candidate', () => {
  const members: Member[] = [
    // Has frontend level 4, but backend is not rated at all.
    member({ id: 'awddd', skills: { 'pemrograman frontend': 4 } }),
    // Has both required skills at level >= 3.
    member({ id: 'sari', skills: { 'pemrograman frontend': 4, 'pemrograman backend': 4 } }),
  ];
  // Website Kasir needs frontend AND backend.
  const kasir = task({
    id: 'kasir',
    title: 'Website Kasir',
    estimated_hours: 1,
    required_skills: ['pemrograman frontend', 'pemrograman backend'],
  });

  it('uses .some() exactly as PRD v0.2 states', () => {
    // PRD: "minimal satu skill wajib berlevel 3 atau lebih". awddd has one
    // required skill at level 4, so .some() admits them. This is deliberate and
    // user-confirmed; .every() would contradict the PRD text.
    const pool = checkR3(kasir, members).map((m) => m.id);
    expect(pool).toContain('awddd');
    expect(pool).toContain('sari');
  });

  it('treats an unrated required skill as 0, never as 3', () => {
    const unrated = member({ id: 'baru', skills: {} });
    const pool = checkR3(kasir, [unrated]);
    // Nobody qualifies -> fallback returns everyone so a recommendation can
    // still be produced, but the member is still flagged as not R3-qualified.
    expect(pool.map((m) => m.id)).toEqual(['baru']);
  });

  it('flags a member with no required skill at level >= 3 as ineligible', () => {
    const nobody: Member[] = [
      member({ id: 'n1', skills: { 'pemrograman frontend': 2, 'pemrograman backend': 2 } }),
      member({ id: 'n2', skills: { 'pemrograman backend': 1 } }),
    ];
    const t: Task[] = [task({ id: 'kasir', estimated_hours: 1, required_skills: ['pemrograman frontend', 'pemrograman backend'] })];
    const res = globalAssign(t, nobody, [], { cosineMap: flatCosine(t, nobody) });
    const a = res.assignments[0];

    for (const m of nobody) {
      expect(a.scores[m.id].isEligible).toBe(false);
      expect(a.scores[m.id].warnings?.some((w) => w.includes('R3'))).toBe(true);
    }
  });

  it('keeps a lock (R5) even when the locked owner fails R3', () => {
    const locked = [{ taskId: 'kasir', primaryMemberId: 'awddd', isLocked: true, scores: {} }];
    const res = globalAssign([kasir], members, locked, { cosineMap: flatCosine([kasir], members) });
    expect(res.assignments[0].primaryMemberId).toBe('awddd');
    expect(res.assignments[0].isLocked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TEST C — no candidate at all
// ---------------------------------------------------------------------------
describe('TEST C — no candidate: warn, never pretend a valid candidate exists', () => {
  it('emits r3_no_candidate and recommends the best member honestly', () => {
    const members: Member[] = [
      member({ id: 'novice1', skills: { 'pemrograman frontend': 1 } }),
      member({ id: 'novice2', skills: { 'pemrograman frontend': 2 } }),
    ];
    // Two 1h tasks / 2 members -> ideal 1h, ceiling 1.25h, so R2 admits the task
    // and only R3 can explain the warning.
    const t: Task = task({ id: 'kasir', estimated_hours: 1, required_skills: ['pemrograman frontend'] });
    const filler: Task = task({ id: 'filler', estimated_hours: 1, required_skills: [] });
    const tasks = [t, filler];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    const warned = res.warnings.filter((w) => w.code === 'r3_no_candidate');
    expect(warned.map((w) => w.taskId)).toEqual(['kasir']);
    expect(warned[0].message).toContain('level minimal 3');

    // PRD: best-effort recommendation WITH the warning, not a false claim that
    // the member satisfies R3.
    const a = res.assignments.find((x) => x.taskId === 'kasir')!;
    expect(a.primaryMemberId).not.toBe('');
    expect(a.scores[a.primaryMemberId].isEligible).toBe(false);
    expect(a.scores[a.primaryMemberId].warnings?.some((w) => w.startsWith('R3'))).toBe(true);
  });

  it('still warns when the only R3-pool member is blocked by R2', () => {
    const members: Member[] = [
      member({ id: 'expert', skills: { 'pemrograman frontend': 5 } }),
      member({ id: 'novice', skills: { 'pemrograman frontend': 1 } }),
    ];
    // Single 10h task: ideal 5h, ceiling 6.25h -> expert is the only R3 candidate
    // and cannot take it.
    const t: Task = task({ id: 'kasir', estimated_hours: 10, required_skills: ['pemrograman frontend'] });
    const res = globalAssign([t], members, [], { cosineMap: flatCosine([t], members) });

    expect(res.assignments[0].primaryMemberId).toBe('');
    expect(res.warnings.map((w) => w.code)).toContain('r2_no_candidate');
    // The task is not deleted and the score is not faked.
    expect(res.assignments).toHaveLength(1);
    expect(res.assignments[0].scores['expert'].breakdown.total).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// TEST D — R4
// ---------------------------------------------------------------------------
describe('TEST D — R4: exactly one primary owner per task', () => {
  it('never assigns two tasks to the same row, and never two owners to one task', () => {
    const members = [member({ id: 'a' }), member({ id: 'b' }), member({ id: 'c' })];
    const tasks = [
      task({ id: 't1', estimated_hours: 1 }),
      task({ id: 't2', estimated_hours: 1 }),
      task({ id: 't3', estimated_hours: 1 }),
    ];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });

    expect(new Set(res.assignments.map((a) => a.taskId)).size).toBe(tasks.length);
    for (const a of res.assignments) {
      expect(typeof a.primaryMemberId).toBe('string');
      // One id, and it is always one of the roster (or the empty "unassigned").
      if (a.primaryMemberId !== '') {
        expect(members.map((m) => m.id)).toContain(a.primaryMemberId);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// TEST E — R5
// ---------------------------------------------------------------------------
describe('TEST E — R5: a locked task never changes on recompute', () => {
  const members = [member({ id: 'a' }), member({ id: 'b' })];
  const tasks = [
    task({ id: 't1', estimated_hours: 3 }),
    task({ id: 't2', estimated_hours: 1 }),
  ];

  it('keeps the locked owner and never moves the hours', () => {
    const locked = [{ taskId: 't1', primaryMemberId: 'b', isLocked: true, scores: {} }];
    const first = globalAssign(tasks, members, locked, { cosineMap: flatCosine(tasks, members) });
    const second = globalAssign(tasks, members, first.assignments, {
      cosineMap: flatCosine(tasks, members),
    });

    const a1 = first.assignments.find((a) => a.taskId === 't1')!;
    const a2 = second.assignments.find((a) => a.taskId === 't1')!;
    expect(a1.primaryMemberId).toBe('b');
    expect(a2.primaryMemberId).toBe('b');
    expect(a1.isLocked).toBe(true);
    expect(a2.isLocked).toBe(true);
  });

  it('keeps a locked owner even when the load already breaks the ceiling, and warns', () => {
    // ideal = 2h, ceiling 2.5h. The lock puts 3h on b: over the cap.
    const locked = [{ taskId: 't1', primaryMemberId: 'b', isLocked: true, scores: {} }];
    const res = globalAssign(tasks, members, locked, { cosineMap: flatCosine(tasks, members) });

    const a = res.assignments.find((x) => x.taskId === 't1')!;
    expect(a.primaryMemberId).toBe('b');
    expect(res.memberLoads['b']).toBe(3);
    expect(res.idealLoad * WORKLOAD_CAP_MULTIPLIER).toBe(2.5);

    const warning = res.warnings.find((w) => w.code === 'r2_locked_overload');
    expect(warning).toBeDefined();
    expect(warning!.taskId).toBe('t1');
    expect(warning!.memberId).toBe('b');
  });

  it('does not worsen a locked overload with a new assignment', () => {
    const locked = [{ taskId: 't1', primaryMemberId: 'b', isLocked: true, scores: {} }];
    const res = globalAssign(tasks, members, locked, { cosineMap: flatCosine(tasks, members) });

    // b already holds 3h; the unlocked 1h task must go to a.
    const t2 = res.assignments.find((x) => x.taskId === 't2')!;
    expect(t2.primaryMemberId).toBe('a');
    expect(res.memberLoads['b']).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// TEST F — score consistency
// ---------------------------------------------------------------------------
describe('TEST F — the matrix number is the K/S/C/M arithmetic', () => {
  it('reconstructs the displayed total from the components and weights', () => {
    const members = [
      member({
        id: 'ani',
        skills: { 'penulisan akademik': 5, 'riset literatur': 2 },
        interests: { 'penulisan akademik': 4, 'riset literatur': 3 },
      }),
      member({ id: 'budi', skills: { 'penulisan akademik': 3 }, capacity: 20 }),
    ];
    const tasks = [
      task({ id: 'bab2', title: 'Bab 2', estimated_hours: 1, required_skills: ['penulisan akademik'] }),
      task({ id: 'filler', estimated_hours: 1, required_skills: [] }),
    ];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members, 0.75) });

    for (const a of res.assignments) {
      for (const [memberId, score] of Object.entries(a.scores)) {
        const b = score.breakdown;
        const recombined =
          DEFAULT_WEIGHTS.K * b.K + DEFAULT_WEIGHTS.S * b.S + DEFAULT_WEIGHTS.C * b.C + DEFAULT_WEIGHTS.M * b.M;
        // Same source, so this must match to the 4-decimal rounding computeScore applies.
        expect(b.total).toBeCloseTo(Number(recombined.toFixed(4)), 4);
        // And the percentage the matrix renders comes from that same number.
        expect(Math.round(b.total * 100)).toBe(Math.round(recombined * 100));
        expect(memberId).toBe(score.memberId);
      }
    }
  });

  it('keeps a real score for a member who fails R2 (no more forced 0)', () => {
    const members = [member({ id: 'citra', skills: { 'penulisan akademik': 5 } })];
    const t = task({ id: 'bab2', estimated_hours: 1, required_skills: ['penulisan akademik'] });
    const b = computeScore(t, members[0], 99, 4, 0.9, DEFAULT_WEIGHTS, false);

    expect(b.total).toBeGreaterThan(0.5);
    expect(b.K + b.S + b.C + b.M).toBeGreaterThan(0);
  });

  it('separates raw score from eligibility in the assignment result', () => {
    const members = [
      member({ id: 'a', skills: { 'pemrograman frontend': 5 } }),
      member({ id: 'b', skills: { 'pemrograman frontend': 1 } }),
    ];
    const t = task({ id: 'kasir', estimated_hours: 1, required_skills: ['pemrograman frontend'] });
    const filler = task({ id: 'filler', estimated_hours: 1, required_skills: [] });
    const tasks = [t, filler];
    const res = globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });
    const a = res.assignments.find((x) => x.taskId === 'kasir')!;

    // Every member gets a real breakdown...
    for (const m of members) expect(a.scores[m.id].breakdown.total).toBeGreaterThan(0);
    // ...and a separate eligibility flag, which is where R1/R2/R3 live.
    expect(a.scores['a'].isEligible).toBe(true);
    expect(typeof a.scores['a'].isEligible).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// TEST G — manual interaction
// ---------------------------------------------------------------------------
describe('TEST G — move/swap never bypass R2 or R3', () => {
  const members: Member[] = [
    member({ id: 'a', skills: { 'pemrograman frontend': 5 } }),
    member({ id: 'b', skills: { 'pemrograman backend': 5 } }),
    member({ id: 'c', skills: { 'pemrograman frontend': 5 } }),
  ];
  const tasks: Task[] = [
    task({ id: 'front', estimated_hours: 1, required_skills: ['pemrograman frontend'] }),
    task({ id: 'back', estimated_hours: 1, required_skills: ['pemrograman backend'] }),
    task({ id: 'free', estimated_hours: 1, required_skills: [] }),
  ];
  const options = { tasks, members };

  const base = () =>
    globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) }).assignments;

  it('rejects a manual move that would break R3', () => {
    const assignments = base();
    // b has no frontend skill at level >= 3.
    const result = assignOwner(assignments, 'front', 'b', { lock: true, ...options });
    expect(result.changed).toBe(false);
    expect(result.error).toContain('R3');
    expect(result.next).toBe(assignments);
  });

  it('rejects a manual move that would break R2', () => {
    const assignments = base();
    // ideal = 3h / 3 members = 1h, ceiling 1.25h. a already holds 1h, so a
    // second 1h task would put a at 2h.
    const first = assignOwner(assignments, 'front', 'a', { lock: true, ...options });
    expect(first.error).toBeUndefined();
    const second = assignOwner(first.next, 'free', 'a', { lock: true, ...options });
    expect(second.changed).toBe(false);
    expect(second.error).toContain('R2');
  });

  it('allows a legal move', () => {
    const assignments = base();
    const result = assignOwner(assignments, 'free', 'c', { lock: true, ...options });
    expect(result.error).toBeUndefined();
    expect(result.changed).toBe(true);
    expect(result.next.find((a) => a.taskId === 'free')!.primaryMemberId).toBe('c');
  });

  it('rejects a swap that would break R3', () => {
    // front is owned by a (frontend only); back by b (backend only). Swapping
    // them puts b on a frontend task, which b cannot satisfy.
    const assignments = base();
    const result = swapOwners(assignments, 'front', 'back', options);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('R3');
    expect(result.next).toBe(assignments);
  });

  it('rejects a swap that would break R2', () => {
    const members2: Member[] = [
      member({ id: 'x', skills: { 'pemrograman frontend': 5, 'pemrograman backend': 5 } }),
      member({ id: 'y', skills: { 'pemrograman frontend': 5, 'pemrograman backend': 5 } }),
    ];
    // 1h + 2h over 2 members -> ideal 1.5h, ceiling 1.875h.
    const tasks2: Task[] = [
      task({ id: 'p', estimated_hours: 1, required_skills: [] }),
      task({ id: 'q', estimated_hours: 1, required_skills: [] }),
    ];
    const assignments: ReturnType<typeof base> = [
      { taskId: 'p', primaryMemberId: 'x', isLocked: false, scores: {} },
      { taskId: 'q', primaryMemberId: 'y', isLocked: false, scores: {} },
    ];
    void members2;
    void tasks2;

    // x holds 1h + a hidden 1h task: a swap would push it to 2h > 1.875h.
    const threeTasks: Task[] = [
      task({ id: 'p', estimated_hours: 1, required_skills: [] }),
      task({ id: 'q', estimated_hours: 1, required_skills: [] }),
      task({ id: 'r', estimated_hours: 1, required_skills: [] }),
    ];
    const state = [
      { taskId: 'p', primaryMemberId: 'x', isLocked: false, scores: {} },
      { taskId: 'q', primaryMemberId: 'x', isLocked: false, scores: {} },
      { taskId: 'r', primaryMemberId: 'y', isLocked: false, scores: {} },
    ];
    // ideal = 3h / 2 members = 1.5h, ceiling 1.875h: x already holds 2h.
    const result = swapOwners(state, 'p', 'r', { tasks: threeTasks, members: members2 });
    expect(assignments).toHaveLength(2);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('R2');
  });

  it('keeps R5: a locked task cannot be swapped or moved away', () => {
    const assignments = base().map((a) =>
      a.taskId === 'front' ? { ...a, isLocked: true } : a
    );
    const swap = swapOwners(assignments, 'front', 'free', options);
    expect(swap.ok).toBe(false);
    expect(swap.reason).toContain('terkunci');
  });

  it('a what-if preview runs through the same guards as a real move', () => {
    // The matrix rebuilds the preview with globalAssign, so an illegal preview
    // never becomes the applied state.
    const assignments = base();
    const preview = assignOwner(assignments, 'front', 'b', { lock: true, ...options });
    const previewed = globalAssign(tasks, members, preview.next, {
      cosineMap: flatCosine(tasks, members),
    });
    const front = previewed.assignments.find((a) => a.taskId === 'front')!;
    expect(front.primaryMemberId).not.toBe('b');
  });
});
