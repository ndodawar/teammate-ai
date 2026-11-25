import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AiRun,
  CallBudgetExceededError,
  MAX_GEMINI_CALLS_PER_PROCESS,
  sanitizeErrorMessage,
} from '@/lib/ai/call-budget';
import { explainAssignments } from '@/lib/ai/explain';
import { globalAssign } from '@/lib/scoring/assign';
import { DEFAULT_WEIGHTS, FALLBACK_WEIGHTS } from '@/lib/scoring/constants';
import type { Member, Task } from '@/lib/scoring/types';

/*
 * MASTER-MATRIX-HARDENING-01, FASE 4: lapisan AI dan jalur cadangan.
 *
 * Batasan yang dipatok:
 *   - maksimal 3 panggilan Gemini per proses (PRD 6.1 / NFR-06);
 *   - mode cadangan TIDAK memanggil AI sama sekali (FR-13), dan bobotnya 0/50/33/17;
 *   - kegagalan AI tidak pernah menggagalkan rekomendasi, hanya menurunkan mutunya;
 *   - API key tidak pernah bocor ke pesan galat atau log.
 *
 * SELURUH provider dimock. Tidak ada panggilan jaringan sungguhan di berkas ini,
 * dan tidak ada API key yang dibutuhkan untuk menjalankannya.
 */

vi.mock('@/lib/ai/groq', () => ({
  callGroq: vi.fn(),
}));

function member(id: string, over: Partial<Member> = {}): Member {
  return {
    id,
    name: id.toUpperCase(),
    capacity: 40,
    skills: { koordinasi: 5 },
    interests: { koordinasi: 5 },
    ...over,
  };
}

function task(id: string, hours: number): Task {
  return {
    id,
    title: `Tugas ${id}`,
    difficulty: 3,
    estimated_hours: hours,
    required_skills: ['koordinasi'],
  };
}

