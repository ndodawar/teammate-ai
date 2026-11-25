# LAPORAN TUGAS BESAR AI CONCEPTS

## Pembagi Tugas Kelompok Berbasis Rekomendasi AI

> **Berkas ini adalah draf laporan final BAB I sampai BAB III yang disusun dari bukti
> repository.** Setiap angka dapat ditelusuri ke artefak di `eval/results/` atau ke laporan
> audit di `eval/reports/`. Setiap klaim yang belum terbukti diberi penanda
> `[TIDAK DITEMUKAN]` atau `[PERLU KONFIRMASI]`.
>
> Berkas ini **bukan** dokumen siap cetak. Bagian yang tidak dapat diisi dari bukti
> repository ditandai eksplisit pada Halaman Judul dan Daftar Blocker.

**Sumber acuan utama**

| Acuan | Lokasi | Keterangan |
|---|---|---|
| PRD v0.3 | `docs/PRD_v0.3.md` | Versi yang dipakai untuk isi laporan dan rumus |
| PRD v0.2 | `PRD_Pembagi_Tugas_Kelompok_AI_v0.2.pdf` | Ketentuan format laporan (Bagian 14) |
| Status pekerjaan | `docs/STATUS.md` | Riwayat keputusan dan status fase |
| Referensi lama | `docs/laporan/01_REFERENSI.md` | R1 sampai R15 |
| Verifikasi referensi lama | `docs/laporan/01_VERIFIKASI_REFERENSI.md` | Matriks verifikasi R1 sampai R15 |
| Referensi tambahan | `docs/laporan/02_REFERENSI_TAMBAHAN.md` | T1 sampai T6 |

### Catatan perbedaan PRD v0.2 dan v0.3

Kedua versi **tidak disamakan**. Perbedaan yang memengaruhi laporan ini dicatat terbuka:

| Aspek | PRD v0.2 | PRD v0.3 | Yang dipakai di laporan |
|---|---|---|---|
| Versi dan tanggal | Draf 0.2, 13 November 2026 | 0.3, 24 November 2026 | v0.3 untuk isi teknis |
| Aturan R3 | Tidak menyebut kasus "tidak ada anggota yang memenuhi level 3" secara eksplisit | Menambahkan perilaku cadangan beserta peringatan | v0.3, karena sesuai implementasi `hasQualifiedMember` |
| Aturan R4 | Satu tugas satu penanggung jawab | Ditambah pengecualian eksplisit: bila tidak ada kandidat R2, tugas boleh tanpa pemilik dengan peringatan | v0.3, karena sesuai implementasi `primaryMemberId = ''` |
| Kasus D2 | Belum merinci kasus batas | Menambahkan Bagian 7.7 berisi kasus batas (termasuk "tidak ada kandidat R2", "tugas terkunci") | v0.3 |
| Format laporan | Bagian 14: A4, Times New Roman 12 pt, spasi 1,5, margin 4/3/4/3 cm, judul bab Heading 1, minimal 10 artikel | Kebijakan format tidak diubah | v0.2 Bagian 14 (satu-satunya sumber ketentuan format) |

**Catatan penting:** berkas `prd.md` di akar repository adalah versi v0.2 yang lebih ringkas
(37.969 bita) dan **berbeda** dari PDF v0.2 resmi yang memiliki 17 bagian. PDF v0.2 resmi
adalah acuan format. `prd.md` tidak diubah dan tidak dipakai sebagai acuan format.

---

# HALAMAN JUDUL

> Halaman ini dibiarkan bertanda karena identitas belum tersedia di repository.

**LAPORAN TUGAS BESAR**

**MATA KULIAH AI CONCEPTS**

**PEMBAGI TUGAS KELOMPOK BERBASIS REKOMENDASI AI**

Disusun oleh:

| Nama | NIM | Kontribusi |
|---|---|---|
| `[TIDAK DITEMUKAN]` | `[TIDAK DITEMUKAN]` | `[TIDAK DITEMUKAN]` |
| `[TIDAK DITEMUKAN]` | `[TIDAK DITEMUKAN]` | `[TIDAK DITEMUKAN]` |
| `[TIDAK DITEMUKAN]` | `[TIDAK DITEMUKAN]` | `[TIDAK DITEMUKAN]` |
| `[TIDAK DITEMUKAN]` | `[TIDAK DITEMUKAN]` | `[TIDAK DITEMUKAN]` |

Program Studi: `[TIDAK DITEMUKAN]`

Fakultas: `[TIDAK DITEMUKAN]`

Universitas: `[TIDAK DITEMUKAN]`

Dosen Pengampu: `[TIDAK DITEMUKAN]`

Tahun Akademik: `[TIDAK DITEMUKAN]`

> **PERLU KONFIRMASI.** Tidak ada berkas di repository yang memuat nama anggota, NIM, program
> studi, universitas, dosen, atau tahun akademik. Identitas tidak dikarang. Empat baris nama
> disediakan karena PRD §14 menyebut batas kelompok maksimal 4 orang (FR-02), bukan karena
> jumlah anggota diketahui.

---

# KATA PENGANTAR

> `[PERLU KONFIRMASI]` Apakah format tugas mewajibkan kata pengantar. Repository tidak memuat
> pedoman tugas dosen, sehingga kewajiban bagian ini belum dapat dipastikan. Teks di bawah
> disediakan sebagai draf bila memang diwajibkan.

Puji syukur penulis panjatkan ke hadirat Tuhan Yang Maha Esa atas selesainya laporan tugas
besar mata kuliah AI Concepts dengan judul "Pembagi Tugas Kelompok Berbasis Rekomendasi AI".

Laporan ini menyajikan perancangan, implementasi, dan evaluasi sebuah aplikasi web yang
membantu kelompok mahasiswa membagi tugas berdasarkan kecocokan keterampilan, kapasitas, minat,
dan kemiripan semantik antara deskripsi tugas dan profil anggota. Pendekatan yang dipakai
adalah rekomendasi hybrid sederhana: model bahasa dipakai untuk memahami teks, sedangkan
keputusan akhir diambil oleh aturan dan skor berbobot yang deterministik sehingga hasilnya
dapat dihitung ulang.

Penulis menyadari laporan ini memiliki keterbatasan. Evaluasi dilakukan pada data sintetis,
bukan data lapangan. Pengujian kesepakatan penilai manusia belum dapat dilaksanakan. Kedua hal
tersebut dinyatakan terbuka pada Bab II dan Bab III, bukan disembunyikan.

Penulis mengucapkan terima kasih kepada dosen pengampu dan pihak-pihak yang telah memberikan
masukan. Kritik dan saran yang membangun sangat diharapkan.

`[TIDAK DITEMUKAN]`, `[TIDAK DITEMUKAN]`

Penulis

---

# DAFTAR ISI

> Nomor halaman `[TIDAK DITEMUKAN]` karena laporan belum diekspor ke `.docx` atau PDF. Daftar
> di bawah adalah struktur aktual dokumen ini.

| Bagian | Judul |
|---|---|
| | HALAMAN JUDUL |
| | KATA PENGANTAR |
| | DAFTAR ISI |
| | DAFTAR TABEL |
| | DAFTAR GAMBAR |
| **BAB I** | **PENDAHULUAN** |
| 1.1 | Latar Belakang |
| 1.2 | Rumusan Masalah |
| 1.3 | Tujuan |
| 1.4 | Manfaat dan Batasan Penelitian |
| **BAB II** | **PEMBAHASAN** |
| 2.1 | Dasar Teori |
| 2.2 | Konsep AI yang Digunakan |
| 2.3 | Desain Sistem dan Arsitektur |
| 2.4 | Dataset |
| 2.5 | Implementasi Teknis |
| 2.6 | Pengujian dan Evaluasi |
| **BAB III** | **PENUTUP** |
| 3.1 | Kesimpulan |
| 3.2 | Saran Pengembangan |
| | DAFTAR PUSTAKA |

---

# DAFTAR TABEL

| Nomor | Judul Tabel |
|---|---|
| Tabel 2.1 | Perbandingan pendekatan sistem rekomendasi dan posisi proyek |
| Tabel 2.2 | Bobot default dan bobot mode cadangan |
| Tabel 2.3 | Aturan keras R1 sampai R5 |
| Tabel 2.4 | Pemetaan konsep AI ke tahap sistem |
| Tabel 2.5 | Komponen arsitektur dan tanggung jawabnya |
| Tabel 2.6 | Rute API dan fungsinya |
| Tabel 2.7 | Ringkasan dataset D1 dan D2 |
| Tabel 2.8 | Distribusi kondisi D2 |
| Tabel 2.9 | Variabel rumus skor dan rentang nilainya |
| Tabel 2.10 | Kasus uji aturan keras dan hasilnya |
| Tabel 2.11 | Hasil empat metode pembanding |
| Tabel 2.12 | Peringkat per metrik tanpa menyimpulkan pemenang tunggal |
| Tabel 2.13 | Hasil ablation study |
| Tabel 2.14 | Waktu komputasi pipeline dan komponen interaktif |
| Tabel 2.15 | Hasil pengujian unit dan integrasi |
| Tabel 2.16 | Status target PRD dan pencapaiannya |
| Tabel 2.17 | Ancaman validitas dan mitigasinya |
| Tabel 3.1 | Rumusan masalah dan jawabannya |

---

# DAFTAR GAMBAR

| Nomor | Judul Gambar | Status |
|---|---|---|
| Gambar 2.1 | Arsitektur aplikasi dan alur data | `[GAMBAR PERLU DITAMBAHKAN]` |
| Gambar 2.2 | Diagram alur perhitungan skor dan penugasan global | `[GAMBAR PERLU DITAMBAHKAN]` |
| Gambar 2.3 | Skema basis data sembilan tabel | `[GAMBAR PERLU DITAMBAHKAN]` |
| Gambar 2.4 | Tangkapan layar matriks skor dan rincian perhitungan | `[GAMBAR PERLU DITAMBAHKAN]` |
| Gambar 2.5 | Tangkapan layar mode cadangan saat AI dimatikan | `[GAMBAR PERLU DITAMBAHKAN]` |

> Tidak ada berkas gambar, tangkapan layar, atau diagram di repository. Tidak satu pun gambar
> dibuat atau disimulasikan. Deskripsi kebutuhan setiap gambar dijelaskan pada Bab II.

---

# BAB I PENDAHULUAN

## 1.1 Latar Belakang

Pengerjaan tugas kelompok adalah metode pembelajaran yang lazim di perguruan tinggi. Di dalamnya
mahasiswa harus menyelesaikan sejumlah pekerjaan yang berbeda tingkat kesulitan, kebutuhan
keterampilan, dan estimasi waktunya. Masalah muncul ketika pembagian pekerjaan dilakukan secara
informal: berdasarkan kesepakatan anggota, keputusan ketua, atau siapa yang lebih dulu
menawarkan diri.

Cara informal tersebut tidak selalu menghasilkan pembagian yang seimbang. Ada anggota yang
menerima pekerjaan melebihi kapasitasnya, sementara anggota lain belum dimanfaatkan. Ada pula
pekerjaan yang jatuh ke anggota yang belum memiliki keterampilan yang sesuai. Persoalan
bertambah ketika keputusan pembagian tidak memiliki dasar perhitungan yang transparan, sehingga
sulit dipertanggungjawabkan dan mudah menimbulkan perdebatan di dalam kelompok.

Literatur sistem rekomendasi menunjukkan bahwa masalah pemilihan dan penugasan seperti ini dapat
diformalisasi. Content-based filtering mencocokkan kebutuhan pekerjaan dengan profil
pemakainya (Lops dkk., 2011; Pazzani & Billsus, 2007). Representasi teks dalam bentuk vektor
memungkinkan pengukuran kemiripan makna antara deskripsi pekerjaan dan deskripsi kemampuan
(Mikolov dkk., 2013; Reimers & Gurevych, 2019). Penilaian multikriteria dengan pembobotan
memungkinkan beberapa pertimbangan digabungkan menjadi satu nilai yang dapat dibandingkan
(Saaty, 1990). Masalah penugasan sendiri telah lama dikenal sebagai kelas masalah optimasi
(Kuhn, 1955), dan aturan pembatas dapat dipakai untuk menyaring kandidat sebelum penilaian
dilakukan (Tsang, 1993; Felfernig dkk., 2015). Pemerataan beban kerja juga telah diformalkan
sebagai tujuan yang dapat dioptimasi, bukan sekadar preferensi (Lunin, 2024).

Berdasarkan landasan tersebut, proyek ini membangun aplikasi web yang membantu kelompok kecil
membagi tugas secara terukur. Ketua kelompok memasukkan profil anggota dan daftar tugas. Sistem
menyarankan penanggung jawab untuk setiap tugas, menampilkan rincian skor setiap pasangan tugas
dan anggota, serta menulis satu kalimat alasan yang hanya memakai data yang dimasukkan
pengguna.

Pendekatan yang dipilih adalah rekomendasi hybrid sederhana. Bagian AI dipakai pada tempat yang
memang membutuhkan pemahaman bahasa, yaitu membaca deskripsi tugas, mengukur kemiripan semantik
antara tugas dan profil anggota, serta menyusun kalimat penjelasan. Keputusan akhir diambil
oleh aturan dan skor berbobot yang deterministik, sehingga setiap hasil dapat dihitung ulang
dan dipertanggungjawabkan saat presentasi. Pemisahan ini disengaja: bagian yang tidak dapat
dijamin konsisten ditempatkan pada peran yang tidak menentukan hasil akhir.

## 1.2 Rumusan Masalah

Berdasarkan latar belakang di atas, rumusan masalah laporan ini adalah:

1. Bagaimana merancang sistem rekomendasi yang dapat menyarankan penanggung jawab tugas
   berdasarkan kecocokan keterampilan, kapasitas, minat, dan kemiripan semantik deskripsi tugas
   dengan profil anggota?
2. Bagaimana memastikan keputusan rekomendasi tetap dapat dihitung ulang, transparan, dan
   konsisten meskipun sebagian prosesnya memakai model AI?
3. Bagaimana menegakkan aturan keras berupa kapasitas, batas beban, kecocokan keterampilan,
   satu penanggung jawab per tugas, dan tugas terkunci?
4. Bagaimana kinerja pendekatan hybrid dibandingkan dengan pemilihan acak, pembagian
   bergiliran, dan pembagian manual pada data uji?
5. Sejauh mana batasan pendekatan yang dipakai, dan bagian mana yang belum dapat dibuktikan?

## 1.3 Tujuan

Tujuan yang ingin dicapai adalah:

1. Merancang dan mengimplementasikan mesin rekomendasi hybrid yang menggabungkan skor
   deterministik dengan kemiripan semantik berbasis embedding.
2. Menyediakan antarmuka yang memperlihatkan rincian perhitungan skor, sehingga pengguna dapat
   memeriksa alasan sebuah saran diberikan.
3. Menegakkan lima aturan keras sebagai penyaring kandidat dan penjaga konsistensi penugasan.
4. Membandingkan kinerja pendekatan hybrid terhadap tiga metode pembanding pada seperangkat
   skenario uji yang sama.
5. Menyatakan secara jujur bagian mana dari sistem yang telah terbukti dan bagian mana yang
   masih berupa keterbatasan.

## 1.4 Manfaat dan Batasan Penelitian

### 1.4.1 Manfaat

