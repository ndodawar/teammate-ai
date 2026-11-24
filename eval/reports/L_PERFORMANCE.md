# L. Performance

Dua kelas pengukuran, **dipisahkan tegas**:

1. **Komputasi** (in-process, tanpa jaringan/DB): `eval/scripts/run_performance.test.ts` →
   `eval/results/performance.json`.
2. **Browser/DB/network** (build produksi `next start -p 3100`, fixture terisolasi): diukur dengan
   Playwright + curl + probe Supabase. Fixture `EVAL-PERF fixture` dibuat lewat API dan dibersihkan.

Semua dilaporkan sebagai **min / median / P95 / max / n** — tidak ada satu hasil terbaik yang
disebut "rata-rata".

## Target PRD

| Target | Ambang |
|---|---|
| Proses tanpa AI | < 1000 ms |
| Slider | < 100 ms |
| What-if | < 100 ms |
| Slider & what-if tanpa request jaringan | 0 request |

## 1. Komputasi murni (in-process, n=50)

| Metrik | min | median | P95 | max | mean |
|---|---|---|---|---|---|
| Pipeline globalAssign, **1 skenario** | 0,016 | 0,018 | 0,051 | 0,058 | 0,025 ms |
| Pipeline globalAssign, **20 skenario** | 0,198 | 0,332 | 0,493 | 1,934 | 0,396 ms |
| **What-if** (assignOwner + globalAssign ulang) | 0,005 | 0,010 | 0,029 | 0,285 | 0,019 ms |
| **Slider recompute** (computeScore semua pasangan) | 0,003 | 0,005 | 0,025 | 0,221 | 0,013 ms |
| Swap | 0,000 | 0,000 | 0,010 | 0,102 | 0,005 ms |

Satuan: milidetik. **Semua jauh di bawah target** (what-if & slider P95 ≈ 0,03 ms vs 100 ms;
pipeline 20 skenario P95 ≈ 0,5 ms vs 1000 ms).

## 2. Browser — slider & what-if (build produksi)

Slider digerakkan 21 event `input` nyata; latency = waktu dari event sampai frame berikutnya (`rAF`).

| Kondisi | n | min | median | P95 | max | request jaringan |
|---|---|---|---|---|---|---|
| Slider — normal | 21 | 2,3 | **2,5** | 3,3 | 5,7 ms | **0** |
| Slider — **CPU 4× throttle** | 21 | 9,2 | **11,6** | 13,9 | 22,7 ms | **0** |
| Recalc label — normal | 1 | — | — | — | 1,6 ms | — |
| Recalc label — 4× throttle | 1 | — | — | — | 7,6 ms | — |
| What-if (papan tombol ArrowRight) — normal | 1 | — | — | — | ~17 ms | 0 |
| What-if — 4× throttle | 1 | — | — | — | ~66 ms | 0 |

Kesimpulan: slider & what-if **memenuhi target < 100 ms bahkan pada CPU 4× throttle**, dan
**nol request jaringan** (terverifikasi dari daftar request Playwright).

## 3. Waktu backend & network/DB (dipisahkan dari komputasi)

| Metrik | Nilai | Sumber |
|---|---|---|
| `POST /api/recommend` (server, tanpa throttle) | **2,14 – 3,48 s** (3 sampel) | curl `time_total` |
| Supabase REST round-trip (n=20) | min 168 ms, **median 279 ms**, P95 390 ms, **max 2892 ms** | probe langsung |
| FCP halaman `/result` | **112 ms** | Navigation/Paint timing |
| Waktu sampai matriks tampil (4× throttle) | **~7,7 s** | Playwright |

### Atribusi (penting — jangan salah menuduh algoritma)

- **Algoritma**: < 1 ms (lihat §1).
- **Supabase**: **~280 ms per round-trip** (median), dan satu proses rekomendasi melakukan
  beberapa round-trip (baca proyek, anggota, tugas, tulis event). Inilah yang membuat
  `/api/recommend` 2–3,5 detik.
- **Render**: shell + first paint ~112 ms; sisanya menunggu data.
- Jadi lambatnya `/result` **bukan** karena scoring, melainkan **latency DB/network**. Supabase di
  environment ini juga tidak stabil (satu sampel 2,9 s; sesi ini pernah `fetch failed`).

## 4. Ringkasan terhadap target

| Target PRD | Hasil | Status |
|---|---|---|
| Proses tanpa AI < 1000 ms (komputasi) | P95 0,49 ms (20 skenario) | **LULUS** (komputasi) |
| Slider < 100 ms | P95 3,3 ms normal; 13,9 ms @4× | **LULUS** |
| What-if < 100 ms | P95 0,03 ms (komputasi); ~66 ms @4× (UI) | **LULUS** |
| Slider & what-if tanpa jaringan | 0 request | **LULUS** |
| Waktu backend `/api/recommend` | 2,1–3,5 s | **DIDOMINASI DB**, bukan algoritma |

Catatan jujur: target "proses tanpa AI < 1 detik" dipenuhi pada tingkat **komputasi**. Namun
**alur pengguna end-to-end** (klik → rekomendasi tampil) melebihi 1 detik karena latency Supabase.
Karena latency itu **eksternal** (DB/network), ia dicatat terpisah dan tidak diklaim sebagai
kelemahan algoritma — tetapi juga **tidak** diklaim sebagai "memenuhi < 1 detik end-to-end".
