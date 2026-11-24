# PRODUCT REQUIREMENTS DOCUMENT (PRD)

# AI GROUP TASK DISTRIBUTOR
## Pembagi Tugas Kelompok Berbasis Rekomendasi AI

**Document Version:** 0.3  
**Date:** 24 November 2026  
**Product Type:** Web Application  
**Development Stage:** Minimum Viable Product (MVP)  
**Primary Language:** Bahasa Indonesia  
**AI Approach:** Hybrid Simple Recommendation  
**Primary Stack:** Next.js, TypeScript, Tailwind CSS, Supabase, Gemini API

**Dokumen ini adalah revisi dari PRD v0.2 (13 November 2026).** Seluruh isi v0.2
dipertahankan apa adanya, kecuali bagian yang secara eksplisit ditandai sebagai
perubahan v0.3 pada **Changelog v0.2 → v0.3** di akhir Bagian 2.3.

---

# 1. PROBLEM STATEMENT

## 1.1 Background

Pengerjaan tugas kelompok merupakan salah satu metode pembelajaran yang digunakan di lingkungan perguruan tinggi. Dalam prosesnya, mahasiswa harus bekerja sama untuk menyelesaikan sejumlah pekerjaan yang memiliki tingkat kesulitan, kebutuhan keterampilan, dan estimasi usaha yang berbeda.

Namun, pembagian tugas dalam kelompok sering dilakukan secara informal berdasarkan kesepakatan anggota, keputusan ketua, atau siapa yang terlebih dahulu bersedia mengerjakan suatu pekerjaan.

Pendekatan tersebut tidak selalu menghasilkan pembagian tugas yang optimal.

Beberapa anggota mungkin mendapatkan pekerjaan yang terlalu banyak, sementara anggota lain memiliki kapasitas yang belum dimanfaatkan. Selain itu, pekerjaan tertentu dapat diberikan kepada anggota yang belum memiliki keterampilan yang sesuai.

Permasalahan lainnya adalah keputusan pembagian tugas sering kali tidak memiliki dasar perhitungan yang transparan. Anggota kelompok mungkin tidak mengetahui alasan mengapa seseorang mendapatkan tugas tertentu.

Akibatnya, pembagian pekerjaan dapat menimbulkan ketidakseimbangan beban, ketidaksesuaian keterampilan, dan kesulitan dalam mempertanggungjawabkan keputusan pembagian tugas.

Produk ini dirancang untuk membantu kelompok mahasiswa membuat keputusan pembagian tugas berdasarkan informasi anggota, kebutuhan pekerjaan, kapasitas, dan minat.

## 1.2 Core Problem

Terdapat empat permasalahan utama yang ingin diselesaikan.

### Problem 1: Pembagian beban kerja tidak seimbang

Ketua kelompok kesulitan menentukan distribusi pekerjaan agar setiap anggota mendapatkan beban yang wajar.

Anggota yang memiliki kemampuan lebih tinggi berpotensi menerima terlalu banyak pekerjaan karena dianggap paling mampu menyelesaikan berbagai jenis tugas.

### Problem 2: Ketidaksesuaian antara keterampilan dan pekerjaan

Setiap pekerjaan memiliki kebutuhan keterampilan yang berbeda.

Sebagai contoh:

- Penyusunan laporan membutuhkan kemampuan penulisan akademik dan riset literatur.
- Implementasi aplikasi membutuhkan kemampuan pemrograman.
- Pengujian sistem membutuhkan kemampuan pengujian.
- Presentasi membutuhkan kemampuan komunikasi dan penyampaian materi.

Pembagian secara manual tidak selalu mempertimbangkan kesesuaian tersebut secara sistematis.

### Problem 3: Tidak adanya dasar rekomendasi yang transparan

Keputusan pembagian tugas sering kali tidak disertai informasi mengenai:

- Kesesuaian keterampilan anggota.
- Kemiripan kemampuan dengan kebutuhan tugas.
- Kapasitas anggota yang masih tersedia.
- Minat anggota terhadap pekerjaan.
- Perbandingan skor antaranggota.

Akibatnya, anggota sulit memahami alasan di balik suatu keputusan.

### Problem 4: Sulit mengevaluasi alternatif pembagian tugas

Ketika terdapat perubahan anggota penanggung jawab, ketua kelompok perlu mempertimbangkan kembali dampaknya terhadap beban dan kesesuaian pekerjaan.

Tanpa sistem perhitungan, proses tersebut membutuhkan penilaian manual dan dapat menghasilkan keputusan yang tidak konsisten.

## 1.3 Proposed Solution

Membangun aplikasi web AI Group Task Distributor yang membantu ketua kelompok mendistribusikan tugas berdasarkan rekomendasi sistem.

Sistem menerima tiga jenis informasi utama:

1. Data anggota kelompok:
   - Nama panggilan.
   - Keterampilan.
   - Tingkat kemampuan.
   - Tingkat minat.
   - Ketersediaan waktu per minggu.
   - Catatan tambahan.

2. Data pekerjaan:
   - Judul tugas.
   - Deskripsi pekerjaan.
   - Keterampilan yang dibutuhkan.
   - Bobot usaha.
   - Tenggat pekerjaan.

3. Parameter rekomendasi:
   - Bobot kemiripan konten.
   - Bobot kecocokan skill.
   - Bobot kapasitas.
   - Bobot minat.
   - Batas beban kerja.

Sistem kemudian memproses informasi tersebut menggunakan pendekatan hybrid recommendation yang menggabungkan:

- Content-based recommendation menggunakan embedding Gemini.
- Weighted scoring untuk menghitung nilai kesesuaian.
- Hard constraints untuk menghilangkan kandidat yang tidak memenuhi ketentuan.
- Deterministic assignment untuk menentukan distribusi tugas.

AI hanya membantu memahami teks dan menghasilkan penjelasan.

AI tidak memiliki kewenangan untuk menentukan hasil akhir penugasan.

Keputusan akhir berasal dari perhitungan TypeScript yang deterministik sehingga dapat diperiksa, dihitung ulang, dan dipertanggungjawabkan.

## 1.4 Product Value

Nilai utama yang ditawarkan aplikasi:

1. Membantu ketua kelompok membagi pekerjaan berdasarkan data, bukan sekadar perkiraan.
2. Mengurangi ketimpangan beban kerja.
3. Meningkatkan kesesuaian pekerjaan dengan keterampilan anggota.
4. Memberikan alasan yang dapat ditelusuri untuk setiap rekomendasi.
5. Memungkinkan pengguna mengubah pembagian tugas dan melihat dampaknya secara langsung.
6. Menghasilkan pembagian tugas yang dapat diekspor untuk digunakan oleh kelompok.

## 1.5 Problem Boundaries

Produk ini tidak bertujuan menggantikan keputusan manusia.

Sistem hanya memberikan rekomendasi berdasarkan informasi yang dimasukkan pengguna.

Ketua kelompok tetap menjadi pihak yang menentukan apakah rekomendasi diterima, ditukar, atau diganti.

Produk juga tidak bertujuan menjadi aplikasi manajemen proyek lengkap.

Fokus utama adalah membantu menentukan siapa yang paling sesuai untuk mengerjakan suatu tugas dengan mempertimbangkan kapasitas dan minat anggota.

---

# 2. GOALS

## 2.1 Primary Goals

### Goal 1: Menghasilkan rekomendasi pembagian tugas

Sistem harus mampu memberikan rekomendasi penanggung jawab untuk setiap pekerjaan berdasarkan data anggota yang tergabung dalam proyek.

Target:
- Mendukung minimal 2 anggota.
- Menerima seluruh anggota yang bergabung dengan kode proyek, tanpa batas maksimal.
- Setiap tugas memiliki tepat satu penanggung jawab.
- Rekomendasi dihasilkan dalam hitungan detik.

### Goal 2: Menghasilkan rekomendasi yang dapat dijelaskan

Setiap rekomendasi harus memiliki rincian empat komponen penilaian:

