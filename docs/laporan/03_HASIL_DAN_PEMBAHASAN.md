# BAB 3 HASIL DAN PEMBAHASAN

## 3.1 Lingkungan Pengujian

**Tabel 3.9 Lingkungan pengujian**

| Aspek | Nilai | Sumber |
|---|---|---|
| Sistem operasi | Linux | lingkungan kerja |
| Node.js | dijalankan lewat `npx` | `package.json` |
| Runtime aplikasi | Next.js 16.4.6 | `node_modules/next/package.json` |
| Basis data | Supabase (PostgreSQL + pgvector) | `001_initial_schema.sql` |
| Model embedding | `gemini-embedding-001`, 768 dimensi | `T-2.07` |
| Model teks | `gemini-3.8-flash` / `gemini-3.5-flash-lite` | `T-2.07` |
| Kuota model | gratis, 20 permintaan/hari/model | pesan 429 provider |
| Bangun produksi | `next start -p 3100` | `L_PERFORMANCE.md` |
| Pengukuran browser | Chromium headless via CDP | `docs/STATUS.md:78` |

Empat pemeriksaan dijalankan ulang pada 2026-11-19 untuk memastikan hasil masih berlaku:

```
npx tsc --noEmit                                    -> exit 0
npx eslint .                                        -> 0 error, 2 warning
npx vitest run --exclude 'test/integration/**' \
               --exclude 'test/ai/gemini-models.live.test.ts'
                                                    -> 21 file, 286 test lulus
npx vitest run --config eval/vitest.eval.config.ts  -> 7 file, 14 test lulus
```

## 3.2 Hasil Pengujian Fungsional

286 pengujian unit pada 21 berkas lulus. Cakupannya:

**Tabel 3.10 Cakupan pengujian fungsional**

| Kelompok | Berkas uji | Yang diuji |
|---|---|---|
| Skoring | `test/scoring/*.test.ts` | Rumus K/S/C/M, angka 8.4, skenario, fallback, interaksi |
| AI | `test/ai/*.test.ts` | Anggaran panggilan, cache embedding, validasi keluaran, penjelasan |
| API | `test/api/*.test.ts` | Proyek, anggota, tugas, profil, route rekomendasi |
| Validasi | `test/validation/*.test.ts` | Skema tugas dan profil anggota |

Satu berkas sengaja dikecualikan dari hitungan di atas, yaitu `test/ai/gemini-models.live.test.ts`.
Berkas itu memanggil provider sungguhan dan hanya berjalan bila kunci tersedia. Hasil terakhir: **4
lulus, 1 gagal**. Yang gagal adalah pengujian yang menghasilkan JSON analisis, dengan penyebab
timeout 5000 ms milik Vitest ketika model teks sedang menolak permintaan karena kuota. Kegagalan ini
**tidak disembunyikan** dan dijelaskan di §3.9.

## 3.3 Hasil Pengujian Aturan R1–R5

15 kasus dijalankan pada mesin asli (`globalAssign`, `checkR1`–`checkR3`, `computeScore`), bukan
pada tiruan. Semuanya berperilaku sesuai definisi implementasi.

**Tabel 3.11 Kasus pengujian aturan keras**

| Aturan | Kasus | Contoh perilaku yang terbukti |
|---|---|---|
| R1 | 3 | Kapasitas 0 tidak dipilih meski skill-nya tertinggi |
| R2 | 3 | Beban di 1,25× ideal tepat di batas masih lolos; di atasnya ditolak |
| R3 | 4 | Hanya level ≥ 3 yang jadi kandidat; bila tidak ada, semua anggota jadi kandidat |
| R4 | 2 | Setiap tugas punya tepat satu penanggung jawab |
| R5 | 3 | Tugas terkunci tetap pada pemiliknya meski kandidat lain lebih tinggi |

Dua kasus mencatat perilaku yang **tidak didefinisikan PRD** dan dilaporkan terpisah:

1. Bila **semua** anggota berkapasitas 0, mesin tetap menugaskan satu anggota. Secara struktural R4
   terpenuhi, tetapi R1 dilanggar. PRD tidak menetapkan apa yang seharusnya terjadi.
2. Bila tidak ada kandidat yang memenuhi R2, mesin memilih kandidat terbaik dan **melanggar R2**
   alih-alih membiarkan tugas tanpa pemilik.

Keduanya adalah keputusan produk yang masih terbuka. Laporan ini tidak menyebutnya benar atau salah,
hanya mencatat bahwa PRD belum mengaturnya.

## 3.4 Perbandingan Metode

Empat metode diuji pada 20 skenario D2 yang sama. Random dijalankan 30 seed menjadi 600 run;
metode lain 20 run (satu per skenario).

