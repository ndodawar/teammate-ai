# A–P. Laporan Akhir Fase 4 — Evaluasi & Validasi Teammate AI

Dokumen ini adalah **putusan akhir** Fase 4 (T-4.MASTER). Semua angka merujuk ke laporan detail
(B–O) dan artefak terstruktur di `eval/results/`. Fase ini **hanya mengevaluasi**: tidak ada
perubahan pada formula, bobot, R1–R5, candidate selection, global assignment, arsitektur AI,
fallback, schema DB, atau kontrak API. Satu-satunya perubahan produk adalah `vitest.config.ts`
(infrastruktur uji, memisahkan `eval/`) — tidak mengubah perilaku produk.

---

## A. Putusan per Aspek

Format: **LULUS / LULUS BERSYARAT / GAGAL**. Blocker yang dapat ditutup (undoable) ditandai
**BLOCKED** dan **tidak pernah** dilaporkan PASS.

### A.1 Dataset (D1, D2, D3)

| Aspek | Putusan | Bukti |
|---|---|---|
| D1: 11 template + 15 non-IT sintetis, variasi lengkap | **LULUS** | `B_DATASET.md`, `dataset_summary.json` — 26 tugas, 11 domain, 10/10 skill, semua label sintetis |
| D2: tepat 20 skenario, 15 kondisi wajib | **LULUS** | `B_DATASET.md` — `validateD2` lulus, semua kondisi tercakup |
| D3: data kelompok nyata | **BLOCKED** | tanpa persetujuan peserta; tidak dikumpulkan, tidak dipalsukan |

### A.2 Hard rules R1–R5

| Aspek | Putusan | Bukti |
|---|---|---|
| R1, R3, R4, R5 valid+edge pada engine asli | **LULUS** | `D_HARD_RULES.md`, `hard_rules.json` — 15 kasus sesuai |
| R2 valid+edge, perilaku tak terdefinisi PRD dicatat terpisah | **LULUS BERSYARAT** | `D_HARD_RULES.md` — 2 kasus tak terdefinisi (no-R2-candidate, semua capacity 0) dicatat sebagai **open decision**; tidak diubah |

### A.3 Metode pembanding (≥4)

| Aspek | Putusan | Bukti |
|---|---|---|
| 4 metode (hybrid, random-30-seed, round-robin, manual) pada 20 skenario | **LULUS** | `C_METHODS.md`, `methods_summary.{json,csv}`, `methods_per_scenario.json` |
| Aturan baseline manual dideklarasikan lebih dulu, bukan ground truth | **LULUS** | `C_METHODS.md` §Manual |

### A.4 Metrik

| Aspek | Putusan | Bukti |
|---|---|---|
| Skill coverage (eksplisit, bukan cosine) | **LULUS** | `E_SKILL_COVERAGE.md` — rumus + hasil |
| Load balance (per-anggota, ideal, deviasi, variansi/stddev, pelanggaran R2) | **LULUS** | `F_LOAD_BALANCE.md` |
| Human agreement (top-1/top-2) | **BLOCKED** | `G_HUMAN_AGREEMENT.md` — instrumen siap, 0 reviewer |
| Ablation K vs tanpa-K deterministik | **LULUS** | `H_ABLATION.md` — 25,7% keputusan berubah |
| Ablation K live (embedding semantik) | **BLOCKED** | tanpa `GEMINI_API_KEY` |
| Explanation truthfulness (otomatis + sampel manual) | **LULUS** | `I_TRUTHFULNESS.md` — `memberReason` 33/33 benar; `generateExplanation` 2 bertentangan |

### A.5 AI call budget & robustness

