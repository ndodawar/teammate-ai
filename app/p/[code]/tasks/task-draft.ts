/**
 * Local shape of a task row as the tasks page reads and writes it.
 *
 * This mirrors the subset of the API payload the register renders, so it stays
 * alongside the page rather than in `lib/scoring/types` (which owns the scoring
 * engine's `Task`). Moved verbatim out of `tasks-client.tsx` in T-5.08; no field,
 * type, or default changed.
 */
export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  effort: number;
  estimated_hours: number;
  required_skills: string[];
  due_date: string | null;
  locked: boolean;
  source: 'template' | 'manual';
}

/** One row of the template proposals list, before the user confirms a save. */
export interface TemplateDraftItem {
  template_id: string;
  title: string;
  description: string;
  effort: number;
  required_skills: string[];
  due_date: string | null;
  locked: boolean;
  source: 'template';
  estimated_hours_input?: string;
}

/** Controlled form state for the manual task form and the inline editor. */
export interface TaskDraft {
  title: string;
  description: string;
  effort: string;
  estimated_hours: string;
  due_date: string;
  required_skills: string[];
  locked: boolean;
  source: 'template' | 'manual';
}

/** The form's starting value. Shared so "reset" and "first mount" cannot drift. */
export const EMPTY_DRAFT: TaskDraft = {
  title: '',
  description: '',
  effort: '3',
  estimated_hours: '',
  due_date: '',
  required_skills: [],
  locked: false,
  source: 'manual',
};

/**
 * Hours must be a positive whole number. Blank is invalid on purpose: the form
 * disables submit until the field carries an integer, matching the Zod schema
 * (`estimated_hours` is `.int().positive()`) so client and server agree.
 */
export function isValidHours(val: string): boolean {
  const v = val.trim();
  if (v === '') return false;
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}

/** Converts a stored task row into editable form state. */
export function draftFromTask(task: TaskItem): TaskDraft {
  return {
    title: task.title,
    description: task.description ?? '',
    effort: String(task.effort ?? 3),
    estimated_hours: String(task.estimated_hours ?? ''),
    due_date: task.due_date ?? '',
    required_skills: task.required_skills ?? [],
    locked: Boolean(task.locked),
    source: task.source ?? 'manual',
  };
}

/**
 * The real message from a thrown value when it is an Error, otherwise the
 * caller's fallback. Keeps the fetch handlers honest without leaking a non-Error
 * value into the UI.
 */
export function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
