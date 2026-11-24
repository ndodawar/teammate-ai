/**
 * D2 — tepat 20 skenario kelompok sintetis.
 *
 * Tidak ada data pribadi/kelompok nyata. Semua nama adalah pseudonim fiktif.
 * Setiap skenario mendokumentasikan `specialCondition` dan `expected` (perilaku
 * hard-rule yang diharapkan). Harness (`scripts/run_hard_rules.ts`) menjalankan
 * engine asli dan MEMBANDINGKAN hasil dengan `expected`; ketidaksesuaian dicatat,
 * bukan diperbaiki.
 *
 * Cakupan 15 kondisi wajib PRD (dipetakan di `conditionTags` per skenario):
 *   1 skill merata            → S01
 *   2 satu anggota sangat kuat→ S02
 *   3 kapasitas rendah        → S03, S17
 *   4 kapasitas tinggi        → S04
 *   5 minat berbeda           → S05
 *   6 skill tidak cocok tugas  → S06
 *   7 semua di bawah level 3  → S07
 *   8 tidak ada kandidat R2   → S08
 *   9 jam tersedia nol        → S09
 *  10 tugas usaha tinggi      → S10
 *  11 skill wajib beragam     → S11
 *  12 tugas bersaing anggota  → S12
 *  13 tugas terkunci          → S13
 *  14 beban awal tak seimbang → S14
 *  15 skill+minat tinggi, kapasitas rendah → S15
 * S16–S20 adalah kombinasi tambahan (kombinasi kondisi) agar total tepat 20.
 */

import { Member, Task, SkillTag } from '@/lib/scoring/types';

const S = (s: string): SkillTag => s as SkillTag;

export interface D2Member extends Member {
  /** Beban awal (jam) yang sudah dipegang anggota sebelum penugasan ini. */
  initialLoad: number;
}

export interface D2Task extends Task {
  /** Upah/effort eksplisit; `difficulty` = effort. */
  effort: number;
  /** True bila tugas ini sudah terkunci ke `lockedTo`. */
  locked?: boolean;
  lockedTo?: string;
}

export interface D2Scenario {
  id: string;
  title: string;
  /** Tag kondisi PRD yang dicakup skenario ini. */
  conditionTags: string[];
  description: string;
  members: D2Member[];
  tasks: D2Task[];
  /** Kondisi khusus dalam satu kalimat. */
  specialCondition: string;
  /** Perilaku engine/hard-rule yang diharapkan. */
  expected: {
    /** R1: anggota kapasitas 0 tidak boleh menerima tugas. */
    zeroCapacityExcluded: boolean;
    /** R3: bila semua skill di bawah 3, engine tetap memberi tugas + peringatan. */
    r3FallbackExpected: boolean;
    /** R2: apakah diharapkan ada anggota melewati R2 di akhir (karena tak ada kandidat). */
    expectR2Exceeded: boolean;
    /** R5: tugas terkunci mempertahankan pemiliknya. */
    lockedPreserved: boolean;
    /** Catatan tambahan bebas. */
    note: string;
  };
}

/**
 * Catatan penting soal `initialLoad`: engine `globalAssign` menghitung beban dari
 * tugas pada input saja (mulai dari 0) dan TIDAK menerima initialLoad. Agar
 * "beban awal tidak seimbang" diuji jujur, skenario S14 memodelkan beban awal
 * dengan tugas yang sudah terkunci (locked) ke anggota tertentu — itulah satu-
 * satunya cara beban awal masuk ke perhitungan engine. Field `initialLoad`
 * dicatat sebagai dokumentasi niat desain, dan untuk S14 dibuat konsisten dengan
 * tugas terkunci yang direpresentasikan.
 */
