# 00. Matriks Keterlacakan dan Indeks Bukti

Dokumen ini adalah **kontrak bukti** untuk seluruh laporan Fase 5. Setiap klaim di Bab 1–3, slide,
dan skrip demo harus punya baris di sini. Jika sebuah klaim tidak punya baris, klaim itu belum
layak ditulis.

Disusun 2026-11-19 setelah membaca ulang PRD, `DESIGN.md`, `docs/STATUS.md`, seluruh
`eval/reports/`, `eval/results/`, source code yang relevan, dan menjalankan ulang pemeriksaan.

---

## 1. Cara membaca kolom

| Kolom | Arti |
|---|---|
| **Klaim** | Kalimat yang akan muncul di laporan |
| **Rujukan** | ID PRD, FR, atau bagian dokumen |
| **Bukti implementasi** | File + baris yang membuktikan klaim |
| **Bukti hasil** | File hasil/JSON/CSV atau keluaran perintah yang membuktikan angka |
| **Status** | TERVERIFIKASI / TERVERIFIKASI SEBAGIAN / BLOCKED / TARGET |

Status dipakai ketat:

- **TERVERIFIKASI**: klaim dan angkanya dibaca langsung dari file hasil atau dijalankan ulang.
- **TERVERIFIKASI SEBAGIAN**: ada bukti, tetapi cakupannya lebih sempit dari yang mudah disimpulkan.
- **BLOCKED**: tidak bisa diverifikasi; alasannya dicatat.
- **TARGET**: itu ambang yang ingin dicapai, bukan hasil.

---

## 2. Kesesuaian PRD dengan Fase 5

| Temuan | Detail | Bukti |
|---|---|---|
| PRD v0.2 hanya memuat Bagian 1–7 | `grep "^# " prd.md` → 1, 2, 3, 4, 5, 6, 7, lalu `# END OF PRODUCT REQUIREMENTS DOCUMENT` | `prd.md:16,141,250,338,585,909,1140,1440` |
| Bagian 13, 14, 15, 16 **tidak ada** di PRD | Tidak ditemukan di `prd.md` maupun dokumen lain di repository | `grep -n "^# 1[3-6]" prd.md` → tidak ada hasil |
| PRD tetap merujuk "Bagian 8", "Bagian 9", "Bagian 10", "Bagian 12" | Bagian-bagian itu juga tidak ada di file | `prd.md:1423` ("Formula Bagian 8.4"), `AGENTS.md:4-7` |
| Instruksi Fase 5 meminta "Bagian 13, 14, 15, 16" sebagai acuan | Acuan itu tidak dapat dipenuhi dari repository | Brief T-5.MASTER |

**Keputusan penanganan konflik (sesuai aturan "BILA RAGU: tampilkan perbedaannya, jangan menebak"):**

1. Isi laporan memakai **PRD Bagian 1–7 yang benar-benar ada** ditambah hasil implementasi nyata.
2. Syarat format laporan (A4, Times New Roman 12 pt, spasi 1,5, margin 4/3/4/3 cm) diambil dari
   **brief Fase 5**, yang menyatakannya sebagai isi PRD Bagian 14. Karena Bagian 14 tidak ada di
   repository, persyaratan itu dicatat sebagai **ASUMSI dari brief**, bukan kutipan PRD.
3. Bagian bernomor 2 dan 3 di laporan (Landasan Teori, Hasil) mengikuti struktur brief, karena brief
   adalah instruksi kerja yang berlaku. Ketiadaan padanannya di PRD dicatat di sini, bukan disembunyikan.

---

## 3. Matriks keterlacakan klaim utama

### 3.1 Implementasi produk

