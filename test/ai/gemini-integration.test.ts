import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/db/project', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
  generateProjectCode: () => 'unused',
}));

const spy = vi.hoisted(() => ({
  embedCalls: 0,
  generateCalls: 0,
  embedPayloads: [] as unknown[],
  generatePayloads: [] as unknown[],
  embedResults: [] as unknown[],
  generateText: '' as string,
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return {
      models: {
        generateContent: vi.fn((params: unknown) => {
          spy.generateCalls += 1;
          spy.generatePayloads.push(params);
          return Promise.resolve({ text: spy.generateText });
        }),
        embedContent: vi.fn((params: unknown) => {
          spy.embedCalls += 1;
          spy.embedPayloads.push(params);
          const queued = spy.embedResults.shift();
          if (queued instanceof Error) return Promise.reject(queued);
          return Promise.resolve(queued ?? { embeddings: [] });
        }),
      },
    };
  }),
}));

/**
 * T-6.02: task analysis moved from Gemini to Groq. `analyzeTasks` reads the
 * GROQ_* variables and posts to `{base}/chat/completions`, so the double is now
 * a `fetch` stub. It still drives `spy.generateText` / `spy.generateCalls`, which
 * is what the budget and validation cases below assert on. Embeddings keep using
 * the Gemini SDK double above, untouched.
 */
vi.stubEnv('GROQ_API_KEY', 'gsk_test_key_for_suite');
vi.stubEnv('GROQ_MODEL_TEXT', 'llama-3.3-70b-versatile');
vi.stubEnv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1');
vi.stubGlobal('fetch', vi.fn(async () => {
  spy.generateCalls += 1;
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: spy.generateText } }],
      usage: { prompt_tokens: 60, completion_tokens: 30 },
    }),
    text: async () => '',
  } as unknown as Response;
}));

import { computeTaskMemberCosineMap } from '@/lib/scoring/pipeline';
import { globalAssign } from '@/lib/scoring/assign';
import { embedTexts, analyzeTasks } from '@/lib/ai/analyze-task';
import { hashContent } from '@/lib/ai/embedding-cache';
import { FALLBACK_WEIGHTS, DEFAULT_WEIGHTS } from '@/lib/scoring/constants';
import { Task, Member } from '@/lib/scoring/types';

const MODEL = () => process.env.GEMINI_MODEL_EMBED || 'text-embedding-004';

function vec(seed: number): number[] {
  return Array.from({ length: 768 }, (_, i) => Number((((i + seed) % 10) / 10).toFixed(3)));
}

const tasks: Task[] = [
  { id: 't1', title: 'Buat UI', difficulty: 3, estimated_hours: 8, required_skills: ['pengujian'] },
  { id: 't2', title: 'Tulis laporan', difficulty: 2, estimated_hours: 6, required_skills: ['pengujian'] },
];
const members: Member[] = [
  { id: 'm1', name: 'Budi', skills: { pengujian: 4 }, interests: { pengujian: 4 }, capacity: 40 },
  { id: 'm2', name: 'Sari', skills: { pengujian: 3 }, interests: { pengujian: 5 }, capacity: 40 },
];

function wireChain(cacheRows: unknown[] = []) {
  let lookup = 0;
  mockMaybeSingle.mockImplementation(() => {
    const row = cacheRows[lookup++];
    return Promise.resolve({ data: row ? { embedding: row } : null, error: null });
  });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockSelect.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
  mockUpsert.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, upsert: mockUpsert });
}

beforeEach(() => {
  vi.clearAllMocks();
  spy.embedCalls = 0;
  spy.generateCalls = 0;
  spy.embedPayloads = [];
  spy.generatePayloads = [];
  spy.embedResults = [];
  spy.generateText = '';
  delete process.env.GEMINI_MODEL_EMBED;
  delete process.env.GEMINI_MODEL_TEXT;
  wireChain();
});