**Manfaat teoretis.** Laporan ini menunjukkan satu cara menggabungkan model bahasa sebagai
pengukur kemiripan makna dengan keputusan akhir yang deterministik. Pola ini relevan bagi
pembahasan tentang sistem rekomendasi yang perlu tetap dapat diaudit (Felfernig dkk., 2015;
Wu dkk., 2022).

**Manfaat praktis.** Bagi kelompok mahasiswa, aplikasi ini menyediakan dasar perhitungan yang
dapat diperiksa ketika beban terasa tidak seimbang. Bagi pengembang, pemisahan antara lapisan
AI dan lapisan keputusan memberi batas yang jelas tentang bagian mana yang dapat berubah tanpa
merusak konsistensi hasil.

**Manfaat metodologis.** Pembandingan empat metode pada skenario yang sama memperlihatkan bahwa
tidak ada satu metode yang unggul pada semua metrik sekaligus. Temuan ini berguna sebagai
peringatan agar pemilihan metode tidak dilakukan hanya berdasarkan satu angka.

### 1.4.2 Batasan Penelitian

Batasan berikut dinyatakan sejak awal agar pembaca tidak membaca laporan ini melebihi buktinya.

| No | Batasan | Bukti atau alasan |
|---|---|---|
| 1 | Evaluasi memakai **data sintetis**, bukan data lapangan atau data responden | `eval/results/dataset_summary.json` menyebut D1 dan D2 sebagai dataset sintetis; tidak ada berkas D3 di repository |
| 2 | **Kesepakatan penilai manusia belum diukur** | `eval/reports/G_HUMAN_AGREEMENT.md` berstatus BLOCKED karena belum ada tiga reviewer |
| 3 | **Ablation study dengan embedding live belum dijalankan** | `eval/results/ablation.json` mencatat `liveAblation: "BLOCKED"`; komponen K memakai proksi deterministik |
| 4 | **Penerapan migrasi Supabase belum diverifikasi** | Berkas migrasi 001 sampai 007 ada di repository, tetapi tidak ada bukti bahwa migrasi telah diterapkan pada proyek Supabase nyata |
| 5 | **Pengujian langsung pada deployment belum dilakukan** | Tidak ada bukti pengujian aplikasi pada lingkungan produksi |
| 6 | Empat pengujian otomatis **gagal** dan penyebabnya lingkungan, bukan logika | `test/ai/gemini-models.live.test.ts` dan `test/ai/groq.live.test.ts` memerlukan API live |
| 7 | Dataset uji berukuran kecil: **20 skenario, 49 anggota, 35 tugas** | `eval/results/dataset_summary.json` |
| 8 | Kebijakan RLS pada Supabase mengizinkan seluruh akses | Migrasi memuat `USING (true) WITH CHECK (true)` pada semua tabel; keamanan bergantung pada lapisan server, bukan pada RLS |

---

# BAB II PEMBAHASAN

## 2.1 Dasar Teori

Bagian ini menyusun landasan teori yang benar-benar dipakai oleh proyek. Setiap konsep
dihubungkan dengan keputusan implementasi yang dapat diperiksa pada kode repository.

### 2.1.1 Sistem Rekomendasi

Sistem rekomendasi membantu pengguna memilih di antara banyak pilihan ketika jumlah pilihan
melebihi kemampuan pengguna untuk memeriksanya satu per satu. Literatur membedakan beberapa
keluarga pendekatan: content-based filtering yang memakai kemiripan antara profil pengguna dan
atribut item, collaborative filtering yang memanfaatkan pola perilaku pengguna lain, dan
pendekatan hybrid yang menggabungkan keduanya (Lops dkk., 2011; Burke, 2002).

Proyek ini berada pada keluarga content-based, bukan collaborative, karena alasan yang bersifat
struktural. Collaborative filtering memerlukan riwayat interaksi dalam jumlah besar untuk
menemukan pola antar-pengguna (Koren dkk., 2009). Pada konteks pembagian tugas kelompok, riwayat
semacam itu tidak tersedia: satu kelompok hanya berisi beberapa anggota dan hanya sekali
membagi tugas. Memaksakan collaborative filtering pada data sekecil itu akan menghasilkan
rekomendasi yang lemah dan tidak dapat dipertanggungjawabkan.

Selain pembagian di atas, terdapat keluarga **constraint-based recommendation**, yaitu sistem
yang memakai aturan pembatas sebagai mekanisme penyaringan kandidat, sehingga hanya solusi yang
memenuhi batasan yang dipertimbangkan (Felfernig dkk., 2015). Keluarga ini penting bagi proyek
karena proyek memang memakai aturan keras. Namun perlu ditegaskan sejak awal: proyek ini
**bukan** implementasi constraint solver penuh. Yang dipakai adalah aturan keras sebagai
penyaring kandidat, ditambah skor berbobot untuk memilih di antara kandidat yang lolos. Menyebut
sistem ini sebagai sistem constraint-based yang lengkap akan melebihkan apa yang benar-benar
dibangun.

**Tabel 2.1 Perbandingan pendekatan sistem rekomendasi dan posisi proyek**

| Pendekatan | Sumber sinyal | Kebutuhan data | Dipakai proyek | Alasan |
|---|---|---|---|---|
| Content-based | Atribut item dan profil pengguna | Kecil, cukup satu pengguna | **Ya**, sebagai dasar skor K, S, M | Tidak memerlukan riwayat pengguna lain |
| Collaborative filtering | Pola antar-pengguna | Besar | Tidak | Satu kelompok terlalu kecil untuk membentuk pola |
| Constraint-based | Aturan pembatas | Kecil, aturan dinyatakan eksplisit | **Sebagian**, sebagai aturan R1 sampai R5 | Aturan menyaring kandidat, tetapi tidak ada mesin penyelesaian batasan |
| Hybrid | Gabungan beberapa sinyal | Mengikuti komponennya | **Ya** | Menggabungkan kemiripan semantik, keterampilan, kapasitas, dan minat |

Sumber: `docs/PRD_v0.3.md` §8, `lib/scoring/score.ts`, `lib/scoring/rules.ts`.

### 2.1.2 Content-Based Filtering

Content-based filtering menghitung kecocokan antara kebutuhan item dan profil pengguna, lalu
memeringkat item berdasarkan kecocokan tersebut (Pazzani & Billsus, 2007). Pada proyek ini
"item" adalah tugas dan "pengguna" adalah anggota kelompok. Kecocokan dihitung dari dua sisi.
Sisi pertama adalah **keterampilan**: tingkat penguasaan anggota pada keterampilan yang
dibutuhkan tugas. Sisi kedua adalah **minat**: seberapa tertarik anggota pada keterampilan yang
sama.

Keduanya dipisahkan secara sengaja. Anggota yang terampil pada suatu bidang belum tentu
berminat mengerjakannya, dan sebaliknya. Menggabungkan keduanya menjadi satu nilai sejak awal
akan menghilangkan informasi yang justru dibutuhkan pengguna untuk menilai keadilan pembagian.
Pemisahan ini juga membuat bobot minat dapat diturunkan tanpa memengaruhi bobot keterampilan,
sesuai sifat penilaian multikriteria yang dibahas pada §2.1.4.

Relevansi dengan proyek: komponen S dan M pada rumus skor (§2.5.1) adalah penerapan langsung
content-based filtering. Nilai S dihitung dari rata-rata tingkat keterampilan anggota pada
keterampilan yang diminta tugas. Nilai M dihitung dari rata-rata minat anggota pada
keterampilan yang sama.

### 2.1.3 Text Embedding dan Cosine Similarity

Deskripsi tugas dan profil anggota berupa teks bebas. Pencocokan kata kunci sederhana akan gagal
ketika dua teks memakai kata berbeda untuk makna yang sama, misalnya "membuat slide" dan
"menyusun presentasi". Text embedding mengatasi hal ini dengan memetakan teks menjadi vektor
bilangan yang posisinya mencerminkan makna (Mikolov dkk., 2013). Model embedding kalimat
menghasilkan satu vektor untuk satu kalimat utuh, sehingga kemiripan antar-kalimat dapat diukur
langsung tanpa pencocokan kata (Reimers & Gurevych, 2019).

Kemiripan antara dua vektor diukur dengan **cosine similarity**, yaitu kosinus sudut antara dua
vektor pada ruang vektor. Nilainya berkisar dari -1 sampai 1, dan semakin mendekati 1 semakin
mirip arah kedua vektor. Ukuran ini dipilih karena tidak terpengaruh panjang vektor, sehingga
teks pendek dan teks panjang dapat dibandingkan secara wajar (Salton dkk., 1975).

Pada proyek, cosine similarity mentah tidak langsung dipakai sebagai skor. Nilai tersebut
dinormalisasi ke rentang 0 sampai 1 dengan batas bawah 0,2 dan batas atas 0,8, sesuai konstanta
`EMBEDDING_COSINE_MIN` dan `EMBEDDING_COSINE_MAX` pada `lib/scoring/constants.ts`. Pemetaan ini
mengikuti formula:

```text
K = 0                          jika cosine <= 0,2
K = 1                          jika cosine >= 0,8
K = (cosine - 0,2) / (0,8 - 0,2)   untuk nilai di antaranya
```

Alasan pemetaan ini bersifat praktis. Cosine similarity antar-kalimat pendek jarang mencapai
nilai ekstrem, sehingga tanpa normalisasi komponen K akan selalu kecil dan bobotnya menjadi
tidak berarti. Dengan pemetaan ini, perbedaan kemiripan yang tampak kecil tetap terlihat pada
skor akhir.

Relevansi dengan proyek: komponen K adalah penerapan langsung embedding dan cosine similarity.
K bernilai 0 secara paksa ketika sistem berjalan dalam mode cadangan, karena mode tersebut
memang tidak memanggil layanan embedding.

Terdapat dua hal yang perlu dinyatakan terbuka mengenai komponen ini. Pertama, topik cosine
similarity masih bersandar pada satu rujukan lama, yaitu Salton dkk. (1975), karena penambahan
referensi pada fase ini tidak mencakup topik tersebut. Kedua, embedding yang dipakai adalah
layanan dari penyedia berbeda dari model teks, dan pemisahan ini dijelaskan pada §2.2.

### 2.1.4 Penilaian Multikriteria dan Weighted Scoring

Penilaian multikriteria dipakai ketika satu keputusan harus mempertimbangkan beberapa kriteria
yang tidak dapat direduksi menjadi satu ukuran tunggal. Pendekatan yang paling langsung adalah
**weighted sum model**, yaitu menjumlahkan nilai setiap kriteria setelah dikalikan bobotnya
(Saaty, 1990). Bobot menyatakan prioritas relatif antar-kriteria, dan jumlah bobot biasanya
dinormalkan menjadi satu.

Keluarga metode multikriteria tidak tunggal. TOPSIS memilih alternatif yang paling dekat dengan
solusi ideal sekaligus paling jauh dari solusi terburuk, dan telah dikaji secara luas pada
berbagai bidang penerapan (Behzadian dkk., 2012). VIKOR menawarkan solusi kompromi dan
menghasilkan peringkat yang dapat berbeda dari TOPSIS pada data yang sama (Opricovic & Tzeng,
2004).

**Penting untuk dinyatakan tegas:** proyek ini memakai **weighted sum sederhana**, bukan
TOPSIS, bukan VIKOR, dan bukan Analytic Hierarchy Process. TOPSIS dan VIKOR hanya dipakai
sebagai pembanding konseptual untuk menjelaskan keterbatasan pemilihan metode, khususnya ketika
pada §2.6.6 dibahas mengapa pemilihan metode memengaruhi hasil peringkat. Tidak ada kode TOPSIS
maupun VIKOR di repository, dan tidak boleh ada klaim bahwa metode tersebut diimplementasikan.

Kelemahan weighted sum yang perlu diakui adalah sifatnya yang mengimbangi (compensatory):
nilai sangat tinggi pada satu kriteria dapat menutupi nilai sangat rendah pada kriteria lain.
Opricovic & Tzeng (2004) menunjukkan bahwa perbedaan cara memperlakukan kompromi antar-kriteria
dapat mengubah peringkat akhir. Karena itu, pada proyek ini weighted sum **tidak dipakai
sendirian**. Aturan keras R1 sampai R5 berfungsi sebagai penjaga yang tidak dapat dikalahkan
oleh skor tinggi, sehingga anggota yang melanggar kapasitas tidak dapat memenangkan penugasan
hanya karena skor keterampilannya tinggi.

### 2.1.5 Constraint-Aware Assignment

Masalah penugasan adalah masalah memasangkan sejumlah tugas kepada sejumlah pelaksana sehingga
total biaya tertentu menjadi minimum. Kuhn (1955) merumuskan penyelesaian optimal untuk kasus
ini melalui metode Hungarian. Penyelesaian optimal tersebut menuntut perumusan yang lengkap dan
waktu komputasi yang tumbuh cepat seiring ukuran masalah.

Aturan pembatas menyediakan cara lain untuk membatasi ruang solusi. Dalam kerangka constraint
satisfaction, sebuah solusi sahih apabila memenuhi seluruh batasan yang dinyatakan (Tsang,
1993). Pada sistem rekomendasi berbasis batasan, aturan dipakai untuk menyaring kandidat
sebelum penilaian dilakukan, sehingga penilaian hanya dilakukan pada pilihan yang memang
mungkin (Felfernig dkk., 2015).

Gagasan menyaring kandidat berdasarkan keahlian yang dibutuhkan juga dipakai pada masalah
pembentukan tim. Li dkk. (2015) mengusulkan metode yang memadatkan informasi keahlian menjadi
representasi ringkas menurut keterampilan yang dibutuhkan, sehingga ruang pencarian menyempit
dan individu yang tidak relevan tersaring sebelum tim disusun. Kaitannya dengan proyek ini
bersifat konseptual: Li dkk. membahas pembentukan tim pada jejaring sosial, bukan pembagian
tugas dalam proyek kelompok. Yang diambil adalah prinsipnya, yaitu penyaringan berdasarkan
keahlian dilakukan lebih dahulu agar penilaian tidak dilakukan pada seluruh kemungkinan.

Proyek ini mengambil jalan tengah. Algoritma yang dipakai adalah **heuristik greedy**, bukan
solver optimal. Tugas diurutkan berdasarkan tingkat kesulitan, lalu setiap tugas dipasangkan ke
kandidat dengan skor tertinggi yang masih memenuhi aturan. Pilihan ini diambil karena alasan
yang dapat diperiksa: solver optimal akan menyulitkan penjelasan kepada pengguna tentang mengapa
sebuah tugas diberikan kepada anggota tertentu, sementara heuristik greedy menghasilkan
keputusan yang dapat dilacak langkah demi langkah. Konsekuensinya, hasil greedy **tidak
dijamin optimal secara global**. Keterbatasan ini dinyatakan, bukan disembunyikan, dan dibahas
kembali pada §2.6.7.

Relevansi dengan proyek: aturan R1 sampai R5 (§2.5.3) adalah penerapan constraint-aware
assignment. Aturan tersebut menyaring kandidat sebelum skor dipakai untuk memilih.

### 2.1.6 Evaluasi Sistem Rekomendasi

