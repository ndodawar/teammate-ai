# C. Metode Pembanding

Empat metode dijalankan atas **input & kondisi awal yang sama** (20 skenario D2). Urutan tugas
untuk semua metode berurutan = urutan engine (`estimated_hours` desc). Implementasi:
`eval/lib/methods.ts`; runner: `eval/scripts/run_methods.test.ts`.

## 1. Hybrid recommendation

Memanggil **`globalAssign` asli** (mode cadangan bila tanpa cosine). Tidak ada modifikasi.
Tugas terkunci dihormati lewat `existingAssignments` (R5). Bobot = `FALLBACK_WEIGHTS`
(K0/S0,50/C0,33/M0,17) karena tidak ada embedding (tanpa Gemini). Lihat laporan H untuk ablation.

## 2. Random assignment

- Seed tetap: turunan `hash(masterSeed=20260419, 'random', scenarioId, r)` untuk `r = 0..29`.
- **Diulang 30× per skenario**, seluruh hasil dilaporkan (min/median/max), **bukan** hanya yang
  terbaik. Total 20 × 30 = **600 run**.
- Aturan: urutan tugas tetap (effort desc), tiap tugas diberi anggota acak.

## 3. Round-robin assignment

- Urutan: tugas `estimated_hours` desc; penunjuk bergerak +1 tiap tugas menurut **urutan input
  `members`** (urutan tampilan anggota project).
- **Buta aturan**: tidak memperhatikan skill, R1, atau R2. Bila anggota giliran berkapasitas 0,
  tugas tetap diberikan — ini dicatat sebagai pelanggaran (R1), bukan diperbaiki. Tujuannya:
  mengukur baseline "seimbang tanpa kecerdasan".

## 4. Manual assignment (baseline, BUKAN ground truth)

Aturan baseline **ditetapkan sebelum melihat hasil hybrid** (ditulis di docblock `manualFitScore`
sebelum run pertama; urutan kerja tercatat di `reports/00_AUDIT.md` dan commit-log sesi tidak
memuat hasil hybrid lebih dulu). Aturannya:

```
Urutkan tugas (effort desc). Untuk tiap tugas pilih anggota dengan skor kecocokan profil tertinggi:
  skillPart = (Σ level pada skill wajib yang dikuasai ≥3) / (5 × jumlahSkillCocok)   [0..1]
  bonus     = +0,5 bila load+hours ≤ 1,25×ideal AND load+hours ≤ capacity
  skor      = skillPart + bonus
Seri: pilih sisa jam (capacity − load) lebih besar, lalu nama (alfabetis).
```

Metode ini memakai info skill & kapasitas yang **juga dilihat manusia**, tetapi **tidak** memakai
K (cosine/embedding) atau bobot sistem. Ini **baseline pembanding**, bukan kebenaran.

## Hasil ringkas (detail di laporan E, F; data di `results/methods_summary.{json,csv}`)

| Metode | coverage | σ beban | R1 | R3 | R2-akhir | fit | perubahan manual |
|---|---|---|---|---|---|---|---|
| Hybrid | 0,808 | 5,62 | **0** | 1 | 24 | 0,645 | 1 |
| Random | 0,754 | 5,30 | 31 | 147 | 752 | 0,585 | 178 |
| Round-robin | 0,808 | **3,88** | 2 | 4 | 18 | 0,674 | 6 |
| Manual | **0,867** | 5,62 | 2 | **0** | 24 | 0,668 | 2 |

## Catatan keadilan perbandingan

- Hybrid & manual **identik** di beban karena aturan manual konvergen ke pilihan hybrid saat
  hanya sedikit anggota memenuhi syarat skill (mis. S02, S15).
- Hybrid **satu-satunya** dengan R1 = 0: tidak pernah memberi tugas ke anggota kapasitas 0.
- Hybrid R2-akhir = 24, tetapi pada **15 dari 18** skenario yang melanggar, **tidak ada metode
  mana pun** yang bisa bebas R2 (pelanggaran struktural dari data — lihat laporan F §4).
- Hybrid R3 = 1 (S19) tak terhindarkan: satu-satunya anggota berkualitas (level 5) berkapasitas 0,
  jadi R1 mengeluarkannya dan engine memilih yang terbaik di antara yang tersisa (level 2).
  Ini bukan pelanggaran pilihan, melainkan konsekuensi R1 > R3 pada data itu.
- Round-robin "menang" σ tetapi kalah R1 dan R3 — perbandingan tidak boleh hanya memakai σ.