describe('FR-06 / NFR-06: Gemini integration under the call budget', () => {
  describe('embedding batching', () => {
    it('embeds all texts in a single request', async () => {
      spy.embedResults = [{ embeddings: [{ values: vec(0) }, { values: vec(1) }, { values: vec(2) }] }];

      const out = await embedTexts(['a', 'b', 'c']);

      expect(spy.embedCalls).toBe(1);
      expect(out).toHaveLength(3);
      expect(out.every((v) => v?.length === 768)).toBe(true);
    });

    it('sends only cache misses to Gemini', async () => {
      wireChain([`[${vec(9).join(',')}]`]);
      spy.embedResults = [{ embeddings: [{ values: vec(1) }] }];

      const out = await embedTexts(['cached one', 'fresh one']);

      expect(spy.embedCalls).toBe(1);
      const sent = (spy.embedPayloads[0] as { contents: string[] }).contents;
      expect(sent).toEqual(['fresh one']);
      expect(out[0]).toEqual(vec(9));
      expect(out[1]).toEqual(vec(1));
    });

    it('makes zero Gemini calls when everything is cached', async () => {
      wireChain([`[${vec(1).join(',')}]`, `[${vec(2).join(',')}]`]);

      const out = await embedTexts(['one', 'two']);

      expect(spy.embedCalls).toBe(0);
      expect(out[0]).toEqual(vec(1));
      expect(out[1]).toEqual(vec(2));
    });

    it('stores each fresh embedding under the model-scoped hash', async () => {
      spy.embedResults = [{ embeddings: [{ values: vec(3) }, { values: vec(4) }] }];

      await embedTexts(['alpha', 'beta']);

      const written = mockUpsert.mock.calls.map((c) => c[0][0]);
      expect(written).toHaveLength(2);
      expect(written[0].content_hash).toBe(hashContent(`${MODEL()}:alpha`));
      expect(written[1].content_hash).toBe(hashContent(`${MODEL()}:beta`));
    });

    it('leaves rejected slots null instead of fabricating a vector', async () => {
      // Second embedding is the wrong dimension.
      spy.embedResults = [{ embeddings: [{ values: vec(0) }, { values: [0.1, 0.2] }] }];

      const out = await embedTexts(['ok', 'bad']);

      expect(out[0]).toHaveLength(768);
      expect(out[1]).toBeNull();
    });
  });

  describe('recommendation process', () => {
    it('uses at most one embedding request for a whole process', async () => {
      spy.embedResults = [
        { embeddings: [...tasks, ...members].map((_, i) => ({ values: vec(i) })) },
      ];

      await computeTaskMemberCosineMap(tasks, members);

      expect(spy.embedCalls).toBe(1);
    });

    it('stays within the PRD budget of 3 calls per process', async () => {
      spy.embedResults = [
        { embeddings: [...tasks, ...members].map((_, i) => ({ values: vec(i) })) },
      ];
      spy.generateText = JSON.stringify({
        analyses: [
          { taskId: 't1', requiredSkills: ['pengujian'], effort: 3, note: 'catatan' },
          { taskId: 't2', requiredSkills: ['pengujian'], effort: 2, note: 'catatan' },
        ],
      });

      await analyzeTasks(tasks.map((t) => ({ id: t.id, title: t.title, description: 'x' })));
      await computeTaskMemberCosineMap(tasks, members);

      const total = spy.embedCalls + spy.generateCalls;
      expect(total).toBeLessThanOrEqual(3);
      expect(spy.generateCalls).toBe(1);
    });

    it('makes zero Gemini calls on a fully warm cache', async () => {
      wireChain(Array.from({ length: tasks.length + members.length }, (_, i) => `[${vec(i).join(',')}]`));

      const { isEmbeddingFailed } = await computeTaskMemberCosineMap(tasks, members);

      expect(spy.embedCalls).toBe(0);
      expect(isEmbeddingFailed).toBe(false);
    });

    it('keeps member selection deterministic and unchanged by AI', async () => {
      const vectors = [...tasks, ...members].map((_, i) => ({ values: vec(i) }));
      // Same payload for both runs: the mock queue is consumed one entry per call.
      spy.embedResults = [{ embeddings: vectors }, { embeddings: vectors }];

      const first = await computeTaskMemberCosineMap(tasks, members);
      const second = await computeTaskMemberCosineMap(tasks, members);

      const a = globalAssign(tasks, members, [], { cosineMap: first.cosineMap, weights: DEFAULT_WEIGHTS });
      const b = globalAssign(tasks, members, [], { cosineMap: second.cosineMap, weights: DEFAULT_WEIGHTS });

      expect(first.cosineMap).toEqual(second.cosineMap);
      expect(a.assignments.map((x) => x.primaryMemberId)).toEqual(
        b.assignments.map((x) => x.primaryMemberId)
      );
      // The model only supplies K; R1-R5 and S/C/M decide the assignment.
      expect(a.assignments[0].scores).toEqual(b.assignments[0].scores);
    });
  });

  describe('Gemini failure falls back safely', () => {
    it('flags embedding failure when the provider rejects the call', async () => {
      spy.embedResults = [new Error('rate limited')];

      const { isEmbeddingFailed, cosineMap } = await computeTaskMemberCosineMap(tasks, members);

      expect(isEmbeddingFailed).toBe(true);
      // One empty bucket per task, and no fabricated similarity values.
      expect(Object.keys(cosineMap).sort()).toEqual(['t1', 't2']);
      expect(Object.values(cosineMap).every((row) => Object.keys(row).length === 0)).toBe(true);
    });

    it('scores the fallback with FR-13 defaults when the caller sends no weights', async () => {
      const { cosineMap, isEmbeddingFailed } = await computeTaskMemberCosineMap(tasks, members);

      // No explicit weights: FR-13 defaults apply (S 0.50 / C 0.33 / M 0.17).
      const result = globalAssign(tasks, members, [], {
        isFallback: isEmbeddingFailed,
        cosineMap,
      });

      const first = Object.values(result.assignments[0].scores)[0].breakdown;
      expect(first.K).toBe(0);
      const expected =
        FALLBACK_WEIGHTS.S * first.S + FALLBACK_WEIGHTS.C * first.C + FALLBACK_WEIGHTS.M * first.M;
      if (first.total > 0) {
        expect(first.total).toBeCloseTo(expected, 4);
      }
    });

    it('applies weights the caller sends in fallback mode (FR-10 sliders)', async () => {
      const { cosineMap, isEmbeddingFailed } = await computeTaskMemberCosineMap(tasks, members);

      // FR-10: the UI moves the sliders, so explicit weights must win over the
      // FR-13 defaults, while K stays 0 in fallback mode.
      const result = globalAssign(tasks, members, [], {
        isFallback: isEmbeddingFailed,
        cosineMap,
        weights: DEFAULT_WEIGHTS,
      });

      const first = Object.values(result.assignments[0].scores)[0].breakdown;
      expect(first.K).toBe(0);
      const expected =
        DEFAULT_WEIGHTS.S * first.S + DEFAULT_WEIGHTS.C * first.C + DEFAULT_WEIGHTS.M * first.M;
      if (first.total > 0) {
        expect(first.total).toBeCloseTo(expected, 4);
      }
    });

    it('does not turn an invalid AI response into an analysis', async () => {
      spy.generateText = 'this is not json';

      await expect(
        analyzeTasks([{ id: 't1', title: 'x', description: 'y' }])
      ).rejects.toThrow();
    });

    it('rejects an analysis that invents task ids', async () => {
      spy.generateText = JSON.stringify({
        analyses: [{ taskId: 'ghost', requiredSkills: ['pengujian'], effort: 3, note: 'n' }],
      });

      await expect(
        analyzeTasks([{ id: 't1', title: 'x', description: 'y' }])
      ).rejects.toThrow();
    });

    it('rejects skills outside the fixed taxonomy', async () => {
      spy.generateText = JSON.stringify({
        analyses: [{ taskId: 't1', requiredSkills: ['React Ninja'], effort: 3, note: 'n' }],
      });

      await expect(
        analyzeTasks([{ id: 't1', title: 'x', description: 'y' }])
      ).rejects.toThrow();
    });
  });

  describe('local interactions stay offline', () => {
    it('recomputing assignments never calls Gemini', () => {
      const cosineMap = { t1: { m1: 0.5, m2: 0.6 }, t2: { m1: 0.4, m2: 0.3 } };

      globalAssign(tasks, members, [], { cosineMap, weights: DEFAULT_WEIGHTS });
      globalAssign(tasks, members, [], { cosineMap, weights: { K: 0, S: 0.5, C: 0.33, M: 0.17 }, isFallback: true });
      globalAssign(tasks, members, [], { cosineMap, weights: { K: 0.1, S: 0.6, C: 0.2, M: 0.1 } });

      expect(spy.embedCalls).toBe(0);
      expect(spy.generateCalls).toBe(0);
    });
  });
});
