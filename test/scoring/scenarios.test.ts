import { describe, it, expect } from 'vitest';
import { SCENARIOS } from './fixtures/scenarios';
import { globalAssign } from '../../lib/scoring/assign';

const NO_EMBEDDING_COSINE = 0.5;

// Fase 1 scenarios exercise the deterministic S/C/M rules, so every pair is
// given the neutral reference cosine until the pipeline supplies real ones.
function uniformCosineMap(scenario: (typeof SCENARIOS)[number]) {
  const map: Record<string, Record<string, number>> = {};
  for (const task of scenario.tasks) {
    map[task.id] = {};
    for (const member of scenario.members) {
      map[task.id][member.id] = NO_EMBEDDING_COSINE;
    }
  }
  return map;
}

describe('D2 Synthetic Dataset Scenarios', () => {
  SCENARIOS.forEach((scenario, index) => {
    it(`Scenario ${index + 1}: ${scenario.description}`, () => {
      const result = globalAssign(scenario.tasks, scenario.members, [], {
        cosineMap: uniformCosineMap(scenario),
      });
      
      expect(result.assignments.length).toBe(scenario.tasks.length);

      /*
       * T-6.09 / PRD R2: a task may legitimately have NO owner when every
       * candidate would exceed 1.25 x ideal load. The old assertion demanded a
       * non-empty primaryMemberId for every row, which is exactly the behaviour
       * that produced the reported violation (a 5h load against a 3.125h cap).
       * Instead we assert the invariant that must hold either way: an assignment
       * exists exactly when some member is eligible, and every non-empty owner
       * is an eligible candidate.
       */
      result.assignments.forEach(a => {
        expect(typeof a.primaryMemberId).toBe('string');
        if (a.primaryMemberId === '') {
          // Unassigned is only legal when nothing was eligible, and it must be
          // explained by a warning rather than left silent.
          expect(Object.values(a.scores).some(s => s.isEligible)).toBe(false);
          expect(result.warnings.some(w => w.taskId === a.taskId)).toBe(true);
        } else {
          expect(a.scores[a.primaryMemberId].isEligible).toBe(true);
        }
        expect(result.warnings.filter(w => w.taskId === a.taskId && w.code === 'r3_no_candidate'))
          .toHaveLength(a.scores && scenario.tasks.find(t => t.id === a.taskId)!.required_skills.length > 0 &&
            !scenario.members.some(m => scenario.tasks.find(t => t.id === a.taskId)!.required_skills.some(s => (m.skills[s] ?? 0) >= 3))
            ? 1 : 0);
      });

      // Special case: Scenario 4 (Zero Capacity R1)
      if (scenario.description.includes('R1')) {
        const busyMember = scenario.members.find(m => m.name === 'Busy');
        const assignmentsToBusy = result.assignments.filter(a => a.primaryMemberId === busyMember?.id);
        expect(assignmentsToBusy.length).toBe(0);
      }

      // Special case: Scenario 3 (Skill Eligibility R3)
      if (scenario.description.includes('R3')) {
        const noviceMember = scenario.members.find(m => m.name === 'Novice');
        const assignmentsToNovice = result.assignments.filter(a => a.primaryMemberId === noviceMember?.id);
        expect(assignmentsToNovice.length).toBe(0);
      }
    });
  });
});
