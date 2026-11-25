export const SKILL_TAXONOMY = [
  'penulisan akademik',
  'riset literatur',
  'desain sistem',
  'pemrograman frontend',
  'pemrograman backend',
  'data dan machine learning',
  'desain antarmuka',
  'pengujian',
  'presentasi',
  'koordinasi'
] as const;

export type SkillTag = typeof SKILL_TAXONOMY[number];

export type SkillLevelMap = Partial<Record<SkillTag, number>>;
export type SkillInterestMap = Partial<Record<SkillTag, number>>;

export interface Member {
  id: string;
  name: string;
  skills: SkillLevelMap;
  interests?: SkillInterestMap;
  capacity: number; // Available hours / load limit
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  difficulty: number; // 1-5
  estimated_hours: number; // Effort
  required_skills: SkillTag[];
}

export interface ScoreBreakdown {
  K: number; // Content similarity (0-1)
  S: number; // Skill match (0-1)
  C: number; // Capacity (0-1)
  M: number; // Interest (0-1)
  total: number;
}

/**
 * Why the engine produced this recommendation for this task/member pair.
 * `code` states which rule decided it, so the UI never has to infer a reason
 * from a score it did not compute.
 */
export interface EngineReason {
  code: 'primary' | 'alternative' | 'r1' | 'r2';
  headline: string;
  detail: string;
}

export interface CandidateScore {
  memberId: string;
  breakdown: ScoreBreakdown;
  /**
   * Whether this member may be assigned this task. R1 (capacity) and R2
   * (workload cap) decide eligibility; R3 decides the candidate pool.
   *
   * This is deliberately INDEPENDENT of `breakdown.total`. Before T-6.09 the
   * engine reused `total > 0` as the eligibility signal, which forced a failing
   * candidate's real score to be overwritten with 0 — so the matrix showed 0%
   * next to a tooltip listing K/S/C/M worth ~55 points.
   */
  isEligible: boolean;
  /**
   * Machine-checkable reasons this candidate cannot be assigned, in PRD rule
   * order. Empty when eligible. The UI renders these so a user never has to
   * infer why a cell is greyed out.
   */
  warnings?: string[];
  reason: string;
}

export interface TaskAssignment {
  taskId: string;
  /** Empty string means no member satisfied R1/R2/R3: the task is unassigned. */
  primaryMemberId: string;
  alternativeMemberId?: string;
  isLocked: boolean;
  scores: Record<string, CandidateScore>; // memberId -> CandidateScore
}

export interface AssignmentResult {
  assignments: TaskAssignment[];
  memberLoads: Record<string, number>; // memberId -> total effort assigned
  idealLoad: number;
  /**
   * Task-level warnings surfaced to the user (T-6.09):
   *  - `r3_no_candidate`: nobody has a required skill at level >= 3, so the
   *    best-effort member is recommended WITH a warning (PRD 8.2 R3).
   *  - `r2_no_candidate`: everyone would exceed 1.25 x ideal load, so the task
   *    is left unassigned rather than silently overloaded (PRD 8.2 R2).
   *  - `r2_locked_overload`: a LOCKED task already pushes its owner over the
   *    cap. R5 wins, the assignment stands, and the user is told.
   */
  warnings: AssignmentWarning[];
}

/** A single user-facing warning, tied to the task and optionally the member. */
export interface AssignmentWarning {
  code: 'r3_no_candidate' | 'r2_no_candidate' | 'r2_locked_overload';
  taskId: string;
  memberId?: string;
  message: string;
  /**
   * `r2_no_candidate` only: the numbers behind the verdict, so the UI can state
   * the cause without recomputing the rule.
   *
   * `exceedsCapAlone` separates two situations that used to look identical:
   *  - true  -> this task's own effort is already above 1,25 x ideal load, so
   *             no member could ever take it, no matter how free they are.
   *  - false -> the task fits the cap, but every remaining candidate was
   *             already carrying too much work.
   */
  detail?: {
    taskHours: number;
    idealLoad: number;
    capHours: number;
    exceedsCapAlone: boolean;
  };
}