Evaluasi sistem rekomendasi tidak cukup memakai satu metrik akurasi. Herlocker dkk. (2004)
menunjukkan bahwa kualitas sistem rekomendasi mencakup beberapa dimensi, dan metrik prediksi
saja tidak menangkap seluruhnya. Järvelin & Kekäläinen (2002) menambahkan bahwa kualitas
peringkat perlu dinilai sebagai distribusi, bukan hanya sebagai satu angka rata-rata.

Pada konteks pembagian tugas, dimensi yang relevan berbeda dari konteks rekomendasi produk.
Yang diukur bukan seberapa akurat prediksi rating, melainkan:

1. **Cakupan keterampilan**, yaitu seberapa banyak kebutuhan keterampilan tugas yang benar-benar
   terpenuhi oleh penanggung jawabnya.
2. **Pemerataan beban**, yaitu seberapa jauh sebaran beban antar-anggota menyimpang dari ideal.
3. **Kualitas kecocokan**, yaitu rata-rata skor kecocokan pasangan tugas dan anggota.
4. **Kepatuhan aturan keras**, yaitu jumlah pelanggaran R1, R2, dan R3.
5. **Beban perubahan manual**, yaitu berapa kali pengguna harus memperbaiki hasil sistem.

Dimensi keadilan perlu ditambahkan karena pembagian tugas menyangkut pembagian beban antar-orang
yang saling mengenal. Wu dkk. (2022) menunjukkan bahwa evaluasi rekomendasi pada sistem dengan
banyak pemangku kepentingan perlu mempertimbangkan keadilan, bukan hanya relevansi. Pada proyek
ini, "pemangku kepentingan" adalah anggota kelompok, dan bentuk keadilan yang diukur adalah
pemerataan beban kerja. Lunin (2024) memperlihatkan bahwa pemerataan beban dapat diformalkan
sebagai tujuan optimasi dan menghasilkan alokasi yang disebut lebih adil.

Konsekuensi metodologis dari uraian di atas adalah: **tidak boleh ada satu angka tunggal yang
disebut "kinerja sistem"**. Laporan ini karena itu melaporkan kelima dimensi secara terpisah,
dan pada §2.6.5 dinyatakan secara eksplisit bahwa tidak ada metode yang unggul pada semua
dimensi sekaligus.

## 2.2 Konsep AI yang Digunakan

### 2.2.1 Alasan Pemilihan Pendekatan Hybrid

Pendekatan hybrid dipilih bukan karena dianggap paling unggul, melainkan karena sifat masalahnya
menuntut dua kemampuan yang berbeda. Di satu sisi, sistem perlu memahami teks bebas, dan
kemampuan itu dimiliki oleh model bahasa. Di sisi lain, sistem perlu menghasilkan keputusan yang
sama setiap kali dijalankan dengan masukan yang sama, dan kemampuan itu tidak dapat dijamin oleh
model bahasa.

Burke (2002) mengelompokkan beberapa cara menggabungkan pendekatan rekomendasi. Proyek ini
memakai pola yang paling sederhana: setiap komponen menghasilkan nilai, lalu nilai tersebut
digabungkan dengan pembobotan. Tidak ada lapisan pembelajaran atas hasil penggabungan, dan tidak
ada penyesuaian bobot otomatis berdasarkan data historis.

Konsekuensi dari pilihan ini perlu dinyatakan. Sistem tidak akan membaik dengan sendirinya
seiring bertambahnya pemakaian, karena tidak ada mekanisme pembelajaran dari data. Kualitas
sistem bergantung sepenuhnya pada rancangan bobot dan aturan. Sebagai gantinya, sistem
memberikan sifat yang justru dihargai pada konteks akademik: hasilnya dapat dihitung ulang,
diperiksa, dan dipertanggungjawabkan.

### 2.2.2 Peran Embedding

Embedding berperan mengubah teks menjadi vektor sehingga kemiripan makna dapat diukur. Pada
proyek ini, teks yang di-embedding adalah deskripsi tugas dan profil anggota. Hasilnya dipakai
sebagai komponen K pada rumus skor.

Ada dua hal teknis yang perlu dicatat dengan tepat karena sering keliru dalam penyebutan.

Pertama, **penyedia embedding berbeda dari penyedia model teks**. Berkas `lib/ai/groq.ts`
menyatakan secara eksplisit bahwa Groq tidak menyediakan layanan embedding, sehingga layanan
embedding tetap memakai Gemini. Dengan demikian sistem memakai dua penyedia: **Groq untuk model
teks**, dan **Gemini untuk embedding**. Menyebut Groq sebagai Gemini, atau sebaliknya, adalah
kesalahan.

Kedua, **dimensi embedding adalah 768**, sesuai konstanta `EMBEDDING_DIMENSION` pada
`lib/ai/embedding-cache.ts`. Dimensi ini bukan angka pilihan bebas: nilai tersebut dipakai untuk
memvalidasi bahwa vektor yang tersimpan di cache benar-benar utuh ketika dibaca kembali. Vektor
dengan dimensi berbeda ditolak sebagai tidak sahih.

Embedding di-cache agar panggilan ke penyedia layanan tidak diulang untuk teks yang sama. Cache
ini penting karena panggilan embedding termasuk dalam batas anggaran panggilan yang dibahas pada
§2.2.5.

### 2.2.3 Peran Model Analisis Tugas

Model analisis tugas berperan membaca deskripsi tugas berbahasa alami dan mengubahnya menjadi
data terstruktur: keterampilan apa yang dibutuhkan, seberapa besar usaha yang diperkirakan, dan
kategori tugas. Model yang dipakai adalah model teks dari Groq, diakses melalui
`lib/ai/analyze-task.ts`.

Peran ini bersifat **pengayaan masukan**, bukan penentuan hasil. Keluaran model analisis tidak
langsung menentukan siapa yang mendapat tugas. Keluaran tersebut menjadi masukan bagi rumus
skor, dan rumus itulah yang menentukan hasil. Pemisahan peran ini penting karena keluaran model
bahasa bersifat probabilistik, sedangkan hasil penugasan harus dapat dihitung ulang.

### 2.2.4 Peran Model Penjelasan

Model penjelasan berperan menyusun kalimat alasan mengapa seorang anggota disarankan untuk suatu
tugas. Penjelasan yang baik bersifat spesifik dan mengacu pada data yang benar-benar dimasukkan
pengguna (Miller, 2019). Kerangka penjelasan yang dapat dipahami pengguna juga menjadi perhatian
dalam program penelitian explainable AI (Gunning & Aha, 2019).

Pada proyek ini terdapat dua lapis penjelasan. Lapis pertama adalah penjelasan **deterministik**
yang dibangkitkan fungsi `generateExplanation` pada `lib/scoring/assign.ts`, yang menyebut
keterampilan yang cocok dan persentase skor kesesuaian. Lapis kedua adalah penjelasan
**generatif** dari model bahasa, yang dipakai untuk merangkai kalimat yang lebih mengalir.

Keberadaan lapis deterministik penting karena menjadi jaring pengaman. Ketika layanan AI tidak
tersedia, penjelasan tetap dapat diberikan. Ketika layanan AI tersedia, kalimat generatif tidak
boleh memuat data yang tidak dimasukkan pengguna.

### 2.2.5 Batasan AI dan Keputusan Deterministik

Bagian ini menjelaskan batas tegas antara wilayah AI dan wilayah keputusan.

**Batas jumlah panggilan.** Satu proses rekomendasi dibatasi maksimal **tiga panggilan** ke
penyedia layanan, sesuai konstanta `MAX_GEMINI_CALLS_PER_PROCESS` pada `lib/ai/call-budget.ts`.
Ketiga panggilan tersebut adalah analisis tugas, embedding, dan penyusunan penjelasan. Batas ini
bukan sekadar catatan dokumentasi: penjaga anggaran berupa objek nyata yang membungkus setiap
panggilan dan menolak panggilan keempat sebelum mencapai jaringan. Kelas `CallBudgetExceededError`
dilempar ketika batas terlampaui. Alasan batas ini bersifat praktis, yaitu menjaga agar proses
tetap cepat dan tetap muat dalam batas layanan gratis, sekaligus menjaga biaya.

**Keputusan deterministik.** Terdapat tiga keputusan yang selalu diambil tanpa AI:

1. Perhitungan komponen K, S, C, dan M serta skor total, pada `lib/scoring/score.ts`.
2. Pemeriksaan aturan keras R1 sampai R5, pada `lib/scoring/rules.ts`.
3. Pemilihan penanggung jawab melalui penugasan global, pada `lib/scoring/assign.ts`.

Ketiganya berupa fungsi TypeScript murni. Sifat ini memiliki konsekuensi yang dapat diuji:
dengan masukan sama, keluaran selalu sama. Karena fungsi yang sama juga dijalankan di peramban,
penggeseran bobot dan pemindahan tugas langsung memperbarui hasil tanpa memanggil AI.

**Tabel 2.4 Pemetaan konsep AI ke tahap sistem**

| Tahap | Komponen | Jenis | Penyedia | Batas |
|---|---|---|---|---|
| 1. Analisis tugas | Ubah deskripsi menjadi keterampilan dan usaha | AI generatif | Groq (model teks) | Termasuk dalam anggaran 3 panggilan |
| 2. Embedding | Ubah teks menjadi vektor 768 dimensi | Model embedding | Gemini | Termasuk dalam anggaran 3 panggilan |
| 3. Skor K, S, C, M | Hitung kecocokan setiap pasangan | Deterministik | Tidak ada | Dapat dihitung ulang di peramban |
| 4. Aturan R1 sampai R5 | Saring kandidat | Deterministik | Tidak ada | Tidak dapat dilampaui skor tinggi |
| 5. Penugasan global | Pilih pemilik tiap tugas | Deterministik (greedy) | Tidak ada | Tidak dijamin optimal |
| 6. Penjelasan | Susun kalimat alasan | AI generatif atau deterministik | Groq atau fungsi lokal | Jatuh ke versi deterministik bila AI gagal |

Sumber: `lib/ai/call-budget.ts`, `lib/ai/analyze-task.ts`, `lib/ai/explain.ts`, `lib/ai/groq.ts`,
`lib/scoring/score.ts`, `lib/scoring/rules.ts`, `lib/scoring/assign.ts`.

**Tabel 2.2 Bobot default dan bobot mode cadangan**

| Komponen | Arti | Bobot default | Bobot mode cadangan |
|---|---|---|---|
| K | Kemiripan semantik (embedding) | 0,40 | 0,00 |
| S | Kecocokan keterampilan | 0,30 | 0,50 |
| C | Sisa kapasitas | 0,20 | 0,33 |
| M | Minat | 0,10 | 0,17 |
| **Total** | | **1,00** | **1,00** |

Sumber: `lib/scoring/constants.ts` (`DEFAULT_WEIGHTS`, `FALLBACK_WEIGHTS`).

Mode cadangan menetapkan K menjadi 0 karena mode tersebut memang tidak memanggil layanan
embedding. Bobot komponen lain dinaikkan agar totalnya tetap 1,00 sehingga skor tetap berada
pada skala yang sama dan dapat dibandingkan dengan mode normal.

## 2.3 Desain Sistem dan Arsitektur

### 2.3.1 Arsitektur Aplikasi

Aplikasi dibangun sebagai aplikasi web dengan pemisahan tegas antara lapisan tampilan, lapisan
logika penilaian, dan lapisan penyimpanan. Pemisahan ini bukan sekadar kerapian, melainkan
konsekuensi dari keputusan §2.2.5: logika penilaian harus dapat berjalan di dua tempat, yaitu
peladen dan peramban, agar penggeseran bobot dapat memberikan hasil seketika.

**[GAMBAR PERLU DITAMBAHKAN] Gambar 2.1 Arsitektur aplikasi dan alur data.**
Gambar yang dibutuhkan adalah diagram blok yang menunjukkan: (a) peramban yang menjalankan
komponen React dan fungsi penilaian TypeScript, (b) rute API Next.js sebagai batas peladen,
(c) pustaka `lib/scoring` sebagai inti deterministik, (d) `lib/ai` sebagai lapisan pemanggilan
penyedia, dan (e) Supabase sebagai penyimpanan. Panah harus menunjukkan bahwa perhitungan skor
dan penugasan dapat terjadi di peramban tanpa melewati jaringan, sedangkan pemanggilan AI dan
pembacaan basis data selalu melewati peladen. Sumber kebenaran untuk gambar ini adalah struktur
direktori `app/`, `lib/scoring/`, `lib/ai/`, dan `supabase/migrations/`.

**Tabel 2.5 Komponen arsitektur dan tanggung jawabnya**

| Komponen | Lokasi | Tanggung jawab | Dapat berjalan tanpa AI |
|---|---|---|---|
| Antarmuka | `app/` | Input anggota dan tugas, tampilan matriks skor, penggeser bobot | Ya |
| Rute API | `app/api/` | Menerima permintaan, memvalidasi, memanggil logika dan basis data | Ya, kecuali rute analisis |
| Logika penilaian | `lib/scoring/` | Rumus skor, aturan R1 sampai R5, penugasan global | **Ya, sepenuhnya** |
| Lapisan AI | `lib/ai/` | Analisis tugas, embedding, penjelasan, penjaga anggaran | Tidak, tetapi ada jalur cadangan |
| Basis data | `supabase/migrations/` | Sembilan tabel, migrasi 001 sampai 007 | Ya |

Sumber: struktur repository, `lib/ai/call-budget.ts`.

### 2.3.2 Alur Data

Alur data pada satu proses rekomendasi berjalan sebagai berikut.

1. Pengguna memasukkan data anggota dan tugas melalui antarmuka.
2. Data disimpan ke basis data melalui rute API.
3. Bila AI aktif, deskripsi tugas dianalisis untuk memperoleh keterampilan dan perkiraan usaha.
   Langkah ini memakai satu panggilan dari anggaran tiga.
4. Teks tugas dan profil anggota di-embedding menjadi vektor 768 dimensi, dengan cache untuk
   teks yang sudah pernah diproses. Langkah ini memakai satu panggilan dari anggaran tiga.
5. Cosine similarity dihitung untuk setiap pasangan tugas dan anggota, lalu dinormalisasi
   menjadi komponen K.
6. Komponen S, C, dan M dihitung dari data terstruktur.
7. Skor total dihitung dari bobot dikali komponen.
8. Aturan R1 sampai R5 diterapkan sebagai penyaring.
9. Penugasan global memilih pemilik setiap tugas secara greedy.
10. Penjelasan disusun, memakai satu panggilan terakhir bila AI aktif.
11. Hasil ditampilkan beserta rincian skor dan peringatan yang muncul.

Bila AI tidak aktif atau gagal, langkah 3, 4, dan 10 dilewati dan sistem berjalan pada mode
cadangan. Langkah 5 sampai 9 tetap berjalan penuh karena seluruhnya deterministik.

**[GAMBAR PERLU DITAMBAHKAN] Gambar 2.2 Diagram alur perhitungan skor dan penugasan global.**
Gambar yang dibutuhkan adalah diagram alir yang membedakan dua jalur, yaitu jalur dengan AI dan
jalur mode cadangan, lalu bertemu pada perhitungan skor dan penugasan. Diagram harus
memperlihatkan bahwa mode cadangan menetapkan K sama dengan nol, bukan menghapus komponen K dari
rumus. Sumber: `lib/scoring/score.ts`, `lib/scoring/assign.ts`, `lib/ai/analyze-task.ts`.

