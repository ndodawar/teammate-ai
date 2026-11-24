import { describe, it, expect } from 'vitest';
import {
  readServerEnv,
  describeAiEnv,
  requireGroqText,
  GROQ_DEFAULT_BASE_URL,
} from '@/lib/env';

/**
 * T-6.01 — environment configuration only.
 *
 * These tests describe the *contract* of the Groq environment, not the AI
 * pipeline: the pipeline is still Gemini during this phase, so nothing here
 * asserts a provider call. Every case passes an explicit source map instead of
 * mutating `process.env`, so the suite is order-independent and never depends on
 * a developer's `.env.local`.
 */
describe('T-6.01 — Groq environment configuration', () => {
  it('defaults GROQ_BASE_URL to the Groq OpenAI-compatible endpoint', () => {
    const env = readServerEnv({});
    expect(env.GROQ_BASE_URL).toBe(GROQ_DEFAULT_BASE_URL);
    expect(env.GROQ_BASE_URL).toBe('https://api.groq.com/openai/v1');
  });

  it('accepts a complete Groq config and keeps every value it was given', () => {
    const env = readServerEnv({
      GROQ_API_KEY: 'gsk_test_key',
      GROQ_MODEL_TEXT: 'llama-3.3-70b-versatile',
    });
    expect(env.GROQ_API_KEY).toBe('gsk_test_key');
    expect(env.GROQ_MODEL_TEXT).toBe('llama-3.3-70b-versatile');
    expect(env.GROQ_BASE_URL).toBe(GROQ_DEFAULT_BASE_URL);
  });

  it('allows an empty Groq config, so the current Gemini pipeline still boots', () => {
    // This is the requirement that the config must not force an AI request when
    // the environment is incomplete: parsing an empty environment must SUCCEED.
    expect(() => readServerEnv({})).not.toThrow();
    const env = readServerEnv({});
    expect(env.GROQ_API_KEY).toBeUndefined();
    expect(env.GROQ_MODEL_TEXT).toBeUndefined();
  });

  it('rejects a GROQ_API_KEY that is not a Groq key, without echoing the value', () => {
    let message = '';
    try {
      readServerEnv({ GROQ_API_KEY: 'this-is-not-a-groq-key' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('GROQ_API_KEY');
    expect(message).toContain('gsk_');
    expect(message).not.toContain('this-is-not-a-groq-key');
  });

  it('rejects a malformed GROQ_BASE_URL, without echoing the value', () => {
    let message = '';
    try {
      readServerEnv({ GROQ_BASE_URL: 'not-a-url' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('GROQ_BASE_URL');
    expect(message).not.toContain('not-a-url');
  });

  it('treats a whitespace-only GROQ_MODEL_TEXT as empty', () => {
    expect(() => readServerEnv({ GROQ_MODEL_TEXT: '   ' })).toThrow(/GROQ_MODEL_TEXT/);
  });

  it('names BOTH missing variables when the strict accessor is used unconfigured', () => {
    let message = '';
    try {
      requireGroqText({});
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('GROQ_API_KEY');
    expect(message).toContain('GROQ_MODEL_TEXT');
    // The message must point the user at the file to edit.
    expect(message).toContain('.env.local');
  });

  it('returns the Groq config from the strict accessor when it is complete', () => {
    const env = requireGroqText({
      GROQ_API_KEY: 'gsk_test_key',
      GROQ_MODEL_TEXT: 'llama-3.3-70b-versatile',
      GROQ_BASE_URL: 'https://proxy.example.test/v1',
    });
    expect(env).toEqual({
      GROQ_API_KEY: 'gsk_test_key',
      GROQ_MODEL_TEXT: 'llama-3.3-70b-versatile',
      GROQ_BASE_URL: 'https://proxy.example.test/v1',
    });
  });

  it('keeps the Gemini embedding variables, which are deliberately retained', () => {
    const env = readServerEnv({});
    expect(env.GEMINI_MODEL_EMBED).toBe('text-embedding-004');
    const withKey = readServerEnv({ GEMINI_API_KEY: 'gemini-key', GEMINI_MODEL_EMBED: 'text-embedding-005' });
    expect(withKey.GEMINI_API_KEY).toBe('gemini-key');
    expect(withKey.GEMINI_MODEL_EMBED).toBe('text-embedding-005');
  });

  it('reports configuration status without ever exposing a secret', () => {
    const status = describeAiEnv({
      GROQ_API_KEY: 'gsk_super_secret_value',
      GROQ_MODEL_TEXT: 'llama-3.3-70b-versatile',
      GEMINI_API_KEY: 'gemini_super_secret_value',
    });
    expect(status.groqTextConfigured).toBe(true);
    expect(status.geminiEmbedConfigured).toBe(true);
    expect(status.problems).toEqual([]);

    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain('gsk_super_secret_value');
    expect(serialized).not.toContain('gemini_super_secret_value');
  });

  it('reports which provider is still unconfigured', () => {
    const status = describeAiEnv({});
    expect(status.groqTextConfigured).toBe(false);
    expect(status.geminiEmbedConfigured).toBe(false);
  });

  it('never prefixes a provider variable with NEXT_PUBLIC_', () => {
    // A NEXT_PUBLIC_ key is inlined into the browser bundle. The schema simply
    // does not know such a name, so it must be ignored rather than honoured.
    const env = readServerEnv({
      NEXT_PUBLIC_GROQ_API_KEY: 'gsk_leaked_into_browser',
    } as Record<string, string | undefined>);
    expect(env.GROQ_API_KEY).toBeUndefined();
  });

  it('keeps the VARIABLE NAME readable when reporting a missing key (T-6.02 regression)', () => {
    // The redaction pass used to match the bare `gsk_` prefix, so the message
    // naming GROQ_API_KEY was rewritten to "GROQ_[REDACTED]" and an operator lost
    // the only actionable fact in the log: which variable is wrong.
    let message = '';
    try {
      requireGroqText({});
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('GROQ_API_KEY');
    expect(message).not.toContain('GROQ_[REDACTED]');
  });

  it('still redacts a real-looking key body', () => {
    let message = '';
    try {
      readServerEnv({ GROQ_API_KEY: 'gsk_not_a_real_body_but_long', GROQ_MODEL_TEXT: '' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain('not_a_real_body_but_long');
  });
});

describe('T-6.01 — the AI module guard is non-throwing', () => {
  it('exposes env status without throwing, even on a malformed environment', async () => {
    // Importing the module is what matters: it must never throw at
    // module-evaluation time, whatever the ambient environment contains.
    const aiModule = await import('@/lib/ai/analyze-task');
    expect(aiModule.aiEnvStatus).toBeTypeOf('object');
    expect(aiModule.aiEnvStatus).not.toHaveProperty('GROQ_API_KEY');
    expect(JSON.stringify(aiModule.aiEnvStatus)).not.toMatch(/gsk_[A-Za-z0-9]/);
  });
});
