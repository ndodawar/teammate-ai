import { describe, it, expect, vi } from 'vitest';
import {
  hashContent,
  parseEmbedding,
  isValidEmbeddingValues,
  serializeEmbedding,
  EMBEDDING_DIMENSION,
} from '@/lib/ai/embedding-cache';
import { globalAssign } from '@/lib/scoring/assign';
import { AiRun } from '@/lib/ai/call-budget';
import type { Member, Task } from '@/lib/scoring/types';

/*
 * MASTER-MATRIX-HARDENING-01, FASE 5: integritas sinkronisasi dan invalidasi cache.
 */

/*
 * `computeTaskMemberCosineMap` memanggil `embedTexts` dari
 * `lib/ai/analyze-task`. Modul itu yang dimock, bukan fungsinya yang ditambahi
 * parameter — supaya tes memakai signature nyata dan tidak mengarang opsi yang
 * tidak ada.
 */
const embedTextsMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai/analyze-task', () => ({ embedTexts: embedTextsMock }));

import { computeTaskMemberCosineMap, formatTaskText, formatMemberText } from '@/lib/scoring/pipeline';

const dim = (value: number) => new Array(EMBEDDING_DIMENSION).fill(value);

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

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    title: `Tugas ${id}`,
    difficulty: 3,
    estimated_hours: 1,
    required_skills: ['koordinasi'],
    ...over,
  };
}

describe('FASE 5 — kunci cache membatalkan entri lama secara otomatis', () => {
  it('teks yang berubah menghasilkan kunci berbeda, sehingga tidak ada vektor basi', () => {
    // Inilah mekanisme invalidasi: tidak ada TTL, tidak ada purge. Kunci berubah
    // berarti entri lama tidak pernah ditemukan lagi.
    const before = hashContent('model:Menulis bab 2');
    const after = hashContent('model:Menulis bab 3');
    expect(before).not.toBe(after);
  });

  it('perubahan sekecil apa pun pada teks tetap membatalkan entri', () => {
    // Spasi tunggal pun harus menghasilkan kunci baru: dua teks berbeda tidak
    // boleh berbagi vektor hanya karena "mirip".
    expect(hashContent('model:Tugas A')).not.toBe(hashContent('model:Tugas  A'));
    expect(hashContent('model:tugas a')).not.toBe(hashContent('model:Tugas A'));
    expect(hashContent('model:koordinasi')).not.toBe(hashContent('model:koordinasi '));
  });

  it('model berbeda tidak pernah berbagi baris cache', () => {
    // Vektor dari model berbeda tidak sebanding. Kalau kunci tidak memuat model,
    // mengganti model akan menyajikan vektor lama dan skor K menjadi bohong.
    expect(hashContent('gemini-embedding-001:teks')).not.toBe(hashContent('text-embedding-004:teks'));
  });

  it('kunci adalah sha256 heksadesimal yang stabil', () => {
    const key = hashContent('model:teks');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(hashContent('model:teks')).toBe(key);
  });
});

describe('FASE 5 — baris cache rusak dianggap cache miss', () => {
  it('menolak dimensi salah', () => {
    expect(parseEmbedding(serializeEmbedding(dim(0.1).slice(0, 10)))).toBeNull();
  });

  it('menolak nilai NaN dan Infinity yang tidak boleh ada di kolom', () => {
    const withNaN = [...dim(0.1)];
    withNaN[5] = NaN;
    expect(parseEmbedding(`[${withNaN.join(',')}]`)).toBeNull();

    const withInf = [...dim(0.1)];
    withInf[7] = Infinity;
    expect(parseEmbedding(`[${withInf.join(',')}]`)).toBeNull();
  });

  it('menolak literal kosong atau cacat, bukan mengembalikan larik nol', () => {
    for (const bad of ['[]', '[ ]', '', 'not-a-vector', '[1,2,', null, undefined, 42, {}]) {
      expect(parseEmbedding(bad)).toBeNull();
    }
  });

  it('menerima literal pgvector yang sah dan bolak-balik tanpa pergeseran', () => {
    const vec = dim(0.123456);
    const text = serializeEmbedding(vec);
    expect(text.startsWith('[') && text.endsWith(']')).toBe(true);
    const back = parseEmbedding(text);
    expect(back).not.toBeNull();
    expect(isValidEmbeddingValues(back)).toBe(true);
    // Toleransi float4: serialisasi memotong ke 6 desimal.
    for (let i = 0; i < vec.length; i++) expect(Math.abs(back![i] - vec[i])).toBeLessThan(1e-5);
  });
});