### 2.3.3 Komponen Frontend dan Backend

**Frontend.** Antarmuka menyediakan tiga hal utama yang menjadi alasan pemakaian sistem ini
alih-alih pembagian manual. Pertama, matriks skor yang memperlihatkan nilai setiap pasangan tugas
dan anggota. Kedua, penggeser bobot yang langsung memperbarui hasil. Ketiga, kemampuan memindahkan
tugas secara manual dan melihat akibatnya terhadap aturan keras.

Ketiganya bergantung pada satu sifat: fungsi penilaian adalah TypeScript murni yang dapat
berjalan di peramban. Karena itu, penggeseran bobot tidak memerlukan permintaan jaringan. Sifat
ini terverifikasi pada pengukuran yang dibahas pada §2.6.6, yang mencatat nol permintaan jaringan
selama penggeseran bobot.

**[GAMBAR PERLU DITAMBAHKAN] Gambar 2.4 Tangkapan layar matriks skor dan rincian perhitungan.**
Gambar yang dibutuhkan adalah tangkapan layar antarmuka yang memperlihatkan matriks tugas dan
anggota beserta nilai setiap komponen skor, penanda kelayakan, dan peringatan yang muncul.
Tangkapan layar harus berasal dari aplikasi yang benar-benar dijalankan, bukan dibuat ulang
secara manual.

**[GAMBAR PERLU DITAMBAHKAN] Gambar 2.5 Tangkapan layar mode cadangan saat AI dimatikan.**
Gambar yang dibutuhkan adalah tangkapan layar kondisi ketika AI tidak aktif, yang memperlihatkan
bahwa komponen K bernilai nol, bobot lain menyesuaikan diri, dan penjelasan deterministik tetap
ditampilkan.

**Backend.** Delapan rute API tersedia, dengan pembagian tanggung jawab sebagai berikut.

**Tabel 2.6 Rute API dan fungsinya**

| Rute | Metode | Fungsi |
|---|---|---|
| `/api/projects` | Buat dan baca | Membuat proyek dan membaca daftar proyek |
| `/api/projects/[code]/members` | Buat dan baca | Menambah dan membaca anggota |
| `/api/projects/[code]/members/[id]` | Ubah dan hapus | Memperbarui profil anggota secara atomik |
| `/api/projects/[code]/tasks` | Buat dan baca | Menambah dan membaca tugas |
| `/api/projects/[code]/tasks/[id]` | Ubah dan hapus | Memperbarui dan menghapus tugas |
| `/api/projects/[code]/events` | Baca | Membaca catatan kejadian pada proyek |
| `/api/analyze-task` | Kirim | Menganalisis deskripsi tugas memakai model teks |
| `/api/recommend` | Kirim | Menjalankan proses rekomendasi penuh |

Sumber: `app/api/**/route.ts`.

### 2.3.4 Supabase

Basis data memakai Supabase dengan sembilan tabel: `projects`, `members`, `member_skills`,
`tasks`, `recommendations`, `assignments`, `events`, `embedding_cache`, dan `ai_runs`. Skema
dibangun melalui tujuh berkas migrasi, yaitu `001_initial_schema.sql` sampai
`007_task_management_fr04.sql`.

**[GAMBAR PERLU DITAMBAHKAN] Gambar 2.3 Skema basis data sembilan tabel.**
Gambar yang dibutuhkan adalah diagram relasi entitas yang menunjukkan kunci utama dan kunci asing
antar-tabel, termasuk hubungan satu proyek ke banyak anggota dan banyak tugas. Sumber:
`supabase/migrations/001_initial_schema.sql` sampai `007_task_management_fr04.sql`.

Dua hal mengenai keamanan perlu dinyatakan terbuka.

Pertama, **Row Level Security diaktifkan pada seluruh sembilan tabel**, dan hal ini dapat
diverifikasi dari berkas migrasi: terdapat sembilan pernyataan `enable row level security`.
Namun kebijakan yang menyertainya berbunyi `USING (true) WITH CHECK (true)` untuk setiap tabel.
Kebijakan tersebut mengizinkan seluruh operasi bagi siapa pun yang dapat menjangkau basis data.
Dengan kata lain, RLS aktif secara mekanisme tetapi **tidak membatasi apa pun**. Keamanan data
karena itu bergantung sepenuhnya pada lapisan peladen, bukan pada aturan di basis data. Ini adalah
keterbatasan nyata, bukan detail administratif, dan dicatat sebagai ancaman validitas pada
§2.6.7.

Kedua, **penerapan migrasi belum diverifikasi**. Berkas migrasi ada di repository, tetapi tidak
ada bukti bahwa migrasi telah dijalankan pada proyek Supabase yang nyata. Pernyataan "skema
sudah diterapkan" karenanya berstatus `[PERLU KONFIRMASI]` dan tidak dibuat dalam laporan ini.

### 2.3.5 Integrasi Model AI

Integrasi AI dibangun dengan tiga prinsip yang dapat diperiksa pada kode.

**Prinsip pertama: klien minimal.** `lib/ai/groq.ts` memakai `fetch` bawaan alih-alih menambah
pustaka SDK, dengan alasan menghindari penyedia kedua di dalam satu berkas. Berkas yang sama
menyatakan bahwa Groq tidak menyediakan layanan embedding, sehingga klien embedding tetap
terpisah.

**Prinsip kedua: penjaga anggaran yang nyata.** Komentar pada `lib/ai/call-budget.ts` menyatakan
alasan yang jelas: penghitung yang hanya diperiksa di dalam pengujian tidak membuktikan apa pun.
Karena itu penjaga dibuat sebagai objek yang membungkus setiap panggilan dan melempar kesalahan
sebelum panggilan keempat mencapai jaringan.

**Prinsip ketiga: jalur cadangan yang berfungsi.** Mode cadangan bukan sekadar penanganan
kesalahan, melainkan kondisi yang dapat dipilih pengguna untuk ditunjukkan saat demonstrasi.
Pada mode ini K bernilai 0 dan bobot lain disesuaikan agar totalnya tetap 1,00.

**Pemisahan penyedia.** Sistem memakai dua penyedia layanan yang berbeda dan tidak boleh
tertukar. Layanan embedding yang dipakai berasal dari keluarga model Gemini, yang dirancang
sebagai keluarga model multimodal dengan beragam ukuran (Gemini Team, 2024). Rincian peran setiap
penyedia adalah sebagai berikut:

| Peran | Penyedia | Bukti |
|---|---|---|
| Model teks (analisis dan penjelasan) | **Groq** | `lib/ai/analyze-task.ts` memanggil `groqChat` dengan `GROQ_MODEL_TEXT`; `lib/ai/explain.ts` sama |
| Embedding | **Gemini** | `lib/ai/analyze-task.ts` membuat klien Gemini untuk embedding dengan `GEMINI_MODEL_EMBED` dan `outputDimensionality: 768` |

### 2.3.6 Keamanan dan Validasi

**Validasi masukan.** Data yang masuk divalidasi sebelum dipakai. Perubahan profil anggota
dilakukan secara atomik melalui fungsi basis data tersendiri, sesuai migrasi
`005_atomic_update_member_profile.sql`, dan akses ke fungsi tersebut dibatasi sesuai migrasi
`006_restrict_member_profile_rpc.sql`.

**Validasi keluaran AI.** Keluaran model tidak dipakai mentah. Nilai embedding diperiksa
panjangnya harus tepat 768 dan seluruh elemennya harus berupa bilangan yang sahih, melalui
`isValidEmbeddingValues` pada `lib/ai/embedding-cache.ts`. Vektor yang tidak memenuhi syarat
ditolak. Untuk keluaran analisis tugas, hasilnya harus berupa struktur data yang sesuai sebelum
dapat dipakai sebagai masukan rumus skor.

**Batas anggaran sebagai kendali biaya.** Batas tiga panggilan sekaligus berfungsi sebagai
kendali biaya dan pencegahan penyalahgunaan. Tanpa batas ini, satu permintaan yang cacat dapat
memicu panggilan berulang.

**Celah keamanan yang diakui.** Seperti dinyatakan pada §2.3.4, kebijakan RLS yang mengizinkan
seluruh akses berarti lapisan basis data tidak menjadi garis pertahanan. Siapa pun yang
memperoleh kunci layanan dapat membaca dan mengubah seluruh data. Ini adalah keterbatasan yang
harus ditutup sebelum sistem dipakai di luar lingkungan demonstrasi.

## 2.4 Dataset

### 2.4.1 Sumber Data

Seluruh data evaluasi bersifat **sintetis**. Data dibangkitkan untuk menguji perilaku sistem pada
kondisi yang telah ditentukan, bukan dikumpulkan dari kelompok mahasiswa yang nyata. Tidak ada
responden, tidak ada kuesioner, dan tidak ada data lapangan. Pernyataan ini perlu ditegaskan
karena pembaca dapat menyalahartikan istilah "skenario uji" sebagai kelompok nyata.

Rujukan terhadap ketentuan tugas perlu disebut dengan tepat. PRD v0.2 Bagian 13 merencanakan
tiga dataset: D1, D2, dan D3. Berkas yang benar-benar ada dan dipakai adalah D1 dan D2. D3 tidak
tersedia, sehingga tidak ada klaim yang bersandar pada data kelompok nyata.

### 2.4.2 Struktur Data

**D1** berisi daftar tugas dengan deskripsi dan kebutuhan keterampilan. Tujuannya menguji
kemampuan sistem menangani variasi panjang deskripsi dan jumlah keterampilan.

**D2** berisi skenario kelompok lengkap, yaitu kumpulan anggota beserta kapasitas, keterampilan,
dan minatnya, ditambah kumpulan tugas. Tujuannya menguji perilaku sistem ketika menghadapi
kondisi batas.

**Tabel 2.7 Ringkasan dataset D1 dan D2**

| Dataset | Isi | Jumlah | Keterangan |
|---|---|---|---|
| D1 | Tugas dengan deskripsi dan kebutuhan keterampilan | **26 tugas** | 11 template, 15 tugas non-IT, 11 domain, 10 keterampilan berbeda |
| D2 | Skenario kelompok lengkap | **20 skenario** | **49 anggota** dan **35 tugas** total |
| D3 | Data kelompok nyata | **Tidak ada** | `[TIDAK DITEMUKAN]` di repository |

Sumber: `eval/results/dataset_summary.json`.

Rincian D1 menunjukkan sebaran yang cukup beragam: panjang deskripsi terbagi menjadi 7 pendek,
12 sedang, dan 7 panjang; perkiraan usaha terbagi menjadi 6 rendah, 15 sedang, dan 5 tinggi;
jumlah keterampilan terbagi menjadi 4 tugas berketerampilan tunggal dan 22 berketerampilan
banyak. Rincian D2 mencakup 15 kondisi batas yang berbeda, sebagaimana ditunjukkan tabel berikut.

**Tabel 2.8 Distribusi kondisi D2**

| No | Kondisi yang dicakup | Tujuan pengujian |
|---|---|---|
| 1 | Beban awal tak seimbang | Memeriksa apakah sistem menyeimbangkan saat titik awal sudah timpang |
| 2 | Jam tersedia nol | Memeriksa perilaku R1 ketika anggota tidak dapat menerima tugas |
| 3 | Kapasitas rendah | Memeriksa dominasi aturan kapasitas |
| 4 | Kapasitas tinggi | Memeriksa apakah anggota berkapasitas besar menyerap terlalu banyak tugas |
| 5 | Minat berbeda | Memeriksa pengaruh M ketika keterampilan setara |
| 6 | Satu anggota sangat tinggi | Memeriksa apakah satu anggota mendominasi |
| 7 | Semua di bawah level 3 | Memeriksa jalur cadangan R3 beserta peringatannya |
| 8 | Keterampilan merata | Memeriksa perilaku ketika tidak ada pembeda |
| 9 | Keterampilan tidak cocok | Memeriksa perilaku ketika tidak ada anggota yang sesuai |
| 10 | Keterampilan wajib beragam | Memeriksa tugas dengan banyak kebutuhan |
| 11 | Keterampilan dan minat tinggi, kapasitas rendah | Memeriksa konflik antara kecocokan dan kapasitas |
| 12 | Tidak ada kandidat R2 | Memeriksa pengecualian R4 beserta peringatannya |
| 13 | Tugas bersaing | Memeriksa urutan prioritas dalam greedy |
| 14 | Tugas terkunci | Memeriksa R5 dan konfliknya dengan R2 |
| 15 | Tugas berusaha tinggi | Memeriksa dampak tugas besar terhadap pemerataan |

Sumber: `eval/results/dataset_summary.json`.

### 2.4.3 Pemisahan Data Sintetis dan Data Nyata

Pemisahan dinyatakan secara eksplisit agar tidak ada ambiguitas:

| Jenis data | Status | Dipakai dalam laporan |
|---|---|---|
| D1 (tugas sintetis) | Sintetis | Ya, sebagai masukan pengujian |
| D2 (skenario sintetis) | Sintetis | Ya, sebagai dasar seluruh angka evaluasi |
| D3 (kelompok nyata) | Tidak ada | Tidak, dan tidak ada klaim yang bersandar padanya |
| Data responden | Tidak ada | Tidak, tidak ada responden |
| Penilaian reviewer manusia | Belum ada | Tidak, berstatus BLOCKED |

### 2.4.4 Keterbatasan Dataset

Empat keterbatasan dataset perlu dinyatakan sebelum angka evaluasi dibaca.

**Pertama, ukuran sampel kecil.** Dua puluh skenario tidak cukup untuk menyimpulkan kinerja pada
populasi kelompok yang luas. Angka pada §2.6 adalah deskripsi perilaku pada seperangkat skenario
yang telah ditentukan, bukan estimasi populasi.

**Kedua, data disusun oleh pengembang.** Kondisi batas pada D2 ditentukan oleh pembuat sistem.
Ada risiko bahwa kondisi yang diuji adalah kondisi yang sudah dipikirkan oleh pembuat sistem,
sehingga perilaku di luar daftar tersebut belum teruji.

**Ketiga, deskripsi tugas sintetis cenderung lebih rapi** daripada deskripsi yang ditulis
pengguna sungguhan. Deskripsi nyata sering memuat singkatan, salah ketik, dan campuran bahasa
yang belum diuji.

**Keempat, tidak ada validasi dari manusia.** Tanpa penilai manusia, tidak dapat dinyatakan
bahwa rekomendasi sistem sesuai dengan penilaian orang yang berpengalaman membagi tugas. Status
instrumen penilaian sudah disiapkan, tetapi pengumpulannya berstatus BLOCKED.

## 2.5 Implementasi Teknis

### 2.5.1 Rumus Skor

Skor dihitung untuk setiap pasangan tugas dan anggota, lalu digabungkan dengan pembobotan:

```text
total = (wK x K) + (wS x S) + (wC x C) + (wM x M)
```

dengan bobot default wK = 0,40, wS = 0,30, wC = 0,20, dan wM = 0,10, sehingga totalnya 1,00.
Setiap komponen bernilai pada rentang 0 sampai 1, sehingga skor total juga berada pada rentang 0
sampai 1 dan dapat dibaca sebagai persentase kecocokan.

**Tabel 2.9 Variabel rumus skor dan rentang nilainya**

