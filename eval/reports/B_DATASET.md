# B. Dataset

Semua data kelompok di sini **SINTETIS**. Tidak ada data pribadi/kelompok nyata. Berkas:
`eval/datasets/d1_tasks.ts`, `eval/datasets/d2_scenarios.ts`; divalidasi oleh
`eval/scripts/validate_datasets.test.ts` → `eval/results/dataset_summary.json`.

## D1 — Template + tugas non-IT

**26 tugas**: 11 template resmi (T01–T11) + 15 tugas non-IT sintetis (NIT-01..NIT-15).
Semua diberi label `synthetic: true`.

Tentang 11 template: katalog produk hanya menyimpan `id/title/description`. Metadata **skill,
effort, dan jam** untuk tiap template dipetakan mengikuti isi deskripsi (mis. T05 "Dasar Teori" →
riset literatur + penulisan akademik). Pemetaan ini **data sintetis eksperimen**, bukan data
produksi — dinyatakan terbuka.

### Variasi yang dipenuhi

| Dimensi | Sebaran |
|---|---|
| Domain | proyek AI, makalah akademik, penelitian sederhana, presentasi kelompok, analisis bisnis, studi kasus pemasaran, dokumentasi kegiatan, perencanaan acara, laporan observasi, desain publikasi, pengumpulan & analisis data (11 domain) |
| Panjang deskripsi | pendek 7, sedang 12, panjang 7 |
| Usaha | rendah (≤4 jam) 6, sedang (5–10) 15, tinggi (>10) 5 |
| Jumlah skill | 1 skill: 4, multi-skill: 22 |
| Skill taksonomi dipakai | **10/10** tag |
| Skill "jarang" | `data dan machine learning`, `pemrograman backend` dipakai lebih sedikit anggota di D2 |

## D2 — 20 skenario kelompok

**Tepat 20 skenario** (S01–S20), seed deterministik, total 51 anggota & 58 tugas sintetis.
Tiap skenario memuat: ID unik, profil anggota (skill+level, minat, kapasitas, beban awal), daftar
tugas (skill wajib, effort, jam, kunci), `specialCondition`, dan `expected` (perilaku hard-rule).

### Cakupan 15 kondisi wajib PRD

| Kondisi | Skenario |
|---|---|
| Skill merata | S01, S20 |
| Satu anggota sangat tinggi | S02, S18 |
| Kapasitas rendah | S03, S16, S17 |
| Kapasitas tinggi | S04 |
| Minat berbeda | S05, S17 |
| Skill tidak cocok tugas | S06, S19 |
| Semua anggota < level 3 | S07 |
| Tidak ada kandidat R2 | S08 |
| Jam tersedia nol | S09, S19 |
| Tugas usaha tinggi | S10 |
| Skill wajib beragam | S11, S16 |
| Tugas bersaing anggota sama | S12, S18 |
| Tugas terkunci | S13 |
| Beban awal tak seimbang | S14, S20 |
| Skill+minat tinggi, kapasitas rendah | S15 |

S16–S20 adalah **kombinasi** kondisi, memastikan total tepat 20 dan tiap kondisi wajib tercakup.

### Catatan pemodelan beban awal

Engine `globalAssign` menghitung beban dari tugas pada input (mulai 0) dan **tidak** menerima
"beban awal" terpisah. Karena itu "beban awal tidak seimbang" (S14, S20) dimodelkan dengan
**tugas yang sudah terkunci** ke anggota tertentu — satu-satunya cara beban awal masuk ke
perhitungan engine secara sah. Field `initialLoad` disimpan sebagai dokumentasi niat desain dan
dibuat konsisten dengan tugas terkunci yang direpresentasikan.

### Seed & reproduksi

`EVAL_CONFIG.masterSeed = 20260419` (`eval/lib/config.ts`). Semua metode berurutan memakai urutan
engine (effort desc); random memakai seed turunan `hash(master,'random',scenarioId,r)` untuk
r=0..29. Menjalankan ulang menghasilkan input & hasil identik.

## D3 — Kelompok nyata

**Tidak dilakukan (BLOCKED).** Tidak ada persetujuan peserta, sehingga tidak ada data kelompok
nyata yang dikumpulkan atau dipakai. D3 **tidak** digantikan data sintetis lalu disebut "nyata":
seluruh hasil di laporan ini secara eksplisit berasal dari **data sintetis D1/D2**.
