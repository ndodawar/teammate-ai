# G. Human Agreement

## Status: BLOCKED

Human agreement **belum dapat diukur**: belum ada 3 reviewer manusia pada saat evaluasi ini
dijalankan. Sesuai PRD §7.3/§14, sistem **tidak** boleh dilabeli "disetujui reviewer", dan
**tidak ada** reviewer atau penilaian yang dikarang.

| Item | Status |
|---|---|
| Instrumen penilaian siap | **Ya** — `eval/instruments/human_agreement_instrument.md` |
| Reviewer tersedia (3 orang) | **Tidak (BLOCKED)** |
| Top-1 agreement | **BLOCKED** |
| Top-2 agreement | **BLOCKED** |
| Jumlah tidak setuju / sulit dinilai | **BLOCKED** |
| Alasan perbedaan | **BLOCKED** |

## Instrumen yang disiapkan (ringkas)

Lihat `eval/instruments/human_agreement_instrument.md` untuk detail lengkap. Inti:

- Reviewer menilai **top-1** dan **top-2** per tugas, **tanpa** melihat skor internal sistem.
- Skala: Setuju / Tidak setuju / Sulit dinilai + alasan.
- 3 reviewer independen per tugas; metrik: top-1 & top-2 agreement, kasus sulit, alasan.

## Apa yang dibutuhkan agar tidak BLOCKED

1. Tiga reviewer manusia bersedia.
2. Tugas uji dipilih (dari D2 atau data nyata ber-persetujuan).
3. Penilaian dikumpulkan ke CSV.
4. Baru kemudian angka diisi di sini.

Tidak ada angka di laporan ini yang merupakan pengganti atau estimasi. Ini **bukan** kegagalan
produk; ini keterbatasan sumber daya manusia yang harus ditutup sebelum klaim kualitas
"sesuai penilaian manusia" dapat dibuat.