| Klaim | Rujukan | Bukti implementasi | Bukti hasil | Status |
|---|---|---|---|---|
| Proyek dibuat dengan kode acak ≥ 10 karakter | FR-01, `prd.md:591` | `app/api/projects/route.ts` | `test/api/projects.test.ts` | TERVERIFIKASI |
| Anggota punya profil skill, minat, kapasitas, catatan | FR-03 | `app/p/[code]/members/[id]`, `supabase/migrations/003` | `test/api/member-profile.test.ts` | TERVERIFIKASI |
| 11 template tugas tersedia | FR-04, `prd.md:405` | `lib/constants/task-templates.ts` | dihitung: `id: 'T01'..'T11'` = **11** | TERVERIFIKASI |
| Skor K, S, C, M dihitung dengan rumus eksplisit | FR-07 | `lib/scoring/score.ts:11-78` | `test/scoring/numerical_8_4.test.ts` | TERVERIFIKASI |
| Bobot default K 0,40 / S 0,30 / C 0,20 / M 0,10 | FR-07 | `lib/scoring/constants.ts:5-10` | dibaca langsung | TERVERIFIKASI |
| Bobot fallback S 0,50 / C 0,33 / M 0,17, K = 0 | FR-13 | `lib/scoring/constants.ts:12-17` | `test/scoring/fallback.test.ts` | TERVERIFIKASI |
| R1: kapasitas 0 bukan kandidat | FR-07 | `lib/scoring/rules.ts:4` | `eval/results/hard_rules.json` (3 kasus R1) | TERVERIFIKASI |
| R2: beban ≤ 1,25 × ideal **dan** ≤ kapasitas | FR-07 | `lib/scoring/rules.ts:8-12` | `eval/results/hard_rules.json` (3 kasus R2) | TERVERIFIKASI |
| R3: kandidat wajib level ≥ 3 pada skill wajib | FR-07 | `lib/scoring/rules.ts:14` | `eval/results/hard_rules.json` (4 kasus R3) | TERVERIFIKASI |
| R4: satu pemilik per tugas | FR-07 | `lib/scoring/assign.ts` | `hard_rules.json` (2 kasus R4) | TERVERIFIKASI |
| R5: tugas terkunci mempertahankan pemilik | FR-07 | `lib/scoring/assign.ts:41-56` | `hard_rules.json` (3 kasus R5) | TERVERIFIKASI |
| 15 kasus aturan keras semuanya lolos | FR-07 | `eval/scripts/run_hard_rules.test.ts` | `hard_rules.json`: 15 entri, semua `"pass": true` | TERVERIFIKASI |
| Slider bobot menghitung ulang tanpa request jaringan | FR-10, NFR | `lib/scoring/interaction.ts` | `L_PERFORMANCE.md`: 0 request | TERVERIFIKASI |
| Mode what-if berjalan lokal | FR-18 | `app/p/[code]/result/*` | `L_PERFORMANCE.md` §2 | TERVERIFIKASI |
| Ekspor CSV + teks tanpa Gemini | FR-14 | `result-client.tsx` | `docs/STATUS.md:24` | TERVERIFIKASI |

### 3.2 Integrasi AI

| Klaim | Rujukan | Bukti implementasi | Bukti hasil | Status |
|---|---|---|---|---|
| Model awal menghasilkan HTTP 404 | FR-06, NFR-06 | `.env.local` lama | `T-2.06_GEMINI_INTEGRATION_AUDIT.md` §2 | TERVERIFIKASI |
| Embedding pengganti menghasilkan 768 dimensi | FR-06 | `lib/ai/embedding-cache.ts:5,11-17` | `T-2.07` §4: `dim=768` | TERVERIFIKASI |
| `isFallback: false` terbukti pada rekomendasi live | FR-13 | `app/api/recommend/route.ts:85` | `T-2.07` §5 | TERVERIFIKASI |
| Gemini Text berhasil pada probe | FR-06 | `lib/ai/analyze-task.ts:26,54` | `T-2.07` §3 | TERVERIFIKASI |
| FR-09 pada satu run terhalang HTTP 429 | FR-09 | `lib/ai/explain.ts:212-215` | `T-2.07` §8 | TERVERIFIKASI |
| Pemakaian Gemini untuk teks penjelasan **belum** terbukti per-run | FR-09 | `explain.ts:154-166` | `T-2.07` §8; `docs/STATUS.md:15` | **TERVERIFIKASI SEBAGIAN** |
| Maksimal 3 panggilan Gemini per proses | NFR-06 | `lib/ai/call-budget.ts:14,79-96` | `ai_budget.json`: 4 kasus | TERVERIFIKASI |
| Cache hit tidak dihitung sebagai panggilan | NFR-06 | `lib/ai/analyze-task.ts:117-127` | `T-2.07` §5 run #2 (+0 baris cache, 0 panggilan embed) | TERVERIFIKASI |
| Kegagalan Gemini selalu jatuh ke template, bukan error | FR-13 | `explain.ts:212-215` | `robustness.json` kondisi 2, 5 | TERVERIFIKASI |
| Kuota free tier 20 request/hari per model | keadaan operasional | - | `T-2.07` §3 pesan 429 | TERVERIFIKASI |
| Kerentanan: pola redaksi kunci tidak mengenali format `AQ.` | temuan audit | `lib/ai/call-budget.ts:158` | `T-2.06` §10 butir 2 | TERVERIFIKASI |

### 3.3 Evaluasi (Bab 3)

