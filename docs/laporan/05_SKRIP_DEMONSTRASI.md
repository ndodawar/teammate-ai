# 05. Skrip Presentasi dan Demonstrasi

Dokumen ini dipakai saat sidang atau demo. Isinya urutan tindakan, kalimat pembicara, hasil yang
diharapkan, dan bukti yang perlu ditunjukkan.

Dua aturan yang mengikat seluruh skrip:

1. **Jangan menjanjikan hal yang belum terbukti.** Demo Gemini untuk teks penjelasan **tidak**
   dijanjikan berhasil, karena kuota gratis 20 permintaan per hari per model mudah habis dan pernah
   menghasilkan HTTP 429 (`eval/reports/T-2.07_GEMINI_FIX_VERIFICATION.md` §8). Skrip ini menyiapkan
   jalur jujur untuk itu (§11).
2. **Jangan menyebut data sintetis sebagai data pengguna nyata.** Semua anggota dan tugas yang
   ditampilkan pada demo adalah data contoh yang dibuat saat demo berjalan, bukan data kelompok
   mahasiswa sungguhan.

Label antarmuka yang dikutip di bawah (mis. `Muat 11 template`, `Ekspor CSV`, `Mode cadangan aktif`)
dibaca dari `app/page.tsx`, `app/p/[code]/tasks/tasks-client.tsx`,
`app/p/[code]/members/members-client.tsx`, dan `app/p/[code]/result/result-client.tsx`. Kalimat
pembicara adalah usulan, bukan teks yang tertanam di aplikasi.

---

## 0. Persiapan sebelum masuk ruang sidang

| Persiapan | Perintah / tindakan | Kenapa |
|---|---|---|
| Bangun produksi, bukan dev | `npm run build` lalu `npm run start` | Angka latensi pada `L_PERFORMANCE.md` diukur pada bangun produksi; mode dev lebih lambat dan angkanya tidak sebanding |
| Siapkan satu proyek cadangan | Buat proyek dengan anggota dan tugas **sebelum** presentasi | Supaya langkah 5–10 bisa langsung dilakukan meski jaringan lambat |
| Siapkan berkas bukti terbuka | `eval/results/methods_summary.json`, `eval/results/truthfulness.json`, `eval/results/ablation.json` | Ditunjukkan saat menjelaskan hasil, bukan dibacakan dari slide |
| Catat kuota Gemini hari itu | Satu panggilan probe ke model teks | Menentukan apakah langkah 4 memakai AI sungguhan atau dijelaskan sebagai mode cadangan |
| Uji seluruh alur sekali | Ikuti langkah 1–10 pada proyek uji | Lebih baik gagal 30 menit sebelum sidang daripada di depan penguji |

**Waktu total demo:** sekitar 12–15 menit bila jaringan lancar; 8–10 menit bila demo jatuh ke mode
cadangan. Keduanya sudah dirancang, jadi tidak ada kepanikan bila kuota habis.

---

## 1. Membuat proyek

**Tindakan di browser**

1. Buka `http://localhost:3000/`.
2. Isi kolom **Nama proyek / mata kuliah**, misalnya `Sistem Informasi: Tugas Besar`.
3. Isi **Tenggat**.
4. Klik **Buat proyek**.

**Hasil yang diharapkan**
Halaman berpindah ke `/p/[kode]`. **Kode proyek** tampil dan bisa disalin. Kode ini yang dibagikan ke
anggota untuk mengisi profil.

**Narasi pembicara**

> "Aplikasi ini tidak memakai sistem login. Alasannya bukan kelengkapan, tetapi cakupan MVP: PRD
> membatasi produk pada satu kelompok per proyek. Sebagai gantinya, setiap proyek punya kode akses
> minimal sepuluh karakter. Kode inilah yang saya bagikan ke anggota."

**Bukti yang ditunjukkan**
Kode proyek pada layar. Bila penguji bertanya soal aturan kode, tunjukkan `test/api/projects.test.ts`.

---

## 2. Memasukkan anggota

**Tindakan di browser**

1. Masuk ke halaman **Anggota**.
2. Klik **Tambah anggota**.
3. Isi nama dan kapasitas (jam per minggu).
4. Ulangi untuk 4 anggota: sebut saja A, B, C, D. Beri perbedaan yang disengaja: A kuat di penulisan,
   B kuat di pemrograman, C punya kapasitas kecil, D punya kapasitas besar.
