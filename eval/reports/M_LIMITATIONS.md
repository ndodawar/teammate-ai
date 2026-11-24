# M. Keterbatasan

Daftar di bawah ini dibatasi pada hal yang **benar-benar terukur atau benar-benar tidak dapat
diuji** dalam Fase 4. Tidak ada klaim "sudah beres" untuk hal yang masih BLOCKED.

## 1. Data hanya sintetis (D1/D2), bukan kelompok nyata (D3)

- Semua 26 tugas D1 dan 20 skenario D2 adalah **sintetis**. Tidak ada data kelompok nyata.
- **D3 BLOCKED**: tidak ada persetujuan peserta, sehingga tidak ada data nyata yang dikumpulkan.
- Konsekuensi: hasil (coverage 0,808; σ 5,62; R2-akhir 24; dst.) **tidak** dapat digeneralisasi ke
  kelompok nyata. Ia mengukur perilaku algoritma pada distribusi input yang kami rancang, bukan
  kualitas hasil pada pengguna sungguhan.
- Data sintetis **tidak** pernah dipresentasikan sebagai data nyata.

## 2. Tidak ada jalur AI live (tanpa `GEMINI_API_KEY`)

- **BLOCKED**: FR-06 (analisis tugas via AI), FR-09 (hybrid via embedding live), ablation live,
  AI-budget live, robustness live, dan efektivitas penangkal prompt-injection pada model sungguhan.
- Yang tersedia:
  - Logika budget `AiRun` (batas 3, token, latency, redaksi key) — **diuji nyata**.
  - Robustness kondisi offline (#2, #6, #7) — **diuji nyata**.
  - Robustness error/cache (#3, #4, #5, #8, #9, #10) — **MOCK berlabel**, bukan provider nyata.
- Tidak ada token/latency provider nyata yang dikarang. Kolom itu ditandai **BLOCKED**.

## 3. Tidak ada reviewer manusia

- **BLOCKED**: human agreement (top-1/top-2). Instrumen siap di
  `eval/instruments/human_agreement_instrument.md`, tetapi **tidak ada** penilaian aktual.
- Konsekuensi: **tidak ada klaim** bahwa rekomendasi "disetujui manusia". Semua pernyataan tentang
  kualitas keputusan terbatas pada metrik objektif (coverage, beban, kepatuhan aturan, fit), bukan
  persetujuan pengguna.

## 4. Hybrid tidak unggul pada coverage & keseimbangan beban

- **Skill coverage**: hybrid 0,808 < manual 0,867; hybrid = round-robin 0,808 > random 0,754.
  Hybrid **tidak** mengungguli baseline manual pada coverage.
- **Keseimbangan beban**: σ hybrid 5,62 > round-robin 3,88. Hybrid **tidak** lebih seimbang.
- Keunggulan hybrid yang **terukur**: **R1 = 0** (satu-satunya metode yang tidak pernah memberi
  tugas ke anggota kapasitas 0) dan **paling sedikit pelanggaran kapasitas** (3 vs 6/5).
- Pada 15 dari 18 skenario yang hybrid langgar R2, **tidak ada metode mana pun** yang bisa bebas
  R2 (pelanggaran struktural dari data). Hanya S02/S12/S18 yang bisa disebar, dan metodenya
  (round-robin) melakukannya dengan **melanggar R3**.

## 5. Kontribusi K belum terbukti (hanya proxy deterministik)

- Ablation memakai **proxy cosine deterministik**, bukan embedding semantik.
- Hasil: K mengubah **25,7%** keputusan (9/35 tugas) tetapi **Δ coverage = 0**, Δ stddev −0,20,
  Δ fit −0,027.
- **Confound**: kondisi "dengan K" juga memakai bobot S/C/M berbeda (DEFAULT vs FALLBACK), jadi
  selisih tidak murni dari K. Isolasi K murni **BLOCKED** (butuh embedding live).
- Kesimpulan: **tidak ada dasar** mengklaim K memperbaiki kualitas pada data ini.

## 6. Latency Supabase mendominasi alur end-to-end

- Komputasi algoritma < 1 ms, tetapi `POST /api/recommend` 2,1–3,5 detik dan matriks tampil ~7,7 s
  pada 4× throttle — **didominasi** round-trip Supabase (~280 ms median, outlier 2,9 s).
- Konsekuensi: target "proses tanpa AI < 1 detik" dipenuhi pada **komputasi**, **tidak** pada alur
  pengguna end-to-end. Ini keterbatasan **environment**, bukan algoritma — tetapi tetap dicatat
  agar tidak diklaim memenuhi < 1 detik secara end-to-end.
- Supabase di environment ini **tidak stabil** (`fetch failed`, latensi 196 ms–5733 ms).

## 7. `generateExplanation` tidak jujur pada jalur cadangan penjelasan AI

- `memberReason` (dirender & diekspor) **jujur**: 33/33 klaim benar.
- `generateExplanation` (template cadangan jalur AI) **tidak jujur**: 2 klaim **bertentangan**
  ("sisa kapasitas memadai" saat C=0) dan 8 **tidak didukung** ("skor 0%" sebagai kalimat
  afirmatif).
- Karena `explain.ts` memakai `generateExplanation` sebagai teks cadangan, **jalur penjelasan AI
  cadangan membawa risiko kalimat tidak faktual**. Ini rekomendasi perbaikan (laporan O), bukan
  sesuatu yang diubah di fase ini.

## 8. Perilaku yang tidak didefinisikan PRD (open decision)

- **Tidak ada kandidat R2**: engine masuk `absoluteBest` dan **tetap menugaskan** walau R2 gagal.
- **Semua kapasitas 0**: engine tetap memilih satu anggota (yang gugur R1).
- Keduanya didokumentasikan (laporan D). Memperbaikinya = mengubah candidate selection / global
  assignment, yang **dilarang** di fase ini.

## 9. Uji integrasi flaky secara environment

- `test/integration` bergantung Supabase. Sesi ini **8/8 lulus**, tetapi sesi sebelumnya mengalami
  `fetch failed` dan latensi 196 ms–5733 ms.
- Bila run crash, baris `Smoke Test FR04 FR05` bisa bocor. Tidak ada timeout/assertion yang
  dilonggarkan; flakiness ini dicatat sebagai masalah **environment**, bukan cacat produk.
- Baseline DB saat audit: **19/24/17/5**, dengan +1/+2/+1 milik proyek pengguna `"ggg"` (bukan
  dibuat skrip evaluasi). Lihat `00_AUDIT.md`.

## 10. Instrumen metrik "fit" dan "manual changes" adalah definisi kami

- "Fit" = rata-rata (skillMatch, interest) — bukan penilaian manusia.
- "Manual changes needed" = jumlah tugas yang harus dipindah agar bebas pelanggaran R1/R3 —
  ukuran usaha koreksi **minimum** yang kami definisikan, bukan jumlah edit nyata yang dilakukan
  pengguna.
- Baseline "manual" adalah **aturan transparan yang kami tetapkan lebih dulu**, bukan ground truth.

## Ringkasan: yang BLOCKED dan tidak boleh dianggap PASS

| Item | Status |
|---|---|
| Jalur AI live (FR-06/FR-09) | BLOCKED |
| Ablation live (embedding semantik) | BLOCKED |
| AI budget live (token/latency provider) | BLOCKED |
| Robustness provider live (rate/timeout/invalid/cache) | BLOCKED (mock saja) |
| Human agreement | BLOCKED |
| D3 (kelompok nyata) | BLOCKED |