- K: Content Similarity.
- S: Skill Match.
- C: Capacity.
- M: Interest.

Sistem harus menampilkan nilai setiap komponen dan skor akhir.

Target:
- Seluruh angka berasal dari perhitungan aktual.
- Setiap rekomendasi memiliki satu kalimat alasan.
- Alasan tidak boleh mengandung fakta yang tidak terdapat dalam data anggota atau hasil perhitungan.

### Goal 3: Menyeimbangkan distribusi beban

Sistem harus mempertimbangkan jumlah usaha yang telah diterima anggota sebelum memberikan tugas berikutnya.

Target:
- Batas beban mengikuti faktor 1,25 kali beban ideal.
- Anggota yang tidak memiliki waktu tersedia tidak menjadi kandidat.
- Anggota tidak dipilih jika penambahan tugas melanggar aturan kapasitas.

### Goal 4: Memberikan kendali kepada pengguna

Pengguna harus dapat memodifikasi hasil rekomendasi tanpa harus menjalankan ulang seluruh proses AI.

Target:
- Mengubah bobot menggunakan slider.
- Memindahkan tugas ke anggota lain.
- Melihat pratinjau perubahan.
- Mengunci penugasan.
- Mengurungkan perubahan terakhir.

### Goal 5: Menghemat penggunaan AI

Penggunaan Gemini harus dibatasi agar aplikasi tetap efisien.

Target:
- Maksimal 3 panggilan Gemini untuk satu proses rekomendasi.
- Hasil analisis dan embedding disimpan dalam cache berdasarkan hash teks.
- Perubahan slider tidak memanggil AI.
- Mode what-if tidak memanggil AI.
- Tukar dan kunci penugasan tidak memanggil AI.
- Ekspor tidak memanggil AI.

### Goal 6: Menyediakan mode cadangan

Aplikasi tetap dapat digunakan ketika Gemini mengalami gangguan atau batas penggunaan tercapai.

Target:
- Rekomendasi tetap dapat dihitung tanpa AI.
- Komponen content similarity dihilangkan.
- Bobot komponen lainnya disesuaikan.
- Antarmuka menampilkan pemberitahuan bahwa sistem sedang menggunakan mode cadangan.

## 2.2 Success Metrics

Seluruh angka berikut merupakan target pengujian, bukan klaim hasil yang sudah dicapai.

| Metric | Target |
|---|---:|
| Skill coverage | 100% pada tugas yang memiliki kandidat sesuai |
| Load imbalance | Maksimal 0,25 |
| Human agreement | Minimal 70% masuk dua pilihan teratas |
| Recommendation acceptance | Minimal 60% |
| Explanation honesty | 0 pelanggaran |
| Response time with AI | Maksimal 10 detik |
| Fallback response time | Di bawah 1 detik |
| Client-side recalculation | Di bawah 100 ms |
| Gemini calls per process | Maksimal 3 |

### Definisi operasional Skill coverage

Target **tetap 100%** dan tidak berubah. Yang dirinci di v0.3 hanyalah cara
mengukurnya, agar metrik dapat diuji secara objektif dari aturan yang sudah ada
di v0.2 (R1, R2, R3).

**Kandidat sesuai** untuk sebuah tugas didefinisikan sebagai anggota yang
memenuhi ketiga aturan berikut sekaligus:

| Aturan | Syarat menjadi kandidat sesuai |
|---|---|
| R1 | Jam tersedia anggota tidak 0. |
| R2 | Beban anggota setelah menerima tugas tidak melebihi 1,25 × beban ideal. |
| R3 | Anggota memiliki minimal satu skill wajib pada level 3 atau lebih. Definisi ini bersifat *minimal satu* (bukan *semua* skill wajib). |

Sebuah tugas dihitung sebagai **tugas yang memiliki kandidat sesuai** apabila
terdapat paling sedikit satu anggota yang memenuhi R1, R2, dan R3 sekaligus.

Rumus pengukuran:

```
Skill coverage = (jumlah tugas yang memperoleh penanggung jawab dari kandidat sesuai)
               / (jumlah tugas yang memiliki kandidat sesuai) × 100%
```

Ketentuan pengukuran:

1. Penyebut hanya memuat tugas yang memiliki kandidat sesuai. Tugas yang tidak
   memiliki kandidat sesuai tidak dihitung pada penyebut maupun pembilang.
2. Tugas yang tidak memiliki kandidat yang memenuhi **R2** **tidak boleh**
   dihitung sebagai keberhasilan penugasan, meskipun tugas tersebut akhirnya
   memperoleh penanggung jawab.
3. Rekomendasi **fallback R3** (kondisi ketika tidak ada anggota dengan skill
   wajib level 3 atau lebih, sehingga sistem tetap menampilkan rekomendasi
   terbaik disertai peringatan) **tidak dianggap** sebagai kandidat yang
   memenuhi R3. Penugasan yang berasal dari fallback R3 tidak dihitung sebagai
   keberhasilan skill coverage.
4. Tugas yang memperoleh penanggung jawab karena **pengecualian R4** (tidak ada
   kandidat yang memenuhi R2) tidak dihitung sebagai keberhasilan skill coverage.

## 2.3 Product Completion Goal

MVP dinyatakan mencapai tujuan apabila pengguna dapat:

1. Membuat proyek kelompok.
2. Menambahkan anggota kelompok.
3. Mengisi profil keterampilan anggota.
4. Memuat template 11 tugas atau membuat tugas sendiri.
5. Menjalankan analisis tugas menggunakan Gemini.
6. Menghasilkan rekomendasi pembagian tugas.
7. Memeriksa rincian skor setiap rekomendasi.
8. Mengubah bobot dan melihat hasil secara langsung.
9. Menukar atau mengganti penanggung jawab.
10. Mengunci penugasan.
11. Melihat ringkasan beban setiap anggota.
12. Menggunakan mode cadangan tanpa AI.
13. Mengekspor hasil sebagai CSV dan teks.
14. Melihat penjelasan cara kerja sistem.

---

# 3. TARGET USERS

## 3.1 Primary User: Ketua Kelompok

**Deskripsi:**

Mahasiswa yang bertanggung jawab mengoordinasikan pengerjaan tugas kelompok.

Ketua kelompok menjadi pengguna utama yang mengoperasikan aplikasi.

**Primary needs:**

- Membuat proyek kelompok.
- Menambahkan anggota.
- Mengatur pekerjaan.
- Memahami kemampuan anggota.
- Menghasilkan rekomendasi pembagian tugas.
- Memastikan beban pekerjaan relatif seimbang.
- Mengubah hasil rekomendasi.
- Menetapkan penanggung jawab akhir.

**Pain points:**

- Kesulitan menentukan pembagian pekerjaan yang adil.
- Tidak mengetahui kapasitas aktual setiap anggota.
- Sulit membandingkan kesesuaian keterampilan.
- Kesulitan menjelaskan alasan pembagian tugas.
- Membutuhkan waktu untuk mengevaluasi alternatif pembagian.

**Expected outcome:**

Ketua mendapatkan rekomendasi yang dapat dipahami, diperiksa, dan diubah sebelum ditetapkan.

## 3.2 Secondary User: Anggota Kelompok

**Deskripsi:**

Mahasiswa yang menjadi bagian dari kelompok dan bertanggung jawab mengisi profil kemampuan serta minatnya.

Anggota mengakses proyek menggunakan kode atau tautan proyek.

Tidak diperlukan sistem registrasi dan login akun pada MVP.

**Primary needs:**

- Mengakses proyek kelompok.
- Mengisi nama panggilan.
- Memilih keterampilan.
- Mengisi level kemampuan.
- Mengisi minat.
- Mengisi ketersediaan waktu.
- Memberikan catatan tambahan.
- Melihat alasan rekomendasi pembagian tugas.

**Pain points:**

- Mendapatkan pekerjaan yang tidak sesuai kemampuan.
- Mendapatkan beban terlalu banyak.
- Tidak memahami alasan pemilihan penanggung jawab.
- Tidak memiliki kesempatan menyampaikan kemampuan dan minat secara terstruktur.

