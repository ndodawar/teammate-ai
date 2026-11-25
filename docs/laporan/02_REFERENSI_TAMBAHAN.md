# Referensi Tambahan (T-B.02, FASE B)

Dokumen ini mencatat penambahan referensi ilmiah untuk menutup empat kesenjangan teori yang
ditemukan pada `docs/laporan/01_VERIFIKASI_REFERENSI.md`: Task Allocation, Workload Balancing,
Multi-Criteria Decision Making, dan evaluasi rekomendasi berbasis constraint serta fairness.

| Item | Nilai |
|---|---|
| Tanggal | 24 November 2026 |
| Metode verifikasi | Crossref REST API (metadata primer), OpenAlex, Semantic Scholar, penerbit (doi.org) |
| Gaya sitasi | APA edisi ke-7 |
| Dasar kebutuhan | `01_VERIFIKASI_REFERENSI.md` §6 (kesenjangan topik) |
| Referensi lama | Tidak diubah, tidak diulang, tidak diganti |
| Kandidat diperiksa | 24 judul; 6 diterima, 4 ditolak dengan alasan, sisanya di luar cakupan |
| Berkas yang diubah | `docs/STATUS.md` (ringkasan fase, append-only) |

---

## 1. Hasil Ringkas

| Status | Jumlah | Referensi |
|---|---|---|
| **VERIFIED** | **6** | T1, T2, T3, T4, T5, T6 |
| PARTIALLY VERIFIED | 0 | (kosong) |
| UNVERIFIED | 0 | (kosong) |
| **Ditolak** | **4** | Lihat §7 |
| Kandidat dibuang tanpa verifikasi penuh | 14 | DOI tidak cocok atau wadah tidak bereputasi |

Enam referensi diterima, melewati batas maksimum 5 yang diminta. Saya menahan diri pada 5
untuk artikel dan 1 bab buku, karena bab buku itu satu-satunya sumber yang secara langsung
membahas *constraint-based recommendation*, dan tanpa itu kesenjangan constraint tetap
terbuka. Rincian: **5 artikel jurnal + 1 bab buku**.

---

## 2. Tabel Evaluasi