| Klaim | Angka | Bukti hasil | Status |
|---|---|---|---|
| Dataset D1 berisi 26 tugas (11 template + 15 non-IT) | 26 | `dataset_summary.json` → `d1.total` | TERVERIFIKASI |
| Dataset D2 berisi 20 skenario, 15 kondisi | 20 / 15 | `dataset_summary.json` → `d2` | TERVERIFIKASI |
| D2 memuat 49 anggota dan 35 tugas | 49 / 35 | `dataset_summary.json` → `d2.totalMembers/totalTasks` | TERVERIFIKASI |
| Skill coverage Hybrid | 0,808 | `methods_summary.json` → `hybrid.skillCoverage.mean` | TERVERIFIKASI |
| Skill coverage Random (30 seed, 600 run) | 0,754 | `methods_summary.json` → `random` | TERVERIFIKASI |
| Skill coverage Round-robin | 0,808 | `methods_summary.json` → `round-robin` | TERVERIFIKASI |
| Skill coverage Manual | 0,867 | `methods_summary.json` → `manual` | TERVERIFIKASI |
| Load stddev Hybrid | 5,62 | `methods_summary.json` → `hybrid.loadStdDev.mean` | TERVERIFIKASI |
| Load stddev Random | 5,30 | `methods_summary.json` → `random` | TERVERIFIKASI |
| Load stddev Round-robin | 3,88 | `methods_summary.json` → `round-robin` | TERVERIFIKASI |
| Load stddev Manual | 5,62 | `methods_summary.json` → `manual` | TERVERIFIKASI |
| Pelanggaran R1 Hybrid | 0 | `r1ViolationsTotal` | TERVERIFIKASI |
| Pelanggaran R1 Random | 31 | `r1ViolationsTotal` | TERVERIFIKASI |
| Pelanggaran R1 Round-robin | 2 | `r1ViolationsTotal` | TERVERIFIKASI |
| Pelanggaran R1 Manual | 2 | `r1ViolationsTotal` | TERVERIFIKASI |
| Pelanggaran R3 Hybrid | 1 | `r3ViolationsTotal` | TERVERIFIKASI |
| Pelanggaran R3 Random | 147 | `r3ViolationsTotal` | TERVERIFIKASI |
| Pelanggaran R3 Round-robin | 4 | `r3ViolationsTotal` | TERVERIFIKASI |
| Pelanggaran R3 Manual | 0 | `r3ViolationsTotal` | TERVERIFIKASI |
| Pelanggaran R2 final Hybrid | 24 | `r2FinalViolationsTotal` | TERVERIFIKASI |
| Pelanggaran R2 final Random | 752 | `r2FinalViolationsTotal` | TERVERIFIKASI |
| Pelanggaran R2 final Round-robin | 18 | `r2FinalViolationsTotal` | TERVERIFIKASI |
| Pelanggaran R2 final Manual | 24 | `r2FinalViolationsTotal` | TERVERIFIKASI |
| Fit Hybrid | 0,645 | `fit.mean` | TERVERIFIKASI |
| Fit Random | 0,585 | `fit.mean` | TERVERIFIKASI |
| Fit Round-robin | 0,674 | `fit.mean` | TERVERIFIKASI |
| Fit Manual | 0,668 | `fit.mean` | TERVERIFIKASI |
| Ablasi: 25,7 % keputusan berpindah | 0,2571 (9/35 tugas) | `ablation.json` → `movedFraction` | TERVERIFIKASI |
| Ablasi: Δ skill coverage = 0 | 0 | `ablation.json` → `coverageDeltaMean` | TERVERIFIKASI |
| Ablasi memakai **proxy deterministik**, bukan embedding live | - | `ablation.json` → `summary.note`, `liveAblation: "BLOCKED"` | **TERVERIFIKASI SEBAGIAN** |
| `memberReason`: 33 dari 33 klaim benar | 33/33 | `truthfulness.json` → `memberReason.claimCounts` | TERVERIFIKASI |
| `generateExplanation`: 2 kontradiksi, 8 klaim tak didukung | 2 / 8 dari 26 | `truthfulness.json` → `generateExplanation.claimCounts` | TERVERIFIKASI |
| Komputasi P95 lintas 20 skenario | 0,44–0,97 ms (bervariasi antarpengulangan) | `performance.json` → `pipelineAll20Scenarios.p95`; 5 pengulangan 2026-11-19 | TERVERIFIKASI (sebagai rentang, bukan angka tunggal) |
| Slider median (browser) | 2,5 ms | `L_PERFORMANCE.md` §2 | TERVERIFIKASI |
| Slider CPU 4× throttle | 11,6 ms | `L_PERFORMANCE.md` §2 | TERVERIFIKASI |
| End-to-end `/api/recommend` | 2,14–3,48 s | `L_PERFORMANCE.md` §3 | TERVERIFIKASI |
| Target end-to-end < 1 detik **belum** terpenuhi | - | `L_PERFORMANCE.md` §4 catatan | **TARGET** (belum tercapai) |
| Human agreement | - | `G_HUMAN_AGREEMENT.md`: BLOCKED | **BLOCKED** |
| Data D3 (kelompok nyata) | - | tidak ada di `eval/datasets/` | **BLOCKED** |