| Variabel | Nama | Rentang | Cara memperoleh |
|---|---|---|---|
| K | Kemiripan semantik | 0 sampai 1 | Cosine similarity dinormalisasi dengan batas 0,2 dan 0,8 |
| S | Kecocokan keterampilan | 0 sampai 1 | Rata-rata tingkat keterampilan dibagi tingkat maksimum 5 |
| C | Sisa kapasitas | 0 sampai 1 | Sisa kapasitas setelah tugas dibagi kapasitas awal |
| M | Minat | 0 sampai 1 | Rata-rata minat digeser dan dibagi rentang minat 1 sampai 5 |

Sumber: `lib/scoring/score.ts`, `lib/scoring/constants.ts`.

Penjelasan setiap komponen diberikan berikut.

**K (kemiripan semantik).** Dihitung dari cosine similarity antara vektor teks tugas dan vektor
teks profil anggota. Nilai mentah dipetakan dengan batas bawah 0,2 dan batas atas 0,8 seperti
dijelaskan pada §2.1.3. Pada mode cadangan, K ditetapkan 0 secara paksa.

**S (kecocokan keterampilan).** Dihitung sebagai rata-rata tingkat penguasaan anggota pada
seluruh keterampilan yang diminta tugas, dibagi tingkat maksimum 5. Bila tugas tidak memerlukan
keterampilan tertentu, S bernilai 1,00 karena tidak ada persyaratan yang gagal dipenuhi.

**C (sisa kapasitas).** Dihitung sebagai sisa kapasitas setelah beban berjalan ditambah perkiraan
usaha tugas, dibagi kapasitas awal. Bila sisa kapasitas negatif, C bernilai 0. Bila kapasitas
anggota nol, C juga bernilai 0.

**M (minat).** Dihitung sebagai rata-rata minat anggota pada keterampilan yang diminta tugas.
Nilai minat 1 sampai 5 dipetakan ke rentang 0 sampai 1 melalui penggeseran dan pembagian.
Bila anggota belum mengisi minat, dipakai nilai default 3 yang menghasilkan M sebesar 0,50.

Satu keputusan implementasi penting perlu dicatat. Pada versi sebelumnya, skor sebuah pasangan
ditetapkan 0 ketika anggota melanggar aturan R1 atau R2. Perilaku itu kemudian diubah, karena
mencampurkan dua pertanyaan yang berbeda, yaitu "seberapa cocok anggota ini" dan "apakah anggota
ini diizinkan". Akibatnya matriks skor menampilkan 0 persen pada pasangan yang sebenarnya
memiliki kecocokan tinggi, sementara alasan penolakannya tidak terlihat. Setelah perubahan,
skor tetap dihitung apa adanya, dan kelayakan disimpan terpisah sebagai penanda `isEligible`
beserta `warnings`. Pemisahan ini membuat antarmuka dapat menyatakan alasan penolakan secara
jujur, bukan menyamarkan penolakan sebagai kecocokan yang rendah.

### 2.5.2 Alasan Pemisahan Skor dan Kelayakan

Pemisahan pada §2.5.1 layak dijelaskan tersendiri karena memengaruhi seluruh pembacaan hasil.
Sebuah anggota dapat memiliki skor tertinggi tetapi tidak layak dipilih. Bila kedua informasi
itu digabung menjadi satu angka, pengguna kehilangan kemampuan membedakan antara "kurang cocok"
dan "tidak boleh". Pada konteks pembagian tugas, perbedaan itu penting: anggota yang tidak boleh
menerima tugas karena kapasitasnya habis perlu dijelaskan sebagai persoalan kapasitas, bukan
sebagai persoalan kemampuan.

### 2.5.3 Aturan R1 sampai R5

Lima aturan keras dipakai sebagai penyaring kandidat dan penjaga konsistensi. Aturan ini tidak
dapat dikalahkan oleh skor tinggi.

**Tabel 2.3 Aturan keras R1 sampai R5**

| Kode | Aturan | Rumus atau syarat | Perilaku bila dilanggar |
|---|---|---|---|
| R1 | Kapasitas tersedia | `capacity > 0` | Anggota tidak menjadi kandidat |
| R2 | Beban tidak melebihi batas | `(load + hours) <= ideal x 1,25` **dan** `(load + hours) <= capacity` | Anggota tidak menjadi kandidat |
| R3 | Kecocokan keterampilan | Ada minimal satu keterampilan wajib pada level 3 atau lebih | Bila tidak ada yang memenuhi, dipakai seluruh anggota **dengan peringatan** |
| R4 | Satu penanggung jawab | `assignmentsCount == 1` | Bila tidak ada kandidat R2, tugas boleh tanpa pemilik **dengan peringatan** |
| R5 | Tugas terkunci tidak berubah | `isLocked` | Pemilik tugas terkunci dipertahankan saat hitung ulang |

Sumber: `lib/scoring/rules.ts`, `lib/scoring/assign.ts`.

Penjelasan setiap aturan beserta alasan perancangannya diberikan berikut.

**R1, kapasitas tersedia.** Anggota dengan kapasitas nol tidak dapat menerima tugas apa pun
sebanyak apa pun minatnya. Aturan ini sederhana, tetapi menutup kasus yang secara logis tidak
mungkin dipenuhi, yaitu memberi tugas kepada orang yang tidak punya waktu.

**R2, batas beban.** Aturan ini menggabungkan dua syarat, yaitu beban baru tidak boleh melebihi
1,25 kali beban ideal dan tidak boleh melebihi kapasitas anggota. Penggabungan sengaja dilakukan
karena keduanya menjawab pertanyaan yang sama, yaitu apakah anggota masih dapat menerima tugas
ini tanpa kelebihan beban. Konsekuensi penggabungan perlu dicatat: kegagalan R2 tidak dapat
dipisahkan antara "melebihi batas pemerataan" dan "kapasitas habis" tanpa membaca rincian.

Beban ideal dihitung sebagai total perkiraan usaha seluruh tugas dibagi jumlah anggota. Faktor
1,25 memberi ruang toleransi sebesar 25 persen di atas beban ideal, sehingga sistem tidak
memaksa pemerataan yang kaku pada setiap tugas. Angka 1,25 adalah pilihan perancangan, bukan
hasil optimasi. Keterbatasan ini dinyatakan terbuka.

**R3, kecocokan keterampilan.** Aturan ini menyatakan bahwa bila ada anggota dengan minimal satu
keterampilan wajib pada level 3 atau lebih, hanya anggota tersebut yang menjadi kandidat.
Penerapannya memakai pemeriksaan `.some()`, artinya cukup satu keterampilan wajib yang memenuhi
level 3, bukan seluruhnya. Pilihan ini disengaja agar aturan tidak menjadi terlalu ketat pada
tugas yang membutuhkan banyak keterampilan.

Kasus ketika **tidak ada** anggota yang memenuhi perlu dijelaskan karena berbeda dari kasus
normal. Fungsi `checkR3` mengembalikan seluruh daftar anggota sebagai jalur cadangan, karena
sistem tetap diminta memberikan rekomendasi terbaik. Namun daftar cadangan itu **tidak boleh
dibaca** sebagai "semua anggota memenuhi R3". Karena itu disediakan fungsi `hasQualifiedMember`
yang membedakan antara R3 yang benar-benar terpenuhi dan R3 yang sedang memakai jalur cadangan.
Pemisahan ini berasal dari temuan audit: sebelumnya, anggota tanpa keterampilan pada level 3
tampil sebagai kandidat normal tanpa penjelasan. Setelah perbaikan, kondisi tersebut disertai
peringatan.

**R4, satu penanggung jawab.** Setiap tugas memiliki tepat satu penanggung jawab. Pengecualian
ditambahkan untuk kasus ketika tidak ada kandidat yang memenuhi R2. Pada kasus itu tugas boleh
berada tanpa pemilik, dan sistem wajib menampilkan peringatan `r2_no_candidate`. Pengecualian ini
dipilih alih-alih memaksakan penugasan, karena memaksakan penugasan akan menghasilkan pelanggaran
aturan yang tersembunyi.

**R5, tugas terkunci.** Tugas yang dikunci mempertahankan pemiliknya ketika perhitungan
diulang. Aturan ini ditegakkan secara struktural melalui pemetaan tugas terkunci, bukan melalui
pemanggilan `checkR5`. Alasan penegakan struktural adalah agar tugas terkunci tidak pernah
melewati jalur pemilihan kandidat, sehingga tidak ada kemungkinan pemiliknya berubah.

### 2.5.4 Konflik antara R2 dan R5

Konflik antara R2 dan R5 perlu dijelaskan karena keduanya dapat menghasilkan keadaan yang
bertentangan.

R5 menyatakan tugas terkunci tidak boleh berubah pemiliknya saat hitung ulang. R2 menyatakan
beban anggota tidak boleh melebihi batas. Persoalan muncul ketika sebuah tugas yang sudah
terkunci kepada seorang anggota membuat beban anggota tersebut melampaui batas R2. Dalam keadaan
itu, dua aturan tidak dapat dipenuhi sekaligus: mempertahankan pemilik berarti melanggar R2,
sedangkan mematuhi R2 berarti melanggar R5.

Keputusan yang diambil adalah **R5 diutamakan**, dengan alasan yang dapat diperiksa. Tugas
terkunci mencerminkan keputusan pengguna yang bersifat sengaja, misalnya karena anggota tersebut
sudah terlanjur mengerjakan bagian itu. Mengubahnya secara diam-diam akan melanggar maksud
pengguna. Karena itu tugas tetap dipertahankan, dan sistem mengeluarkan peringatan
`r2_locked_overload` yang menyebutkan nama anggota, besarnya beban, dan batas ideal yang
dilampaui.

Konsekuensi dari keputusan ini penting untuk pembacaan hasil evaluasi. **Jumlah pelanggaran R2
pada hasil akhir tidak sama dengan jumlah pelanggaran yang disebabkan sistem.** Sebagian
pelanggaran berasal dari tugas terkunci yang dipertahankan secara sengaja. Angka R2 karena itu
harus dibaca bersama peringatan yang menyertainya, bukan sebagai angka tunggal yang
menyimpulkan kegagalan sistem.

### 2.5.5 Mode Fallback

Mode cadangan adalah kondisi ketika layanan AI tidak dipakai. Mode ini dapat aktif karena tiga
sebab: pengguna memilihnya secara sengaja, kunci API tidak tersedia, atau pemanggilan gagal.

Pada mode ini berlaku ketentuan berikut.

1. Komponen K ditetapkan 0, karena tidak ada embedding yang dihitung.
2. Bobot disesuaikan menjadi wS = 0,50, wC = 0,33, dan wM = 0,17, sehingga total tetap 1,00.
3. Penjelasan tetap diberikan melalui fungsi deterministik `generateExplanation`.
4. Seluruh aturan R1 sampai R5 tetap berlaku.

Poin kedua memiliki alasan yang jelas. Bila bobot tidak disesuaikan, total bobot akan menjadi
0,60 sehingga skor maksimum hanya 0,60 dan tidak dapat dibandingkan dengan mode normal. Dengan
penyesuaian, skor pada mode cadangan tetap berada pada skala 0 sampai 1.

Poin ketiga menunjukkan bahwa sistem tetap berguna tanpa AI. Pengguna masih memperoleh saran
beserta rincian skor dan alasan yang dapat dihitung. Yang hilang hanyalah komponen kemiripan
semantik dan kehalusan bahasa penjelasan.

### 2.5.6 Batas Pemanggilan AI

Batas tiga panggilan per proses rekomendasi ditegakkan oleh objek penjaga, bukan oleh konvensi.
Setiap panggilan dicatat jenisnya, modelnya, jumlah token, dan durasinya. Ketika panggilan
keempat dicoba, `CallBudgetExceededError` dilempar sebelum permintaan mencapai jaringan. Setelah
proses selesai, jumlah panggilan diperiksa sekali lagi dan kesalahan dilaporkan bila melebihi
batas.

Batas ini menutup satu pola kegagalan yang lazim, yaitu percobaan ulang berulang ketika layanan
luar gagal. Tanpa batas, satu permintaan yang bermasalah dapat menghasilkan puluhan panggilan.

### 2.5.7 Mekanisme Penjelasan Rekomendasi

Penjelasan diberikan pada dua lapis, sebagaimana disebut pada §2.2.4.

Lapis deterministik menghasilkan kalimat yang menyebut keterampilan yang cocok dan persentase
skor kesesuaian. Kalimat ini dibentuk dari data yang sudah ada pada perhitungan, sehingga tidak
mungkin memuat informasi yang tidak dimasukkan pengguna. Kelemahannya, kalimatnya berpola tetap
dan terasa monoton ketika diulang untuk banyak tugas.

Lapis generatif menyusun kalimat yang lebih mengalir melalui model teks, memakai satu panggilan
dari anggaran. Penjelasan generatif tetap dibatasi pada data yang dimasukkan pengguna. Bila
pemanggilan gagal, sistem kembali ke lapis deterministik tanpa menghentikan proses rekomendasi.

Pilihan menyediakan lapis deterministik lebih dahulu, lalu menambahkan lapis generatif sebagai
penyempurnaan, diambil karena penjelasan yang dapat dipercaya bukan yang paling indah, melainkan
yang paling dapat diperiksa (Miller, 2019). Kalimat yang menyebut angka dan keterampilan tertentu
lebih mudah diverifikasi daripada kalimat yang hanya menyatakan kesan umum.

## 2.6 Pengujian dan Evaluasi

### 2.6.1 Metode Pengujian

Pengujian dilakukan pada tiga tingkat yang berbeda tujuannya.

**Tingkat pertama, pengujian unit dan integrasi.** Sebanyak 29 berkas uji dijalankan dengan
Vitest. Pengujian ini memeriksa kebenaran fungsi secara terpisah dan memeriksa keterpaduan antar
komponen.

**Tingkat kedua, pengujian aturan keras.** Sebanyak 15 kasus uji disusun khusus untuk R1 sampai
R5, masing-masing dengan kasus normal dan kasus batas.

**Tingkat ketiga, evaluasi perbandingan metode.** Empat metode dijalankan pada 20 skenario D2
yang sama, lalu hasilnya dibandingkan pada lima dimensi yang diuraikan pada §2.1.6.

Selain ketiga tingkat tersebut, dilakukan pengukuran waktu komputasi dan ablation study untuk
mengetahui kontribusi komponen K.

Terdapat juga berkas uji yang memerlukan layanan AI langsung, yaitu
`test/ai/gemini-models.live.test.ts` dan `test/ai/groq.live.test.ts`. Kedua berkas ini **tidak**
menguji logika sistem, melainkan ketersediaan model pada akun yang dipakai. Statusnya dibahas
pada §2.6.5.

### 2.6.2 Skenario dan Metrik

Empat metode yang dibandingkan adalah:

1. **Hybrid**, yaitu metode yang diusulkan pada laporan ini.
2. **Random**, yaitu pemilihan acak di antara kandidat. Metode ini dijalankan 600 kali untuk
   memperoleh sebaran yang stabil.
3. **Round-robin**, yaitu pembagian bergiliran antar-anggota tanpa memperhatikan kecocokan.
4. **Manual**, yaitu pembagian yang meniru cara informal, yakni berbasis kesepakatan sederhana.

Lima metrik yang diukur adalah:

