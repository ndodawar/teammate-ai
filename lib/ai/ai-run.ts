import { getSupabaseClient } from '@/lib/db/project';
import { AiRunSummary, MAX_GEMINI_CALLS_PER_PROCESS } from './call-budget';

/**
 * Persists one AiRun row per recommendation process (NFR-43/44/45).
 *
 * The live `ai_runs` table only has: id, project_id, prompt_tokens,
 * completion_tokens, model, status, created_at. It has NO duration, mode, or
 * call-count column, and the task forbids destructive migrations. So:
 *
 *   - token columns  -> real SDK counts, or null when the provider did not report them
 *   - status         -> 'success' | 'fallback' | 'error' (these are the mode + outcome)
 *   - project_id     -> links the row to the process
 *
 * Call count and duration have no column and cannot be invented into one, so they
 * are NOT persisted. They are measured in memory, returned to the caller, asserted
 * by tests, and the gap is documented in docs/PHASE_2_ACCEPTANCE.md.
 *
 * Writing is best-effort: NFR-07 says an AI/observability failure must never stop
 * the recommendation, so every error here is swallowed after being logged.
 */

/** AiRun has no columns for these; kept for tests and the acceptance report. */
export interface AiRunObservabilityGap {
  callCount: number;
  durationMs: number;
  errorMessage: string | null;
  calls: AiRunSummary['calls'];
}

export interface RecordAiRunResult {
  written: boolean;
  row: {
    project_id: string | null;
    prompt_tokens: number | null;
    completion_tokens: number | null;
    model: string;
    status: string;
  };
  gap: AiRunObservabilityGap;
}

export async function recordAiRun(summary: AiRunSummary): Promise<RecordAiRunResult> {
  if (summary.callCount > MAX_GEMINI_CALLS_PER_PROCESS) {
    // Defence in depth: the guard should have stopped this before it got here.
    throw new Error(
      `AiRun recorded ${summary.callCount} calls, above the PRD budget of ${MAX_GEMINI_CALLS_PER_PROCESS}`
    );
  }

  const row = {
    project_id: summary.projectId,
    prompt_tokens: summary.promptTokens,
    completion_tokens: summary.completionTokens,
    // `model` is NOT NULL in the schema; a run with zero calls has no model.
    model: summary.model || 'none',
    status: summary.status,
  };

  const gap: AiRunObservabilityGap = {
    callCount: summary.callCount,
    durationMs: summary.durationMs,
    errorMessage: summary.errorMessage,
    calls: summary.calls,
  };

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('ai_runs').insert(row);
    if (error) {
      console.error('AiRun insert failed:', sanitizeForLog(error.message));
      return { written: false, row, gap };
    }
    return { written: true, row, gap };
  } catch (error: unknown) {
    // Logging is observability, not a product feature: never fail the request.
    const message = error instanceof Error ? error.message : String(error);
    console.error('AiRun write threw:', sanitizeForLog(message));
    return { written: false, row, gap };
  }
}

function sanitizeForLog(value: string): string {
  return value.replace(/AIza[0-9A-Za-z_-]{10,}|key=[^&\s"']+/gi, '[REDACTED]');
}
