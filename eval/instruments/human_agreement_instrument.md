# Instrumen Human Agreement (BLOCKED — belum dijalankan)

> **Status: BLOCKED.** Belum ada 3 reviewer manusia. Dokumen ini adalah **instrumen penilaian**
> yang siap dipakai. **Tidak ada** skor pengganti, reviewer fiktif, atau angka buatan yang diisi
> di sini. Sesuai PRD §14, human agreement tidak boleh diklaim sebelum penilaian benar-benar
> dikumpulkan.

## Tujuan

Mengukur seberapa sering reviewer manusia setuju dengan rekomendasi sistem — top-1 dan top-2 —
serta mengidentifikasi kasus sulit dan alasan perbedaan.

## Cara pakai

1. Pilih 10–15 tugas dari 20 skenario D2 (atau tugas nyata ber-persetujuan).
2. Untuk setiap tugas, tampilkan **hanya** informasi yang relevan (tanpa skor internal sistem):
   - Judul & deskripsi tugas, estimasi jam, skill wajib.
   - Profil semua anggota: nama, skill+level, minat, kapasitas, beban saat ini.
   - Rekomendasi sistem: **top-1** (utama) dan **top-2** (alternatif) — nama anggota saja.
3. Reviewer menilai tiap rekomendasi: **Setuju / Tidak setuju / Sulit dinilai**, plus alasan
   singkat bila tidak setuju.
4. Tiap tugas dinilai **3 reviewer independen** (tanpa saling melihat).

## Lembar penilaian (template CSV)

Kolom: `scenario_id, task_id, reviewer_id, rekomendasi(top1|top2), penilaian(setuju|tidak|sulit), alasan`

Contoh baris (ILUSTRASI FORMAT — bukan data):

```
scenario_id,task_id,reviewer_id,rekomendasi,penilaian,alasan
S01,s01t1,R1,top1,,
S01,s01t1,R1,top2,,
```

## Metrik yang akan dihitung (setelah data terkumpul)

- **Top-1 agreement** = jumlah "setuju" pada top-1 / jumlah penilaian top-1 yang valid.
- **Top-2 agreement** = jumlah "setuju" pada top-2 / jumlah penilaian top-2 yang valid.
- **Jumlah tidak setuju** & **sulit dinilai** per tugas.
- **Intra-rater reliability**: bila ≥3 reviewer, hitung tingkat kesepakatan antar-reviewer
  (mis. Fleiss' kappa) untuk menandai tugas yang benar-benar ambigu.
- **Alasan perbedaan**: dikelompokkan (skill vs minat vs beban vs konteks tak terlihat).

## Blocker yang harus diselesaikan

- [ ] 3 reviewer tersedia & bersedia.
- [ ] Tugas dipilih dan dipisahkan dari data pribadi.
- [ ] Data penilaian dikumpulkan (CSV di atas).
- [ ] Baru setelah itu: isi `reports/G_HUMAN_AGREEMENT.md` dengan angka aktual.

Sampai keempat hal di atas terpenuhi, **G tetap BLOCKED** dan tidak ada klaim agreement.
