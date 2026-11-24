# O. Rekomendasi

Rekomendasi berikut **tidak diimplementasikan** di Fase 4 (fase ini hanya mengevaluasi). Disusun
berdasarkan temuan yang terukur, diurutkan dari yang paling berdampak pada kejujuran/kualitas.

## Prioritas 1 — Kebenaran penjelasan (risiko terbesar yang terverifikasi)

1. **Ganti/arahkan `generateExplanation` ke `memberReason`.**
   - Bukti: `generateExplanation` menghasilkan 2 klaim **bertentangan** dan 8 **tidak didukung**
     (laporan I). `memberReason` 33/33 klaim benar.
   - Tindakan: jadikan `memberReason` satu-satunya sumber teks alasan (UI, CSV, **dan** teks
     cadangan jalur AI di `lib/ai/explain.ts`). Ini menghapus jalur cadangan yang tidak faktual.
   - Biaya: rendah; risiko regresi dapat dijaga dengan test truthfulness yang sudah ada di
     `eval/scripts/run_truthfulness.test.ts` (dapat dipindah ke `test/`).

## Prioritas 2 — Menutup blocker yang murni eksternal

2. **Jalankan ablation live dengan `GEMINI_API_KEY` + embedding nyata.**
   - Untuk mengisolasi K **murni**, **tetapkan bobot S/C/M sama** pada kedua kondisi dan hanya
     nol-kan K (menghindari confound DEFAULT vs FALLBACK).
   - Ukur perubahan assignment, coverage, beban, fit; bila ada reviewer, tambahkan penilaian.
3. **Sediakan 3 reviewer untuk human agreement (G).**
   - Gunakan instrumen `eval/instruments/human_agreement_instrument.md`.
   - Hitung top-1/top-2 agreement + Fleiss' kappa; kumpulkan alasan perbedaan.
4. **D3 (data kelompok nyata) hanya bila ada persetujuan peserta.**
   - Sampai itu, semua klaim tetap terbatas pada data sintetis.

## Prioritas 3 — Stabilitas integrasi & environment

5. **Kurangi flakiness `test/integration` tanpa melonggarkan assertion.**
   - Diagnosis: satu kegagalan `fetch failed`/timeout (root cause: latency Supabase 196 ms–5733 ms)
     memicu cascade 7 kegagalan karena `4.a` tidak punya override timeout dan setup tidak resilien.
   - Opsi **tanpa melemahkan** assertion/ambang produk:
     - beri **timeout per-test yang realistis** pada test yang memang memanggil jaringan (bukan
       memperbesar ambang produk, hanya batas waktu tunggu I/O), atau
     - buat `setup`/`beforeAll` **retry sekali** pada kegagalan jaringan murni, dengan tanda jelas
       di log, atau
     - pisahkan suite integrasi "butuh jaringan" dari `npm test` (mis. `npm run test:integration`),
       sehingga `npm test` deterministik.
   - Pastikan `afterAll` selalu membersihkan fixture (sudah ada; tambahkan `try/finally` agar
     pembersihan jalan walau setup crash, mencegah baris `Smoke Test` bocor).
6. **Ukur & pantau latency Supabase.** Alur end-to-end 2–3,5 s didominasi DB (~280 ms/round-trip,
   beberapa round-trip per rekomendasi). Pertimbangkan menggabungkan query atau memakai satu RPC
   untuk membaca proyek+anggota+tugas dalam satu round-trip. Ini optimasi produk, bukan perubahan
   aturan.

## Prioritas 4 — Keputusan desain yang masih terbuka

7. **Tetapkan perilaku resmi untuk "tidak ada kandidat R2" dan "semua kapasitas 0".**
   - Saat ini engine `absoluteBest` tetap menugaskan walau R2 gagal (laporan D). PRD belum
     mendefinisikan. Perlu keputusan produk: tolak tugas + peringatan keras, atau tandai
     "perlu keputusan manual".
   - Jangan diubah sepihak; butuh keputusan pemilik produk.

8. **Jadikan aturan manual baseline sebagai pembanding tetap.**
   - Coverage manual (0,867) > hybrid (0,808). Untuk memastikan hybrid tidak "kalah" pada
     skenario realistis, pertimbangkan mengevaluasi ulang dengan bobot/aturan yang lebih
     mencerminkan prioritas skill pada kasus multi-skill — **tetapi** ini berarti mengubah bobot,
     sehingga harus menjadi keputusan produk, bukan perubahan evaluasi.

## Prioritas 5 — Klaim yang harus ditahan sampai blocker tertutup

9. **Jangan klaim** (sampai live):
   - "K meningkatkan kecocokan/kualitas" — belum terbukti (proxy Δ=0).
   - "Penjelasan AI 100% jujur" — jalur cadangan masih tidak faktual sampai #1 dikerjakan.
   - "Memenuhi < 1 detik end-to-end" — hanya komputasi yang < 1 ms; alur pengguna didominasi DB.
   - "Disetujui manusia" — tanpa reviewer (G/BLOCKED).
   - "Beban hybrid lebih merata" — σ hybrid > round-robin.

## Ringkasan matriks rekomendasi

| # | Rekomendasi | Dampak | Membutuhkan | Mengubah produk? |
|---|---|---|---|---|
| 1 | Satukan alasan ke `memberReason` | tinggi (kejujuran) | — | ya (kode penjelasan) |
| 2 | Ablation live, bobot S/C/M tetap | tinggi (bukti K) | `GEMINI_API_KEY` | tidak |
| 3 | 3 reviewer (G) | tinggi (kualitas) | manusia | tidak |
| 4 | D3 ber-persetujuan | sedang | peserta + consent | tidak |
| 5 | Stabilkan integrasi tanpa longgarkan assertion | sedang | — | ya (test/config) |
| 6 | Optimasi round-trip DB | sedang | — | ya (query) |
| 7 | Keputusan perilaku no-R2-candidate | sedang | keputusan produk | ya (engine) |
| 8 | Tinjau aturan baseline vs bobot | rendah–sedang | keputusan produk | ya (bobot) |
| 9 | Tahan klaim sampai blocker tertutup | tinggi (kredibilitas) | — | tidak |