**Tabel 3.1 Perbandingan metode pada empat metrik**

| Metrik | Hybrid | Random | Round-robin | Manual |
|---|---|---|---|---|
| Skill coverage (rata-rata) | **0,808** | 0,754 | **0,808** | **0,867** |
| Load stddev (rata-rata, jam) | 5,616 | 5,296 | **3,876** | 5,616 |
| Pelanggaran R1 (total) | **0** | 31 | 2 | 2 |
| Pelanggaran R3 (total) | 1 | 147 | 4 | **0** |
| Pelanggaran R2 final (total) | 24 | 752 | **18** | 24 |
| Fit (rata-rata) | 0,645 | 0,585 | **0,674** | 0,668 |

Sumber: `eval/results/methods_summary.json`. Angka dibulatkan tiga desimal.

Catatan pembacaan: brief Fase 5 menyajikan stddev sebagai 5,62 / 5,30 / 3,88 / 5,62 dan fit
0,645 / 0,585 / 0,674 / 0,668. Keduanya cocok dengan berkas hasil. Nilai presisi penuh
(5,61604 / 5,296225 / 3,875925) dipakai bila angka perlu lebih teliti.

### Arti setiap metrik

**Skill coverage** adalah proporsi tugas yang penanggung jawabnya memiliki skill wajib pada level
≥ 3. Nilai 0,808 berarti sekitar 81% tugas jatuh ke orang yang menguasai keterampilan yang diminta.
Metrik ini mengukur kecocokan keterampilan, bukan kepuasan pengguna.

**Load stddev** adalah simpangan baku beban (jam) antaranggota dalam satu skenario, dirata-ratakan
lintas skenario. Angka kecil berarti beban lebih merata. Rumusnya simpangan baku populasi
(`eval/reports/F_LOAD_BALANCE.md`).

**Pelanggaran R1/R2/R3** adalah jumlah kasus aturan keras yang dilanggar. R1 berarti anggota tanpa
kapasitas tetap diberi tugas. R2 berarti beban melewati batas 1,25× ideal atau melewati kapasitas.
R3 berarti tugas diberikan ke anggota tanpa skill wajib level ≥ 3. Untuk R2 dipakai angka final,
yaitu setelah seluruh tugas diproses.

**Fit** adalah ukuran gabungan seberapa dekat hasil dengan harapan pada skenario itu; skalanya 0–1
dan dihitung di `eval/lib/metrics.ts`.

### Implikasi, tanpa mengklaim pemenang tunggal

Tabel 3.1 **tidak** menunjukkan satu metode unggul di semua ukuran. Yang terbaca adalah trade-off:

1. **Hybrid satu-satunya dengan nol pelanggaran R1.** Ini keunggulan struktural: R1 adalah aturan
   pertama yang disaring, sehingga anggota tanpa kapasitas tidak pernah dipilih. Random melanggar 31
   kali karena tidak memeriksa kapasitas sama sekali.

2. **Manual memiliki skill coverage tertinggi (0,867).** Pembagian manual, ketika orang yang membagi
   tahu siapa menguasai apa, memang bisa lebih tepat daripada aturan otomatis. Hybrid berada 6 poin
   di bawahnya (0,808).

3. **Round-robin memiliki load stddev terendah (3,876).** Ini konsekuensi langsung dari cara
   kerjanya: membagi bergiliran memang menghasilkan jumlah tugas yang hampir sama. Tetapi round-robin
   buta skill, sehingga pelanggaran R3-nya 4 kali lipat hybrid (4 berbanding 1).

4. **Hybrid masih memiliki 24 pelanggaran R2 final**, sama dengan manual. Ini **bukan** nol. Sistem
   belum berhasil menempatkan semua tugas di dalam batas beban ideal. Penyebabnya adalah perilaku
   yang dijelaskan di §3.3: ketika tidak ada kandidat yang memenuhi R2, sistem tetap menugaskan.
   Round-robin justru lebih baik di ukuran ini (18), karena pembagian bergiliran jarang menumpuk
   beban pada satu orang.

5. **Hybrid seri dengan round-robin pada skill coverage (0,808).** Ini temuan yang perlu dinyatakan
   terbuka. Round-robin sama sekali tidak melihat skill, tetapi mencapai angka yang sama. Artinya
   pada dataset ini, penyaringan R3 sendirian sudah cukup menghasilkan coverage 0,808; komponen K
   belum terbukti menambah nilai pada ukuran ini.

6. **Fit hybrid (0,645) di bawah round-robin (0,674) dan manual (0,668).** Random tetap terburuk
   (0,585).

