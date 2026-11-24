import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HYBRID_WEIGHTS,
  redistributeWeights,
  weightsSumToOne,
  weightPercent,
  weightSumLabel,
  weightSumIsExact,
  assignOwner,
  toggleLockState,
  swapOwners,
  buildEventPayload,
  csvField,
  toCsv,
  toPlainText,
  compareSnapshots,
  describeR2,
  type ExportRow,
  type Snapshot,
} from '@/lib/scoring/interaction';
import { FALLBACK_WEIGHTS } from '@/lib/scoring/constants';
import type { Member, Task, TaskAssignment } from '@/lib/scoring/types';

function assignment(overrides: Partial<TaskAssignment> & { taskId: string }): TaskAssignment {
  return {
    primaryMemberId: 'm1',
    isLocked: false,
    scores: {},
    ...overrides,
  };
}

describe('redistributeWeights (FR-10)', () => {
  it('keeps the total at 1 for every key and every value', () => {
    const keys = ['K', 'S', 'C', 'M'] as const;
    for (const key of keys) {
      for (let v = 0; v <= 1.0001; v += 0.05) {
        const next = redistributeWeights(DEFAULT_HYBRID_WEIGHTS, key, Number(v.toFixed(2)));
        expect(weightsSumToOne(next)).toBe(true);
        expect(next[key]).toBeCloseTo(Number(v.toFixed(2)), 2);
      }
    }
  });

  it('never produces a negative weight', () => {
    for (let v = 0; v <= 1; v += 0.1) {
      const next = redistributeWeights(DEFAULT_HYBRID_WEIGHTS, 'S', Number(v.toFixed(2)));
      for (const value of Object.values(next)) expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('redistributes proportionally to the remaining share', () => {
    const next = redistributeWeights({ K: 0.4, S: 0.3, C: 0.2, M: 0.1 }, 'K', 0.8);
    expect(next.K).toBeCloseTo(0.8, 5);
    // S, C, M shrink by the same ratio (their original shares 3:2:1)
    expect(next.S / next.C).toBeCloseTo(1.5, 2);
    expect(next.C / next.M).toBeCloseTo(2, 2);
    expect(weightsSumToOne(next)).toBe(true);
  });

  it('handles a zero-sum rest without dividing by zero', () => {
    const next = redistributeWeights({ K: 0, S: 0, C: 0, M: 0 }, 'K', 0.4);
    expect(weightsSumToOne(next)).toBe(true);
    expect(next.K).toBeCloseTo(0.4, 5);
  });

  it('handles dragging one weight all the way to 1', () => {
    const next = redistributeWeights(DEFAULT_HYBRID_WEIGHTS, 'M', 1);
    expect(next.M).toBe(1);
    expect(next.K).toBe(0);
    expect(next.S).toBe(0);
    expect(next.C).toBe(0);
  });

  it('leaves a locked key untouched and still sums to 1', () => {
    const next = redistributeWeights(FALLBACK_WEIGHTS, 'S', 0.6, ['K']);
    expect(next.K).toBe(0);
    expect(next.S).toBeCloseTo(0.6, 5);
    expect(weightsSumToOne(next)).toBe(true);
  });

  it('refuses to move a locked key', () => {
    const next = redistributeWeights(DEFAULT_HYBRID_WEIGHTS, 'K', 0.9, ['K']);
    expect(next).toEqual(DEFAULT_HYBRID_WEIGHTS);
  });

  it('clamps out-of-range input', () => {
    expect(redistributeWeights(DEFAULT_HYBRID_WEIGHTS, 'S', -1).S).toBe(0);
    expect(redistributeWeights(DEFAULT_HYBRID_WEIGHTS, 'S', 3).S).toBe(1);
  });

  it('reports percentages without hidden rounding drift', () => {
    expect(weightPercent(0.3333)).toBe(33);
    expect(weightPercent(FALLBACK_WEIGHTS.C)).toBe(33);
    const next = redistributeWeights(DEFAULT_HYBRID_WEIGHTS, 'S', 0.37);
    const sum = (['K', 'S', 'C', 'M'] as const).reduce((s, k) => s + weightPercent(next[k]), 0);
    // 33/34 rounding may land within 1 point of 100, never more.
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(1);
  });

  it('reports an exact 100% sum as exact, so the UI does not warn in red', () => {
    // Regression: the header compared weightSumLabel() against the bare string
    // '100%', but the label reads 'Σ 100%', so a correct sum was shown in the
    // danger colour on every render.
    expect(weightSumLabel(DEFAULT_HYBRID_WEIGHTS)).toBe('Σ 100%');
    expect(weightSumIsExact(DEFAULT_HYBRID_WEIGHTS)).toBe(true);
    expect(weightSumIsExact(FALLBACK_WEIGHTS)).toBe(true);
  });

  it('flags a rounded sum that does not reach 100', () => {
    // 0.335/0.335/0.165/0.165 rounds to 34+34+17+17 = 102.
    const drifted = { K: 0.335, S: 0.335, C: 0.165, M: 0.165 };
    expect(weightSumIsExact(drifted)).toBe(false);
    expect(weightSumLabel(drifted)).toContain('pembulatan');
  });
});

describe('assignOwner (FR-11)', () => {
  const base = [assignment({ taskId: 't1' }), assignment({ taskId: 't2', primaryMemberId: 'm2' })];
  const members: Member[] = [
    { id: 'm1', name: 'M1', capacity: 100, skills: {}, interests: {} },
    { id: 'm2', name: 'M2', capacity: 100, skills: {}, interests: {} },
    { id: 'm3', name: 'M3', capacity: 100, skills: {}, interests: {} },
    { id: 'm9', name: 'M9', capacity: 100, skills: {}, interests: {} },
  ];
  // T-6.09: the roster carries four tasks (8h / 4 members = ideal 2h, R2 ceiling
  // 2.5h) so a 2h task is assignable and only the FR-11 behaviour is under test.
  const tasks: Task[] = [
    { id: 't1', title: 'T1', estimated_hours: 2, difficulty: 1, required_skills: [] },
    { id: 't2', title: 'T2', estimated_hours: 2, difficulty: 1, required_skills: [] },
    { id: 'd1', title: 'D1', estimated_hours: 2, difficulty: 1, required_skills: [] },
    { id: 'd2', title: 'D2', estimated_hours: 2, difficulty: 1, required_skills: [] },
  ];
  const options = { tasks, members };

  it('changes the owner and records the change', () => {
    const { next, changed } = assignOwner(base, 't1', 'm3', { ...options, lock: true });
    expect(changed).toBe(true);
    expect(next[0].primaryMemberId).toBe('m3');
    expect(next[0].isLocked).toBe(true);
  });

  it('locks a task when the change is manual', () => {
    const { next } = assignOwner(base, 't2', 'm9', { ...options, lock: true });
    expect(next[1].isLocked).toBe(true);
  });

  it('does not lock when accepting the engine recommendation', () => {
    const { next } = assignOwner(base, 't1', 'm1', { ...options, lock: false });
    expect(next[0].isLocked).toBe(false);
    expect(next[0].primaryMemberId).toBe('m1');
  });

  it('reports no change for a no-op', () => {
    const { changed } = assignOwner(base, 't1', 'm1', { ...options, lock: false });
    expect(changed).toBe(false);
  });

  it('ignores an unknown task', () => {
    const { next, changed } = assignOwner(base, 'nope', 'm1', { ...options, lock: true });
    expect(changed).toBe(false);
    expect(next).toBe(base);
  });
});

describe('toggleLockState (FR-11 / R5)', () => {
  it('toggles both ways', () => {
    const base = [assignment({ taskId: 't1' })];
    const on = toggleLockState(base, 't1');
    expect(on?.locked).toBe(true);
    const off = toggleLockState(on!.next, 't1');
    expect(off?.locked).toBe(false);
  });

  it('returns null for an unknown task instead of inventing one', () => {
    expect(toggleLockState([], 't1')).toBeNull();
  });
});

describe('swapOwners (FR-11)', () => {
  const members: Member[] = [
    { id: 'm1', name: 'M1', capacity: 100, skills: {}, interests: {} },
    { id: 'm2', name: 'M2', capacity: 100, skills: {}, interests: {} },
  ];
  const tasks: Task[] = [
    { id: 't1', title: 'T1', estimated_hours: 2, difficulty: 1, required_skills: [] },
    { id: 't2', title: 'T2', estimated_hours: 2, difficulty: 1, required_skills: [] },
  ];
  const options = { tasks, members };

  it('exchanges two unlocked owners', () => {
    const base = [
      assignment({ taskId: 't1', primaryMemberId: 'm1' }),
      assignment({ taskId: 't2', primaryMemberId: 'm2' }),
    ];
    const { next, ok } = swapOwners(base, 't1', 't2', options);
    expect(ok).toBe(true);
    expect(next.find((a) => a.taskId === 't1')!.primaryMemberId).toBe('m2');
    expect(next.find((a) => a.taskId === 't2')!.primaryMemberId).toBe('m1');
  });

  it('refuses to swap when either task is locked (R5)', () => {
    const base = [
      assignment({ taskId: 't1', primaryMemberId: 'm1', isLocked: true }),
      assignment({ taskId: 't2', primaryMemberId: 'm2' }),
    ];
    const result = swapOwners(base, 't1', 't2', options);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('terkunci');
    expect(result.next).toBe(base);
  });

  it('refuses to swap a task with itself', () => {
    const base = [assignment({ taskId: 't1' })];
    expect(swapOwners(base, 't1', 't1', options).ok).toBe(false);
  });
});

describe('buildEventPayload (FR-16 / PRD 6.4)', () => {
  it('drops notes and descriptions', () => {
    const payload = buildEventPayload('assignment_changed', {
      taskId: 't1',
      taskTitle: 'Laporan',
      memberName: 'Ani',
      note: 'punya riwayat kesehatan',
      description: 'teks tugas',
      previousMemberName: null,
    });
    expect(payload).not.toHaveProperty('note');
    expect(payload).not.toHaveProperty('description');
    expect(payload.memberName).toBe('Ani');
  });

  it('drops undefined values so the payload stays small', () => {
    const payload = buildEventPayload('recommendation_created', { a: 1, b: undefined });
    expect(payload).toEqual({ a: 1 });
  });
});

describe('CSV export (FR-14)', () => {
  const row: ExportRow = {
    task: 'Bangun API',
    hours: 6,
    effort: 4,
    primary: 'Rizky',
    alternative: 'Tomi',
    total: '76',
    K: '0',
    S: '100',
    C: '40',
    M: '75',
    locked: 'tidak',
    reason: 'Rizky menguasai pemrograman backend. Skor 76%.',
  };

  it('quotes every field', () => {
    expect(csvField('abc')).toBe('"abc"');
  });

  it('doubles embedded quotes', () => {
    expect(csvField('Kata "penting"')).toBe('"Kata ""penting"""');
  });

  it('keeps commas and newlines inside a quoted field', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('baris 1\nbaris 2')).toBe('"baris 1\nbaris 2"');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(csvField('=SUM(A1)')).toBe(`"'=SUM(A1)"`);
    expect(csvField('+62')).toBe(`"'+62"`);
  });

  it('writes a header and one CRLF-separated line per task', () => {
    const csv = toCsv([row, { ...row, task: 'Laporan, akhir' }]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('"Tugas"');
    expect(lines[2]).toContain('"Laporan, akhir"');
  });

  it('keeps the empty alternative as an empty field, never a placeholder', () => {
    const csv = toCsv([{ ...row, alternative: '', reason: '' }]);
    expect(csv.split('\r\n')[1]).toContain(',"","76"');
  });
});

describe('plain-text export (FR-14)', () => {
  it('states the mode, the weights and the real loads', () => {
    const text = toPlainText(
      [
        {
          task: 'Bangun API',
          hours: 6,
          effort: 4,
          primary: 'Rizky',
          alternative: '',
          total: '76',
          K: '0',
          S: '100',
          C: '40',
          M: '75',
          locked: 'ya',
          reason: '',
        },
      ],
      {
        code: 'abc123',
        isFallback: true,
        weights: FALLBACK_WEIGHTS,
        idealLoad: 7.5,
        loads: [{ name: 'Rizky', load: 10, capacity: 10, over: true }],
      }
    );
    expect(text).toContain('abc123');
    expect(text).toContain('Cadangan');
    expect(text).toContain('Bangun API | Rizky');
    expect(text).toContain('terkunci');
    expect(text).toContain('Rizky: 10 jam dari 10 jam (melewati batas)');
  });

  it('reports the weights actually used, not the mode defaults', () => {
    // Regression: the fallback header was hardcoded to S 0,50 / C 0,33 / M 0,17,
    // so an export produced after moving the sliders contradicted its own scores.
    const text = toPlainText([], {
      code: 'abc123',
      isFallback: true,
      weights: { K: 0, S: 0.68, C: 0.21, M: 0.11 },
      idealLoad: 7.5,
      loads: [],
    });
    expect(text).toContain('S 68%');
    expect(text).toContain('C 21%');
    expect(text).toContain('M 11%');
    expect(text).not.toContain('S 50%');
  });
});

describe('compareSnapshots (FR-17)', () => {
  const before: Snapshot = {
    label: 'awal',
    primaryByTask: { t1: 'm1', t2: 'm2' },
    totalByTask: { t1: 0.5, t2: 0.6 },
    loadByMember: { m1: 6, m2: 4 },
  };

  it('detects owner changes and load deltas from real data', () => {
    const after: Snapshot = {
      label: 'sekarang',
      primaryByTask: { t1: 'm2', t2: 'm2' },
      totalByTask: { t1: 0.5, t2: 0.6 },
      loadByMember: { m1: 0, m2: 10 },
    };
    const result = compareSnapshots(before, after, { t1: 'Tugas 1', t2: 'Tugas 2' }, { m1: 'Ani', m2: 'Budi' });
    expect(result.changedCount).toBe(1);
    expect(result.ownerChanges[0]).toMatchObject({ fromMember: 'Ani', toMember: 'Budi' });
    expect(result.loadDeltas.find((d) => d.memberId === 'm1')!.delta).toBe(-6);
    expect(result.loadDeltas.find((d) => d.memberId === 'm2')!.delta).toBe(6);
  });

  it('reports a score-only change separately from an owner change', () => {
    const after: Snapshot = {
      label: 'sekarang',
      primaryByTask: { t1: 'm1', t2: 'm2' },
      totalByTask: { t1: 0.8, t2: 0.6 },
      loadByMember: { m1: 6, m2: 4 },
    };
    const result = compareSnapshots(before, after, { t1: 'Tugas 1', t2: 'Tugas 2' }, { m1: 'Ani', m2: 'Budi' });
    expect(result.changedCount).toBe(0);
    expect(result.scoreOnlyChanges).toBe(1);
  });
});

describe('describeR2 (FR-12)', () => {
  it('uses 1,25 x ideal as the threshold', () => {
    expect(describeR2(9, 4, 40)).toContain('Melewati batas R2');
    expect(describeR2(5.01, 4, 40)).toContain('Melewati batas R2');
    expect(describeR2(5, 4, 40)).toContain('Dalam batas');
  });

  it('distinguishes an R2 breach from a capacity breach', () => {
    expect(describeR2(7, 10, 6)).toBe('Melewati jam tersedia (6 jam).');
  });
});
