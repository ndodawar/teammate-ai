import { z } from 'zod';
import { Member, Task, ScoreBreakdown } from '@/lib/scoring/types';

/**
 * FR-09 explanation validation.
 *
 * The model may only restate facts that exist in the project and in the computed
 * scores. It must never produce a "match percentage" of its own, name a member who
 * is not a candidate, or cite a skill the task does not require. Anything that
 * fails these checks is discarded and the deterministic template is used instead.
 */

export const ExplanationItemSchema = z.object({
  taskId: z.string(),
  memberId: z.string(),
  reason: z.string().min(1).max(280),
});

export const ExplanationResponseSchema = z.object({
  explanations: z.array(ExplanationItemSchema),
});

export type ExplanationItem = z.infer<typeof ExplanationItemSchema>;

/** Everything the model is allowed to talk about for one explanation target. */
export interface ExplanationTarget {
  task: Task;
  member: Member;
  breakdown: ScoreBreakdown;
  isAlternative: boolean;
}

export interface ExplanationContext {
  /** Every member id in the project, so an invented id is detectable. */
  memberNames: Record<string, string>;
  /** Member ids that are candidates for the task at hand. */
  candidatesByTask: Record<string, string[]>;
  targets: ExplanationTarget[];
}

const PERCENT_PATTERN = /\d+(?:[.,]\d+)?\s*%|persen|percent|\d+\s*\/\s*\d+/i;
const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g;

/**
 * Minimum facts an explanation must carry to be considered justified.
 * Everything else is checked structurally below.
 */
function hasUnknownNumber(text: string, allowed: number[]): boolean {
  const found = text.match(NUMBER_PATTERN) ?? [];
  return found.some((raw) => {
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value)) return true;
    return !allowed.some((a) => Math.abs(a - value) < 1e-9);
  });
}

function mentionsAny(text: string, values: (string | undefined)[]): boolean {
  const lower = text.toLowerCase();
  return values.some((v) => v !== undefined && v.length > 0 && lower.includes(v.toLowerCase()));
}

export interface ValidationFailure {
  taskId: string;
  memberId: string;
  reason: string;
}

/**
 * Validates one explanation against its target. Returns the failure reason, or
 * null when the text is acceptable.
 */
export function validateExplanation(
  item: ExplanationItem,
  target: ExplanationTarget,
  context: ExplanationContext
): string | null {
  const text = item.reason;

  if (item.taskId !== target.task.id || item.memberId !== target.member.id) {
    return 'explanation targets an unknown pairing';
  }

  // The model may only name members that are real candidates for this task.
  const knownNames = Object.values(context.memberNames);
  const textLower = text.toLowerCase();
  const wrongMember = knownNames.find(
    (name) =>
      name.toLowerCase() !== target.member.name.toLowerCase() &&
      textLower.includes(name.toLowerCase())
  );
  if (wrongMember) {
    return `names a member that is not the subject: ${wrongMember}`;
  }

  if (!context.memberNames[item.memberId]) {
    return 'unknown member id';
  }

  if (!context.candidatesByTask[target.task.id]?.includes(target.member.id)) {
    return 'member is not a candidate for this task';
  }

  // No invented match percentages. The real score is 0..1 and shown separately.
  if (PERCENT_PATTERN.test(text)) {
    return 'contains an invented percentage or ratio';
  }

  // Only numbers the computation actually produced are allowed: the four
  // components and the total, rounded as the UI rounds them, plus the raw hours.
  const allowed = [
    Math.round(target.breakdown.K * 100),
    Math.round(target.breakdown.S * 100),
    Math.round(target.breakdown.C * 100),
    Math.round(target.breakdown.M * 100),
    Math.round(target.breakdown.total * 100),
    target.task.estimated_hours,
    target.member.capacity,
  ];
  if (hasUnknownNumber(text, allowed)) {
    return 'contains a number that was not computed from project data';
  }

  // A skill claim must name a skill the task actually requires. A generic
  // sentence such as "memenuhi persyaratan dasar" claims no skill and is fine.
  const claimedSkills = extractClaimedSkills(text);
  for (const claimed of claimedSkills) {
    if (!target.task.required_skills.map((s) => s.toLowerCase()).includes(claimed)) {
      return `cites a skill the task does not require: ${claimed}`;
    }
  }

  if (target.isAlternative && !mentionsAny(text, [target.member.name])) {
    return 'alternative explanation does not name its member';
  }

  if (!mentionsAny(text, [target.member.name])) {
    return 'explanation does not name its member';
  }

  return null;
}

/** Reads the parenthesised skill list the template and prompt both use. */
function extractClaimedSkills(text: string): string[] {
  const match = /keterampilan relevan \(([^)]+)\)/i.exec(text);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export interface ExplanationValidationResult {
  /** Accepted text keyed by `${taskId}:${memberId}`. */
  accepted: Map<string, string>;
  failures: ValidationFailure[];
}

/** Validates the whole model response; partial acceptance is allowed. */
export function validateExplanations(
  response: unknown,
  context: ExplanationContext
): ExplanationValidationResult {
  const accepted = new Map<string, string>();
  const failures: ValidationFailure[] = [];

  const parsed = ExplanationResponseSchema.safeParse(response);
  if (!parsed.success) {
    return {
      accepted,
      failures: [
        {
          taskId: '*',
          memberId: '*',
          reason: `response does not match the explanation schema: ${parsed.error.message}`,
        },
      ],
    };
  }

  const targetKey = (t: ExplanationTarget) => `${t.task.id}:${t.member.id}`;
  const targets = new Map(context.targets.map((t) => [targetKey(t), t] as const));

  for (const item of parsed.data.explanations) {
    const target = targets.get(`${item.taskId}:${item.memberId}`);
    if (!target) {
      failures.push({
        taskId: item.taskId,
        memberId: item.memberId,
        reason: 'unexpected explanation target',
      });
      continue;
    }
    const failure = validateExplanation(item, target, context);
    if (failure) {
      failures.push({ taskId: item.taskId, memberId: item.memberId, reason: failure });
      continue;
    }
    accepted.set(`${item.taskId}:${item.memberId}`, item.reason);
  }

  return { accepted, failures };
}