5. Buka profil satu anggota (**Profil Anggota**) dan isi skill beserta level 1–5, minat, dan catatan.

**Hasil yang diharapkan**
Daftar anggota tampil lengkap. Setiap anggota punya level skill yang bisa dibedakan.

**Narasi pembicara**

> "Perhatikan bahwa level skill di sini bernilai 1 sampai 5, dan itu bukan hiasan. Angka ini dipakai
> aturan R3: kalau ada anggota dengan setidaknya satu skill wajib pada level 3 atau lebih, hanya
> anggota itulah yang boleh menjadi kandidat. Jadi level 2 dan level 4 punya akibat yang berbeda,
> bukan hanya label."

**Bukti yang ditunjukkan**
Satu profil anggota yang menampilkan skill dan level. Tunjukkan juga, bila perlu, bahwa anggota
dengan kapasitas 0 akan gugur di aturan R1 pada langkah 6.

---

## 3. Memuat atau membuat tugas

**Tindakan di browser**

1. Masuk ke halaman **Tugas**.
2. Klik **Muat 11 template**.
3. Setelah muncul, ubah satu tugas agar jelas non-IT, misalnya deskripsi laporan atau presentasi.
4. Tambahkan satu tugas manual dengan **Tambah tugas** untuk menunjukkan bahwa pengguna tidak
   terkurung pada template.

**Hasil yang diharapkan**
Sebelas tugas template muncul, ditambah satu tugas buatan sendiri. Setiap tugas punya estimasi jam,
tingkat kesulitan, dan skill wajib.

**Narasi pembicara**

> "Sebelas template ini adalah jumlah yang benar-benar ada di aplikasi, bukan angka bulat yang saya
> pilih untuk presentasi. Template dibuat untuk tugas proyek berbasis AI, dan itu justru kelemahan
> yang saya sadari: kelompok non-IT butuh tugas jenis lain. Karena itu ada dataset D1 yang menguji
> 15 variasi tugas non-IT di luar template."

**Bukti yang ditunjukkan**
Hitungan sebelas kartu tugas. Bila ada yang bertanya asal angka sebelas, tunjukkan
`lib/constants/task-templates.ts` berisi `id: 'T01'` sampai `id: 'T11'`.

---

## 4. Menjalankan analisis tugas

**Ini langkah yang bergantung pada kuota. Baca cabangnya lebih dulu.**

**Tindakan di browser**

1. Klik **Analisis semua dengan AI**.
2. Tunggu proses selesai.
3. Tinjau saran yang muncul. Sistem **tidak** langsung menerapkan hasil; pengguna memeriksa dulu.

**Hasil yang diharapkan (jika kuota tersedia)**
Saran skill, tingkat kesulitan, dan estimasi jam muncul untuk ditinjau. Setelah dikonfirmasi, atribut
tugas diperbarui.

**Hasil yang diharapkan (jika kuota habis)**
Muncul pesan kegagalan yang ramah, dan tugas tetap seperti semula. Aplikasi tidak rusak.

**Narasi pembicara, cabang berhasil**

> "Analisis AI di sini mengusulkan, bukan memutuskan. Hasilnya masuk ke panel tinjauan, dan saya
> sendiri yang menekan tombol untuk menerapkannya. Ini disengaja: keluaran model bahasa bisa salah,
> dan kesalahan pada estimasi jam akan merambat ke seluruh perhitungan beban. Jadi model tidak pernah
> menulis langsung ke data."

**Narasi pembicara, cabang kuota habis (jujur)**

> "Analisis AI tidak bisa saya jalankan sekarang karena kuota gratis model teks untuk hari ini sudah
> habis. Yang bisa saya tunjukkan adalah buktinya di laporan: model yang sama berhasil pada pengujian
> dengan token nyata, `prompt_tokens` 347 dan `completion_tokens` 93, dan saya bisa menunjukkan
> catatannya. Jadi kegagalan hari ini adalah batas kuota, bukan integrasi yang tidak jalan. Saya
> sengaja tidak mengklaim lebih dari itu, dan justru inilah bagian yang belum selesai di proyek ini."

**Bukti yang ditunjukkan**
`eval/reports/T-2.07_GEMINI_FIX_VERIFICATION.md` §3 (probe berhasil, token nyata) dan §8 (pesan 429
beserta rincian kuota). Bila pameran dilakukan tanpa jaringan, langsung ke langkah 5 dengan catatan
bahwa tugas sudah terisi sebelumnya.

---

