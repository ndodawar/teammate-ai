# I. Explanation Truthfulness

Runner: `eval/scripts/run_truthfulness.test.ts`. Data: `eval/results/truthfulness.json`.
Diperiksa otomatis terhadap data sebenarnya (nama, skill, level, minat, kapasitas, skor, fallback).

## Dua sumber teks yang diperiksa

| Fungsi | Di mana dipakai | Sifat |
|---|---|---|
| `generateExplanation` (`lib/scoring/assign.ts`) | template `TaskAssignment.reason`; **dipakai sebagai teks cadangan** oleh `lib/ai/explain.ts` saat AI gagal/tak tersedia | diketahui tidak jujur (dokumentasi di `explain-local.ts`) |
| `memberReason` (`lib/scoring/explain-local.ts`) | **teks yang benar-benar dirender** di matriks dan **diekspor** ke CSV | pengganti faktual |

Keduanya diuji karena saat mode cadangan, `generateExplanation` masih bisa muncul di jalur
penjelasan AI. Pengguna di UI melihat `memberReason`, tetapi klaim kejujuran harus mencakup jalur
cadangan secara utuh.

## Klasifikasi klaim

- **benar** — didukung data.
- **tidak_didukung** — tidak dapat diverifikasi / klaim generik tanpa dasar.
- **bertentangan** — berlawanan dengan data.
- **tidak_cukup_info** — tidak ada klaim yang bisa diuji.

## Hasil (6 teks per sumber, 26+33 klaim)

| Sumber | benar | tidak didukung | **bertentangan** | tidak cukup info |
|---|---|---|---|---|
| `generateExplanation` | 16 | 8 | **2** | 0 |
| `memberReason` | **33** | 0 | **0** | 0 |

## Temuan `generateExplanation` (tidak jujur — terkonfirmasi)

Contoh nyata dari data:

| Kasus | Teks yang dihasilkan | Masalah |
|---|---|---|
| C = 0 (kapasitas habis) | "Budi memiliki keterampilan relevan (…) dengan skor kesesuaian **0%** dan **sisa kapasitas yang memadai**" | **bertentangan**: kapasitas 0 tetapi mengklaim "memadai" |
| Total = 0 (gagal R1/R2) | "… dengan skor kesesuaian **0%** …" | **tidak didukung**: kalimat berbentuk rekomendasi afirmatif untuk skor 0 |
| C = 0,90 | "… dan **sisa kapasitas yang memadai**" | **tidak didukung**: frasa muncul tanpa memeriksa besaran C |

Akar masalah (sesuai kode baris 8–15 `assign.ts`): `generateExplanation` **tidak pernah** memeriksa
nilai kapasitas/skor; ia selalu menempelkan "sisa kapasitas yang memadai" dan menampilkan
`0%` sebagai kalimat rekomendasi positif. **Setiap** dari 6 teks diuji berakhir dengan verdict
selain "benar".

## Temuan `memberReason` (jujur)

Seluruh **33 klaim benar**, nol kontradiksi:

- Menyebut nama yang benar.
- "menguasai X" hanya untuk skill wajib level ≥3.
- Kapasitas dinyatakan sesuai C yang sebenarnya ("menyisakan 90% kapasitas", atau "tidak
  menyisakan kapasitas", atau "R1" saat capacity 0).
- Minat ("berminat tinggi/sedang/rendah") sesuai M.
- Skor yang ditampilkan = `round(total×100)` sebenarnya.
- Pada mode cadangan, menyatakan K tidak dihitung.

## Pemeriksaan manual pada sampel

Sampel 3 teks `memberReason` dibaca manual dan cocok dengan data:

1. "Ani menguasai penulisan akademik, menyisakan 90% kapasitas dan berminat tinggi … Skor 87%" —
   data: level 4 (≥3 ✓), C 0,90 ✓, M 5 → tinggi ✓, total 0,87 ✓.
2. "Dodi belum menilai pemrograman backend di level 3 atau lebih, menyisakan 88% kapasitas dengan
   minat sedang … Skor 57%" — data: level 2 (<3, jujur menyebut "belum menilai") ✓.
3. "Citra …" (capacity 0) — diuji sebagai `generateExplanation`; versi `memberReason` menyebut
   "R1" / kapasitas habis dengan benar.

Catatan: sampel manual ini kecil (3 teks) dan dipakai sebagai konfirmasi kualitatif, bukan
statistik. Pemeriksaan otomatis (33 klaim) adalah bukti utamanya.

## Kesimpulan I

- **`memberReason` (yang dirender & diekspor) jujur**: semua klaim faktual terverifikasi.
- **`generateExplanation` tidak jujur**: menghasilkan klaim yang **bertentangan** (kapasitas
  "memadai" saat C=0) dan **tidak didukung** (skor 0% disajikan afirmatif). Karena fungsi ini
  masih dipakai sebagai teks cadangan di jalur penjelasan AI, **jalur cadangan penjelasan AI
  membawa risiko kalimat tidak faktual**. Ini sejalan dengan dokumentasi di `explain-local.ts`
  dan menjadi rekomendasi perbaikan (lihat laporan O).
- Tidak ada klaim "penjelasan sudah dipercaya" dibuat untuk `generateExplanation`.
