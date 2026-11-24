import { z } from 'zod';

/**
 * Server-side environment schema (T-6.01).
 *
 * Why Zod and why here:
 *  - The project already validates every external boundary with Zod
 *    (`lib/validation/index.ts`, `lib/ai/schemas.ts`), so the environment is
 *    validated the same way instead of growing a second dialect of checks.
 *  - Every variable below is read from `process.env` on the SERVER. None of them
 *    may ever carry a `NEXT_PUBLIC_` prefix: that prefix inlines the value into
 *    the browser bundle, which would publish the API keys to every visitor.
 *
 * Why lazy instead of at module load:
 *  - This file is imported by route handlers and lib modules that the test suite
 *    and the build both import. Throwing at import time would make `next build`
 *    and `npm test` fail on a machine with no secrets, which is not what a
 *    missing key should break. `getAiEnv()` is therefore called at request time
 *    (see `lib/ai/analyze-task.ts`), mirroring the existing
 *    `getSupabaseClient()` pattern in `lib/db/project.ts`.
 *
 * T-6.02 has now landed the migration this schema was written for: text
 * generation (FR-06 analysis, FR-09 explanations) runs on Groq, while embeddings
 * stay on Gemini. Nothing here touches the score formula, K/S/C/M weights, the
 * API surface, the database, or any fallback.
 */

/** The OpenAI-compatible Groq endpoint. Overridable for a proxy or a test double. */
export const GROQ_DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Text generation on Groq.
 *
 * Both fields stay optional at the PARSE level so `readServerEnv()` never throws
 * during `next build` or module import on a machine without secrets — a missing
 * key must fail the one request that needs it, not the whole process.
 * `requireGroqText()` is the strict accessor that *does* demand them, and it is
 * what both live call sites (`analyzeTasks`, `explainAssignments`) now use.
 */
const GroqTextEnvSchema = z.object({
  GROQ_API_KEY: z
    .string()
    .trim()
    .min(1, 'GROQ_API_KEY belum diisi. Tambahkan API key Groq di .env.local.')
    .startsWith(
      'gsk_',
      // Groq keys are prefixed `gsk_`. Checking the shape catches the common
      // mistake of pasting the model name or the base URL into this slot.
      'GROQ_API_KEY tidak valid: API key Groq biasanya diawali "gsk_".',
    )
    .optional(),
  GROQ_BASE_URL: z
    .string()
    .trim()
    .url('GROQ_BASE_URL harus berupa URL yang valid.')
    .default(GROQ_DEFAULT_BASE_URL),
  GROQ_MODEL_TEXT: z
    .string()
    .trim()
    .min(1, 'GROQ_MODEL_TEXT belum diisi. Contoh: llama-3.3-70b-versatile.')
    .optional(),
});

/**
 * Gemini stays, for embeddings only.
 *
 * FR-06/FR-09 move text generation; embeddings have no verified replacement yet,
 * so `GEMINI_API_KEY` and `GEMINI_MODEL_EMBED` are deliberately kept. This is the
 * one place that records that decision, so nobody deletes them during the
 * migration thinking they are leftovers.
 */
const GeminiEmbedEnvSchema = z.object({
  GEMINI_API_KEY: z.string().trim().min(1).optional(),
  GEMINI_MODEL_EMBED: z.string().trim().min(1).default('text-embedding-004'),
  /**
   * Retained for schema compatibility and for tests that still read it; no text
   * generation is performed on Gemini any more (T-6.02). Kept rather than deleted
   * so an existing `.env.local` keeps parsing unchanged.
   */
  GEMINI_MODEL_TEXT: z.string().trim().min(1).default('gemini-2.5-flash'),
});

const ServerEnvSchema = GroqTextEnvSchema.merge(GeminiEmbedEnvSchema).extend({
  SUPABASE_URL: z.string().trim().url('SUPABASE_URL harus berupa URL yang valid.').optional(),
  SUPABASE_SECRET_KEY: z.string().trim().min(1).optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;
export type GroqTextEnv = {
  GROQ_API_KEY: string;
  GROQ_BASE_URL: string;
  GROQ_MODEL_TEXT: string;
};

/**
 * Removes secret values from any message before it is thrown or logged.
 *
 * Two things go wrong without this. First, a Zod issue includes the *received*
 * value by default, so a malformed key would be echoed into a log line or an
 * error response. Second, Next.js redacts `process.env` in some paths but not in
 * a custom `throw new Error(\`...\${value}\`)`. Every message this module produces
 * is therefore built from the variable NAME only.
 */
function redact(message: string): string {
  // Only a real-looking key body is redacted. The earlier pattern matched the
  // BARE prefix too, so a message naming `GROQ_API_KEY` was rewritten to
  // `GROQ_[REDACTED]` and the operator lost the one fact they needed: which
  // variable is wrong. Requiring 8+ chars keeps the hint text `"gsk_"` intact
  // (it has no body) while still catching any genuine credential.
  return message.replace(/gsk_[A-Za-z0-9_-]{8,}/g, 'gsk_***');
}

/** A plain string map, so callers can pass `process.env` or a test fixture. */
export type EnvSource = Record<string, string | undefined>;

/** Parses the environment once per call. Never cached, so tests can mutate it. */
export function readServerEnv(source: EnvSource = process.env): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(source);

  if (!parsed.success) {
    // Only `path` and `message` are surfaced; `received`/`input` are dropped so a
    // secret can never reach a log.
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(redact(`Konfigurasi environment tidak valid — ${details}`));
  }

  return parsed.data;
}

/**
 * Non-throwing status report, for a health check or a startup log that must not
 * print secrets.
 */
export function describeAiEnv(source: EnvSource = process.env): {
  groqTextConfigured: boolean;
  geminiEmbedConfigured: boolean;
  problems: string[];
} {
  const parsed = ServerEnvSchema.safeParse(source);
  const problems = parsed.success
    ? []
    : parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`);
  const data = parsed.success ? parsed.data : undefined;

  return {
    groqTextConfigured: Boolean(data?.GROQ_API_KEY && data?.GROQ_MODEL_TEXT),
    geminiEmbedConfigured: Boolean(data?.GEMINI_API_KEY),
    problems: problems.map(redact),
  };
}

/**
 * Strict accessor for the Groq text-generation call.
 *
 * Called by `groqChat()` in `lib/ai/groq.ts`, which both live text paths reach
 * (`analyzeTasks` for FR-06 and `explainAssignments` for FR-09). It is the single
 * place that reports a missing Groq configuration. It never performs a network
 * request: it only proves the configuration is complete enough to try.
 */
export function requireGroqText(source: EnvSource = process.env): GroqTextEnv {
  const env = readServerEnv(source);

  const missing: string[] = [];
  if (!env.GROQ_API_KEY) missing.push('GROQ_API_KEY');
  if (!env.GROQ_MODEL_TEXT) missing.push('GROQ_MODEL_TEXT');

  if (missing.length > 0 || !env.GROQ_API_KEY || !env.GROQ_MODEL_TEXT) {
    throw new Error(
      redact(
        `Groq belum dikonfigurasi: ${missing.join(', ') || 'GROQ_API_KEY/GROQ_MODEL_TEXT'} kosong. ` +
          'Isi variabel tersebut di .env.local (lihat .env.example).',
      ),
    );
  }

  return {
    GROQ_API_KEY: env.GROQ_API_KEY,
    GROQ_BASE_URL: env.GROQ_BASE_URL,
    GROQ_MODEL_TEXT: env.GROQ_MODEL_TEXT,
  };
}