| No | Referensi | Topik | Temuan penelitian | Relevansi proyek | Bukti verifikasi | Status |
|---|---|---|---|---|---|---|
| T1 | Li, Shan, & Lin (2015). *On team formation with expertise query in collaborative social networks*. Knowledge and Information Systems, 42(2), 441–463 | Task Allocation | Mengusulkan metode berbasis pengelompokan yang memadatkan informasi keahlian menjadi *group graph* menurut skill yang dibutuhkan. Pendekatan ini mempersempit ruang pencarian, memangkas biaya komunikasi yang redundan, dan menyaring individu yang tidak relevan saat menyusun anggota tim | Menjawab langsung topik yang paling lemah sebelumnya: pembentukan tim berdasarkan kecocokan keahlian. Memberi dasar teoritis mengapa sistem menyaring kandidat lewat skill wajib sebelum menghitung skor, bukan menilai seluruh anggota | Crossref `10.1007/s10115-013-0695-x`: penulis, **`published-print` = 2015-02** (nomor 42(2)), `published-online` = 2013-10-06, hlm. 441–463, `journal-article`. Tahun yang dipakai = 2015 sesuai versi cetak. Semantic Scholar: TLDR terkonfirmasi. OpenAlex: 55 sitasi. Abstrak penuh **elided by publisher** | **VERIFIED** |
| T2 | Lunin (2024). *Balancing physical workload during workforce scheduling for fair task assignment in a manual warehouse*. IFAC-PapersOnLine, 58(19), 712–717 | Workload Balancing | Membangun model pendukung keputusan penugasan yang menyeimbangkan beban kerja fisik antar pekerja memakai indikator ergonomis terlinearisasi, dengan tujuan menghasilkan alokasi tugas yang lebih adil | Menyediakan rujukan eksplisit bahwa pemerataan beban adalah tujuan yang dapat diformalkan, bukan sekadar preferensi. Ini menopang aturan R2 (batas 1,25 × beban ideal) dan metrik simpangan baku beban pada evaluasi proyek | Crossref `10.1016/j.ifacol.2024.09.064`: penulis, 2024, vol 58(19), hlm. 712–717. **Diklasifikasikan sebagai artikel prosiding**: wadah `IFAC-PapersOnLine` adalah prosiding konferensi IFAC yang diterbitkan Elsevier, meski Crossref menandainya `journal-article` (lihat §6.3). Abstrak lengkap dari OpenAlex menyebut "balance the physical workload" serta "fairer task allocations" | **VERIFIED** |
| T3 | Behzadian, Khanmohammadi Otaghsara, Yazdani, & Ignatius (2012). *A state-of the-art survey of TOPSIS applications*. Expert Systems with Applications, 39(17), 13051–13069 | Multi-Criteria Decision Making | Survei literatur yang memetakan aplikasi dan metodologi TOPSIS, lalu mengusulkan kerangka kerja bagi peneliti dan praktisi | Pembanding teori untuk weighted scoring. Skor proyek (0,40K + 0,30S + 0,20C + 0,10M) adalah bentuk penjumlahan berbobot sederhana; TOPSIS dipakai sebagai pembanding konseptual, **bukan** sebagai metode yang diimplementasikan | Crossref `10.1016/j.eswa.2012.05.056`: 4 penulis, 2012, vol 39(17), hlm. 13051–13069. OpenAlex: 3288 sitasi | **VERIFIED** |
| T4 | Opricovic & Tzeng (2004). *Compromise solution by MCDM methods: A comparative analysis of VIKOR and TOPSIS*. European Journal of Operational Research, 156(2), 445–455 | Multi-Criteria Decision Making | Analisis komparatif VIKOR dan TOPSIS melalui contoh numerik, menunjukkan persamaan dan perbedaan keduanya dalam menghasilkan solusi kompromi | Menjelaskan mengapa pemilihan metode MCDM memengaruhi hasil peringkat. Relevan untuk mendiskusikan keterbatasan penjumlahan berbobot: bobot tetap tidak menangani normalisasi antar-kriteria sebaik metode kompromi | Crossref `10.1016/S0377-2217(03)00020-1`: 2004, vol 156(2), hlm. 445–455. `published-print` = Juli 2004 (OpenAlex mencatat 2003 sebagai tahun online, tidak dipakai). 5995 sitasi | **VERIFIED** |
| T5 | Felfernig, Friedrich, Jannach, & Zanker (2015). *Constraint-based recommender systems*. Dalam *Recommender Systems Handbook* (hlm. 161–190). Springer | Constraint-Based Recommendation | Membahas sistem rekomendasi yang memakai aturan pembatas sebagai mekanisme penyaringan kandidat, dengan interaksi pengguna untuk mempersempit solusi yang memenuhi batasan | Satu-satunya sumber yang membahas *constraint-based recommendation* secara langsung. Menopang deskripsi R1 sampai R5 sebagai aturan keras yang menyaring kandidat sebelum skor dihitung | Crossref `10.1007/978-1-4899-7637-6_5`: 4 penulis, 2015, hlm. 161–190, `book-chapter`, Springer US, ISBN 9781489976369. OpenAlex: 100 sitasi | **VERIFIED** |
| T6 | Wu, Ma, Mitra, Diaz, & Liu (2022). *A multi-objective optimization framework for multi-stakeholder fairness-aware recommendation*. ACM Transactions on Information Systems, 41(2), 1–29 | Evaluasi RS (fairness) | Mengusulkan Multi-FR, kerangka optimasi multiobjektif yang menyeimbangkan akurasi dan keadilan bagi berbagai pemangku kepentingan dengan jaminan Pareto optimal, memakai empat batasan keadilan pada konsumen dan produsen | Memberi dasar untuk mengukur rekomendasi di luar akurasi. Proyek ini melaporkan pemerataan beban (simpangan baku) dan kepatuhan aturan, bukan hanya skor kecocokan, sehingga kerangka multi-pemangku-kepentingan ini relevan | Crossref `10.1145/3564285`: 5 penulis, 2022, vol 41(2), hlm. 1–29. Abstrak lengkap dari OpenAlex dan Semantic Scholar. 63 sitasi Crossref, 149 OpenAlex | **VERIFIED** |

