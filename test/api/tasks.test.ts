import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SECRET_KEY ??= 'test-key';

interface QueryResult {
  data: unknown;
  error: unknown;
}

// Insert rows captured per test so assertions can inspect what reaches the database.
let insertedRows: Record<string, unknown>[] = [];
let updatedRow: Record<string, unknown> | null = null;

function stubClient(options: {
  project: QueryResult;
  list?: QueryResult;
  insert?: QueryResult;
  taskSingle?: QueryResult;
  update?: QueryResult;
  delete?: QueryResult;
}) {
  return {
    from: (table: string) => {
      if (table === 'projects') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => options.project,
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: async () => options.list ?? { data: [], error: null },
            eq: () => ({
              maybeSingle: async () => options.taskSingle ?? { data: { id: 't1' }, error: null },
            }),
          }),
        }),
        insert: (rows: Record<string, unknown>[]) => {
          insertedRows.push(...rows);
          return {
            select: () => ({
              single: async () => options.insert ?? { data: { id: 't1' }, error: null },
            }),
          };
        },
        update: (row: Record<string, unknown>) => {
          updatedRow = row;
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: async () => options.update ?? { data: { id: 't1' }, error: null },
                }),
              }),
            }),
          };
        },
        delete: () => ({
          eq: () => ({
            eq: async () => options.delete ?? { data: null, error: null },
          }),
        }),
      };
    },
  };
}

let mockClient: ReturnType<typeof stubClient>;

vi.mock('@/lib/db/project', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/project')>();
  return { ...actual, getSupabaseClient: () => mockClient };
});

import { GET, POST } from '@/app/api/projects/[code]/tasks/route';
import { PUT, DELETE } from '@/app/api/projects/[code]/tasks/[id]/route';

const VALID_CODE = 'a'.repeat(24);
const OK_PROJECT: QueryResult = { data: { id: 'proj-1' }, error: null };

function getTasks(code: string = VALID_CODE) {
  return GET(new Request(`http://localhost/api/projects/${code}/tasks`), {
    params: Promise.resolve({ code }),
  });
}

function postTask(body: unknown, code: string = VALID_CODE) {
  return POST(
    new Request(`http://localhost/api/projects/${code}/tasks`, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ code }) }
  );
}

function putTask(id: string, body: unknown, code: string = VALID_CODE) {
  return PUT(
    new Request(`http://localhost/api/projects/${code}/tasks/${id}`, {
      method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ code, id }) }
  );
}

function deleteTask(id: string, code: string = VALID_CODE) {
  return DELETE(new Request(`http://localhost/api/projects/${code}/tasks/${id}`, { method: 'DELETE' }), {
    params: Promise.resolve({ code, id }),
  });
}

const MANUAL_TASK = {
  title: 'Menyusun Bab 2',
  description: 'Menyusun pembahasan.',
  effort: 4,
  estimated_hours: 12,
  required_skills: ['penulisan akademik'],
  due_date: '2026-12-01',
  locked: false,
  source: 'manual',
};

beforeEach(() => {
  vi.clearAllMocks();
  insertedRows = [];
  updatedRow = null;
});

