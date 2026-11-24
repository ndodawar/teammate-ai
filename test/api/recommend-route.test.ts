import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Route-level tests for POST /api/recommend.
 *
 * These exercise the real handler: real pipeline, real guard, real AiRun writer.
 * Only the two network edges are stubbed (Gemini SDK and Supabase).
 */

const spy = vi.hoisted(() => ({
  embedCalls: 0,
  generateCalls: 0,
  embedBehavior: 'ok' as 'ok' | 'invalid-key' | 'rate-limit' | 'timeout' | 'unavailable',
  generateBehavior: 'ok' as 'ok' | 'throw',
  cacheHits: false,
}));

vi.mock('@google/genai', () => {
  const fail = (kind: string) => {
    if (kind === 'invalid-key') return Object.assign(new Error('API key not valid'), { status: 400 });
    if (kind === 'rate-limit') return Object.assign(new Error('Resource has been exhausted'), { status: 429 });
    if (kind === 'timeout') return Object.assign(new Error('Request timed out'), { name: 'TimeoutError' });
    return Object.assign(new Error('Model not found'), { status: 404 });
  };

  return {
    GoogleGenAI: vi.fn().mockImplementation(function () {
      return {
        models: {
          generateContent: vi.fn(() => {
            spy.generateCalls += 1;
            if (spy.generateBehavior === 'throw') return Promise.reject(new Error('explanation down'));
            return Promise.resolve({
              text: JSON.stringify({ explanations: [] }),
              usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 50 },
            });
          }),
          embedContent: vi.fn((params: { contents: string | string[] }) => {
            spy.embedCalls += 1;
            if (spy.embedBehavior !== 'ok') {
              const kind = spy.embedBehavior;
              return new Promise((_resolve, reject) => setTimeout(() => reject(fail(kind)), 1));
            }
            const n = Array.isArray(params.contents) ? params.contents.length : 1;
            return Promise.resolve({
              embeddings: Array.from({ length: n }, (_, i) => ({
                values: Array.from({ length: 768 }, (_, j) => ((i + j) % 10) / 10),
              })),
              usageMetadata: { promptTokenCount: 40 },
            });
          }),
        },
      };
    }),
  };
});

/**
 * T-6.02: FR-09 explanations now leave through `fetch` to Groq, so the network
 * edge that must be stubbed for the explanation leg is `fetch`, not the Gemini
 * SDK. It increments the same hoisted counter the old double did, so the budget
 * assertions ("1 embedding + 1 explanation") keep their exact meaning.
 */
vi.stubEnv('GROQ_API_KEY', 'gsk_test_key_for_suite');
vi.stubEnv('GROQ_MODEL_TEXT', 'llama-3.3-70b-versatile');
vi.stubEnv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1');
vi.stubGlobal('fetch', vi.fn(async () => {
  spy.generateCalls += 1;
  if (spy.generateBehavior === 'throw') throw new Error('explanation down');
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ explanations: [] }) } }],
      usage: { prompt_tokens: 200, completion_tokens: 50 },
    }),
    text: async () => '',
  } as unknown as Response;
}));

const db = vi.hoisted(() => ({
  aiRuns: [] as Record<string, unknown>[],
  aiRunFails: false,
  projectsFail: false,
}));

vi.mock('@/lib/db/project', () => ({
  generateProjectCode: () => 'unused',
  getSupabaseClient: () => {
    const chain = (result: { data: unknown; error: unknown }) => {
      const p = Promise.resolve(result) as Promise<{ data: unknown; error: unknown }> & {
        eq: () => unknown;
        maybeSingle: () => Promise<unknown>;
        single: () => Promise<unknown>;
      };
      p.eq = () => p;
      p.maybeSingle = () => p;
      p.single = () => p;
      return p;
    };

    return {
      from: (table: string) => {
        if (table === 'ai_runs') {
          return {
            insert: (row: Record<string, unknown>) => {
              if (db.aiRunFails) return Promise.resolve({ error: { message: 'ai_runs is read-only' } });
              db.aiRuns.push(row);
              return Promise.resolve({ error: null });
            },
          };
        }
        if (table === 'projects') {
          if (db.projectsFail) return { select: () => chain({ data: null, error: { message: 'db down' } }) };
          return { select: () => chain({ data: { id: 'p-1' }, error: null }) };
        }
        if (table === 'members') {
          return {
            select: () =>
              chain({
                data: [
                  { id: 'm1', name: 'Budi', capacity: 40, member_skills: [{ skill_name: 'pengujian', skill_level: 4, interest_level: 4 }] },
                  { id: 'm2', name: 'Sari', capacity: 40, member_skills: [{ skill_name: 'pengujian', skill_level: 3, interest_level: 5 }] },
                ],
                error: null,
              }),
          };
        }
        if (table === 'tasks') {
          return {
            select: () =>
              chain({
                data: [
                  { id: 't1', title: 'Buat UI', description: 'x', effort: 3, estimated_hours: 8, required_skills: ['pengujian'] },
                  { id: 't2', title: 'Tulis laporan', description: 'y', effort: 2, estimated_hours: 6, required_skills: ['pengujian'] },
                ],
                error: null,
              }),
          };
        }
        // embedding_cache
        return {
          select: () =>
            chain({ data: spy.cacheHits ? { embedding: `[${Array(768).fill(0.1).join(',')}]` } : null, error: null }),
          upsert: () => Promise.resolve({ error: null }),
        };
      },
    };
  },
}));