| Metrik | Arti | Arah yang lebih baik |
|---|---|---|
| Cakupan keterampilan | Proporsi kebutuhan keterampilan yang terpenuhi | Lebih tinggi lebih baik |
| Simpangan baku beban | Sebaran beban antar-anggota | Lebih rendah lebih baik |
| Rata-rata kecocokan | Rata-rata skor pasangan tugas dan anggota | Lebih tinggi lebih baik |
| Pelanggaran aturan | Jumlah pelanggaran R1, R2, dan R3 | Lebih rendah lebih baik |
| Perubahan manual | Berapa kali hasil perlu diperbaiki | Lebih rendah lebih baik |

### 2.6.3 Hasil Empat Metode Pembanding

**Tabel 2.11 Hasil empat metode pembanding**

| Metrik | Hybrid | Random | Round-robin | Manual |
|---|---|---|---|---|
| Jumlah percobaan | 20 | 600 | 20 | 20 |
| Cakupan keterampilan (rata-rata) | **0,8083** | 0,7539 | **0,8083** | **0,8667** |
| Simpangan baku beban (rata-rata) | 5,616 | 5,296 | **3,876** | 5,616 |
| Rata-rata kecocokan | 0,645 | 0,585 | **0,674** | 0,668 |
| Pelanggaran R1 | **0** | 31 | 2 | 2 |
| Pelanggaran R2 (akhir) | 24 | 752 | **18** | 24 |
| Pelanggaran R3 | **1** | 147 | 4 | **0** |
| Perubahan manual | **1** | 178 | 6 | 2 |

Sumber: `eval/results/methods_summary.json`. Angka dibaca langsung dari artefak tanpa pembulatan
yang mengubah urutan.

### 2.6.4 Interpretasi Hasil

Bagian ini membaca tabel di atas tanpa menyimpulkan pemenang tunggal, karena data memang tidak
mendukung kesimpulan semacam itu.

**Hybrid tidak unggul pada kualitas kecocokan.** Rata-rata kecocokan hybrid adalah 0,645,
sedangkan round-robin mencapai 0,674 dan manual mencapai 0,668. Kedua metode pembanding itu
unggul pada metrik ini. Menyatakan hybrid paling baik pada kecocokan akan bertentangan dengan
data.

**Hybrid tidak unggul pada pemerataan beban.** Simpangan baku beban hybrid adalah 5,616,
sedangkan round-robin mencapai 3,876. Round-robin jauh lebih merata. Penyebabnya dapat
dijelaskan: round-robin membagi tugas secara bergiliran sehingga jumlah tugas per anggota hampir
sama, sedangkan hybrid memilih berdasarkan skor sehingga anggota yang lebih cocok dapat menerima
lebih banyak tugas selama masih memenuhi batas R2.

**Hybrid unggul pada kepatuhan aturan R1 dan R3.** Hybrid mencatat **nol** pelanggaran R1,
sedangkan random mencatat 31, round-robin 2, dan manual 2. Pada R3, hybrid mencatat 1
pelanggaran, jauh di bawah random yang mencatat 147. Ini adalah keunggulan yang nyata dan
konsisten dengan rancangan: aturan R1 dan R3 diterapkan sebagai penyaring kandidat sebelum skor
dihitung, sehingga pelanggaran hanya mungkin muncul pada kasus batas yang memang ditangani
dengan jalur cadangan.

**Hybrid unggul paling jelas pada beban perubahan manual.** Hybrid memerlukan **1** perubahan
manual, sedangkan random memerlukan 178, round-robin 6, dan manual 2. Ini adalah temuan yang
paling relevan secara praktis. Pengguna sistem tidak menginginkan saran yang harus diperbaiki
berkali-kali. Angka 1 menunjukkan bahwa saran sistem hampir selalu dapat diterima apa adanya.

**Perubahan manual unggul pada R3 dengan nol pelanggaran**, sedangkan hybrid mencatat 1. Ini
perlu dinyatakan agar tidak terjadi pemilihan angka secara selektif. Keunggulan manual pada R3
dapat dijelaskan: pembagian manual cenderung memberikan tugas kepada anggota yang sudah dikenal
memiliki keterampilan sesuai, sehingga pelanggaran R3 jarang terjadi. Namun manual tetap mencatat
2 pelanggaran R1 dan 24 pelanggaran R2, lebih banyak daripada hybrid pada R1.

**Pelanggaran R2 perlu dibaca dengan hati-hati.** Hybrid mencatat 24 pelanggaran R2 pada hasil
akhir, sedangkan round-robin mencatat 18. Pada pandangan pertama ini tampak sebagai kelemahan
hybrid. Namun angka tersebut perlu dibaca bersama §2.5.4: sebagian pelanggaran berasal dari tugas
terkunci yang memang sengaja dipertahankan demi mematuhi R5. Angka R2 tidak dapat dipisahkan dari
peringatan `r2_locked_overload` yang menyertainya. Tanpa memisahkan kedua sumber tersebut,
perbandingan R2 antar-metode tidak sepenuhnya setara.

**Tabel 2.12 Peringkat per metrik tanpa menyimpulkan pemenang tunggal**

| Metrik | Terbaik | Kedua | Ketiga | Keempat |
|---|---|---|---|---|
| Cakupan keterampilan | Manual (0,8667) | Hybrid dan Round-robin (0,8083) | | Random (0,7539) |
| Simpangan baku beban | Round-robin (3,876) | Random (5,296) | Hybrid dan Manual (5,616) | |
| Rata-rata kecocokan | Round-robin (0,674) | Manual (0,668) | Hybrid (0,645) | Random (0,585) |
| Pelanggaran R1 | **Hybrid (0)** | Round-robin dan Manual (2) | | Random (31) |
| Pelanggaran R2 | Round-robin (18) | Hybrid dan Manual (24) | | Random (752) |
| Pelanggaran R3 | **Manual (0)** | Hybrid (1) | Round-robin (4) | Random (147) |
| Perubahan manual | **Hybrid (1)** | Manual (2) | Round-robin (6) | Random (178) |

Sumber: diolah dari `eval/results/methods_summary.json`.

Kesimpulan yang dapat dipertanggungjawabkan adalah sebagai berikut. **Tidak ada satu metode yang
unggul pada seluruh metrik.** Hybrid menang pada kepatuhan R1, kepatuhan R3 dibanding random dan
round-robin, dan beban perubahan manual. Round-robin menang pada pemerataan beban dan rata-rata
kecocokan. Manual menang pada cakupan keterampilan dan pelanggaran R3. Random paling buruk pada
hampir semua metrik, sehingga dapat disimpulkan acak bukan pilihan yang wajar.

Pembacaan yang tepat bergantung pada tujuan yang dipentingkan. Bila tujuan utamanya pemerataan
beban, round-robin lebih baik. Bila tujuan utamanya saran yang dapat langsung dipakai tanpa
perbaikan, hybrid lebih baik. Bila tujuan utamanya cakupan keterampilan, manual lebih baik pada
data ini.

Perlu dicatat bahwa keunggulan manual pada cakupan keterampilan dan R3 memiliki penjelasan yang
melemahkan klaim keunggulan tersebut. Metode manual pada evaluasi ini dibangun dengan
pengetahuan tentang skenario, sehingga hasilnya mencerminkan pengetahuan tersebut. Pada
penggunaan nyata, pembagian manual justru menjadi persoalan yang ingin diperbaiki menurut
§1.1. Karena itu keunggulan manual pada dua metrik tersebut tidak dapat dipakai untuk
menyimpulkan bahwa cara manual lebih baik secara umum.

### 2.6.5 Ablation Study

Ablation study bertujuan mengetahui seberapa besar kontribusi komponen K terhadap hasil akhir.
Caranya adalah membandingkan hasil dengan K dan hasil tanpa K pada 20 skenario yang sama.

**Tabel 2.13 Hasil ablation study**

| Ukuran | Nilai | Keterangan |
|---|---|---|
| Skenario | 20 | Sama dengan evaluasi metode |
| Total tugas | 35 | |
| Tugas yang berganti penanggung jawab | **9** | Proporsi 0,2571 |
| Perubahan cakupan keterampilan (rata-rata) | **0** | Tidak ada perubahan |
| Perubahan simpangan baku beban (rata-rata) | **-0,2018** | Sedikit lebih merata tanpa K |
| Perubahan kecocokan (rata-rata) | **-0,0267** | Sedikit lebih tinggi tanpa K |
| Ablation dengan embedding live | **BLOCKED** | Tidak dijalankan |

Sumber: `eval/results/ablation.json`.

**Batas penting dari hasil ini perlu dinyatakan lebih dahulu.** Pada ablation ini, komponen K
memakai **proksi deterministik**, bukan embedding live. Artinya nilai K dihitung dari prosedur
yang hasilnya selalu sama untuk masukan yang sama, bukan dari pemanggilan layanan embedding.
Berkas hasil mencatat `liveAblation: "BLOCKED"` secara eksplisit. Karena itu, ablation ini
mengukur pengaruh **keberadaan komponen K dalam rumus**, bukan kualitas embedding yang sebenarnya
dipakai sistem.

Dengan batas tersebut, hasilnya dapat dibaca sebagai berikut.

**K tidak memengaruhi cakupan keterampilan sama sekali** pada data ini, karena perubahan
rata-ratanya nol. Penjelasan yang mungkin adalah cakupan keterampilan ditentukan oleh komponen S
dan aturan R3, bukan oleh K. Temuan ini masuk akal mengingat R3 menyaring kandidat berdasarkan
keterampilan terlebih dahulu.

**Melepas K membuat beban sedikit lebih merata** dengan perubahan simpangan baku sebesar -0,2018.
Tanda negatif berarti simpangan baku menurun ketika K dilepas. Ini bertentangan dengan harapan
naif bahwa menambah informasi akan selalu memperbaiki hasil. Penjelasannya, K cenderung memusatkan
pilihan pada anggota yang teksnya paling mirip, sehingga beban menjadi kurang merata. Besaran
perubahan ini kecil sehingga tidak layak dijadikan dasar keputusan.

**Melepas K membuat kecocokan sedikit lebih tinggi** dengan perubahan -0,0267. Tanda negatif pada
kolom perubahan berarti nilai tanpa K lebih tinggi. Sekali lagi arahnya berlawanan dengan
harapan, dan besarannya kecil.

**Sebanyak 9 dari 35 tugas berganti penanggung jawab** ketika K dilepas, atau sekitar 25,7
persen. Angka ini menunjukkan K memang memengaruhi keputusan pada sebagian tugas, meskipun
pengaruh bersihnya terhadap metrik agregat kecil.

Kesimpulan yang dapat dipertanggungjawabkan: **kontribusi K terhadap metrik agregat kecil pada
data ini, dan arahnya tidak selalu memperbaiki.** Klaim bahwa embedding semantik meningkatkan
kualitas rekomendasi **tidak didukung** oleh ablation ini. Klaim yang lebih tepat adalah bahwa K
mengubah pilihan pada sebagian tugas tanpa perbaikan agregat yang terukur. Ablation dengan
embedding live masih diperlukan sebelum kesimpulan yang lebih kuat dapat dibuat.

### 2.6.6 Kinerja Sistem

Pengukuran waktu dipisahkan menjadi dua kelas agar tidak tertukar: komputasi murni di dalam
proses, dan waktu yang melibatkan jaringan atau basis data.

**Tabel 2.14 Waktu komputasi pipeline dan komponen interaktif**

| Ukuran | n | min (ms) | median (ms) | p95 (ms) | max (ms) |
|---|---|---|---|---|---|
| Pipeline penugasan, 20 skenario | 50 | 0,197 | **0,285** | **0,465** | 1,888 |
| Pipeline penugasan, 1 skenario | 50 | 0,016 | 0,017 | 0,025 | 0,051 |
| What-if (hitung ulang setelah pindah tugas) | 50 | 0,005 | 0,009 | 0,026 | 0,231 |
| **Slider recompute** | 50 | 0,003 | **0,005** | 0,027 | 0,184 |
| Swap | 50 | 0 | 0 | 0,010 | 0,111 |

Sumber: `eval/results/performance.json`.

**Catatan perbedaan angka.** Berkas laporan `eval/reports/L_PERFORMANCE.md` yang dibuat lebih
dahulu mencatat median 0,332 ms dan p95 0,493 ms untuk pipeline 20 skenario. Berkas
`eval/results/performance.json` yang lebih baru mencatat median 0,285 ms dan p95 0,465 ms. Laporan
ini memakai angka dari berkas JSON karena lebih baru, dan mencatat perbedaannya di sini alih-alih
memilih angka yang lebih menguntungkan.

Angka di atas hanya mencakup komputasi. Waktu yang dirasakan pengguna pada alur lengkap berbeda,
karena melibatkan beberapa perjalanan ke basis data. Laporan pengukuran sebelumnya mencatat
respons `POST /api/recommend` berada pada rentang 2,14 sampai 3,48 detik dari tiga sampel, dengan
median satu perjalanan ke Supabase sekitar 279 ms. Angka tersebut berasal dari
`eval/reports/L_PERFORMANCE.md` dan tidak diukur ulang pada pekerjaan ini.

Pembacaan yang benar atas kedua kelas pengukuran adalah sebagai berikut. **Algoritma sangat
cepat**, dengan p95 pipeline jauh di bawah 1 milidetik. **Penggeseran bobot tidak memerlukan
jaringan**, sehingga terasa seketika. Namun **alur lengkap tidak berada di bawah 1 detik**, dan
penyebabnya bukan algoritma melainkan latensi basis data. Menjumlahkan kedua kelas pengukuran
menjadi satu klaim "sistem merespons di bawah 1 detik" adalah kesalahan pembacaan.

### 2.6.7 Keterbatasan dan Ancaman Validitas

**Tabel 2.17 Ancaman validitas dan mitigasinya**

| Jenis ancaman | Uraian | Mitigasi yang dilakukan | Sisa risiko |
|---|---|---|---|
| Validitas internal | Data uji disusun oleh pembuat sistem | 15 kondisi batas dinyatakan terbuka pada §2.4.2 | Kondisi di luar daftar belum teruji |
| Validitas eksternal | Hanya 20 skenario sintetis | Ukuran sampel dilaporkan apa adanya | Tidak dapat digeneralisasi ke populasi |
| Validitas konstruk | Metrik keterampilan diukur dari level 1 sampai 5 yang diisi sendiri | Lima dimensi dilaporkan terpisah | Level keterampilan tidak divalidasi pihak lain |
| Validitas kesimpulan | Perbandingan R2 tidak setara karena tugas terkunci | Konflik R2 dan R5 dijelaskan pada §2.5.4 | Pemisahan sumber pelanggaran belum dilakukan |
| Validitas ablation | K memakai proksi deterministik | Status BLOCKED dinyatakan terbuka | Kontribusi embedding nyata belum diketahui |
| Keamanan | Kebijakan RLS mengizinkan seluruh akses | Celah dinyatakan terbuka pada §2.3.4 | Belum diperbaiki |
| Kualitas rekomendasi | Tidak ada penilai manusia | Instrumen penilaian sudah disiapkan | BLOCKED, tidak ada klaim kualitas menurut manusia |
| Optimalitas | Greedy tidak menjamin solusi optimal | Dinyatakan pada §2.1.5 | Tidak diukur selisih terhadap solusi optimal |

