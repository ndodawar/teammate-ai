import { describe, it, expect } from 'vitest';
import { memberReason, engineReason, matchingSkills, missingSkills } from '@/lib/scoring/explain-local';
import type { Member, Task, ScoreBreakdown } from '@/lib/scoring/types';
import { generateExplanation } from '@/lib/scoring/assign';

const task: Task = {
  id: 't1',
  title: 'Bangun API',
  description: 'Membangun endpoint API.',
  difficulty: 4,
  estimated_hours: 6,
  required_skills: ['pemrograman backend', 'pengujian'],
};

const member: Member = {
  id: 'm1',
  name: 'Rizky',
  capacity: 10,
  skills: { 'pemrograman backend': 5 },
  interests: { 'pemrograman backend': 4 },
};

const breakdown: ScoreBreakdown = { K: 0, S: 0.5, C: 0.4, M: 0.75, total: 0.7595 };

describe('memberReason (FR-09)', () => {
  it('names only skills the member actually has at level 3 or more', () => {
    const text = memberReason({ task, member, breakdown, isPrimary: true, isFallback: true });
    const masteryClause = text.split('.')[0];
    expect(masteryClause).toContain('pemrograman backend');
    expect(masteryClause).not.toContain('pengujian');
    expect(text).toContain('Belum dinilai: pengujian');
  });

  it('never claims spare capacity when capacity is 0', () => {
    const zeroCapacity: ScoreBreakdown = { K: 0, S: 0.8, C: 0, M: 0.75, total: 0 };
    const text = memberReason({
      task,
      member,
      breakdown: zeroCapacity,
      isPrimary: true,
      isFallback: true,
    });
    expect(text).not.toMatch(/memadai/i);
    expect(text).toContain('tidak menyisakan kapasitas');
    expect(text).toContain('Skor 0%');
  });

  it('states the mode when the run is a fallback', () => {
    const text = memberReason({ task, member, breakdown, isPrimary: true, isFallback: true });
    expect(text).toContain('mode cadangan');
  });

  it('reports the score it was given, not a recomputed one', () => {
    const other: ScoreBreakdown = { ...breakdown, total: 0.1234 };
    expect(memberReason({ task, member, breakdown: other, isPrimary: false, isFallback: false })).toContain(
      'Skor 12%'
    );
  });

  it('explains an R1 exclusion rather than claiming capacity', () => {
    const noAvailability: Member = { ...member, capacity: 0 };
    const text = memberReason({
      task,
      member: noAvailability,
      breakdown: { ...breakdown, total: 0 },
      isPrimary: false,
      isFallback: false,
    });
    expect(text).toContain('R1');
    expect(text).not.toMatch(/memadai/i);
  });

  it('describes a task with no required skills without inventing one', () => {
    const freeTask: Task = { ...task, required_skills: [] };
    const text = memberReason({
      task: freeTask,
      member,
      breakdown,
      isPrimary: true,
      isFallback: false,
    });
    expect(text).toContain('tidak membutuhkan skill khusus');
  });

  it('differs from the old unconditional template that claimed capacity at 0% capacity', () => {
    const zeroCapacity: ScoreBreakdown = { K: 0, S: 0.8, C: 0, M: 0.75, total: 0 };
    const legacy = generateExplanation(task, member, zeroCapacity);
    expect(legacy).toContain('memadai'); // the defect this replaces
    const fixed = memberReason({ task, member, breakdown: zeroCapacity, isPrimary: true, isFallback: true });
    expect(fixed).not.toContain('memadai');
  });
});

describe('matchingSkills / missingSkills (R3 floor)', () => {
  it('uses level 3 as the floor and level 0 as "not rated"', () => {
    expect(matchingSkills(task, member)).toEqual(['pemrograman backend']);
    expect(missingSkills(task, member)).toEqual(['pengujian']);
  });

  it('returns an empty list when nothing is rated', () => {
    const empty: Member = { id: 'm2', name: 'Baru', capacity: 5, skills: {} };
    expect(matchingSkills(task, empty)).toEqual([]);
    expect(missingSkills(task, empty)).toEqual(['pemrograman backend', 'pengujian']);
  });
});

describe('engineReason (FR-09 / R1 / R2)', () => {
  it('marks an R1 exclusion', () => {
    const result = engineReason({
      task,
      member: { ...member, capacity: 0 },
      breakdown: { ...breakdown, total: 0 },
      isPrimary: false,
      isFallback: false,
    });
    expect(result.code).toBe('r1');
  });

  it('marks a capacity failure as R2', () => {
    const result = engineReason({
      task,
      member,
      breakdown: { K: 0, S: 0.8, C: 0, M: 0.75, total: 0 },
      isPrimary: false,
      isFallback: true,
    });
    expect(result.code).toBe('r2');
  });

  it('explains a primary pick and states the weight set actually used', () => {
    const hybrid = engineReason({ task, member, breakdown, isPrimary: true, isFallback: false });
    expect(hybrid.headline).toContain('Rekomendasi utama');
    expect(hybrid.detail).toContain('40%');
    const fallback = engineReason({ task, member, breakdown, isPrimary: true, isFallback: true });
    expect(fallback.detail).toContain('50%');
  });

  it('warns when R3 found no candidate with a level-3 skill', () => {
    const result = engineReason({
      task,
      member,
      breakdown: { ...breakdown, S: 0 },
      isPrimary: true,
      isFallback: true,
    });
    expect(result.headline).toContain('R3');
  });

  it('explains an alternative as the next eligible candidate', () => {
    const result = engineReason({ task, member, breakdown, isPrimary: false, isFallback: false });
    expect(result.code).toBe('alternative');
  });
});