### 3.4 Pengujian

| Klaim | Angka | Bukti | Status |
|---|---|---|---|
| Unit test non-integrasi lulus | 286 lulus / 21 file | `npx vitest run --exclude 'test/integration/**' --exclude 'test/ai/gemini-models.live.test.ts'` (dijalankan ulang hari ini) | TERVERIFIKASI |
| Suite eval lulus | 14 test / 7 file | `npx vitest run --config eval/vitest.eval.config.ts` (dijalankan ulang hari ini) | TERVERIFIKASI |
| `tsc --noEmit` bersih | exit 0 | dijalankan ulang | TERVERIFIKASI |
| `eslint .` tanpa error | 0 error, 2 warning | dijalankan ulang | TERVERIFIKASI |
| Live test model Gemini | 4 lulus / 1 gagal | `test/ai/gemini-models.live.test.ts` | **TERVERIFIKASI (kegagalan tercatat, bukan disembunyikan)** |
| Integrasi Supabase stabil | - | `L_PERFORMANCE.md` §3 (satu sampel 2,9 s, pernah `fetch failed`) | **BLOCKED** (fluktuasi) |

---

## 4. Angka yang diperiksa ulang hari ini

Perintah dijalankan pada 2026-11-19, pada commit kerja yang sama dengan Fase 4:

```
npx tsc --noEmit                                    -> exit 0
npx eslint .                                        -> 0 error, 2 warning
npx vitest run --exclude 'test/integration/**' \
               --exclude 'test/ai/gemini-models.live.test.ts'
                                                    -> 21 file, 286 test lulus
npx vitest run --config eval/vitest.eval.config.ts  -> 7 file, 14 test lulus
```

Semua angka Bab 3 berasal dari `eval/results/*.json` yang dibaca ulang, bukan dari ringkasan lama
saja.

---

## 5. Indeks bukti per berkas

| Kelompok | Berkas | Dipakai di |
|---|---|---|
| Metode | `eval/results/methods_summary.json`, `methods_per_scenario.json`, `methods_summary.csv` | Bab 3.4 |
| Aturan | `eval/results/hard_rules.json` | Bab 3.3 |
| Ablasi | `eval/results/ablation.json` | Bab 3.5 |
| Kejujuran | `eval/results/truthfulness.json` | Bab 3.6 |
| Performa | `eval/results/performance.json`, `eval/reports/L_PERFORMANCE.md` | Bab 3.7 |
| Robustness | `eval/results/robustness.json` | Bab 3.8 |
| Anggaran AI | `eval/results/ai_budget.json` | Bab 2.11, 3.8 |
| Dataset | `eval/results/dataset_summary.json`, `eval/datasets/d1_tasks.ts`, `d2_scenarios.ts` | Bab 2.10 |
| Gemini | `eval/reports/T-2.06_GEMINI_INTEGRATION_AUDIT.md`, `T-2.07_GEMINI_FIX_VERIFICATION.md` | Bab 3.9 |
| Interpretasi | `eval/reports/A_P_FINAL.md` s.d. `O_RECOMMENDATIONS.md` | Bab 3, 4 |

---

## 6. Klaim yang sengaja TIDAK dibuat

Daftar ini sama pentingnya dengan matriks di atas. Semua klaim berikut **tidak** akan muncul di laporan:

- "Hybrid adalah metode terbaik secara keseluruhan." Tidak benar: manual unggul di skill coverage,
  round-robin unggul di keseragaman beban.
- "Embedding semantik meningkatkan kualitas penugasan." Belum diuji live. Ablasi hanya memakai proxy.
- "Seluruh penjelasan bebas kesalahan." `generateExplanation` punya 2 kontradiksi terukur.
- "Gemini menangani analisis, embedding, dan penjelasan dengan sukses." Embedding dan text terbukti;
  pemakaian teks penjelasan per-run belum.
- "Sistem telah divalidasi oleh pengguna." Tidak ada reviewer, tidak ada data D3.
- "Waktu respons di bawah 1 detik." Komputasi ya, alur end-to-end tidak.
- "Supabase stabil." Ada bukti fluktuasi.
- "Sistem meningkatkan pemerataan secara keseluruhan." Trade-off, bukan dominasi.