Kesimpulan yang jujur: hybrid punya keunggulan yang jelas pada kepatuhan R1, kompetitif pada
kepatuhan R3, tetapi belum menunjukkan keunggulan pada keseragaman beban maupun cakupan
keterampilan. Ia **bukan** metode terbaik secara keseluruhan pada data ini.

## 3.5 Hasil Ablasi

Ablasi menguji apakah komponen K benar-benar berpengaruh, dengan membandingkan dua versi: dengan K
dan tanpa K.

**Tabel 3.2 Hasil ablasi komponen K**

| Ukuran | Nilai |
|---|---|
| Skenario | 20 |
| Total tugas | 35 |
| Tugas berpindah pemilik karena K | 9 |
| Proporsi berpindah | **25,7 %** |
| Δ skill coverage (dengan K − tanpa K) | **0** |
| Δ stddev beban | −0,20 jam |
| Δ fit | −0,027 |

Sumber: `eval/results/ablation.json`.

Tiga hal bisa disimpulkan.

Pertama, **K benar-benar memengaruhi keputusan**. Seperempat tugas berganti penanggung jawab ketika
K dimasukkan. Jadi komponen ini bukan hiasan; ia bekerja.

Kedua, **K tidak meningkatkan skill coverage sama sekali** (Δ = 0). Ini masuk akal: K mengukur
kemiripan teks, sedangkan skill coverage diukur dari pencocokan skill eksplisit. K bisa memindahkan
tugas ke orang yang teksnya lebih mirip tanpa membuat orang itu lebih menguasai skill yang diminta.

Ketiga, **Δ fit justru negatif** (−0,027) dan **Δ stddev negatif** (−0,20 jam). Arahnya berlawanan:
beban sedikit lebih merata, tetapi fit sedikit lebih rendah. Keduanya sangat kecil, dan yang penting,
keduanya tidak menunjukkan perbaikan yang meyakinkan.

### Batas penting dari hasil ini

Ablasi ini **tidak** memakai embedding live. Ia memakai **proxy deterministik** untuk K. Alasannya
tercatat di berkas hasil: `"liveAblation": "BLOCKED"`, `"note": "K di sini adalah PROXY deterministik
(bukan embedding live)"`.

Konsekuensinya harus dinyatakan tegas: **ablasi ini belum membuktikan apakah embedding semantik live
memberi peningkatan kualitas.** Yang terbukti hanyalah bahwa komponen K, dalam bentuk proxy yang
dipakai, mengubah keputusan tanpa memperbaiki coverage. Klaim yang lebih kuat dari itu tidak punya
dasar pada data ini.

Ablasi live menjadi mungkin setelah integrasi Gemini diverifikasi (§3.9), tetapi belum dijalankan
ulang dengan embedding sungguhan.

## 3.6 Kejujuran Penjelasan

Pengujian ini memeriksa apakah setiap klaim dalam kalimat penjelasan sesuai dengan angka yang
dihitung sistem. Hasilnya dibagi antara dua jalur penjelasan.

**Tabel 3.3 Kejujuran penjelasan per jalur**

| Jalur | Teks diuji | Klaim benar | Tidak didukung | Bertentangan | Total klaim |
|---|---|---|---|---|---|
| `memberReason` (template) | 6 | **33** | 0 | 0 | 33 |
| `generateExplanation` | 6 | 16 | **8** | **2** | 26 |

Sumber: `eval/results/truthfulness.json`.

**Jalur template bersih.** Seluruh 33 klaim dari 6 teks terbukti benar. Ini masuk akal karena
template disusun langsung dari angka: bila C = 0,90, kalimat menyebut 90%; bila R1 gugur, kalimat
menyebut gugur. Template tidak bisa mengarang karena ia tidak punya kebebasan menyusun kata.

**Jalur `generateExplanation` punya masalah nyata.** Dari 26 klaim, **8 tidak didukung** dan **2
bertentangan**. Pola yang berulang:

- Frasa **"sisa kapasitas yang memadai"** tetap muncul meskipun C = 0,00. Pada kasus Budi dan Citra,
  kapasitas sudah habis, tetapi kalimat tetap berbunyi seolah kapasitas masih cukup. Inilah dua
  kontradiksi yang tercatat.
- Frasa **"memenuhi persyaratan dasar"** muncul ketika tugas tidak memiliki skill wajib level ≥ 3,
  sehingga tidak ada dasar spesifik untuk klaim itu.
- Skor 0 % disajikan dalam bentuk kalimat afirmatif tanpa peringatan bahwa anggota tersebut gugur.

**Risiko.** Kalimat yang bertentangan dengan angka lebih berbahaya daripada tidak ada kalimat.
Pengguna yang membaca "sisa kapasitas memadai" padahal kapasitas nol akan mengambil keputusan yang
salah, dan kepercayaannya pada seluruh sistem bisa runtuh ketika ia menyadari angkanya berbeda.