## 5. Menghitung rekomendasi

**Tindakan di browser**

1. Masuk ke halaman **Hasil** (`/p/[kode]/result`).
2. Klik tombol untuk menghitung rekomendasi.
3. Tunggu hingga matriks muncul.

**Hasil yang diharapkan**
Matriks rekomendasi tampil: baris adalah tugas, kolom adalah anggota. Setiap sel menampilkan status
**utama**, **kandidat**, atau **gugur**, beserta skor.

**Narasi pembicara**

> "Saya minta penguji memperhatikan dua hal. Pertama, waktu tunggu di sini dua sampai tiga setengah
> detik pada pengujian saya. Itu bukan karena algoritmanya lambat; algoritmanya butuh di bawah satu
> milidetik. Yang lambat adalah basis data, dengan median satu putaran 279 milidetik dan beberapa kali
> bolak-balik. Kedua, matriks ini adalah usulan yang belum disimpan. Saya bisa menghitung ulang
> sepuluh kali tanpa mengubah satu pun keputusan yang sudah disepakati."

**Bukti yang ditunjukkan**
`eval/reports/L_PERFORMANCE.md` §3 untuk angka latency, dan penjelasan bahwa komputasi diukur
terpisah dari waktu respons.

---

## 6. Menunjukkan rincian K/S/C/M

**Tindakan di browser**

1. Klik satu sel atau satu tugas untuk membuka rinciannya.
2. Tunjukkan empat komponen: **K** (kemiripan teks), **S** (skill), **C** (kapasitas), **M** (minat).
3. Tunjukkan satu anggota berstatus **gugur**, dan tunjukkan mengapa.

**Hasil yang diharapkan**
Rincian komponen per kandidat tampil, disertai alasan singkat.

**Narasi pembicara**

> "Setiap angka di sini bisa saya telusuri ke rumus. K adalah cosine similarity yang dipetakan dari
> rentang 0,2 sampai 0,8 menjadi 0 sampai 1. S adalah rata-rata level skill wajib dibagi lima. C
> adalah sisa kapasitas setelah tugas diterima. M adalah minat yang dipetakan ke 0 sampai 1. Lalu
> totalnya adalah 0,40 K ditambah 0,30 S ditambah 0,20 C ditambah 0,10 M."

**Satu hal yang wajib dijelaskan agar tidak disalahpahami**

> "Ada kemungkinan penguji menemukan baris dengan C yang masih tinggi tetapi totalnya nol. Itu bukan
> kesalahan hitung. Kalau anggota melanggar aturan R1 atau R2, skor totalnya dipaksa nol supaya tidak
> terpilih, tetapi komponennya tetap ditampilkan apa adanya. Tujuannya supaya kita bisa melihat
> kondisi sebenarnya sambil tahu bahwa orang itu gugur."

**Bukti yang ditunjukkan**
`lib/scoring/score.ts` dan `lib/scoring/constants.ts` untuk bobot, bila penguji meminta sumber rumus.

---

## 7. Menggeser bobot dan memperlihatkan perubahan

**Tindakan di browser**

1. Geser slider **Bobot komponen** dari 40/30/20/10 ke susunan lain, misalnya menaikkan S dan
   menurunkan K.
2. Perhatikan bahwa matriks berubah **tanpa menunggu**.
3. Tunjukkan label **Hitung ulang terakhir: … ms** yang muncul.

**Hasil yang diharapkan**
Susunan penugasan dan angka berubah seketika. Label waktu hitung ulang tampil dalam milidetik.

**Narasi pembicara**

> "Slider ini menghitung ulang seluruh skor di browser. Tidak ada permintaan ke server sama sekali.
> Pada pengukuran, median 2,5 milidetik, dan bahkan ketika prosesor saya perlambat empat kali, paling
> lama 32,5 milidetik. Angka ini milidetik, bukan detik, jadi terasa seketika."

**Bukti yang ditunjukkan**
`eval/reports/L_PERFORMANCE.md` §2 (nol permintaan jaringan, median 2,5 ms, 11,6 ms pada throttle 4×)
dan catatan FR-10 di `docs/STATUS.md` (maksimum 32,5 ms pada throttle 4×).

**Catatan konsistensi untuk pembicara:** angka 11,6 ms adalah median slider pada throttle 4×; angka
32,5 ms adalah maksimum yang pernah tercatat pada kondisi yang sama. Sebut keduanya dengan labelnya
masing-masing, jangan dicampur.