describe('FASE 5 — teks yang di-embed mencerminkan seluruh input', () => {
  it('teks tugas memuat judul, deskripsi, dan skill wajib', () => {
    const t = task('t1', {
      title: 'Menyusun Bab 2',
      description: 'Tinjauan pustaka',
      required_skills: ['koordinasi', 'presentasi'],
    });
    const text = formatTaskText(t);

    expect(text).toContain('Menyusun Bab 2');
    expect(text).toContain('Tinjauan pustaka');
    expect(text).toContain('koordinasi');
    expect(text).toContain('presentasi');
  });

  it('dua tugas yang hanya berbeda deskripsi menghasilkan teks berbeda', () => {
    /*
     * Kalau deskripsi tidak masuk ke teks embedding, dua tugas berbeda bisa
     * mendapat vektor identik dan peringkat K di antara keduanya menjadi acak.
     */
    const a = task('t1', { title: 'Sama', description: 'Bagian A' });
    const b = task('t1', { title: 'Sama', description: 'Bagian B' });
    expect(formatTaskText(a)).not.toBe(formatTaskText(b));
    expect(hashContent(formatTaskText(a))).not.toBe(hashContent(formatTaskText(b)));
  });

  it('teks anggota memuat level skill dan minat', () => {
    const m = member('a', {
      skills: { koordinasi: 5, presentasi: 3 },
      interests: { koordinasi: 4, presentasi: 2 },
    });
    const text = formatMemberText(m);

    expect(text).toContain('koordinasi');
    expect(text).toContain('5');
    expect(text).toContain('presentasi');
    expect(text).toContain('3');
    // Minat juga, karena M memakai minat dan profil tanpa minat menyesatkan K.
    expect(text.toLowerCase()).toContain('minat');
  });

  it('perubahan level skill membatalkan kunci embedding anggota', () => {
    // Konsekuensi penting: menaikkan level skill harus mengubah teks profil,
    // sehingga vektor lama tidak dipakai ulang untuk profil yang baru.
    const low = member('a', { skills: { koordinasi: 2 } });
    const high = member('a', { skills: { koordinasi: 5 } });
    expect(hashContent(formatMemberText(low))).not.toBe(hashContent(formatMemberText(high)));
  });
});

describe('FASE 5 — peta cosine konsisten dengan anggaran panggilan', () => {
  it('tidak ada pasangan yang hilang ketika semua embedding tersedia', async () => {
    /*
     * `embedTexts` dimock supaya tidak ada panggilan jaringan, dan peta harus
     * berisi perkalian jumlah tugas x anggota, tanpa lubang.
     */
    const tasks = [task('t1'), task('t2')];
    const members = [member('a'), member('b'), member('c')];
    const run = new AiRun('proj-1');
    embedTextsMock.mockResolvedValue([dim(0.05), dim(0.05), dim(0.05), dim(0.05), dim(0.05)]);

    const { cosineMap, isEmbeddingFailed } = await computeTaskMemberCosineMap(tasks, members, run);

    expect(isEmbeddingFailed).toBe(false);
    for (const t of tasks) {
      for (const m of members) {
        expect(typeof cosineMap[t.id][m.id]).toBe('number');
        expect(Number.isFinite(cosineMap[t.id][m.id])).toBe(true);
      }
    }
    // Vektor identik -> cosine 1 (bukan 0, bukan NaN).
    expect(cosineMap['t1']['a']).toBeCloseTo(1, 10);
  });

  it('satu embedding yang gagal menandai fallback, bukan diam-diam memakai 0', async () => {
    /*
     * Perbedaan penting: nilai 0 yang dikarang akan tampak seperti "tidak mirip
     * sama sekali" dan merusak peringkat tanpa jejak. Sistem harus menyatakan
     * gagal (isEmbeddingFailed) agar rute menurunkan mode ke cadangan.
     */
    const tasks = [task('t1')];
    const members = [member('a')];
    const run = new AiRun('proj-1');
    // Tugas punya vektor, anggota tidak.
    embedTextsMock.mockResolvedValue([dim(0.05), null]);

    const { isEmbeddingFailed, failedPairs, cosineMap } = await computeTaskMemberCosineMap(
      tasks,
      members,
      run
    );

    expect(isEmbeddingFailed).toBe(true);
    expect(failedPairs).toContain('t1:a');
    // Dan tidak ada nilai karangan yang ditinggalkan di peta.
    expect(cosineMap['t1']['a']).toBeUndefined();
  });
});