**Expected outcome:**

Anggota dapat memberikan informasi yang cukup agar pembagian tugas mempertimbangkan kemampuan, minat, dan kapasitasnya.

## 3.3 Tertiary User: Dosen atau Penguji

**Deskripsi:**

Pihak yang mengevaluasi cara kerja sistem, pendekatan AI, dan hasil rekomendasi.

Dosen atau penguji bukan pengguna operasional utama dan tidak membutuhkan akun khusus pada MVP.

**Primary needs:**

- Memahami pendekatan AI.
- Memeriksa rumus scoring.
- Melihat rincian nilai.
- Memahami aturan pembagian.
- Mengetahui batasan sistem.
- Memeriksa contoh perhitungan.

**Expected outcome:**

Dosen atau penguji dapat memahami mengapa sistem memberikan rekomendasi tertentu dan bagaimana hasil tersebut diperoleh.

---

# 4. USER STORIES

## 4.1 Project Creation

### US-01: Membuat proyek

Sebagai ketua kelompok, saya ingin membuat proyek dengan nama dan tenggat waktu agar pekerjaan kelompok dapat dikelola dalam satu ruang proyek.

Acceptance Criteria:

- Pengguna dapat mengisi nama proyek.
- Pengguna dapat mengisi tenggat proyek.
- Sistem memvalidasi input wajib.
- Sistem menghasilkan kode proyek acak minimal 10 karakter.
- Sistem menghasilkan tautan akses proyek.
- Proyek tersimpan di Supabase.
- Pengguna diarahkan ke tahap pengelolaan anggota.

### US-02: Mengakses proyek

Sebagai anggota kelompok, saya ingin mengakses proyek menggunakan kode atau tautan agar dapat mengisi profil saya.

Acceptance Criteria:

- Sistem menerima kode proyek.
- Sistem memvalidasi keberadaan kode.
- Sistem menerapkan pembatasan laju terhadap percobaan kode.
- Kode proyek tidak boleh ditebak secara mudah.
- Pengguna tidak memerlukan login akun pada MVP.

## 4.2 Member Management

### US-03: Menambahkan anggota

Sebagai ketua kelompok, saya ingin menambahkan anggota ke dalam proyek agar sistem dapat menghitung pembagian pekerjaan.

Acceptance Criteria:

- Minimal 2 anggota agar rekomendasi dapat dijalankan.
- Tidak ada batas maksimal anggota. Jumlah anggota mengikuti berapa banyak orang yang bergabung memakai kode proyek.
- Anggota baru tidak pernah ditolak karena jumlah anggota sudah banyak.
- Validasi dilakukan pada client dan server.
- Setiap anggota tercatat sebagai satu baris tersendiri di dalam proyek.

### US-04: Mengisi profil anggota

Sebagai anggota kelompok, saya ingin mengisi profil kemampuan agar sistem mengetahui keterampilan yang saya miliki.

Acceptance Criteria:

- Mengisi nama panggilan.
- Memilih skill dari taksonomi yang tersedia.
- Mengisi level skill 1 sampai 5.
- Mengisi minat 1 sampai 5.
- Mengisi jam tersedia per minggu.
- Mengisi catatan tambahan secara opsional.
- Sistem memvalidasi seluruh input.
- Batas panjang catatan mengikuti ketentuan PRD.

## 4.3 Task Management

### US-05: Memuat template tugas

Sebagai ketua kelompok, saya ingin memuat 11 tugas template agar tidak perlu membuat seluruh pekerjaan dari awal.

Acceptance Criteria:

- Sistem menyediakan 11 tugas template.
- Pengguna dapat memuat template ke proyek.
- Pengguna dapat mengubah tugas.
- Pengguna dapat menghapus tugas.
- Pengguna dapat menambahkan tugas manual.
- Sumber tugas dibedakan antara template dan manual.

### US-06: Membuat tugas manual

Sebagai ketua kelompok, saya ingin membuat tugas sendiri agar sistem dapat digunakan untuk berbagai jenis pekerjaan kelompok.

Acceptance Criteria:

- Judul tugas wajib diisi.
- Deskripsi tugas wajib diisi.
- Skill wajib berasal dari taksonomi tetap.
- Bobot usaha berada pada rentang 1 sampai 5.
- Tenggat tugas dapat ditentukan.
- Data divalidasi sebelum disimpan.

## 4.4 AI Task Analysis

### US-07: Menganalisis pekerjaan

Sebagai ketua kelompok, saya ingin menggunakan AI untuk menganalisis deskripsi tugas agar sistem dapat menyarankan keterampilan dan bobot usaha yang dibutuhkan.

Acceptance Criteria:

- Sistem mengirim seluruh tugas dalam satu permintaan analisis.
- Gemini memberikan skill wajib dari taksonomi yang telah ditentukan.
- Gemini memberikan bobot usaha 1 sampai 5.
- Output menggunakan JSON terstruktur.
- Output divalidasi menggunakan Zod.
- Pengguna dapat mengubah hasil analisis.
- Hasil yang belum dikonfirmasi tidak langsung digunakan dalam rekomendasi.
- Analisis tidak boleh menambah atau menghapus tugas.

## 4.5 Recommendation

### US-08: Menghasilkan rekomendasi

Sebagai ketua kelompok, saya ingin menghasilkan rekomendasi penanggung jawab untuk setiap tugas agar pembagian pekerjaan memiliki dasar perhitungan.

Acceptance Criteria:

- Sistem menghitung kemiripan konten menggunakan embedding.
- Sistem menghitung kecocokan skill.
- Sistem menghitung kapasitas anggota.
- Sistem menghitung minat anggota.
- Sistem menerapkan hard constraints.
- Sistem menghasilkan penugasan global.
- Setiap tugas mendapatkan satu penanggung jawab.
- Sistem menyediakan satu alternatif jika tersedia kandidat alternatif.

### US-09: Melihat rincian skor

Sebagai ketua kelompok atau anggota, saya ingin melihat rincian skor agar dapat memahami alasan di balik rekomendasi.

Acceptance Criteria:

- Menampilkan nilai K.
- Menampilkan nilai S.
- Menampilkan nilai C.
- Menampilkan nilai M.
- Menampilkan skor akhir.
- Menampilkan satu kalimat alasan.
- Nilai harus berasal dari hasil perhitungan.
- Alasan hanya boleh menggunakan informasi yang tersedia dalam proyek.

## 4.6 Recommendation Adjustment

### US-10: Mengubah bobot rekomendasi

Sebagai ketua kelompok, saya ingin mengubah bobot penilaian agar dapat mengeksplorasi alternatif distribusi tugas.

Acceptance Criteria:

- Tersedia slider untuk komponen penilaian.
- Bobot selalu dinormalisasi agar totalnya 1.
- Hasil dihitung ulang langsung di browser.
- Tidak ada panggilan Gemini.
- Tidak ada permintaan jaringan untuk perhitungan ulang.
- Hasil berubah dalam waktu kurang dari 100 ms.

### US-11: Memindahkan penugasan

Sebagai ketua kelompok, saya ingin memindahkan tugas ke anggota lain agar dapat menyesuaikan rekomendasi dengan kondisi kelompok.

Acceptance Criteria:

- Tugas dapat dipindahkan melalui drag-and-drop atau menu.
- Sistem menampilkan pratinjau perubahan.
- Sistem memperlihatkan perubahan skor.
- Sistem memperlihatkan perubahan beban.
- Pengguna dapat mengonfirmasi atau mengurungkan.
- Perubahan dapat diurungkan satu langkah terakhir.

### US-12: Mengunci penugasan

Sebagai ketua kelompok, saya ingin mengunci tugas agar penanggung jawab yang sudah disepakati tidak berubah ketika rekomendasi dihitung ulang.

Acceptance Criteria:

- Tugas dapat dikunci.
- Status terkunci terlihat pada antarmuka.
- Tugas terkunci tidak berubah saat hitung ulang.
- Tugas dapat dibuka kembali sesuai kebutuhan.