---

## 8. Memindahkan tugas menggunakan what-if

**Tindakan di browser**

1. Pilih satu tugas dan satu anggota tujuan.
2. Jalankan pratinjau pemindahan (**Pratinjau: … ke …**).
3. Tunjukkan bahwa perubahan **belum** diterapkan.
4. Klik **Terapkan perpindahan** untuk mengonfirmasi.

**Hasil yang diharapkan**
Pratinjau menampilkan usulan baru tanpa mengubah data. Setelah diterapkan, matriks diperbarui.

**Narasi pembicara**

> "Ini bagian yang paling sering menjadi masalah kalau dilakukan manual. Memindahkan satu tugas
> mengubah beban dua orang, dan bisa mengubah siapa yang gugur karena batas 1,25 kali beban ideal.
> Menghitung itu di kepala hampir mustahil. Di sini pratinjaunya muncul lebih dulu, jadi saya bisa
> membatalkan kalau hasilnya justru lebih buruk. Hitung ulang pratinjau ini juga di bawah 100
> milidetik, tanpa jaringan."

**Bukti yang ditunjukkan**
`eval/reports/L_PERFORMANCE.md` §1 (what-if P95 puluhan mikrodetik) dan §2 (nol permintaan jaringan).

---

## 9. Menunjukkan lock dan undo

**Tindakan di browser**

1. Klik **Kunci** pada satu tugas.
2. Hitung ulang rekomendasi (bila tombolnya tersedia), lalu tunjukkan tugas itu **tetap** pada
   pemiliknya meskipun kandidat lain punya skor lebih tinggi.
3. Klik **Buka kunci** untuk melepas.
4. Lakukan satu perubahan lain, lalu tekan **Undo**.

**Hasil yang diharapkan**
Tugas terkunci mempertahankan pemiliknya. Undo mengembalikan keadaan satu langkah sebelumnya.

**Narasi pembicara**

> "Kunci ini bukan sekadar tanda di layar. Ia masuk ke mesin penugasan sebagai peta tugas terkunci,
> dan tugas yang terkunci tidak dihitung ulang sama sekali. Ini aturan R5. Undo menyimpan satu
> cuplikan keadaan sebelum perubahan, jadi satu langkah terakhir selalu bisa dibatalkan."

**Bukti yang ditunjukkan**
`lib/scoring/assign.ts` baris 41–56 (`lockedMap`) dan tiga kasus R5 di `eval/results/hard_rules.json`.

---

## 10. Menunjukkan ekspor

**Tindakan di browser**

1. Klik **Ekspor CSV**.
2. Buka berkas hasilnya.

**Hasil yang diharapkan**
Berkas CSV terunduh berisi penugasan final, beban per anggota, dan skor.

**Narasi pembicara**

> "Ekspor ini dihasilkan dari data yang sudah ada, tanpa memanggil Gemini. Jadi hanya dengan satu
> tombol, penguji bisa mendapat hasil yang sama dengan yang tampil di layar, walaupun layanan AI
> sedang mati."

**Bukti yang ditunjukkan**
Berkas CSV terbuka di aplikasi lembar kerja.

---

## 11. Menjelaskan fallback ketika AI tidak tersedia

**Ini bagian penutup, dan bagian yang paling menentukan kredibilitas demo.**

**Tindakan di browser**

1. Bila kuota habis atau jaringan diputus, hitung ulang rekomendasi.
2. Perhatikan pemberitahuan **Mode cadangan aktif** yang muncul tetap di layar.
3. Tunjukkan bahwa **K hilang** dari tampilan bobot, dan bobot berpindah ke S, C, dan M.

**Hasil yang diharapkan**
Pemberitahuan mode cadangan tampil, K tidak lagi dipakai, dan rekomendasi tetap dihasilkan lengkap.

**Narasi pembicara**

> "Ini bukan pesan kegagalan yang disembunyikan. Kalau embedding tidak bisa diperoleh, aplikasi
> memberi tahu bahwa komponen K dihilangkan, lalu memakai bobot cadangan: S lima puluh persen, C
> tiga puluh tiga persen, M tujuh belas persen. Keputusan penugasan tetap keluar, karena yang memilih
> memang bukan model bahasa. Yang hilang hanya kemiripan teks dan kalimat penjelasan dari model.
> Kalimat alasan tetap ada, disusun dari angka oleh template."

