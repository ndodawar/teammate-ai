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

const spy = vi.hoisted(() => ({ embedCalls: 0 }));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return {
      models: {
        generateContent: vi.fn(),
        embedContent: vi.fn(() => {
          spy.embedCalls += 1;
          return Promise.resolve({ embeddings: [{ values: Array(768).fill(0.5) }] });
        }),
      },
    };
  }),
}));

import {
  hashContent,
  parseEmbedding,
  serializeEmbedding,
  getCachedEmbedding,
  setCachedEmbedding,
  isValidEmbeddingValues,
  EMBEDDING_DIMENSION,
} from '@/lib/ai/embedding-cache';
import { embedText } from '@/lib/ai/analyze-task';

const VECTOR = Array.from({ length: 768 }, (_, i) => Number(((i % 10) / 10).toFixed(3)));
const LITERAL = `[${VECTOR.join(',')}]`;

// Mimics PostgREST: a vector(768) column always comes back as a text literal.
function wireRead(embedding: unknown, error: unknown = null) {
  mockMaybeSingle.mockResolvedValue({ data: embedding === undefined ? null : { embedding }, error });
}

function wireChain() {
  wireRead(LITERAL);
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockSelect.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
  mockUpsert.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, upsert: mockUpsert });
}

describe('FR-13 / PRD 10.3: embedding cache serialisation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spy.embedCalls = 0;
    wireChain();
  });

  describe('vector shape', () => {
    it('targets exactly 768 dimensions', () => {
      expect(EMBEDDING_DIMENSION).toBe(768);
    });

    it('parses the pgvector text literal Supabase actually returns', () => {
      const parsed = parseEmbedding(LITERAL);

      expect(parsed).toEqual(VECTOR);
      expect(parsed).toHaveLength(768);
    });

    it('parses real-world scientific-notation values', () => {
      const vec = Array.from({ length: 768 }, (_, i) => (i % 2 === 0 ? 0 : 2.52e-4));
      const parsed = parseEmbedding(`[${vec.join(',')}]`);

      expect(parsed).not.toBeNull();
      expect(parsed![1]).toBeCloseTo(2.52e-4, 8);
    });

    it('still accepts an already-parsed array', () => {
      expect(parseEmbedding(VECTOR)).toEqual(VECTOR);
    });

    it('round-trips without drift at float4 precision', () => {
      const parsed = parseEmbedding(serializeEmbedding(VECTOR));

      expect(parsed).toEqual(VECTOR);
    });

    it('serialises to a pgvector literal, not JSON', () => {
      const literal = serializeEmbedding(VECTOR);

      expect(literal.startsWith('[')).toBe(true);
      expect(literal.endsWith(']')).toBe(true);
      expect(parseEmbedding(literal)).toHaveLength(768);
    });
  });

  describe('rejects unusable vectors', () => {
    it('rejects the wrong dimension', () => {
      expect(parseEmbedding('[0.1,0.2,0.3]')).toBeNull();
      expect(parseEmbedding(Array(767).fill(0.1))).toBeNull();
      expect(parseEmbedding(Array(769).fill(0.1))).toBeNull();
    });

    it('rejects NaN and Infinity', () => {
      const withNaN = [...VECTOR];
      withNaN[10] = NaN;
      const withInf = [...VECTOR];
      withInf[20] = Infinity;

      expect(parseEmbedding(withNaN)).toBeNull();
      expect(parseEmbedding(withInf)).toBeNull();
      expect(parseEmbedding(`[${withNaN.join(',')}]`)).toBeNull();
      expect(parseEmbedding('[0.1,Infinity,' + VECTOR.slice(2).join(',') + ']')).toBeNull();
    });

    it('rejects empty, malformed, null and non-numeric payloads', () => {
      expect(parseEmbedding('[]')).toBeNull();
      expect(parseEmbedding('not-a-vector')).toBeNull();
      expect(parseEmbedding('')).toBeNull();
      expect(parseEmbedding(null)).toBeNull();
      expect(parseEmbedding(undefined)).toBeNull();
      expect(parseEmbedding(42)).toBeNull();
      expect(parseEmbedding({})).toBeNull();
      expect(parseEmbedding('[' + Array(768).fill('abc').join(',') + ']')).toBeNull();
    });

    it('refuses to write a vector the column could not hold', async () => {
      await setCachedEmbedding('text', 'model', [0.1, 0.2, 0.3]);

      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe('cache miss', () => {
    it('returns null when no row exists', async () => {
      wireRead(undefined);

      expect(await getCachedEmbedding('missing', 'model')).toBeNull();
    });

    it('calls Gemini once and persists the result', async () => {
      wireRead(undefined);

      const result = await embedText('brand new text');

      expect(spy.embedCalls).toBe(1);
      expect(result).toHaveLength(768);
      expect(mockUpsert).toHaveBeenCalledTimes(1);
      const written = mockUpsert.mock.calls[0][0][0].embedding;
      expect(parseEmbedding(written)).toHaveLength(768);
    });
  });

  describe('cache hit', () => {
    it('returns the stored vector without calling Gemini', async () => {
      const result = await embedText('already cached');

      expect(result).toEqual(VECTOR);
      expect(spy.embedCalls).toBe(0);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('never writes on a hit', async () => {
      await getCachedEmbedding('already cached', 'model');

      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe('key identity', () => {
    it('keys on both text and model', () => {
      expect(hashContent('model-a:same text')).not.toBe(hashContent('model-b:same text'));
      expect(hashContent('model-a:text one')).not.toBe(hashContent('model-a:text two'));
    });

    it('does not reuse another model\'s cache row', async () => {
      wireRead(undefined);

      await embedText('shared text', );
      const queriedHash = mockEq.mock.calls[0][1];
      const embedModel = process.env.GEMINI_MODEL_EMBED || 'text-embedding-004';

      expect(queriedHash).toBe(hashContent(`${embedModel}:shared text`));
      expect(queriedHash).not.toBe(hashContent(`gemini-embedding-001:shared text`));
    });
  });

  describe('cache failures stay safe', () => {
    it('falls back to Gemini when the read errors', async () => {
      wireRead(undefined, { message: 'connection reset' });

      const result = await embedText('read error');

      expect(spy.embedCalls).toBe(1);
      expect(result).toHaveLength(768);
    });

    it('still returns the embedding when the write fails', async () => {
      wireRead(undefined);
      mockUpsert.mockResolvedValue({ error: { message: 'write rejected' } });

      const result = await embedText('write error');

      expect(result).toHaveLength(768);
    });

    it('returns null rather than a fabricated vector when Gemini fails', async () => {
      wireRead(undefined);
      spy.embedCalls = 0;
      const failing = vi.fn(() => Promise.reject(new Error('quota exceeded')));
      // Swap in a failing embed for this case only.
      const { ai } = await import('@/lib/ai/analyze-task');
      (ai.models as unknown as { embedContent: unknown }).embedContent = failing;

      const result = await embedText('gemini down');

      expect(result).toBeNull();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('treats a corrupt row as a miss instead of trusting it', async () => {
      wireRead('[1,2,3]');

      expect(await getCachedEmbedding('corrupt', 'model')).toBeNull();
    });
  });

  describe('dimension validator', () => {
    it('accepts only 768 finite numbers', () => {
      expect(isValidEmbeddingValues(VECTOR)).toBe(true);
      expect(isValidEmbeddingValues(Array(767).fill(0))).toBe(false);
      expect(isValidEmbeddingValues([0.1, NaN])).toBe(false);
      expect(isValidEmbeddingValues(['0.1'] as unknown)).toBe(false);
      expect(isValidEmbeddingValues(null)).toBe(false);
    });
  });
});