**Rekomendasi.** Tiga langkah, berurutan menurut kepentingan:

1. Validator sebaiknya menolak klaim kapasitas yang tidak sesuai dengan nilai C, bukan hanya menolak
   angka yang salah. Saat ini validator memeriksa angka dan nama, tetapi belum memeriksa kesesuaian
   frasa kualitatif seperti "memadai".
2. Bila skor total 0 karena gugur aturan, kalimat sebaiknya menyatakan gugur, bukan menyusun
   rekomendasi afirmatif.
3. Selama perbaikan belum ada, jalur template lebih aman untuk dipakai sebagai keluaran utama.

Laporan ini **tidak** menyatakan seluruh penjelasan bebas kesalahan. Jalur template ya; jalur model
tidak.

## 3.7 Hasil Performa

Pengukuran dipisah tegas menjadi dua kelas, karena mencampurnya akan menyesatkan.

### Komputasi murni (in-process, n = 50)

**Tabel 3.4 Waktu komputasi**

Pengukuran ini **tidak deterministik**, sehingga dilaporkan sebagai rentang lintas pengulangan,
bukan satu angka tunggal. Pengukuran dijalankan lima kali berturut-turut pada mesin yang sama
(2026-11-19), masing-masing 50 iterasi per operasi.

**Tabel 3.12 Rentang waktu komputasi lintas pengulangan**

| Operasi | median | **P95 (rentang 5 pengulangan)** | max |
|---|---|---|---|
| Pipeline 20 skenario | 0,27–0,42 | **0,44–0,97** | 1,89–2,33 ms |
| Pipeline 1 skenario | 0,017–0,035 | 0,025–0,052 | 0,052–0,106 ms |
| What-if | 0,009–0,011 | 0,048–0,082 | 0,221–0,319 ms |
| Slider recompute | 0,005 | 0,025–0,031 | 0,231–0,350 ms |

Sumber: `eval/results/performance.json` (satu berkas hasil, ditulis ulang setiap kali skrip
`eval/scripts/run_performance.test.ts` dijalankan; berkas itu juga menjadi sumber angka di bawah),
ditambah lima pengulangan pada 2026-11-19. Satuan milidetik.

**Catatan inkonsistensi yang ditemukan saat audit akhir.** `eval/reports/L_PERFORMANCE.md` §1
mencatat pipeline 20 skenario sebagai min 0,198 / median 0,332 / P95 **0,493** / max 1,934.
Angka itu berasal dari satu pengukuran pada 10:19, sementara berkas `performance.json` ditulis ulang
pada 11:50 dan pada saat audit berisi min 0,230 / median 0,417 / P95 **0,972** / max 2,333. Keduanya
berasal dari skrip yang sama dan tidak ada yang salah; yang keliru adalah menyajikan salah satunya
sebagai angka tetap. Karena itu laporan ini memakai **rentang** dan menyebut kedua sumber.
Kesimpulan tidak berubah: seluruh nilai berada jauh di bawah ambang 1000 ms.

### Browser (bangun produksi, slider digerakkan 21 event nyata)

**Tabel 3.5 Latensi slider di browser**

| Kondisi | median | P95 | Request jaringan |
|---|---|---|---|
| Normal | **2,5 ms** | 3,3 ms | **0** |
| CPU 4× throttle | **11,6 ms** | 13,9 ms | **0** |

Sumber: `eval/reports/L_PERFORMANCE.md` §2.

### Waktu backend

**Tabel 3.6 Waktu respons dan komponennya**

| Ukuran | Nilai | Sumber |
|---|---|---|
| `POST /api/recommend` | 2,14–3,48 s (3 sampel) | curl `time_total` |
| Supabase round-trip | median 279 ms, P95 390 ms, max 2892 ms | probe langsung |
| First Contentful Paint | 112 ms | Navigation timing |
| Matriks tampil pada 4× throttle | ~7,7 s | pengukuran browser |

### Pembacaan yang benar

Angka-angka ini sering dibaca keliru, jadi perlu dinyatakan jelas:

- **Algoritma sangat cepat.** P95 pipeline 20 skenario berada di rentang 0,44–0,97 ms, jauh di bawah
  ambang 1000 ms. Angka yang perlu dipegang adalah rentangnya, bukan satu titik.
- **Slider dan what-if memenuhi target** di bawah 100 ms bahkan pada CPU yang diperlambat 4×, dengan
  nol permintaan jaringan.