export const D2_SCENARIOS: D2Scenario[] = [
  {
    id: 'S01',
    title: 'Skill merata',
    conditionTags: ['skill merata'],
    description: 'Tiga anggota dengan skill dan level hampir identik; tugas campuran.',
    members: [
      { id: 's01m1', name: 'Ayu', capacity: 40, skills: { 'penulisan akademik': 4, 'riset literatur': 4 }, interests: { 'penulisan akademik': 4 }, initialLoad: 0 },
      { id: 's01m2', name: 'Bimo', capacity: 40, skills: { 'penulisan akademik': 4, 'riset literatur': 4 }, interests: { 'riset literatur': 4 }, initialLoad: 0 },
      { id: 's01m3', name: 'Cika', capacity: 40, skills: { 'penulisan akademik': 4, 'riset literatur': 4 }, interests: { 'penulisan akademik': 3 }, initialLoad: 0 },
    ],
    tasks: [
      { id: 's01t1', title: 'Kerangka makalah', estimated_hours: 8, difficulty: 3, effort: 3, required_skills: [S('penulisan akademik')] },
      { id: 's01t2', title: 'Tinjauan pustaka', estimated_hours: 8, difficulty: 3, effort: 3, required_skills: [S('riset literatur')] },
      { id: 's01t3', title: 'Revisi format', estimated_hours: 6, difficulty: 2, effort: 2, required_skills: [S('penulisan akademik')] },
    ],
    specialCondition: 'Skill merata; siapa pun layak.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: false, lockedPreserved: false, note: 'Beban harus tersebar; tidak ada pelanggaran.' },
  },
  {
    id: 'S02',
    title: 'Satu anggota sangat kuat',
    conditionTags: ['satu anggota sangat tinggi'],
    description: 'Satu anggota level 5 di banyak skill; dua lain level rendah.',
    members: [
      { id: 's02m1', name: 'Dewa', capacity: 40, skills: { 'penulisan akademik': 5, 'riset literatur': 5, 'presentasi': 5, 'koordinasi': 5 }, interests: { 'penulisan akademik': 5 }, initialLoad: 0 },
      { id: 's02m2', name: 'Eka', capacity: 40, skills: { 'penulisan akademik': 2, 'presentasi': 2 }, interests: {}, initialLoad: 0 },
      { id: 's02m3', name: 'Fani', capacity: 40, skills: { 'riset literatur': 2, 'koordinasi': 1 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's02t1', title: 'Makalah inti', estimated_hours: 10, difficulty: 4, effort: 4, required_skills: [S('penulisan akademik')] },
      { id: 's02t2', title: 'Presentasi', estimated_hours: 8, difficulty: 3, effort: 3, required_skills: [S('presentasi')] },
      { id: 's02t3', title: 'Koordinasi tim', estimated_hours: 6, difficulty: 3, effort: 3, required_skills: [S('koordinasi')] },
    ],
    specialCondition: 'Ketergantungan pada satu anggota; risiko beban menumpuk.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: true, expectR2Exceeded: true, lockedPreserved: false, note: 'Dewa kemungkinan melampaui R2 karena hanya dia yang layak R3 untuk beberapa tugas.' },
  },
  {
    id: 'S03',
    title: 'Anggota kapasitas rendah',
    conditionTags: ['kapasitas rendah'],
    description: 'Satu anggota hanya punya 6 jam tersedia; dua berskills serupa tapi 40 jam.',
    members: [
      { id: 's03m1', name: 'Gita', capacity: 6, skills: { 'data dan machine learning': 4 }, interests: {}, initialLoad: 0 },
      { id: 's03m2', name: 'Hadi', capacity: 40, skills: { 'data dan machine learning': 4 }, interests: {}, initialLoad: 0 },
      { id: 's03m3', name: 'Indah', capacity: 40, skills: { 'data dan machine learning': 3 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's03t1', title: 'Analisis data', estimated_hours: 10, difficulty: 3, effort: 3, required_skills: [S('data dan machine learning')] },
      { id: 's03t2', title: 'Bersihkan data', estimated_hours: 4, difficulty: 2, effort: 2, required_skills: [S('data dan machine learning')] },
    ],
    specialCondition: 'Kapasitas rendah harus menghalangi tugas besar di Gita.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: false, lockedPreserved: false, note: 'Gita tidak boleh menerima tugas 10 jam (kapasitas 6); engine seharusnya memberi ke Hadi/Indah.' },
  },
  {
    id: 'S04',
    title: 'Anggota kapasitas tinggi',
    conditionTags: ['kapasitas tinggi'],
    description: 'Satu anggota 60 jam, dua anggota 20 jam; total beban sedang.',
    members: [
      { id: 's04m1', name: 'Joko', capacity: 60, skills: { 'pemrograman frontend': 4 }, interests: {}, initialLoad: 0 },
      { id: 's04m2', name: 'Kiki', capacity: 20, skills: { 'pemrograman frontend': 4 }, interests: {}, initialLoad: 0 },
      { id: 's04m3', name: 'Lala', capacity: 20, skills: { 'pemrograman frontend': 3 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's04t1', title: 'Halaman beranda', estimated_hours: 12, difficulty: 4, effort: 4, required_skills: [S('pemrograman frontend')] },
      { id: 's04t2', title: 'Halaman profil', estimated_hours: 10, difficulty: 3, effort: 3, required_skills: [S('pemrograman frontend')] },
    ],
    specialCondition: 'Kapasitas tinggi; idealLoad kecil sehingga batas R2 menjadi pembatas, bukan capacity.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: false, lockedPreserved: false, note: 'Ideal = 22/3≈7.3 jam; R2 cap ≈9.2 jam; tugas 12 jam hanya muat lewat jalur fallback engine (perlu dicatat).' },
  },
  {
    id: 'S05',
    title: 'Minat berbeda',
    conditionTags: ['minat berbeda'],
    description: 'Skill setara, minat sangat berbeda antar anggota.',
    members: [
      { id: 's05m1', name: 'Mira', capacity: 40, skills: { 'presentasi': 4 }, interests: { 'presentasi': 5 }, initialLoad: 0 },
      { id: 's05m2', name: 'Nadia', capacity: 40, skills: { 'presentasi': 4 }, interests: { 'presentasi': 1 }, initialLoad: 0 },
      { id: 's05m3', name: 'Omar', capacity: 40, skills: { 'presentasi': 4 }, interests: { 'presentasi': 3 }, initialLoad: 0 },
    ],
    tasks: [
      { id: 's05t1', title: 'Tampil presentasi', estimated_hours: 6, difficulty: 3, effort: 3, required_skills: [S('presentasi')] },
    ],
    specialCondition: 'Minat tinggi Mira harus mengungguli Nadia (minat rendah) di skor M.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: false, lockedPreserved: false, note: 'Jika beban setara, Mira (M tertinggi) diharapkan menang.' },
  },
  {
    id: 'S06',
    title: 'Skill tidak cocok tugas',
    conditionTags: ['skill tidak cocok'],
    description: 'Tidak ada anggota yang punya skill wajib tugas ini di level >=3.',
    members: [
      { id: 's06m1', name: 'Putra', capacity: 40, skills: { 'penulisan akademik': 2 }, interests: {}, initialLoad: 0 },
      { id: 's06m2', name: 'Qori', capacity: 40, skills: { 'presentasi': 2 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's06t1', title: 'Analisis data statistik', estimated_hours: 6, difficulty: 3, effort: 3, required_skills: [S('data dan machine learning')] },
    ],
    specialCondition: 'R3 tidak menemukan kandidat level >=3; engine tetap memilih + peringatan.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: true, expectR2Exceeded: false, lockedPreserved: false, note: 'R3 fallback: semua anggota tetap kandidat, skor skill 0; harus ada peringatan.' },
  },
  {
    id: 'S07',
    title: 'Semua anggota di bawah level 3',
    conditionTags: ['semua di bawah level 3'],
    description: 'Dua anggota, keduanya level 2 pada skill wajib, tetapi minat/kapasitas cukup.',
    members: [
      { id: 's07m1', name: 'Rani', capacity: 40, skills: { 'pemrograman backend': 2 }, interests: { 'pemrograman backend': 2 }, initialLoad: 0 },
      { id: 's07m2', name: 'Sinta', capacity: 40, skills: { 'pemrograman backend': 2 }, interests: { 'pemrograman backend': 2 }, initialLoad: 0 },
    ],
    tasks: [
      { id: 's07t1', title: 'Endpoint API', estimated_hours: 8, difficulty: 3, effort: 3, required_skills: [S('pemrograman backend')] },
    ],
    specialCondition: 'Tidak ada kandidat memenuhi R3 ambang level 3.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: true, expectR2Exceeded: false, lockedPreserved: false, note: 'Dipilih yang terbaik di antara yang ada; peringatan R3 wajib muncul di data.' },
  },
  {
    id: 'S08',
    title: 'Tidak ada kandidat yang memenuhi R2',
    conditionTags: ['tidak ada kandidat R2'],
    description: 'Satu anggota kapasitas 4 jam, tugas 10 jam. Tak ada yang muat di batas R2/capacity.',
    members: [
      { id: 's08m1', name: 'Tono', capacity: 4, skills: { 'desain sistem': 4 }, interests: {}, initialLoad: 0 },
      { id: 's08m2', name: 'Umar', capacity: 3, skills: { 'desain sistem': 3 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's08t1', title: 'Rancang arsitektur', estimated_hours: 10, difficulty: 4, effort: 4, required_skills: [S('desain sistem')] },
    ],
    specialCondition: 'Kasus batas: semua kandidat gagal R2 (kapasitas & 1,25x ideal).',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: true, lockedPreserved: false, note: 'Engine masuk jalur absoluteBest → tetap menugaskan meski R2 gagal. PRD tidak mendefinisikan perilaku ini; dicatat terpisah.' },
  },
  {
    id: 'S09',
    title: 'Anggota jam tersedia nol',
    conditionTags: ['jam tersedia nol'],
    description: 'Satu anggota capacity 0 (R1), satu normal dengan skill sama.',
    members: [
      { id: 's09m1', name: 'Vino', capacity: 0, skills: { 'koordinasi': 5 }, interests: { 'koordinasi': 5 }, initialLoad: 0 },
      { id: 's09m2', name: 'Wati', capacity: 40, skills: { 'koordinasi': 3 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's09t1', title: 'Koordinasi acara', estimated_hours: 6, difficulty: 3, effort: 3, required_skills: [S('koordinasi')] },
    ],
    specialCondition: 'R1: Vino (capacity 0) harus dikecualikan meski skill lebih tinggi.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: false, lockedPreserved: false, note: 'Wati menerima tugas; Vino tidak boleh jadi penanggung jawab.' },
  },
  {
    id: 'S10',
    title: 'Tugas usaha tinggi',
    conditionTags: ['tugas usaha tinggi'],
    description: 'Satu tugas 30 jam; tiga anggota kapasitas 20.',
    members: [
      { id: 's10m1', name: 'Xena', capacity: 20, skills: { 'data dan machine learning': 4 }, interests: {}, initialLoad: 0 },
      { id: 's10m2', name: 'Yudi', capacity: 20, skills: { 'data dan machine learning': 4 }, interests: {}, initialLoad: 0 },
      { id: 's10m3', name: 'Zaki', capacity: 20, skills: { 'data dan machine learning': 4 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's10t1', title: 'Model prediksi besar', estimated_hours: 30, difficulty: 5, effort: 5, required_skills: [S('data dan machine learning')] },
    ],
    specialCondition: 'Tugas 30 jam > kapasitas satu anggota (20) → R2 tak terhindarkan.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: true, lockedPreserved: false, note: 'Tidak ada anggota yang muat; engine fallback menugaskan; pelanggaran R2 dicatat sebagai keterbatasan data.' },
  },
  {
    id: 'S11',
    title: 'Skill wajib beragam',
    conditionTags: ['skill wajib beragam'],
    description: 'Tugas membutuhkan 3 skill berbeda; anggota terspesialisasi.',
    members: [
      { id: 's11m1', name: 'Ani', capacity: 40, skills: { 'penulisan akademik': 5, 'riset literatur': 3 }, interests: {}, initialLoad: 0 },
      { id: 's11m2', name: 'Bayu', capacity: 40, skills: { 'data dan machine learning': 5, 'presentasi': 3 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's11t1', title: 'Laporan analisis lengkap', estimated_hours: 8, difficulty: 4, effort: 4, required_skills: [S('penulisan akademik'), S('riset literatur'), S('data dan machine learning')] },
    ],
    specialCondition: 'Multi-skill: skor skill adalah rata-rata level pada ketiga skill.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: false, lockedPreserved: false, note: 'Ani punya 2/3 skill, Bayu 1/3 (>=3). R3: keduanya lolos karena >=1 skill level>=3; skor menentukan pemenang.' },
  },
  {
    id: 'S12',
    title: 'Beberapa tugas bersaing untuk anggota yang sama',
    conditionTags: ['tugas bersaing'],
    description: 'Tiga tugas semua hanya bisa dikerjakan satu anggota berkualitas tinggi.',
    members: [
      { id: 's12m1', name: 'Candra', capacity: 40, skills: { 'desain antarmuka': 5 }, interests: {}, initialLoad: 0 },
      { id: 's12m2', name: 'Dini', capacity: 40, skills: { 'desain antarmuka': 2 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's12t1', title: 'Desain beranda', estimated_hours: 10, difficulty: 3, effort: 3, required_skills: [S('desain antarmuka')] },
      { id: 's12t2', title: 'Desain profil', estimated_hours: 8, difficulty: 3, effort: 3, required_skills: [S('desain antarmuka')] },
      { id: 's12t3', title: 'Desain pengaturan', estimated_hours: 6, difficulty: 3, effort: 3, required_skills: [S('desain antarmuka')] },
    ],
    specialCondition: 'Persaingan untuk satu anggota; total 24 jam, ideal 12 jam.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: true, lockedPreserved: false, note: 'Candra level 5 vs Dini level 2 (<3, gugur R3). Semua mengarah ke Candra → R2 terlampaui.' },
  },
  {
    id: 'S13',
    title: 'Tugas terkunci',
    conditionTags: ['tugas terkunci'],
    description: 'Satu tugas sudah dikunci ke anggota tertentu; sisanya bebas.',
    members: [
      { id: 's13m1', name: 'Eko', capacity: 40, skills: { 'pengujian': 4 }, interests: {}, initialLoad: 0 },
      { id: 's13m2', name: 'Fitri', capacity: 40, skills: { 'pengujian': 5 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's13t1', title: 'Uji manual (terkunci ke Eko)', estimated_hours: 8, difficulty: 3, effort: 3, required_skills: [S('pengujian')], locked: true, lockedTo: 's13m1' },
      { id: 's13t2', title: 'Uji otomatis', estimated_hours: 8, difficulty: 3, effort: 3, required_skills: [S('pengujian')] },
    ],
    specialCondition: 'R5: Eko tetap pemilik tugas terkunci meski Fitri punya level lebih tinggi.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: false, lockedPreserved: true, note: 't1 harus tetap ke Eko; t2 bebas ke Fitri.' },
  },
  {
    id: 'S14',
    title: 'Beban awal tidak seimbang',
    conditionTags: ['beban awal tak seimbang'],
    description: 'Satu anggota sudah memegang tugas terkunci besar (18 jam); dua lain kosong.',
    members: [
      { id: 's14m1', name: 'Gunawan', capacity: 40, skills: { 'koordinasi': 4 }, interests: {}, initialLoad: 18 },
      { id: 's14m2', name: 'Hesti', capacity: 40, skills: { 'koordinasi': 4 }, interests: {}, initialLoad: 0 },
      { id: 's14m3', name: 'Iwan', capacity: 40, skills: { 'koordinasi': 4 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's14t1', title: 'Rapat koordinasi awal (terkunci)', estimated_hours: 18, difficulty: 4, effort: 4, required_skills: [S('koordinasi')], locked: true, lockedTo: 's14m1' },
      { id: 's14t2', title: 'Laporan koordinasi', estimated_hours: 8, difficulty: 3, effort: 3, required_skills: [S('koordinasi')] },
      { id: 's14t3', title: 'Jadwal tim', estimated_hours: 6, difficulty: 2, effort: 2, required_skills: [S('koordinasi')] },
    ],
    specialCondition: 'Beban awal dimodelkan via tugas terkunci (engine hanya menerima beban dari tugas input).',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: false, lockedPreserved: true, note: 'Gunawan sudah 18 jam → R2 menghalangi tambahan; t2/t3 ke Hesti/Iwan.' },
  },
  {
    id: 'S15',
    title: 'Skill & minat tinggi, kapasitas rendah',
    conditionTags: ['skill+minat tinggi, kapasitas rendah'],
    description: 'Satu anggota ideal secara profil tetapi kapasitas hanya 5 jam; tugas 8 jam.',
    members: [
      { id: 's15m1', name: 'Juwita', capacity: 5, skills: { 'pemrograman frontend': 5 }, interests: { 'pemrograman frontend': 5 }, initialLoad: 0 },
      { id: 's15m2', name: 'Kurnia', capacity: 40, skills: { 'pemrograman frontend': 3 }, interests: { 'pemrograman frontend': 2 }, initialLoad: 0 },
    ],
    tasks: [
      { id: 's15t1', title: 'Bangun komponen UI', estimated_hours: 8, difficulty: 3, effort: 3, required_skills: [S('pemrograman frontend')] },
    ],
    specialCondition: 'Trade-off: profil terbaik (Juwita) tak muat kapasitas.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: false, lockedPreserved: false, note: 'Juwita gagal R2 (5 < 8); Kurnia menerima. Catat bahwa "fit" intra-profil bisa bertentangan dengan R2.' },
  },
  {
    id: 'S16',
    title: 'Kombinasi: kapasitas rendah + multi-skill',
    conditionTags: ['kapasitas rendah', 'skill wajib beragam'],
    description: 'Anggota kapasitas rendah dengan 2 skill; tugas butuh keduanya.',
    members: [
      { id: 's16m1', name: 'Lestari', capacity: 8, skills: { 'penulisan akademik': 4, 'riset literatur': 4 }, interests: {}, initialLoad: 0 },
      { id: 's16m2', name: 'Made', capacity: 40, skills: { 'penulisan akademik': 3 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's16t1', title: 'Bab tinjauan (butuh tulis+riset)', estimated_hours: 7, difficulty: 3, effort: 3, required_skills: [S('penulisan akademik'), S('riset literatur')] },
    ],
    specialCondition: 'Lestari cocok profil tapi kapasitas 8 hanya muat jika ideal tinggi.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: false, lockedPreserved: false, note: 'Ideal = 7/2 = 3.5 jam; R2 cap 4.4 jam → keduanya melebihi. Jalur fallback engine dipakai; dicatat.' },
  },
  {
    id: 'S17',
    title: 'Kombinasi: kapasitas rendah + minat berbeda',
    conditionTags: ['kapasitas rendah', 'minat berbeda'],
    description: 'Dua anggota skill setara; satu kapasitas kecil dengan minat tinggi, satu kapasitas besar minat rendah.',
    members: [
      { id: 's17m1', name: 'Nanda', capacity: 6, skills: { 'presentasi': 4 }, interests: { 'presentasi': 5 }, initialLoad: 0 },
      { id: 's17m2', name: 'Oki', capacity: 40, skills: { 'presentasi': 4 }, interests: { 'presentasi': 1 }, initialLoad: 0 },
    ],
    tasks: [
      { id: 's17t1', title: 'Latihan presentasi', estimated_hours: 5, difficulty: 2, effort: 2, required_skills: [S('presentasi')] },
    ],
    specialCondition: 'Minat vs kapasitas: Nanda muat (5<=6) tapi ideal kecil.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: false, lockedPreserved: false, note: 'Ideal = 2.5 jam; R2 cap 3.1 jam; keduanya melebihi cap → fallback engine; catat.' },
  },
  {
    id: 'S18',
    title: 'Kombinasi: satu sangat kuat + tugas bersaing',
    conditionTags: ['satu anggota sangat tinggi', 'tugas bersaing'],
    description: 'Dewa versi ringkas: satu bintang, dua tugas besar bersaing untuknya.',
    members: [
      { id: 's18m1', name: 'Putri', capacity: 30, skills: { 'desain sistem': 5 }, interests: {}, initialLoad: 0 },
      { id: 's18m2', name: 'Qabil', capacity: 30, skills: { 'desain sistem': 2 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's18t1', title: 'Arsitektur inti', estimated_hours: 14, difficulty: 4, effort: 4, required_skills: [S('desain sistem')] },
      { id: 's18t2', title: 'Diagram komponen', estimated_hours: 12, difficulty: 3, effort: 3, required_skills: [S('desain sistem')] },
    ],
    specialCondition: 'Kedua tugas hanya layak untuk Putri (Qabil < 3).',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: true, lockedPreserved: false, note: 'Ideal 13; cap 16.25; t1 14 muat, t2 12 menambah ke 26 > cap → R2 terlampaui via fallback.' },
  },
  {
    id: 'S19',
    title: 'Kombinasi: jam nol + skill tidak cocok',
    conditionTags: ['jam tersedia nol', 'skill tidak cocok'],
    description: 'Anggota kapasitas 0 dengan skill tinggi; tugas tanpa kandidat level >=3 di antara yang tersisa.',
    members: [
      { id: 's19m1', name: 'Riko', capacity: 0, skills: { 'data dan machine learning': 5 }, interests: {}, initialLoad: 0 },
      { id: 's19m2', name: 'Sari', capacity: 40, skills: { 'data dan machine learning': 2 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's19t1', title: 'Analisis regresi', estimated_hours: 6, difficulty: 3, effort: 3, required_skills: [S('data dan machine learning')] },
    ],
    specialCondition: 'Satu-satunya anggota berkualitas punya capacity 0 → R1 menghalangi; sisanya level 2.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: true, expectR2Exceeded: false, lockedPreserved: false, note: 'R1 keluarkan Riko; R3 tak ada level>=3 di antara yang valid? Riko (5) ada tapi R1. Engine pakai pool R3 semua anggota lalu R1 filter; Sari yang tersisa level 2 tidak memenuhi R3 tapi R3 tak menemukan kandidat level>=3 selain Riko → perlu dicatat siapa yang akhirnya dipilih.' },
  },
  {
    id: 'S20',
    title: 'Kombinasi: merata + beban awal tak seimbang',
    conditionTags: ['skill merata', 'beban awal tak seimbang'],
    description: 'Empat anggota skill merata; satu sudah pegang tugas terkunci 20 jam.',
    members: [
      { id: 's20m1', name: 'Tari', capacity: 40, skills: { 'koordinasi': 4 }, interests: {}, initialLoad: 20 },
      { id: 's20m2', name: 'Uli', capacity: 40, skills: { 'koordinasi': 4 }, interests: {}, initialLoad: 0 },
      { id: 's20m3', name: 'Vera', capacity: 40, skills: { 'koordinasi': 4 }, interests: {}, initialLoad: 0 },
      { id: 's20m4', name: 'Wawan', capacity: 40, skills: { 'koordinasi': 4 }, interests: {}, initialLoad: 0 },
    ],
    tasks: [
      { id: 's20t1', title: 'Rapat besar (terkunci, 20 jam)', estimated_hours: 20, difficulty: 4, effort: 4, required_skills: [S('koordinasi')], locked: true, lockedTo: 's20m1' },
      { id: 's20t2', title: 'Susun agenda', estimated_hours: 6, difficulty: 2, effort: 2, required_skills: [S('koordinasi')] },
      { id: 's20t3', title: 'Rekap notulen', estimated_hours: 5, difficulty: 2, effort: 2, required_skills: [S('koordinasi')] },
      { id: 's20t4', title: 'Dokumentasi', estimated_hours: 5, difficulty: 2, effort: 2, required_skills: [S('koordinasi')] },
    ],
    specialCondition: 'Skill merata tetapi Tari sudah beban 20 jam → R2/R5 harus mencegahnya menerima lagi.',
    expected: { zeroCapacityExcluded: true, r3FallbackExpected: false, expectR2Exceeded: false, lockedPreserved: true, note: 'Total 36, ideal 9, cap 11.25. Tari 20 > cap → t2..t4 ke Uli/Vera/Wawan. R5: t1 tetap Tari.' },
  },
];

/** Validasi struktural D2. */
export function validateD2(scenarios: D2Scenario[]): string[] {
  const errs: string[] = [];
  if (scenarios.length !== 20) errs.push(`D2 harus tepat 20 skenario, ada ${scenarios.length}`);
  const ids = new Set<string>();
  for (const sc of scenarios) {
    if (ids.has(sc.id)) errs.push(`id duplikat: ${sc.id}`);
    ids.add(sc.id);
    if (sc.members.length === 0) errs.push(`${sc.id}: tanpa anggota`);
    if (sc.tasks.length === 0) errs.push(`${sc.id}: tanpa tugas`);
    for (const t of sc.tasks) {
      if (t.estimated_hours <= 0) errs.push(`${sc.id}/${t.id}: hours<=0`);
      if (t.locked && !t.lockedTo) errs.push(`${sc.id}/${t.id}: locked tanpa lockedTo`);
      if (t.lockedTo && !sc.members.some((m) => m.id === t.lockedTo)) errs.push(`${sc.id}/${t.id}: lockedTo tak dikenal`);
    }
  }
  // 15 kondisi wajib harus tercakup
  const required = [
    'skill merata', 'satu anggota sangat tinggi', 'kapasitas rendah', 'kapasitas tinggi',
    'minat berbeda', 'skill tidak cocok', 'semua di bawah level 3', 'tidak ada kandidat R2',
    'jam tersedia nol', 'tugas usaha tinggi', 'skill wajib beragam', 'tugas bersaing',
    'tugas terkunci', 'beban awal tak seimbang', 'skill+minat tinggi, kapasitas rendah',
  ];
  const covered = new Set(scenarios.flatMap((s) => s.conditionTags));
  for (const r of required) if (!covered.has(r)) errs.push(`kondisi wajib tidak tercakup: "${r}"`);
  return errs;
}