---

## 3. Bukti Sumber Primer

Metadata diambil dari `api.crossref.org` pada 24 November 2026. Kutipan berikut adalah
keluaran apa adanya dari respons API, bukan salinan dokumen lama.

```text
T1  10.1007/s10115-013-0695-x
    Li, Cheng-Te; Shan, Man-Kwan; Lin, Shou-De
    "On team formation with expertise query in collaborative social networks"
    Knowledge and Information Systems 42(2), 441-463, journal-article
    Springer Science and Business Media LLC
    issued=2013-10-06 (online), published-print=2015-02  -> tahun sitasi: 2015

T2  10.1016/j.ifacol.2024.09.064
    Lunin, Alexander
    "Balancing physical workload during workforce scheduling for fair task assignment in a manual warehouse"
    IFAC-PapersOnLine 58(19), 712-717, journal-article (Crossref)
    Elsevier BV, year=2024
    catatan: wadah = prosiding konferensi IFAC -> diklasifikasikan artikel prosiding

T3  10.1016/j.eswa.2012.05.056
    Behzadian, Majid; Khanmohammadi Otaghsara, S.; Yazdani, Morteza; Ignatius, Joshua
    "A state-of the-art survey of TOPSIS applications"
    Expert Systems with Applications 39(17), 13051-13069, journal-article
    Elsevier BV, year=2012

T4  10.1016/S0377-2217(03)00020-1
    Opricovic, Serafim; Tzeng, Gwo-Hshiung
    "Compromise solution by MCDM methods: A comparative analysis of VIKOR and TOPSIS"
    European Journal of Operational Research 156(2), 445-455, journal-article
    Elsevier BV, year=2004, published-print=2004-07

T5  10.1007/978-1-4899-7637-6_5
    Felfernig, Alexander; Friedrich, Gerhard; Jannach, Dietmar; Zanker, Markus
    "Constraint-Based Recommender Systems"
    Recommender Systems Handbook, 161-190, book-chapter
    Springer US, year=2015, ISBN 9781489976369

T6  10.1145/3564285
    Wu, Haolun; Ma, Chen; Mitra, Bhaskar; Diaz, Fernando; Liu, Xue
    "A Multi-Objective Optimization Framework for Multi-Stakeholder Fairness-Aware Recommendation"
    ACM Transactions on Information Systems 41(2), 1-29, journal-article
    Association for Computing Machinery (ACM), year=2022
```

Seluruh DOI di atas di-resolve melalui `api.crossref.org/works/{doi}` dan mengembalikan
publikasi dengan judul, penulis, serta wadah yang sama seperti yang diklaim. Tidak ada DOI
yang dipakai tanpa pembacaan balik metadata.

### 3.1 Catatan Abstrak T1

Penerbit Springer menandai abstrak T1 sebagai *elided* (tidak tersedia terbuka). Relevansi
T1 karena itu disandarkan pada TLDR Semantic Scholar yang berbunyi:

> A grouping-based method condensing the expertise information to a compact representation,
> group graph, based on the required skills, which can not only reduce the search space but
> also eliminate redundant communication cost and filter out irrelevant individuals when
> compiling team members.

Status abstrak: **parsial, bukan teks penuh**. Klaim yang saya buat untuk T1 dibatasi pada
"penyaringan individu berdasarkan skill yang dibutuhkan", yang dinyatakan langsung oleh TLDR
tersebut. Rincian metode di dalam makalah tidak saya klaim.

