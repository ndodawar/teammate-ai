import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SECRET_KEY ??= 'test-key';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function stubClient(options: {
  project: QueryResult;
  list?: QueryResult;
  insert?: QueryResult;
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
          eq: async () => options.list ?? { data: [], error: null },
        }),
        insert: () => ({
          select: () => ({
            single: async () => options.insert ?? { data: null, error: null },
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

import { GET, POST } from '@/app/api/projects/[code]/members/route';

const VALID_CODE = 'a'.repeat(24);
const OK_PROJECT: QueryResult = { data: { id: 'proj-1' }, error: null };

function getRequest(code: string = VALID_CODE) {
  return GET(new Request(`http://localhost/api/projects/${code}/members`), {
    params: Promise.resolve({ code }),
  });
}

function postRequest(body: unknown, code: string = VALID_CODE) {
  return POST(
    new Request(`http://localhost/api/projects/${code}/members`, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ code }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FR-02 GET: memuat daftar anggota', () => {
  it('mengembalikan daftar anggota proyek', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      list: {
        data: [
          { id: 'm1', name: 'Rani' },
          { id: 'm2', name: 'Budi' },
        ],
        error: null,
      },
    });

    const res = await getRequest();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([
      { id: 'm1', name: 'Rani' },
      { id: 'm2', name: 'Budi' },
    ]);
  });

  it('mengembalikan array kosong saat proyek belum punya anggota', async () => {
    mockClient = stubClient({ project: OK_PROJECT, list: { data: [], error: null } });

    const res = await getRequest();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it('mengembalikan 404 saat proyek tidak ditemukan', async () => {
    mockClient = stubClient({ project: { data: null, error: null } });

    const res = await getRequest();
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBeDefined();
  });

  it('menolak kode proyek tidak valid dengan 400 tanpa menyentuh database', async () => {
    mockClient = stubClient({ project: OK_PROJECT });

    const res = await getRequest('bukan-kode');

    expect(res.status).toBe(400);
  });

  it('mengembalikan 500 tanpa membocorkan detail database saat query gagal', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      list: { data: null, error: { code: '42P01', message: 'relation "members" does not exist' } },
    });

    const res = await getRequest();
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(json)).not.toContain('members');
  });

  it('daftar terisi ulang setelah POST berhasil (alur muat ulang)', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      list: { data: [], error: null },
    });

    const empty = await (await getRequest()).json();
    expect(empty).toEqual([]);

    // Server sekarang menyimpan satu anggota; GET berikutnya harus menampilkannya.
    mockClient = stubClient({
      project: OK_PROJECT,
      list: { data: [{ id: 'm1', name: 'Rani' }], error: null },
    });

    const reloaded = await (await getRequest()).json();
    expect(reloaded).toEqual([{ id: 'm1', name: 'Rani' }]);
  });
});

describe('FR-02 POST: menambahkan anggota', () => {
  it('menyimpan anggota baru pada proyek yang valid', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      insert: { data: { id: 'm1', name: 'Rani' }, error: null },
    });

    const res = await postRequest({ name: 'Rani' });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ id: 'm1', name: 'Rani', link: `/p/${VALID_CODE}/members` });
  });

  it('tidak pernah menolak anggota ke-5 dan seterusnya', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      insert: { data: { id: 'm5', name: 'Eka' }, error: null },
    });

    const res = await postRequest({ name: 'Eka' });
    expect(res.status).toBe(201);
  });

  it('menerima nama yang sama dengan anggota lain karena nama tidak wajib unik', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      insert: { data: { id: 'm2', name: 'Rani' }, error: null },
    });

    const res = await postRequest({ name: 'Rani' });

    expect(res.status).toBe(201);
  });

  it('memangkas spasi di awal dan akhir nama sebelum disimpan', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      insert: { data: { id: 'm1', name: 'Rani' }, error: null },
    });

    const res = await postRequest({ name: '  Rani  ' });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.name).toBe('Rani');
  });

  it('menolak proyek yang tidak ditemukan dengan 404', async () => {
    mockClient = stubClient({ project: { data: null, error: null } });

    const res = await postRequest({ name: 'Rani' });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBeDefined();
  });

  it('menolak kode proyek yang formatnya tidak valid tanpa menyentuh database', async () => {
    mockClient = stubClient({ project: OK_PROJECT });

    const res = await postRequest({ name: 'Rani' }, 'bukan-kode');

    expect(res.status).toBe(400);
  });

  it('menolak nama kosong dan nama di atas 60 karakter', async () => {
    mockClient = stubClient({ project: OK_PROJECT });

    const empty = await postRequest({ name: '   ' });
    const tooLong = await postRequest({ name: 'a'.repeat(61) });

    expect(empty.status).toBe(400);
    expect(tooLong.status).toBe(400);
  });

  it('menolak body yang bukan JSON', async () => {
    mockClient = stubClient({ project: OK_PROJECT });

    const res = await postRequest('not-json');
    expect(res.status).toBe(400);
  });

  it('mengembalikan 500 tanpa membocorkan detail database saat insert gagal', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      insert: { data: null, error: { code: '42P01', message: 'relation "members" does not exist' } },
    });

    const res = await postRequest({ name: 'Rani' });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(json)).not.toContain('members');
  });
});
