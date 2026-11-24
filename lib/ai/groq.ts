import { requireGroqText, type EnvSource } from '@/lib/env';
import { PromptUsage, TokenUsage } from './call-budget';

/**
 * T-6.02: Groq text generation over its OpenAI-compatible REST API.
 *
 * Why `fetch` and not a SDK:
 *  - Groq speaks the OpenAI chat-completions protocol, and Node 22 ships a stable
 *    global `fetch`. Adding `groq-sdk` (or `openai`) would put a second provider
 *    SDK in the tree for a single POST, and the task forbids new dependencies.
 *  - The endpoint is documented and stable: `POST {base}/chat/completions`.
 *
 * What this module is NOT allowed to do:
 *  - It is text generation only. Embeddings stay on Gemini
 *    (`gemini-embedding-001` via `embedTexts`), because Groq has no embedding
 *    model and the 768-wide `embedding_cache` column depends on Gemini's width.
 *  - It never retries. A retry would spend a second slot of the 3-call budget,
 *    so failure is surfaced to the caller, which falls back deterministically.
 *  - It never logs or echoes a secret: errors carry the HTTP status and the
 *    provider's own message after `requireGroqText` has resolved the key.
 */

export const GROQ_CHAT_PATH = '/chat/completions';

/** OpenAI-compatible chat request body, narrowed to the fields we actually set. */
export interface GroqChatRequest {
  model: string;
  messages: { role: 'system' | 'user'; content: string }[];
  /** `json_object` is Groq's JSON mode; it requires the word "JSON" in the prompt. */
  response_format: { type: 'json_object' };
  temperature: number;
  max_tokens: number;
}

export interface GroqChatResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

/** Raised for a non-2xx provider response, carrying the status for diagnostics. */
export class GroqApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'GroqApiError';
  }
}

/** Thrown when the provider does not answer within `timeoutMs`. */
export class GroqTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Groq request timed out after ${timeoutMs} ms`);
    this.name = 'GroqTimeoutError';
  }
}

/**
 * A single chat completion.
 *
 * The caller must pass `model` from `requireGroqText()` — never a literal — so a
 * retired model surfaces as a clear environment problem instead of a 404 guess.
 * The signal is combined with an internal timeout so a hung socket cannot pin a
 * recommendation request open indefinitely.
 */
export async function groqChat(
  request: GroqChatRequest,
  options: { env?: EnvSource; timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<GroqChatResponse> {
  const env = requireGroqText(options.env);
  // The base URL may or may not carry a trailing slash depending on the proxy.
  const url = `${env.GROQ_BASE_URL.replace(/\/+$/, '')}${GROQ_CHAT_PATH}`;
  const timeoutMs = options.timeoutMs ?? 20_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onOuterAbort);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Bearer token, never in a query string: query strings land in access logs.
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Read the body for the provider's reason, but keep it short: Groq echoes
      // the offending field on a 400 and we only need the human-readable part.
      const detail = await response.text().catch(() => '');
      throw new GroqApiError(
        response.status,
        `Groq returned ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`
      );
    }

    return (await response.json()) as GroqChatResponse;
  } catch (error: unknown) {
    if (error instanceof GroqApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GroqTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onOuterAbort);
  }
}

/** Extracts `choices[0].message.content`, or throws so the caller can fall back. */
export function readGroqText(response: GroqChatResponse): string {
  const text = response.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Groq response contained no text content');
  }
  return text;
}

/**
 * Maps an OpenAI-style `usage` block onto the shape `AiRun.track` understands.
 *
 * This is the Groq counterpart of reading Gemini's `usageMetadata`. Keeping the
 * mapping here — rather than teaching `call-budget.ts` about Groq — means the
 * budget guard stays provider-agnostic and untouched by this migration.
 */
export const readGroqUsage: PromptUsage = (value) => {
  const usage = (value as GroqChatResponse | null)?.usage;
  if (!usage) return undefined;
  const mapped: TokenUsage = {
    promptTokenCount: usage.prompt_tokens,
    candidatesTokenCount: usage.completion_tokens,
  };
  return mapped;
};
