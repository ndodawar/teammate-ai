/**
 * Call-budget guard for a single recommendation process (PRD 6.1 / NFR-06).
 *
 * The PRD caps one recommendation process at 3 Gemini calls:
 *   1. task analysis   (all tasks, one request)
 *   2. embedding       (all task + member texts, one batch)
 *   3. explanations    (primary + alternative, one request)
 *
 * A counter that is only checked in tests proves nothing, so the guard is a real
 * object that wraps every provider call and throws before the 4th one reaches the
 * network. Each process creates one run; the run owns the counter.
 */

export const MAX_GEMINI_CALLS_PER_PROCESS = 3;

/** Which PRD budget slot a call belongs to. */
export type GeminiCallKind = 'analysis' | 'embedding' | 'explanation';

export interface GeminiCallRecord {
  kind: GeminiCallKind;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
}

export class CallBudgetExceededError extends Error {
  constructor(readonly attempted: number, readonly limit: number) {
    super(
      `Gemini call budget exceeded: attempt ${attempted} of ${limit} allowed per recommendation process`
    );
    this.name = 'CallBudgetExceededError';
  }
}

export interface AiRunSummary {
  projectId: string | null;
  callCount: number;
  promptTokens: number | null;
  completionTokens: number | null;
  model: string;
  status: 'success' | 'fallback' | 'error';
  durationMs: number;
  errorMessage: string | null;
  calls: GeminiCallRecord[];
}

/**
 * One per recommendation process. Tracks the real number of provider calls and
 * refuses to start a call that would exceed the budget.
 */
export class AiRun {
  private readonly calls: GeminiCallRecord[] = [];
  private readonly startedAt = Date.now();
  private errorMessage: string | null = null;
  private finished = false;

  constructor(
    readonly projectId: string | null,
    private readonly limit = MAX_GEMINI_CALLS_PER_PROCESS
  ) {}

  get callCount(): number {
    return this.calls.length;
  }

  get remaining(): number {
    return Math.max(0, this.limit - this.calls.length);
  }

  get records(): readonly GeminiCallRecord[] {
    return this.calls;
  }

  /**
   * Reserves one slot, then runs `fn`. The slot is consumed even if `fn` throws:
   * a failed request still left the machine, so retrying it must also count.
   */
  async track<T>(
    kind: GeminiCallKind,
    model: string,
    usage: PromptUsage | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    if (this.calls.length >= this.limit) {
      throw new CallBudgetExceededError(this.calls.length + 1, this.limit);
    }

    const record: GeminiCallRecord = {
      kind,
      model,
      promptTokens: null,
      completionTokens: null,
      durationMs: 0,
    };
    this.calls.push(record);
    const startedAt = Date.now();

    try {
      const result = await fn();
      const meta = usage?.(result);
      record.promptTokens = tokenOrNull(meta?.promptTokenCount);
      record.completionTokens = tokenOrNull(meta?.candidatesTokenCount);
      return result;
    } catch (error: unknown) {
      record.promptTokens = tokenOrNull(usage?.(error)?.promptTokenCount);
      record.completionTokens = tokenOrNull(usage?.(error)?.candidatesTokenCount);
      throw error;
    } finally {
      record.durationMs = Date.now() - startedAt;
    }
  }

  /** Records a failure that must surface in the AiRun row, without adding a call. */
  noteError(error: unknown): void {
    this.errorMessage = sanitizeErrorMessage(error);
  }

  /** Freezes the run so a later call cannot mutate a row that was already written. */
  finish(status: 'success' | 'fallback' | 'error'): AiRunSummary | null {
    if (this.finished) return null;
    this.finished = true;

    return {
      projectId: this.projectId,
      callCount: this.calls.length,
      promptTokens: sumTokens(this.calls.map((c) => c.promptTokens)),
      completionTokens: sumTokens(this.calls.map((c) => c.completionTokens)),
      model: this.calls[0]?.model ?? '',
      status,
      durationMs: Date.now() - this.startedAt,
      errorMessage: this.errorMessage,
      calls: [...this.calls],
    };
  }
}

export interface TokenUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

/** Reads token usage off a provider result; undefined when the SDK omits it. */
export type PromptUsage = (value: unknown) => TokenUsage | undefined;

function tokenOrNull(value: number | undefined): number | null {
  // Never invent a token count: only a real non-negative integer is recorded.
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Sums the calls that actually reported tokens; all-null stays all-null. */
function sumTokens(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

const KEY_PATTERN = /AIza[0-9A-Za-z_-]{10,}|key=[^&\s"']+|api[_-]?key["'\s:=]+[^\s"',}]+/gi;

/** Strips anything that looks like a credential before it can reach a log or a row. */
export function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(KEY_PATTERN, '[REDACTED]').slice(0, 500);
}