## 4.7 Workload Management

### US-13: Melihat beban anggota

Sebagai ketua kelompok, saya ingin melihat ringkasan beban kerja setiap anggota agar distribusi pekerjaan dapat dievaluasi.

Acceptance Criteria:

- Menampilkan jumlah usaha yang diterima.
- Menampilkan batas beban.
- Menampilkan indikator jika batas terlampaui.
- Perubahan penugasan memperbarui ringkasan beban.
- Beban dihitung dari bobot usaha tugas.

## 4.8 Fallback and Export

### US-14: Menggunakan mode cadangan

Sebagai pengguna, saya ingin tetap memperoleh rekomendasi ketika Gemini gagal agar proses pembagian tugas tidak terhenti.

Acceptance Criteria:

- Mode cadangan aktif ketika Gemini gagal atau batas laju tercapai.
- Komponen K dihilangkan.
- Bobot S, C, M disesuaikan menjadi 0,50, 0,33, dan 0,17.
- Penjelasan menggunakan template.
- Sistem menampilkan status fallback secara jelas.

### US-15: Mengekspor hasil

Sebagai ketua kelompok, saya ingin mengekspor hasil pembagian agar dapat membagikannya kepada anggota.

Acceptance Criteria:

- Mendukung ekspor CSV.
- Mendukung salin teks.
- Data ekspor sesuai hasil penugasan terakhir.
- Menyertakan nama panggilan anggota.
- Menyertakan judul tugas.
- Menyertakan penanggung jawab.
- Tidak menambahkan data yang tidak tersedia.

## 4.9 Explanation and Evaluation

### US-16: Melihat cara kerja sistem

Sebagai dosen atau penguji, saya ingin melihat penjelasan sistem agar dapat memahami metode rekomendasi.

Acceptance Criteria:

- Menjelaskan konsep Simple Recommendation.
- Menjelaskan komponen K, S, C, M.
- Menjelaskan weighted scoring.
- Menjelaskan hard constraints.
- Menjelaskan peran Gemini.
- Menjelaskan mode cadangan.
- Menampilkan contoh perhitungan.

### US-17: Mencatat perubahan keputusan

Sebagai ketua kelompok, saya ingin perubahan rekomendasi dicatat agar keputusan akhir dapat dievaluasi.

Acceptance Criteria:

- Mencatat rekomendasi dibuat.
- Mencatat rekomendasi diterima.
- Mencatat perubahan atau pertukaran tugas.
- Mencatat informasi kejadian yang diperlukan.
- Tidak menyimpan data pribadi di luar nama panggilan.

---

# 5. FUNCTIONAL REQUIREMENTS

## 5.1 Project Management

### FR-01: Project Creation

Sistem wajib menyediakan pembuatan proyek dengan:

- Nama proyek.
- Tenggat proyek.
- Kode proyek acak.
- Tautan akses proyek.

Kode proyek harus memiliki panjang minimal 10 karakter.

### FR-02: Member Limit

Sistem wajib memvalidasi jumlah anggota proyek dengan batas minimal 2 orang.

Jumlah anggota tidak dibatasi maksimal. Anggota bergabung menggunakan kode proyek, dan sistem menerima seluruh anggota yang masuk. Nama anggota tidak wajib unik; dua anggota boleh memakai nama panggilan yang sama.

Validasi wajib dilakukan pada client dan server.

### FR-03: Member Profile

Setiap anggota memiliki:

- Nickname.
- Skills.
- Skill level 1 sampai 5.
- Interest level 1 sampai 5.
- Available hours per week.
- Optional note.

Batas panjang catatan anggota adalah 300 karakter sesuai PRD.

### FR-04: Task Management

Sistem wajib menyediakan:

- Template 11 tugas.
- Tambah tugas.
- Edit tugas.
- Hapus tugas.

Setiap tugas memiliki sumber template atau manual.

### FR-05: Task Attributes

Setiap tugas memiliki:

- Title.
- Description.
- Required skills.
- Effort 1 sampai 5.
- Due date.
- Lock status.
- Source.

Batas panjang deskripsi tugas adalah 500 karakter sesuai PRD.

## 5.2 AI Processing

### FR-06: AI Task Analysis

Sistem wajib menggunakan Gemini untuk menganalisis tugas.

Input:
- Deskripsi tugas.
- Informasi pekerjaan yang diperlukan.

Output:
- Required skills.
- Effort.
- Note.

Aturan:

- Skill hanya boleh berasal dari taksonomi tetap.
- Minimal satu dan maksimal empat skill per tugas.
- Effort harus berupa integer 1 sampai 5.
- Output JSON wajib divalidasi menggunakan Zod.
- Pengguna dapat mengoreksi hasil.
- Semua tugas dianalisis dalam satu permintaan Gemini.

### FR-07: Recommendation Engine

Sistem wajib menghitung skor untuk setiap pasangan tugas dan anggota.

Formula:

Score = (0.40 × K) + (0.30 × S) + (0.20 × C) + (0.10 × M)

Keterangan:

K = Content Similarity.

S = Skill Match.

C = Remaining Capacity.

M = Interest.

Ketentuan:

**K — Content Similarity**

- Menggunakan embedding Gemini.
- Menghitung cosine similarity antara teks tugas dan profil anggota.
- Dinormalisasi menjadi 0 sampai 1.
- Batas normalisasi awal 0,2 sampai 0,8.
- Nilai embedding disimpan dalam cache berdasarkan hash teks.

**S — Skill Match**

Rata-rata level keterampilan yang dibutuhkan dibagi 5.

Skill yang tidak dimiliki atau tidak dinilai mendapatkan nilai 0.

**C — Capacity**

C = 1 - (Current Load + Task Effort) / Load Limit

**M — Interest**

M = (Average Required Skill Interest - 1) / 4

Minat yang tidak diisi menggunakan nilai 3 sesuai PRD.

### Hard Constraints

Sistem wajib menerapkan aturan berikut:

R1:
Anggota dengan jam tersedia 0 dikeluarkan dari kandidat.

R2:
Beban setelah menerima tugas tidak boleh melebihi 1,25 kali beban ideal.

R3:
Jika ada anggota dengan minimal satu skill wajib berlevel 3 atau lebih, hanya anggota tersebut yang menjadi kandidat.

Jika tidak ada, sistem tetap memberikan rekomendasi terbaik dengan peringatan bahwa tidak ada kandidat yang cocok.

R4:
Satu tugas memiliki tepat satu penanggung jawab.

Pengecualian R4:
Jika tidak ada kandidat yang memenuhi R2, tugas boleh tidak memiliki penanggung jawab. Sistem wajib memberikan peringatan dan tidak boleh memaksakan penugasan yang melanggar R2.

R5:
Tugas yang dikunci tidak boleh berubah saat perhitungan ulang.

#### Penjelasan aturan keras (v0.3)

Bagian ini tidak menambah aturan baru. Isinya menegaskan cara membaca R1–R5
beserta keputusan pengguna yang mengikatnya.

**R2 — batas 1,25 kali beban ideal bersifat ketat**

- Angka 1,25 × beban ideal dipertahankan tanpa perubahan.
- Kandidat yang gagal R2 tidak boleh menerima tugas baru.
- Batas ini tidak boleh dilonggarkan, dinaikkan, atau dibuat luwes untuk
  menghindari tugas tanpa penanggung jawab.

**R3 — minimal satu skill wajib pada level 3 atau lebih**

- R3 bersifat *minimal satu skill wajib* berlevel 3 atau lebih, bukan *semua
  skill wajib harus berlevel 3*. Definisi ini tetap seperti v0.2 dan tidak boleh
  diubah.
- Jika tidak ada kandidat yang memenuhi R3, sistem tetap memberikan rekomendasi
  terbaik disertai peringatan bahwa tidak ada kandidat yang cocok.
- Rekomendasi fallback R3 adalah saran terbaik yang tersedia, bukan bukti bahwa
  anggota tersebut memenuhi R3.