Keterbatasan yang paling penting untuk diingat pembaca adalah **ketiadaan penilaian manusia**.
Seluruh angka pada §2.6 mengukur sifat internal sistem, bukan kesesuaiannya dengan penilaian orang
yang berpengalaman. Sistem dapat saja konsisten dan patuh aturan, tetapi tetap menghasilkan saran
yang tidak disetujui pengguna. Tanpa tiga penilai manusia, pertanyaan itu tidak dapat dijawab.

Keterbatasan kedua adalah **status pengujian yang belum menyeluruh**. Dari 29 berkas uji, dua
berkas memerlukan layanan AI langsung dan keduanya gagal pada lingkungan pengujian ini. Kegagalan
tersebut bersifat lingkungan, bukan logika, dan dijelaskan pada §2.6.8. Namun kegagalan itu tetap
berarti integrasi dengan penyedia layanan belum terverifikasi penuh pada pekerjaan ini.

Keterbatasan ketiga adalah **penerapan sistem yang belum diverifikasi**. Tidak ada bukti bahwa
migrasi basis data telah diterapkan pada proyek Supabase nyata, dan tidak ada bukti pengujian pada
lingkungan produksi. Pernyataan bahwa aplikasi berjalan pada lingkungan nyata karenanya tidak
dibuat.

### 2.6.8 Hasil Pengujian Otomatis

**Tabel 2.15 Hasil pengujian unit dan integrasi**

| Ukuran | Hasil |
|---|---|
| Berkas uji | 29 |
| Berkas uji lulus | 27 |
| Berkas uji gagal | 2 |
| Tes lulus | **373** |
| Tes gagal | **4** |
| Perintah | `npm test` |

Sumber: keluaran `npm test` pada pekerjaan ini.

Keempat tes yang gagal seluruhnya berada pada dua berkas uji yang memerlukan layanan AI langsung:

| Berkas | Tes yang gagal | Penyebab |
|---|---|---|
| `test/ai/gemini-models.live.test.ts` | Daftar model dan konfirmasi model teks; keluaran JSON analisis | Konfigurasi model teks pada `.env.local` menunjuk nama model yang tidak valid |
| `test/ai/groq.live.test.ts` | Konfirmasi model pada akun; percakapan JSON-mode | Layanan Groq menolak validasi JSON pada permintaan uji |

Perlu dicatat bahwa jumlah tes gagal sempat terbaca 3 pada satu kali penjalanan, karena satu tes
Groq berhasil secara bergantian. Angka yang dilaporkan, yaitu 373 lulus dan 4 gagal, adalah hasil
yang paling sering muncul dan sesuai dengan catatan dasar sebelumnya.

Penting untuk tidak menyalahtafsirkan hasil ini. Keempat kegagalan **bukan** kegagalan logika
penilaian, aturan, atau penugasan. Tes untuk ketiga hal tersebut lulus seluruhnya. Kegagalan
berada pada pemeriksaan ketersediaan layanan luar.

### 2.6.9 Hasil Pengujian Aturan Keras

**Tabel 2.10 Kasus uji aturan keras dan hasilnya**

| Aturan | Jumlah kasus | Lulus | Gagal | Jenis kasus |
|---|---|---|---|---|
| R1 | 3 | 3 | 0 | 1 normal, 2 batas |
| R2 | 3 | 3 | 0 | 1 normal, 2 batas |
| R3 | 4 | 4 | 0 | 1 normal, 3 batas |
| R4 | 2 | 2 | 0 | 1 normal, 1 batas |
| R5 | 3 | 3 | 0 | 1 normal, 2 batas |
| **Total** | **15** | **15** | **0** | |

Sumber: `eval/results/hard_rules.json`.

Seluruh 15 kasus lulus. Namun ada dua perilaku batas yang perlu dicatat secara terbuka meskipun
dinyatakan lulus, karena "lulus" di sini berarti "berperilaku seperti yang dirancang", bukan
"berperilaku ideal".

**Pertama, kasus semua anggota berkapasitas nol.** Ketika seluruh anggota berkapasitas nol,
tidak ada kandidat yang sah menurut R1. Mesin tetap menugaskan tugas kepada seorang anggota.
Perilaku ini tercatat pada hasil pengujian dengan keterangan bahwa mesin tetap menugaskan.
Keadaan ini tidak dapat dihindari tanpa membiarkan tugas tanpa pemilik, tetapi perlu diketahui.

**Kedua, kasus tidak ada kandidat yang memenuhi R2.** Mesin menempuh jalur pemilihan terbaik
mutlak sehingga tugas tetap memperoleh penanggung jawab meskipun R2 gagal. Perilaku ini konsisten
dengan kode, tetapi tidak didefinisikan secara eksplisit pada rancangan awal. Setelah perbaikan
berdasarkan temuan audit, keadaan ini disertai peringatan `r2_no_candidate`.

### 2.6.10 Status Target PRD

**Tabel 2.16 Status target PRD dan pencapaiannya**

| Target | Ambang | Hasil | Status |
|---|---|---|---|
| Proses tanpa AI | di bawah 1000 ms | p95 pipeline 0,465 ms | **Terpenuhi** pada tingkat komputasi |
| Slider | di bawah 100 ms | p95 0,027 ms | **Terpenuhi** |
| What-if | di bawah 100 ms | p95 0,026 ms | **Terpenuhi** |
| Slider dan what-if tanpa permintaan jaringan | 0 permintaan | 0 permintaan | **Terpenuhi** |
| Respons alur lengkap | di bawah 1 detik | 2,14 sampai 3,48 detik | **Tidak terpenuhi**, didominasi latensi basis data |
| Batas panggilan AI | maksimal 3 per proses | Ditegakkan oleh penjaga anggaran | **Terpenuhi** |
| Kesepakatan penilai manusia | Terukur | Belum ada penilai | **BLOCKED** |
| Minimal 10 artikel ilmiah | 10 | 16 artikel peer-reviewed (13 jurnal + 3 prosiding) | **Terpenuhi** |

Sumber: `eval/results/performance.json`, `eval/results/hard_rules.json`,
`eval/reports/G_HUMAN_AGREEMENT.md`, `docs/laporan/01_VERIFIKASI_REFERENSI.md`.

Tabel ini sengaja memuat baris yang tidak terpenuhi dan baris yang BLOCKED. Laporan yang hanya
menampilkan target tercapai tidak memberi gambaran yang dapat dipakai untuk perbaikan.

---

# BAB III PENUTUP

## 3.1 Kesimpulan

Kesimpulan disusun untuk menjawab setiap rumusan masalah pada §1.2, dan setiap jawaban
disandarkan pada bukti yang telah dinyatakan pada Bab II.

**Tabel 3.1 Rumusan masalah dan jawabannya**

| No | Rumusan masalah | Jawaban | Bukti |
|---|---|---|---|
| 1 | Bagaimana merancang sistem rekomendasi berbasis kecocokan keterampilan, kapasitas, minat, dan kemiripan semantik? | Dirancang sistem hybrid dengan rumus `0,40K + 0,30S + 0,20C + 0,10M`, ditambah lima aturan keras sebagai penyaring | §2.5.1, §2.5.3, `lib/scoring/score.ts` |
| 2 | Bagaimana memastikan keputusan dapat dihitung ulang dan transparan? | Keputusan akhir diambil fungsi TypeScript murni yang deterministik; AI hanya dipakai untuk analisis teks, embedding, dan penjelasan. Rincian skor ditampilkan dan penggeseran bobot tidak memerlukan jaringan | §2.2.5, §2.6.6 |
| 3 | Bagaimana menegakkan aturan keras R1 sampai R5? | Kelima aturan diterapkan sebagai penyaring kandidat dan penjaga konsistensi; 15 kasus uji aturan lulus seluruhnya, dengan dua perilaku batas yang dinyatakan terbuka | §2.5.3, §2.6.9 |
| 4 | Bagaimana kinerja hybrid dibandingkan random, round-robin, dan manual? | Hybrid unggul pada R1 (0 pelanggaran), R3 dibanding random dan round-robin, serta beban perubahan manual (1 berbanding 178, 6, dan 2). Hybrid **tidak** unggul pada kecocokan maupun pemerataan beban | §2.6.3, §2.6.4 |
| 5 | Sejauh mana batasan pendekatan yang dipakai? | Data sintetis, tanpa penilai manusia, ablation memakai proksi, penerapan basis data belum diverifikasi, kebijakan RLS tidak membatasi akses | §1.4.2, §2.6.7 |

Kesimpulan yang lebih terperinci disusun sebagai berikut.

**Pertama, pemisahan lapisan AI dan lapisan keputusan berhasil diwujudkan dan memberi manfaat
yang dapat diperiksa.** Seluruh perhitungan skor, seluruh aturan keras, dan seluruh proses
penugasan berada pada fungsi TypeScript murni. Konsekuensinya terukur: p95 pipeline berada pada
0,465 ms untuk 20 skenario, dan penggeseran bobot berjalan tanpa satu pun permintaan jaringan.
Sifat ini berbeda dari sistem yang menyerahkan keputusan kepada model bahasa, yang hasilnya
sulit dihitung ulang.

**Kedua, pendekatan hybrid tidak unggul secara keseluruhan.** Hybrid unggul pada kepatuhan
aturan R1, pada kepatuhan R3 dibanding dua metode, dan pada beban perubahan manual. Namun hybrid
kalah dari round-robin pada pemerataan beban (5,616 berbanding 3,876) dan pada rata-rata
kecocokan (0,645 berbanding 0,674). Hybrid juga kalah dari manual pada cakupan keterampilan
(0,8083 berbanding 0,8667) dan pada pelanggaran R3 (1 berbanding 0). Kesimpulan yang jujur adalah
bahwa **pilihan metode bergantung pada tujuan yang dipentingkan**, bukan bahwa hybrid paling
baik.

**Ketiga, keunggulan hybrid yang paling relevan secara praktis adalah beban perubahan manual.**
Nilai 1 berbanding 178 pada random, 6 pada round-robin, dan 2 pada manual menunjukkan bahwa saran
sistem hampir selalu dapat diterima tanpa perbaikan. Bagi pengguna yang ingin menghemat waktu
pembagian tugas, ini adalah manfaat yang lebih terasa daripada selisih kecil pada rata-rata
kecocokan.

**Keempat, kontribusi komponen K tidak terbukti meningkatkan kualitas.** Ablation menunjukkan
perubahan cakupan sebesar nol, perubahan simpangan baku sebesar -0,2018, dan perubahan kecocokan
sebesar -0,0267, dengan 9 dari 35 tugas berganti pemilik. Arah perubahan pada dua metrik terakhir
justru menunjukkan hasil sedikit lebih baik tanpa K. Karena ablation memakai proksi deterministik
dan bukan embedding live, kesimpulan yang dapat diambil bersifat terbatas: **klaim bahwa
embedding semantik memperbaiki kualitas rekomendasi belum dapat dibuktikan pada data ini.**

**Kelima, aturan keras bekerja sesuai rancangan, termasuk pada kasus batas.** Seluruh 15 kasus
uji lulus. Dua perilaku batas dinyatakan terbuka: penugasan tetap dilakukan ketika seluruh
anggota berkapasitas nol, dan penugasan tetap dilakukan ketika tidak ada kandidat yang memenuhi
R2. Keduanya kini disertai peringatan, bukan disembunyikan.

**Keenam, konflik antara R2 dan R5 terselesaikan dengan pengutamaan R5.** Tugas terkunci
dipertahankan meskipun menyebabkan beban melampaui batas, dengan peringatan
`r2_locked_overload`. Konsekuensinya, jumlah pelanggaran R2 pada hasil akhir tidak dapat dibaca
sebagai angka tunggal yang menyimpulkan kegagalan sistem.

**Ketujuh, keterbatasan terbesar adalah ketiadaan penilaian manusia.** Sistem dapat konsisten dan
patuh aturan, tetapi belum dapat dinyatakan menghasilkan saran yang disetujui orang yang
berpengalaman. Pertanyaan itu tidak dapat dijawab tanpa tiga penilai manusia.

## 3.2 Saran Pengembangan

Saran disusun menurut urutan kepentingan, dengan alasan yang mengacu pada keterbatasan yang
dinyatakan pada §2.6.7.

### 3.2.1 Saran untuk Menutup Keterbatasan Evaluasi

**Pertama, laksanakan pengujian kesepakatan penilai manusia.** Instrumen sudah tersedia pada
`eval/instruments/human_agreement_instrument.md`, mencakup penilaian top-1 dan top-2 per tugas
tanpa memperlihatkan skor internal sistem. Yang dibutuhkan adalah tiga reviewer independen.
Tanpa langkah ini, klaim kualitas rekomendasi tidak dapat dibuat. Prioritas ini tertinggi karena
menutup keterbatasan yang paling memengaruhi kesimpulan.

**Kedua, jalankan ablation study dengan embedding live.** Ablation saat ini berstatus BLOCKED dan
memakai proksi deterministik. Menjalankannya dengan embedding sebenarnya akan menjawab apakah
komponen K benar-benar memberi manfaat, yang saat ini belum terjawab.

**Ketiga, perluas dataset uji dan pisahkan sumber pelanggaran R2.** Dataset 20 skenario terlalu
kecil untuk generalisasi. Selain itu, pelanggaran R2 perlu dipisahkan antara yang berasal dari
tugas terkunci dan yang berasal dari pemilihan algoritma, agar perbandingan antar-metode menjadi
setara.

**Keempat, bandingkan dengan solusi optimal.** Karena penugasan memakai heuristik greedy,
selisih terhadap solusi optimal belum diketahui. Membandingkan dengan penyelesaian optimal pada
skenario kecil akan memberi gambaran seberapa besar yang hilang akibat memilih greedy.

### 3.2.2 Saran untuk Perbaikan Teknis

**Pertama, perketat kebijakan Row Level Security.** Kebijakan saat ini berbunyi
`USING (true) WITH CHECK (true)`, sehingga tidak membatasi akses apa pun. Kebijakan perlu dibatasi
berdasarkan identitas pengguna dan keanggotaan proyek.

**Kedua, verifikasi penerapan migrasi dan lakukan pengujian pada lingkungan nyata.** Skema 001
sampai 007 perlu dipastikan telah diterapkan, dan aplikasi perlu diuji pada lingkungan produksi
beserta pengukuran ulang waktu respons.

**Ketiga, perbaiki konfigurasi model pada lingkungan pengujian.** Dua berkas uji langsung gagal
karena nama model pada `.env.local` tidak valid dan karena layanan menolak validasi JSON. Konfigurasi
yang benar akan membuat pengujian integrasi penyedia layanan dapat dijalankan.

**Keempat, pertimbangkan evaluasi kelayakan kandidat yang lebih terpisah.** Penggabungan dua
syarat pada R2 menyulitkan pemisahan penyebab kegagalan. Memisahkan "melebihi batas pemerataan"
dari "kapasitas habis" akan membuat peringatan lebih informatif.

### 3.2.3 Saran untuk Pengembangan Lanjutan

**Pertimbangkan pembandingan metode multikriteria lain sebagai kajian, bukan sebagai
implementasi.** TOPSIS dan VIKOR menyediakan cara berbeda dalam memperlakukan kompromi
antar-kriteria (Behzadian dkk., 2012; Opricovic & Tzeng, 2004). Kajian perbandingan akan berguna
untuk mengetahui apakah sifat kompensatoris weighted sum benar-benar menjadi masalah pada konteks
ini. Perlu ditegaskan bahwa saran ini adalah usulan kajian, bukan pernyataan bahwa metode
tersebut telah atau seharusnya diimplementasikan.

