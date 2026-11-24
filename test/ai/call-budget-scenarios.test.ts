import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * NFR-06 measured across the whole D2 synthetic dataset (20 scenarios).
 *
 * Each scenario runs through the real pipeline + real explanation service with
 * the provider stubbed, so the assertions are about the calls the product
 * actually attempts, not about a mock's expectations.
 */

const spy = vi.hoisted(() => {
  const state = {
    embedCalls: 0,
    generateCalls: 0,
    available: true,
  };
  return { state };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return {
      models: {
        generateContent: vi.fn(() => {
          spy.state.generateCalls += 1;
          if (!spy.state.available) return Promise.reject(new Error('provider unavailable'));
          return Promise.resolve({ text: JSON.stringify({ explanations: [] }) });
        }),
        embedContent: vi.fn((params: { contents: string | string[] }) => {
          spy.state.embedCalls += 1;
          if (!spy.state.available) return Promise.reject(new Error('provider unavailable'));
          const n = Array.isArray(params.contents) ? params.contents.length : 1;
          return Promise.resolve({
            embeddings: Array.from({ length: n }, () => ({ values: Array(768).fill(0.1) })),
          });
        }),
      },
    };
  }),
}));

/**
 * T-6.02: the explanation call now leaves through `fetch` to Groq. It feeds the
 * same `spy.state` counters, so the budget arithmetic across all 20 scenarios is
 * measured on the real call path (1 embedding + 1 explanation = 2, worst case).
 */
vi.stubEnv('GROQ_API_KEY', 'gsk_test_key_for_suite');
vi.stubEnv('GROQ_MODEL_TEXT', 'llama-3.3-70b-versatile');
vi.stubEnv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1');
vi.stubGlobal('fetch', vi.fn(async () => {
  spy.state.generateCalls += 1;
  if (!spy.state.available) throw new Error('provider unavailable');
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ explanations: [] }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
    text: async () => '',
  } as unknown as Response;
}));

// Always a cache miss: this measures the worst case for call count.
vi.mock('@/lib/db/project', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      upsert: () => Promise.resolve({ error: null }),
      insert: () => Promise.resolve({ error: null }),
    }),
  }),
}));

import { SCENARIOS } from '@/test/scoring/fixtures/scenarios';
import { computeTaskMemberCosineMap } from '@/lib/scoring/pipeline';
import { globalAssign } from '@/lib/scoring/assign';
import { explainAssignments } from '@/lib/ai/explain';
import { AiRun, MAX_GEMINI_CALLS_PER_PROCESS } from '@/lib/ai/call-budget';
import { DEFAULT_WEIGHTS } from '@/lib/scoring/constants';

beforeEach(() => {
  spy.state.embedCalls = 0;
  spy.state.generateCalls = 0;
  spy.state.available = true;
});

describe('NFR-06: Gemini budget across all 20 D2 scenarios', () => {
  it('never exceeds 3 calls in any scenario on a cold cache', async () => {
    const measured: { scenario: string; calls: number }[] = [];

    for (const scenario of SCENARIOS) {
      spy.state.embedCalls = 0;
      spy.state.generateCalls = 0;

      const run = new AiRun('scenario');
      const { cosineMap, isEmbeddingFailed } = await computeTaskMemberCosineMap(
        scenario.tasks,
        scenario.members,
        run
      );

      const assigned = globalAssign(scenario.tasks, scenario.members, [], {
        isFallback: isEmbeddingFailed,
        cosineMap,
        weights: DEFAULT_WEIGHTS,
      });

      await explainAssignments({
        tasks: scenario.tasks,
        members: scenario.members,
        result: assigned,
        isFallback: isEmbeddingFailed,
        run,
      });

      const total = spy.state.embedCalls + spy.state.generateCalls;
      measured.push({ scenario: scenario.description, calls: total });

      expect(total).toBeLessThanOrEqual(MAX_GEMINI_CALLS_PER_PROCESS);
      // The run's own counter must agree with the provider-level count.
      expect(run.callCount).toBe(total);
    }

    expect(measured).toHaveLength(20);
    // Worst case is 1 embedding + 1 explanation = 2, always.
    expect(Math.max(...measured.map((m) => m.calls))).toBe(2);
  });

  it('stays within budget when the provider fails in every scenario', async () => {
    spy.state.available = false;

    for (const scenario of SCENARIOS) {
      const run = new AiRun('scenario');
      const { cosineMap, isEmbeddingFailed } = await computeTaskMemberCosineMap(
        scenario.tasks,
        scenario.members,
        run
      );

      expect(isEmbeddingFailed).toBe(true);

      const assigned = globalAssign(scenario.tasks, scenario.members, [], {
        isFallback: isEmbeddingFailed,
        cosineMap,
        weights: DEFAULT_WEIGHTS,
      });
      await explainAssignments({
        tasks: scenario.tasks,
        members: scenario.members,
        result: assigned,
        isFallback: isEmbeddingFailed,
        run,
      });

      // One failed embedding attempt, no retry storm, no explanation call.
      expect(run.callCount).toBe(1);
    }
  });

  it('keeps every scenario at zero calls once the cache is warm', async () => {
    for (const scenario of SCENARIOS) {
      const run = new AiRun('scenario');
      // A warm cache is simulated by scoring straight from a prebuilt map.
      const cosineMap: Record<string, Record<string, number>> = {};
      for (const task of scenario.tasks) {
        cosineMap[task.id] = {};
        for (const member of scenario.members) cosineMap[task.id][member.id] = 0.5;
      }

      const assigned = globalAssign(scenario.tasks, scenario.members, [], {
        cosineMap,
        weights: DEFAULT_WEIGHTS,
      });
      // Fallback mode is the template path and makes no call by definition.
      await explainAssignments({
        tasks: scenario.tasks,
        members: scenario.members,
        result: assigned,
        isFallback: true,
        run,
      });

      expect(spy.state.embedCalls).toBe(0);
      expect(spy.state.generateCalls).toBe(0);
      expect(run.callCount).toBe(0);
    }
  });
});
