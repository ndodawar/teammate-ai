import { Member, Task, CandidateScore, TaskAssignment, AssignmentResult } from './types';
import { computeScore } from './score';
import { checkR3 } from './rules';

export function generateExplanation(task: Task, member: Member, breakdown: ScoreBreakdown): string {
  const matchedSkills = task.required_skills.filter(s => (member.skills[s] ?? 0) >= 3);
  const skillText = matchedSkills.length > 0 
    ? `memiliki keterampilan relevan (${matchedSkills.join(', ')})` 
    : `memenuhi persyaratan dasar`;

  return `${member.name} ${skillText} dengan skor kesesuaian ${Math.round(breakdown.total * 100)}% dan sisa kapasitas yang memadai.`;
}

export function globalAssign(
  tasks: Task[],
  members: Member[],
  existingAssignments: TaskAssignment[] = [],
  weights = { K: 0.40, S: 0.30, C: 0.20, M: 0.10 },
  isFallback = false
): AssignmentResult {
  const totalEffort = tasks.reduce((sum, t) => sum + t.estimated_hours, 0);
  const idealLoad = members.length > 0 ? totalEffort / members.length : 0;

  const memberLoads: Record<string, number> = {};
  members.forEach(m => { memberLoads[m.id] = 0; });

  // Map existing locked or current assignments
  const lockedMap = new Map<string, string>(); // taskId -> memberId
  existingAssignments.forEach(a => {
    if (a.isLocked) {
      lockedMap.set(a.taskId, a.primaryMemberId);
      memberLoads[a.primaryMemberId] = (memberLoads[a.primaryMemberId] || 0) + (tasks.find(t => t.id === a.taskId)?.estimated_hours || 0);
    }
  });

  // Sort tasks by effort descending (largest first)
  const sortedTasks = [...tasks].sort((a, b) => b.estimated_hours - a.estimated_hours);
  const assignments: TaskAssignment[] = [];

  for (const task of sortedTasks) {
    const isLocked = lockedMap.has(task.id);
    let primaryMemberId = lockedMap.get(task.id) || '';
    const scores: Record<string, CandidateScore> = {};

    // Filter candidates via R3
    const eligiblePool = checkR3(task, members);

    for (const member of members) {
      const currentLoad = memberLoads[member.id] || 0;
      const breakdown = computeScore(task, member, currentLoad, idealLoad, 0.5, weights, isFallback);
      const isEligible = breakdown.total > 0 && eligiblePool.some(em => em.id === member.id);

      scores[member.id] = {
        memberId: member.id,
        breakdown,
        isEligible,
        reason: generateExplanation(task, member, breakdown)
      };
    }

    if (!isLocked) {
      // Find best eligible candidate
      const sortedCandidates = Object.values(scores)
        .filter(c => c.isEligible)
        .sort((a, b) => b.breakdown.total - a.breakdown.total);

      if (sortedCandidates.length > 0) {
        primaryMemberId = sortedCandidates[0].memberId;
        memberLoads[primaryMemberId] = (memberLoads[primaryMemberId] || 0) + task.estimated_hours;
      } else {
        // Fallback to highest score regardless of R2 if no candidate found
        const absoluteBest = Object.values(scores)
          .sort((a, b) => b.breakdown.total - a.breakdown.total);
        primaryMemberId = absoluteBest.length > 0 ? absoluteBest[0].memberId : members[0]?.id || '';
        if (primaryMemberId) {
          memberLoads[primaryMemberId] = (memberLoads[primaryMemberId] || 0) + task.estimated_hours;
        }
      }
    }

    // Determine alternative
    const sortedAll = Object.values(scores).sort((a, b) => b.breakdown.total - a.breakdown.total);
    const alternative = sortedAll.find(c => c.memberId !== primaryMemberId && c.isEligible);

    assignments.push({
      taskId: task.id,
      primaryMemberId,
      alternativeMemberId: alternative?.memberId,
      isLocked,
      scores
    });
  }

  return {
    assignments,
    memberLoads,
    idealLoad
  };
}
