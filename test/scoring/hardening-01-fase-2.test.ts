import { describe, it, expect } from 'vitest';
import {
  normalizeCosineSimilarity,
  computeSkillMatch,
  computeCapacity,
  computeInterest,
  computeScore,
} from '@/lib/scoring/score';
import { DEFAULT_WEIGHTS, FALLBACK_WEIGHTS, DEFAULT_INTEREST_LEVEL } from '@/lib/scoring/constants';
import type { Member, Task } from '@/lib/scoring/types';

/*
 * MASTER-MATRIX-HARDENING-01, FASE 2: audit mesin skor.
 *
 * Acuan: PRD v0.3 FR-07 dan rumus komponen K, S, C, M.
 *
 *   Score = 0.40K + 0.30S + 0.20C + 0.10M
 *   K = clamp((cosine - 0.2) / 0.6, 0, 1)
 *   S = rata-rata level skill wajib / 5
 *   C = 1 - (Current Load + Task Effort) / Load Limit
 *   M = (rata-rata minat skill wajib - 1) / 4
 *
 * Setiap angka harapan di bawah dihitung manual di komentar di sampingnya.
 * Tidak ada rumus yang diubah di fase ini: tes ini memverifikasi yang sudah ada
 * dan mengunci perilakunya.
 */

function member(over: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    name: 'Ani',
    capacity: 10,
    skills: { pengujian: 5 },
    interests: { pengujian: 5 },
    ...over,
  };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Tugas',
    difficulty: 3,
    estimated_hours: 2,
    required_skills: ['pengujian'],
    ...over,
  };
}

