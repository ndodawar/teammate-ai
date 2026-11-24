import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatTaskText, formatMemberText, computeTaskMemberCosineMap } from '@/lib/scoring/pipeline';
import { globalAssign } from '@/lib/scoring/assign';
import { Task, Member } from '@/lib/scoring/types';

vi.mock('@/lib/ai/analyze-task', () => ({
  embedTexts: vi.fn(),
}));

import { embedTexts } from '@/lib/ai/analyze-task';

describe('FR-06: Recommendation Pipeline & Embedding Integration', () => {
  const mockTasks: Task[] = [
    {
      id: 't1',
      title: 'Desain Sistem AI',
      description: 'Membuat arsitektur rekomendasi',
      difficulty: 4,
      estimated_hours: 10,
      required_skills: ['desain sistem', 'pemrograman backend'],
    },
  ];

  const mockMembers: Member[] = [
    {
      id: 'm1',
      name: 'Budi',
      skills: { 'desain sistem': 4, 'pemrograman backend': 3 },
      interests: { 'desain sistem': 5 },
      capacity: 40,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats task text correctly for embedding', () => {
    const text = formatTaskText(mockTasks[0]);
    expect(text).toBe('Desain Sistem AI - Membuat arsitektur rekomendasi (Skills: desain sistem, pemrograman backend)');
  });

  it('formats member text correctly for embedding', () => {
    const text = formatMemberText(mockMembers[0]);
    expect(text).toBe('Budi. Skills: desain sistem: level 4, pemrograman backend: level 3. Minat: desain sistem: minat 5.');
  });

  it('computes actual cosine similarity map when embedding succeeds', async () => {
    const taskVec = Array(768).fill(0);
    taskVec[0] = 1;
    const memberVec = Array(768).fill(0);
    memberVec[0] = 0.8;
    memberVec[1] = 0.6;

    vi.mocked(embedTexts).mockResolvedValueOnce([taskVec, memberVec]);

    const { cosineMap, isEmbeddingFailed } = await computeTaskMemberCosineMap(mockTasks, mockMembers);

    expect(isEmbeddingFailed).toBe(false);
    expect(cosineMap['t1']['m1']).toBeCloseTo(0.8);
  });

  it('asks for every text in one batched call', async () => {
    // NFR-06: one request per process, not one per task/member.
    vi.mocked(embedTexts).mockResolvedValueOnce([Array(768).fill(0.1), Array(768).fill(0.1)]);

    await computeTaskMemberCosineMap(mockTasks, mockMembers);

    expect(vi.mocked(embedTexts)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(embedTexts).mock.calls[0][0]).toEqual([
      formatTaskText(mockTasks[0]),
      formatMemberText(mockMembers[0]),
    ]);
  });

  it('flags embedding failure when a batched result is null', async () => {
    vi.mocked(embedTexts).mockResolvedValueOnce([Array(768).fill(0.1), null]);

    const { cosineMap, isEmbeddingFailed, failedPairs } = await computeTaskMemberCosineMap(
      mockTasks,
      mockMembers
    );

    expect(isEmbeddingFailed).toBe(true);
    expect(failedPairs).toEqual(['t1:m1']);
    expect(cosineMap['t1']['m1']).toBeUndefined();
  });

  it('flags embedding failure when a vector dimension is not 768', async () => {
    vi.mocked(embedTexts).mockResolvedValueOnce([[1, 0, 0], Array(768).fill(0.1)]);

    const { cosineMap, isEmbeddingFailed, failedPairs } = await computeTaskMemberCosineMap(
      mockTasks,
      mockMembers
    );

    expect(isEmbeddingFailed).toBe(true);
    expect(failedPairs).toEqual(['t1:m1']);
    expect(cosineMap['t1']['m1']).toBeUndefined();
  });

  it('passes the actual cosine similarity into computeScore', () => {
    const cosineMap = { t1: { m1: 0.8 } };

    const result = globalAssign(mockTasks, mockMembers, [], { cosineMap });
    const score = result.assignments[0].scores['m1'];

    // 0.8 -> K = (0.8 - 0.2) / 0.6 = 1.0; the old 0.5 default would have produced 0.5
    expect(score.breakdown.K).toBe(1.0);
  });

  it('throws instead of scoring with a fabricated cosine when the pair is missing', () => {
    expect(() => globalAssign(mockTasks, mockMembers, [], { cosineMap: {} })).toThrow(
      /Embedding missing for task t1 member m1/
    );
  });

  it('throws instead of scoring with a fabricated cosine when globalAssign gets no map', () => {
    expect(() => globalAssign(mockTasks, mockMembers)).toThrow(/Embedding missing/);
  });

  it('does not treat a zero cosine as missing', () => {
    const result = globalAssign(mockTasks, mockMembers, [], { cosineMap: { t1: { m1: 0 } } });

    expect(result.assignments[0].scores['m1'].breakdown.K).toBe(0);
  });
});
