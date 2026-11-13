import { Member, Task, ScoreBreakdown } from './types';
import { DEFAULT_INTEREST_LEVEL, MAX_SKILL_LEVEL, MAX_INTEREST_LEVEL, EMBEDDING_COSINE_MIN, EMBEDDING_COSINE_MAX } from './constants';
import { checkR1, checkR2 } from './rules';

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

export function computeScore(
  task: Task,
  member: Member,
  currentLoad: number,
  idealLoad: number,
  rawCosine = 0.5,
  weights = { K: 0.40, S: 0.30, C: 0.20, M: 0.10 },
  isFallback = false
): ScoreBreakdown {
  // Check R1 & R2
  if (!checkR1(member) || !checkR2(member, task, currentLoad, idealLoad)) {
    return { K: 0, S: 0, C: 0, M: 0, total: 0 };
  }

  const K = isFallback ? 0 : normalizeCosineSimilarity(rawCosine);
  const S = computeSkillMatch(task, member);
  const C = computeCapacity(member, currentLoad, task.estimated_hours);
  const M = computeInterest(task, member);

  const total = (weights.K * K) + (weights.S * S) + (weights.C * C) + (weights.M * M);

  return {
    K: Number(K.toFixed(4)),
    S: Number(S.toFixed(4)),
    C: Number(C.toFixed(4)),
    M: Number(M.toFixed(4)),
    total: Number(total.toFixed(4))
  };
}