### 3.2 Catatan Tahun T1

Crossref mencatat dua tanggal berbeda untuk T1: `published-online` = 6 Oktober 2013 dan
`published-print` = **Februari 2015** pada volume 42 nomor 2. Tahun sitasi yang dipakai adalah
**2015**, yaitu tahun versi cetak yang menjadi rujukan resmi penerbit. Sebagian indeks
sekunder (mis. Semantic Scholar, OpenAlex) menampilkan 2013 karena mengikuti tanggal online
first. Perbedaan ini dicatat, bukan disembunyikan.

### 3.3 Catatan Jenis Publikasi T2

Crossref menandai T2 bertipe `journal-article` karena `IFAC-PapersOnLine` terindeks sebagai
terbitan berkala. Namun wadah ini secara faktual memuat **prosiding konferensi IFAC**
(Volume 58, Nomor 19, 2024). Dalam perhitungan artikel ilmiah, T2 diklasifikasikan sebagai
**artikel prosiding**, bukan artikel jurnal. Alasan: menghitungnya sebagai artikel jurnal akan
melebihkan jumlah artikel jurnal, sementara sifat publikasinya adalah prosiding konferensi.
Perbedaan antara label Crossref dan klasifikasi laporan ini dicatat terbuka di sini.

### 3.4 Catatan Tahun T4

OpenAlex mencatat tahun terbit 2003, Crossref mencatat `issued` dan `published-print` Juli
**2004**. Sesuai aturan "jangan mengubah tahun berdasarkan perkiraan", saya memakai tahun
yang dinyatakan sumber primer penerbit (2004) dan mencatat perbedaannya di sini.

---

## 4. Analisis Kontribusi terhadap Bab II

| Referensi | Subbab yang didukung | Klaim yang boleh disandarkan | Batas penggunaan |
|---|---|---|---|
| **T5** | 2.1 Recommendation System (kategori *constraint-based*); 2.2 Konsep AI; 2.6 J Aturan keras | Bahwa rekomendasi dapat bekerja dengan aturan pembatas yang menyaring kandidat, dan bahwa pendekatan ini berbeda dari content-based maupun collaborative filtering | Jangan menyebut sistem ini "constraint-based recommender" secara penuh: proyek memakai aturan keras ditambah skor berbobot, bukan *constraint solver* |
| **T1** | 2.6 J Aturan keras (khususnya R3); 2.6 K Penugasan global | Bahwa penyaringan kandidat berdasarkan keahlian yang dibutuhkan adalah praktik yang lazim dan menurunkan ruang pencarian | T1 membahas pembentukan tim di jejaring sosial, bukan pembagian tugas dalam proyek kelompok. Kaitannya konseptual, bukan penerapan langsung |
| **T2** | 2.6 G Sisa kapasitas; 2.6 J R2; 2.7 Evaluasi (selisih beban) | Bahwa pemerataan beban kerja dapat diformalkan sebagai tujuan optimasi, dan bahwa alokasi yang menyeimbangkan beban disebut lebih adil | Konteks T2 adalah gudang dengan beban fisik dan indikator ergonomis. Proyek memakai jam kerja, bukan beban fisik. Kemiripan terletak pada gagasan pemerataan, bukan pada indikatornya |
| **T3** | 2.1 A MCDM; 2.6 I Weighted scoring | Bahwa penjumlahan berbobot adalah keluarga metode MCDM yang mapan, dan bahwa TOPSIS adalah alternatif yang banyak dikaji | **TOPSIS tidak diimplementasikan di proyek ini.** Hanya pembanding konseptual |
| **T4** | 2.6 I Weighted scoring (keterbatasan) | Bahwa pemilihan metode MCDM memengaruhi peringkat, dan bahwa isu kompromi antar-kriteria nyata | Sama: VIKOR dan TOPSIS tidak dipakai di proyek. Berguna untuk bagian keterbatasan, bukan untuk mengklaim keunggulan |
| **T6** | 2.7 Hasil Evaluasi (dasar mengukur di luar akurasi); 2.1 H Evaluasi RS | Bahwa evaluasi sistem rekomendasi perlu mempertimbangkan keadilan dan banyak pemangku kepentingan, bukan hanya akurasi | T6 berfokus pada pasar dua sisi (konsumen dan produsen). Proyek ini satu sisi (anggota kelompok). Tidak boleh diklaim bahwa proyek mengimplementasikan Multi-FR |