describe('Tasks API (T-3.31 / T-3.36)', () => {
  it('GET /api/projects/[code]/tasks - mengembalikan daftar tugas', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      list: {
        data: [{ id: 't1', title: 'Setup UI', effort: 4, required_skills: ['pemrograman frontend'] }],
        error: null,
      },
    });

    const res = await getTasks();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0].title).toBe('Setup UI');
  });

  it('POST load_templates - mengembalikan 11 draft tanpa menyentuh database', async () => {
    mockClient = stubClient({ project: OK_PROJECT });

    const res = await postTask({ action: 'load_templates' });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toHaveLength(11);
    expect(json.map((d: { template_id: string }) => d.template_id)).toEqual([
      'T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11',
    ]);
    expect(insertedRows).toHaveLength(0);
  });

  it('POST load_templates - draft tidak membawa estimasi jam buatan', async () => {
    mockClient = stubClient({ project: OK_PROJECT });

    const res = await postTask({ action: 'load_templates' });
    const json = await res.json();
    for (const draft of json) {
      expect(draft).not.toHaveProperty('estimated_hours');
      expect(draft.source).toBe('template');
    }
  });

  it('POST draft tanpa estimasi jam - ditolak', async () => {
    mockClient = stubClient({ project: OK_PROJECT });

    const draftBody = { ...MANUAL_TASK, source: 'template' } as Record<string, unknown>;
    delete draftBody.estimated_hours;
    const res = await postTask(draftBody);
    expect(res.status).toBe(400);
    expect(insertedRows).toHaveLength(0);
  });

  it('POST estimasi jam 0, negatif, pecahan, atau string - ditolak', async () => {
    mockClient = stubClient({ project: OK_PROJECT });

    for (const value of [0, -3, 2.5, '8']) {
      const res = await postTask({ ...MANUAL_TASK, estimated_hours: value });
      expect(res.status).toBe(400);
    }
    expect(insertedRows).toHaveLength(0);
  });

  it('POST tugas manual sukses - effort sama dengan difficulty, estimasi jam tetap', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      insert: { data: { id: 't1', title: 'Menyusun Bab 2' }, error: null },
    });

    const res = await postTask(MANUAL_TASK);
    expect(res.status).toBe(201);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].effort).toBe(4);
    expect(insertedRows[0].difficulty).toBe(4);
    expect(insertedRows[0].estimated_hours).toBe(12);
  });

  it('POST tugas manual - estimated_hours tidak mengikuti effort', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      insert: { data: { id: 't1' }, error: null },
    });

    await postTask({ ...MANUAL_TASK, effort: 1, estimated_hours: 30 });
    expect(insertedRows[0].effort).toBe(1);
    expect(insertedRows[0].difficulty).toBe(1);
    expect(insertedRows[0].estimated_hours).toBe(30);
  });

  it('POST tugas manual - source template tetap dapat disimpan dengan estimasi jam', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      insert: { data: { id: 't1' }, error: null },
    });

    const res = await postTask({ ...MANUAL_TASK, source: 'template' });
    expect(res.status).toBe(201);
    expect(insertedRows[0].source).toBe('template');
  });

  it('PUT tugas - effort dan difficulty tersinkron, estimasi jam independen', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      taskSingle: { data: { id: 't1' }, error: null },
      update: { data: { id: 't1', title: 'Updated Title' }, error: null },
    });

    const res = await putTask('t1', {
      title: 'Updated Title',
      effort: 5,
      estimated_hours: 25,
      required_skills: ['pemrograman backend'],
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.title).toBe('Updated Title');
    expect(updatedRow?.effort).toBe(5);
    expect(updatedRow?.difficulty).toBe(5);
    expect(updatedRow?.estimated_hours).toBe(25);
  });

  it('PUT tugas tanpa estimasi jam - ditolak', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      taskSingle: { data: { id: 't1' }, error: null },
    });

    const res = await putTask('t1', {
      title: 'Updated Title',
      effort: 5,
      required_skills: ['pemrograman backend'],
    });
    expect(res.status).toBe(400);
    expect(updatedRow).toBeNull();
  });

  it('PUT tugas yang tidak ada - 404', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      taskSingle: { data: null, error: null },
    });

    const res = await putTask('missing', MANUAL_TASK);
    expect(res.status).toBe(404);
  });

  it('DELETE tugas - sukses', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      taskSingle: { data: { id: 't1' }, error: null },
      delete: { data: null, error: null },
    });

    const res = await deleteTask('t1');
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.message).toContain('berhasil dihapus');
  });

  it('DELETE tugas yang tidak ada - 404', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      taskSingle: { data: null, error: null },
    });

    const res = await deleteTask('missing');
    expect(res.status).toBe(404);
  });

  it('GET proyek tidak ditemukan - 404', async () => {
    mockClient = stubClient({ project: { data: null, error: null } });

    const res = await getTasks();
    expect(res.status).toBe(404);
  });

  it('error database pada lookup proyek tidak membocorkan pesan internal', async () => {
    mockClient = stubClient({
      project: { data: null, error: { message: 'connection terminated unexpectedly', code: '57P01' } },
    });

    const res = await getTasks();
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.error).toBe('Gagal memuat daftar tugas.');
    expect(JSON.stringify(json)).not.toContain('57P01');
  });
});