**Tambahkan rujukan untuk topik cosine similarity.** Topik ini masih bersandar pada satu rujukan
lama, yaitu Salton dkk. (1975), karena penambahan referensi pada fase ini tidak mencakup topik
tersebut.

**Pertimbangkan mekanisme pembelajaran bobot dari umpan balik pengguna.** Sistem saat ini tidak
membaik seiring pemakaian karena tidak ada mekanisme pembelajaran. Bila data umpan balik
terkumpul dalam jumlah memadai, penyesuaian bobot berdasarkan data dapat dipertimbangkan. Sifat
deterministik sebaiknya tetap dipertahankan agar hasil masih dapat dihitung ulang.

---

# DAFTAR PUSTAKA

Behzadian, M., Khanmohammadi Otaghsara, S., Yazdani, M., & Ignatius, J. (2012). A state-of the-art survey of TOPSIS applications. *Expert Systems with Applications, 39*(17), 13051–13069. https://doi.org/10.1016/j.eswa.2012.05.056

Burke, R. (2002). Hybrid recommender systems: Survey and experiments. *User Modeling and User-Adapted Interaction, 12*(4), 331–370. https://doi.org/10.1023/A:1021240730564

Felfernig, A., Friedrich, G., Jannach, D., & Zanker, M. (2015). Constraint-based recommender systems. Dalam F. Ricci, L. Rokach, B. Shapira, & P. B. Kantor (Ed.), *Recommender systems handbook* (ed. ke-2, hlm. 161–190). Springer. https://doi.org/10.1007/978-1-4899-7637-6_5

Gemini Team, Google. (2024). *Gemini: A family of highly capable multimodal models* (arXiv:2312.11805). https://doi.org/10.48550/arXiv.2312.11805

Gunning, D., & Aha, D. (2019). DARPA's explainable artificial intelligence (XAI) program. *AI Magazine, 40*(2), 44–58. https://doi.org/10.1609/aimag.v40i2.2850

Herlocker, J. L., Konstan, J. A., Terveen, L. G., & Riedl, J. T. (2004). Evaluating collaborative filtering recommender systems. *ACM Transactions on Information Systems, 22*(1), 5–53. https://doi.org/10.1145/963770.963772

Järvelin, K., & Kekäläinen, J. (2002). Cumulated gain-based evaluation of IR techniques. *ACM Transactions on Information Systems, 20*(4), 422–446. https://doi.org/10.1145/582415.582418

Koren, Y., Bell, R., & Volinsky, C. (2009). Matrix factorization techniques for recommender systems. *Computer, 42*(8), 30–37. https://doi.org/10.1109/MC.2009.263

Kuhn, H. W. (1955). The Hungarian method for the assignment problem. *Naval Research Logistics Quarterly, 2*(1–2), 83–97. https://doi.org/10.1002/nav.3800020109

Li, C.-T., Shan, M.-K., & Lin, S.-D. (2015). On team formation with expertise query in collaborative social networks. *Knowledge and Information Systems, 42*(2), 441–463. https://doi.org/10.1007/s10115-013-0695-x

Lops, P., de Gemmis, M., & Semeraro, G. (2011). Content-based recommender systems: State of the art and trends. Dalam F. Ricci, L. Rokach, B. Shapira, & P. B. Kantor (Ed.), *Recommender systems handbook* (hlm. 73–105). Springer. https://doi.org/10.1007/978-0-387-85820-3_3

Lunin, A. (2024). Balancing physical workload during workforce scheduling for fair task assignment in a manual warehouse. *IFAC-PapersOnLine, 58*(19), 712–717. https://doi.org/10.1016/j.ifacol.2024.09.064

Mikolov, T., Sutskever, I., Chen, K., Corrado, G., & Dean, J. (2013). Distributed representations of words and phrases and their compositionality. Dalam *Advances in Neural Information Processing Systems* (Vol. 26). https://papers.nips.cc/paper_files/paper/2013/hash/9aa42b31882ec039965f3c4923ce901b-Abstract.html

Miller, T. (2019). Explanation in artificial intelligence: Insights from the social sciences. *Artificial Intelligence, 267*, 1–38. https://doi.org/10.1016/j.artint.2018.07.007

Opricovic, S., & Tzeng, G.-H. (2004). Compromise solution by MCDM methods: A comparative analysis of VIKOR and TOPSIS. *European Journal of Operational Research, 156*(2), 445–455. https://doi.org/10.1016/S0377-2217(03)00020-1

Pazzani, M. J., & Billsus, D. (2007). Content-based recommendation systems. Dalam P. Brusilovsky, A. Kobsa, & W. Nejdl (Ed.), *The adaptive web: Methods and strategies of web personalization* (LNCS vol. 4321, hlm. 325–341). Springer. https://doi.org/10.1007/978-3-540-72079-9_10

Reimers, N., & Gurevych, I. (2019). Sentence-BERT: Sentence embeddings using Siamese BERT-networks. Dalam *Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing and the 9th International Joint Conference on Natural Language Processing (EMNLP-IJCNLP)* (hlm. 3980–3990). Association for Computational Linguistics. https://doi.org/10.18653/v1/D19-1410

Saaty, T. L. (1990). How to make a decision: The analytic hierarchy process. *European Journal of Operational Research, 48*(1), 9–26. https://doi.org/10.1016/0377-2217(90)90057-I

Salton, G., Wong, A., & Yang, C. S. (1975). A vector space model for automatic indexing. *Communications of the ACM, 18*(11), 613–620. https://doi.org/10.1145/361219.361220

Tsang, E. P. K. (1993). *Foundations of constraint satisfaction*. Academic Press.

Wu, H., Ma, C., Mitra, B., Diaz, F., & Liu, X. (2022). A multi-objective optimization framework for multi-stakeholder fairness-aware recommendation. *ACM Transactions on Information Systems, 41*(2), 1–29. https://doi.org/10.1145/3564285

---

# LAMPIRAN A. Pemeriksaan Konsistensi Sitasi

Seluruh entri daftar pustaka di atas dipakai dalam teks. Tabel berikut memetakan setiap sitasi
dalam teks ke bagian yang mengutipnya.

| Entri | Jenis | Dikutip di |
|---|---|---|
| Behzadian dkk. (2012) | Artikel jurnal | §2.1.4, §3.2.3 |
| Burke (2002) | Artikel jurnal | §2.1.1, §2.2.1 |
| Felfernig dkk. (2015) | Bab buku | §1.1, §1.4.1, §2.1.1, §2.1.5 |
| Gemini Team (2024) | Preprint | §2.3.5 (dasar pemakaian keluarga model Gemini untuk embedding) |
| Gunning & Aha (2019) | Artikel jurnal | §2.2.4 |
| Herlocker dkk. (2004) | Artikel jurnal | §2.1.6 |
| Järvelin & Kekäläinen (2002) | Artikel jurnal | §2.1.6 |
| Koren dkk. (2009) | Artikel jurnal | §2.1.1 |
| Kuhn (1955) | Artikel jurnal | §1.1, §2.1.5 |
| Li dkk. (2015) | Artikel jurnal | §2.1.5 (penyaringan kandidat berbasis keahlian) |
| Lops dkk. (2011) | Bab buku | §1.1, §2.1.1 |
| Lunin (2024) | Artikel prosiding | §1.1, §2.1.6 |
| Mikolov dkk. (2013) | Artikel prosiding | §1.1, §2.1.3 |
| Miller (2019) | Artikel jurnal | §2.2.4, §2.5.7 |
| Opricovic & Tzeng (2004) | Artikel jurnal | §2.1.4, §3.2.3 |
| Pazzani & Billsus (2007) | Bab buku | §1.1, §2.1.2 |
| Reimers & Gurevych (2019) | Artikel prosiding | §1.1, §2.1.3 |
| Saaty (1990) | Artikel jurnal | §1.1, §2.1.4 |
| Salton dkk. (1975) | Artikel jurnal | §2.1.3, §3.2.3 |
| Tsang (1993) | Buku | §1.1, §2.1.5 |
| Wu dkk. (2022) | Artikel jurnal | §1.4.1, §2.1.6 |

**Jumlah artikel ilmiah: 16**, terdiri dari **13 artikel jurnal** dan **3 artikel prosiding**.

Artikel jurnal (13): Behzadian dkk. (2012), Burke (2002), Gunning & Aha (2019), Herlocker dkk.
(2004), Järvelin & Kekäläinen (2002), Koren dkk. (2009), Kuhn (1955), Li dkk. (2015), Miller
(2019), Opricovic & Tzeng (2004), Saaty (1990), Salton dkk. (1975), dan Wu dkk. (2022).

Artikel prosiding (3): Mikolov dkk. (2013), Reimers & Gurevych (2019), dan Lunin (2024).

**Bab buku dan buku:** 3 bab buku (Lops dkk., 2011; Pazzani & Billsus, 2007; Felfernig dkk.,
2015) dan 1 buku (Tsang, 1993).

**Preprint:** 1 (Gemini Team, 2024), tidak dihitung sebagai artikel ilmiah.

**Rekapitulasi seluruh publikasi:**

| Jenis | Jumlah |
|---|---|
| Artikel jurnal | 13 |
| Artikel prosiding | 3 |
| **Total artikel ilmiah** | **16** |
| Bab buku | 3 |
| Buku | 1 |
| Preprint | 1 |
| **Total entri publikasi** | **21** |

**Catatan perbedaan terhadap target pengguna.** Target yang ditetapkan adalah 12 artikel jurnal,
3 artikel prosiding, 3 bab buku, 1 buku, 1 preprint, dengan total 20 publikasi. Hasil hitungan
aktual pada daftar pustaka di atas adalah **13 artikel jurnal** dan **3 artikel prosiding**,
sehingga total artikel ilmiah **16** dan total entri **21**. Selisih satu artikel jurnal muncul
karena referensi lama memang memuat 9 artikel jurnal (R3, R4, R7, R8, R9, R10, R11, R13, R14),
ditambah 4 artikel jurnal baru (T1, T3, T4, T6) menjadi 13. Angka dilaporkan apa adanya dan
**tidak diturunkan dengan membuang rujukan yang sah** hanya demi mencapai target. Dasar target
12 artikel jurnal berstatus [PERLU KONFIRMASI] sampai ketentuan dosen tertulis tersedia.

Syarat minimum 10 artikel ilmiah **terpenuhi** pada kedua cara hitung, yaitu 16 atau 15
tergantung apakah Lunin (2024) dihitung sebagai jurnal atau prosiding. Pada laporan ini Lunin
(2024) dihitung sebagai prosiding, sehingga artikel jurnal berjumlah 13.

---

# LAMPIRAN B. Daftar Blocker dan Hal yang Belum Dapat Dibuktikan

| No | Hal | Status | Yang dibutuhkan |
|---|---|---|---|
| 1 | Identitas kelompok (nama, NIM, kelas) | `[TIDAK DITEMUKAN]` | Diisi saat finalisasi |
| 2 | Nama dosen, program studi, universitas, tahun akademik | `[TIDAK DITEMUKAN]` | Diisi saat finalisasi |
| 3 | Tanggal penyusunan | `[TIDAK DITEMUKAN]` | Diisi saat finalisasi |
| 4 | Kesepakatan penilai manusia (3 reviewer) | **BLOCKED** | Tiga reviewer manusia; instrumen sudah siap |
| 5 | Ablation dengan embedding live | **BLOCKED** | Kunci API embedding yang sah dan kuota |
| 6 | Penerapan migrasi Supabase 001–007 | `[PERLU KONFIRMASI]` | Bukti penerapan pada proyek nyata |
| 7 | Pengujian pada lingkungan produksi | `[TIDAK DITEMUKAN]` | Bukti pengujian langsung serta pengukuran ulang waktu |
| 8 | Tangkapan layar aplikasi | `[GAMBAR PERLU DITAMBAHKAN]` | Lima gambar, deskripsinya pada Daftar Gambar dan Bab II |
| 9 | Diagram arsitektur, alur, dan skema basis data | `[GAMBAR PERLU DITAMBAHKAN]` | Tiga gambar, deskripsinya pada §2.3.1, §2.3.2, §2.3.4 |
| 10 | Ekspor `.docx` atau PDF dengan format PRD §14 | **Belum dilakukan** | Alat ekspor tidak tersedia di lingkungan ini |
| 11 | Nomor halaman pada daftar isi | `[TIDAK DITEMUKAN]` | Diperoleh setelah ekspor ke `.docx` |
| 12 | Dasar target 12 artikel jurnal | `[PERLU KONFIRMASI]` | Ketentuan dosen tertulis |
| 13 | Dataset D3 | `[TIDAK DITEMUKAN]` | Tidak ada di repository; tidak dipakai |
| 14 | Data responden | `[TIDAK DITEMUKAN]` | Tidak ada; tidak ada klaim yang bersandar padanya |

---

# LAMPIRAN C. Ketentuan Format PRD Bagian 14 dan Statusnya

Ketentuan format diambil dari PDF PRD v0.2 resmi, Bagian 14, "Daftar periksa format laporan".

| No | Ketentuan | Bunyi ketentuan | Status pada berkas ini |
|---|---|---|---|
| 1 | Ukuran kertas | A4 | Belum dapat diterapkan; berkas berformat Markdown, bukan dokumen tata letak |
| 2 | Jenis dan ukuran huruf | Times New Roman 12 pt | Belum dapat diterapkan; bergantung pengaturan saat ekspor |
| 3 | Spasi | 1,5 | Belum dapat diterapkan; bergantung pengaturan saat ekspor |
| 4 | Margin | Atas 4 cm, bawah 3 cm, kiri 4 cm, kanan 3 cm | Belum dapat diterapkan; bergantung pengaturan saat ekspor |
| 5 | Judul bab | Heading 1 | **Terpenuhi**; setiap bab memakai `#` (Heading 1) |
| 6 | Caption gambar dan tabel | Setiap gambar dan tabel diberi nama | **Terpenuhi**; setiap tabel bernomor dan berjudul, setiap gambar memiliki penanda beserta deskripsi |
| 7 | Referensi artikel ilmiah | Minimal 10 | **Terpenuhi**; 16 artikel ilmiah peer-reviewed |

Ketentuan 1 sampai 4 memerlukan perangkat lunak tata letak dokumen. Lingkungan ini tidak
menyediakan pandoc, python-docx, maupun paket npm `docx`, sehingga ekspor tidak dilakukan dan
tidak ada perintah ekspor yang dikarang. Penerapan format tersebut harus dilakukan manual saat
menyalin isi berkas ini ke templat `.docx`.

Perbedaan antara PRD v0.2 dan v0.3 pada bagian format: **tidak ditemukan perbedaan**. PRD v0.3
tidak mengubah ketentuan format laporan. Karena itu tidak ada konflik yang perlu diputuskan
antara kedua versi pada aspek format.

Perbedaan yang perlu dicatat: repository tidak memuat pedoman tugas dosen yang terpisah dari
PRD. Ketentuan format karena itu sepenuhnya bersandar pada PRD v0.2 Bagian 14. Bila dosen
memiliki ketentuan berbeda, ketentuan dosen harus diutamakan, dan hal itu berstatus
`[PERLU KONFIRMASI]`.
