# N. Files & Artefak

Daftar seluruh berkas yang **dibuat** dan **diubah** selama Fase 4. Tidak ada commit/push/deploy.

## 1. Berkas produk yang diubah (hanya 1, infrastruktur uji)

| Berkas | Perubahan | Alasan | Dampak produk |
|---|---|---|---|
| `vitest.config.ts` | tambah `exclude: ['node_modules/**', '.git/**', 'eval/**']` pada `test` | memisahkan harness evaluasi dari suite produk sehingga `npm test` tetap 287/4 | **tidak ada** perubahan kode/assertion/engine; hanya cakupan glob vitest |

Tidak ada berkas lain di `app/`, `lib/`, `components/`, `supabase/`, atau `test/` yang diubah.
Berkas yang sudah ada sebelumnya di `app/` dan `test/integration/` adalah untracked (tanpa baseline
git), sehingga bukti "tidak berubah" diambil dari pembacaan isi + mtime, bukan `git diff`.

## 2. Harness evaluasi (dibuat) — `eval/`

### Konfigurasi & library

| Berkas | Isi |
|---|---|
| `eval/vitest.eval.config.ts` | config vitest terpisah (include `eval/**/*.test.ts`, alias `@`→root, timeout 120 s) |
| `eval/README.md` | cara reproduksi, perintah per runner, tabel status BLOCKED |
| `eval/lib/config.ts` | `EVAL_CONFIG` (seed 20260419, repeats 30, target perf, dll.) |
| `eval/lib/prng.ts` | `hashSeed` (FNV-1a) + `makeRng` (mulberry32) — sumber acak deterministik |
| `eval/lib/methods.ts` | 4 metode: `runHybrid`, `runRandom`, `runRoundRobin`, `runManual` + `computeLoads` |
| `eval/lib/metrics.ts` | rumus `skillCoverage`, `loadBalance`, `hardRules`, `fitScore`, `manualChangesNeeded` |

### Dataset

| Berkas | Isi |
|---|---|
| `eval/datasets/d1_tasks.ts` | 11 template (T01–T11) + 15 tugas non-IT sintetis (NIT-01..15), semua `synthetic: true` |
| `eval/datasets/d2_scenarios.ts` | tepat 20 skenario (S01–S20) mencakup 15 kondisi wajib |

### Runner eksperimen (vitest, dijalankan via `--config eval/vitest.eval.config.ts`)

| Berkas | Menghasilkan |
|---|---|
| `eval/scripts/validate_datasets.test.ts` | `results/dataset_summary.json` |
| `eval/scripts/run_hard_rules.test.ts` | `results/hard_rules.json` |
| `eval/scripts/run_methods.test.ts` | `results/methods_per_scenario.json`, `results/methods_summary.json`, `results/methods_summary.csv` |
| `eval/scripts/run_ablation.test.ts` | `results/ablation.json` |
| `eval/scripts/run_truthfulness.test.ts` | `results/truthfulness.json` |
| `eval/scripts/run_ai_budget.test.ts` | `results/ai_budget.json`, `results/robustness.json` |
| `eval/scripts/run_performance.test.ts` | `results/performance.json` |

### Hasil terstruktur (dihasilkan, bukan dikarang) — `eval/results/`

`ablation.json`, `ai_budget.json`, `dataset_summary.json`, `hard_rules.json`,
`methods_per_scenario.json`, `methods_summary.json`, `methods_summary.csv`, `performance.json`,
`robustness.json`, `truthfulness.json`.

### Instrumen

| Berkas | Isi |
|---|---|
| `eval/instruments/human_agreement_instrument.md` | instrumen penilaian 3 reviewer (BLOCKED — belum dijalankan) |

### Laporan — `eval/reports/`

| Berkas | Bagian |
|---|---|
| `00_AUDIT.md` | audit read-only + rekonsiliasi baseline DB (19/24/17/5) |
| `B_DATASET.md` | dataset D1/D2, D3 BLOCKED |
| `C_METHODS.md` | 4 metode pembanding & aturan baseline manual |
| `D_HARD_RULES.md` | R1–R5 valid + edge + 2 kasus tak terdefinisi PRD |
| `E_SKILL_COVERAGE.md` | rumus & hasil coverage |
| `F_LOAD_BALANCE.md` | rumus & hasil beban, trade-off skill vs beban |
| `G_HUMAN_AGREEMENT.md` | BLOCKED |
| `H_ABLATION.md` | ablation K deterministik (proxy) + live BLOCKED |
| `I_TRUTHFULNESS.md` | `generateExplanation` vs `memberReason` |
| `J_AI_CALL_BUDGET.md` | logika budget nyata + live BLOCKED |
| `K_ROBUSTNESS.md` | 10 kondisi (nyata/mock/BLOCKED) |
| `L_PERFORMANCE.md` | komputasi + browser + DB/network, terpisah |
| `M_LIMITATIONS.md` | seluruh keterbatasan & daftar BLOCKED |
| `N_FILES.md` | dokumen ini |
| `O_RECOMMENDATIONS.md` | rekomendasi |
| `A_P_FINAL.md` | putusan (A–O) + Final Status (P) |

## 3. Ringkasan jumlah

| Kategori | Jumlah |
|---|---|
| Berkas produk diubah | 1 (`vitest.config.ts`) |
| Berkas dibuat di `eval/` | **38** (1 config + 1 README + 4 lib + 2 dataset + 7 runner + 10 results + 1 instrumen + 16 laporan — `A_P_FINAL.md` menyusul) |
| Output terstruktur (JSON/CSV) | 10 |
| Laporan | 16 (00, B, C, D, E, F, G, H, I, J, K, L, M, N, O, A+P) |

## 4. Reproduksi

```bash
npx vitest run --config eval/vitest.eval.config.ts
```

menjalankan seluruh runner dan menulis ulang semua `eval/results/*`. Deterministik karena PRNG
ber-seed tetap. Tidak membutuhkan Gemini key atau DB.

## 5. Bukti integritas

- Tidak ada commit/push/deploy/reset DB/perubahan schema/secret.
- Fixture `EVAL-PERF fixture` dibuat lewat API dan **dihapus**; DB kembali ke 19/24/17/5.
- Proyek pengguna `"ggg"` **tidak disentuh**.
