import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { groqChat, readGroqText, readGroqUsage } from '@/lib/ai/groq';
import { analyzeTasks } from '@/lib/ai/analyze-task';

/**
 * T-6.02 — LIVE Groq verification.
 *
 * These run against the real Groq API and only when GROQ_API_KEY and
 * GROQ_MODEL_TEXT are both present. They are SKIPPED, not faked, when the key is
 * absent: the one thing a unit test cannot prove is that a real account accepts
 * the key and the model id, and guessing that would repeat the exact failure T-2.02
 * warned about.
 *
 * Run it explicitly:
 *   RUN_LIVE_API_TESTS=1 npx vitest run test/ai/groq.live.test.ts
 *
 * T-FINAL-QA-01: the key being present is no longer enough.
 *
 * `loadEnvLocal()` reads `.env.local`, so on a machine with a working key a plain
 * `npm test` ran this file and spent real Groq quota on every full run, without
 * anyone asking for it. During the validation pass that happened three times.
 * The suite now requires an explicit `RUN_LIVE_API_TESTS=1`, so a normal test run
 * is quota-free and a live check is always a deliberate act. It also keeps the
 * default suite deterministic: a provider hiccup can no longer turn `npm test`
 * red for a reason unrelated to the code under test.
 *
 * Cost note: this file sends 3 small requests in total, well inside any free tier.
 */
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    if (!key || key.startsWith('#')) continue;
    process.env[key] ??= line.slice(i + 1).trim();
  }
}
loadEnvLocal();

const apiKey = process.env.GROQ_API_KEY || '';
const model = process.env.GROQ_MODEL_TEXT || '';
const baseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
/** Opt-in switch: without it the live file is skipped even when keys exist. */
const liveOptIn = process.env.RUN_LIVE_API_TESTS === '1';
const configured = liveOptIn && apiKey.length > 0 && model.length > 0;

describe.skipIf(!configured)('LIVE: Groq model availability', () => {
  it('confirms the configured model exists on this account before using it', async () => {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data?: { id: string }[] };
    const ids = (body.data ?? []).map((m) => m.id);

    // This is the guess-killer: a retired or misspelled id fails HERE with a
    // readable list, instead of surfacing as an opaque 404 during a demo.
    console.log(`[groq.live] configured model: ${model}`);
    console.log(`[groq.live] models visible to this key: ${ids.length}`);
    expect(ids).toContain(model);
  }, 30_000);

  it('performs a real JSON-mode chat completion and reports latency + tokens', async () => {
    const started = Date.now();
    const response = await groqChat(
      {
        model,
        messages: [
          {
            role: 'user',
            content: 'Kembalikan JSON murni: {"status":"ok"}. Jangan tambahkan teks lain.',
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 32,
      },
      { timeoutMs: 30_000 }
    );
    const latencyMs = Date.now() - started;

    const text = readGroqText(response);
    const parsed = JSON.parse(text) as { status?: string };
    const usage = readGroqUsage(response);

    console.log(`[groq.live] latency: ${latencyMs} ms`);
    console.log(`[groq.live] usage: ${JSON.stringify(usage)}`);
    console.log(`[groq.live] reply: ${text.slice(0, 120)}`);

    expect(parsed.status).toBe('ok');
    expect(typeof usage?.promptTokenCount).toBe('number');
  }, 40_000);

  it('analyses the reference task end-to-end on the real provider', async () => {
    const started = Date.now();
    const out = await analyzeTasks([
      {
        id: 't-db-01',
        title: 'Merancang database sistem informasi akademik',
        description: 'Rancang skema tabel, relasi, dan normalisasi untuk SIA kampus.',
      },
    ]);
    const latencyMs = Date.now() - started;

    console.log(`[groq.live] analyze latency: ${latencyMs} ms`);
    console.log(`[groq.live] analysis: ${JSON.stringify(out[0])}`);

    expect(out).toHaveLength(1);
    expect(out[0].taskId).toBe('t-db-01');
    expect(out[0].requiredSkills.length).toBeGreaterThanOrEqual(1);
    expect(out[0].requiredSkills.length).toBeLessThanOrEqual(4);
    expect(Number.isInteger(out[0].effort)).toBe(true);
    expect(out[0].effort).toBeGreaterThanOrEqual(1);
    expect(out[0].effort).toBeLessThanOrEqual(5);
    expect(out[0].note.length).toBeLessThanOrEqual(160);
  }, 40_000);
});
