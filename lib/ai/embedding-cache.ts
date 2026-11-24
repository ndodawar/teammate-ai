import crypto from 'crypto';
import { getSupabaseClient } from '@/lib/db/project';

// embedding_cache.embedding is vector(768) (migration 001); nothing else can be stored.
export const EMBEDDING_DIMENSION = 768;

export function hashContent(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function isValidEmbeddingValues(vec: unknown): vec is number[] {
  return (
    Array.isArray(vec) &&
    vec.length === EMBEDDING_DIMENSION &&
    vec.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

/**
 * PostgREST serialises a pgvector column as its text literal ("[0.1,0.2,...]"),
 * never a JSON array, so Array.isArray() alone always misses. Accept both shapes
 * and reject anything that is not 768 finite numbers.
 */
export function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) {
    return isValidEmbeddingValues(raw) ? raw : null;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const text = raw.trim();
  if (!text.startsWith('[') || !text.endsWith(']')) {
    return null;
  }
  const body = text.slice(1, -1);
  if (body.trim() === '') {
    return null;
  }
  const parsed = body.split(',').map((part) => Number(part));
  return isValidEmbeddingValues(parsed) ? parsed : null;
}

/**
 * pgvector accepts the same literal on write. Trimming to 6 decimals keeps the
 * payload well under the 2KB PostgREST limit; float4 stores ~7 digits anyway.
 */
export function serializeEmbedding(vec: number[]): string {
  return `[${vec.map((v) => Number(v.toFixed(6))).join(',')}]`;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// The model name lives inside the hash, so two models can never share a row.
export async function getCachedEmbedding(text: string, model: string): Promise<number[] | null> {
  const contentHash = hashContent(`${model}:${text}`);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('embedding_cache')
    .select('embedding')
    .eq('content_hash', contentHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return parseEmbedding(data.embedding);
}

export async function setCachedEmbedding(text: string, model: string, embedding: number[]): Promise<void> {
  const contentHash = hashContent(`${model}:${text}`);
  // Never poison the cache with a vector the column cannot hold.
  if (!isValidEmbeddingValues(embedding)) {
    return;
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('embedding_cache').upsert(
    [
      {
        content_hash: contentHash,
        embedding: serializeEmbedding(embedding),
      },
    ],
    { onConflict: 'content_hash' }
  );
  if (error) {
    throw new Error(`Embedding cache write failed: ${error.message}`);
  }
}