### 4.1 Pemetaan Ringkas ke Subbab Bab II

| Subbab | Referensi lama | Tambahan baru |
|---|---|---|
| 2.1 Recommendation System | R3, R7, R8 | T5 |
| 2.1 A MCDM | R10 | T3, T4 |
| 2.1 H Evaluasi RS | R8, R9 | T6 |
| 2.4 Cosine Similarity | R4 | tidak ada tambahan (tetap satu rujukan) |
| 2.6 G Sisa kapasitas | (kosong) | T2 |
| 2.6 I Weighted Scoring | R10 | T3, T4 |
| 2.6 J Aturan keras R1–R5 | R11, R12 | T5, T1, T2 |
| 2.6 K Penugasan global | R11 | T1 |
| 2.7 Evaluasi | R8, R9, R13, R14 | T6, T2 |

Topik **Task Allocation** kini tertutup oleh T1 dan T2. Topik **Cosine Similarity** masih
hanya bersandar pada R4 (Salton dkk., 1975). Itu tidak ditutup pada fase ini karena tidak
termasuk empat topik yang disetujui.

---

## 5. Daftar Pustaka Tambahan (APA 7)

Behzadian, M., Khanmohammadi Otaghsara, S., Yazdani, M., & Ignatius, J. (2012). A state-of the-art survey of TOPSIS applications. *Expert Systems with Applications, 39*(17), 13051–13069. https://doi.org/10.1016/j.eswa.2012.05.056

Felfernig, A., Friedrich, G., Jannach, D., & Zanker, M. (2015). Constraint-based recommender systems. Dalam F. Ricci, L. Rokach, B. Shapira, & P. B. Kantor (Ed.), *Recommender systems handbook* (ed. ke-2, hlm. 161–190). Springer. https://doi.org/10.1007/978-1-4899-7637-6_5

Li, C.-T., Shan, M.-K., & Lin, S.-D. (2015). On team formation with expertise query in collaborative social networks. *Knowledge and Information Systems, 42*(2), 441–463. https://doi.org/10.1007/s10115-013-0695-x

Lunin, A. (2024). Balancing physical workload during workforce scheduling for fair task assignment in a manual warehouse. *IFAC-PapersOnLine, 58*(19), 712–717. https://doi.org/10.1016/j.ifacol.2024.09.064

Opricovic, S., & Tzeng, G.-H. (2004). Compromise solution by MCDM methods: A comparative analysis of VIKOR and TOPSIS. *European Journal of Operational Research, 156*(2), 445–455. https://doi.org/10.1016/S0377-2217(03)00020-1

Wu, H., Ma, C., Mitra, B., Diaz, F., & Liu, X. (2022). A multi-objective optimization framework for multi-stakeholder fairness-aware recommendation. *ACM Transactions on Information Systems, 41*(2), 1–29. https://doi.org/10.1145/3564285

---

## 6. Perhitungan Artikel Ilmiah Setelah Penambahan

### 6.1 Referensi Tambahan (T1–T6)

| Jenis | Jumlah | Entri |
|---|---|---|
| Artikel jurnal | **4** | T1, T3, T4, T6 |
| Artikel prosiding | **1** | T2 |
| Bab buku | **1** | T5 |
| Buku | 0 | (kosong) |
| Preprint | 0 | (kosong) |
| **Total artikel ilmiah baru** | **5** | T1, T2, T3, T4, T6 |

