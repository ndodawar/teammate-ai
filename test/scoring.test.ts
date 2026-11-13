import { describe, it, expect } from 'vitest';
import { checkHardConstraints, computeScore } from '../lib/scoring/score';

describe('Scoring & Hard Constraints Engine', () => {
  it('enforces R1 capacity constraint', () => {
    const task = { id: 't1', title: 'Task 1', difficulty: 3, estimated_hours: 20, required_skills: ['TypeScript'] };
    const member = { id: 'm1', name: 'Alice', skills: ['TypeScript'], capacity: 40, preference_score: 1.0 };
    
    // Load 30 + 20 > 40 -> invalid
    const valid = checkHardConstraints(task, member, 30);
    expect(valid).toBe(false);

    // Load 10 + 20 <= 40 -> valid
    const valid2 = checkHardConstraints(task, member, 10);
    expect(valid2).toBe(true);
  });

  it('computes weighted score components correctly', () => {
    const task = { id: 't1', title: 'Task 1', difficulty: 2, estimated_hours: 10, required_skills: ['React'] };
    const member = { id: 'm1', name: 'Bob', skills: ['React', 'Node'], capacity: 40, preference_score: 0.9 };
    
    const breakdown = computeScore(task, member, 0);
    expect(breakdown.total).toBeGreaterThan(0);
    expect(breakdown.S).toBe(1);
  });
});
