# F. Load Balance

Hasil dari `eval/scripts/run_methods.test.ts` atas 20 skenario D2. Data:
`eval/results/methods_summary.json`, `methods_per_scenario.json`.

## Rumus (eksplisit)

Untuk anggota `i` dengan beban `L_i` (jam), kapasitas `cap_i`, dan `ideal = totalJam / jumlahAnggota`:

- **deviasi** `d_i = L_i − ideal`
- **stddev populasi** `σ = sqrt( (1/n) · Σ (L_i − mean(L))² )`
- **variance** `σ²`
- **max |deviasi dari ideal|** `= max_i |L_i − ideal|`
- **mean |deviasi dari ideal|** `= (1/n) · Σ |L_i − ideal|`
- **pelanggaran R2 (beban)** `= jumlah i dengan L_i > 1,25 × ideal`
- **pelanggaran kapasitas** `= jumlah i dengan L_i > cap_i`
- **zero-capacity assigned** `= jumlah anggota cap 0 yang tetap diberi tugas (R1)`

Catatan penting: **total beban yang sama tidak berarti adil.** Dua anggota bisa berjumlah sama
tetapi satu kekurangan kapasitas. Karena itu kami juga melaporkan pelanggaran R2 dan kapasitas,
serta (di laporan E) skill, bukan hanya total.

## Hasil per metode (rata-rata 20 skenario)

| Metode | stddev σ | max\|dev\| | pelanggaran R2 (beban) rata² | pelanggaran kapasitas (total 20 skenario) | R1 (cap 0 diberi tugas) |
|---|---|---|---|---|
| Hybrid | 5,62 | 6,83 | 0,90 | 3 | **0** |
| Random (30×) | 5,30 | 6,50 | 0,96 | — (skala 30×) | 31 |
| Round-robin | **3,88** | **4,77** | **0,85** | 6 | 2 |
| Manual | 5,62 | 6,83 | 0,90 | 5 | 2 |

## Interpretasi (jujur)

1. **Round-robin paling seimbang secara beban** (σ=3,88), karena memang membagi bergiliran.
   Tapi round-robin **melanggar R1** (2 kali: memberikan tugas ke anggota kapasitas 0) dan
   **mengabaikan R3** (coverage setara hybrid, tetapi tanpa jaminan skill — lihat pelanggaran R3
   di laporan D/nanti). Jadi "seimbang" di sini berarti "seimbang dengan mengorbankan aturan".
2. **Hybrid dan manual identik** pada metrik beban (σ=5,62, max\|dev\|=6,83). Ini terjadi karena
   aturan manual baseline konvergen ke pilihan hybrid pada skenario di mana hanya sedikit anggota
   memenuhi syarat skill.
3. **Hybrid memiliki R1 = 0** — satu-satunya metode yang **tidak pernah** memberikan tugas ke
   anggota kapasitas 0 pada 20 skenario. Ini keunggulan konkret yang terukur. Hybrid juga
   **paling sedikit pelanggaran kapasitas** (total 3) dibanding round-robin (6) dan manual (5).
4. **stddev hybrid yang tinggi bukan murni kelemahan algoritma.** Kami memisahkan dua penyebab:

   | Penyebab | Jumlah skenario | Bisa diperbaiki metode lain? |
   |---|---|---|
   | Skenario **struktural tak layak** (satu anggota berkualitas harus menanggung semua; volume > kapasitas) | 15 dari 18 skenario yang melanggar R2 | **Tidak** — `bestAnyMethod = hybrid` |
   | Dari **pilihan** metode (bisa lebih seimbang) | S02, S12, S18 | Ya, tapi round-robin melakukannya dengan **melanggar R3** |

   Artinya pada 15/18 skenario yang hybrid langgar R2, **tidak ada metode mana pun** yang bisa
   bebas R2 — pelanggaran itu sifat data (mis. satu tugas 8 jam dengan ideal 2,5 jam per anggota).
   Hanya di S02/S12/S18 load bisa disebar, dan metode yang menyebarnya (round-robin) jatuh ke
   pelanggaran R3. Inilah **trade-off skill vs beban** yang sebenarnya.

## Ringkasan trade-off

| Dimensi | Hybrid | Round-robin | Manual |
|---|---|---|---|
| Kepatuhan R1 (cap 0) | **terbaik (0)** | buruk (2) | buruk (2) |
| Kepemilikan R3 (skill) | baik | buruk | baik |
| Keseimbangan beban (σ) | sedang (5,62) | **terbaik (3,88)** | sedang (5,62) |
| Skill coverage | 0,808 | 0,808 | **0,867** |

Tidak ada metode yang menang di semua dimensi. Hybrid menang di kepatuhan aturan (R1, R3),
round-robin menang di keseimbangan beban dengan mengorbankan aturan, manual menang tipis di
coverage. **Kesimpulan yang didukung data:** distribusi beban hybrid **tidak lebih baik** dari
round-robin, tetapi hybrid **jauh lebih patuh aturan**. Klaim "beban hybrid lebih merata" TIDAK
didukung dan tidak dibuat.
