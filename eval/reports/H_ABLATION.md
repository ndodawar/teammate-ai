# H. Ablation — Kontribusi Komponen K

Runner: `eval/scripts/run_ablation.test.ts`. Data: `eval/results/ablation.json`.

## Status live vs deterministik

| Aspek | Status |
|---|---|
| Ablation dengan **embedding live** (Gemini) | **BLOCKED** — tidak ada `GEMINI_API_KEY` |
| Ablation **jalur deterministik** (proxy K) | **dijalankan** |
| Membuat embedding sintetis lalu menyebutnya "live" | **TIDAK dilakukan** |

Yang diuji adalah **mekanisme**: apakah komponen K mengubah hasil, dan ke arah mana. Nilai K
berasal dari **proxy deterministik** (fungsi hash → rentang 0,2–0,8, lalu dinormalisasi 0,2→0 /
0,8→1 oleh `normalizeCosineSimilarity`). Proxy ini **bukan** kemiripan semantik dan **tidak**
dipakai untuk mengklaim kualitas content-similarity. Tujuannya menguji apakah jalur K berfungsi
dan seberapa sensitif hasil terhadapnya.

## Desain

Input identik (20 skenario D2). Dua kondisi:

- **A. Dengan K**: `isFallback=false`, bobot `DEFAULT` (K0,40/S0,30/C0,20/M0,10), `cosineMap` = proxy.
- **B. Tanpa K**: `isFallback=true`, bobot `FALLBACK` (K0/S0,50/C0,33/M0,17), cosine diabaikan.

Perbedaan bobot S/C/M antara dua kondisi adalah konsekuensi desain FR-13 (mode cadangan memang
mengganti bobot). Ini dicatat sebagai **confound**: selisih hasil bukan murni dari K saja, melainkan
K + pergeseran bobot S/C/M. Ablation "K murni" (bobot S/C/M sama, hanya K di-nol-kan) membutuhkan
embedding live yang konsisten → **BLOCKED**.

## Hasil

| Metrik | Nilai |
|---|---|
| Tugas total (20 skenario) | 35 |
| Tugas **berpindah pemilik** karena K | **9 (25,7%)** |
| Δ coverage rata-rata (A − B) | **0,000** |
| Δ stddev beban rata-rata (A − B) | **−0,20** (A sedikit lebih rata) |
| Δ fit rata-rata (A − B) | **−0,027** (A sedikit lebih rendah) |

## Interpretasi (jujur)

1. **K benar-benar memengaruhi hasil**: 25,7% tugas berpindah pemilik antara mode K dan tanpa-K.
   Jadi komponen K **bukan** hiasan — ia mengubah keputusan pada jalur deterministik.
2. **Tetapi K (proxy) TIDAK meningkatkan skill coverage** (Δ = 0). Proxy acak tidak "tahu" skill,
   jadi ini sesuai ekspektasi — dan justru menegaskan bahwa klaim "K meningkatkan kecocokan
   konten/skill" **tidak boleh** dibuat tanpa embedding live yang benar-benar semantik.
3. Δ stddev dan Δ fit sangat kecil (≈0,2 jam dan ≈0,03) — arah pun tidak keduanya menguntungkan
   (fit sedikit turun). Maka **tidak ada dasar** untuk mengklaim K memperbaiki keseimbangan atau
   kesesuaian pada eksperimen ini.
4. Karena bobot S/C/M ikut berubah (confound di atas), selisih ini **tidak** dapat diatribusikan
   100% ke K. Untuk mengisolasi K murni diperlukan embedding live — BLOCKED.

## Kesimpulan H

Jalur K berfungsi dan berdampak nyata (25,7% keputusan berubah), tetapi pada data & proxy ini
**tidak terbukti meningkatkan** coverage, keseimbangan, atau fit. **Ablation live tetap BLOCKED**
dan harus dijalankan dengan `GEMINI_API_KEY` + embedding nyata sebelum ada klaim kualitas K.

### Yang dibutuhkan untuk menutup blocker

1. `GEMINI_API_KEY` valid.
2. Hitung embedding nyata untuk tasks & members (768-dim, sesuai migrasi 001).
3. Jalankan ulang ablation dengan bobot S/C/M **tetap** (hanya K di-nol-kan) untuk isolasi murni.
4. Ukur perubahan assignment, coverage, dan (bila ada) penilaian manusia.