**R4 — tepat satu penanggung jawab, dengan pengecualian**

- Aturan umum tetap berlaku: satu tugas memiliki tepat satu penanggung jawab.
- Pengecualian berlaku hanya ketika tidak ada kandidat yang memenuhi R2. Pada
  kondisi tersebut tugas boleh tidak memiliki penanggung jawab.
- Pengecualian ini tidak pernah memperbolehkan satu tugas memiliki lebih dari
  satu penanggung jawab.
- Setiap tugas tanpa penanggung jawab wajib disertai peringatan yang
  menyebutkan alasan tidak adanya kandidat.

**R5 — tugas terkunci tidak berubah**

- Tugas yang dikunci tidak boleh berubah pemiliknya saat perhitungan ulang.
- R5 dipertahankan meskipun pemilik terkunci tersebut telah melampaui batas R2.
  Dalam kondisi itu sistem wajib memberikan peringatan overload, bukan
  memindahkan atau melepas tugas yang terkunci.

#### Konflik antara R2 dan R4 serta prioritas keputusan pengguna

R2 yang ketat dapat bertabrakan dengan R4 yang mewajibkan tepat satu penanggung
jawab. Kondisi ini terjadi ketika semua anggota yang memenuhi R1 dan R3 akan
melampaui batas R2 bila menerima tugas tersebut:

- Jika R2 diikuti, tidak ada anggota yang boleh menerima tugas.
- Jika R4 diikuti secara mutlak, sistem harus menunjuk satu penanggung jawab,
  yang berarti melanggar R2.

v0.3 menetapkan urutan prioritas berikut sebagai keputusan pengguna:

1. **R2 dipertahankan secara ketat.** Sistem tidak boleh memaksakan penugasan
   yang melanggar R2.
2. **Pengecualian R4 berlaku.** Ketika tidak ada kandidat yang memenuhi R2,
   tugas boleh tanpa penanggung jawab.
3. **Peringatan wajib.** Setiap tugas tanpa penanggung jawab wajib memiliki
   peringatan yang menjelaskan bahwa tidak ada kandidat yang memenuhi R2.
4. **R5 tetap berlaku.** Pengecualian R4 tidak pernah membatalkan tugas yang
   sudah dikunci.

Dengan urutan ini, prioritas keputusan pengguna adalah: **R2 lebih tinggi
daripada aturan umum R4**, dan **R5 tetap dipertahankan pada semua kondisi**.
Rekomendasi fallback R3 tetap ditampilkan sebagai saran terbaik, tetapi tidak
dianggap sebagai kandidat yang memenuhi R3 dan tidak membatalkan peringatan.

### Global Assignment

- Tugas dengan usaha terbesar diproses terlebih dahulu.
- Sistem melakukan perbaikan distribusi melalui pertukaran pasangan.
- Hasil harus deterministik.
- Model AI tidak boleh menentukan anggota yang menerima tugas.

### FR-08: Recommendation Matrix

Sistem wajib menampilkan matriks tugas dan anggota.

Setiap tugas menampilkan:

- Rekomendasi utama.
- Satu alternatif jika tersedia.
- Skor masing-masing kandidat.
- Status penugasan.

### FR-09: Score Explanation

Sistem wajib menampilkan:

- Komponen K.
- Komponen S.
- Komponen C.
- Komponen M.
- Skor akhir.
- Satu kalimat alasan.

Penjelasan harus divalidasi berdasarkan nama anggota, skill, dan nilai yang tersedia.

Jika validasi gagal, sistem menggunakan kalimat template.

### FR-10: Weight Adjustment

Sistem wajib menyediakan slider untuk mengubah bobot komponen.

Ketentuan:

- Total bobot harus tetap 1.
- Perhitungan dilakukan di browser.
- Tidak memanggil Gemini.
- Tidak melakukan network request.
- Hasil berubah dalam waktu kurang dari 100 ms.
- Pilihan utama dan ringkasan beban ikut diperbarui.

### FR-11: Assignment Management

Sistem wajib mendukung:

- Accept assignment.
- Swap assignment.
- Manual reassignment.
- Lock assignment.
- Unlock assignment.
- Undo satu langkah terakhir.

### FR-12: Workload Summary

Sistem wajib menampilkan ringkasan beban masing-masing anggota.

Indikator harus menunjukkan apabila anggota melewati batas beban.

### FR-13: Fallback Mode

Sistem wajib menyediakan mode rekomendasi tanpa AI.

Ketentuan:

- Aktif otomatis ketika Gemini gagal atau terkena rate limit.
- K dihilangkan.
- Bobot S menjadi 0,50.
- Bobot C menjadi 0,33.
- Bobot M menjadi 0,17.
- Penjelasan menggunakan template.
- Mode yang digunakan harus terlihat jelas.

### FR-14: Export

Sistem mendukung:

- CSV export.
- Copy-to-text.

PDF export tidak termasuk MVP.

### FR-15: How It Works

Sistem menyediakan halaman yang menjelaskan:

- Formula scoring.
- Hard constraints.
- Cara kerja AI.
- Peran Gemini.
- Cara kerja mode fallback.
- Contoh perhitungan.
- Batasan sistem.

### FR-16: Event Logging

Sistem mencatat kejadian:

- Recommendation created.
- Recommendation accepted.
- Assignment changed.
- Assignment swapped.
- Assignment locked.
- Recommendation fallback.
- Relevant system errors.

Data pribadi selain nama panggilan tidak boleh dimasukkan ke event payload.

### FR-17: Before-and-After Comparison

Opsional untuk MVP.

Sistem dapat menampilkan perbandingan hasil sebelum dan sesudah perubahan bobot atau penugasan.

Implementasikan hanya setelah seluruh kebutuhan wajib dan penting selesai.

### FR-18: What-if Mode

Sistem wajib memungkinkan pengguna memindahkan tugas ke anggota lain dan melihat pratinjau:

- Perubahan skor.
- Perubahan beban.
- Dampak terhadap distribusi.

Perubahan dapat dikonfirmasi atau dibatalkan.

Tidak boleh memanggil Gemini.

### FR-19: Interaction Feedback

Setiap aksi wajib memberikan respons visual yang sesuai.

Contoh:

- Proses analisis menunjukkan status.
- Perhitungan menampilkan progres.
- Penugasan terkunci menunjukkan status terkunci.
- Validasi menampilkan pesan pada field.
- Mode fallback menampilkan banner.
- Perubahan skor memberikan feedback langsung.

### FR-20: Keyboard Navigation

Sistem wajib mendukung:

- Arrow keys untuk memindahkan sel aktif.
- Enter untuk menerima.
- L untuk mengunci.
- Ctrl/Cmd + Z untuk mengurungkan.

Fokus keyboard harus selalu terlihat.

### FR-21: Undo

Sistem wajib dapat mengurungkan satu langkah terakhir untuk:

- Swap.
- Lock.
- Manual assignment.

## 5.3 Functional Boundaries

Semua fitur harus mengikuti ruang lingkup MVP.

Tidak boleh membuat fitur baru hanya karena agent menganggapnya bermanfaat.

Jika suatu fitur tidak tercantum pada FR-01 sampai FR-21, fitur tersebut harus dianggap di luar lingkup kecuali mendapat persetujuan eksplisit.

---

# 6. NON-FUNCTIONAL REQUIREMENTS

## 6.1 Performance

NFR-01:

Perhitungan tanpa AI harus selesai dalam waktu kurang dari 1 detik.

NFR-02:

Slider dan what-if harus dihitung di browser.

NFR-03:

Perubahan hasil akibat slider atau what-if harus terlihat kurang dari 100 ms.

NFR-04:

Satu proses rekomendasi dengan 4 anggota dan 15 tugas harus selesai maksimal 10 detik ketika menggunakan AI.

NFR-05:

Mode fallback harus menghasilkan rekomendasi dalam waktu kurang dari 1 detik.

NFR-06:

Panggilan Gemini maksimal 3 kali per proses.

## 6.2 Reliability

NFR-07:

