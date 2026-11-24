# Fase 4 — Evaluasi & Validasi Teammate AI

Direktori ini berisi **seluruh artefak evaluasi Fase 4** (T-4.MASTER). Semua angka di
`eval/reports/` dihasilkan dari eksperimen yang dapat diulang dengan perintah di bawah.

## Prinsip

- **Engine dipanggil langsung** (`lib/scoring/*`) — bukan lewat DB atau browser — untuk
  R1–R5, 4 metode pembanding, skill coverage, load balance, ablation deterministik, dan
  performance komputasi. Ini menghindari flakiness Supabase.
- **Tidak ada perubahan** pada formula, bobot, R1–R5, candidate selection, global assignment,
  AI architecture, fallback, schema DB, atau API. Fase ini **mengevaluasi**, bukan menyetel ulang.
- **Blocker eksternal** (`GEMINI_API_KEY`, reviewer manusia, D3) ditandai **BLOCKED**, bukan PASS.
- Semua data kelompok di `datasets/` adalah **sintetis** dan diberi label demikian.

## Struktur

```
eval/
  datasets/     D1 (11 template + 15 non-IT), D2 (20 skenario)
  lib/          config, prng (seed), methods (4 metode), metrics (rumus)
  scripts/      runner eksperimen (dijalankan lewat vitest)
  instruments/  instrumen human agreement (BLOCKED — belum ada reviewer)
  results/      output terstruktur JSON/CSV (dihasilkan, bukan dikarang)
  reports/      laporan A–P + laporan per metrik
  vitest.eval.config.ts   config terpisah (produk `npm test` tidak menyentuh eval/)
```

## Cara menjalankan (reproduksi)

Prasyarat: `node` + dependensi repo (`npm install`). **Tidak perlu** Gemini key atau DB.

```bash
# Validasi dataset (menulis results/dataset_summary.json)
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/validate_datasets.test.ts

# Hard rules R1–R5 (results/hard_rules.json)
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/run_hard_rules.test.ts

# 4 metode pembanding atas 20 skenario D2 (results/methods_*.json + .csv)
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/run_methods.test.ts

# Ablation K (deterministik) (results/ablation.json)
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/run_ablation.test.ts

# Truthfulness penjelasan (results/truthfulness.json)
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/run_truthfulness.test.ts

# AI call budget + robustness (mock, results/ai_budget.json, robustness.json)
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/run_ai_budget.test.ts

# Performance (results/performance.json)
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/run_performance.test.ts

# Atau semua sekaligus:
npx vitest run --config eval/vitest.eval.config.ts
```

Setiap runner **menulis artefaknya sendiri** ke `eval/results/`. Output deterministik karena
PRNG ber-seed (`eval/lib/prng.ts`) — seed induk `20260419` (lihat `eval/lib/config.ts`).

## Seed & pengulangan

- Seed induk: `EVAL_CONFIG.masterSeed = 20260419`.
- Random assignment: **30 pengulangan** per skenario (`randomRepeats`), seed turunan
  `hash(master, 'random', scenarioId, r)`. **Semua** hasil dilaporkan (min/median/max), bukan
  hanya yang terbaik.
- Urutan tugas semua metode = urutan engine (effort desc) agar perbandingan adil.

## Status uji per bagian (lihat laporan untuk detail)

| Bagian | Sumber hasil | Status |
|---|---|---|
| D1/D2 dataset | `scripts/validate_datasets.test.ts` | dijalankan |
| R1–R5 | `scripts/run_hard_rules.test.ts` + engine asli | dijalankan |
| 4 metode + metrik | `scripts/run_methods.test.ts` | dijalankan |
| Human agreement | `instruments/human_agreement_instrument.md` | **BLOCKED** (tanpa reviewer) |
| Ablation live (K dari Gemini) | — | **BLOCKED** (tanpa key) |
| Ablation deterministik (K mati vs K tetap) | `scripts/run_ablation.test.ts` | dijalankan |
| Truthfulness | `scripts/run_truthfulness.test.ts` | dijalankan (otomatis) + sampel manual |
| AI budget (live) | — | **BLOCKED** (tanpa key) |
| AI budget (mock) | `scripts/run_ai_budget.test.ts` | dijalankan, **berlabel mock** |
| Robustness (10 kondisi) | `scripts/run_ai_budget.test.ts` | dijalankan (mock) |
| Performance | `scripts/run_performance.test.ts` | dijalankan |
| D3 kelompok nyata | — | **BLOCKED** (tanpa persetujuan peserta) |

## Catatan integritas

- Tidak ada commit/push/deploy, tidak ada reset DB, tidak ada perubahan schema.
- Fixture uji integrasi dibuat lewat API dan dibersihkan; tidak menyentuh data pengguna.
- Baseline DB saat audit Fase 4: 19 projects / 24 members / 17 tasks / 5 events — selisih
  terhadap laporan lama dijelaskan penuh di `reports/00_AUDIT.md`.