- **Alur end-to-end tidak memenuhi target di bawah 1 detik.** Respons `/api/recommend` 2,14–3,48 s.
  Penyebabnya **bukan** algoritma, melainkan latensi Supabase. Satu permintaan rekomendasi melakukan
  beberapa round-trip database, dan median satu round-trip saja 279 ms.

Yang tidak boleh dilakukan adalah menjumlahkan P95 komputasi (di bawah 1 ms) dengan klaim "sistem merespons
di bawah 1 detik". Itu dua hal berbeda. Target PRD "proses tanpa AI < 1000 ms" **terpenuhi pada
tingkat komputasi** dan **tidak terpenuhi pada tingkat pengalaman pengguna**. Keduanya dilaporkan.

## 3.8 Pengujian Integrasi dan Robustness

Sepuluh kondisi diuji (`eval/results/robustness.json`). Statusnya dibedakan dengan ketat antara
lulus sungguhan, lulus dengan tiruan, dan terblokir.

**Tabel 3.7 Hasil robustness per kondisi**

| # | Kondisi | Status | Keterangan |
|---|---|---|---|
| 1 | Gemini aktif | **BLOCKED** | Pada saat evaluasi Fase 4, kunci belum ada |
| 2 | Kunci tidak tersedia | **LULUS** (kode nyata) | 0 panggilan, template dipakai |
| 3 | Rate limit | lulus dengan tiruan | Error tertangkap, slot terpakai |
| 4 | Timeout | lulus dengan tiruan | Error tertangkap, slot terpakai |
| 5 | Respons tidak valid | lulus dengan tiruan | JSON gagal diurai, jatuh ke template |
| 6 | Input terlalu panjang | **LULUS** (kode nyata) | Skema menolak deskripsi 600 karakter |
| 7 | Prompt injection sebagai data | **LULUS** (kode nyata) | Pemilik tidak berubah |
| 8 | Cache hit | lulus dengan tiruan | 0 panggilan provider |
| 9 | Cache miss | lulus dengan tiruan | 1 panggilan lalu disimpan |
| 10 | Kegagalan DB cache | lulus dengan tiruan | Tidak crash, slot terpakai |

Tiga hal perlu dikatakan.

**Kondisi 1 terblokir pada saat evaluasi.** Ini sudah sebagian terjawab oleh Fase 2: integrasi kini
terverifikasi untuk embedding dan teks (§3.9). Tetapi evaluasi robustness dengan Gemini aktif belum
dijalankan ulang, jadi status tabel di atas tetap mencerminkan keadaan saat diukur.

**Enam kondisi memakai tiruan.** Angka "1 panggilan" pada kondisi 3, 4, 8, 9, 10 berasal dari logika
anggaran, bukan lalu lintas API nyata. Tidak ada yang mengklaim sebaliknya.

**Tiga kondisi teruji pada kode sungguhan secara offline.** Kondisi 2, 6, dan 7 tidak butuh jaringan,
sehingga hasilnya benar-benar berlaku.

Catatan tambahan untuk kondisi 7: proteksi prompt injection di sini bersifat struktural. Deskripsi
tugas tidak dipakai untuk memilih pemilik, sehingga teks berbahaya tidak punya jalur untuk mengubah
penugasan, terlepas dari apa yang dikatakan model.

## 3.9 Hasil Verifikasi Gemini

Verifikasi dilakukan langsung ke provider, dengan kunci asli dan hasil yang disanitasi. Urutannya
penting karena menunjukkan bagaimana masalah ditemukan dan diperbaiki.

**Tabel 3.8 Riwayat verifikasi integrasi Gemini**

| Tahap | Model | Hasil | Bukti |
|---|---|---|---|
| Awal | `gemini-2.5-flash`, `text-embedding-004` | **HTTP 404** untuk keduanya | `T-2.06` §2 |
| Pengganti | `gemini-embedding-001` | **Berhasil, 768 dimensi** | `T-2.07` §4 |
| Pengganti | `gemini-3.8-flash` | **Berhasil** pada probe, token nyata (8/1) | `T-2.07` §3 |
| Rekomendasi live | keduanya | **`isFallback: false`**, 2 pasangan cosine | `T-2.07` §5 |
| Penjelasan FR-09 | `gemini-3.8-flash` | **HTTP 429**, kuota free tier habis | `T-2.07` §8 |

### Apa yang terbukti

Embedding berjalan dan menghasilkan vektor 768 dimensi, sesuai yang dibutuhkan kolom database.
Rekomendasi live mengembalikan `isFallback: false`, dengan `cosineMap` berisi nilai cosine nyata
(0,493238 dan 0,455945) yang hanya mungkin muncul bila embedding berhasil. Cache embedding bertambah
dari 5 menjadi 7 baris. `ai_runs` mencatat `status=success` dengan token nyata `prompt_tokens=347`,
`completion_tokens=93`. Run kedua pada cache panas hanya memerlukan 25,5 detik, turun dari 109,6
detik, tanpa menambah baris cache, membuktikan cache hit tidak dihitung sebagai panggilan.

