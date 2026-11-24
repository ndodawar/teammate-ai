/**
 * D1 — kumpulan tugas: 11 template resmi (T01–T11) + 15 tugas non-IT sintetis.
 *
 * SEMUA entri di sini adalah DATA SINTETIS (atau metadata turunan katalog
 * template produk), bukan data kelompok nyata. 15 tugas non-IT diberi label
 * `synthetic: true` dan `domain` non-IT.
 *
 * Variasi yang wajib dipenuhi (dan dipenuhi):
 *   - deskripsi pendek & panjang (lihat `descriptionLength`)
 *   - skill teknis & nonteknis
 *   - usaha rendah / sedang / tinggi (estimated_hours 2 / 5–8 / 12–20)
 *   - tugas satu-skill & multi-skill
 *   - tugas dengan skill jarang dimiliki (tag yang hanya sedikit anggota punya)
 *
 * Metadata skill/effort untuk 11 template TIDAK dibuat-buat dari nol: dipilih
 * mengikuti isi deskripsi template (mis. T05 "Dasar Teori" → riset literatur +
 * penulisan akademik). Ini tetap sebuah PEMETAAN SINTETIS — katalog asli tidak
 * menyimpan skill/effort — jadi diperlakukan sebagai data sintetis eksperimen.
 */

import { SKILL_TAXONOMY, Task, SkillTag } from '@/lib/scoring/types';

export interface D1Task extends Task {
  /** Selalu true di dataset ini: tidak ada tugas dari kelompok nyata. */
  synthetic: true;
  /** Asal: katalog template produk atau dibuat untuk evaluasi. */
  origin: 'template' | 'synthetic-non-it';
  domain: string;
  /** Catatan panjang deskripsi untuk memastikan variasi. */
  descriptionLength: 'pendek' | 'sedang' | 'panjang';
}

const T = (s: string): SkillTag => s as SkillTag;

/**
 * Metadata 11 template (T01–T11). `title`/`description` diimpor ulang dari
 * katalog agar konsisten; di sini hanya dipetakan ke skill + effort + jam.
 */
interface TemplateMeta {
  id: string;
  skills: SkillTag[];
  effort: number; // 1..5
  hours: number; // estimated_hours
  domain: string;
  descriptionLength: D1Task['descriptionLength'];
}

const TEMPLATE_META: TemplateMeta[] = [
  { id: 'T01', skills: [T('desain sistem'), T('riset literatur')], effort: 2, hours: 4, domain: 'proyek AI', descriptionLength: 'sedang' },
  { id: 'T02', skills: [T('desain sistem'), T('data dan machine learning')], effort: 3, hours: 6, domain: 'proyek AI', descriptionLength: 'panjang' },
  { id: 'T03', skills: [T('penulisan akademik'), T('riset literatur')], effort: 3, hours: 7, domain: 'proyek AI', descriptionLength: 'sedang' },
  { id: 'T04', skills: [T('penulisan akademik')], effort: 2, hours: 4, domain: 'proyek AI', descriptionLength: 'pendek' },
  { id: 'T05', skills: [T('riset literatur'), T('penulisan akademik')], effort: 4, hours: 10, domain: 'proyek AI', descriptionLength: 'panjang' },
  { id: 'T06', skills: [T('desain sistem')], effort: 3, hours: 6, domain: 'proyek AI', descriptionLength: 'sedang' },
  { id: 'T07', skills: [T('pemrograman backend'), T('pemrograman frontend')], effort: 5, hours: 18, domain: 'proyek AI', descriptionLength: 'panjang' },
  { id: 'T08', skills: [T('pengujian'), T('pemrograman frontend')], effort: 3, hours: 8, domain: 'proyek AI', descriptionLength: 'sedang' },
  { id: 'T09', skills: [T('presentasi'), T('desain antarmuka')], effort: 3, hours: 7, domain: 'proyek AI', descriptionLength: 'sedang' },
  { id: 'T10', skills: [T('penulisan akademik'), T('koordinasi')], effort: 4, hours: 12, domain: 'proyek AI', descriptionLength: 'panjang' },
  { id: 'T11', skills: [T('presentasi')], effort: 2, hours: 5, domain: 'proyek AI', descriptionLength: 'pendek' },
];

/**
 * 15 tugas non-IT sintetis. Didesain untuk menutupi domain, panjang deskripsi,
 * usaha, jumlah skill, dan skill "jarang". Id diberi awalan NIT-.
 */
interface NonItSpec {
  id: string;
  title: string;
  description: string;
  domain: string;
  skills: SkillTag[];
  effort: number;
  hours: number;
  descriptionLength: D1Task['descriptionLength'];
}

