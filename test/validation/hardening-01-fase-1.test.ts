import { describe, it, expect } from 'vitest';
import { memberProfileSchema, taskSchema, weightsSchema, skillTaxonomyWarnings } from '@/lib/validation';
import {
  normalizeSkillName,
  canonicalSkills,
  skillLevelFor,
  isTaxonomySkill,
  unmatchedSkillNames,
} from '@/lib/scoring/rules';
import { SKILL_TAXONOMY } from '@/lib/scoring/types';
import type { Member } from '@/lib/scoring/types';

/*
 * MASTER-MATRIX-HARDENING-01, FASE 1: audit validasi data.
 *
 * Setiap tes di sini mematok perilaku yang SUDAH ADA, bukan perilaku yang saya
 * inginkan. Tujuannya dua: membuktikan data valid diterima dan data tidak valid
 * ditolak dengan pesan yang jelas, sekaligus mengunci celah yang ditemukan
 * selama audit agar tidak diam-diam berubah.
 *
 * Empat celah yang ditemukan dicatat sebagai H1-01 sampai H1-04 di komentar dan
 * di docs/STATUS.md. Tidak satu pun diperbaiki di fase ini, karena memperbaiki
 * artinya mengubah schema atau perilaku simpan, dan itu keputusan pengguna.
 */

const base = { name: 'Rani', capacity: 40 };

function profile(skills: { skill_name: string; skill_level: number; interest_level: number }[]) {
  return memberProfileSchema.safeParse({ ...base, skills });
}

function member(skills: Record<string, number>, interests?: Record<string, number>): Member {
  return {
    id: 'm1',
    name: 'Ani',
    capacity: 40,
    skills: skills as Member['skills'],
    interests: interests as Member['interests'],
  };
}