**Bukti yang ditunjukkan**
`test/scoring/fallback.test.ts`, kondisi 2 dan 5 pada `eval/results/robustness.json`, dan
`app/p/[code]/result/result-client.tsx` untuk teks pemberitahuan.

### Kalimat penutup yang disarankan

> "Saya ingin menutup dengan satu hal yang tidak menguntungkan sistem ini. Pada data uji, hybrid
> bukan metode terbaik secara keseluruhan. Pembagian manual punya cakupan keterampilan lebih tinggi,
> 0,867 berbanding 0,808. Round-robin punya beban lebih merata, 3,88 berbanding 5,62. Dan hybrid
> masih melanggar aturan R2 sebanyak dua puluh empat kali. Yang jelas lebih baik dari metode lain
> adalah kepatuhan pada aturan R1: nol pelanggaran, sementara random tiga puluh satu. Jadi yang saya
> klaim bukan bahwa sistem ini paling pintar membagi tugas, melainkan bahwa sistem ini membuat
> pembagian tugas bisa diperiksa dan bisa dipertanggungjawabkan. Itu masalah yang berbeda, dan itu
> yang berhasil dikerjakan."

---

## 12. Antisipasi pertanyaan penguji

| Kemungkinan pertanyaan | Jawaban yang didukung bukti |
|---|---|
| "Ini pakai AI untuk memilih, ya?" | "Tidak. Model bahasa hanya menganalisis teks, membuat embedding, dan menyusun kalimat penjelasan. Pemilihan pemilik dilakukan mesin skor dan aturan. Bisa dibuktikan dengan mematikan AI: penugasan tetap keluar, hanya tanpa kalimat model." |
| "Berarti ini bukan AI, dong?" | "Ada tiga pemakaian model yang nyata: analisis tugas, embedding 768 dimensi, dan penjelasan. Tetapi keputusan akhir sengaja deterministik supaya bisa diaudit. Itu pilihan desain, bukan kekurangan." |
| "Kenapa bukan collaborative filtering?" | "Karena datanya tidak memenuhi syarat. Satu proyek berisi 2–6 anggota dan tidak ada riwayat lintas pengguna. Collaborative filtering butuh riwayat itu untuk menemukan pola kesamaan." |
| "Apa bukti embedding benar-benar jalan?" | "Rekomendasi live mengembalikan `isFallback: false` dengan dua nilai cosine nyata, 0,493238 dan 0,455945, dan cache embedding bertambah dari 5 ke 7 baris. Nilai itu mustahil muncul tanpa embedding sungguhan." |
| "Apakah penjelasannya bisa dipercaya?" | "Jalur template ya, 33 dari 33 klaim benar. Jalur model belum: dari 26 klaim, 8 tidak didukung dan 2 bertentangan. Itu saya laporkan sebagai kelemahan, bukan saya sembunyikan." |
| "Apakah sistemnya sudah diuji ke pengguna nyata?" | "Belum. Tidak ada tiga reviewer, dan tidak ada data kelompok nyata dengan persetujuan. Karena itu saya tidak membuat klaim kualitas menurut penilaian manusia." |
| "Kalau bobotnya diubah, apakah angka uji masih berlaku?" | "Tidak otomatis. Seluruh hasil memakai bobot 40/30/20/10. Saya belum menguji apakah bobot itu optimal, dan laporan menyebutnya sebagai keputusan desain awal." |
| "Kenapa masih ada 24 pelanggaran R2?" | "Karena ketika tidak ada kandidat yang memenuhi R2, sistem tetap menugaskan kandidat terbaik alih-alih membiarkan tugas tanpa pemilik. Itu keputusan produk yang belum saya tutup, dan saya sebut sebagai pekerjaan yang tersisa." |

---

## 13. Yang tidak boleh dijanjikan saat demo

| Jangan dilakukan | Lakukan ini sebagai gantinya |
|---|---|
| Menjanjikan analisis Gemini berhasil | Uji kuota sebelum sidang; siapkan cabang jujur di §4 |
| Menyebut hasil sebagai "sistem membagi tugas lebih adil" | Sebut angka: R1 nol, R2 masih 24, stddev 5,62 |
| Menyebut data contoh sebagai "data kelompok kami" | Sebut "data contoh untuk demo" |
| Menyebut respons "di bawah satu detik" | Sebut "komputasi di bawah satu milidetik, respons 2–3,5 detik karena basis data" |
| Menyebut penjelasan "sudah akurat" | Sebut jalur template bersih, jalur model punya 2 kontradiksi |