Kegagalan Gemini tidak boleh menghentikan fungsi utama aplikasi.

NFR-08:

Sistem harus mengaktifkan mode fallback secara otomatis ketika terjadi kegagalan AI atau rate limit.

NFR-09:

Setiap output AI harus divalidasi sebelum digunakan.

NFR-10:

Hasil rekomendasi harus dapat dihitung ulang secara deterministik dengan input dan embedding yang sama.

## 6.3 Security

NFR-11:

API key Gemini hanya boleh tersedia di server.

NFR-12:

SUPABASE_SECRET_KEY tidak boleh diekspos ke client.

NFR-13:

Seluruh tabel Supabase wajib mengaktifkan RLS.

NFR-14:

Tidak boleh ada kebijakan akses anon yang membuka tabel database.

NFR-15:

Seluruh input harus divalidasi menggunakan Zod.

NFR-16:

Kode proyek harus memiliki minimal 10 karakter acak.

NFR-17:

Percobaan menebak kode proyek harus dibatasi menggunakan rate limiting.

NFR-18:

Teks pengguna diperlakukan sebagai data, bukan instruksi untuk model.

NFR-19:

Keluaran model wajib divalidasi terhadap skema yang telah ditentukan.

NFR-20:

Setelah build, periksa output client untuk memastikan tidak terdapat sb_secret_ atau service_role.

## 6.4 Privacy

NFR-21:

Data yang dikirim ke Gemini hanya meliputi:

- Nama panggilan.
- Data keterampilan.
- Catatan anggota yang diizinkan.
- Teks tugas.

NFR-22:

Formulir harus memberikan pemberitahuan mengenai penggunaan data oleh Google AI Studio.

NFR-23:

Pengguna tidak boleh memasukkan informasi pribadi yang tidak diperlukan.

NFR-24:

Proyek harus dapat dihapus pengguna.

NFR-25:

MVP tidak menggunakan third-party tracking.

## 6.5 Accessibility

NFR-26:

Kontras warna harus memenuhi target WCAG AA.

NFR-27:

Seluruh aksi penting dapat dilakukan menggunakan keyboard.

NFR-28:

Fokus keyboard harus terlihat.

NFR-29:

Tabel harus menggunakan struktur header semantik.

NFR-30:

Setiap input harus memiliki label yang jelas.

## 6.6 Responsive Design

NFR-31:

Antarmuka harus mendukung:

- Mobile.
- Tablet.
- Laptop.

NFR-32:

Breakpoints ditentukan berdasarkan titik ketika konten mulai rusak, bukan hanya berdasarkan ukuran perangkat populer.

NFR-33:

Matriks rekomendasi harus tetap dapat digunakan pada layar kecil.

## 6.7 Maintainability

NFR-34:

TypeScript strict mode wajib aktif.

NFR-35:

Mesin scoring harus menggunakan fungsi TypeScript murni.

NFR-36:

Business logic harus dipisahkan dari UI.

NFR-37:

ESLint dan Prettier wajib digunakan.

NFR-38:

Seluruh fungsi scoring wajib memiliki unit test.

NFR-39:

Komentar kode hanya digunakan untuk menjelaskan alasan, bukan mengulang isi kode.

NFR-40:

Perubahan kode harus dapat ditelusuri ke ID functional requirement.

## 6.8 Observability

NFR-41:

Sistem harus mencatat error yang relevan.

NFR-42:

Sistem harus mencatat durasi setiap tahap proses.

NFR-43:

Sistem harus mencatat jumlah panggilan Gemini.

NFR-44:

Sistem harus mencatat token input dan output.

NFR-45:

Informasi pemakaian AI disimpan dalam entitas AiRun.

## 6.9 Motion and Interaction

NFR-46:

Animasi hanya menggunakan transform dan opacity, dengan pengecualian perubahan visual yang diperlukan sesuai token gerak PRD.

NFR-47:

Sistem harus menghormati prefers-reduced-motion.

NFR-48:

Animasi tidak boleh menghambat interaksi pengguna.

NFR-49:

Animasi berulang hanya diperbolehkan selama proses AI sedang berjalan.

NFR-50:

Tidak boleh menggunakan animasi dekoratif yang tidak memiliki fungsi.

---

# 7. SCOPE

## 7.1 MVP Scope

MVP hanya berfokus pada proses pembagian tugas kelompok menggunakan rekomendasi berbasis data.

### A. Project Management

Termasuk:

- Membuat proyek.
- Mengisi nama proyek.
- Menentukan tenggat.
- Menghasilkan kode proyek.
- Menghasilkan tautan akses.

Tidak termasuk:

- Sistem organisasi.
- Multi-role permission system.
- Manajemen institusi.
- Dashboard administrasi.

### B. Member Management

Termasuk:

- Menambahkan anggota.
- Minimal 2 anggota tanpa batas maksimal.
- Profil skill.
- Level kemampuan.
- Minat.
- Jam tersedia.
- Catatan tambahan.

Tidak termasuk:

- Registrasi akun.
- Login Google.
- Login GitHub.
- Sistem autentikasi kompleks.
- Profil mahasiswa institusional.

### C. Task Management

Termasuk:

- Template 11 tugas.
- Tugas manual.
- Edit tugas.
- Hapus tugas.
- Skill wajib.
- Bobot usaha.
- Tenggat tugas.

Tidak termasuk:

- Kanban board.
- Task dependency.
- Automatic scheduling.
- Subtask management.
- Time tracking.

### D. AI Task Analysis

Termasuk:

- Analisis deskripsi tugas.
- Rekomendasi skill wajib.
- Rekomendasi effort.
- Validasi JSON.
- Koreksi manual.

Tidak termasuk:

- AI agent otonom.
- AI yang menentukan seluruh pembagian tanpa perhitungan.
- Model training.
- Chatbot umum.
- Generative task management.

### E. Recommendation Engine

Termasuk:

- Embedding Gemini.
- Cosine similarity.
- Weighted scoring.
- Hard constraints.
- Global assignment.
- Alternatif rekomendasi.
- Score explanation.
- Deterministic calculation.

Tidak termasuk:

- Reinforcement learning.
- Training model sendiri.
- Prediksi produktivitas.
- Prediksi karakter anggota.
- Penilaian psikologis.
- Rekomendasi berdasarkan data historis kelompok lain.

### F. Assignment Interaction

Termasuk:

- Slider bobot.
- What-if mode.
- Manual reassignment.
- Swap.
- Lock.
- Undo.
- Workload summary.

Tidak termasuk:

- Kanban.
- Real-time collaborative editing.
- Chat.
- Notifikasi.
- Kalender.
- Monitoring aktivitas anggota.

### G. Fallback and Export

Termasuk:

- Automatic fallback.
- Fallback explanation.
- CSV export.
- Copy-to-text.

Tidak termasuk:

- PDF export.
- Excel workbook.
- Integrasi Google Drive.
- Integrasi WhatsApp.
- Email notification.

### H. Explanation and Evaluation

Termasuk:

- Halaman How It Works.
- Penjelasan formula.
- Penjelasan aturan.
- Contoh perhitungan.
- Event logging.
- Data untuk evaluasi.

Tidak termasuk:

- Dashboard analitik lanjutan.
- Laporan otomatis berbentuk PDF.
- Sistem penilaian anggota.
- Ranking produktivitas mahasiswa.

## 7.2 Out of Scope

Fitur berikut secara eksplisit tidak boleh dibuat pada MVP:

1. Kanban board.
2. Chat kelompok.
3. Notifikasi.
4. Integrasi kalender.
5. Integrasi WhatsApp.
6. Integrasi Google Drive.
7. Login dan registrasi akun.
8. Multi-level role permissions.
9. Aplikasi mobile native.
10. Multibahasa.
11. Automatic scheduling.
12. Task dependencies.
13. Model training dari riwayat.
14. AI chatbot umum.
15. Dashboard analitik lanjutan.
16. Sistem absensi.
17. Sistem penilaian kinerja anggota.
18. Integrasi sistem akademik universitas.