const NON_IT: NonItSpec[] = [
  {
    id: 'NIT-01',
    title: 'Menyusun kerangka makalah akademik',
    description: 'Menyusun kerangka bab dan subbab makalah beserta daftar rujukan awal. Deskripsi singkat karena rincian ditentukan dosen pembimbing.',
    domain: 'makalah akademik',
    skills: [T('penulisan akademik'), T('riset literatur')],
    effort: 3,
    hours: 7,
    descriptionLength: 'pendek',
  },
  {
    id: 'NIT-02',
    title: 'Rancangan penelitian sederhana (metode & instrumen)',
    description:
      'Merancang desain penelitian sederhana untuk studi di kelas: menentukan pertanyaan penelitian, memilih metode pengumpulan data (observasi dan angket), menyusun instrumen angket yang valid, serta menuliskan prosedur analisis data kualitatif sederhana. Deskripsi panjang karena harus menjelaskan tiap komponen metodologi yang akan dinilai oleh dosen.',
    domain: 'penelitian sederhana',
    skills: [T('riset literatur'), T('penulisan akademik')],
    effort: 4,
    hours: 12,
    descriptionLength: 'panjang',
  },
  {
    id: 'NIT-03',
    title: 'Membuat slide presentasi kelompok',
    description: 'Menyusun slide presentasi kelompok yang ringkas dan mudah dibaca.',
    domain: 'presentasi kelompok',
    skills: [T('presentasi'), T('desain antarmuka')],
    effort: 2,
    hours: 5,
    descriptionLength: 'pendek',
  },
  {
    id: 'NIT-04',
    title: 'Latihan dan pembagian waktu tampil presentasi',
    description: 'Melatih anggota tampil dan mengatur alokasi waktu tiap pembicara agar presentasi tepat waktu.',
    domain: 'presentasi kelompok',
    skills: [T('presentasi'), T('koordinasi')],
    effort: 2,
    hours: 4,
    descriptionLength: 'sedang',
  },
  {
    id: 'NIT-05',
    title: 'Analisis bisnis ringan (SWOT UMKM)',
    description:
      'Melakukan analisis SWOT untuk sebuah UMKM fiktif, mengumpulkan data penjualan sederhana, lalu menyusun rekomendasi strategi pemasaran singkat. Deskripsi menengah: cukup detail untuk menetapkan ruang lingkup tanpa membuat asumsi data nyata.',
    domain: 'analisis bisnis',
    skills: [T('riset literatur'), T('presentasi')],
    effort: 3,
    hours: 8,
    descriptionLength: 'sedang',
  },
  {
    id: 'NIT-06',
    title: 'Studi kasus pemasaran media sosial',
    description: 'Menganalisis satu studi kasus kampanye media sosial fiktif dan menuliskan pelajaran yang dapat diambil.',
    domain: 'studi kasus pemasaran',
    skills: [T('riset literatur'), T('penulisan akademik')],
    effort: 3,
    hours: 6,
    descriptionLength: 'sedang',
  },
  {
    id: 'NIT-07',
    title: 'Dokumentasi kegiatan (notulen & laporan)',
    description: 'Mencatat notulen rapat kelompok dan merapikannya menjadi dokumentasi kegiatan yang rapi.',
    domain: 'dokumentasi kegiatan',
    skills: [T('penulisan akademik'), T('koordinasi')],
    effort: 2,
    hours: 4,
    descriptionLength: 'pendek',
  },
  {
    id: 'NIT-08',
    title: 'Perencanaan acara kampus (rundown & anggaran)',
    description:
      'Menyusun rundown acara, membagi peran panitia, dan membuat perkiraan anggaran sederhana untuk sebuah acara kampus fiktif. Deskripsi panjang untuk memastikan tugas ini berat di koordinasi serta perencanaan, dan menuntut kemampuan mengomunikasikan keputusan ke seluruh panitia.',
    domain: 'perencanaan acara',
    skills: [T('koordinasi'), T('presentasi')],
    effort: 4,
    hours: 11,
    descriptionLength: 'panjang',
  },
  {
    id: 'NIT-09',
    title: 'Laporan observasi lapangan singkat',
    description: 'Menulis laporan hasil observasi singkat di lingkungan sekitar berdasarkan catatan lapangan.',
    domain: 'laporan observasi',
    skills: [T('penulisan akademik'), T('riset literatur')],
    effort: 3,
    hours: 6,
    descriptionLength: 'sedang',
  },
  {
    id: 'NIT-10',
    title: 'Desain publikasi poster kegiatan',
    description:
      'Mendesain poster kegiatan kelompok dengan tata letak yang jelas dan ramah dibaca. Deskripsi menengah; bobot visual dan keterbacaan menjadi penilaian utama.',
    domain: 'desain publikasi',
    skills: [T('desain antarmuka'), T('presentasi')],
    effort: 3,
    hours: 7,
    descriptionLength: 'sedang',
  },
  {
    id: 'NIT-11',
    title: 'Pengumpulan dan pembersihan data angket',
    description: 'Mengumpulkan hasil angket kelompok lalu membersihkan dan menabulasi datanya menjadi tabel ringkas.',
    domain: 'pengumpulan dan analisis data',
    skills: [T('data dan machine learning'), T('riset literatur')],
    effort: 3,
    hours: 8,
    descriptionLength: 'sedang',
  },
  {
    id: 'NIT-12',
    title: 'Analisis dan interpretasi data angket',
    description:
      'Menganalisis data angket yang telah dibersihkan, menghitung statistik deskriptif sederhana, membuat grafik, lalu menuliskan interpretasi yang menunjang kesimpulan makalah. Deskripsi panjang karena keluaran berupa bagian analisis yang harus konsisten dengan rumusan masalah.',
    domain: 'pengumpulan dan analisis data',
    skills: [T('data dan machine learning'), T('penulisan akademik')],
    effort: 5,
    hours: 16,
    descriptionLength: 'panjang',
  },
  {
    id: 'NIT-13',
    title: 'Revisi akhir dan pemeriksaan format makalah',
    description: 'Memeriksa format sitasi, daftar pustaka, dan konsistensi penomoran bab sebelum makalah dikumpulkan.',
    domain: 'makalah akademik',
    skills: [T('penulisan akademik')],
    effort: 2,
    hours: 4,
    descriptionLength: 'pendek',
  },
  {
    id: 'NIT-14',
    title: 'Penyusunan kuesioner dengan validasi ahli',
    description: 'Menyusun draf kuesioner, melakukan validasi isi kepada dosen, dan merevisi butir yang tidak valid.',
    domain: 'penelitian sederhana',
    skills: [T('riset literatur'), T('data dan machine learning')],
    effort: 4,
    hours: 10,
    descriptionLength: 'sedang',
  },
  {
    id: 'NIT-15',
    title: 'Naskah pidato pembuka presentasi',
    description: 'Menulis naskah pembuka presentasi kelompok yang menarik dan sesuai waktu yang tersedia.',
    domain: 'presentasi kelompok',
    skills: [T('presentasi'), T('penulisan akademik')],
    effort: 2,
    hours: 3,
    descriptionLength: 'pendek',
  },
];

