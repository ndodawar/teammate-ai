import { Member, Task, ScoreBreakdown } from './types';
import { DEFAULT_INTEREST_LEVEL, MAX_SKILL_LEVEL, MAX_INTEREST_LEVEL, EMBEDDING_COSINE_MIN, EMBEDDING_COSINE_MAX, DEFAULT_WEIGHTS, FALLBACK_WEIGHTS } from './constants';

export function normalizeCosineSimilarity(rawCosine: number): number {
  if (rawCosine <= EMBEDDING_COSINE_MIN) return 0;
  if (rawCosine >= EMBEDDING_COSINE_MAX) return 1;
  return (rawCosine - EMBEDDING_COSINE_MIN) / (EMBEDDING_COSINE_MAX - EMBEDDING_COSINE_MIN);
}

export function computeSkillMatch(task: Task, member: Member): number {
  if (task.required_skills.length === 0) return 1.0;
  let totalLevel = 0;
  for (const skill of task.required_skills) {
    const level = member.skills[skill] ?? 0;
    totalLevel += level;
  }
  const average = totalLevel / task.required_skills.length;
  return average / MAX_SKILL_LEVEL;
}

export function computeCapacity(member: Member, currentLoad: number, taskEffort: number): number {
  if (member.capacity <= 0) return 0;
  const remaining = member.capacity - (currentLoad + taskEffort);
  if (remaining < 0) return 0;
  return remaining / member.capacity;
}

export function computeInterest(task: Task, member: Member): number {
  if (task.required_skills.length === 0) return 1.0;
  let totalInterest = 0;
  if (!member.interests) {
    return (DEFAULT_INTEREST_LEVEL - 1) / (MAX_INTEREST_LEVEL - 1);
  }
  for (const skill of task.required_skills) {
    const interest = member.interests[skill] ?? DEFAULT_INTEREST_LEVEL;
    totalInterest += interest;
  }
  const avgInterest = totalInterest / task.required_skills.length;
  return (avgInterest - 1) / (MAX_INTEREST_LEVEL - 1);
}

export interface ScoreTexts {
  K: number;
  S: number;
  C: number;
  M: number;
  total: number;
}

export function computeScore(
  task: Task,
  member: Member,
  currentLoad: number,
  idealLoad: number,
  rawCosine = 0.5,
  weights?: { K: number; S: number; C: number; M: number },
  isFallback = false
): ScoreBreakdown {
  // FR-13 sets the starting weights for fallback mode (S 0.50 / C 0.33 / M 0.17),
  // FR-10 then lets the user move them. The fallback default is therefore the
  // *fallback* for a caller that sends nothing; explicit weights are honoured so
  // the weight sliders actually change the result.
  const appliedWeights = weights ?? (isFallback ? FALLBACK_WEIGHTS : DEFAULT_WEIGHTS);
  const K = isFallback ? 0 : normalizeCosineSimilarity(rawCosine);
  const S = computeSkillMatch(task, member);
  const C = computeCapacity(member, currentLoad, task.estimated_hours);
  const M = computeInterest(task, member);

  const total =
    (appliedWeights.K * K) +
    (appliedWeights.S * S) +
    (appliedWeights.C * C) +
    (appliedWeights.M * M);

  /*
   * T-6.09: the score is the score. R1/R2 no longer overwrite it with 0.
   *
   * The previous version returned `total: 0` when a member failed R1/R2, which
   * conflated two different questions: "how well does this member fit?" and
   * "is this member allowed?". The matrix then displayed 0% while its own
   * tooltip showed K/S/C/M components worth ~55 points, which is precisely the
   * inconsistency the PRD review flagged.
   *
   * Eligibility is now computed by the caller (globalAssign) from
   * checkR1/checkR2/checkR3 and stored on CandidateScore.isEligible. The
   * component values are unchanged, the formula is unchanged, and the weights
   * are unchanged — only the falsification is gone.
   */
  return {
    K: Number(K.toFixed(4)),
    S: Number(S.toFixed(4)),
    C: Number(C.toFixed(4)),
    M: Number(M.toFixed(4)),
    total: Number(total.toFixed(4))
  };
}