Jika agent menemukan kebutuhan untuk membuat salah satu fitur di atas, agent harus berhenti dan meminta persetujuan.

## 7.3 Scope Prioritization

### Must Have

Semua kebutuhan berikut harus selesai sebelum MVP dinyatakan siap:

- Project creation.
- Member management.
- Task management.
- AI task analysis.
- Recommendation engine.
- Score explanation.
- Workload summary.
- Slider weight adjustment.
- Manual assignment.
- What-if mode.
- Lock assignment.
- Fallback mode.
- How It Works.
- Core event logging.
- Keyboard interaction.
- Undo.

### Should Have

Dikerjakan setelah kebutuhan Must Have:

- CSV export.
- Copy-to-text.
- Before-and-after comparison (FR-17).
- Pengayaan evaluasi dan pengujian alur utama.

### Won't Have in MVP

Seluruh fitur yang disebutkan pada bagian Out of Scope.

## 7.4 MVP User Journey

Alur utama aplikasi harus sesederhana berikut:

1. Ketua membuka aplikasi.
2. Ketua membuat proyek dengan nama dan tenggat.
3. Sistem menghasilkan kode proyek.
4. Ketua membagikan tautan proyek kepada anggota.
5. Anggota mengisi profil skill, minat, dan ketersediaan.
6. Ketua memastikan anggota sudah lengkap.
7. Ketua memuat template 11 tugas atau membuat tugas manual.
8. Ketua menjalankan analisis tugas menggunakan Gemini.
9. Ketua memeriksa dan mengoreksi hasil analisis.
10. Ketua menjalankan rekomendasi.
11. Sistem menghasilkan matriks rekomendasi.
12. Pengguna memeriksa rincian skor dan alasan.
13. Ketua mengubah bobot atau menjalankan what-if jika diperlukan.
14. Ketua menerima, menukar, mengunci, atau mengganti penugasan.
15. Sistem memperbarui ringkasan beban.
16. Ketua mengekspor hasil pembagian tugas.

## 7.5 Scope Guardrails for AI Coding Agents

Agent wajib mengikuti aturan berikut selama pengembangan:

1. PRD ini menjadi sumber utama kebutuhan produk.
2. Jangan menambahkan fitur yang tidak tercantum dalam dokumen.
3. Jangan mengubah teknologi utama.
4. Jangan memperluas MVP menjadi project management platform.
5. Jangan membuat sistem login karena MVP menggunakan akses kode atau tautan.
6. Jangan membuat fitur yang tidak memiliki functional requirement.
7. Jangan membuat data statistik palsu.
8. Jangan mengarang hasil rekomendasi.
9. Jangan mengubah formula scoring tanpa persetujuan.
10. Jangan mengubah hard constraints tanpa persetujuan.
11. Jangan memanggil Gemini untuk proses yang seharusnya dihitung secara lokal.
12. Jangan mengimplementasikan seluruh fitur dalam satu pekerjaan.

### Development Rules

- Satu sesi pengerjaan fokus pada satu tugas kecil.
- Satu implementasi fitur mengacu pada satu FR atau kelompok FR yang saling terkait.
- Sebelum coding, identifikasi FR terkait.
- Tentukan file yang boleh diubah.
- Tentukan acceptance criteria.
- Implementasikan hanya kebutuhan tersebut.
- Jalankan pengujian.
- Dokumentasikan hasil.

Jika suatu pekerjaan membutuhkan perubahan di luar scope, jelaskan alasan dan minta persetujuan terlebih dahulu.

## 7.6 Definition of MVP Complete

MVP dianggap selesai ketika:

- Pengguna dapat membuat proyek.
- Proyek mendukung minimal 2 anggota tanpa batas maksimal.
- Anggota dapat mengisi profil.
- Pengguna dapat memuat 11 tugas template.
- Pengguna dapat membuat tugas manual.
- Gemini dapat menganalisis tugas.
- Sistem menghasilkan rekomendasi.
- Setiap rekomendasi memiliki rincian skor K, S, C, M.
- Formula Bagian 8.4 menghasilkan angka yang sama persis pada unit test.
- Aturan R1 sampai R5 berfungsi.
- Slider menghitung ulang hasil tanpa network request.
- What-if berjalan.
- Penugasan dapat dikunci dan diurungkan.
- Ringkasan beban diperbarui.
- Mode fallback bekerja.
- Ekspor CSV dan teks tersedia.
- Halaman How It Works tersedia.
- Logging AiRun tersedia.
- Maksimal tiga panggilan Gemini per proses.
- Aksesibilitas dan responsivitas diperiksa.
- Seluruh pemeriksaan keamanan terpenuhi.
- Tidak ada fitur di luar scope MVP.

## 7.7 Kasus Pengujian D2 (v0.3)

Subbagian ini adalah penambahan baru pada v0.3. v0.2 tidak memiliki bagian kasus
pengujian. Seluruh skenario di bawah menjadi acuan pengujian dataset D2 dan
dikelompokkan berdasarkan aturan keras yang diuji.

**Sumber data.** Dua puluh skenario pertama (S01–S20) adalah skenario yang sudah
ada pada dataset D2 di repositori. Skenario tersebut **tidak dihapus dan tidak
diganti**. Empat kasus berikutnya (S21–S24) adalah penambahan v0.3 yang menguji
keputusan pengguna pada bagian Hard Constraints.

### 7.7.1 Skenario dataset D2 yang sudah ada (S01–S20)

| ID | Judul | Condition tag | Ekspektasi D2 |
|---|---|---|---|
| S01 | Skill merata | skill merata | Tidak ada pelanggaran; beban tersebar. |
| S02 | Satu anggota sangat kuat | satu anggota sangat tinggi | Bergantung pada satu anggota; risiko R2 terlampaui. |
| S03 | Anggota kapasitas rendah | kapasitas rendah | Anggota berkapasitas 6 jam tidak menerima tugas 10 jam. |
| S04 | Anggota kapasitas tinggi | kapasitas tinggi | Batas R2, bukan kapasitas, yang membatasi. |
| S05 | Minat berbeda | minat berbeda | Minat tinggi unggul pada komponen M. |
| S06 | Skill tidak cocok tugas | skill tidak cocok | R3 tidak menemukan kandidat; rekomendasi terbaik + peringatan. |
| S07 | Semua anggota di bawah level 3 | semua di bawah level 3 | Tidak ada kandidat R3; peringatan R3 wajib muncul. |
| S08 | Tidak ada kandidat yang memenuhi R2 | tidak ada kandidat R2 | Semua kandidat gagal R2; lihat penegasan v0.3 pada §7.7.2. |
| S09 | Anggota jam tersedia nol | jam tersedia nol | R1 mengeluarkan anggota berkapasitas 0. |
| S10 | Tugas usaha tinggi | tugas usaha tinggi | Tugas 30 jam melebihi kapasitas satu anggota. |
| S11 | Skill wajib beragam | skill wajib beragam | R3 lolos dengan minimal satu skill level ≥3; skor menentukan pemenang. |
| S12 | Beberapa tugas bersaing untuk anggota yang sama | tugas bersaing | Persaingan satu anggota; risiko R2 terlampaui. |
| S13 | Tugas terkunci | tugas terkunci | R5: pemilik terkunci tidak berubah. |
| S14 | Beban awal tidak seimbang | beban awal tak seimbang | Beban awal menghalangi tambahan; R5 tetap. |
| S15 | Skill & minat tinggi, kapasitas rendah | skill+minat tinggi, kapasitas rendah | Profil terbaik gagal R2 karena kapasitas. |
| S16 | Kombinasi: kapasitas rendah + multi-skill | kapasitas rendah; skill wajib beragam | Ideal kecil; batas R2 menjadi penentu. |
| S17 | Kombinasi: kapasitas rendah + minat berbeda | kapasitas rendah; minat berbeda | Minat vs kapasitas; ideal kecil. |
| S18 | Kombinasi: satu sangat kuat + tugas bersaing | satu anggota sangat tinggi; tugas bersaing | Tugas kedua melampaui batas R2. |
| S19 | Kombinasi: jam nol + skill tidak cocok | jam tersedia nol; skill tidak cocok | R1 mengeluarkan kandidat berkualitas; sisanya di bawah level 3. |
| S20 | Kombinasi: merata + beban awal tak seimbang | skill merata; beban awal tak seimbang | R5 menjaga tugas terkunci; R2 mencegah tambahan pada anggota yang sudah penuh. |

