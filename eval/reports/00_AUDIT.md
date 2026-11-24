# Fase 4 — Audit Keadaan Awal (read-only)

Dokumen ini mencatat audit **read-only** sebelum eksperimen apa pun dijalankan. Tidak ada
record yang diubah atau dihapus selama audit.

## 1. Repository

| Item | Nilai |
|---|---|
| Branch | `redesign/fuelplate-ui` |
| HEAD | `9b62e3d chore: initialize project repository` |
| Perubahan lokal (working tree) | 56 path belum di-commit (lihat `git status --short`) |
| Commit / push / deploy selama Fase 4 | **tidak ada** |

`app/p/` dan `test/integration/` adalah untracked (tidak ada baseline git), jadi tidak ada
`git diff` yang bisa dipakai membuktikan "tidak berubah" untuk path itu — bukti ketidakubahan
diambil dari mtime file + pembacaan isi.

## 2. Sumber kebenaran engine (dibaca dari kode, bukan diasumsikan)

- `lib/scoring/score.ts` — `computeSkillMatch`, `computeCapacity`, `computeInterest`,
  `normalizeCosineSimilarity`, `computeScore`. `computeScore` mengembalikan `total: 0` bila
  R1 atau R2 gagal; K dipaksa 0 saat `isFallback`.
- `lib/scoring/rules.ts` — `checkR1` (`capacity > 0`), `checkR2`
  (`newLoad <= idealLoad*1.25 && newLoad <= capacity`), `checkR3` (kandidat wajib punya ≥1 skill
  wajib level ≥3; jika tidak ada, kembalikan semua anggota). `checkR4`/`checkR5` adalah predikat
  trivial tanpa call site — ditegakkan secara struktural (lihat §5).
- `lib/scoring/assign.ts` — `globalAssign`: urut tugas `estimated_hours` desc,
  `idealLoad = totalEffort / members.length`, pool R3, pilih `total` tertinggi; jika tidak ada
  kandidat eligible, `absoluteBest` (utamakan R1, lalu jumlah komponen) **walaupun R2 gagal**.
- `lib/scoring/constants.ts` — `DEFAULT_WEIGHTS` K0.40/S0.30/C0.20/M0.10,
  `FALLBACK_WEIGHTS` K0/S0.50/C0.33/M0.17, `WORKLOAD_CAP_MULTIPLIER` 1.25, cosine 0.2/0.8.
- `lib/scoring/interaction.ts` — fungsi murni (tanpa React/DOM) untuk lock/undo/swap/what-if.
- `lib/scoring/explain-local.ts` — `memberReason`/`engineReason` faktual; header-nya
  mendokumentasikan bahwa `generateExplanation` (di `assign.ts`) tidak jujur.
- `lib/scoring/types.ts` — `SKILL_TAXONOMY` berisi **tepat 10 tag**.

Fakta kunci yang dipakai seluruh evaluasi (jangan diubah, ini objek yang dievaluasi):

- `K` dipaksa 0 pada mode cadangan → skor cadangan berskala 1.00 dari S/C/M.
- `checkR2` menggabungkan dua syarat: **batas 1,25×ideal DAN batas `capacity`**. Artinya
  kegagalan R2 tidak dapat dipisahkan dari "kapasitas habis".

## 3. Rekonsiliasi baseline database (PENTING)

Ada tiga angka baseline yang berbeda di laporan-laporan sebelumnya. Audit read-only per
2026-11-19 menghasilkan angka aktual, dan selisihnya dapat dijelaskan sepenuhnya.

| Sumber | projects | members | tasks | events |
|---|---|---|---|---|
| Laporan lama | 16 | 20 | 15 | — |
| `docs/STATUS.md` terbaru (sebelum Fase 4) | 18 | 22 | 16 | 5 |
| **Aktual saat audit Fase 4** | **19** | **24** | **17** | **5** |

### Penjelasan selisih (18/22/16 → 19/24/17)

Query read-only `created_at >= 2026-11-19T00:00:00`:

- projects +1, members +2, tasks +1 — **semuanya milik satu proyek `"ggg"`**.

Identitas proyek `"ggg"`:

| Field | Nilai |
|---|---|
| code | `d43d2ea8d60c4cc8468db1ec` |
| created_at | 2026-11-19T01:30:52Z |
| anggota | `heri` (cap 40), `veri` (cap 40) — dibuat 01:34 |
| tugas | "Identifikasi Masalah dan Domain" (5 jam, sumber `template`) — dibuat 01:38 |

Kesimpulan: `"ggg"` adalah **sesi pengguna nyata di UI** (membuat proyek, menambah dua anggota,
memuat satu template), dibuat **setelah** `docs/STATUS.md` terakhir ditulis dan **bukan** dibuat
oleh skrip evaluasi mana pun. Data ini **milik pengguna dan tidak disentuh**.

### Tentang "Smoke Test FR04 FR05"

Ada 2 proyek bernama `Smoke Test FR04 FR05`, keduanya **2026-11-17** (bagian dari riwayat
baseline, bukan kebocoran hari ini). Kebocoran run integrasi yang gagal pada sesi sebelumnya
(satu proyek + 2 task, dibuat 2026-11-18) **sudah dihapus** dan tidak muncul lagi di audit ini.

### Kesimpulan audit data

- Tidak ada record yatim yang diasumsikan; semua selisih diidentifikasi ke `"ggg"`.
- Tidak ada pembersihan dilakukan pada audit ini.
- **Baseline acuan untuk sisa Fase 4: 19 projects / 24 members / 17 tasks / 5 events.**

## 4. Status environment (blocker yang diketahui)

| Item | Status | Dampak |
|---|---|---|
| `GEMINI_API_KEY` | tidak ada di `.env.local` | jalur AI live, hybrid FR-06/FR-09, ablation live = **BLOCKED** |
| Reviewer manusia | belum ada 3 reviewer | human agreement = **BLOCKED** (instrumen saja) |
| D3 (data kelompok nyata) | tidak ada persetujuan peserta | **BLOCKED**, tidak dikumpulkan |
| Supabase latency | 196 ms – 5733 ms, sesekali `fetch failed` | memengaruhi integration test (dicatat terpisah) |

Eksperimen inti Fase 4 (D1/D2, R1–R5, 4 metode, metrik, ablation deterministik, truthfulness,
budget, robustness mock, performance) **tidak** membutuhkan Gemini maupun Supabase: engine
dipanggil langsung dari proses Node. Ini sesuai batasan "jangan menunggu API key".

## 5. Catatan awal R4/R5 (akan dibuktikan di laporan hard-rule)

`checkR4`/`checkR5` tidak dipanggil di mana pun di engine. R4 (satu penanggung jawab per tugas)
dan R5 (tugas terkunci tidak berubah) ditegakkan **secara struktural**: `globalAssign` menghasilkan
tepat satu `primaryMemberId` per task, dan `lockedMap` mempertahankan pemilik terkunci. Laporan
hard-rule akan menguji klaim ini langsung pada output `globalAssign`, bukan mengandalkan pembacaan
kode.
