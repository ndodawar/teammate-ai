import { Member, Task, CandidateScore, TaskAssignment, AssignmentResult, ScoreBreakdown, AssignmentWarning } from './types';
import { computeScore } from './score';
import { checkR1, checkR2, checkR3, hasQualifiedMember } from './rules';
import { DEFAULT_WEIGHTS, FALLBACK_WEIGHTS, WORKLOAD_CAP_MULTIPLIER } from './constants';

export type TaskMemberCosineMap = Record<string, Record<string, number>>;

export function generateExplanation(task: Task, member: Member, breakdown: ScoreBreakdown): string {
  const matchedSkills = task.required_skills.filter(s => (member.skills[s] ?? 0) >= 3);
  const skillText = matchedSkills.length > 0
    ? `memiliki keterampilan relevan (${matchedSkills.join(', ')})`
    : `memenuhi persyaratan dasar`;

  return `${member.name} ${skillText} dengan skor kesesuaian ${Math.round(breakdown.total * 100)}% dan sisa kapasitas yang memadai.`;
}

export interface AssignmentOptions {
  weights?: { K: number; S: number; C: number; M: number };
  isFallback?: boolean;
  cosineMap?: TaskMemberCosineMap;
}

export function globalAssign(
  tasks: Task[],
  members: Member[],
  existingAssignments: TaskAssignment[] = [],
  options: AssignmentOptions = {}
): AssignmentResult {
  const isFallback = options.isFallback ?? false;
  // FR-13 defines the fallback *defaults*; FR-10 lets the user adjust weights.
  // Caller weights are honoured in both modes, and fallback mode keeps K at 0
  // (see computeScore), so a fallback score still spans a 1.00 scale.
  const weights = options.weights ?? (isFallback ? FALLBACK_WEIGHTS : DEFAULT_WEIGHTS);
  const cosineMap = options.cosineMap ?? {};
  const totalEffort = tasks.reduce((sum, t) => sum + t.estimated_hours, 0);
  const idealLoad = members.length > 0 ? totalEffort / members.length : 0;

  const memberLoads: Record<string, number> = {};
  members.forEach(m => { memberLoads[m.id] = 0; });

  const warnings: AssignmentWarning[] = [];

  // Map existing locked or current assignments
  const lockedMap = new Map<string, string>(); // taskId -> memberId
  existingAssignments.forEach(a => {
    if (a.isLocked) {
      lockedMap.set(a.taskId, a.primaryMemberId);
      memberLoads[a.primaryMemberId] = (memberLoads[a.primaryMemberId] || 0) + (tasks.find(t => t.id === a.taskId)?.estimated_hours || 0);
    }
  });

  /*
   * T-6.09 / R2 + R5: a locked task keeps its owner even if that already breaks
   * the cap. R5 says a locked task must not change on recompute, so the
   * assignment stands — but the user is told instead of being shown a silent
   * overload. This check runs once, before any new task can worsen the load.
   */
  for (const [taskId, memberId] of lockedMap) {
    const task = tasks.find(t => t.id === taskId);
    const member = members.find(m => m.id === memberId);
    if (!task || !member) continue;
    if (!checkR2(member, { ...task, estimated_hours: 0 }, memberLoads[memberId] || 0, idealLoad)) {
      warnings.push({
        code: 'r2_locked_overload',
        taskId,
        memberId,
        message:
          `Tugas terkunci "${task.title}" membuat beban ${member.name} menjadi ` +
          `${(memberLoads[memberId] || 0).toFixed(2)} jam, melebihi batas R2 ` +
          `${(idealLoad * WORKLOAD_CAP_MULTIPLIER).toFixed(2)} jam (1,25 × beban ideal ` +
          `${idealLoad.toFixed(2)} jam). Tugas dipertahankan karena terkunci (R5).`,
      });
    }
  }

  // Sort tasks by effort descending (largest first)
  const sortedTasks = [...tasks].sort((a, b) => b.estimated_hours - a.estimated_hours);
  const assignments: TaskAssignment[] = [];

  for (const task of sortedTasks) {
    const isLocked = lockedMap.has(task.id);
    let primaryMemberId = lockedMap.get(task.id) || '';
    const scores: Record<string, CandidateScore> = {};

    /*
     * R3 pool, per PRD 8.2: "jika ada anggota dengan minimal satu skill wajib
     * berlevel 3 atau lebih, hanya anggota tersebut yang menjadi kandidat" —
     * .some(), the literal PRD rule, user-confirmed for T-6.09.
     *
     * When NOBODY qualifies, checkR3 still returns the whole roster so a
     * best-effort recommendation can be produced with a warning. That fallback
     * pool is not a qualification, so `r3Satisfied` records which case we are
     * in and eligibility is withheld in the fallback case: the row must not
     * present an unqualified member as a normal candidate.
     */
    const eligiblePool = checkR3(task, members);
    const r3Satisfied = hasQualifiedMember(task, members);

    if (!r3Satisfied && !isLocked) {
      warnings.push({
        code: 'r3_no_candidate',
        taskId: task.id,
        message:
          `Tidak ada anggota dengan skill wajib (${task.required_skills.join(', ')}) ` +
          `pada level minimal 3. Rekomendasi terbaik tetap ditampilkan, tetapi ` +
          `tidak ada kandidat yang memenuhi R3.`,
      });
    }

    for (const member of members) {
      const currentLoad = memberLoads[member.id] || 0;
      const rawCosine = cosineMap[task.id]?.[member.id];

      // A missing cosine only warrants a throw when the hybrid score depends on it.
      // In fallback mode K is dropped, so every pair is scored from S/C/M alone.
      if (rawCosine === undefined && !isFallback) {
        throw new Error(`Embedding missing for task ${task.id} member ${member.id}`);
      }

      // The score is always the real score (T-6.09: never falsified to 0).
      const breakdown = computeScore(
        task,
        member,
        currentLoad,
        idealLoad,
        rawCosine ?? 0,
        weights,
        isFallback
      );

      // Eligibility is decided by R1 + R2 + R3 only — never by the score value.
      const passesR1 = checkR1(member);
      const passesR2 = checkR2(member, task, currentLoad, idealLoad);
      const inR3Pool = eligiblePool.some(em => em.id === member.id);
      // If R3 has no qualified member at all, nobody is presented as a valid
      // candidate; the task still gets a best-effort owner plus a warning.
      const isEligible = passesR1 && passesR2 && inR3Pool && r3Satisfied;

      const memberWarnings: string[] = [];
      if (!passesR1) {
        memberWarnings.push('R1: jam tersedia 0 — anggota dikeluarkan dari kandidat.');
      }
      if (passesR1 && !passesR2) {
        const nextLoad = currentLoad + task.estimated_hours;
        memberWarnings.push(
          `R2: beban ${nextLoad.toFixed(2)} jam melebihi batas ` +
          `${(idealLoad * WORKLOAD_CAP_MULTIPLIER).toFixed(2)} jam (1,25 × beban ideal).`
        );
      }
      // A member is only withheld for R3 when the rule is actually satisfied by
      // someone else; in the no-candidate fallback the task-level warning says it
      // once instead of repeating it on every cell.
      if (!inR3Pool || !r3Satisfied) {
        memberWarnings.push(
          `R3: tidak ada skill wajib pada level minimal 3 (${task.required_skills.join(', ')}).`
        );
      }

      scores[member.id] = {
        memberId: member.id,
        breakdown,
        isEligible,
        warnings: memberWarnings.length > 0 ? memberWarnings : undefined,
        reason: generateExplanation(task, member, breakdown)
      };
    }

    if (!isLocked) {
      // Highest-scoring member who satisfies R1, R2 and R3.
      const sortedCandidates = Object.values(scores)
        .filter(c => c.isEligible)
        .sort((a, b) => b.breakdown.total - a.breakdown.total);
      // Members who at least clear R1: used only to explain an empty row.
      const r1Pool = Object.values(scores).filter(c => checkR1(members.find(m => m.id === c.memberId)!));

      if (sortedCandidates.length > 0) {
        primaryMemberId = sortedCandidates[0].memberId;
        memberLoads[primaryMemberId] = (memberLoads[primaryMemberId] || 0) + task.estimated_hours;
      } else {
        /*
         * T-6.09. Two very different situations end up here, and the PRD treats
         * them differently:
         *
         *  (a) R3 has no qualified member. PRD 8.2 R3: "sistem tetap memberikan
         *      rekomendasi terbaik dengan peringatan bahwa tidak ada kandidat
         *      yang cocok". So we DO recommend the best member who clears R1 and
         *      R2 — but that member stays marked ineligible and the
         *      `r3_no_candidate` warning (emitted above) says why.
         *
         *  (b) R2 has no candidate: everyone who could do the task would exceed
         *      1.25 x ideal load. Decision A: the task is left UNASSIGNED. The
         *      old code picked `absoluteBest` here — the member with the best
         *      component sum among those that had just FAILED R2 — which is
         *      exactly how a 5-hour load against a 3.125-hour cap appeared as a
         *      normal primary owner. R4 still holds: zero owners is not more
         *      than one.
         */
        const r1Pool = Object.values(scores).filter(c => checkR1(members.find(m => m.id === c.memberId)!));
        const r2Pool = r1Pool
          .filter(c => checkR2(members.find(m => m.id === c.memberId)!, task, memberLoads[c.memberId] || 0, idealLoad))
          .sort((a, b) => b.breakdown.total - a.breakdown.total);

        if (!r3Satisfied && r2Pool.length > 0) {
          // (a) best-effort recommendation with a warning; never silent.
          primaryMemberId = r2Pool[0].memberId;
          memberLoads[primaryMemberId] = (memberLoads[primaryMemberId] || 0) + task.estimated_hours;
        } else {
          // (b) unassigned, with a warning that explains which cap blocked it.
          primaryMemberId = '';

          const everyR1Blocked = members.every(m => !checkR1(m));
          if (!everyR1Blocked) {
            warnings.push({
              code: r1Pool.length > 0 ? 'r2_no_candidate' : 'r3_no_candidate',
              taskId: task.id,
              message:
                r1Pool.length > 0
                  ? `Tugas "${task.title}" belum memiliki penanggung jawab: tidak ada ` +
                    `kandidat yang memenuhi batas beban R2 ` +
                    `${(idealLoad * WORKLOAD_CAP_MULTIPLIER).toFixed(2)} jam ` +
                    `(1,25 × beban ideal ${idealLoad.toFixed(2)} jam).`
                  : `Tugas "${task.title}" belum memiliki penanggung jawab: tidak ada ` +
                    `anggota dengan skill wajib (${task.required_skills.join(', ')}) ` +
                    `pada level minimal 3 (R3), dan tidak ada kandidat lain yang memenuhi syarat.`,
            });
          }
        }
      }
    }

    // Alternative: best eligible member other than the primary (R2/R3 enforced).
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
    idealLoad,
    warnings
  };
}