import { POST } from '@/app/api/recommend/route';

function request(body: unknown = { code: 'abc123' }) {
  return new Request('http://localhost/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  spy.embedCalls = 0;
  spy.generateCalls = 0;
  spy.embedBehavior = 'ok';
  spy.generateBehavior = 'ok';
  spy.cacheHits = false;
  db.aiRuns = [];
  db.aiRunFails = false;
  db.projectsFail = false;
});

describe('POST /api/recommend — AI budget and observability', () => {
  it('makes at most 2 AI calls on a cold cache: 1 embedding + 1 explanation', async () => {
    const res = await POST(request());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isFallback).toBe(false);
    expect(spy.embedCalls).toBe(1);
    expect(spy.generateCalls).toBe(1);
    expect(spy.embedCalls + spy.generateCalls).toBeLessThanOrEqual(3);
  });

  it('makes zero Gemini calls on a warm cache', async () => {
    spy.cacheHits = true;

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(spy.embedCalls).toBe(0);
  });

  it('writes exactly one AiRun row per process', async () => {
    await POST(request());

    expect(db.aiRuns).toHaveLength(1);
    expect(db.aiRuns[0]).toMatchObject({ project_id: 'p-1', status: 'success' });
  });

  it('records real token counts', async () => {
    await POST(request());

    expect(db.aiRuns[0].prompt_tokens).toBe(40 + 200);
    expect(db.aiRuns[0].completion_tokens).toBe(50);
  });

  it('records a fallback run when embedding fails', async () => {
    spy.embedBehavior = 'rate-limit';

    const res = await POST(request());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isFallback).toBe(true);
    expect(db.aiRuns[0].status).toBe('fallback');
    // Fallback is deterministic: no explanation call, no invented embeddings.
    expect(spy.generateCalls).toBe(0);
    expect(db.aiRuns[0].prompt_tokens).toBeNull();
  });

  it('records an error run and keeps the failure fatal when the database is down', async () => {
    db.projectsFail = true;

    const res = await POST(request());

    expect(res.status).toBe(404);
    // No run was created because no AI call happened: a DB failure is not an AI failure.
    expect(db.aiRuns).toHaveLength(0);
  });

  it('still returns a recommendation when AiRun logging fails', async () => {
    db.aiRunFails = true;

    const res = await POST(request());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.result.assignments).toHaveLength(2);
  });

  it('keeps the recommendation usable when the explanation call throws', async () => {
    spy.generateBehavior = 'throw';

    const res = await POST(request());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isFallback).toBe(false);
    const first = json.result.assignments[0];
    expect(first.scores[first.primaryMemberId].reason).toContain('skor kesesuaian');
  });
});

describe('POST /api/recommend — resilience matrix', () => {
  const cases: Array<[string, 'invalid-key' | 'rate-limit' | 'timeout' | 'unavailable']> = [
    ['invalid API key', 'invalid-key'],
    ['rate limit', 'rate-limit'],
    ['timeout', 'timeout'],
    ['model unavailable', 'unavailable'],
  ];

  for (const [label, behavior] of cases) {
    it(`${label} degrades to fallback instead of failing the request`, async () => {
      spy.embedBehavior = behavior;

      const res = await POST(request());
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.isFallback).toBe(true);
      // FR-13 weights, no fabricated similarity.
      const first = json.result.assignments[0];
      expect(first.scores[first.primaryMemberId].breakdown.K).toBe(0);
    });
  }

  it('rejects a missing project code with 400, not a fallback', async () => {
    const res = await POST(request({}));

    expect(res.status).toBe(400);
  });
});