describe('FASE 2 — K (content similarity) sesuai PRD', () => {
  it('menormalkan cosine 0,2 sampai 0,8 menjadi 0 sampai 1', () => {
    // Manual: (c - 0.2) / (0.8 - 0.2) = (c - 0.2) / 0.6
    expect(normalizeCosineSimilarity(0.2)).toBe(0);
    expect(normalizeCosineSimilarity(0.5)).toBeCloseTo(0.5, 10); // (0.5-0.2)/0.6 = 0.5
    expect(normalizeCosineSimilarity(0.8)).toBe(1);
    expect(normalizeCosineSimilarity(0.65)).toBeCloseTo(0.75, 10); // (0.65-0.2)/0.6 = 0.75
  });

  it('menjepit nilai di luar rentang ke 0 atau 1', () => {
    expect(normalizeCosineSimilarity(0.1)).toBe(0);
    expect(normalizeCosineSimilarity(-5)).toBe(0);
    expect(normalizeCosineSimilarity(0.9)).toBe(1);
    expect(normalizeCosineSimilarity(99)).toBe(1);
  });

  it('tidak pernah mengembalikan NaN untuk cosine tak hingga', () => {
    expect(normalizeCosineSimilarity(Number.POSITIVE_INFINITY)).toBe(1);
    expect(normalizeCosineSimilarity(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('memperlakukan cosine NaN sebagai 0, bukan meneruskannya ke skor total', () => {
    /*
     * Sebelum diperbaiki, `K(NaN)` mengembalikan NaN dan `total` ikut NaN
     * karena 0,4 x NaN menyebar ke seluruh penjumlahan. Matriks lalu menampilkan
     * "NaN%" dan setiap perbandingan skor menjadi false, sehingga tugas
     * kehilangan pemiliknya tanpa penjelasan.
     *
     * Jalur produksi saat ini tidak dapat menghasilkan NaN (embedding divalidasi
     * finite sebelum dipakai), jadi ini penjaga pada kontrak fungsi, bukan
     * perbaikan bug yang sedang menggigit pengguna.
     */
    expect(normalizeCosineSimilarity(NaN)).toBe(0);

    const score = computeScore(task(), member(), 0, 4, NaN);
    expect(Number.isFinite(score.K)).toBe(true);
    expect(Number.isFinite(score.total)).toBe(true);
    // K = 0, jadi total = 0.3(1) + 0.2(0.8) + 0.1(1) = 0.56
    // (S=1 karena level 5, C=1-2/10=0.8, M=1 karena minat 5.)
    expect(score.K).toBe(0);
    expect(score.total).toBeCloseTo(0.56, 4);
  });
});

describe('FASE 2 — S (skill match) sesuai PRD', () => {
  it('menghitung rata-rata level skill wajib dibagi 5', () => {
    // Manual: (5 + 3) / 2 = 4, lalu 4 / 5 = 0.8
    const t = task({ required_skills: ['pengujian', 'presentasi'] });
    const m = member({ skills: { pengujian: 5, presentasi: 3 } });
    expect(computeSkillMatch(t, m)).toBeCloseTo(0.8, 10);
  });

  it('memberi 0 untuk skill yang tidak dimiliki, bukan mengarang level', () => {
    // Manual: (5 + 0) / 2 = 2.5, lalu 2.5 / 5 = 0.5
    const t = task({ required_skills: ['pengujian', 'presentasi'] });
    const m = member({ skills: { pengujian: 5 } });
    expect(computeSkillMatch(t, m)).toBeCloseTo(0.5, 10);
  });

  it('mengembalikan 1 untuk tugas tanpa skill wajib', () => {
    // Tugas tanpa syarat skill tidak menghukum anggota; PRD tidak menentukan
    // nilai lain, dan 1 menjaga skor tidak jatuh hanya karena tugas sederhana.
    expect(computeSkillMatch(task({ required_skills: [] }), member())).toBe(1);
  });

  it('konsisten dengan normalisasi nama skill', () => {
    const t = task({ required_skills: ['pengujian'] });
    const m = member({ skills: { '  PENGUJIAN  ': 4 } as Member['skills'] });
    expect(computeSkillMatch(t, m)).toBeCloseTo(0.8, 10); // 4 / 5
  });
});

describe('FASE 2 — C (remaining capacity) sesuai PRD', () => {
  it('memakai rumus C = 1 - (load + effort) / Load Limit', () => {
    /*
     * Manual: (2 + 3) / 7 = 5/7 = 0.714285..., maka C = 1 - 0.714285 = 0.285714.
     * Ini angka yang dipakai contoh penerimaan PRD 8.4 (C = 0.2857).
     */
    const m = member({ capacity: 7 });
    expect(computeCapacity(m, 2, 3)).toBeCloseTo(2 / 7, 10);
  });

  it('memberi 0 ketika sisa beban negatif, tidak pernah negatif', () => {
    // Manual: (4 + 5) / 5 = 1.8, C = 1 - 1.8 = -0.8. Dijepit ke 0 agar skor
    // tidak turun di bawah komponen lain yang sah.
    expect(computeCapacity(member({ capacity: 5 }), 4, 5)).toBe(0);
  });

  it('memberi 0 ketika kapasitas nol, tanpa membagi dengan nol', () => {
    expect(computeCapacity(member({ capacity: 0 }), 0, 1)).toBe(0);
    expect(computeCapacity(member({ capacity: 0 }), 0, 0)).toBe(0);
  });

  it('memberi 1 ketika belum ada beban dan tugas nol jam', () => {
    expect(computeCapacity(member({ capacity: 10 }), 0, 0)).toBe(1);
  });
});

describe('FASE 2 — M (interest) sesuai PRD', () => {
  it('memakai rumus M = (rata-rata minat - 1) / 4', () => {
    // Manual: (4 - 1) / 4 = 0.75
    expect(computeInterest(task(), member({ interests: { pengujian: 4 } }))).toBeCloseTo(0.75, 10);
    // Manual: (5 - 1) / 4 = 1
    expect(computeInterest(task(), member({ interests: { pengujian: 5 } }))).toBe(1);
    // Manual: (1 - 1) / 4 = 0
    expect(computeInterest(task(), member({ interests: { pengujian: 1 } }))).toBe(0);
  });

  it('merata-ratakan minat pada semua skill wajib', () => {
    // Manual: (5 + 1) / 2 = 3, lalu (3 - 1) / 4 = 0.5
    const t = task({ required_skills: ['pengujian', 'presentasi'] });
    const m = member({ interests: { pengujian: 5, presentasi: 1 } });
    expect(computeInterest(t, m)).toBeCloseTo(0.5, 10);
  });

  it('memakai minat default 3 sesuai PRD ketika minat tidak diisi', () => {
    // Manual: minat default 3 -> (3 - 1) / 4 = 0.5
    expect(DEFAULT_INTEREST_LEVEL).toBe(3);
    expect(computeInterest(task(), member({ interests: undefined }))).toBeCloseTo(0.5, 10);
    // Skill wajib yang tidak punya baris minat juga memakai default 3.
    expect(computeInterest(task(), member({ interests: { presentasi: 5 } }))).toBeCloseTo(0.5, 10);
  });

  it('mengembalikan 1 untuk tugas tanpa skill wajib', () => {
    expect(computeInterest(task({ required_skills: [] }), member())).toBe(1);
  });
});

describe('FASE 2 — contoh penerimaan PRD 8.4 dihitung ulang manual', () => {
  /*
   * Tugas "Menyusun Bab 2", 3 jam, skill wajib penulisan akademik + riset
   * literatur. Anggota Ani: keduanya level 5, minat 4, kapasitas 7, beban 2.
   *
   *   K = (0.68 - 0.2) / 0.6 = 0.8
   *   S = (5/5 + 5/5) / 2 = 1.0
   *   C = 1 - (2 + 3) / 7 = 2/7 = 0.285714...
   *   M = (4 - 1) / 4 = 0.75
   *   total = 0.4(0.8) + 0.3(1.0) + 0.2(0.285714) + 0.1(0.75)
   *         = 0.32 + 0.30 + 0.057143 + 0.075 = 0.752143
   */
  const t = task({
    id: 'task-bab-2',
    title: 'Menyusun Bab 2',
    estimated_hours: 3,
    required_skills: ['penulisan akademik', 'riset literatur'],
  });
  const ani = member({
    id: 'ani',
    name: 'Ani',
    capacity: 7,
    skills: { 'penulisan akademik': 5, 'riset literatur': 5 },
    interests: { 'penulisan akademik': 4, 'riset literatur': 4 },
  });

  it('menghasilkan K, S, C, M dan total yang sama dengan hitungan tangan', () => {
    const score = computeScore(t, ani, 2, 4, 0.68);
    expect(score.K).toBeCloseTo(0.8, 4);
    expect(score.S).toBeCloseTo(1.0, 4);
    expect(score.C).toBeCloseTo(0.2857, 4);
    expect(score.M).toBeCloseTo(0.75, 4);
    expect(score.total).toBeCloseTo(0.7521, 4);
  });

  it('menghasilkan angka berbeda untuk kandidat yang lebih lemah', () => {
    /*
     * Budi: penulisan 3, riset 2, minat 3, beban 0, cosine 0.53.
     *   K = (0.53 - 0.2)/0.6 = 0.55
     *   S = (3 + 2)/2/5 = 0.5
     *   C = 1 - (0 + 3)/7 = 4/7 = 0.571429
     *   M = (3 - 1)/4 = 0.5
     *   total = 0.4(0.55)+0.3(0.5)+0.2(0.571429)+0.1(0.5)
     *         = 0.22 + 0.15 + 0.114286 + 0.05 = 0.534286
     */
    const budi = member({
      id: 'budi',
      name: 'Budi',
      capacity: 7,
      skills: { 'penulisan akademik': 3, 'riset literatur': 2 },
      interests: { 'penulisan akademik': 3, 'riset literatur': 3 },
    });
    const score = computeScore(t, budi, 0, 4, 0.53);
    expect(score.K).toBeCloseTo(0.55, 4);
    expect(score.S).toBeCloseTo(0.5, 4);
    expect(score.C).toBeCloseTo(0.5714, 4);
    expect(score.M).toBeCloseTo(0.5, 4);
    expect(score.total).toBeCloseTo(0.5343, 4);
  });

  it('Ani > Budi, sesuai urutan yang diharapkan PRD', () => {
    const budi = member({
      id: 'budi',
      capacity: 7,
      skills: { 'penulisan akademik': 3, 'riset literatur': 2 },
      interests: { 'penulisan akademik': 3, 'riset literatur': 3 },
    });
    expect(computeScore(t, ani, 2, 4, 0.68).total).toBeGreaterThan(
      computeScore(t, budi, 0, 4, 0.53).total
    );
  });
});

describe('FASE 2 — bobot dan mode cadangan sesuai PRD', () => {
  it('memakai bobot awal 40/30/20/10', () => {
    expect(DEFAULT_WEIGHTS).toEqual({ K: 0.4, S: 0.3, C: 0.2, M: 0.1 });
  });

  it('memakai bobot cadangan 0/50/33/17 dengan K dihilangkan', () => {
    expect(FALLBACK_WEIGHTS).toEqual({ K: 0, S: 0.5, C: 0.33, M: 0.17 });
  });

  it('menghilangkan K sepenuhnya dalam mode cadangan', () => {
    /*
     * Manual: S=1, C=0.5, M=0.75 dengan bobot 0/0.5/0.33/0.17:
     *   total = 0 + 0.5(1) + 0.33(0.5) + 0.17(0.75)
     *         = 0.5 + 0.165 + 0.1275 = 0.7925
     * Cosine sengaja diberikan nilai ekstrem untuk membuktikan K tidak dipakai.
     */
    const score = computeScore(task(), member({ capacity: 20, interests: { pengujian: 4 } }), 0, 4, 1, undefined, true);
    expect(score.K).toBe(0);
    expect(score.S).toBe(1);
    expect(score.C).toBeCloseTo(0.9, 10); // 1 - 2/20 = 0.9
    expect(score.M).toBeCloseTo(0.75, 10);
    // total = 0.5(1) + 0.33(0.9) + 0.17(0.75) = 0.5 + 0.297 + 0.1275 = 0.9245
    expect(score.total).toBeCloseTo(0.9245, 4);
  });

  it('menghormati bobot eksplisit, sehingga slider benar-benar berpengaruh', () => {
    /*
     * Manual dengan bobot S saja (0/1/0/0): total = S = 1.
     * Dengan bobot K saja (1/0/0/0) dan cosine 0.5: K = 0.5, total = 0.5.
     */
    const bySkill = computeScore(task(), member(), 0, 4, 0.5, { K: 0, S: 1, C: 0, M: 0 });
    expect(bySkill.total).toBe(1);
    const byContent = computeScore(task(), member(), 0, 4, 0.5, { K: 1, S: 0, C: 0, M: 0 });
    expect(byContent.total).toBeCloseTo(0.5, 10);
  });
});

describe('FASE 2 — skor tidak pernah NaN, Infinity, atau di luar 0..1', () => {
  it('menjaga total dalam 0..1 untuk semua kombinasi masukan yang sah', () => {
    const weights = [DEFAULT_WEIGHTS, FALLBACK_WEIGHTS, { K: 0.1, S: 0.6, C: 0.2, M: 0.1 }];
    const cosines = [0, 0.2, 0.5, 0.8, 1];
    const loads = [0, 1, 5, 100];
    for (const w of weights) {
      for (const c of cosines) {
        for (const load of loads) {
          const score = computeScore(task(), member(), load, 4, c, w);
          for (const key of ['K', 'S', 'C', 'M', 'total'] as const) {
            const value = score[key];
            expect(Number.isFinite(value), `${key} untuk c=${c} load=${load}`).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('F2-01: parameter idealLoad tidak dipakai oleh computeScore', () => {
    /*
     * Temuan audit, sengaja TIDAK diperbaiki di fase ini.
     *
     * `computeScore` menerima `idealLoad` tetapi tidak pernah memakainya.
     * C dihitung dari `member.capacity` (lihat tes C di atas), bukan dari
     * 1,25 x beban ideal. Itu sesuai contoh penerimaan PRD 8.4, yang juga
     * memakai kapasitas anggota (7) sebagai pembagi, sehingga rumus PRD
     * "Load Limit" dibaca sebagai kapasitas anggota.
     *
     * Mengubah C agar memakai idealLoad akan mengubah setiap skor dan
     * bertentangan dengan angka 8.4. Menghapus parameter akan mengubah
     * signature publik yang dipanggil `assign.ts`. Keduanya butuh keputusan,
     * jadi untuk sekarang hanya dipatok: nilai idealLoad apa pun menghasilkan
     * skor yang sama.
     */
    const a = computeScore(task(), member({ capacity: 7 }), 2, 4, 0.68);
    const b = computeScore(task(), member({ capacity: 7 }), 2, 999, 0.68);
    expect(b).toEqual(a);
  });

  it('membulatkan hanya untuk tampilan, dengan empat desimal', () => {
    // Kapasitas 7, beban 2, tugas 3 jam: C = 1 - 5/7 = 2/7 = 0.285714...
    const score = computeScore(
      task({ estimated_hours: 3 }),
      member({ capacity: 7 }),
      2,
      4,
      0.68
    );
    expect(score.C).toBe(0.2857);
    /*
     * Total dihitung dari nilai penuh sebelum pembulatan, bukan dari komponen
     * yang sudah dipotong. Manual:
     *   0.4(0.8) + 0.3(1) + 0.2(2/7) + 0.1(1)
     *   = 0.32 + 0.30 + 0.0571428 + 0.10 = 0.7771428 -> 0.7771
     * Suku K = 0.8 dan M = 1 mengikuti cosine 0.68 dan minat 5.
     */
    expect(score.total).toBeCloseTo(0.7771, 4);
  });
});
