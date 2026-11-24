import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryChain = {
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
};

// Replace the client factory; tests never reach the network or a real database.
vi.mock('@/lib/db/project', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/project')>();
  return { ...actual, getSupabaseClient: () => queryChain };
});

import { POST } from '@/app/api/projects/route';
import { projectSchema } from '@/lib/validation';
import { generateProjectCode } from '@/lib/db/project';

function respondWith(result: { data: unknown; error: unknown }) {
  queryChain.single.mockResolvedValueOnce(result);
}

function postRequest(body: unknown) {
  return new Request('http://localhost/api/projects', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validPayload = { title: 'Tugas Kelompok', deadline: '2026-12-31' };

describe('FR-01: project schema', () => {
  it('accepts a title and a YYYY-MM-DD deadline', () => {
    expect(projectSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(projectSchema.safeParse({ ...validPayload, title: '' }).success).toBe(false);
  });

  it('rejects a title above 100 characters', () => {
    expect(projectSchema.safeParse({ ...validPayload, title: 'a'.repeat(101) }).success).toBe(false);
  });

  it('rejects an ISO datetime string', () => {
    expect(projectSchema.safeParse({ ...validPayload, deadline: '2026-12-31T23:59:59.000Z' }).success).toBe(false);
  });

  it('rejects invalid calendar date 2026-02-30', () => {
    expect(projectSchema.safeParse({ ...validPayload, deadline: '2026-02-30' }).success).toBe(false);
  });

  it('rejects unknown system fields such as code and id', () => {
    const parsed = projectSchema.safeParse({ ...validPayload, code: 'forced', id: 'forced' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && Object.keys(parsed.data)).toEqual(['title', 'deadline']);
  });
});

describe('FR-01: project code generator', () => {
  it('produces at least 10 characters', () => {
    expect(generateProjectCode().length).toBeGreaterThanOrEqual(10);
  });
});

describe('FR-01: POST /api/projects', () => {
  beforeEach(() => {
    queryChain.from.mockReset().mockReturnValue(queryChain);
    queryChain.insert.mockReset().mockReturnValue(queryChain);
    queryChain.select.mockReset().mockReturnValue(queryChain);
    queryChain.single.mockReset();
  });

  it('inserts title, deadline and generated code, then returns the members link', async () => {
    respondWith({
      data: { id: 'p1', title: 'Tugas Kelompok', deadline: '2026-12-31', code: 'abc123456789' },
      error: null,
    });

    const res = await POST(postRequest(validPayload));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({
      id: 'p1',
      title: 'Tugas Kelompok',
      deadline: '2026-12-31',
      code: 'abc123456789',
      link: '/p/abc123456789/members',
    });
    expect(queryChain.from).toHaveBeenCalledWith('projects');
    expect(queryChain.insert).toHaveBeenCalledWith([
      { title: 'Tugas Kelompok', deadline: validPayload.deadline, code: expect.stringMatching(/^[0-9a-f]{24}$/) },
    ]);
  });

  it('returns 400 and never inserts when validation fails', async () => {
    const res = await POST(postRequest({ ...validPayload, title: '' }));

    expect(res.status).toBe(400);
    expect(queryChain.from).not.toHaveBeenCalled();
    expect(queryChain.insert).not.toHaveBeenCalled();
  });

  it('returns 500 instead of throwing when the deadline column is missing (42703)', async () => {
    respondWith({
      data: null,
      error: { code: '42703', message: 'column "deadline" of relation "projects" does not exist' },
    });

    const res = await POST(postRequest(validPayload));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(json)).not.toContain('deadline');
  });

  it('returns 409 when the code collides with the unique constraint', async () => {
    respondWith({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } });

    const res = await POST(postRequest(validPayload));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBeDefined();
    expect(JSON.stringify(json)).not.toContain('duplicate key');
  });
});