### 7.7.2 Kasus pengujian tambahan untuk keputusan v0.3 (S21–S24)

Keempat kasus berikut menguji keputusan pengguna yang dicatat pada Hard
Constraints. Kolom "Hasil yang diharapkan" adalah acuan penerimaan.

| ID | Kasus | Kondisi | Hasil yang diharapkan |
|---|---|---|---|
| S21 | Semua anggota gagal R2 | Setiap anggota yang memenuhi R1 dan R3 akan melampaui 1,25 × beban ideal bila menerima tugas. | Tidak ada penanggung jawab yang melanggar R2. Tugas tanpa penanggung jawab dan peringatan R2 muncul. Kandidat yang gagal R2 tidak menerima tugas. |
| S22 | Tidak ada anggota memenuhi R3 | Tidak ada anggota dengan skill wajib pada level 3 atau lebih. | Sistem tetap memberikan rekomendasi terbaik disertai peringatan bahwa tidak ada kandidat R3. Rekomendasi tersebut tidak dianggap sebagai kandidat yang memenuhi R3. Definisi R3 tidak diubah menjadi "semua skill wajib". |
| S23 | Tugas terkunci menyebabkan overload | Tugas terkunci menempatkan pemiliknya di atas 1,25 × beban ideal. | R5 dipertahankan: pemilik terkunci tidak berubah saat perhitungan ulang. Peringatan overload muncul. Tidak ada penugasan baru yang menambah beban pemilik terkunci. |
| S24 | Tidak ada kandidat R2 sehingga pengecualian R4 berlaku | Tidak ada kandidat yang memenuhi R2, dan tidak ada penanggung jawab yang sah. | Pengecualian R4 berlaku: tugas boleh tanpa penanggung jawab, disertai peringatan. Sistem tidak memaksakan penugasan yang melanggar R2. Aturan umum R4 (tepat satu penanggung jawab) tetap tercatat pada dokumen. |

**Catatan penegasan untuk S08.** Dataset D2 mencatat bahwa pada kondisi ini
mesin lama tetap menugaskan meskipun R2 gagal. v0.3 menetapkan perilaku yang
berbeda dan mengikat: bila tidak ada kandidat yang memenuhi R2, tugas **tidak
memperoleh penanggung jawab** dan wajib memiliki peringatan. Perubahan perilaku
ini berasal dari keputusan pengguna mengenai R4 dan bukan perubahan lain.

### 7.7.3 Keterlacakan kasus pengujian ke keputusan pengguna

| Kasus | Aturan yang diuji | Keputusan pengguna |
|---|---|---|
| S21 | R2 | R2 dipertahankan secara ketat; kandidat gagal R2 tidak menerima tugas baru. |
| S22 | R3 | R3 tetap minimal satu skill wajib level ≥3; rekomendasi terbaik + peringatan. |
| S23 | R5, R2 | R5 tetap mempertahankan tugas terkunci. |
| S24 | R4, R2 | Pengecualian R4 ketika tidak ada kandidat R2; peringatan wajib. |

---

## 7.8 Changelog v0.2 → v0.3

Ringkasan perubahan yang membedakan v0.3 dari v0.2. Setiap baris dapat
ditelusuri ke keputusan pengguna pada Hard Constraints.

| Lokasi di v0.2 | Perubahan di v0.3 | Jenis | Keputusan pengguna |
|---|---|---|---|
| Header dokumen | Versi menjadi 0.3, tanggal 24 November 2026, dan catatan bahwa seluruh isi v0.2 dipertahankan kecuali yang ditandai. | Metadata | — |
| Bagian 5.2, FR-07 Hard Constraints | Ditambahkan **Pengecualian R4**: bila tidak ada kandidat yang memenuhi R2, tugas boleh tanpa penanggung jawab, wajib berperingatan, dan sistem tidak boleh memaksakan penugasan yang melanggar R2. | Aturan baru (pengecualian) | R4 dan R2 |
| Bagian 5.2, FR-07 Hard Constraints | Ditambahkan penjelasan R2, R3, R4, dan R5 sebagai penegasan; teks R1–R5 asli dipertahankan. | Klarifikasi, tanpa aturan baru | R2, R3, R4, R5 |
| Bagian 5.2, FR-07 Hard Constraints | Ditambahkan penjelasan konflik R2 dan R4 beserta urutan prioritas keputusan pengguna (R2 lebih tinggi daripada aturan umum R4; R5 tetap). | Klarifikasi | R2, R4, R5 |
| Bagian 2.2 Success Metrics | Target Skill coverage **tetap 100%**. Ditambahkan definisi operasional "kandidat sesuai" dari R1+R2+R3, rumus pengukuran, dan empat ketentuan pengukuran. | Klarifikasi metrik | Metrik skill coverage |
| Bagian 7.7 | Ditambahkan kasus pengujian D2: 20 skenario yang sudah ada (S01–S20) dan 4 kasus tambahan (S21–S24). | Bagian baru | Kasus pengujian |

**Ketentuan yang tidak berubah dari v0.2:**

- Formula skor: Score = (0,40 × K) + (0,30 × S) + (0,20 × C) + (0,10 × M).
- Bobot komponen K, S, C, M dan bobot mode fallback.
- Batas normalisasi awal 0,2 sampai 0,8.
- Batas R2 sebesar 1,25 × beban ideal.
- Definisi R3 sebagai minimal satu skill wajib level 3 atau lebih.
- Rumus perhitungan komponen K, S, C, dan M.
- Model data, teknologi utama, dan ruang lingkup produk.
- Seluruh functional requirement, non-functional requirement, dan user story lain.

**Pengujian yang menyesuaikan (bukan bagian PRD):** perilaku yang dicatat pada
dataset D2 untuk S08 (mesin tetap menugaskan meski R2 gagal) tidak lagi sesuai
dengan v0.3 dan perlu disesuaikan saat pengujian diimplementasikan.

---

## 7.9 Daftar ASUMSI v0.3

Poin berikut adalah keputusan yang **belum diputuskan pengguna**. Isinya tidak
diisi sendiri oleh dokumen ini dan ditandai sebagai ASUMSI.

- **ASUMSI-A1 — Label penomoran subbagian D2.** Subbagian baru diberi nomor
  **7.7** (di dalam Bagian 7 SCOPE) agar penomoran tetap konsisten dengan v0.2
  yang hanya memiliki Bagian 1–7. Bila pengguna menghendaki lokasi lain, nomor
  subbagian ini perlu disesuaikan.
- **ASUMSI-A2 — Skema ID empat kasus baru.** Empat kasus baru diberi ID
  **S21–S24** dengan melanjutkan namespace S01–S20. Bila pengguna menghendaki
  namespace terpisah, penamaan perlu disesuaikan.
- **ASUMSI-A3 — Rumusan akhir predikat "kandidat sesuai".** Definisi disusun
  langsung dari teks R1, R2, dan R3 v0.2. Bila pengguna menghendaki rumusan
  formal yang berbeda, definisi ini perlu ditinjau.
- **ASUMSI-A4 — Kode peringatan.** Dokumen tidak menetapkan nama kode
  peringatan (misalnya kode untuk kondisi tanpa kandidat R2 atau overload tugas
  terkunci). Penamaan teknis kode peringatan belum diputuskan di tingkat PRD.

---

# END OF PRODUCT REQUIREMENTS DOCUMENT

**Document Status:** MVP Requirements Baseline  
**Source of Truth:** PRD v0.3, 24 November 2026  
**Change Policy:** Setiap perubahan scope atau keputusan arsitektur harus disetujui sebelum implementasi.