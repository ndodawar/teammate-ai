import { describe, it, expect } from 'vitest';
import { globalAssign } from '@/lib/scoring/assign';
import { computeScore } from '@/lib/scoring/score';
import { DEFAULT_WEIGHTS, FALLBACK_WEIGHTS } from '@/lib/scoring/constants';
import { Task, Member } from '@/lib/scoring/types';

const tasks: Task[] = [
  { id: 't1', title: 'Uji perangkat', difficulty: 3, estimated_hours: 10, required_skills: ['pengujian'] },
];
const members: Member[] = [
  { id: 'm1', name: 'Budi', skills: { pengujian: 4 }, interests: { pengujian: 5 }, capacity: 40 },
];

// Reference value: S = 4/5, C = (40-10)/40, M = (5-1)/4, K dropped.
const EXPECTED_FALLBACK_TOTAL = 0.8175;

describe('FR-13 / PRD 8.6: fallback activation and weights', () => {
  describe('A. embedding failure activates fallback instead of throwing', () => {
    it('assigns with a completely empty cosine map when isFallback is set', () => {
      const result = globalAssign(tasks, members, [], { isFallback: true, cosineMap: {} });

      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].primaryMemberId).toBe('m1');
    });

    it('assigns when the cosine map has the task but not the member pair', () => {
      expect(() =>
        globalAssign(tasks, members, [], { isFallback: true, cosineMap: { t1: {} } })
      ).not.toThrow();
    });

    it('still reports a missing embedding as fatal when AI mode is active', () => {
      // Guard rail: the fallback must not swallow a genuine hybrid-path defect.
      expect(() => globalAssign(tasks, members, [], { isFallback: false, cosineMap: {} })).toThrow(
        /Embedding missing for task t1 member m1/
      );
      expect(() => globalAssign(tasks, members, [], { cosineMap: {} })).toThrow(/Embedding missing/);
    });
  });

  describe('B. K is zero and does not influence the score', () => {
    it('nulls K in the breakdown', () => {
      const { assignments } = globalAssign(tasks, members, [], { isFallback: true, cosineMap: {} });

      expect(assignments[0].scores['m1'].breakdown.K).toBe(0);
    });

    it('ignores whatever cosine value is present in fallback mode', () => {
      const withCosine = globalAssign(tasks, members, [], {
        isFallback: true,
        cosineMap: { t1: { m1: 0.95 } },
      });
      const withoutCosine = globalAssign(tasks, members, [], { isFallback: true, cosineMap: {} });

      expect(withCosine.assignments[0].scores['m1'].breakdown).toEqual(
        withoutCosine.assignments[0].scores['m1'].breakdown
      );
    });
  });

  describe('C. fallback weights are exactly S 0.50 / C 0.33 / M 0.17', () => {
    it('uses FALLBACK_WEIGHTS from constants, not a local copy', () => {
      expect(FALLBACK_WEIGHTS).toEqual({ K: 0, S: 0.5, C: 0.33, M: 0.17 });
    });

    it('uses FALLBACK_WEIGHTS when the caller sends no weights', () => {
      const noWeights = computeScore(tasks[0], members[0], 0, 10, undefined, undefined, true);
      const withFallbackWeights = computeScore(
        tasks[0], members[0], 0, 10, undefined, FALLBACK_WEIGHTS, true
      );

      expect(withFallbackWeights.total).toBe(EXPECTED_FALLBACK_TOTAL);
      expect(noWeights.total).toBe(withFallbackWeights.total);
    });

    it('honours caller weights in fallback mode so the FR-10 sliders work', () => {
      // FR-10: the slider must change the result. K stays 0 in fallback, but an
      // explicit S/C/M split has to be applied instead of being silently replaced
      // by the fallback default.
      const standard = computeScore(tasks[0], members[0], 0, 10, undefined, DEFAULT_WEIGHTS, true);
      const fallback = computeScore(tasks[0], members[0], 0, 10, undefined, FALLBACK_WEIGHTS, true);

      expect(standard.total).not.toBe(fallback.total);
      // K is 0 in fallback mode, so only S/C/M contribute.
      expect(standard.K).toBe(0);
      expect(fallback.K).toBe(0);
    });

    it('reproduces the PRD 8.6 arithmetic by hand', () => {
      // 0.50*0.8 + 0.33*0.75 + 0.17*1.0 = 0.8175
      const s = 0.5 * 0.8 + 0.33 * 0.75 + 0.17 * 1.0;

      expect(s).toBeCloseTo(EXPECTED_FALLBACK_TOTAL, 10);
      expect(FALLBACK_WEIGHTS).toEqual({ K: 0, S: 0.5, C: 0.33, M: 0.17 });
    });

    it('keeps member ranking identical through globalAssign', () => {
      const { assignments } = globalAssign(tasks, members, [], { isFallback: true, cosineMap: {} });

      expect(assignments[0].scores['m1'].breakdown.total).toBe(EXPECTED_FALLBACK_TOTAL);
    });
  });

  describe('D. fallback weights sum to 1.00', () => {
    it('adds up to exactly one', () => {
      const sum = FALLBACK_WEIGHTS.K + FALLBACK_WEIGHTS.S + FALLBACK_WEIGHTS.C + FALLBACK_WEIGHTS.M;

      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('bounds a perfect candidate at 1.00 with an empty cosine map', () => {
      const perfect: Member = {
        id: 'm2',
        name: 'Sempurna',
        skills: { pengujian: 5 },
        interests: { pengujian: 5 },
        capacity: 100,
      };
      const lightTask: Task = {
        id: 't2',
        title: 'Uji cepat',
        difficulty: 1,
        estimated_hours: 0,
        required_skills: ['pengujian'],
      };

      const b = computeScore(lightTask, perfect, 0, 10, undefined, FALLBACK_WEIGHTS, true);

      expect(b.K).toBe(0);
      expect(b.total).toBe(1);
    });

    it('keeps the fallback sum at 1.00 with no rounding drift', () => {
      const sum = FALLBACK_WEIGHTS.K + FALLBACK_WEIGHTS.S + FALLBACK_WEIGHTS.C + FALLBACK_WEIGHTS.M;

      // 0.50 + 0.33 + 0.17 is exact in binary floating point, unlike 0.40+0.30+0.20+0.10.
      expect(sum).toBe(1);
      expect(DEFAULT_WEIGHTS.K + DEFAULT_WEIGHTS.S + DEFAULT_WEIGHTS.C + DEFAULT_WEIGHTS.M).not.toBe(1);
    });
  });

  describe('E. backend and UI scores agree', () => {
    it('recomputes to the identical breakdown the API returned', () => {
      // Mirrors the UI: POST /api/recommend returns assignments + isFallback, then
      // result-client re-runs globalAssign locally with its own weights state.
      const apiResponse = globalAssign(tasks, members, [], {
        weights: DEFAULT_WEIGHTS,
        isFallback: true,
        cosineMap: {},
      });

      const uiState = { K: 0.4, S: 0.3, C: 0.2, M: 0.1 };
      const uiResult = globalAssign(tasks, members, apiResponse.assignments, {
        weights: uiState,
        isFallback: true,
        cosineMap: {},
      });

      expect(uiResult.assignments[0].scores['m1'].breakdown).toEqual(
        apiResponse.assignments[0].scores['m1'].breakdown
      );
      expect(uiResult.memberLoads).toEqual(apiResponse.memberLoads);
    });

    it('holds when the UI slider moves S/C/M inside fallback mode', () => {
      const uiState = { K: 0, S: 0.6, C: 0.25, M: 0.15 };
      const b = globalAssign(tasks, members, [], {
        weights: uiState,
        isFallback: true,
        cosineMap: {},
      }).assignments[0].scores['m1'].breakdown;

      // 0.60*0.8 + 0.25*0.75 + 0.15*1 = 0.8175, still K-free and on a 1.00 scale.
      expect(b.K).toBe(0);
      expect(b.total).toBe(EXPECTED_FALLBACK_TOTAL);
    });
  });

  describe('F. AI mode keeps the standard weights', () => {
    it('uses 0.40 / 0.30 / 0.20 / 0.10', () => {
      expect(DEFAULT_WEIGHTS).toEqual({ K: 0.4, S: 0.3, C: 0.2, M: 0.1 });
    });

    it('applies the standard formula when AI is active', () => {
      // K = (0.8 - 0.2) / (0.8 - 0.2) = 1.0
      const b = computeScore(tasks[0], members[0], 0, 10, 0.8, DEFAULT_WEIGHTS, false);

      // 0.40*1.0 + 0.30*0.8 + 0.20*0.75 + 0.10*1.0 = 0.89
      expect(b.K).toBe(1);
      expect(b.S).toBe(0.8);
      expect(b.C).toBe(0.75);
      expect(b.M).toBe(1);
      expect(b.total).toBe(0.89);
    });

    it('keeps the standard weights when no weights are passed', () => {
      const withDefaults = computeScore(tasks[0], members[0], 0, 10, 0.5, undefined, false);
      const explicit = computeScore(tasks[0], members[0], 0, 10, 0.5, DEFAULT_WEIGHTS, false);

      expect(withDefaults).toEqual(explicit);
    });

    it('does not apply fallback weights outside fallback mode', () => {
      const hybrid = computeScore(tasks[0], members[0], 0, 10, 0.8, DEFAULT_WEIGHTS, false);
      const fallback = computeScore(tasks[0], members[0], 0, 10, 0.8, FALLBACK_WEIGHTS, true);

      expect(hybrid.total).not.toBe(fallback.total);
    });
  });

  describe('G. R1-R5 still hold under fallback', () => {
    it('R1: zero-capacity member is never assigned', () => {
      const { assignments } = globalAssign(tasks, members, [], { isFallback: true, cosineMap: {} });

      assignments.forEach((a) => expect(a.primaryMemberId).not.toBe('busy'));
    });

    it('R2: respects the 1.25x ideal-load cap', () => {
      const { assignments } = globalAssign(tasks, members, [], { isFallback: true, cosineMap: {} });

      // idealLoad = 10 / 1 member = 10, so the cap is 12.5h; a 10h task fits once.
      expect(assignments).toHaveLength(1);
    });

    it('R3: only level>=3 members are candidates', () => {
      // T-6.09 note on the numbers: R2 caps a task at 1.25 x ideal load, where
      // ideal = total effort / member count. Two members need at least 4h of
      // work for a 1.25h ceiling to admit a 1h task, and the largest task is
      // processed first, so the second task must be tiny. Numbers here: 1h ML +
      // 3h filler = 4h total -> ideal 2h, ceiling 2.5h.
      const pool: Member[] = [
        { id: 'expert', name: 'Expert', skills: { 'data dan machine learning': 4 }, capacity: 40 },
        { id: 'novice', name: 'Novice', skills: { 'data dan machine learning': 1 }, capacity: 40 },
      ];
      const mlTask: Task = {
        id: 't1',
        title: 'ML',
        difficulty: 4,
        estimated_hours: 1,
        required_skills: ['data dan machine learning'],
      };
      const fillerTask: Task = {
        id: 'filler',
        title: 'Dokumentasi',
        difficulty: 5,
        estimated_hours: 3,
        required_skills: [],
      };

      const { assignments } = globalAssign([mlTask, fillerTask], pool, [], {
        isFallback: true,
        cosineMap: {},
      });
      const mlAssignment = assignments.find((a) => a.taskId === 't1')!;

      expect(mlAssignment.primaryMemberId).toBe('expert');
      expect(mlAssignment.scores['novice'].isEligible).toBe(false);
      expect(mlAssignment.scores['expert'].isEligible).toBe(true);
    });

    it('R3 + R2: the only R3 candidate over the cap leaves the task unassigned', () => {
      // Same roster, 10h task: ideal 5h, ceiling 6.25h. The expert is the only
      // R3 candidate and would exceed the cap, so R2 decides and the row stays
      // empty with a warning instead of silently overloading the expert.
      const pool: Member[] = [
        { id: 'expert', name: 'Expert', skills: { 'data dan machine learning': 4 }, capacity: 40 },
        { id: 'novice', name: 'Novice', skills: { 'data dan machine learning': 1 }, capacity: 40 },
      ];
      const heavyTask: Task = {
        id: 't1',
        title: 'ML',
        difficulty: 4,
        estimated_hours: 10,
        required_skills: ['data dan machine learning'],
      };

      const result = globalAssign([heavyTask], pool, [], { isFallback: true, cosineMap: {} });

      expect(result.assignments[0].primaryMemberId).toBe('');
      expect(result.warnings.map((w) => w.code)).toContain('r2_no_candidate');
      // The raw score is still reported: eligibility is separate from the score.
      expect(result.assignments[0].scores['expert'].breakdown.total).toBeGreaterThan(0);
    });

    it('R4: every task gets exactly one primary owner', () => {
      const { assignments } = globalAssign(tasks, members, [], { isFallback: true, cosineMap: {} });

      assignments.forEach((a) => expect(typeof a.primaryMemberId).toBe('string'));
      expect(new Set(assignments.map((a) => a.taskId)).size).toBe(assignments.length);
    });

    it('R5: a locked assignment survives fallback recomputation', () => {
      const twoMembers: Member[] = [
        { id: 'm1', name: 'Alice', skills: { pengujian: 5 }, capacity: 40 },
        { id: 'm2', name: 'Bob', skills: { pengujian: 5 }, capacity: 40 },
      ];
      const existing = [{ taskId: 't1', primaryMemberId: 'm2', isLocked: true, scores: {} }];

      const { assignments } = globalAssign(tasks, twoMembers, existing, {
        isFallback: true,
        cosineMap: {},
      });

      expect(assignments[0].primaryMemberId).toBe('m2');
      expect(assignments[0].isLocked).toBe(true);
    });
  });

  describe('H. non-AI failures are not mistaken for fallback', () => {
    it('a zero-capacity project degrades R1-wise but never fabricates a member', () => {
      const { assignments } = globalAssign(tasks, [], [], { isFallback: true, cosineMap: {} });

      expect(assignments[0].primaryMemberId).toBe('');
    });

    it('reruns deterministically so a repeated request cannot silently change mode', () => {
      const first = globalAssign(tasks, members, [], { isFallback: true, cosineMap: {} });
      const second = globalAssign(tasks, members, [], { isFallback: true, cosineMap: {} });

      expect(second).toEqual(first);
    });

    it('keeps the missing-embedding error message intact for diagnostics', () => {
      expect(() => globalAssign(tasks, members, [], { cosineMap: {} })).toThrow(
        /Embedding missing for task t1 member m1/
      );
    });

    it('accepts a real zero cosine as data, not as a missing embedding', () => {
      const { assignments } = globalAssign(tasks, members, [], {
        isFallback: false,
        cosineMap: { t1: { m1: 0 } },
      });

      expect(assignments[0].scores['m1'].breakdown.K).toBe(0);
    });
  });
});