/** D1Task sudah kompatibel dengan interface `Task` (id/title/description/difficulty/estimated_hours/required_skills). */
export type EngineTask = Task;

/**
 * Bangun D1 dengan mengimpor judul/deskripsi template asli dari katalog.
 * Dipisah asinkron-free tapi menerima katалоg sebagai argumen agar tidak
 * mengimpor modul yang memuat React.
 */
export function buildD1(catalog: readonly { id: string; title: string; description: string }[]): D1Task[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const out: D1Task[] = [];
  for (const meta of TEMPLATE_META) {
    const cat = byId.get(meta.id);
    if (!cat) throw new Error(`Template ${meta.id} tidak ada di katalog`);
    out.push({
      id: meta.id,
      title: cat.title,
      description: cat.description,
      difficulty: meta.effort,
      estimated_hours: meta.hours,
      required_skills: meta.skills,
      synthetic: true,
      origin: 'template',
      domain: meta.domain,
      descriptionLength: meta.descriptionLength,
    });
  }
  for (const spec of NON_IT) {
    out.push({
      id: spec.id,
      title: spec.title,
      description: spec.description,
      difficulty: spec.effort,
      estimated_hours: spec.hours,
      required_skills: spec.skills,
      synthetic: true,
      origin: 'synthetic-non-it',
      domain: spec.domain,
      descriptionLength: spec.descriptionLength,
    });
  }
  return out;
}

/** Validasi bahwa semua skill ada di taksonomi (dipakai script + test). */
export function validateD1(tasks: D1Task[]): string[] {
  const errors: string[] = [];
  const taxonomy = new Set<string>(SKILL_TAXONOMY);
  for (const t of tasks) {
    for (const s of t.required_skills) if (!taxonomy.has(s)) errors.push(`${t.id}: skill tidak dikenal "${s}"`);
    if (t.estimated_hours <= 0) errors.push(`${t.id}: estimated_hours harus > 0`);
    if (t.difficulty < 1 || t.difficulty > 5) errors.push(`${t.id}: difficulty di luar 1..5`);
    if (!t.synthetic) errors.push(`${t.id}: harus dilabeli synthetic`);
  }
  return errors;
}

export { TEMPLATE_META, NON_IT };
