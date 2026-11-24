/**
 * PRNG deterministik (mulberry32) + helper turunan seed.
 *
 * Kenapa bukan Math.random(): eksperimen harus dapat diulang persis oleh orang
 * lain dari seed yang sama. Semua pemakaian acak di harness mengambil instance
 * dari `makeRng(seed)`.
 */

export type Rng = () => number;

/** Hash string → uint32 (FNV-1a), untuk menurunkan seed per (method, scenario). */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5 >>> 0;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: period 2^32, cukup untuk eksperimen, hasil stabil antar-run. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pilih satu elemen dari array dengan RNG. */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Fisher–Yates mengembalikan salinan baru (tidak memodifikasi input). */
export function shuffled<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