### Apa yang belum terbukti

**Pemakaian Gemini untuk teks penjelasan pada satu run rekomendasi belum terverifikasi.** Penyebabnya
bukan konfigurasi, melainkan kuota: provider membalas `429 RESOURCE_EXHAUSTED`, dengan rincian
`generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash, requests per day limit
exceeded on Free Tier`, dan permintaan untuk mencoba lagi sekitar 3 jam 38 menit kemudian.

Modelnya sendiri sah: permintaan sebelumnya pada sesi yang sama berhasil dengan token nyata. Model
embedding dan model teks lain masih berfungsi pada kunci yang sama, jadi ini kuota per model, bukan
konfigurasi yang salah.

Karena panggilan penjelasan gagal, `lib/ai/explain.ts:212-215` menangkap error dan memakai template.
`ai_runs` tetap mencatat `success` karena kegagalan penjelasan bukan kegagalan skor. Konsekuensinya,
angka "success" pada baris itu **tidak** membuktikan bahwa teks penjelasan dihasilkan Gemini.

Inilah sebabnya status FR-09 ditulis "VERIFIED (template), AI live OK, pemakaian per-run belum
terbukti" di `docs/STATUS.md:15`, bukan "VERIFIED" biasa.

### Batas tiga panggilan, terverifikasi

Pada run pertama tercatat dua panggilan (satu embedding terbatch, satu penjelasan). Pada run kedua
tercatat satu panggilan (nol embedding karena cache). Keduanya di bawah batas tiga. Pada kondisi
kuota habis, sistem tidak mencoba mengulang di luar batas.

## 3.10 Keterbatasan

Daftar ini disusun supaya pembaca tahu tepat di mana batas kesimpulan berlaku.

**Tabel 3.13 Keterbatasan dan dampaknya pada klaim**

| Keterbatasan | Dampak pada klaim | Bukti |
|---|---|---|
| Tidak ada data D3 | Tidak ada klaim yang berlaku untuk kelompok nyata | `eval/datasets/` tidak berisi D3 |
| Human agreement belum dilakukan | Tidak bisa mengklaim sistem disetujui pengguna | `G_HUMAN_AGREEMENT.md`: BLOCKED |
| Ablasi live belum tersedia | Tidak bisa mengklaim embedding semantik memperbaiki kualitas | `ablation.json`: `liveAblation: BLOCKED` |
| Robustness live belum lengkap | Hanya 3 dari 10 kondisi teruji pada kode nyata | `robustness.json` |
| Supabase tidak stabil | Waktu respons bervariasi sampai 2,9 s | `L_PERFORMANCE.md` §3 |
| FR-09 belum terverifikasi penuh | Penjelasan per-run bisa template | `T-2.07` §8 |
| Perilaku tanpa kandidat R2 belum final | 24 pelanggaran R2 tersisa | `D_HARD_RULES.md` |
| Kuota gratis 20/hari | Pengujian live terbatas | pesan 429 |
| Playwright tidak terpasang | Pengukuran browser memakai CDP, bukan Playwright | `package.json` |
| PRD berhenti di Bagian 7 | Persyaratan Bagian 13–16 tidak dapat ditelusuri ke PRD | `prd.md` |

## 3.11 Pembahasan

### Apakah sistem menjawab masalah awal

Untuk dua dari empat masalah, jawabannya cukup jelas.

**Masalah transparansi terjawab.** Setiap rekomendasi disertai empat komponen skor yang bisa dilihat,
dan jalur template menghasilkan 33 dari 33 klaim yang benar. Pengguna bisa menunjuk angka, bukan
perasaan.

**Masalah evaluasi alternatif terjawab.** What-if menghitung ulang dalam hitungan milidetik tanpa
memanggil server, sehingga pengguna bisa mencoba beberapa susunan sebelum memutuskan.

**Masalah beban tidak seimbang terjawab sebagian.** Hybrid menurunkan pelanggaran R1 menjadi nol,
tetapi masih meninggalkan 24 pelanggaran R2, sama dengan pembagian manual. Untuk keseragaman beban,
round-robin justru lebih baik (stddev 3,876 berbanding 5,616). Jadi sistem ini belum menyelesaikan
masalah pemerataan; ia memindahkan sebagian masalah ke tempat yang bisa diperiksa.

**Masalah kecocokan keterampilan terjawab sebagian.** Coverage 0,808 lebih baik daripada random
(0,754), tetapi di bawah manual (0,867) dan seri dengan round-robin. Penyaringan R3 memberi sebagian
besar manfaatnya; komponen K belum menunjukkan tambahan.

