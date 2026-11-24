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

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return {
      models: {
        generateContent: vi.fn(),
        embedContent: vi.fn(),
      },
    };
  }),
}));

import { cosineSimilarity, hashContent, getCachedEmbedding, parseEmbedding } from '@/lib/ai/embedding-cache';
import { normalizeCosineSimilarity } from '@/lib/scoring/score';
import { embedText, ai } from '@/lib/ai/analyze-task';

// A real row is 768 dims, and PostgREST hands it back as a pgvector text literal
// ("[0.1,0.2,...]"), not a JSON array. The old 3-element array fixture could never
// exist in a vector(768) column, so it proved nothing.
const CACHED_VECTOR = Array.from({ length: 768 }, (_, i) => Number(((i % 10) / 10).toFixed(3)));
const CACHED_LITERAL = `[${CACHED_VECTOR.join(',')}]`;

function wireChain() {
  mockMaybeSingle.mockResolvedValue({ data: { embedding: CACHED_LITERAL }, error: null });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockSelect.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
  mockUpsert.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, upsert: mockUpsert });
}

describe('FR-06: Embedding, Cosine Similarity & K Normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wireChain();
  });

  it('calculates correct cosine similarity for vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
    expect(cosineSimilarity([1, 1, 0], [1, 0, 0])).toBeCloseTo(1 / Math.sqrt(2));
  });

  it('handles empty or mismatched vectors gracefully', () => {
    expect(cosineSimilarity([], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it('normalizes cosine similarity into K using clamp((cos - 0.2) / 0.6, 0, 1)', () => {
    expect(normalizeCosineSimilarity(0.1)).toBe(0);
    expect(normalizeCosineSimilarity(0.2)).toBe(0);
    expect(normalizeCosineSimilarity(0.5)).toBeCloseTo(0.5);
    expect(normalizeCosineSimilarity(0.8)).toBe(1);
    expect(normalizeCosineSimilarity(0.9)).toBe(1);
  });

  it('generates a distinct hash when text or model changes', () => {
    const h1 = hashContent('text-embedding-004:Hello');
    const h2 = hashContent('text-embedding-004:World');
    const h3 = hashContent('text-embedding-005:Hello');

    expect(h1).not.toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toBe(hashContent('text-embedding-004:Hello'));
  });

  it('reads the cache key that includes the model name', async () => {
    const result = await getCachedEmbedding('cached text', 'text-embedding-004');

    expect(result).toEqual(CACHED_VECTOR);
    expect(mockFrom).toHaveBeenCalledWith('embedding_cache');
    expect(mockEq).toHaveBeenCalledWith('content_hash', hashContent('text-embedding-004:cached text'));
  });

  it('returns cached vector without calling the embedding API (cache hit)', async () => {
    const result = await embedText('cached text');

    expect(result).toEqual(CACHED_VECTOR);
    expect(ai.models.embedContent).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('calls the API once and writes the cache on a miss', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const vector = Array(768).fill(0.25);
    vi.spyOn(ai.models, 'embedContent').mockResolvedValueOnce({
      embeddings: [{ values: vector }],
    } as unknown as Awaited<ReturnType<typeof ai.models.embedContent>>);

    const result = await embedText('new text');

    expect(result).toEqual(vector);
    expect(ai.models.embedContent).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const written = mockUpsert.mock.calls[0][0][0].embedding;
    // Written as a pgvector text literal, which is what the column actually accepts.
    expect(typeof written).toBe('string');
    expect(parseEmbedding(written)).toHaveLength(768);
    expect(mockUpsert.mock.calls[0][0][0].content_hash).toBe(
      hashContent(`${process.env.GEMINI_MODEL_EMBED || 'text-embedding-004'}:new text`)
    );
  });

  it('rejects a vector whose length does not match vector(768) before caching', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    vi.spyOn(ai.models, 'embedContent').mockResolvedValueOnce({
      embeddings: [{ values: [0.1, 0.2, 0.3] }],
    } as unknown as Awaited<ReturnType<typeof ai.models.embedContent>>);

    const result = await embedText('short vector');

    expect(result).toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns null instead of a fabricated vector when embedding fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    vi.spyOn(ai.models, 'embedContent').mockRejectedValueOnce(new Error('API Error'));

    const result = await embedText('test text');

    expect(result).toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('rejects a cache row whose embedding is not a pgvector literal', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { embedding: 'not-a-vector' }, error: null });

    const result = await getCachedEmbedding('cached text', 'text-embedding-004');

    expect(result).toBeNull();
  });
});
