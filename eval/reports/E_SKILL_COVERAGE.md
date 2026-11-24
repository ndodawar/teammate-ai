# E. Skill Coverage

Hasil dari `eval/scripts/run_methods.test.ts` atas 20 skenario D2 × 4 metode.
Data mentah: `eval/results/methods_summary.json`, `methods_per_scenario.json`.

## Definisi coverage (eksplisit — tidak dicampur cosine similarity)

Satu **unit** = pasangan (tugas, skill wajib). Untuk setiap tugas `t` dan setiap
`skill ∈ t.required_skills`:

- unit **terpenuhi** jika level anggota penanggung jawab pada skill itu **≥ 3** (ambang R3);
- skill yang tidak dikuasai anggota (level 0) **dihitung sebagai gap**, TIDAK dibuang dari
  penyebut. Inilah cara "skill tidak tersedia" ditangani: ia menurunkan coverage, bukan
  diabaikan.

```
coverage = (jumlah unit terpenuhi) / (jumlah unit total)
```

`coverage = 1` bila tidak ada skill wajib sama sekali. Coverage **bukan** cosine similarity dan
**bukan** `computeSkillMatch` (S adalah rata-rata level/5; coverage adalah hitungan ambang ≥3).

## Hasil per metode (rata-rata 20 skenario)

| Metode | coverage rata² | min | max | Tugas fully covered | Catatan |
|---|---|---|---|---|---|
| Hybrid | **0,808** | 0,000 | 1,000 | — | engine asli |
| Random (30×) | **0,754** | 0,000 | 1,000 | — | rata-rata lintas 600 run |
| Round-robin | **0,808** | 0,000 | 1,000 | — | buta skill |
| Manual | **0,867** | 0,000 | 1,000 | — | baseline transparan |

## Interpretasi (jujur)

1. **Hybrid TIDAK mengungguli baseline manual pada skill coverage** (0,808 vs 0,867).
   Ini temuan nyata, bukan kesalahan hitung. Penyebabnya dapat ditelusuri per skenario:
   - Pada skenario di mana hanya **satu** anggota memenuhi R3 (mis. S02, S12, S18), hybrid
     menaruh hampir semua tugas pada anggota itu → coverage tinggi tetapi beban menumpuk
     (lihat laporan F).
   - Pada skenario **tidak ada** anggota level ≥3 (S06, S07, S19), coverage = 0 untuk **semua**
     metode yang menghormati R3 — ini struktural, bukan kelemahan hybrid.
   - Manual sedikit lebih tinggi karena aturannya memilih anggota paling cocok per tugas
     tanpa memaksa konsistensi global, sehingga kadang "kebetulan" menutup lebih banyak unit
     pada skenario multi-skill.
2. **Hybrid seri dengan round-robin (0,808)**, padahal round-robin sama sekali mengabaikan skill.
   Artinya pada dataset ini, **pemilihan berbasis skill tidak menambah coverage** dibanding
   pembagian berurutan — sebuah hasil yang tidak mendukung klaim keunggulan, dan dilaporkan
   apa adanya.
3. **Random jelas terburuk** (0,754), konsisten dengan ekspektasi.
4. Angka `min = 0` di semua metode berasal dari skenario S06/S07/S19 (tidak ada kandidat level
   ≥3). Jadi `min` bukan pembeda; gunakan rata-rata dan distribusi.

## Kesimpulan E

Tidak ada bukti bahwa hybrid meningkatkan skill coverage dibanding baseline. Ia setara
round-robin dan di bawah manual pada rata-rata; keunggulannya (bila ada) harus dicari di
dimensi lain (kepatuhan R1/R3 dan kesesuaian profil), bukan di coverage. Lihat laporan O untuk
rekomendasi agar aturan manual baseline dipakai sebagai pembanding tetap.