describe('FASE 5 — hasil tidak basi setelah komposisi tugas berubah', () => {
  it('menghapus satu tugas mengubah beban ideal dan pembagian berikutnya', () => {
    /*
     * Manual: 2 anggota, 2 tugas x 1 jam -> ideal 1, batas 1,25, keduanya muat.
     * Setelah satu tugas dihapus: total 1 jam, ideal 0,5, batas 0,625. Tugas
     * 1 jam > 0,625, jadi tugas yang tersisa TIDAK bisa dipasang.
     *
     * Ini membuktikan hasil lama tidak boleh dipakai ulang setelah edit: angka
     * ideal load berubah, sehingga kesimpulan "boleh" bisa berubah menjadi
     * "tidak boleh" tanpa satu pun skor komponen berubah.
     */
    const members = [member('a'), member('b')];
    const cosineMap = { t1: { a: 0.6, b: 0.6 }, t2: { a: 0.6, b: 0.6 } };

    const before = globalAssign([task('t1'), task('t2')], members, [], { cosineMap });
    expect(before.idealLoad).toBe(1);
    expect(before.assignments.every((x) => x.primaryMemberId !== '')).toBe(true);

    const after = globalAssign([task('t1')], members, [], { cosineMap });
    expect(after.idealLoad).toBe(0.5);
    expect(after.assignments[0].primaryMemberId).toBe('');
    expect(after.warnings.some((w) => w.code === 'r2_no_candidate')).toBe(true);
  });

  it('menambah anggota mengurangi beban ideal dan mempersempit batas R2', () => {
    /*
     * Manual: 3 tugas x 1 jam.
     *   2 anggota -> ideal 1,5, batas 1,875. Satu anggota hanya bisa menerima
     *   SATU tugas (2 jam > 1,875), jadi hanya 2 dari 3 tugas terpasang.
     *   4 anggota -> ideal 0,75, batas 0,9375 -> tugas 1 jam tidak muat sama
     *   sekali, jadi tidak ada yang terpasang.
     *
     * (Versi pertama tes ini mengharapkan 3 tugas terpasang pada 2 anggota. Itu
     * salah: 2 jam melampaui batas 1,875. Mesinnya benar.)
     *
     * Menambah orang bisa mempersulit, dan itu konsekuensi rumus yang benar,
     * bukan bug: beban ideal adalah rata-rata, bukan kuota per orang.
     */
    const tasks = [task('t1'), task('t2'), task('t3')];
    const cosineMap = {
      t1: { a: 0.6, b: 0.6, c: 0.6, d: 0.6 },
      t2: { a: 0.6, b: 0.6, c: 0.6, d: 0.6 },
      t3: { a: 0.6, b: 0.6, c: 0.6, d: 0.6 },
    };

    const two = globalAssign(tasks, [member('a'), member('b')], [], { cosineMap });
    expect(two.idealLoad).toBe(1.5);
    expect(two.assignments.filter((x) => x.primaryMemberId !== '')).toHaveLength(2);

    const four = globalAssign(
      tasks,
      [member('a'), member('b'), member('c'), member('d')],
      [],
      { cosineMap }
    );
    expect(four.idealLoad).toBe(0.75);
    expect(four.assignments.every((x) => x.primaryMemberId === '')).toBe(true);
  });

  it('mengubah jam tugas mengubah batas, jadi penugasan lama tidak otomatis sah', () => {
    /*
     * Manual: 2 anggota, 1 tugas 1 jam -> ideal 0,5, batas 0,625: tidak muat.
     * Dengan 4 anggota dan 4 tugas x 1 jam -> ideal 1, batas 1,25: muat.
     * Kesimpulannya: kelayakan bergantung pada komposisi terkini, dan mesin
     * selalu menghitung ulang dari angka terbaru.
     */
    const tasks4 = [task('t1'), task('t2'), task('t3'), task('t4')];
    const cosineMap = {
      t1: { a: 0.6, b: 0.6, c: 0.6, d: 0.6 },
      t2: { a: 0.6, b: 0.6, c: 0.6, d: 0.6 },
      t3: { a: 0.6, b: 0.6, c: 0.6, d: 0.6 },
      t4: { a: 0.6, b: 0.6, c: 0.6, d: 0.6 },
    };

    // Peta cosine HARUS cocok dengan roster yang dipakai, kalau tidak mesin
    // melempar "Embedding missing" — dan itu perilaku yang benar.
    const small = globalAssign([task('t1', { estimated_hours: 1 })], [member('a'), member('b')], [], {
      cosineMap: { t1: { a: 0.6, b: 0.6 } },
    });
    expect(small.idealLoad).toBe(0.5);
    expect(small.assignments[0].primaryMemberId).toBe('');

    const big = globalAssign(
      tasks4,
      [member('a'), member('b'), member('c'), member('d')],
      [],
      { cosineMap }
    );
    expect(big.idealLoad).toBe(1);
    expect(big.assignments.filter((x) => x.primaryMemberId !== '')).toHaveLength(4);
  });
});
