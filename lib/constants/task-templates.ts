export interface TaskTemplateItem {
  id: string;
  title: string;
  description: string;
}

export const TASK_TEMPLATES: readonly TaskTemplateItem[] = [
  {
    id: 'T01',
    title: 'Identifikasi Masalah dan Domain',
    description:
      'Mengidentifikasi masalah sederhana yang akan diselesaikan menggunakan konsep Artificial Intelligence. Menentukan domain permasalahan dan konteks penggunaannya.',
  },
  {
    id: 'T02',
    title: 'Pemilihan Pendekatan AI',
    description:
      'Menentukan pendekatan AI yang akan digunakan dalam proyek. Pilihan pendekatan dari dokumen tugas: Search Algorithm, Rule-Based Reasoning, Expert System, Simple Recommendation, Game AI, Simple Machine Learning.',
  },
  {
    id: 'T03',
    title: 'Penyusunan Latar Belakang',
    description:
      'Menyusun latar belakang yang menjelaskan konteks masalah, alasan pemilihan masalah, dan pentingnya solusi yang akan dikembangkan.',
  },
  {
    id: 'T04',
    title: 'Rumusan Masalah dan Tujuan',
    description:
      'Menyusun rumusan masalah dan tujuan proyek yang sesuai dengan permasalahan serta solusi yang akan dikembangkan.',
  },
  {
    id: 'T05',
    title: 'Dasar Teori dan Konsep AI',
    description:
      'Menyusun dasar teori, konsep Artificial Intelligence, dan penjelasan pendekatan AI yang digunakan dalam proyek.',
  },
  {
    id: 'T06',
    title: 'Desain Sistem',
    description:
      'Menyusun rancangan sistem yang menggambarkan komponen utama, kebutuhan sistem, dan proses kerja prototipe yang akan dibangun.',
  },
  {
    id: 'T07',
    title: 'Arsitektur Solusi AI',
    description:
      'Menjelaskan arsitektur solusi AI, hubungan antarbagian, alur pemrosesan, dan cara pendekatan AI diterapkan dalam sistem.',
  },
  {
    id: 'T08',
    title: 'Identifikasi Dataset',
    description:
      'Mengidentifikasi dataset yang digunakan, sumber dataset, karakteristik data, dan relevansinya terhadap pendekatan AI.',
  },
  {
    id: 'T09',
    title: 'Pengembangan Prototipe',
    description:
      'Mengembangkan prototipe program sederhana yang menerapkan minimal satu konsep AI sesuai pendekatan proyek.',
  },
  {
    id: 'T10',
    title: 'Pengujian dan Evaluasi',
    description:
      'Melakukan pengujian sederhana terhadap sistem, mencatat hasil pengujian, dan mengevaluasi hasil kerja prototipe.',
  },
  {
    id: 'T11',
    title: 'Penyusunan Laporan dan Presentasi',
    description:
      'Menyusun laporan proyek sesuai ketentuan tiga bab: Bab 1 Pendahuluan, Bab 2 Pembahasan, Bab 3 Penutup. Melengkapi referensi ilmiah minimal 10 sumber dan menyiapkan presentasi serta demonstrasi program.',
  },
] as const;
