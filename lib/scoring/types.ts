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

export interface CandidateScore {
  memberId: string;
  breakdown: ScoreBreakdown;
  isEligible: boolean;
  warnings?: string[];
  reason: string;
}

export interface TaskAssignment {
  taskId: string;
  primaryMemberId: string;
  alternativeMemberId?: string;
  isLocked: boolean;
  scores: Record<string, CandidateScore>; // memberId -> CandidateScore
}

export interface AssignmentResult {
  assignments: TaskAssignment[];
  memberLoads: Record<string, number>; // memberId -> total effort assigned
  idealLoad: number;
}