describe('FASE 4 — anggaran panggilan Gemini', () => {
  it('menetapkan batas 3 panggilan per proses sesuai PRD', () => {
    expect(MAX_GEMINI_CALLS_PER_PROCESS).toBe(3);
  });

  it('mengizinkan tepat 3 panggilan dan menolak panggilan keempat', async () => {
    /*
     * Dibuktikan dengan memanggil 3 kali lalu keempat: penjaga harus melempar
     * SEBELUM fungsi provider dijalankan, jadi `fn` keempat tidak pernah dipanggil.
     */
    const run = new AiRun('proj-1');
    const fn = vi.fn(async () => 'ok');

    await run.track('analysis', 'gemini-2.0-flash', undefined, fn);
    await run.track('embedding', 'gemini-embedding-001', undefined, fn);
    await run.track('explanation', 'gemini-2.0-flash', undefined, fn);

    expect(run.callCount).toBe(3);
    expect(run.remaining).toBe(0);
    expect(fn).toHaveBeenCalledTimes(3);

    await expect(run.track('explanation', 'gemini-2.0-flash', undefined, fn)).rejects.toBeInstanceOf(
      CallBudgetExceededError
    );
    // Bukti bahwa panggilan keempat tidak pernah sampai ke jaringan.
    expect(fn).toHaveBeenCalledTimes(3);
    expect(run.callCount).toBe(3);
  });

  it('tetap menghitung panggilan yang gagal, karena permintaannya sudah terkirim', async () => {
    const run = new AiRun('proj-1');
    const explode = vi.fn(async () => {
      throw new Error('provider down');
    });

    await expect(run.track('analysis', 'm', undefined, explode)).rejects.toThrow('provider down');
    expect(run.callCount).toBe(1);
    expect(run.remaining).toBe(2);
  });

  it('menolak setiap panggilan keempat, berapa kali pun dicoba', async () => {
    const run = new AiRun('proj-1');
    const fn = vi.fn(async () => 1);
    for (let i = 0; i < 3; i++) await run.track('embedding', 'm', undefined, fn);

    for (let i = 0; i < 3; i++) {
      await expect(run.track('embedding', 'm', undefined, fn)).rejects.toBeInstanceOf(
        CallBudgetExceededError
      );
    }
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('membekukan ringkasan sehingga panggilan setelahnya tidak mengubah baris yang sudah ditulis', () => {
    const run = new AiRun('proj-1');
    const summary = run.finish('success');
    expect(summary).not.toBeNull();
    expect(summary!.callCount).toBe(0);
    // Panggilan kedua ke finish mengembalikan null: baris tidak boleh ditulis dua kali.
    expect(run.finish('success')).toBeNull();
  });
});

describe('FASE 4 — kunci API tidak bocor', () => {
  it('menyamarkan bentuk kunci Gemini, parameter key, dan api_key', () => {
    expect(sanitizeErrorMessage(new Error('failed for AIzaSyD1234567890abcdefg'))).toContain(
      '[REDACTED]'
    );
    expect(sanitizeErrorMessage(new Error('GET https://x.test/v1?key=abc123&model=y'))).toContain(
      '[REDACTED]'
    );
    expect(sanitizeErrorMessage(new Error('bad api_key: supersecret'))).toContain('[REDACTED]');
  });

  it('tidak menyamarkan pesan biasa yang tidak memuat kunci', () => {
    const message = 'Kuota harian habis, coba lagi besok.';
    expect(sanitizeErrorMessage(new Error(message))).toBe(message);
  });

  it('memotong pesan sangat panjang agar log dan kolom DB tidak meluap', () => {
    const long = 'x'.repeat(5000);
    expect(sanitizeErrorMessage(new Error(long)).length).toBe(500);
  });
});

describe('FASE 4 — mode cadangan tidak memanggil AI sama sekali', () => {
  const tasks = [task('t1', 1), task('t2', 1)];
  const members = [member('a'), member('b')];
  const result = globalAssign(tasks, members, [], {
    weights: FALLBACK_WEIGHTS,
    isFallback: true,
    cosineMap: { t1: { a: 0.9, b: 0.2 }, t2: { a: 0.2, b: 0.9 } },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('memakai bobot cadangan 0/50/33/17', () => {
    expect(FALLBACK_WEIGHTS).toEqual({ K: 0, S: 0.5, C: 0.33, M: 0.17 });
    expect(DEFAULT_WEIGHTS).toEqual({ K: 0.4, S: 0.3, C: 0.2, M: 0.1 });
  });

  it('menghasilkan alasan berbasis templat tanpa satu pun panggilan provider', async () => {
    /*
     * Bukti kembar: (1) tidak ada panggilan provider, (2) setiap tugas tetap
     * mendapat alasan yang bisa dibaca pengguna. Mode cadangan tidak boleh
     * menghasilkan penugasan tanpa penjelasan.
     */
    const run = new AiRun('proj-1');
    const explained = await explainAssignments({
      tasks,
      members,
      result,
      isFallback: true,
      run,
    });

    expect(run.callCount).toBe(0);
    // `reason` hidup per sel (taskId:memberId), bukan per tugas; itu bentuk yang
    // dipakai UI untuk menjelaskan tiap kandidat.
    for (const assignment of explained.assignments) {
      const cells = Object.values(assignment.scores);
      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) {
        expect(typeof cell.reason).toBe('string');
        expect(cell.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it('K sama sekali tidak berpengaruh pada skor cadangan', async () => {
    /*
     * Manual: bobot K = 0, jadi mengubah cosine ekstrem tidak boleh menggeser
     * total. Kalau bergeser, mode cadangan masih memakai embedding dan
     * klaim "tanpa AI" di atas akan bohong.
     */
    const lowK = globalAssign(tasks, members, [], {
      weights: FALLBACK_WEIGHTS,
      isFallback: true,
      cosineMap: { t1: { a: 0, b: 0 }, t2: { a: 0, b: 0 } },
    });
    const highK = globalAssign(tasks, members, [], {
      weights: FALLBACK_WEIGHTS,
      isFallback: true,
      cosineMap: { t1: { a: 1, b: 1 }, t2: { a: 1, b: 1 } },
    });

    const totals = (r: typeof lowK) =>
      r.assignments.map((a) => Object.values(a.scores).map((s) => s.breakdown.total));
    expect(totals(highK)).toEqual(totals(lowK));
    // Dan K memang 0 di setiap sel.
    for (const a of lowK.assignments) {
      for (const cell of Object.values(a.scores)) expect(cell.breakdown.K).toBe(0);
    }
  });
});

describe('FASE 4 — kegagalan AI menurunkan mutu, bukan menggagalkan rekomendasi', () => {
  const tasks = [task('t1', 1)];
  const members = [member('a')];
  const result = globalAssign(tasks, members, [], {
    weights: DEFAULT_WEIGHTS,
    cosineMap: { t1: { a: 0.6 } },
  });

  it('tetap mengembalikan penugasan dan alasan ketika anggaran sudah habis', async () => {
    /*
     * Anggaran dihabiskan lebih dulu, lalu explainAssignments dipanggil. Ia
     * harus kembali dengan templat, bukan melempar, karena satu penjelasan yang
     * gagal tidak boleh membatalkan seluruh rekomendasi.
     */
    const run = new AiRun('proj-1');
    const noop = async () => 1;
    for (let i = 0; i < MAX_GEMINI_CALLS_PER_PROCESS; i++) {
      await run.track('embedding', 'm', undefined, noop);
    }

    const explained = await explainAssignments({ tasks, members, result, isFallback: false, run });
    expect(explained.assignments).toHaveLength(1);
    expect(explained.assignments[0].primaryMemberId).toBe('a');
    // Alasan tetap ada untuk sel pemenang, dari templat.
    expect(explained.assignments[0].scores['a'].reason).toBeTruthy();
    // Anggaran tidak dilanggar: tetap 3, tidak ada panggilan keempat.
    expect(run.callCount).toBe(3);
  });

  it('penugasan tetap sama dengan atau tanpa penjelasan AI', async () => {
    /*
     * Penjelasan hanya menambahkan kalimat; ia tidak boleh mengubah siapa
     * mengerjakan apa. Ini menjaga agar kegagalan AI tidak menggeser matriks.
     */
    const run = new AiRun('proj-1');
    const explained = await explainAssignments({ tasks, members, result, isFallback: true, run });

    expect(explained.assignments.map((a) => a.primaryMemberId)).toEqual(
      result.assignments.map((a) => a.primaryMemberId)
    );
    expect(explained.memberLoads).toEqual(result.memberLoads);
  });
});

describe('FASE 4 — interaksi lokal tidak memanggil AI', () => {
  it('perhitungan ulang slider, tukar, dan kunci murni lokal', async () => {
    /*
     * Klien memakai `globalAssign` yang sama persis untuk slider/tukar/kunci,
     * dan fungsi itu tidak mengimpor apa pun dari lib/ai. Tes ini membuktikan
     * klaim tersebut dengan menjalankannya sambil memastikan modul AI tidak
     * pernah tersentuh: tidak ada `fetch` global yang terpanggil.
     */
    const fetchSpy = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    try {
      const tasks = [task('t1', 1), task('t2', 1)];
      const members = [member('a'), member('b')];
      const cosineMap = { t1: { a: 0.6, b: 0.6 }, t2: { a: 0.6, b: 0.6 } };

      // Meniru slider: setiap nilai bobot menghitung ulang secara lokal.
      for (const S of [0.3, 0.5, 0.7]) {
        globalAssign(tasks, members, [], {
          weights: { K: 1 - S - 0.2 - 0.1, S, C: 0.2, M: 0.1 },
          cosineMap,
        });
      }

      // Meniru kunci dan tukar: penugasan masuk sebagai `existingAssignments`.
      globalAssign(tasks, members, [{ taskId: 't1', primaryMemberId: 'a', isLocked: true, scores: {} }], {
        cosineMap,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('globalAssign tidak mengimpor modul AI', async () => {
    /*
     * Pemeriksaan struktur, bukan sekadar perilaku: bila suatu saat seseorang
     * menambahkan impor dari lib/ai ke assign.ts, tes ini gagal dan klaim
     * "interaksi lokal tanpa AI" tidak lagi diam-diam menjadi salah.
     */
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('lib/scoring/assign.ts', 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*lib\/ai/);
    expect(source).not.toMatch(/from\s+['"]@\/lib\/ai/);
  });
});