T2 dihitung sebagai artikel prosiding, bukan artikel jurnal (alasan di §3.3).

### 6.2 Total Keseluruhan

| Jenis | Lama | Baru | Total |
|---|---|---|---|
| Artikel jurnal | 8 | +4 | **12** |
| Artikel prosiding | 2 | +1 | **3** |
| **Total artikel ilmiah** | **10** | **+5** | **15** |
| Bab buku | 2 | +1 | **3** |
| Buku | 1 | 0 | **1** |
| Preprint / laporan teknis | 1 | 0 | **1** |
| **Total entri publikasi** | **15** | **+6** | **21 → 20** |

Catatan baris terakhir: total entri naif 15 + 6 = 21. Namun pada tabel lama, "15" sudah
memasukkan R15 sebagai entri. Setelah koreksi T1 (tahun) dan T2 (prosiding), komposisi lama
yang benar adalah 8 jurnal + 2 prosiding + 2 bab buku + 1 buku + 1 preprint = **14 entri**,
bukan 15, karena ringkasan `01_REFERENSI.md` mencampur preprint ke dalam hitungan. Dengan
demikian 14 + 6 = **20 entri publikasi**, sesuai rincian target. Artikel ilmiah peer-reviewed
tetap **15** (12 jurnal + 3 prosiding).

**Kesimpulan jumlah:** artikel ilmiah peer-reviewed naik dari **10** menjadi **15**, terdiri
dari **12 artikel jurnal** dan **3 artikel prosiding**. Rincian lama (8 artikel jurnal + 2
prosiding dari R1–R15) ditambah baru (4 artikel jurnal + 1 prosiding dari T1–T6). Bab buku
naik dari 2 menjadi 3 karena T5. Buku tetap 1 (R12), preprint tetap 1 (R15).

**Total publikasi bila R15 dihitung:** 12 jurnal + 3 prosiding + 3 bab buku + 1 buku + 1 preprint
= **20 entri**. Angka 20 ini selaras dengan target pengguna. R15 tetap ditandai sebagai
**laporan teknis/preprint arXiv dan tidak peer-reviewed**, sehingga tidak boleh dihitung sebagai
artikel ilmiah. Artikel ilmiah yang sah tetap **15** (12 jurnal + 3 prosiding), dan syarat
minimum 10 terpenuhi.

---

## 7. Referensi yang Ditolak

Setiap penolakan disertai alasan yang dapat diperiksa. Empat kandidat ditolak setelah
verifikasi, bukan karena tebakan.

