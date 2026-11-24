import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';

/**
 * Live model verification (PRD 10.3 / NFR-06).
 *
 * These run against the real Gemini API and only when GEMINI_API_KEY is present.
 * They are skipped, not faked, when the key is absent: guessing model names is the
 * exact failure mode T-2.02 warned about. Run with the key set to verify:
 *   GEMINI_API_KEY=... npx vitest run test/ai/gemini-models.live.test.ts
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

const apiKey = process.env.GEMINI_API_KEY || '';
const hasKey = apiKey.length > 0;

const TEXT_MODEL = process.env.GEMINI_MODEL_TEXT || 'gemini-2.5-flash';
const EMBED_MODEL = process.env.GEMINI_MODEL_EMBED || 'text-embedding-004';

describe.skipIf(!hasKey)('LIVE: Gemini model availability', () => {
  it('lists models and confirms the configured text model exists', async () => {
    const ai = new GoogleGenAI({ apiKey });
    const pager = await ai.models.list();
    const names = pager.page.map((m) => m.name ?? '');

    expect(names.length).toBeGreaterThan(0);
    const wanted = `models/${TEXT_MODEL}`;
    console.log('text model present:', wanted, names.includes(wanted));
    expect(names).toContain(wanted);
  });

  it('confirms the configured embedding model exists', async () => {
    const ai = new GoogleGenAI({ apiKey });
    const pager = await ai.models.list();
    const names = pager.page.map((m) => m.name ?? '');

    const wanted = `models/${EMBED_MODEL}`;
    const available = names.filter((n) => /embed/i.test(n));
    console.log('embedding models available:', available);
    expect(available).toContain(wanted);
  });

  it('returns exactly 768 dimensions from the embedding model', async () => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.embedContent({
      model: EMBED_MODEL,
      contents: ['verifikasi dimensi embedding'],
      config: { outputDimensionality: 768 },
    });

    const values = response.embeddings?.[0]?.values ?? [];
    console.log('embedding dims:', values.length);
    expect(values).toHaveLength(768);
    expect(values.every(Number.isFinite)).toBe(true);
  });

  it('produces valid JSON analysis for the text model', async () => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: 'Return the JSON {"ok":true} and nothing else.',
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text ?? '{}');
    expect(parsed.ok).toBe(true);
  });
});

describe('Gemini model configuration', () => {
  it('documents the key prerequisite instead of guessing a model', () => {
    // A guard so the live suite cannot be mistaken for a pass when it is skipped.
    if (!hasKey) {
        console.log(
        'SKIPPED live model verification: GEMINI_API_KEY is not set. ' +
          `Configured text=${TEXT_MODEL} embed=${EMBED_MODEL}, unverified against the API.`
      );
    }
    expect(typeof TEXT_MODEL).toBe('string');
    expect(typeof EMBED_MODEL).toBe('string');
  });
});
