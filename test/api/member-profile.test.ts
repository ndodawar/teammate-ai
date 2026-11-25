import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SECRET_KEY ??= 'test-key';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function stubClient(options: {
  project?: QueryResult;
  member?: QueryResult;
  skills?: QueryResult;
  rpc?: QueryResult;
}) {
  return {
    from: (table: string) => {
      if (table === 'projects') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => options.project }) }),
        };
      }
      if (table === 'members') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => options.member }) }),
        };
      }
      if (table === 'member_skills') {
        return {
          select: () => ({ eq: async () => options.skills }),
        };
      }
      return {};
    },
    rpc: async (_fn: string, _args: unknown) => {
      return options.rpc ?? { data: null, error: null };
    },
  };
}

let mockClient: ReturnType<typeof stubClient>;

vi.mock('@/lib/db/project', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/project')>();
  return { ...actual, getSupabaseClient: () => mockClient };
});

import { GET, PUT } from '@/app/api/projects/[code]/members/[id]/route';

const VALID_CODE = 'a'.repeat(24);
const MEMBER_ID = 'm1';
const OK_PROJECT = { data: { id: 'proj-1' }, error: null };
const OK_MEMBER = { data: { id: MEMBER_ID, project_id: 'proj-1', name: 'Rani', capacity: 40, note: null }, error: null };

function getRequest(id: string = MEMBER_ID) {
  return GET(new Request(`http://localhost/api/projects/${VALID_CODE}/members/${id}`), {
    params: Promise.resolve({ code: VALID_CODE, id }),
  });
}

function putRequest(body: unknown, id: string = MEMBER_ID) {
  return PUT(
    new Request(`http://localhost/api/projects/${VALID_CODE}/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ code: VALID_CODE, id }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FR-03 Profil Anggota API', () => {
  it('GET: membaca profil anggota valid', async () => {
    mockClient = stubClient({
      project: OK_PROJECT,
      member: OK_MEMBER,
      skills: { data: [{ id: 's1', skill_name: 'Frontend', skill_level: 4, interest_level: 5 }], error: null },
    });

    const res = await getRequest();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.name).toBe('Rani');
    expect(json.skills).toHaveLength(1);
  });

  it('PUT: memperbarui profil anggota valid', async () => {
    const updatedData = {
      id: MEMBER_ID,
      name: 'Rani Baru',
      capacity: 30,
      note: 'Hi',
      skills: [{ id: 's2', skill_name: 'Backend', skill_level: 3, interest_level: 4 }],
    };

    mockClient = stubClient({
      rpc: { data: updatedData, error: null },
    });

    const body = {
      name: 'Rani Baru',
      capacity: 30,
      note: 'Hi',
      skills: [{ skill_name: 'Backend', skill_level: 3, interest_level: 4 }],
    };

    const res = await putRequest(body);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.name).toBe('Rani Baru');
    expect(json.skills[0].skill_name).toBe('Backend');
  });

  it('PUT: menangani error RPC anggota tidak ditemukan', async () => {
    mockClient = stubClient({
      rpc: { data: null, error: { message: 'Anggota tidak ditemukan' } },
    });

    const res = await putRequest({ name: 'Rani', capacity: 40, skills: [] });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain('tidak ditemukan');
  });

  it('PUT: menolak kapasitas tidak valid', async () => {
    mockClient = stubClient({ project: OK_PROJECT, member: OK_MEMBER });
    const res = await putRequest({ name: 'Rani', capacity: 0, skills: [] });
    expect(res.status).toBe(400);
    // H1-03: penolakan sama, tetapi pesannya kini bahasa Indonesia.
    const json = await res.json();
    expect(json.error).toBe('Data profil anggota tidak valid.');
  });

  it('PUT: menolak skill duplikat tanpa menyimpan apa pun', async () => {
    mockClient = stubClient({ project: OK_PROJECT, member: OK_MEMBER });
    const rpcSpy = vi.spyOn(mockClient, 'rpc');

    const res = await putRequest({
      name: 'Rani',
      capacity: 40,
      skills: [
        { skill_name: 'koordinasi', skill_level: 3, interest_level: 3 },
        { skill_name: 'KOORDINASI', skill_level: 4, interest_level: 3 },
      ],
    });

    expect(res.status).toBe(400);
    // RPC tidak pernah dipanggil, jadi tidak ada data setengah tersimpan.
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('PUT: menyimpan skill di luar taksonomi dan mengembalikan peringatan', async () => {
    const updatedData = {
      id: MEMBER_ID,
      name: 'Rani',
      capacity: 40,
      note: null,
      skills: [{ id: 's3', skill_name: 'Python', skill_level: 5, interest_level: 5 }],
    };
    mockClient = stubClient({ rpc: { data: updatedData, error: null } });

    const res = await putRequest({
      name: 'Rani',
      capacity: 40,
      skills: [{ skill_name: 'Python', skill_level: 5, interest_level: 5 }],
    });

    // H1-02 / K-1(b): penyimpanan tetap berhasil (200), bukan ditolak.
    expect(res.status).toBe(200);
    const json = await res.json();
    // Data profil tetap di akar respons, seperti sebelumnya.
    expect(json.name).toBe('Rani');
    expect(json.skills[0].skill_name).toBe('Python');
    // Dan peringatan ikut, tanpa membatalkan simpan.
    expect(Array.isArray(json.warnings)).toBe(true);
    expect(json.warnings).toHaveLength(1);
    expect(json.warnings[0]).toContain('"Python"');
  });

  it('PUT: tidak mengirim field warnings ketika semua skill ada di taksonomi', async () => {
    const updatedData = {
      id: MEMBER_ID,
      name: 'Rani',
      capacity: 40,
      note: null,
      skills: [{ id: 's4', skill_name: 'koordinasi', skill_level: 3, interest_level: 3 }],
    };
    mockClient = stubClient({ rpc: { data: updatedData, error: null } });

    const res = await putRequest({
      name: 'Rani',
      capacity: 40,
      skills: [{ skill_name: 'koordinasi', skill_level: 3, interest_level: 3 }],
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    // Bentuk respons lama dipertahankan persis ketika tidak ada peringatan.
    expect(json.warnings).toBeUndefined();
    expect(json.name).toBe('Rani');
  });
});