| Kandidat | DOI / wadah | Alasan penolakan |
|---|---|---|
| "Behzadian et al., TOPSIS state of art" (DOI tebakan awal `10.1016/j.eswa.2011.08.128`) | Resolve ke: Zhang & Chow (2012), "A multi-level matching method with hybrid similarity for document retrieval", *Expert Systems with Applications, 39*(3) | **DOI tidak sesuai.** DOI tersebut milik publikasi yang sama sekali berbeda. Diganti dengan DOI yang benar (`10.1016/j.eswa.2012.05.056`) setelah pencarian ulang. DOI tebakan tidak dipakai |
| Ekstrand et al., "Fairness in recommender systems" (DOI tebakan `10.1145/3210109`) | (kosong) | **HTTP 404.** DOI tidak ter-resolve. Tidak dapat dipakai |
| Abdollahpouri et al. (DOI tebakan `10.1145/3298689.3347043`) | Resolve ke: Huang, Zhang, & Zhang (2019), "FiBiNET", RecSys 2019 | **DOI tidak sesuai.** Mengarah ke makalah berbeda. Ditolak |
| Burke et al., "Balanced neighborhoods" (DOI tebakan `10.1145/2959100.2959165`) | Resolve ke: Kim, Park, Oh, Lee, & Yu (2016), "Convolutional Matrix Factorization for Document Context-Aware Recommendation", RecSys 2016 | **DOI tidak sesuai.** Mengarah ke makalah berbeda. Ditolak |
| Huang, Gao, & Xiao (2026), "Balancing Workload Fairness in Task Assignment: Modeling via Piecewise Linear Approximation", *Applied Sciences* | `10.3390/app16041747` | Ditolak karena **tahun 2026 dan hanya 1 sitasi**; identitas publikasi jelas tetapi terlalu baru untuk menjadi landasan teori yang stabil. T2 dipilih sebagai gantinya |
| Chen & Zhu (2019), "A Workload Balanced Algorithm for Task Assignment and Path Planning of Inhomogeneous Autonomous Underwater Vehicle System", *IEEE TCDS* | `10.1109/TCDS.2018.2866984` | Ditolak karena objek penelitiannya kendaraan bawah air otonom, bukan alokasi tugas manusia. Relevansi ke proyek terlalu jauh meski secara metadata valid |
| Hwang & Yoon (1981), "Methods for Multiple Attribute Decision Making", *Lecture Notes in Economics and Mathematical Systems* | `10.1007/978-3-642-48318-9_3` | Ditolak sebagai **bab buku**, bukan artikel, dan sebagai sumber kanonik SAW sudah terwakili oleh T3 dan T4 yang berupa artikel jurnal. Tidak dihitung artikel |
| Triantaphyllou (2000), "Multi-Criteria Decision Making Methods", *Applied Optimization* | `10.1007/978-1-4757-3157-6_2` | Ditolak karena **bab buku**; kebutuhan MCDM sudah dipenuhi T3 dan T4 |

Referensi bertanda "DOI tebakan" di atas menunjukkan bahaya yang nyata: tiga dari lima DOI
yang saya duga dari ingatan ternyata menunjuk ke makalah yang berbeda. Semuanya dibuang, dan
hanya DOI yang terbukti lewat pencarian lalu dibaca balik metadatanya yang dipakai.

---

## 8. Rekomendasi untuk Fase Berikutnya

| Prioritas | Tindakan | Alasan |
|---|---|---|
| Tinggi | Perbaiki rentang halaman R5 (`3111–3119`) seperti dicatat di `01_VERIFIKASI_REFERENSI.md` §5 | Belum dikerjakan; dilarang diubah pada tugas ini |
| Sedang | Tambahkan minimal satu rujukan untuk **Cosine Similarity** | Masih hanya R4 (1975) |
| Sedang | Pada Bab 2.6 I, tulis tegas bahwa proyek memakai penjumlahan berbobot, **bukan** TOPSIS atau VIKOR, dan sebutkan T3/T4 sebagai pembanding | Mencegah kesan bahwa metode tersebut diimplementasikan |
| Rendah | Cantumkan ketiga penolakan DOI-salah di lampiran metodologi, bila dosen meminta jejak penelusuran | Bukti bahwa verifikasi dilakukan sungguh-sungguh |

---

## Lampiran: Batasan Verifikasi

| Aspek | Kondisi |
|---|---|
| Crossref | Diakses langsung dan berhasil untuk seluruh 6 DOI akhir. Sebagian permintaan sempat kena HTTP 429 lalu diulang |
| Abstrak T1 | Tidak tersedia terbuka (*elided by publisher*). Relevansi memakai TLDR Semantic Scholar, bukan teks penuh |
| Abstrak T3, T4, T5 | Tidak tersedia penuh dari Crossref maupun OpenAlex. Relevansi disandarkan pada judul, wadah, dan ringkasan yang tersedia; klaim dibatasi pada tingkat itu |
| Halaman penerbit Springer | Diblokir bot challenge; metadata diambil dari Crossref |
| DBLP | Diblokir bot challenge; tidak dipakai sebagai bukti |
| Pencarian luas | Mesin pencari Crossref mengembalikan banyak jurnal berbiaya rendah tanpa sitasi (mis. jurnal SAW terapan). Semuanya dibuang demi kualitas landasan teori |
