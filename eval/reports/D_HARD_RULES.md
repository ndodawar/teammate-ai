# D. Hard Rules R1–R5

Semua kasus dijalankan pada **mesin asli** (`globalAssign`, `checkR1`–`checkR3`,
`computeScore`) via `eval/scripts/run_hard_rules.test.ts`. Hasil mentah:
`eval/results/hard_rules.json`. Tidak ada aturan yang diubah.

Ringkasan: **15 kasus, semuanya berperilaku sesuai definisi implementasi**; dua di antaranya
adalah kasus yang **tidak didefinisikan PRD** dan dicatat terpisah (§Kasus tak terdefinisi).

## Definisi yang benar-benar berlaku (dibaca dari kode)

| Aturan | Implementasi aktual |
|---|---|
| R1 | `checkR1(m) = m.capacity > 0` |
| R2 | `checkR2 = (load+hours) <= ideal*1.25 AND (load+hours) <= capacity` |
| R3 | kandidat = anggota dengan ≥1 skill wajib level ≥3; bila tak ada → semua anggota (peringatan) |
| R4 | satu `primaryMemberId` per tugas — ditegakkan **struktural**, `checkR4` tak dipanggil |
| R5 | `lockedMap` mempertahankan pemilik tugas terkunci — ditegakkan **struktural**, `checkR5` tak dipanggil |

Catatan penting: **R2 menggabungkan dua syarat** (batas 1,25× ideal *dan* kapasitas). Karena itu
kegagalan R2 tidak bisa dipisahkan dari "kapasitas habis" — lihat kasus R2-edge di bawah.

## Hasil per aturan

### R1 — jam tersedia 0 tidak menjadi kandidat
| Kasus | Jenis | Hasil |
|---|---|---|
| Anggota capacity 0 dengan skill tertinggi tetap **tidak** dipilih (kalah dari capacity 40 level 3) | valid | **lulus** — primary = m1 |
| Semua anggota capacity 0 → tidak ada `isEligible` | edge | **lulus pada perilaku** — engine tetap menugaskan (m0) walau tak ada kandidat sah → dicatat § |
| capacity negatif (di luar skema) | edge | `checkR1(-5)=false`, anggota dilewati; primary = m1 |

### R2 — beban tidak melebihi 1,25× ideal
| Kasus | Jenis | Hasil |
|---|---|---|
| 2 tugas 6 jam / 2 anggota → tak ada load > 1,25×ideal | valid | **lulus** |
| **Tak ada kandidat yang memenuhi R2** (kapasitas 4 & 3, tugas 10) | edge | **perilaku dicatat**: tak ada `isEligible`, engine tetap menugaskan via jalur `absoluteBest` → § |
| Batas berbasis capacity: anggota muat 1,25×ideal (11,25) tapi kapasitas 8 < 9 → diblok | edge | **lulus** — t1 bukan ke anggota capacity 8 |

### R3 — kandidat punya ≥1 skill wajib level ≥3
| Kasus | Jenis | Hasil |
|---|---|---|
| Anggota level 2 pada skill wajib **tidak** eligible meski volume cukup | valid | **lulus** |
| Multi-skill "any, bukan all": level {4,1} lolos, {2,2} gugur | valid | **lulus** — pool = [m1] |
| Tak ada kandidat ≥3 → pool = semua anggota (peringatan) | edge | **lulus** |
| Tugas tanpa skill wajib → semua kandidat, S = 1.0 | edge | **lulus** |

### R4 — setiap tugas satu penanggung jawab
| Kasus | Jenis | Hasil |
|---|---|---|
| 2 tugas, tiap tugas tepat satu pemilik, id tugas unik | valid | **lulus** |
| Semua capacity 0 → satu pemilik tetap dipilih (R4 struktural terpenuhi walau R1 dilanggar) | edge | **lulus struktur**, § catatan |

### R5 — tugas terkunci tidak berubah
| Kasus | Jenis | Hasil |
|---|---|---|
| Tugas terkunci ke m1 (level 3) tetap m1 walau m2 level 5 | valid | **lulus** — primary m1, isLocked |
| Terkunci ke anggota yang jadi tak layak R3 → tetap dipertahankan | edge | **lulus** |
| Beban tugas terkunci (18 jam) ikut dihitung → tugas lain (6 jam) ke anggota lain | edge | **lulus** |

## Kasus yang tidak didefinisikan PRD (dicatat terpisah)

1. **Tidak ada kandidat yang memenuhi R2.** `globalAssign` masuk jalur `absoluteBest`
   (`assign.ts` baris 103–124) yang memilih kandidat berdasarkan R1 lalu **jumlah komponen
   mentah** — walaupun `total = 0` karena R2 gagal. Artinya sistem **tetap menugaskan** tugas
   yang secara aturan tidak boleh diberikan. PRD tidak mendefinisikan apa yang harus terjadi di
   sini (menolak tugas? memberi peringatan keras? membiarkan kosong?). Inilah perilaku aktual
   dan menjadi **open decision** (lihat laporan M).
2. **Semua anggota kapasitas 0.** Tidak ada kandidat sah; engine tetap memilih satu anggota
   (yang secara R1 gugur). PRD tidak mendefinisikan keadaan ini.

Keduanya bukan "bug yang diperbaiki", melainkan **perilaku yang didokumentasikan**. Memperbaikinya
berarti mengubah candidate selection / global assignment, yang dilarang di fase ini.

## Kesimpulan D

- R1, R3, R4, R5 berperilaku benar pada kasus valid dan edge yang diuji.
- R2 berperilaku benar pada kasus valid; pada kasus ekstrem "tak ada kandidat", perilakunya
  adalah fallback `absoluteBest` yang **melanggar R2** — konsisten dengan kode, tidak didefinisikan
  PRD, dan dicatat sebagai open decision.
