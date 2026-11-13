import { describe, it, expect } from 'vitest';
import { Member, Task } from '../../lib/scoring/types';
import { computeScore } from '../../lib/scoring/score';

describe('Numerical Acceptance Test §8.4', () => {
  it('reproduces exact expected scores for Menyusun Bab 2 scenario', () => {
    // Task: Menyusun Bab 2, required_skills: ['penulisan akademik', 'riset literatur'], effort: 3, load limit: 7
    const task: Task = {
      id: 'task-bab-2',
      title: 'Menyusun Bab 2',
      difficulty: 3,
      estimated_hours: 3,
      required_skills: ['penulisan akademik', 'riset literatur']
    };

    const idealLoad = 4; // Assume ideal load allows capacity check

    // Candidate Ani: K=0.80, S=1.00, C=0.29, M=0.75
    // Skills: penulisan akademik: 5, riset literatur: 5 -> S = (5/5 + 5/5)/2 = 1.00
    // Capacity: 7, load: 2 -> C = 1 - (2 + 3)/7 = 2/7 = 0.2857 ~ 0.29
    // Interests: penulisan akademik: 4, riset literatur: 4 -> M = (4 - 1)/4 = 0.75
    // Raw Cosine for K=0.80 -> 0.80 cosine raw normalizes via (0.68) -> K=0.80
    const memberAni: Member = {
      id: 'ani',
      name: 'Ani',
      capacity: 7,
      skills: { 'penulisan akademik': 5, 'riset literatur': 5 },
      interests: { 'penulisan akademik': 4, 'riset literatur': 4 }
    };

    // Candidate Budi: K=0.55, S=0.50, C=0.57, M=0.50
    const memberBudi: Member = {
      id: 'budi',
      name: 'Budi',
      capacity: 7,
      skills: { 'penulisan akademik': 3, 'riset literatur': 2 }, // avg 2.5/5 = 0.50
      interests: { 'penulisan akademik': 3, 'riset literatur': 3 } // avg 3 -> (3-1)/4 = 0.50
    };

    // Candidate Citra: Violates R2 workload cap
    const memberCitra: Member = {
      id: 'citra',
      name: 'Citra',
      capacity: 7,
      skills: { 'penulisan akademik': 5, 'riset literatur': 5 },
      interests: { 'penulisan akademik': 5, 'riset literatur': 5 }
    };

    // Ani score check (currentLoad = 2)
    const scoreAni = computeScore(task, memberAni, 2, idealLoad, 0.68);
    expect(scoreAni.S).toBe(1.00);
    expect(scoreAni.C).toBe(0.2857);
    expect(scoreAni.M).toBe(0.75);
    expect(scoreAni.total).toBeGreaterThan(0.70);

    // Budi score check (currentLoad = 0)
    const scoreBudi = computeScore(task, memberBudi, 0, idealLoad, 0.53);
    expect(scoreBudi.S).toBe(0.50);
    expect(scoreBudi.C).toBe(0.5714);
    expect(scoreBudi.M).toBe(0.50);

    // Citra score check (currentLoad = 5 -> 5+3=8 > max 5 allowed by R2/capacity)
    const scoreCitra = computeScore(task, memberCitra, 5, idealLoad, 0.90);
    expect(scoreCitra.total).toBe(0); // Ineligible due to R2 constraint
  });
});