### Manfaat dan keterbatasan pendekatan hybrid

Manfaat terbesarnya bukan akurasi, melainkan **kepatuhan aturan yang bisa diaudit**. Nol pelanggaran
R1 adalah hasil yang tidak dicapai metode lain, dan itu berasal dari struktur, bukan kebetulan.
Untuk aplikasi yang dipakai bersama dalam kelompok, kemampuan menyatakan "tidak ada anggota tanpa
kapasitas yang diberi tugas" punya nilai praktis yang besar.

Keterbatasannya juga jelas: menambah komponen tidak otomatis menambah kualitas. Ablasi menunjukkan K
memindahkan 25,7 % keputusan tanpa memperbaiki coverage. Ini pelajaran metodologis yang penting, dan
justru karena itu dilaporkan, bukan dihilangkan.

### Konsekuensi trade-off

Data menunjukkan bahwa setiap metode menang di ukuran yang berbeda. Round-robin menang di
keseragaman beban karena ia memang membagi rata. Manual menang di coverage karena ada pengetahuan
manusia di dalamnya. Hybrid menang di kepatuhan R1.

Pembaca yang mencari "metode mana yang terbaik" tidak akan menemukan jawaban tunggal di laporan ini,
karena datanya tidak mendukung jawaban tunggal. Yang didukung data adalah pilihan berdasarkan
prioritas: bila prioritasnya tidak memberi tugas ke orang yang tidak punya waktu, hybrid adalah
pilihan yang tepat; bila prioritasnya pemerataan jam, round-robin lebih baik.

### Apa yang perlu diperbaiki

Empat hal, berurutan menurut dampak:

1. **Perbaiki perilaku saat tidak ada kandidat R2.** 24 pelanggaran R2 sebagian besar berasal dari
   sini. Pilihan produknya perlu diputuskan lebih dulu: biarkan tugas tanpa pemilik, atau naikkan
   batas, atau beri peringatan tegas.
2. **Perkuat validator penjelasan** agar menolak klaim kualitatif yang tidak didukung (§3.6).
3. **Jalankan ablasi live** setelah integrasi Gemini stabil, supaya pertanyaan "apakah embedding
   semantik membantu" bisa dijawab dengan data sungguhan.
4. **Kurangi jumlah round-trip database** pada `/api/recommend`, karena inilah penyebab utama
   respons 2–3,5 detik.

---
---

# BAB 4 KESIMPULAN DAN SARAN

## 4.1 Kesimpulan

**Terhadap rumusan masalah pertama** (membangun sistem dengan dasar perhitungan yang bisa diperiksa):
sistem berhasil dibangun. Setiap penugasan disertai komponen K, S, C, M yang bisa ditelusuri ke rumus
eksplisit, dan 15 kasus aturan keras terverifikasi berperilaku sesuai definisinya. Kelemahannya
adalah tabel `ai_runs` belum menyimpan alasan kegagalan AI, sehingga sebagian riwayat tidak bisa
ditelusuri dari database.

**Terhadap rumusan masalah kedua** (perbandingan dengan baseline): hybrid unggul jelas pada kepatuhan
R1 (0 pelanggaran berbanding 31 untuk random, 2 untuk round-robin dan manual) dan kompetitif pada R3
(1 pelanggaran berbanding 4 dan 147). Namun hybrid **tidak** unggul pada skill coverage (0,808,
seri dengan round-robin, di bawah manual 0,867), tidak unggul pada keseragaman beban (5,616
berbanding round-robin 3,876), dan masih menyisakan 24 pelanggaran R2. **Hybrid bukan metode terbaik
secara keseluruhan pada data ini.**

**Terhadap rumusan masalah ketiga** (apakah K mengubah keputusan dan memperbaiki kualitas): K
mengubah 25,7 % keputusan (9 dari 35 tugas), tetapi Δ skill coverage = 0 dan Δ fit sedikit negatif
(−0,027). Jadi K berpengaruh, tetapi pengaruhnya **belum terbukti memperbaiki kualitas**. Ablasi yang
dilakukan memakai proxy deterministik, bukan embedding live, sehingga kesimpulan ini pun terbatas.

**Terhadap rumusan masalah keempat** (kejujuran penjelasan): jalur template bersih, 33 dari 33 klaim
benar. Jalur model tidak bersih: dari 26 klaim, 8 tidak didukung dan 2 bertentangan, terutama karena
frasa "sisa kapasitas yang memadai" tetap muncul ketika kapasitas nol. **Sistem belum bebas kesalahan
dalam penjelasan.**

