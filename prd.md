# PRODUCT REQUIREMENTS DOCUMENT (PRD)

# AI GROUP TASK DISTRIBUTOR
## Pembagi Tugas Kelompok Berbasis Rekomendasi AI

**Document Version:** 0.2  
**Date:** 13 November 2026  
**Product Type:** Web Application  
**Development Stage:** Minimum Viable Product (MVP)  
**Primary Language:** Bahasa Indonesia  
**AI Approach:** Hybrid Simple Recommendation  
**Primary Stack:** Next.js, TypeScript, Tailwind CSS, Supabase, Gemini API

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

Sistem harus mampu memberikan rekomendasi penanggung jawab untuk setiap pekerjaan berdasarkan data 2 sampai 4 anggota.

Target:
- Mendukung minimal 2 anggota.
- Mendukung maksimal 4 anggota.
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

## 2.3 Product Completion Goal

MVP dinyatakan mencapai tujuan apabila pengguna dapat:

1. Membuat proyek kelompok.
2. Menambahkan 2 sampai 4 anggota.
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

Sebagai ketua kelompok, saya ingin memiliki 2 sampai 4 anggota dalam proyek agar sistem dapat menghitung pembagian pekerjaan.

Acceptance Criteria:

- Minimal 2 anggota.
- Maksimal 4 anggota.
- Anggota kelima harus ditolak.
- Validasi dilakukan pada client dan server.
- Setiap anggota memiliki identitas dalam proyek.

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

Sistem wajib membatasi jumlah anggota proyek menjadi 2 sampai 4 orang.

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

R5:
Tugas yang dikunci tidak boleh berubah saat perhitungan ulang.

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
- Batas 2 sampai 4 anggota.
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
- Proyek mendukung 2 sampai 4 anggota.
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

---

# END OF PRODUCT REQUIREMENTS DOCUMENT

**Document Status:** MVP Requirements Baseline  
**Source of Truth:** PRD v0.2, 13 November 2026  
**Change Policy:** Setiap perubahan scope atau keputusan arsitektur harus disetujui sebelum implementasi.