describe('FASE 1 — profil anggota menerima data valid (FR-03)', () => {
  it('menerima profil lengkap dengan beberapa skill', () => {
    const result = profile([
      { skill_name: 'penulisan akademik', skill_level: 4, interest_level: 5 },
      { skill_name: 'riset literatur', skill_level: 3, interest_level: 3 },
    ]);
    expect(result.success).toBe(true);
  });

  it('menerima profil tanpa skill sama sekali', () => {
    // FR-03 tidak mewajibkan minimal satu skill, dan engine memperlakukan
    // daftar kosong dengan aman: S = 1 untuk tugas tanpa skill wajib.
    expect(profile([]).success).toBe(true);
  });

  it('menerima batas atas yang sah: level 5 dan minat 5', () => {
    expect(profile([{ skill_name: 'koordinasi', skill_level: 5, interest_level: 5 }]).success).toBe(true);
  });

  it('menerima batas bawah yang sah: level 1 dan minat 1', () => {
    expect(profile([{ skill_name: 'koordinasi', skill_level: 1, interest_level: 1 }]).success).toBe(true);
  });

  it('memangkas spasi pada nama dan catatan', () => {
    const result = memberProfileSchema.safeParse({
      name: '  Rani  ',
      note: '  catatan  ',
      capacity: 40,
      skills: [{ skill_name: '  koordinasi  ', skill_level: 3, interest_level: 3 }],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe('Rani');
    // note tidak dipangkas oleh schema; itu urusan handler, bukan validator.
    expect(result.data.skills[0].skill_name).toBe('koordinasi');
  });

  it('menerima nama panggilan tepat 60 karakter, menolak 61', () => {
    expect(memberProfileSchema.safeParse({ ...base, name: 'a'.repeat(60), skills: [] }).success).toBe(true);
    expect(memberProfileSchema.safeParse({ ...base, name: 'a'.repeat(61), skills: [] }).success).toBe(false);
  });
});

describe('FASE 1 — profil anggota menolak data tidak valid (FR-03)', () => {
  it('menolak nama kosong dan nama berisi spasi saja', () => {
    expect(memberProfileSchema.safeParse({ name: '', capacity: 40, skills: [] }).success).toBe(false);
    expect(memberProfileSchema.safeParse({ name: '   ', capacity: 40, skills: [] }).success).toBe(false);
  });

  it('menolak catatan lebih dari 300 karakter, menerima tepat 300', () => {
    expect(memberProfileSchema.safeParse({ ...base, note: 'a'.repeat(300), skills: [] }).success).toBe(true);
    expect(memberProfileSchema.safeParse({ ...base, note: 'a'.repeat(301), skills: [] }).success).toBe(false);
  });

  it('menolak level skill dan minat di luar 1 sampai 5', () => {
    for (const bad of [0, 6, -1, 2.5]) {
      expect(profile([{ skill_name: 'koordinasi', skill_level: bad, interest_level: 3 }]).success).toBe(false);
      expect(profile([{ skill_name: 'koordinasi', skill_level: 3, interest_level: bad }]).success).toBe(false);
    }
  });

  it('menolak nama skill kosong atau berisi spasi saja', () => {
    expect(profile([{ skill_name: '', skill_level: 3, interest_level: 3 }]).success).toBe(false);
    expect(profile([{ skill_name: '   ', skill_level: 3, interest_level: 3 }]).success).toBe(false);
  });

  it('menolak kapasitas nol, negatif, dan desimal', () => {
    for (const bad of [0, -5, 12.5]) {
      expect(memberProfileSchema.safeParse({ name: 'Rani', capacity: bad, skills: [] }).success).toBe(false);
    }
  });

  it('menolak kapasitas dengan pesan Indonesia, bukan teks mentah Zod', () => {
    const result = memberProfileSchema.safeParse({ name: 'Rani', capacity: 0, skills: [] });
    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.issues.map((issue) => issue.message).join(' ');
    /*
     * H1-03, diperbaiki: pesan sekarang berbahasa Indonesia seperti pesan lain,
     * bukan "Too small: expected number to be >0". Penolakannya tetap sama;
     * hanya teks yang dibaca pemanggil API yang berubah.
     */
    expect(messages).toMatch(/Kapasitas waktu harus lebih besar dari 0 jam/);
    expect(messages).not.toMatch(/expected number to be/);
  });
});

describe('FASE 1 — taksonomi dan normalisasi keterampilan', () => {
  it('menyamakan huruf besar/kecil, spasi berlebih, underscore, dan hyphen', () => {
    const expected = normalizeSkillName('penulisan akademik');
    for (const variant of [
      'Penulisan Akademik',
      'PENULISAN AKADEMIK',
      'penulisan_akademik',
      'penulisan-akademik',
      '  penulisan   akademik  ',
      'Penulisan\tAkademik',
    ]) {
      expect(normalizeSkillName(variant)).toBe(expected);
    }
  });

  it('mengenali setiap tag taksonomi meskipun ditulis dengan variasi bentuk', () => {
    for (const tag of SKILL_TAXONOMY) {
      expect(isTaxonomySkill(tag)).toBe(true);
      expect(isTaxonomySkill(tag.toUpperCase())).toBe(true);
      expect(isTaxonomySkill(tag.replace(/ /g, '_'))).toBe(true);
      expect(isTaxonomySkill(tag.replace(/ /g, '-'))).toBe(true);
    }
  });

  it('tidak menganggap dua skill berbeda sebagai sama hanya karena mirip', () => {
    // Normalisasi menyamakan BENTUK, bukan MAKNA. Ini batas yang disengaja.
    expect(normalizeSkillName('pemrograman frontend')).not.toBe(normalizeSkillName('pemrograman backend'));
    expect(normalizeSkillName('desain sistem')).not.toBe(normalizeSkillName('desain antarmuka'));
    expect(isTaxonomySkill('Python')).toBe(false);
    expect(isTaxonomySkill('Frontend')).toBe(false);
  });

  it('melaporkan label yang tidak ada di taksonomi', () => {
    const m = member({ Python: 5, Frontend: 4, 'penulisan akademik': 3 });
    expect(unmatchedSkillNames(m).sort()).toEqual(['Frontend', 'Python']);
  });

  it('memberi level 0 untuk skill yang tidak dimiliki, tanpa mengarang level', () => {
    const m = member({ 'penulisan akademik': 3 });
    expect(skillLevelFor(m, 'riset literatur')).toBe(0);
    expect(skillLevelFor(m, 'penulisan akademik')).toBe(3);
    // Tidak ada penulisan balik: profil tetap seperti aslinya.
    expect(Object.keys(m.skills!)).toEqual(['penulisan akademik']);
  });
});

describe('FASE 1 — skill duplikat tidak menyebabkan perhitungan ganda', () => {
  it('memakai level tertinggi ketika dua label runtuh ke skill yang sama', () => {
    /*
     * Manual: "Frontend" level 2 dan "frontend" level 5 adalah satu skill.
     * Level tertinggi menang (5), bukan dijumlahkan (7, di luar rentang) dan
     * bukan dirata-ratakan (3,5).
     */
    const m = member({ Frontend: 2, frontend: 5 });
    expect(canonicalSkills(m)).toEqual({ frontend: 5 });
    expect(skillLevelFor(m, 'frontend')).toBe(5);
  });

  it('tidak menjumlahkan dua label yang runtuh menjadi satu', () => {
    const m = member({ 'penulisan akademik': 4, PENULISAN_AKADEMIK: 4 });
    // Hasilnya 4, bukan 8. Level skill tidak pernah keluar dari rentang 1-5.
    expect(skillLevelFor(m, 'penulisan akademik')).toBe(4);
  });

  it('H1-01: validator MENOLAK nama skill duplikat setelah normalisasi', () => {
    /*
     * Keputusan pengguna K-3(b): duplikat ditolak di validator, tanpa migration.
     *
     * "Frontend" dan "frontend" adalah satu skill setelah dinormalkan, jadi
     * menyimpannya dua kali hanya menghasilkan dua baris yang membingungkan di
     * formulir. Mesin skor sendiri sudah aman (level tertinggi menang), tetapi
     * lebih murah mencegahnya di pintu masuk.
     *
     * Data lama tidak disentuh: tidak ada backfill, dan baris yang sudah ada di
     * database tetap terbaca oleh mesin seperti sebelumnya.
     */
    const result = profile([
      { skill_name: 'Frontend', skill_level: 2, interest_level: 3 },
      { skill_name: 'frontend', skill_level: 5, interest_level: 4 },
    ]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.message).join(' ')).toMatch(
      /tidak boleh dicantumkan dua kali/
    );
  });

  it('tetap menerima skill berbeda yang tidak runtuh menjadi satu', () => {
    expect(
      profile([
        { skill_name: 'penulisan akademik', skill_level: 3, interest_level: 3 },
        { skill_name: 'riset literatur', skill_level: 4, interest_level: 3 },
      ]).success
    ).toBe(true);
  });

  it('menerima satu baris yang sama persis sekali saja', () => {
    expect(profile([{ skill_name: 'koordinasi', skill_level: 3, interest_level: 3 }]).success).toBe(true);
  });

  it('menolak duplikat yang hanya berbeda bentuk penulisan', () => {
    /*
     * Semua bentuk di bawah ini menormalkan ke "koordinasi", jadi semuanya
     * adalah skill yang sama. Hyphen di TENGAH kata tidak termasuk: "Koordina-si"
     * menormalkan ke "koordina si", kata yang berbeda, dan memang bukan duplikat.
     */
    for (const second of ['koordinasi', 'KOORDINASI', 'koordinasi_', '  koordinasi  ', 'koordinasi-', '_koordinasi_']) {
      const result = profile([
        { skill_name: 'koordinasi', skill_level: 3, interest_level: 3 },
        { skill_name: second, skill_level: 4, interest_level: 3 },
      ]);
      expect(result.success, `pasangan: koordinasi + ${second}`).toBe(false);
    }
  });

  it('tidak salah menganggap beda kata sebagai duplikat', () => {
    // "koordina si" berbeda dari "koordinasi"; ini bukan tugas validator untuk
    // menebak bahwa pengguna bermaksud yang sama.
    expect(normalizeSkillName('Koordina-si')).toBe('koordina si');
    expect(normalizeSkillName('koordina-si')).not.toBe(normalizeSkillName('koordinasi'));
    expect(
      profile([
        { skill_name: 'koordinasi', skill_level: 3, interest_level: 3 },
        { skill_name: 'koordina-si', skill_level: 3, interest_level: 3 },
      ]).success
    ).toBe(true);
  });
});

describe('FASE 1 — H1-02: skill di luar taksonomi tetap disimpan, dengan peringatan', () => {
  it('validator tetap MENERIMA label bebas seperti "Python"', () => {
    /*
     * Keputusan pengguna K-1(b): peringatan, bukan penolakan.
     *
     * Menolak akan membuang apa yang ditulis pengguna untuk label yang mungkin
     * sah bagi mereka. Memblokir seluruh profil demi satu label juga lebih buruk
     * daripada masalahnya. Jadi penyimpanan berjalan seperti sebelumnya, dan
     * peringatan datang dari `skillTaxonomyWarnings`.
     */
    expect(profile([{ skill_name: 'Python', skill_level: 5, interest_level: 5 }]).success).toBe(true);
    // Sementara tugas dengan skill di luar taksonomi tetap ditolak.
    const task = taskSchema.safeParse({
      title: 'API', description: 'Membuat API', estimated_hours: 2, required_skills: ['Python'],
    });
    expect(task.success).toBe(false);
  });

  it('menghasilkan peringatan untuk label di luar taksonomi', () => {
    const warnings = skillTaxonomyWarnings([
      { skill_name: 'Python' },
      { skill_name: 'Frontend' },
      { skill_name: 'penulisan akademik' },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"Python"');
    expect(warnings[0]).toContain('"Frontend"');
    // Label yang sah tidak disebut sebagai masalah.
    expect(warnings[0]).not.toContain('"penulisan akademik"');
    // Peringatan menyebutkan jalan keluarnya, bukan hanya kesalahannya.
    expect(warnings[0]).toContain('penulisan akademik, riset literatur');
    // Dan menegaskan profil tetap tersimpan.
    expect(warnings[0]).toContain('Profil tetap tersimpan');
  });

  it('tidak memberi peringatan ketika semua skill ada di taksonomi', () => {
    expect(skillTaxonomyWarnings([{ skill_name: 'koordinasi' }, { skill_name: 'PENGUJIAN' }])).toEqual([]);
  });

  it('tidak memberi peringatan untuk daftar kosong', () => {
    expect(skillTaxonomyWarnings([])).toEqual([]);
    expect(skillTaxonomyWarnings([{ skill_name: '   ' }])).toEqual([]);
  });

  it('tetap memberi peringatan walau komentar duplikat sudah ditolak lebih dulu', () => {
    // Nama yang sama muncul dua kali hanya disebut sekali di pesan.
    const warnings = skillTaxonomyWarnings([{ skill_name: 'Python' }, { skill_name: 'PYTHON' }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].match(/"Python"/g)).toHaveLength(1);
  });
});

describe('FASE 1 — validasi tugas (FR-05) tetap utuh', () => {
  const task = { title: 'Riset', description: 'Mengumpulkan sumber', estimated_hours: 3 };

  it('menerima tugas valid dari taksonomi', () => {
    expect(taskSchema.safeParse({ ...task, required_skills: ['riset literatur'] }).success).toBe(true);
  });

  it('menolak required_skills di luar taksonomi dengan pesan Indonesia', () => {
    const result = taskSchema.safeParse({ ...task, required_skills: ['Python'] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.message).join(' ')).toMatch(/taksonomi tetap/);
  });

  it('menolak estimasi jam nol, negatif, dan desimal', () => {
    for (const bad of [0, -1, 1.5]) {
      expect(taskSchema.safeParse({ ...task, estimated_hours: bad, required_skills: ['pengujian'] }).success).toBe(false);
    }
  });

  it('menolak deskripsi kosong dan lebih dari 500 karakter', () => {
    expect(taskSchema.safeParse({ ...task, description: '', required_skills: ['pengujian'] }).success).toBe(false);
    expect(
      taskSchema.safeParse({ ...task, description: 'a'.repeat(501), required_skills: ['pengujian'] }).success
    ).toBe(false);
  });
});

describe('FASE 1 — validasi bobot tidak membiarkan NaN atau total bukan 100%', () => {
  it('menerima bobot 40/30/20/10', () => {
    expect(weightsSchema.safeParse({ K: 0.4, S: 0.3, C: 0.2, M: 0.1 }).success).toBe(true);
  });

  it('menolak total yang bukan 100%', () => {
    expect(weightsSchema.safeParse({ K: 0.8, S: 0.8, C: 0.2, M: 0.1 }).success).toBe(false);
    expect(weightsSchema.safeParse({ K: 0.4, S: 0.3, C: 0.2, M: 0.0 }).success).toBe(false);
  });

  it('menolak NaN dan nilai di luar 0 sampai 1', () => {
    expect(weightsSchema.safeParse({ K: NaN, S: 0.3, C: 0.2, M: 0.1 }).success).toBe(false);
    expect(weightsSchema.safeParse({ K: 1.5, S: -0.5, C: 0.2, M: 0.1 }).success).toBe(false);
  });

  it('menerima total 1 dengan toleransi floating point', () => {
    // 0.1 + 0.2 + 0.3 + 0.4 tidak persis 1 di IEEE-754; toleransi 1e-6
    // diperlukan agar slider yang mendarat di 1.00 tidak ditolak.
    const drifting = { K: 0.1 + 0.2, S: 0.3, C: 0.2, M: 0.2 };
    expect(weightsSchema.safeParse(drifting).success).toBe(true);
  });
});