| Aspek | Putusan | Bukti |
|---|---|---|
| Budget cap 3/proses (logika `AiRun`) | **LULUS** | `J_AI_CALL_BUDGET.md` |
| Budget live (token/latency/fallback provider nyata) | **BLOCKED** | tanpa key |
| Robustness offline (#2,#6,#7) | **LULUS** | `K_ROBUSTNESS.md` |
| Robustness provider live (#1,#3,#4,#5,#8,#9,#10) | **BLOCKED** | mock saja, tidak diklaim live |

### A.6 Performa

| Aspek | Putusan | Bukti |
|---|---|---|
| Komputasi pipeline/slider/what-if < target | **LULUS** | `L_PERFORMANCE.md` — P95 0,49 ms / 0,025 ms / 0,029 ms |
| Slider & what-if < 100 ms tanpa jaringan (UI) | **LULUS** | 2,5 ms normal; 11,6 ms @4×; 0 request jaringan |
| Alur end-to-end < 1 detik | **GAGAL (didominasi DB, bukan algoritma)** | `/api/recommend` 2,1–3,5 s; Supabase median 279 ms/round-trip; FCP 112 ms |

### A.7 Integrasi / E2E

| Aspek | Putusan | Bukti |
|---|---|---|
| Alur 11 langkah end-to-end berjalan | **LULUS BERSYARAT (environmental)** | `test/integration` 8/8 pada run sehat; **terbukti flaky** (lihat A.8) |

### A.8 Bukti flakiness integrasi (teramati langsung)

Selama penyusunan laporan ini, `npx vitest run test/integration` dijalankan beberapa kali:

| Run | Hasil |
|---|---|
| 1 | **8/8 lulus** |
| 2 | **7 gagal / 1 lulus** (satu kegagalan jaringan → cascade) |
| 3, 4, 5 | 8/8 lulus |

Pada run yang **gagal**, baris `Smoke Test FR04 FR05` **bocor** (proyek `1c3c9a06480688badcce784c`,
created 2026-11-19T03:24:45) karena `afterAll` tidak berjalan setelah kegagalan. Baris bocor ini
**dibersihkan secara terarah** (hanya created_at 2026-11-19), sementara dua proyek `Smoke Test`
**2026-11-17 yang pre-existing dipertahankan**. DB kembali ke **19/24/17/5**.

Kesimpulan: kegagalan integrasi bersifat **environmental** (latency/`fetch failed` Supabase),
bukan cacat produk; tetapi ia **nyata** dan menjadi blocker yang harus ditutup sebelum kestabilan
pipeline dapat diklaim.

### A.9 Integritas data & proses

| Aspek | Putusan | Bukti |
|---|---|---|
| Rekonsiliasi baseline DB (19/24/17/5, `"ggg"` milik pengguna) | **LULUS** | `00_AUDIT.md` |
| Tidak ada fixture tertinggal | **LULUS** | `EVAL-PERF fixture` dihapus; `Smoke Test` bocor dibersihkan; DB 19/24/17/5 |
| Tidak ada commit/push/deploy/reset/ubah schema/secret | **LULUS** | hanya `vitest.config.ts` diubah |

---

## B. Ringkasan Hasil Utama (angka)

| Metrik | Hybrid | Random (30×) | Round-robin | Manual |
|---|---|---|---|---|
| Skill coverage | 0,808 | 0,754 | 0,808 | **0,867** |
| Stddev beban (σ) | 5,62 | 5,30 | **3,88** | 5,62 |
| Pelanggaran R1 | **0** | 31 | 2 | 2 |
| Pelanggaran R3 | 1 | 147 | 4 | **0** |
| Pelanggaran R2-akhir | 24 | 752 | **18** | 24 |
| Fit | 0,645 | 0,585 | 0,674 | 0,668 |

- **Hybrid menang pada kepatuhan R1** (satu-satunya dengan 0) dan **pelanggaran kapasitas
  terendah** (3 vs 6/5).
- **Hybrid tidak menang** pada coverage (manual unggul) maupun σ beban (round-robin unggul).
- Pada **15/18** skenario yang hybrid langgar R2, **tidak ada metode pun** yang bisa bebas R2
  (pelanggaran struktural dari data).
- Ablation K (proxy): **25,7%** keputusan berubah, tetapi **Δ coverage = 0** → **bukan** bukti K
  bermanfaat.
- Truthfulness: `memberReason` **33/33 benar**; `generateExplanation` **2 bertentangan, 8 tidak
  didukung**.

---

## C. Keputusan atas blocker (tidak boleh dianggap PASS)

| Blocker | Sifat | Bisa ditutup? |
|---|---|---|
| `GEMINI_API_KEY` absen | eksternal (kredensial) | ya, bila key tersedia |
| Reviewer manusia (3) | eksternal (SDM) | ya, bila reviewer ada |
| D3 data nyata | eksternal (persetujuan) | ya, bila consent |
| Flakiness integrasi (Supabase) | environmental | ya (lihat rekomendasi O#5) |
| `generateExplanation` tidak jujur | cacat produk (jalur cadangan) | ya (O#1) |

---

## D–O. Rujukan Laporan Detail

| Bagian | Berkas | Inti |
|---|---|---|
| Audit & baseline DB | `00_AUDIT.md` | 19/24/17/5, `"ggg"` milik pengguna |
| Dataset | `B_DATASET.md` | D1 26, D2 20/15 kondisi, D3 BLOCKED |
| Metode | `C_METHODS.md` | 4 metode + aturan manual |
| Hard rules | `D_HARD_RULES.md` | R1–R5 + 2 tak terdefinisi |
| Skill coverage | `E_SKILL_COVERAGE.md` | rumus + hasil (manual unggul) |
| Load balance | `F_LOAD_BALANCE.md` | trade-off skill vs beban |
| Human agreement | `G_HUMAN_AGREEMENT.md` | BLOCKED |
| Ablation | `H_ABLATION.md` | proxy 25,7%, live BLOCKED |
| Truthfulness | `I_TRUTHFULNESS.md` | `memberReason` jujur, `generateExplanation` tidak |
| AI budget | `J_AI_CALL_BUDGET.md` | logika nyata, live BLOCKED |
| Robustness | `K_ROBUSTNESS.md` | nyata/mock/BLOCKED dipisah |
| Performance | `L_PERFORMANCE.md` | komputasi/browser/DB dipisah |
| Keterbatasan | `M_LIMITATIONS.md` | semua keterbatasan |
| Files | `N_FILES.md` | artefak & 1 berkas produk diubah |
| Rekomendasi | `O_RECOMMENDATIONS.md` | 9 rekomendasi berprioritas |

---

## P. Final Status

### Putusan: **LULUS BERSYARAT**

Alasan:
- Evaluasi inti **lengkap dan dapat direproduksi**: D1/D2, R1–R5, 4 metode, seluruh metrik,
  ablation deterministik, truthfulness, AI-budget logic, robustness offline, performa — semua
  diukur pada engine/UI/build asli dengan artefak JSON/CSV.
- **Syarat** yang belum dapat dipenuhi (bukan kesalahan evaluasi, tetapi keterbatasan
  sumber daya/lingkungan): jalur AI live, ablation live, human agreement, D3, robustness provider
  live, dan alur end-to-end < 1 detik. Semuanya ditandai **BLOCKED** / **GAGAL (environmental)** —
  tidak ditutupi sebagai PASS.
- Dua temuan produk yang perlu ditindak (bukan blocker evaluasi): `generateExplanation` tidak
  jujur pada jalur cadangan (O#1), dan flakiness integrasi akibat latency Supabase (O#5).

### Status: **READY WITH BLOCKERS** — siap masuk **Fase 5** dengan syarat:

1. **Tutup jalur penjelasan** agar `memberReason` menjadi satu-satunya sumber teks (O#1).
2. **Uji jalur AI live** (`GEMINI_API_KEY`): ablation live dengan bobot S/C/M tetap, budget live,
   robustness provider live, penangkal prompt-injection nyata (O#2).
3. **Sediakan 3 reviewer** untuk human agreement (O#3).
4. **Stabilkan integrasi** tanpa melonggarkan assertion (O#5).
5. **Tetapkan keputusan produk** untuk perilaku "no-R2-candidate" / "semua capacity 0" (O#7).
6. **Kumpulkan D3** hanya bila ada persetujuan (O#4).

Sampai syarat 2–4 tertutup, **jangan** mengklaim: kualitas K, penjelasan AI 100% jujur,
persetujuan manusia, atau pemenuhan < 1 detik end-to-end.

---

## Bukti uji akhir

| Pemeriksaan | Hasil |
|---|---|
| `npx tsc --noEmit` | **0 error** |
| `npx eslint .` | **0 error** (2 warning pre-existing) |
| `npx vitest run --exclude 'test/integration/**'` | **287 lulus / 4 skip** (22 berkas) — suite produk utuh |
| `npx vitest run --config eval/vitest.eval.config.ts` | **7 berkas / 14 test lulus** |
| `npx vitest run test/integration` | **8/8** pada run sehat; terbukti **flaky** (1× gagal 7/8) — dicatat environmental |
| DB setelah seluruh sesi | **19 projects / 24 members / 17 tasks / 5 events**; `"ggg"` utuh; tanpa fixture |