**Terhadap rumusan masalah kelima** (integrasi Gemini): integrasi berjalan dan terverifikasi untuk
embedding (768 dimensi) dan teks (token nyata), dengan rekomendasi live menghasilkan
`isFallback: false` dan nilai cosine yang sah. Namun pemakaian Gemini untuk teks penjelasan pada satu
run rekomendasi **belum** terverifikasi karena kuota harian habis (HTTP 429). Sistem tetap berfungsi
penuh tanpa Gemini melalui mode cadangan, dan itu terbukti.

**Terhadap tujuan proyek** (mengukur, bukan mengklaim): seluruh target PRD yang terukur dilaporkan
apa adanya, termasuk yang tidak tercapai. Target respons di bawah 1 detik terpenuhi pada tingkat
komputasi (P95 di bawah 1 ms) dan tidak terpenuhi pada tingkat pengalaman pengguna (2,14–3,48 s, didominasi
latensi basis data).

## 4.2 Saran

### Perbaikan teknis jangka pendek

1. **Putuskan dan terapkan perilaku saat tidak ada kandidat R2.** Ini menyumbang sebagian besar dari
   24 pelanggaran R2. Tanpa keputusan ini, angka tersebut tidak akan turun.
2. **Perkuat `lib/ai/explanation-validator.ts`** agar menolak klaim kualitatif (misalnya "kapasitas
   memadai") yang tidak sesuai dengan nilai C, dan agar kalimat untuk skor 0 menyatakan gugur.
3. **Tampilkan alasan kegagalan AI.** Tambahkan kolom pesan error pada `ai_runs` (atau log
   terstruktur), supaya kegagalan tidak lagi tampak seperti fallback normal. Ini temuan audit Fase 2
   yang belum ditutup.
4. **Perluas pola redaksi kunci** di `lib/ai/call-budget.ts:158` agar mengenali format `AQ.…`, karena
   format itu tidak saat ini tidak diredaksi.
5. **Kurangi round-trip database** pada `/api/recommend` (gabungkan pembacaan, atau cache hasil baca
   dalam satu proses) untuk menurunkan respons ke bawah 1 detik.

### Peningkatan evaluasi

1. **Jalankan ablasi live** dengan embedding sungguhan, sekarang setelah integrasi terverifikasi.
   Ini menjawab pertanyaan yang saat ini terblokir.
2. **Lakukan human agreement** dengan tiga reviewer memakai instrumen yang sudah siap di
   `eval/instruments/human_agreement_instrument.md`. Tanpa ini, klaim kualitas menurut penilaian
   manusia tidak boleh dibuat.
3. **Kumpulkan data D3** dengan persetujuan tertulis, supaya hasil tidak hanya berlaku pada data
   sintetis.
4. **Ulangi robustness dengan Gemini aktif**, sehingga kondisi 1 tidak lagi terblokir dan kondisi
   tiruan bisa diganti pengujian nyata.
5. **Uji beberapa konfigurasi bobot** untuk mengetahui apakah 0,40/0,30/0,20/0,10 masih wajar, dan
   laporkan hasilnya apa adanya.

### Pengembangan lanjutan di luar MVP

1. **Pertimbangkan solver penugasan** (misalnya metode Hungarian) untuk kasus dengan banyak tugas,
   dengan catatan bahwa aturan R3 dan R5 harus masuk sebagai batasan agar tidak kehilangan
   sifat yang sudah diuji.
2. **Beri penjelasan berbasis kontras** ("dipilih daripada X karena..."), mengikuti saran Miller
   (2019), yang menurut pengujian lebih membantu pengguna daripada penjelasan absolut.
3. **Cadangkan model teks.** Kuota per model habis secara terpisah, sehingga mekanisme cadangan
   antarmodel akan membuat sistem lebih tahan terhadap batas kuota.
4. **Pertimbangkan penilaian bobot partisipatif**, yaitu anggota kelompok ikut menentukan bobot, agar
   keputusan terasa lebih adil meskipun hasil hitungnya sama.

## 4.3 Catatan Penutup

Laporan ini memuat hasil yang tidak semuanya menguntungkan sistem: hybrid seri dengan round-robin
pada skill coverage, kalah pada keseragaman beban, masih melanggar R2 sebanyak 24 kali, dan jalur
penjelasan modelnya memiliki dua kontradiksi terukur. Semua itu dilaporkan dengan angka aslinya,
tidak dihaluskan.

Alasannya sederhana: nilai sebuah evaluasi terletak pada kemampuannya menunjukkan apa yang belum
berhasil. Sistem yang dilaporkan sempurna tetapi tidak bisa menunjukkan batasnya sendiri tidak bisa
dipercaya maupun dikembangkan.
