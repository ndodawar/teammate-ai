/**
 * Fase 4 — konfigurasi eksperimen deterministik.
 *
 * Semua angka yang dapat diulang (seed PRNG, jumlah pengulangan random, jumlah
 * skenario) berasal dari sini. Tidak ada Date.now() / Math.random() tanpa seed di
 * seluruh harness; PRNG di `lib/prng.ts` adalah satu-satunya sumber acak.
 */

export const EVAL_CONFIG = {
  /** Versi konfigurasi; naikkan bila seed/aturan eksperimen berubah. */
  version: '4.0.0',

  /** Seed induk. Seed turunan = hash(seed, method, scenarioId). */
  masterSeed: 20260419,

  /** Random assignment diulang 30x per skenario; semua hasil dilaporkan, bukan hanya terbaik. */
  randomRepeats: 30,

  /** Skenario D2 yang dijalankan (tepat 20, lihat datasets/d2_scenarios.json). */
  d2ScenarioCount: 20,

  /**
   * Batas panggilan Gemini per proses (PRD). Dipakai hanya untuk menandai
   * BLOCKED pada jalur live; jalur mock menguji logika budget tanpa memanggil API.
   */
  maxAiCallsPerProcess: 3,

  /** Proses D2 yang boleh memakai jalur AI (maks 20). Semua BLOCKED tanpa key. */
  maxD2Processes: 20,

  /** Target performa PRD. */
  perfTargets: {
    pipelineNoAiMs: 1000,
    sliderMs: 100,
    whatIfMs: 100,
  },

  /** Jumlah pengukuran performa per metrik (untuk min/median/P95/max/n). */
  perfIterations: 50,

  /** Toleransi pembanding floats. */
  epsilon: 1e-9,
} as const;

export type EvalConfig = typeof EVAL_CONFIG;
