import { describe, it, expect } from 'vitest';
import { computeScore } from '../lib/scoring/score';
import { checkR2 } from '../lib/scoring/rules';
import { Member, Task } from '../lib/scoring/types';

describe('Scoring & Hard Constraints Engine', () => {
  it('enforces R2 capacity constraint (workload and limit)', () => {
    const task: Task = {
      id: 't1',
      title: 'Task 1',
      difficulty: 3,
      estimated_hours: 20,
      required_skills: ['pemrograman frontend']
    };
    const member: Member = {
      id: 'm1',
      name: 'Alice',
      skills: { 'pemrograman frontend': 5 },
      capacity: 40
    };
    const idealLoad = 40;

    // Load 30 + 20 = 50 > 40 -> invalid
    const valid = checkR2(member, task, 30, idealLoad);
    expect(valid).toBe(false);

    // Load 10 + 20 = 30 <= 40 -> valid
    const valid2 = checkR2(member, task, 10, idealLoad);
    expect(valid2).toBe(true);
  });

  it('computes weighted score components correctly', () => {
    const task: Task = {
      id: 't1',
      title: 'Task 1',
      difficulty: 2,
      estimated_hours: 10,
      required_skills: ['pemrograman frontend']
    };
    const member: Member = {
      id: 'm1',
      name: 'Bob',
      skills: { 'pemrograman frontend': 5 },
      capacity: 40,
      interests: { 'pemrograman frontend': 5 }
    };
    const idealLoad = 20;

    const breakdown = computeScore(task, member, 0, idealLoad);
    expect(breakdown.total).toBeGreaterThan(0);
    expect(breakdown.S).toBe(1);
  });
});
