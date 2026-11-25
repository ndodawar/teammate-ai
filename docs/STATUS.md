# Status Implementasi (STATUS.md)

## Status Berdasarkan Fitur (FR)

| ID | Fitur | Status | Bukti |
|---|---|---|---|
| FR-01 | Pembuatan Proyek | **VERIFIED** | `app/page.tsx`, `app/api/projects/route.ts` |
| FR-02 | Pengelolaan Anggota | **VERIFIED** | `app/api/projects/[code]/members/route.ts` |
| FR-03 | Profil Anggota | **VERIFIED** | `app/p/[code]/members/[id]`, migration 003-006 |
| FR-04 | Manajemen Tugas | **VERIFIED** | `app/p/[code]/tasks`, migration 007 |
| FR-05 | Atribut Tugas | **VERIFIED** | `lib/validation/index.ts`, migration 007 |
| FR-06 | Analisis Tugas AI | **VERIFIED (Gemini live OK)** | `lib/ai/analyze-task.ts`, `app/api/analyze-task/route.ts`; review-before-apply di `tasks-client.tsx`. T-2.07: model diperbaiki (`gemini-3.8-flash`, `gemini-embedding-001`); panggilan live OK dengan token nyata. `eval/reports/T-2.07_GEMINI_FIX_VERIFICATION.md` |
| FR-07 | Mesin Rekomendasi | **VERIFIED** | `lib/scoring/score.ts`, `lib/scoring/assign.ts`, `lib/scoring/pipeline.ts` |
| FR-08 | Matriks Rekomendasi | **VERIFIED** | `result-client.tsx`: 7 baris × 4 anggota, kolom skor K/S/C/M per kandidat, status utama/kandidat/gugur, `<caption>` sr-only |
| FR-09 | Penjelasan Skor | **VERIFIED (template) · AI live OK, pemakaian per-run belum terbukti** | Panel rincian sebaris (`score-breakdown.tsx`) + kalimat fakta `lib/scoring/explain-local.ts` (dipakai & benar). Jalur Gemini (`lib/ai/explain.ts`) kini terpanggil setelah embedding diperbaiki (kode + token terverifikasi live); namun pada run rekomendasi uji, penjelasan jatuh ke template karena kuota free tier `gemini-3.8-flash` habis (429). `eval/reports/T-2.07_GEMINI_FIX_VERIFICATION.md` |
| FR-10 | Slider Bobot | **VERIFIED** | `redistributeWeights` + `globalAssign` lokal. Ukur 4× CPU throttle (build produksi): input → matriks berubah **maks 32,5 ms**, **0 request jaringan** |
| FR-11 | Manajemen Penugasan | **VERIFIED** | Accept (Enter/sel), manual reassign (select), swap dua langkah, lock/unlock (R5), undo satu langkah |
| FR-12 | Ringkasan Beban | **VERIFIED** | `LoadMeter` + penanda R2 teks (`describeR2`), termasuk peringatan melewati batas |
| FR-13 | Mode Fallback | **VERIFIED** | `assign.ts`/`score.ts` + `test/scoring/fallback.test.ts`; banner cadangan tetap terlihat selama slider, kunci, dan pratinjau |
| FR-14 | Ekspor | **VERIFIED** | CSV (BOM, kutip RFC-4180, guard injeksi formula) 7 baris; salin-teks 18 baris. Tidak memanggil Gemini |
| FR-15 | Cara Kerja | **VERIFIED** | `app/how-it-works/page.tsx` |
| FR-16 | Event Logging | **VERIFIED** | `app/api/projects/[code]/events/route.ts` (allow-list + skema zod ketat), `lib/client/events.ts` fire-and-forget; 8 POST tercatat saat alur uji, kegagalan log tidak memutus UI |
| FR-17 | Perbandingan (Opsional) | **VERIFIED** | `compareSnapshots` terhadap snapshot saat rekomendasi dibuat; panel "Bandingkan dengan awal" |
| FR-18 | Mode What-if | **VERIFIED** | Pratinjau (`whatif-preview`) → Terapkan/Batalkan, **0 request jaringan**, Batalkan menutup menu juga |
| FR-19 | Feedback Visual | **VERIFIED** | Status `aria-live`, progres 5 tahap, "N tugas berpindah penanggung jawab", sorotan baris, validasi per field (`aria-invalid`), banner fallback |
| FR-20 | Navigasi Keyboard | **VERIFIED** | Panah memindahkan sel aktif, Enter menerima, `L` mengunci, Ctrl/Cmd+Z mengurungkan; guard konteks mengetik. Rasio kontras fokus terlihat |
| FR-21 | Undo | **VERIFIED** | Satu langkah untuk terima, pindah, tukar, kunci, **dan ubah bobot** (dari tombol maupun Ctrl/Cmd+Z saat fokus di slider) |

## Ringkasan Teknis
- **Lint**: PASS (`app`, `components`, `lib`: 0 error, 0 warning)
- **Typecheck**: PASS (`tsc --noEmit`, exit 0)
- **Unit Test**: PASS (287 tes non-integrasi lulus, 4 live test di-skip tanpa `GEMINI_API_KEY`, 22 file)
- **Integration Test**: PASS (8/8, dijalankan terpisah dengan dev server aktif; suite ini sudah lama flaky bila diparalelkan)
- **Build**: PASS (`next build`, exit 0)
- **Supabase Migration**: Sampai 007 (FR-04/05)
- **AI**: Gemini terintegrasi (batching + cache + penjelasan + AiRun + guard 3 panggilan). **Verifikasi live model TERTUNDA: `GEMINI_API_KEY` belum diisi.**

---

## Sistem Motion & Desain (Tahap Redesign UI)

### Dependency
| Paket | Versi | Catatan |
|---|---|---|
| `framer-motion` | 14.14.0 | Dipasang dengan `--legacy-peer-deps` karena konflik peer `@types/node@20` vs `vitest@5`. Tidak mengubah dependency lain. |
| `ui-ux-pro-max-cli` | 2.15.0 | Prefix user `~/.npm-global` (tanpa sudo). Skill terpasang di `.opencode/skills/` (~4,6 MB). |

### Token Motion (`lib/motion/tokens.ts`)
| Kategori | Durasi | Easing |
|---|---|---|
| Feedback (hover/press) | 120 ms | `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out) |
| Perubahan data | 200 ms | ease-in-out |
| Perpindahan layout | 280 ms | ease-in-out |
| Stagger antar-item | 30 ms | — |

Aturan: hanya `transform` dan `opacity`, lebar batang memakai `scaleX`, tanpa `transition-all`, tanpa bounce/elastic, tidak ada gerak > 400 ms.

### Komponen motion reusable
- `components/motion/reveal.tsx` — `RevealGroup`, `RevealItem`, `RevealOnce`. Memakai `useReducedMotion()` dari framer-motion; saat `reduce` aktif, komponen mengembalikan elemen biasa (bukan `motion` dengan `initial={false}`) sehingga tidak pernah ada `opacity:0` pada paint pertama.
- `components/motion/score-bar.tsx` — `ScoreBar` (scaleX), `LoadMeter` (scaleX, threshold R2).

> `lib/motion/use-reduced-motion.ts` **dihapus**. Semua komponen kini memakai `useReducedMotion()` langsung dari framer-motion supaya tidak ada dua sumber kebenaran.

### File yang diubah / dibuat
- Diubah: `app/page.tsx`, `app/globals.css`, `eslint.config.mjs`, `app/p/[code]/result/result-client.tsx`, `app/p/[code]/members/members-client.tsx`, `app/p/[code]/tasks/tasks-client.tsx`, `components/ui/primitives.tsx`, `components/ui/theme-toggle.tsx`.
- Dibuat: `lib/motion/tokens.ts`, `components/motion/reveal.tsx`, `components/motion/score-bar.tsx`, `app/how-it-works/page.tsx`.
- Dihapus: `lib/motion/use-reduced-motion.ts`.

### Motion per halaman
- **`/`** — stagger hero (judul → deskripsi → ringkasan metrik), entrance kartu form tanpa delay, `AnimatePresence` form ⇄ panel sukses, error inline fade, press-scale pada CTA, spinner loading tanpa layout shift.
- **`/p/[code]/members`** — stagger baris tabel, error fade, press-scale tombol tambah, skeleton loading.
- **`/p/[code]/tasks`** — stagger daftar tugas, status/error banner masuk–keluar, press-scale tombol, indikator progres analisis AI.
- **`/p/[code]/result`** — body matriks stagger per baris, `ScoreBar` tumbuh ke nilai aktual (scaleX), `LoadMeter` berubah langsung saat bobot digeser, feedback press pada lock/alternatif/undo, state `aria-pressed` pada tombol kunci, ekspor CSV dan salin teks berfungsi dengan data aktual.
- **`/how-it-works`** — halaman statis (server component), penekanan visual pada formula.

### T-UI-09 — Perbaikan Motion yang Tidak Terlihat

Diagnosis dilakukan dengan Chromium headless asli (`~/.cache/ms-playwright/...`) lewat CDP, mengambil sampel `getComputedStyle().opacity`/`transform` per frame. Bukan hanya lint/typecheck/build.

**Penyebab sebenarnya `framer-motion` terpasang tetapi animasi tidak terlihat:**

1. **Semua elemen hero mulai dari `opacity:0` dan memudar bersamaan.** SSR memang mengeluarkan `opacity:0;translateY(6px)` (13 elemen) dan nilainya pulih ke 1 dalam ~400 ms — jadi motion *berjalan*, tetapi 250 ms pertama layout terlihat kosong/rusak. Screenshot pada 150 ms menunjukkan area hero benar-benar kosong. Ini yang membuat kesan "tidak ada animasi".
2. **`AnimatePresence initial={false}` membunuh animasi banner pertama.** `initial={false}` menonaktifkan animasi untuk child yang di-mount pertama kali — dan itulah kasus paling umum (error validasi pertama, konfirmasi simpan pertama). Terukur: banner error muncul dengan `opacity:1, transform:none` pada 50 ms (tanpa animasi).
3. **`useReducedMotion()` mengembalikan `null` pada render pertama.** Untuk pengguna `prefers-reduced-motion`, `opacity:0` tetap ter-emit pada paint pertama. Terukur: `min:0, avg:0.133` pada 120 ms (seharusnya sudah 1).
4. **Aturan CSS `[data-motion-reveal]` dibuang oleh minifier.** Ketika diletakkan *di dalam* blok `@media (prefers-reduced-motion)` yang sudah ada, Lightning CSS/Turbopack membuang rule tersebut. Harus berupa blok `@media` top-level terpisah.
5. **`motion[as]` diindeks di dalam komponen** sehingga identitas komponen berubah setiap render dan state animasi hilang.
6. **Hydration mismatch pada setiap `motion.button` dengan `whileTap`.** Framer Motion menambahkan `tabindex="0"` hanya di client, tidak di SSR, sehingga React mencatat error hydration di setiap halaman (dev badge "1 Issue").

**Perbaikan:**
- `components/motion/reveal.tsx` ditulis ulang: `MOTION_TAGS` di module scope, `data-motion-reveal` pada setiap node motion, dan **mengembalikan elemen biasa** saat reduced motion (bukan `motion` + `initial={false}`).
- Stagger hero dirapatkan (`staggerChildren: 0.024`, `delayChildren: 0`) dan kartu form tidak lagi memakai `delay: 0.08`, sehingga konten terbaca segera.
- `initial={false}` dihapus dari **empat** `AnimatePresence` (landing, members, tasks, member profile). Satu pemakaian yang sah tetap dipertahankan: `app/page.tsx:187` (`AnimatePresence mode="wait"` untuk swap form ⇄ panel sukses) — di situ `initial={false}` benar karena entrance sudah ditangani parent, dan tanpa itu form akan fade-in dua kali.
- `app/globals.css`: rule `[data-motion-reveal] { opacity:1 !important; transform:none !important }` dipindah ke blok `@media (prefers-reduced-motion: reduce)` **top-level** tersendiri.
- `tabIndex` di-pin eksplisit pada semua `motion.button` yang memakai `whileTap` (`components/ui/primitives.tsx`, `theme-toggle.tsx`, `app/page.tsx`, `result-client.tsx`).

> Temuan tambahan (audit ulang setelah restart server): `app/p/[code]/members/[id]/member-profile-client.tsx` juga memakai `AnimatePresence initial={false}`, sehingga konfirmasi simpan **pertama** tidak beranimasi. Sudah diperbaiki dan diverifikasi: banner 0 → 0,34 → 0,75 → 0,91 → 1 dalam ~120 ms, `translateY` −4px → 0.

**Bukti runtime setelah perbaikan (diukur, bukan diklaim):**

| Pemeriksaan | Sebelum | Sesudah |
|---|---|---|
| Landing, opacity rata-rata per 100 ms | 0,07 → 0,19 → 0,34 → 0,92 (≈400 ms) | 0,07 → 0,13 → 0,50 → 0,98 (≈300 ms) |
| Banner error landing, per frame setelah klik | `opacity:1, transform:none` pada 50 ms (**tidak beranimasi**) | 0 → 0,60 → 0,85 → 0,94 → 1 dalam ~130 ms, `translateY` −3px → 0 |
| Banner status tasks setelah klik template | instan | 0 → 0,40 → 0,78 → 0,92 → 1 dalam ~110 ms, `translateY` −4px → 0 |
| Banner error members setelah submit kosong | — | `opacity:0,885`, `translateY:−0,231px` pada 40 ms; selesai 120 ms |
| Banner sukses member profile setelah simpan | tidak beranimasi | 0 → 0,34 → 0,75 → 0,91 → 1 dalam ~120 ms, `translateY` −4px → 0 |
| Baris anggota (data nyata, 3 anggota) | — | 0,91 / 0,78 / 0,49 (stagger terlihat) → 1 pada 200 ms kemudian |
| Daftar tugas (data nyata, 6 tugas) | — | 0 → 0,07 → 0,77 → 1, bertahap per item, ~300 ms |
| Reduced motion @120 ms | `min:0, avg:0,133` | `min:1, avg:1` |
| Reduced motion, members & tasks | konten tersembunyi | `min:1` pada pengamatan pertama, tidak pernah < 1 |
| Hydration warning | 4+ per navigasi, badge "1 Issue" | 0 di semua route, badge kosong |

**Route yang diperiksa dengan browser:** `/`, `/how-it-works`, `/p/[code]/members`, `/p/[code]/members/[id]`, `/p/[code]/tasks`, `/p/[code]/result`. Semua 0 runtime exception. Tidak ada horizontal overflow pada 390/768/1280 px.

### Aksesibilitas
- `prefers-reduced-motion`: dilindungi di dua lapis — CSS global (animasi/transisi → 0,01 ms, plus override `[data-motion-reveal]` agar paint pertama selalu terlihat) **dan** `useReducedMotion()` di setiap komponen motion.
- `:focus-visible` outline tetap ada (biru 600 / biru 400 di dark).
- `aria-pressed`, `aria-label`, `aria-invalid`, `aria-live`, `aria-busy`, `<caption class="sr-only">` ditambahkan pada matriks dan tabel.

### Batasan yang dipertahankan
Tidak ada perubahan pada `lib/scoring/**`, `app/api/**`, migration, RLS, integrasi Gemini, maupun validasi bisnis. Seluruh angka pada UI berasal dari `globalAssign` dan data proyek aktual.

## Cara Menjalankan
```bash
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm run test
npm run build
```

## Catatan Terbuka

### Bug yang ditemukan saat verifikasi runtime (BUKAN akibat perubahan UI — laporkan, tidak diperbaiki)

Verifikasi motion pada `/p/[code]/result` tidak bisa diselesaikan karena halaman gagal total dengan error
`{"error":"Embedding missing for task … member …"}`.

**Penyebab 1 — `lib/ai/embedding-cache.ts`: tipe kolom tidak cocok.**

> **DIPERBAIKI pada [T-2.04].** Lihat "Perbaikan Embedding Cache" di akhir dokumen. Catatan lama dipertahankan sebagai riwayat.

Kolom `embedding_cache.embedding` bertipe `vector(768)` (migration 001), tetapi kode menganggapnya JSONB
(komentar `// stored as JSONB column`). PostgREST mengembalikan kolom vector sebagai **string**,
sehingga `Array.isArray(data.embedding)` selalu `false` → cache **tidak pernah hit** → `embedText` selalu
memanggil Gemini → tanpa `GEMINI_API_KEY` hasilnya `null` → semua cosine hilang.
Perbaikan yang diperlukan: parse string `"[0.1,0.2,…]"` menjadi `number[]` saat baca, dan kirim sebagai
literal vector saat tulis. Bukti: baris cache dengan hash yang benar sudah saya seed, lookup HIT, tetapi
nilainya tetap dibaca sebagai string (`typeof === 'string'`, `isArray === false`).

**Penyebab 2 — `lib/scoring/assign.ts:62-64` melempar error alih-alih memakai mode cadangan.**

> **DIPERBAIKI pada [T-2.03].** Lihat bagian "Perbaikan FR-13" di bawah. Catatan lama dipertahankan sebagai riwayat.

Saat salah satu `rawCosine` `undefined`, fungsi `throw` — padahal `pipeline` sudah melaporkan
`isEmbeddingFailed: true` dan `route` sudah mengirim `isFallback: true` ke `globalAssign`.
Akibatnya mode cadangan (S 0,50 / C 0,33 / M 0,17, FR-13) tidak pernah aktif; halaman hasil justru gagal.
Perbaikan yang diperlukan: gunakan `rawCosine = 0` ketika embedding tidak tersedia dan `isFallback` aktif.
**Tidak diperbaiki** sesuai keputusan pengguna (scoring engine di luar batas perubahan).

> Dampak produk: setiap penggunaan tanpa `GEMINI_API_KEY` (atau saat Gemini gagal) membuat halaman
> rekomendasi tidak bisa dipakai sama sekali, padahal PRD menjanjikan fallback.

---

## Perbaikan FR-13 — Mode Fallback ([T-2.03], PRD 8.6)

### Akar masalah

1. **Fallback tidak aktif.** `assign.ts` melempar `Embedding missing for task … member …` begitu satu
   `rawCosine` `undefined`, tanpa memeriksa `isFallback`. Route menerjemahkan throw itu menjadi HTTP 500,
   sehingga pengguna tidak mendapat rekomendasi sama sekali saat Gemini gagal.
2. **Bobot fallback tidak dipakai.** `FALLBACK_WEIGHTS` didefinisikan di `lib/scoring/constants.ts`
   tetapi tidak pernah diimpor. `globalAssign` dan `computeScore` memakai literal bobot standar
   `{K:0.40, S:0.30, C:0.20, M:0.10}`, dan `result-client.tsx` selalu mengirim bobot standar.
   `K` memang sudah dinolkan (`score.ts`), tetapi **total maksimum tertahan di 0,90**, bukan 1,00.

### Perubahan (4 berkas kode + 1 tes)

| Berkas | Perubahan |
|---|---|
| `lib/scoring/assign.ts` | Gunakan `FALLBACK_WEIGHTS` saat `isFallback`; bolehkan `rawCosine` tidak tersedia hanya pada mode cadangan (`undefined` tidak pernah diganti angka cosine buatan) |
| `lib/scoring/score.ts` | Terapkan `FALLBACK_WEIGHTS` saat `isFallback`, apa pun bobot yang dikirim pemanggil; default memakai `DEFAULT_WEIGHTS` |
| `app/api/recommend/route.ts` | `isFallback: isFallback === true \|\| cosineResult.isEmbeddingFailed` (satu variabel untuk hasil dan respons) |
| `app/p/[code]/result/result-client.tsx` | Kirim/muat `FALLBACK_WEIGHTS` saat mode cadangan, snapshot bobot hybrid, slider `K` tidak dapat diubah saat cadangan |
| `test/scoring/fallback.test.ts` | 27 tes regresi (A–H) |

Rumus AI (`0.40K + 0.30S + 0.20C + 0.10M`) dan bobot PRD tidak diubah. R1–R5 tidak disentuh.

### Bukti

- `POST /api/recommend` (proyek `080b709e…`, tanpa `GEMINI_API_KEY`): **HTTP 500 → HTTP 200**, `isFallback: true`, 7/7 tugas terisi.
- 21 skor kandidat dari respons API dihitung ulang dengan `FALLBACK_WEIGHTS`: **0 selisih**.
- UI: `K 0% · S 50% · C 33% · M 17%`, `Σ 100%`, slider K `disabled`, banner "Mode cadangan aktif".
- 7 baris matriks UI dibandingkan dengan skor backend: **7/7 identik, 0 selisih**.
- `test/scoring/fallback.test.ts`: 27/27 lulus. Suite non-integrasi: 150/150 lulus.

### Catatan terbuka (di luar lingkup T-2.03, tidak diubah)

- `result-client.tsx` mengirim bobot standar pada fetch awal (`hybridWeightsRef`). Aman karena backend
  mengabaikan bobot pada mode cadangan, tetapi permintaan pertama belum "sadar mode".
- Error non-AI (body JSON rusak) masih dibalas dengan teks parser mentah pada HTTP 500. Bukan
  penyamaran sebagai fallback, hanya pesan yang kurang rapi.
- `test/integration/fr04_fr05_smoke.test.ts` tetap flaky bila dijalankan paralel dengan suite lain
  (timeout 5000 ms ke Supabase live). Lulus bila dijalankan sendiri.

### Verifikasi motion yang belum bisa dilakukan
- Matriks rekomendasi, `ScoreBar` tumbuh ke nilai aktual, `LoadMeter` saat bobot digeser, lock, swap,
  dan undo **belum terverifikasi visual** karena halaman hasil gagal render (lihat di atas). Implementasi
  ada di `result-client.tsx` dan `components/motion/score-bar.tsx`, tetapi saya **tidak** mengklaim
  animasi tersebut berhasil sampai halaman bisa dimuat dengan data nyata.
- Yang sudah terverifikasi pada route hasil: state error tampil dengan pesan jelas (bukan spinner
  menggantung), 0 runtime exception.

### Backlog fitur
- FR-16 (event logging) dan FR-20 (navigasi keyboard lanjutan: `L` untuk lock, panah antar-sel, `Ctrl/Cmd+Z`) belum lengkap.
- FR-17 (perbandingan) belum dimulai.
- `test/api/member-profile.test.ts` memiliki 2 warning `@typescript-eslint/no-unused-vars` yang sudah ada sebelumnya (tidak mengubah hasil: 0 error).

---

## Perbaikan Embedding Cache ([T-2.04], PRD 10.3)

### Akar masalah

Bentuk data aktual yang dikembalikan Supabase untuk `vector(768)`, diperiksa langsung ke database
(bukan diasumsikan):

```
typeof embedding: string   |  Array.isArray: false
prefix: "[0,0.000252,0.000504,0.000757,..."
length: 6757 karakter
```

PostgREST mengembalikan kolom pgvector sebagai **literal teks**, bukan array JSON. Kode lama:

```ts
return Array.isArray(data.embedding) ? data.embedding : null;  // selalu null
```

`Array.isArray()` pada string selalu `false`, sehingga **setiap** cache read mengembalikan `null`.
`embedText` lalu selalu memanggil Gemini dan menulis ulang baris yang sama: tidak pernah ada cache hit,
dan PRD 10.3 ("nilai embedding disimpan dalam cache berdasarkan hash teks") tidak pernah efektif.

Arah **tulis tidak** bermasalah: array JS maupun literal teks sama-sama diterima PostgREST (keduanya
diuji, keduanya tersimpan). Bug murni di sisi baca, ditambah dua kelemahan: tidak ada validasi 768/NaN
pada jalur baca, dan konstanta dimensi terduplikasi di tiga berkas.

### Perubahan (3 berkas implementasi + 2 tes)

| Berkas | Perubahan |
|---|---|
| `lib/ai/embedding-cache.ts` | `parseEmbedding()` menerima literal pgvector **dan** array; `serializeEmbedding()` menulis literal (6 desimal, jauh di bawah batas 2KB PostgREST); `isValidEmbeddingValues()` menolak ≠768 atau NaN/Infinity; `EMBEDDING_DIMENSION` jadi satu-satunya sumber; `setCachedEmbedding` menolak vektor tidak valid dan melempar bila write gagal |
| `lib/ai/analyze-task.ts` | Memakai `isValidEmbeddingValues()` (bukan cek panjang saja) sebelum menyimpan |
| `lib/scoring/pipeline.ts` | `isValidEmbedding()` didelegasikan ke validator cache; konstanta dimensi duplikat dihapus |
| `test/ai/embedding-cache.test.ts` | **Baru**, 32 tes serialisasi |
| `test/ai/embedding.test.ts` | Fixture diperbaiki: `[0.1,0.2,0.3]` (3 dimensi) tidak mungkin ada di `vector(768)` |

Skema database, migration, rumus AI/fallback, dan R1–R5 tidak diubah.

### Bukti (database live)

- Vektor tersimpan diparse: **768 dimensi**, semua finite, round-trip **max abs diff 0**.
- Tulis lalu baca lewat `setCachedEmbedding`/`getCachedEmbedding`: **768 dimensi**.
- `embedText` pada teks yang sudah ter-cache: **0 panggilan `embedContent`**.
- Payload nyata, kode lama vs baru: lama `null`, baru `768 dims, all finite`.

### Catatan terbuka (di luar lingkup T-2.04)

- Belum diverifikasi dengan `GEMINI_API_KEY` aktif (key masih belum diisi). Cache hit dibuktikan memakai
  baris yang ditulis oleh kode sendiri, bukan hasil Gemini sungguhan.
- Nama model embedding (`text-embedding-004`) belum diverifikasi terhadap `ai.models.list()`.

---

## Integrasi Gemini & Batas Panggilan ([T-2.05])

### Status kredensial

`GEMINI_API_KEY` **tidak ada** di `.env.local` maupun shell env (diperiksa per nama key, nilai tidak pernah
dibaca). `.env.local` diabaikan Git (`.gitignore:34`). Sesuai instruksi, tidak ada koneksi yang dicoba tanpa
kredensial dan tidak ada key palsu yang dibuat. Konsekuensi: **verifikasi live (langkah 8) terblokir.**

### Temuan: pelanggaran NFR-06

`computeTaskMemberCosineMap` memanggil `embedText` **sekali per tugas dan sekali per anggota**
(`Promise.all`). Proyek seed 7 tugas + 3 anggota = **10 panggilan Gemini** untuk satu proses rekomendasi,
sementara PRD 6.1 / NFR-06 membatasi **maksimal 3**. Tidak ada penghitung panggilan maupun penjaga batas di
mana pun. Ragam `embedContentBatch` tidak ada di SDK 3.3.0, tetapi `EmbedContentParameters.contents` menerima
`string[]` dan `EmbedContentResponse.embeddings` mengembalikan satu entri per input dengan urutan sama
(diverifikasi dari `genai.d.ts`), sehingga satu panggilan bisa memuat semua teks.

### Perubahan (3 implementasi + 2 tes)

| Berkas | Perubahan |
|---|---|
| `lib/ai/analyze-task.ts` | `embedTexts(texts[])` baru: saring cache hit lebih dulu, kirim **satu** permintaan untuk sisanya, validasi tiap hasil, simpan yang valid. `embedText` menjadi pembungkus tipis |
| `lib/scoring/pipeline.ts` | Gabungkan teks tugas + anggota menjadi satu panggilan `embedTexts` |
| `test/scoring/pipeline.test.ts` | Mock dipindah dari `embedText` ke `embedTexts`; ditambah tes batch tunggal |
| `test/ai/gemini-integration.test.ts` | **Baru**, 15 tes integrasi + batas panggilan |
| `test/ai/gemini-models.live.test.ts` | **Baru**, 4 tes live yang di-skip eksplisit tanpa key |

Rumus AI/fallback, R1–R5, skema DB, dan migration tidak diubah. Tidak ada dependency baru.

### Bukti jumlah panggilan (Postgres asli, Gemini di-mock)

```
COLD: gemini calls=1, batch sizes=[10]   tasks=7 members=3 failedPairs=0
WARM: gemini calls=0 (all from cache)
```

Analisis tugas sudah berupa satu permintaan untuk semua tugas ("Semua tugas dianalisis dalam satu permintaan
Gemini", PRD). Jadi anggaran satu proses = **1 (analisis) + 1 (embedding) = 2**, di bawah batas 3.

### Hasil pemeriksaan

| Gerbang | Hasil |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx eslint` | 0 error, 2 warning lama |
| `test/ai` | 61 lulus, 4 skipped (live) |
| `test/scoring` | 60 lulus |
| Suite non-integrasi | 188 lulus, 4 skipped |
| `npm run build` | PASS, exit 0 |

### Belum selesai (terblokir kredensial)

1. `ai.models.list()` belum dijalankan; model `gemini-2.5-flash` dan `text-embedding-004` masih **asumsi
   default kode**, belum terbukti tersedia untuk key Anda. Jalankan
   `GEMINI_API_KEY=... npx vitest run test/ai/gemini-models.live.test.ts` untuk memverifikasi.
2. Analisis tugas nyata, rekomendasi dengan AI aktif, `isFallback=false`, dan cache hit lintas proses dengan
   embedding Gemini sungguhan belum dijalankan.
3. `outputDimensionality: 768` didukung SDK, tetapi **belum diketahui apakah model embedding yang tersedia
   memerlukannya**; kode saat ini tidak mengirimnya karena dimensi default model tidak terverifikasi.
4. Tabel `ai_runs` ada di schema 001 tetapi **tidak dipakai kode mana pun** (pencatatan jumlah panggilan dan
   token, NFR-43/44, belum diimplementasikan).




---

## Finalisasi Fase 2 — Penjelasan AI, AiRun, Guard Panggilan ([T-2.FINAL])

Menutup tiga celah T-2.05: **FR-09 penjelasan AI**, **NFR-43/44/45 observabilitas AiRun**, dan
**guard yang benar-benar menghentikan panggilan keempat**.

### 1. Guard batas panggilan (NFR-06) — nyata, bukan hanya di tes

`lib/ai/call-budget.ts` mendefinisikan `AiRun` sebagai objek yang membungkus **setiap** panggilan provider.
`track(kind, model, usage, fn)` memesan slot sebelum `fn` dijalankan dan melempar `CallBudgetExceededError`
pada percobaan ke-4, sehingga request tidak pernah sampai ke jaringan. Slot tetap terpakai walau `fn` gagal:
request yang gagal sudah keluar dari mesin, jadi retry juga harus dihitung.

Dibuktikan dengan probe yang menghitung pemanggilan tingkat provider:

| Skenario | Panggilan `embedContent` | Hasil |
|---|---|---|
| Budget habis (3 slot terpakai), lalu `embedTexts` | **0** | slot `null`, tidak ada request |
| Percobaan ke-4 `run.track` | **0** | `CallBudgetExceededError` |

### 2. FR-09 Penjelasan AI

| Berkas | Peran |
|---|---|
| `lib/ai/explain.ts` | Satu panggilan untuk seluruh tugas (utama + alternatif). Mode fallback **tidak memanggil Gemini sama sekali** dan selalu memakai template |
| `lib/ai/explanation-validator.ts` | Zod + validator fakta: menolak persentase/rasio buatan, nama anggota yang bukan subjek, skill di luar `required_skills`, angka yang tidak dihasilkan perhitungan, target tak dikenal |

Jika satu penjelasan gagal validasi, **hanya pasangan itu** yang kembali ke template; penjelasan lain yang sah
tetap dipakai. Skor dan pemilihan anggota tidak pernah berubah oleh penjelasan (diuji).

### 3. AiRun (NFR-43/44/45)

Satu baris per proses, ditulis di `app/api/recommend/route.ts` (dan `analyze-task`) melalui
`lib/ai/ai-run.ts`. Kolom live yang tersedia hanya `project_id`, `prompt_tokens`, `completion_tokens`,
`model`, `status`, `created_at`.

| Informasi PRD | Status | Bagaimana |
|---|---|---|
| projectId | Tersimpan | kolom `project_id` |
| Token masuk/keluar | Tersimpan | `prompt_tokens` / `completion_tokens` dari `usageMetadata`; **`null` bila provider tidak melaporkan** |
| Mode hybrid/fallback | Tersimpan | kolom `status` = `success` \| `fallback` \| `error` |
| Jumlah panggilan Gemini | **Tidak ada kolom** | diukur dan diakses sebagai `gap.callCount`; tidak diarang ke kolom lain |
| Durasi proses | **Tidak ada kolom** | diukur sebagai `gap.durationMs` |
| Informasi galat | **Tidak ada kolom** | disanitasi (`sanitizeErrorMessage`) lalu di `gap.errorMessage` dan log server |

Kegagalan penulisan AiRun **tidak** menggagalkan rekomendasi (diuji untuk insert yang ditolak maupun yang melempar).

### 4. Kinerja (PRD 6.1)

| Operasi | Hasil terukur |
|---|---|
| Recompute fallback (4 anggota, 15 tugas) | **1,34 ms** (batas < 1 detik) |
| Recompute hybrid per pergerakan slider | **0,35 ms** (batas < 100 ms) |
| Interaksi lokal (slider, kunci, undo) di browser | **0 request jaringan** |

### 5. Bukti end-to-end terhadap database live

```
POST /api/recommend -> HTTP 200
  isFallback: true            (tanpa GEMINI_API_KEY; embedding gagal → FR-13)
  tasks: 7  members: 3
  assignment[0].K: 0          (bobot fallback, bukan cosine buatan)
  reason: "Sari memiliki keterampilan relevan (penulisan akademik) dengan skor kesesuaian 67% ..."
                            (template, karena mode fallback)
ai_runs total: 3  (satu per proses)
  15:37:06 status=fallback model=text-embedding-004 prompt=null completion=null
  15:37:52 status=fallback model=text-embedding-004 prompt=null completion=null
  15:38:01 status=fallback model=text-embedding-004 prompt=null completion=null
```

Token `null` adalah perilaku yang benar: provider tidak dapat dihubungi, jadi tidak ada angka yang dikarang.

### 6. Perubahan pada UI terkait AI

| Temuan | Perbaikan |
|---|---|
| Hasil analisis AI langsung menimpa `required_skills`/`effort` tanpa konfirmasi | `tasks-client.tsx` sekarang menampilkan panel **"Saran analisis AI"**; penulisan hanya terjadi setelah menekan "Terapkan saran" |
| Pesan error JSON mentah bisa muncul di UI | `/api/analyze-task` dan `/api/recommend` mengembalikan pesan stabil; detail asli (disanitasi) hanya ke log server |
| Input deskripsi > 500 karakter | Ditolak Zod di route analisis (`max(500)`), sesuai PRD |

### 7. Berkas berubah / dibuat (T-2.FINAL)

| Berkas | Jenis | Alasan |
|---|---|---|
| `lib/ai/call-budget.ts` | baru | Guard 3 panggilan + pengukuran token/durasi |
| `lib/ai/ai-run.ts` | baru | Penulisan satu baris AiRun per proses, best-effort |
| `lib/ai/explanation-validator.ts` | baru | Zod + validasi fakta FR-09 |
| `lib/ai/explain.ts` | baru | Penjelasan satu panggilan, fallback template |
| `lib/ai/analyze-task.ts` | ubah | Rute panggilan lewat guard, `outputDimensionality: 768`, token usage |
| `lib/scoring/pipeline.ts` | ubah | Menerima `AiRun` |
| `app/api/recommend/route.ts` | ubah | AiRun per proses, penjelasan, pesan error aman |
| `app/api/analyze-task/route.ts` | ubah | AiRun, batas 500 karakter, pesan error aman |
| `app/p/[code]/tasks/tasks-client.tsx` | ubah | Review-before-apply untuk saran AI |
| `test/ai/ai-run-explanations.test.ts` | baru | 32 tes (guard, AiRun, validator, penjelasan) |
| `test/ai/call-budget-scenarios.test.ts` | baru | Anggaran panggilan di 20 skenario D2 |
| `test/api/recommend-route.test.ts` | baru | 13 tes route: AiRun, token, fallback, ketahanan |
| `docs/PHASE_2_ACCEPTANCE.md` | baru | Matriks penerimaan |
| `docs/STATUS.md` | ubah | Dokumen ini |

Tidak diubah: formula AI/fallback, R1–R5, `score.ts`, `assign.ts`, `rules.ts`, `constants.ts`, skema DB,
semua migration, dependency. Tidak ada commit/push/deploy.

### 8. Masih terblokir

1. **Verifikasi live Gemini.** `GEMINI_API_KEY` tidak ada. Model `gemini-2.5-flash` / `text-embedding-004`
   masih asumsi default kode. Jalankan `GEMINI_API_KEY=... npx vitest run test/ai/gemini-models.live.test.ts`.
2. Jalur hybrid (`isFallback=false`, `K > 0`) belum pernah dieksekusi dengan provider nyata; hanya lewat tes
   dengan provider di-stub.
3. Kolom AiRun untuk `call_count`, `duration_ms`, `error_message` tidak ada di skema live. Perlu migration
   aditif pada fase berikutnya (tidak dilakukan sekarang karena dilarang mengubah migration).

---

## Fase 3 — Penerimaan UI, Interaksi, dan Bukti Uji

Seluruh bukti di bawah diambil dari aplikasi yang berjalan (`next dev` di `:3000`,
`next build && next start` di `:3100`), dengan proyek uji terisolasi yang dibuat
**lewat API publik aplikasi sendiri** lalu dihapus setelah pengujian. Tidak ada
data proyek pengguna yang disentuh, tidak ada commit/push/deploy.

### Cacat nyata yang ditemukan lewat uji browser, lalu diperbaiki

| # | Cacat | Akar masalah | Perbaikan | Bukti sebelum → sesudah |
|---|---|---|---|---|
| 1 | Slider bobot tidak mengubah skor sama sekali di mode cadangan | `globalAssign` **dan** `computeScore` menimpa bobot pemanggil dengan `FALLBACK_WEIGHTS` (`isFallback ? FALLBACK_WEIGHTS : …`), sehingga nilai slider berubah tetapi hasil selalu sama | Bobot pemanggil dihormati (`options.weights ?? (isFallback ? FALLBACK_WEIGHTS : DEFAULT_WEIGHTS)`); `K` tetap 0 saat cadangan | Skor tetap identik untuk S=0,05…0,95 → **S=1,0 memberi total 100/90/80%**; bobot default tanpa argumen tetap 0,808 = rumus FR-13 |
| 2 | Panah keyboard tidak memindahkan sel aktif | `onKeyDownCapture` memanggil `stopPropagation()` sehingga `onKeyDown` di elemen yang sama tidak pernah menerima panah | Handler capture dihapus (baris tabel sudah cukup) | `arrowMovedCell: false` → **`true`** (kanan lalu bawah berpindah) |
| 3 | Label "Σ 100%" selalu berwarna merah | Pembanding `weightSumLabel(weights) === '100%'` tidak pernah cocok karena labelnya `'Σ 100%'` | Helper `weightSumIsExact()` + 2 tes regresi | `text-danger` → **`text-muted`** |
| 4 | Ekspor menulis bobot yang salah | Header salin-teks menulis "S 0,50 / C 0,33 / M 0,17" secara hardcode pada mode cadangan | Mencetak bobot yang benar-benar dipakai | `Cadangan (K dihilangkan, S 0,50 …)` → **`Cadangan (K 0% / S 62% / C 25% / M 13%)`** |
| 5 | "Batalkan" pada pratinjau tidak menutup menu "Pindahkan ke" | `setPreview(null)` saja; menu tetap `aria-expanded="true"` sehingga klik berikutnya justru menutup menu | Batalkan juga `setMoveTarget(null)` + status | Klik ulang macet → **menu terbuka lagi**, pratinjau hilang |
| 6 | Perubahan bobot tidak bisa di-undo | `handleWeightChange` tidak pernah mengisi `undoEntry` | Snapshot sekali per gestur drag (`weightUndoRef`), ditutup saat pointer-up/blur | Tidak ada tombol Undo → **"Diurungkan: Ubah bobot."**, bobot kembali 0,50/0,33/0,17 |
| 7 | Ctrl+Z diabaikan saat fokus di slider | `isTypingTarget` menganggap semua `input` sebagai kolom teks | `input[type=range]` dikecualikan | Ctrl+Z tidak bereaksi → **mengurungkan perubahan bobot** |
| 8 | Halaman melebar 281 px di viewport 390 px | Sel header `sticky left-0` tidak punya leluhur ber-`position`, sehingga tabel 860 px lolos dari kotak `overflow-x-auto` | `relative` pada kontainer scroll (dikomentari agar tidak dihapus) | `documentElement.scrollWidth` 671 → **390** di 390/768/1024/1280 |
| 9 | Hydration mismatch di `/` saat `prefers-reduced-motion` | `useReducedMotion()` bernilai `false` di server dan `true` di klien, sehingga pohon SSR ≠ klien | Hook `usePrefersReducedMotion` berbasis `useSyncExternalStore` dengan snapshot server `false`, dipakai semua komponen motion | 1 error konsol → **0**, di 20 kombinasi rute × tema × reduced-motion |

### Hasil uji interaksi (satu alur, 1280 px, 0 error konsol)

- **FR-08/09** — 7 baris × 28 sel; panel rincian muncul saat fokus, berada di aliran dokumen (`position: relative`), memuat K/S/C/M + kalimat alasan.
- **FR-10** — input → matriks berubah **0 request jaringan**; readout "Hitung ulang terakhir" nyata (6,5 ms tanpa throttle; **maks 32,5 ms** pada 4× CPU throttle, build produksi).
- **FR-12** — bobot C/Tinggi memindahkan penanggung jawab: **"1 tugas berpindah penanggung jawab"**, 1 baris tersorot `bg-clay`.
- **FR-20** — panah berpindah sel (`true`), Enter menetapkan **tanpa mengunci** (`data-locked="false"`), `L` mengunci (`true`), Ctrl/Cmd+Z membuka kunci.
- **Guard mengetik** — `L` di dalam `<select>` tidak mengunci apa pun (delta 0).
- **FR-18** — pratinjau menampilkan delta beban (Tomi 7→19 jam, Rizky 18→6 jam), **0 request jaringan**, Terapkan mengunci tugas, lalu bisa di-undo.
- **FR-11** — tukar dua tugas berhasil (status menyebut kedua judul).
- **FR-14** — CSV 7 baris dengan BOM dan kutip RFC-4180; salin-teks 18 baris.
- **FR-17** — "Bandingkan dengan awal": "3 tugas berubah skor tanpa berganti penanggung jawab".
- **FR-16** — 8 POST `/events` tercatat; kegagalan log tidak memutus UI.

### Aksesibilitas & responsif

- Kontras: **29 pasangan warna PASS** (light & dark) lewat `antislop-human/contrast-check.py`, termasuk `bg-clay`, `bg-sky`, `bg-sage`, `text-ok`, `text-warn`, `text-danger`. Rentang 4,60:1 – 16,27:1.
- 20 kombinasi rute (`/`, `members`, `tasks`, `result`, `how-it-works`) × tema (light/dark) × `prefers-reduced-motion`: **semua HTTP 200, tanpa overflow horizontal, tanpa error konsol**.
- 390/768/1024/1280 px: tanpa overflow halaman, matriks menggeser di dalam kontainernya sendiri, **0 target sentuh < 24 px**.

### Batasan yang tetap terbuka (tidak disamarkan)

1. **Jalur AI live tidak terverifikasi** — `.env.local` hanya berisi `SUPABASE_URL` dan `SUPABASE_SECRET_KEY`; `GEMINI_API_KEY` kosong. FR-06 dan jalur hybrid FR-09 **BLOCKED**, bukan PASS. Semua bukti di atas berasal dari **mode cadangan**.
2. **`globalAssign` dapat memilih kandidat yang gugur R2 dengan total 0** bila tidak ada kandidat layak. Ini perilaku mesin yang sudah ada, ditampilkan apa adanya sebagai sel "gugur" + alasan R2 eksplisit; tidak diubah diam-diam.
3. **`test/integration/fr04_fr05_smoke.test.ts` flaky bila diparalelkan** dengan suite lain (lulus 8/8 saat dijalankan sendiri dengan dev server aktif). Sudah tercatat sebelumnya, bukan regresi Fase 3.

---

## Fase 3.VISUAL — Redesain Visual Catalis

Redesain visual penuh untuk kelima rute, tanpa mengubah perilaku produk. Bukti dan alasan
per keputusan ada di `docs/VISUAL-CATALIS.md`.

### Token & tipografi

- Palet Catalis dengan token semantik **lama dipertahankan** (`paper`, `surface`, `card`, `ink`,
  `muted`, `line`, `accent`, `sage`, `clay`, `sky`, `k`, `s`, `c`, `m`) supaya 56 komponen yang
  sudah memakainya ikut berubah tanpa ditulis ulang; ditambah `mist`, `fog`, `cloud`, `accent-tint`.
- Kanvas `#FFFFFF`, Ink `#0B1220`, Azure `#2F66FF`, Azure Tint `#EAF0FF`, Mist `#F5F7FB`,
  Cloud `#E6EAF2`, Slate `#4A5568`, Fog `#8B95A7`. Ketiga konteks tema (light eksplisit, dark
  eksplisit, `prefers-color-scheme`) mendefinisikan token yang sama.
- **Inter Tight** untuk display, **Inter** untuk body/UI, **Instrument Serif** italic untuk satu
  kata aksen per judul, **Geist Mono** hanya untuk angka. Ketiganya sudah ada di
  `next/dist/compiled/@next/font/dist/google/font-data.json` — **tidak ada dependensi baru**.

### Bug nyata yang ditemukan lewat instrumentasi browser, lalu diperbaiki

1. `RevealGroup` bersarang tetap `opacity: 0` (langkah 01–04 dan register skor tampil sebagai kotak
   kosong). Penyebab: anak varian Framer Motion hanya beranimasi saat induknya sendiri sedang
   bertransisi. Diperbaiki dengan prop `nested`.
2. Wordmark footer terpotong oleh `leading-[0.78]` di dalam `overflow-hidden`.
3. Slider bobot tampil **tanpa track** setelah stylesheet ditulis ulang (utilitas memasang
   `appearance: none`, aturan lama hilang). Diperbaiki dengan aturan track/thumb eksplisit.
4. `--cloud` dipakai tetapi tidak pernah didefinisikan.
5. **Tiga 404 di konsol produksi pada `/result`**: `href` navigasi dibangun dari `resolvedCode`
   yang masih `''` saat paint pertama, sehingga Next mem-prefetch `/p/members`. Diperbaiki dengan
   tidak merender tautan tab sampai kode tersedia.

### Uji perilaku (desktop 1440 px, mode cadangan)

| Yang diuji | Hasil terukur |
|---|---|
| Slider bobot < 100 ms, tanpa jaringan | **21 event input**, frame terburuk **25 ms**, rata-rata **11 ms**; label aplikasi "Hitung ulang terakhir: **4,6 ms**"; **0 permintaan jaringan** |
| Panah pindah sel | `ArrowRight` dan `ArrowDown` mengubah sel fokus |
| Enter menetapkan | 3 sel `aria-pressed="true"` setelah Enter |
| `L` mengunci | baris `data-locked="true"` = 1 |
| `Ctrl+Z` undo | `data-locked` kembali `false` |
| Tombol Undo di toolbar | mengunci lalu membuka lagi dengan benar |
| Pintasan saat mengetik | fokus di `BUTTON`/input, `L` tidak mengunci apa pun |
| Ekspor CSV | unduhan terjadi; satu-satunya permintaan adalah `POST .../events`, **tidak ada panggilan Gemini** |
| Cincin fokus sel | `rgb(47, 102, 255)` (Azure), 2 px |
| What-if | pratinjau muncul dan bisa dibatalkan |
| Validasi form | nama kosong → "Nama anggota wajib diisi."; jam `0` → pesan inline |
| Tambah anggota/tugas lewat UI | anggota 3→4, tugas 3→4, pesan status benar |

### Uji rute, tema, lebar, dan reduced motion

- **40 kombinasi** (5 rute × 4 lebar 390/768/1024/1280 × 2 tema): **0 overflow horizontal,
  0 error konsol**. Satu-satunya temuan "target kecil" adalah `<input>` 1×1 milik checkbox
  `sr-only` di dalam pil skill; label yang benar-benar diklik berukuran **32 px** dan label kunci
  35 px.
- **Reduced motion di kelima rute**: `hiddenMotion=0` — tidak ada elemen yang tertinggal
  transparan atau bergeser; semua kontrol tetap berfungsi.
- Navigasi tab antar rute: URL benar (`/p/<code>/tasks`, `/p/<code>/result`) dan matriks muncul
  dengan 3 sel utama, **0 error**.
- **Build produksi** (`npm run build`) sukses; `next start` pada port 3100: kelima rute **HTTP 200,
  0 overflow, 0 error konsol**.
- Regresi: `vitest run --exclude 'test/integration/**'` = **287 lulus + 4 dilewati (22 berkas)**;
  `test/integration` = **8/8 lulus** saat dijalankan sendiri (lihat catatan kerapuhan di bawah);
  `tsc --noEmit` bersih; `eslint` 0 error.

### Perbaikan tambahan di putaran akhir

- **Kontras aksen di atas plat bertinta diperbaiki.** Azure `#2F66FF` di atas Mist hanya 4,38:1.
  Plat formula `/how-it-works` jadi putih (4,70:1); hasil contoh dan chip `accent` memakai token
  baru `accent-strong` (`#1D4ED8` terang / `#9FB4FF` gelap) → 6,70:1 di putih, 5,87:1 di tint.
- **Label putih pada tombol aksen.** Putih di atas `#2F66FF` = 4,70:1, tapi `#0B1220` di atasnya
  hanya 2,79:1. `--accent-ink` karena itu putih di tema terang (berbalik jadi `#060A14` di tema
  gelap), dan semua aksi utama memakai `bg-accent-strong` sehingga labelnya lolos AA.
- **`--fog` digelapkan** dari `#8B95A7` (3,02:1 di putih) ke `#5B6172` (6,18:1) karena dipakai untuk
  teks meta 11px.
- **Target sentuh baris tugas.** `Ubah`/`Hapus` tadinya 28px; `Button size="sm"` kini `h-8` dengan
  `max-sm:h-11`, jadi 44px di layar ponsel tanpa mengubah kerapatan baris di desktop.

### Catatan jujur soal uji integrasi

`test/integration` memakai batas waktu bawaan Vitest **5000 ms** tanpa override, sementara satu
panggilan Supabase live memakan **0,4–1,2 detik** dan `4.b`/`4.h` merangkai beberapa panggilan.
Bila dijalankan beruntun tanpa jeda, kasus itu bisa melewati 5 detik (`Test timed out in 5000ms`).
Dijalankan sendiri dengan jeda, hasilnya **8/8 lulus tiga kali berturut-turut**. Ini kerapuhan
harness yang sudah ada sebelumnya, bukan regresi dari pekerjaan visual — tetapi dilaporkan apa
adanya, dan bukan diklaim sebagai "selalu hijau".

### Kebersihan data

Semua data uji dibuat lewat API publik aplikasi di proyek terisolasi berjudul `VISUAL-QA fixture`,
lalu dihapus. Satu proyek `Smoke Test FR04 FR05` yang tercipta pada sesi ini (karena `afterAll`
tidak sempat jalan saat uji timeout) juga dihapus. Proyek milik pengguna (`ac4e7767…`, kode
`b38e0efe…`, "dd") **tidak tersentuh**: 2 anggota, 1 tugas — sama seperti baseline. Total akhir
**17 proyek / 22 anggota / 16 tugas / 5 kejadian**.

### Batasan yang tetap terbuka

`GEMINI_API_KEY` tetap tidak ada, jadi jalur AI live **tetap BLOCKED** dan seluruh bukti di atas
berasal dari mode cadangan. Status FR-06/FR-09 tidak berubah menjadi PASS.

---

## Fase 3.MOTION — Scroll-driven experience

Tahap ini **hanya menambah gerak dan koreografi**; tidak ada rumus, API, kontrak, atau semantik data
yang berubah. Tujuh file disentuh (lihat `docs/VISUAL-CATALIS.md` §C–§D untuk mekanismenya).

### Prinsip yang dipegang

- **Tidak ada dependency baru.** `framer-motion@14.14.0` sudah terpasang dan mengekspor
  `useScroll`, `useTransform`, `useMotionValueEvent`, `useSpring`, `useInView`; diverifikasi langsung dari `node_modules`.
- **Tidak ada `setState` per frame scroll.** Reveal memakai `whileInView` (IntersectionObserver,
  `once: true`). Efek yang benar-benar terikat posisi scroll (drift hero, garis rel langkah,
  indikator progres halaman) memakai `useScroll({ target })` → `useTransform` → ditulis ke
  `transform` saja. Terukur: ~2,8 tulisan atribut DOM per frame scroll, seluruhnya style.
- **Heading tetap satu text node.** `MaskLine` menutup blok dengan `overflow: hidden` lalu
  menggeser blok itu; kata/kalimat tidak dipecah. Pembungkusan baris tetap pembungkusan CSS asli di
  semua lebar, screen reader membaca satu kalimat, tidak ada pengukuran layout, tidak ada
  hydration mismatch.

### Bug nyata yang ditemukan saat implementasi

| # | Bug | Cara ketahuan | Perbaikan |
|---|---|---|---|
| 10 | Semua headline tersembunyi permanen: `whileInView` dipasang pada elemen yang sedang `translateY(105%)` di dalam mask, sehingga IntersectionObserver melaporkannya ~2% terlihat dan ambang `amount: 0.2` tidak pernah terpenuhi | Instrumentasi `getComputedStyle().transform` pada span dalam: nilainya tetap `translateY(105%)` setelah 3 detik | Observer dipindah ke kotak luar (yang tetap punya ukuran layout); elemen dalam digerakkan lewat variant. Berlaku sama untuk `DrawRule` (`scaleX(0)`) dan bar skor |
| 11 | Dua bintang berdampingan di eyebrow hero: `SectionMark` sudah menggambar bintangnya sendiri, lalu `StarEntry` menambah satu lagi | Screenshot 390 px | Bintang milik `SectionMark` yang dianimasikan; tidak ada bintang kedua |
| 12 | Form terus mengambang selamanya; klik sintetis tidak pernah bisa mencapai tombol karena target tidak pernah "stabil" — dan bagi pengguna, form yang bergerak saat dibidik memang bermusuhan | Playwright `element is not stable` berulang | Float berhenti permanen setelah ~4,2 detik atau pada interaksi pertama di dalam panel |
| 13 | `aria-invalid` tetap `"true"` dan pesan error tetap tampil setelah pengguna memperbaiki isian; error hanya hilang saat submit berikutnya | Uji status form | Tiap field membersihkan error-nya sendiri saat diubah. Validasi wajib **tidak** dihapus — tetap berjalan di `handleSubmit` |
| 14 | Pesan error muncul dua kali (banner ringkasan + pesan di bawah field), sehingga screen reader mengumumkannya dua kali | Probe jumlah node yang mengekspos teks yang sama | Banner menjadi live region yang mengumumkan sekali dengan kalimat umum; pesan spesifik hidup di bawah field dan terikat lewat `aria-describedby` |
| 15 | Di bawah `prefers-reduced-motion`, garis rel "Alur Produk" dirender dengan skala 1 — mengklaim perjalanan sudah selesai tanpa scroll | Sampling `[data-motion-scroll]` pada mode reduced | Garis azure tidak dirender sama sekali pada reduced motion; rel tinggal hairline biasa |
| 16 | Garis rel selesai menggambar sebelum section terlihat (rentang `start 0.8 → end 0.6` terlalu sempit untuk blok pendek) | Sampling transform pada beberapa posisi scroll | `SCROLL.progress` dilebarkan ke `start 0.95 → end 0.25`; terukur 0,46 → 0,72 → 0,91 → penuh |

### Pengukuran aktual

| Metrik | Hasil |
|---|---|
| Slider bobot (21 event `input`) | max 7 ms/frame, rata-rata 3 ms, **0 request jaringan** |
| Label "Hitung ulang terakhir" | 1,8 ms |
| Scroll penuh `/` dengan CPU throttle 4× | script 75 ms, layout 15 ms (22 pass), style 87 ms |
| Mutasi DOM saat scroll murni | 85 mutasi / 30 frame (semua style, bukan render ulang React) |
| Matriks 6 rute × 6 lebar (320/375/390/768/1024/1280) | 36/36 bersih: overflow 0, tidak ada elemen tersembunyi, 0 error konsol |
| Reduced motion + dark + reduced-dark (6 rute × 3 mode) | 18/18 bersih; 0 penanda scroll dirender pada reduced motion |
| Kontras pasangan baru | `accent-strong` di Mist 6,25:1; K 4,70:1; S 5,26:1; C 5,91:1; M 7,38:1; fog di Mist 5,76:1 — semua ≥ AA |

### Bukti fungsi tidak berubah

`Ctrl/Cmd+Z`, panah, `Enter`, `L`, lock tombol, undo tombol, what-if, ekspor CSV, dan banner fallback
diuji ulang di build produksi: panah memindah sel, `Enter` menerima (3 sel `aria-pressed`), `L`
mengunci lalu `Ctrl+Z` melepas (1 → 0), ekspor mengunduh dan hanya memanggil
`POST /api/projects/[code]/events` (tanpa Gemini), banner cadangan tetap ada setelah scroll.
Shortcut tidak aktif saat fokus di input teks (`typing l ctrl` tetap literal) maupun saat fokus di
slider (`L` tidak mengunci, panah menggerakkan slider 0,50 → 0,51).

### Catatan jujur soal uji integrasi (fase ini)

`test/integration/fr04_fr05_smoke.test.ts` **flaky karena lingkungan**, bukan karena kode. Selama
sesi ini suite yang sama memberi hasil 8/8 lulus dan 7 gagal bergantian tanpa perubahan kode apa pun.
Mekanismenya sudah ditelusuri:

1. `4.a` membuat proyek lewat Supabase; round-trip ke Supabase terukur **196 ms – 5733 ms** pada sesi
   ini (satu panggilan pernah melebihi seluruh anggaran 5000 ms milik test).
2. Test tidak punya override timeout, jadi `4.a` gagal; `testProjectId` tidak pernah terisi.
3. Tujuh test setelahnya ikut gagal dengan `400` karena memakai id `undefined` — **satu akar
   masalah, bukan tujuh bug**.
4. Saat jaringan sedang buruk, `4.a` bahkan gagal dengan `TypeError: fetch failed` (HTTP 500).
5. Karena `afterAll` tidak pernah jalan pada run yang gagal, run tersebut **meninggalkan baris** di
   basis data. Baris bocor dari sesi ini sudah dihapus dan dihitung ulang.

Hasil terakhir saat jaringan sehat: **8/8 lulus pada timeout default 5000 ms**. File test tidak
diubah (mtime 16 Nov, untracked sejak sebelum fase ini).

### Batasan yang tetap terbuka

`GEMINI_API_KEY` masih tidak ada → jalur AI live tetap **BLOCKED**; seluruh bukti di atas berasal
dari mode cadangan. Jumlah proyek di basis data kembali ke baseline **18**
(17 baseline + satu proyek `"rfsfsd"` milik pengguna tanggal 18 Nov yang **tidak** disentuh);
member 22, task 16, events 5 — sama seperti sebelum sesi ini.

## Fase 4.EVAL — Evaluasi & Validasi Terukur (T-4.MASTER)

Fase ini **hanya mengevaluasi**; tidak mengubah formula, bobot, R1–R5, candidate selection, global
assignment, arsitektur AI, fallback, schema DB, atau kontrak API. Satu-satunya perubahan produk:
`vitest.config.ts` menambahkan `exclude: ['node_modules/**', '.git/**', 'eval/**']` agar suite
produk (`npm test`) tidak menyapu harness evaluasi — **tidak** melonggarkan assertion produk.

Seluruh artefak ada di `eval/` (laporan A–P, dataset, library, runner, hasil JSON/CSV, instrumen).
Putusan lengkap: `eval/reports/A_P_FINAL.md`. Reproduksi: `npx vitest run --config
eval/vitest.eval.config.ts` (tidak butuh Gemini key / DB).

### Putusan: **LULUS BERSYARAT** — Status akhir: **READY WITH BLOCKERS**

| Aspek | Putusan | Bukti utama |
|---|---|---|
| D1 (11 template + 15 non-IT sintetis) | **LULUS** | `eval/reports/B_DATASET.md`, `results/dataset_summary.json` |
| D2 (tepat 20 skenario, 15 kondisi) | **LULUS** | `validateD2` lulus, semua kondisi tercakup |
| D3 (data kelompok nyata) | **BLOCKED** | tanpa persetujuan peserta; tidak dipalsukan |
| R1–R5 valid+edge pada engine asli | **LULUS BERSYARAT** | `eval/reports/D_HARD_RULES.md`, 15 kasus; 2 perilaku tak terdefinisi PRD dicatat sebagai open decision |
| 4 metode pembanding (hybrid, random-30-seed, round-robin, manual) | **LULUS** | `C_METHODS.md`, `results/methods_summary.{json,csv}` |
| Skill coverage (eksplisit, bukan cosine) | **LULUS** | `E_SKILL_COVERAGE.md` |
| Load balance (deviasi, stddev, pelanggaran R2) | **LULUS** | `F_LOAD_BALANCE.md` |
| Human agreement (3 reviewer) | **BLOCKED** | `G_HUMAN_AGREEMENT.md` + instrumen; 0 reviewer |
| Ablation K deterministik (proxy) | **LULUS** | `H_ABLATION.md` — 25,7% keputusan berubah, Δ coverage = 0 |
| Ablation K live (embedding semantik) | **BLOCKED** | tanpa `GEMINI_API_KEY` |
| Truthfulness penjelasan | **LULUS** | `I_TRUTHFULNESS.md` — `memberReason` 33/33 benar; `generateExplanation` 2 bertentangan |
| AI call budget (logika `AiRun`) | **LULUS** | `J_AI_CALL_BUDGET.md` — cap 3/proses terbukti |
| Budget live (token/latency provider) | **BLOCKED** | tanpa key |
| Robustness offline (#2,#6,#7) | **LULUS** | `K_ROBUSTNESS.md`; injeksi prompt tidak mengubah pemilik |
| Robustness provider live (#1,#3,#4,#5,#8,#9,#10) | **BLOCKED** | mock berlabel, tidak diklaim live |
| Performa komputasi + slider/what-if UI | **LULUS** | `L_PERFORMANCE.md` — P95 0,49 ms; slider 2,5 ms (11,6 ms @4×), 0 jaringan |
| Alur end-to-end < 1 detik | **GAGAL (environmental)** | `/api/recommend` 2,1–3,5 s; Supabase median 279 ms/round-trip |

### Hasil utama (angka)

| Metrik | Hybrid | Random (30×) | Round-robin | Manual |
|---|---|---|---|---|
| Skill coverage | 0,808 | 0,754 | 0,808 | **0,867** |
| Stddev beban | 5,62 | 5,30 | **3,88** | 5,62 |
| Pelanggaran R1 | **0** | 31 | 2 | 2 |
| Pelanggaran R3 | 1 | 147 | 4 | **0** |
| Pelanggaran R2-akhir | 24 | 752 | **18** | 24 |
| Fit | 0,645 | 0,585 | 0,674 | 0,668 |

- Hybrid **satu-satunya** dengan R1 = 0 dan pelanggaran kapasitas terendah (3 vs 6/5).
- Hybrid **tidak unggul** pada coverage (manual unggul) maupun σ beban (round-robin unggul).
- Pada **15/18** skenario yang hybrid langgar R2, **tidak ada metode** yang bisa bebas R2
  (pelanggaran struktural dari data).
- Ablation K (proxy): 25,7% keputusan berubah tetapi Δ coverage = 0 → **bukan** bukti K bermanfaat.

### Temuan produk yang perlu ditindak (bukan blocker evaluasi)

1. **`generateExplanation` tidak jujur pada jalur cadangan.** Fungsi ini (dipakai sebagai teks
   cadangan `lib/ai/explain.ts`) menghasilkan klaim **bertentangan** ("sisa kapasitas memadai" saat
   C=0) dan **tidak didukung** ("skor 0%" afirmatif). `memberReason` (dirender & diekspor) 33/33
   benar. Rekomendasi: jadikan `memberReason` satu-satunya sumber teks alasan (lihat
   `eval/reports/O_RECOMMENDATIONS.md` #1).
2. **Flakiness integrasi (environmental).** `test/integration` bergantung Supabase (latensi
   196 ms–5733 ms, sesekali `fetch failed`); satu kegagalan `4.a` memicu cascade 7 gagal. Teramati
   langsung sesi ini: run sehat 8/8, satu run **7/8 gagal**, lalu 8/8 lagi. Run gagal dapat
   meninggalkan baris `Smoke Test FR04 FR05`; baris bocor hari ini **dibersihkan terarah**, dua
   proyek `Smoke Test` **2026-11-17 pre-existing dipertahankan**. Tidak ada timeout/assertion yang
   dilonggarkan. Rekomendasi: stabilkan tanpa melemahkan assertion (O#5).

### Blocker yang tetap terbuka (tidak disamarkan sebagai PASS)

`GEMINI_API_KEY` masih tidak ada → FR-06/FR-09 live, ablation live, budget live, robustness provider
live, dan efektivitas penangkal prompt-injection nyata tetap **BLOCKED**. Human agreement **BLOCKED**
(tanpa 3 reviewer). D3 **BLOCKED** (tanpa persetujuan). Alur end-to-end **> 1 detik** karena latency
DB (bukan algoritma: komputasi < 1 ms).

### Bukti uji akhir (Fase 4)

| Pemeriksaan | Hasil |
|---|---|
| `npx tsc --noEmit` | **0 error** |
| `npx eslint .` | **0 error** (2 warning pre-existing) |
| `npx vitest run --exclude 'test/integration/**'` | **287 lulus / 4 skip** (22 berkas) — suite produk utuh |
| `npx vitest run --config eval/vitest.eval.config.ts` | **7 berkas / 14 test lulus** |
| `npx vitest run test/integration` | **8/8** pada run sehat; terbukti flaky (1× 7/8 gagal) |

### Baseline database (rekonsiliasi)

Audit read-only: **19 projects / 24 members / 17 tasks / 5 events**. Selisih terhadap laporan lama
(18/22/16) = **+1 proyek, +2 anggota, +1 tugas**, **semuanya milik proyek `"ggg"` milik pengguna**
(`heri`/`veri`, dibuat 2026-11-19) yang **tidak dibuat oleh skrip evaluasi dan tidak disentuh**.
Rincian lengkap di `eval/reports/00_AUDIT.md`. Fixture `EVAL-PERF fixture` dibuat lewat API lalu
**dihapus**; setelah seluruh sesi DB kembali ke **19/24/17/5** tanpa fixture tersisa.

### Syarat untuk Fase 5 (READY WITH BLOCKERS)

1. Satukan alasan ke `memberReason` (hapus jalur cadangan yang tidak faktual) — O#1.
2. Uji jalur AI live dengan `GEMINI_API_KEY`: ablation live (bobot S/C/M tetap), budget live,
   robustness provider live, injeksi prompt nyata — O#2.
3. Sediakan 3 reviewer untuk human agreement — O#3.
4. Stabilkan integrasi tanpa melonggarkan assertion — O#5.
5. Tetapkan keputusan produk untuk perilaku "no-R2-candidate" / "semua capacity 0" — O#7.
6. Kumpulkan D3 hanya bila ada persetujuan — O#4.

## Fase 2.AUDIT — T-2.06 Audit Integrasi Gemini API (read-only)

Audit akar masalah mengapa aplikasi localhost **selalu fallback** meski `GEMINI_API_KEY` ada.
Laporan lengkap + bukti baris: `eval/reports/T-2.06_GEMINI_INTEGRATION_AUDIT.md`.
**Tidak ada perubahan source code / data / secret / cache** pada audit ini.

### Putusan: **GAGAL** (integrasi Gemini tidak dipakai; aplikasi selalu fallback)

### Akar masalah: konfigurasi model basi → provider 404

`.env.local` memuat **kedua** kunci dan keduanya **valid** (`ListModels` mengembalikan 65 model),
tetapi **nama model-nya tidak tersedia lagi** (probe live, tersanitasi):

- `GEMINI_MODEL_TEXT=gemini-2.5-flash` → **404** "no longer available to new users".
- `GEMINI_MODEL_EMBED=text-embedding-004` → **404** "not found for ... embedContent".

Rantai fallback: `embedTexts` (`analyze-task.ts:135`) → 404 → `catch {}` (`analyze-task.ts:160-162`)
menelan error → vektor `null` → `pipeline.ts:86` `isEmbeddingFailed=true` → `route.ts:85`
`isFallbackMode=true` → `globalAssign`/`explainAssignments` fallback (`route.ts:88-101`) →
`ai_runs` `status=fallback`.

### Bukti live (server produksi `next start -p 3100`)

- `POST /api/recommend` proyek nyata → **HTTP 200**, `isFallback: true`, `cosineMap[task]` = `{}`
  (peta anggota kosong, tanpa nilai cosine). Halaman tetap tampil, tetapi **tanpa AI**.
- `ai_runs` terbaru: `model=text-embedding-004, status=fallback, prompt_tokens=null`.
- `embedding_cache`: **0 baris** (tidak ada embedding yang pernah berhasil disimpan).
- Uji model pengganti (live): `gemini-embedding-001` OK (dim 768), `gemini-3.8-flash` OK.

### Model yang terbukti bekerja (untuk perbaikan konfigurasi, belum diterapkan)

| Peran | Sekarang (404) | Usulan (teruji OK) |
|---|---|---|
| Text | `gemini-2.5-flash` | `gemini-3.8-flash` (atau `gemini-3.5-flash-lite`) |
| Embedding | `text-embedding-004` | `gemini-embedding-001` (dim 768) |

### UI sudah jujur

Banner **"Mode cadangan aktif (tanpa AI)"** tampil saat `isFallback` (`result-client.tsx:793-804`);
label bobot **"Cadangan (S/C/M)"** vs **"Hybrid (K/S/C/M)"** (`result-client.tsx:959`). Jadi masalah
murni backend, bukan UI menyesatkan.

### AiRun & batas 3 panggilan

`MAX_GEMINI_CALLS_PER_PROCESS=3`; `AiRun.track` memesan slot sebelum panggil & menolak ke-4;
**cache hit tidak dihitung** (di-`continue` sebelum `pending` di `analyze-task.ts:117-127`). Pada
kondisi sekarang hanya 1 panggilan (embedding) lalu fallback — tidak melampaui batas.

### Cacat observability sampingan (dicatat, belum diperbaiki)

1. **Error asli disembunyikan**: `analyze-task.ts:160-162` `catch {}` kosong + skema `ai_runs` tanpa
   kolom `error_message` (`ai-run.ts:7-17`) → operator melihat "fallback" tanpa sebab.
2. **Redaksi kunci tidak cocok format `AQ.`**: `KEY_PATTERN`/`sanitizeForLog` hanya mengenali
   `AIza…`; kunci saat ini `AQ.Ab8…` **tidak diredaksi** (uji: 0 match vs 1 match `AIzaSy…`).

### Rekomendasi perbaikan minimal

1. (Konfigurasi, bukan kode) ubah `.env.local`: `GEMINI_MODEL_EMBED=gemini-embedding-001`,
   `GEMINI_MODEL_TEXT=gemini-3.8-flash`. Lalu verifikasi `isFallback:false`, `cosineMap` berisi nilai,
   `embedding_cache` bertambah.
2. (Opsional, butuh persetujuan — mengubah kode) teruskan error embedding ke log/`run.noteError`
   agar 404 tidak lagi tampak seperti fallback normal; tidak mengubah mekanisme fallback.
3. (Opsional, butuh persetujuan) perluas pola redaksi ke format `AQ.…`.

### Catatan integritas data

Audit read-only: tanpa hapus cache/ubah Supabase/ubah source. Baseline DB berubah karena **aktivitas
pengguna** (proyek baru `"algoritma"` 2026-11-19T03:37 + anggota + event `assignment_changed`), bukan
audit; semua milik pengguna dan tidak disentuh. Alur `POST /api/recommend` menambah 1 baris
`ai_runs` (observability by design) dan 0 baris `assignments`.

## Fase 2.VERIFY — T-2.07 Verifikasi Perbaikan Konfigurasi Gemini (live)

Perbaikan **konfigurasi saja** (`.env.local`, 2 baris) + verifikasi live. Laporan lengkap:
`eval/reports/T-2.07_GEMINI_FIX_VERIFICATION.md`. **Tidak ada perubahan source code / schema DB**,
tanpa commit/push/deploy.

### Putusan: **LULUS BERSYARAT** (hybrid terbukti; penjelasan AI tertahan kuota provider)

### Perubahan yang diterapkan (hanya konfigurasi)

```
GEMINI_MODEL_TEXT   gemini-2.5-flash      -> gemini-3.8-flash
GEMINI_MODEL_EMBED  text-embedding-004    -> gemini-embedding-001
```
`GEMINI_API_KEY` dan variabel lain **tidak diubah** (panjang 53 tetap; nilai tidak dicetak).
Server verifikasi baru di port 3100 dengan env terkini; dev server pengguna (port 3000) tidak disentuh.

### Bukti live

| Kriteria | Hasil |
|---|---|
| `generateContent` (`gemini-3.8-flash`) | **OK** — `text="OK"`, tokens `{"p":8,"c":1}` |
| Embedding (`gemini-embedding-001`) | **OK** — **dim=768**, semua nilai finite |
| `POST /api/recommend` → `isFallback` | **`false`** ✔ |
| `cosineMap` berisi nilai cosine | **ya** — 2 pasangan: `0.493238`, `0.455944` (stabil di run #2) |
| Embedding tersimpan/dibaca dari cache | **ya** — `embedding_cache` 5 → **7** baris; run #2 tanpa tambahan (cache hit) |
| `ai_runs` status proses | **`status=success`** (+ token nyata `p=347, c=93`), bukan `fallback` |
| Total panggilan Gemini per proses ≤ 3 | **ya** — run #1 = 2 panggilan, run #2 = 1 panggilan |

Run #1 (cache dingin): HTTP 200, 109.6s. Run #2 (cache panas): HTTP 200, **25.5s**, `embedding_cache`
tidak bertambah → **cache hit tidak dihitung sebagai panggilan provider** (terbukti empiris, sesuai
`analyze-task.ts:117-127`).

### Yang belum lulus & sebab sebenarnya

**Penjelasan FR-09 belum terbukti dipakai per-run** karena kuota free tier habis:

```
429 RESOURCE_EXHAUSTED — generate_content_free_tier_requests, limit: 20,
model: gemini-3.8-flash, "requests per day limit exceeded on Free Tier",
retryDelay: 13080s (~3h38m)
```
Model **valid** (berhasil sebelumnya dengan token nyata); `gemini-embedding-001` dan model text lain
(`gemini-3.5-flash-lite`) masih OK pada kunci yang sama → ini **kuota per-model**, bukan konfigurasi.
Sesuai aturan, model **tidak** diganti spekulatif; `explain.ts:212-215` jatuh ke template dan run
tetap `success` (FR-09: kegagalan penjelasan bukan kegagalan skor).

### Pemeriksaan repo

```
npx tsc --noEmit                                  -> exit 0
npx eslint .                                      -> 0 error, 2 warning (pre-existing)
npx vitest run --exclude 'test/integration/**' --exclude 'test/ai/gemini-models.live.test.ts'
                                                  -> 21 files, 286 passed
npx vitest run test/ai/gemini-models.live.test.ts -> 4 lulus / 1 gagal (timeout 5000ms vitest,
                                                     karena kuota teks habis; file test tidak diubah)
```

### Integritas data

`projects` 20→20, `members` 28→28, `tasks` 18→18, `events` 11→11, `assignments` 0→0 (tanpa proyek/
anggota baru, tanpa hapus data, tanpa ubah schema). Bertambah: `embedding_cache` +2 (embedding proyek
uji `ggg`) dan `ai_runs` +2 (satu per proses rekomendasi — by design).

### Langkah berikut (butuh keputusan pengguna)

1. Ulangi satu `POST /api/recommend` setelah kuota reset (~3j38m) untuk membuktikan penjelasan FR-09
   dihasilkan Gemini (indikator: token text tidak null pada `ai_runs`).
2. Alternatif: `GEMINI_MODEL_TEXT=gemini-3.5-flash-lite` (kuota masih ada saat verifikasi) — **tidak**
   diterapkan karena nama model dikunci oleh instruksi T-2.07.

## Fase 5 — Laporan Akademik, Presentasi, dan Skrip Demonstrasi (T-5.MASTER)

Fase ini **hanya dokumentasi**. Tidak ada perubahan pada source code aplikasi, rumus dan bobot skor,
aturan R1–R5, algoritma penugasan, schema/data Supabase, environment variable, dataset, maupun hasil
evaluasi historis. Seluruh keluaran baru berada di `docs/laporan/`.

Catatan penting soal `eval/results/performance.json`: berkas itu **ditulis ulang** ketika skrip
`eval/scripts/run_performance.test.ts` dijalankan ulang untuk pemeriksaan. Tidak ada perubahan pada
skrip pengukurnya, dan tidak ada angka yang diubah secara manual. Hal ini dilaporkan terbuka karena
rentang hasilnya dipakai di laporan (lihat butir 3 di bawah).

### Putusan: **LULUS BERSYARAT**

Seluruh kriteria selesai Fase 5 terpenuhi sebagai artefak dokumentasi. Status "bersyarat" diberikan
karena tiga hal di luar kendali fase dokumentasi: identitas penyusun belum diisi, sejumlah klaim
kualitas masih terblokir (human agreement, D3, ablasi live), dan satu syarat Fase 4 (keputusan produk
no-R2-candidate) belum ditutup sehingga 24 pelanggaran R2 masih melekat pada narasi hasil.

### Berkas yang dibuat (semuanya baru, di `docs/laporan/`)

| Berkas | Isi |
|---|---|
| `00_MATRIKS_KETERLACAKAN.md` | Kontrak bukti: klaim → rujukan PRD/FR → bukti implementasi → bukti hasil → status. Memuat juga daftar klaim yang **sengaja tidak** dibuat |
| `01_REFERENSI.md` | 15 referensi terverifikasi (APA 7), masing-masing dengan catatan sumber pemeriksaan dan bagian laporan yang mengutipnya |
| `02_LAPORAN_AKADEMIK.md` | Identitas (placeholder), catatan format, **Bab 1** (1.1–1.6), **Bab 2** (2.1–2.12, termasuk diagram arsitektur dan ERD) |
| `03_HASIL_DAN_PEMBAHASAN.md` | **Bab 3** (3.1–3.11, Tabel 3.1–3.8, angka aktual) dan **Bab 4** (kesimpulan dan saran) |
| `04_SLIDE_PRESENTASI.html` | 12 slide mandiri, navigasi papan ketik, memakai token `DESIGN.md` proyek |
| `05_SKRIP_DEMONSTRASI.md` | 11 langkah demo, narasi, hasil yang diharapkan, bukti, antisipasi pertanyaan, dan daftar hal yang tidak boleh dijanjikan |

### Ringkasan isi laporan

- **Bab 1** membedakan masalah yang menjadi motivasi (tidak diukur) dari masalah yang benar-benar
  diukur. Tidak ada statistik mahasiswa atau data kampus yang dikarang.
- **Bab 2** menjelaskan setiap keputusan arsitektur dari dua sudut pandang (teknis dan produk), dan
  memuat koreksi teknologi: **Playwright tidak terpasang**, **Vercel tidak terbukti dipakai**.
- **Bab 3** memakai angka dari `eval/results/*.json`; tidak menyatakan hybrid sebagai metode terbaik
  secara keseluruhan; memisahkan waktu komputasi dari waktu respons.
- **Bab 4** memisahkan saran teknis jangka pendek, peningkatan evaluasi, dan pengembangan lanjutan.

### Angka hasil yang dipakai (dibaca ulang dari berkas hasil, bukan dari ringkasan lama)

| Metrik | Hybrid | Random | Round-robin | Manual |
|---|---|---|---|---|
| Skill coverage | 0,808 | 0,754 | 0,808 | **0,867** |
| Load stddev | 5,62 | 5,30 | **3,88** | 5,62 |
| Pelanggaran R1 | **0** | 31 | 2 | 2 |
| Pelanggaran R3 | 1 | 147 | 4 | **0** |
| Pelanggaran R2 final | 24 | 752 | **18** | 24 |
| Fit | 0,645 | 0,585 | **0,674** | 0,668 |

Ablasi: 25,7 % keputusan berpindah (9/35 tugas), Δ coverage = 0, `liveAblation: "BLOCKED"`.
Kejujuran: `memberReason` 33/33 benar; `generateExplanation` 16 benar / 8 tidak didukung /
2 bertentangan dari 26 klaim. Angka-angka ini konsisten dengan Fase 4.

### Inkonsistensi yang ditemukan dan cara laporan menyikapinya

1. **PRD v0.2 hanya memuat Bagian 1–7.** Brief Fase 5 merujuk Bagian 13, 14, 15, 16, dan `AGENTS.md`
   merujuk Bagian 8–12. Bagian-bagian itu **tidak ada** di `prd.md`. Konflik tidak diselesaikan dengan
   menebak: laporan memakai PRD Bagian 1–7 yang benar-benar ada ditambah brief Fase 5, dan mencatat
   syarat format sebagai **ASUMSI dari brief**. Rincian di `00_MATRIKS_KETERLACAKAN.md` §2.
2. **P95 komputasi bukan satu angka.** `L_PERFORMANCE.md` §1 mencatat P95 0,493 ms; `performance.json`
   pada saat audit berisi 0,972 ms; lima pengulangan menghasilkan P95 0,44–0,97 ms. Keduanya dari
   skrip yang sama, hanya pengukuran berbeda waktu. Laporan memakai **rentang** dan menyebut kedua
   sumber, bukan memilih angka yang paling menguntungkan. Kesimpulan (jauh di bawah 1000 ms) tidak
   berubah.
3. **Playwright.** Brief menyebut Playwright; paket itu **tidak terpasang** (`package.json`). Fase 4
   memakai Chromium headless lewat CDP. Laporan menyebut CDP, bukan Playwright.
4. **Template tugas.** Jumlah template yang benar adalah **11** (`id: 'T01'..'T11'`). Perhitungan
   naif atas kata `title:` menghasilkan 12 karena ikut menghitung field pada `interface`.

### Bukti pemeriksaan (dijalankan ulang 2026-11-19)

| Pemeriksaan | Hasil |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npx eslint .` | **0 error**, 2 warning (pre-existing) |
| `npx vitest run --exclude 'test/integration/**' --exclude 'test/ai/gemini-models.live.test.ts'` | **21 berkas / 286 test lulus** |
| `npx vitest run --config eval/vitest.eval.config.ts` | **7 berkas / 14 test lulus** |
| `npx vitest run eval/scripts/run_performance.test.ts` (5×) | lulus 5/5; P95 pipeline 20 skenario 0,44–0,97 ms |

Berkas Gemini live (`test/ai/gemini-models.live.test.ts`) dilaporkan terpisah: **4 lulus / 1 gagal**
(timeout 5000 ms Vitest saat kuota teks habis). Kegagalan ini tercatat di laporan, bukan disembunyikan.

### Status yang tidak dilebihkan

| Item | Status di laporan |
|---|---|
| FR-09 pemakaian Gemini per-run | **BELUM TERVERIFIKASI** (HTTP 429, kuota free tier). Tidak ditulis VERIFIED. |
| Human agreement | **BLOCKED**, 0 reviewer |
| D3 data kelompok nyata | **tidak ditemukan**, tanpa persetujuan |
| Ablasi live semantic embedding | **BLOCKED**, hanya proxy deterministik |
| Robustness provider live | **BLOCKED**; hanya 3 dari 10 kondisi teruji pada kode nyata |
| Performa end-to-end < 1 detik | **TIDAK TERCAPAI** (2,14–3,48 s, didominasi latensi DB) |
| Hybrid sebagai metode terbaik | **TIDAK DIKLAIM** |

### Identitas penyusun (selesai pada T-5.01)

Identitas final sudah tercantum di `02_LAPORAN_AKADEMIK.md` (§Identitas Penyusun) dan pada slide
pembuka `04_SLIDE_PRESENTASI.html`: Anthony Fernando Martono (25421892) sebagai penyusun, Rickel
Engsali Putra (25421946), Krisostomus Rendry (25421932), dan Deluis Reto Bapage (25421903) sebagai
anggota, dengan dosen pengampu Fredrikus Suarezsaga, S.T., M.T., Program Studi Teknik Informatika,
Universitas Widya Dharma Pontianak. Tidak ada gelar atau jabatan yang ditambahkan di luar data yang
diberikan pengguna.

### Syarat Fase 5

1. Terapkan tipografi laporan (A4, Times New Roman 12 pt, spasi 1,5, margin 4/3/4/3 cm) saat mengekspor
   Markdown ke pengolah kata; repository tidak punya mekanisme DOCX.
2. Putuskan apakah dua angka performa (0,493 vs 0,972) akan disatukan dengan satu pengukuran resmi
   sebelum sidang, atau tetap dilaporkan sebagai rentang seperti sekarang.

### Integritas data dan kode

Tidak ada perubahan pada `app/`, `components/`, `lib/`, `supabase/`, `eval/datasets/`, `eval/lib/`,
`.env*`, maupun isi angka pada `eval/results/*` yang dilakukan secara manual. Tidak ada commit, push,
atau deploy. Perubahan yang tercatat pada fase ini hanya: enam berkas baru di `docs/laporan/` dan
penambahan bagian ini di `docs/STATUS.md`. Status Fase 0–4 di atas **tidak diubah**.

### Langkah berikut (butuh keputusan pengguna)

1. Tutup syarat Fase 4 #1 (satukan alasan ke `memberReason`) dan #5 (keputusan no-R2-candidate);
   keduanya masih menjadi sumber 24 pelanggaran R2 dan 2 kontradiksi penjelasan yang dilaporkan.
2. Sediakan 3 reviewer dan/atau data D3 ber-persetujuan bila klaim kualitas menurut manusia ingin
   dibuat pada laporan akhir.
3. Jalankan ablasi live setelah kuota Gemini tersedia, supaya pertanyaan "apakah embedding semantik
   membantu" bisa dijawab dengan data sungguhan.

## Fase 3.T-5.02 — Perbaikan Visibilitas Teks pada Tombol Motion (FR-19)

**Putusan: LULUS.** Teks tombol tetap terbaca pada seluruh state dan seluruh lebar uji, motion
dipertahankan, dan tidak ada perubahan pada algoritma, rumus, bobot, basis data, API, maupun alur
bisnis.

### Tombol yang bermasalah

| Tombol | Lokasi | Bukti sebelum perbaikan |
|---|---|---|
| Buat proyek | `app/page.tsx` (CTA `group/cta`) | label keluar dari jendela klip saat roll penuh |
| Tambah anggota | `components/ui/primitives.tsx` lewat `Button` di `members-client.tsx` | label keluar dari jendela klip saat roll penuh |
| Kelola anggota | `app/page.tsx` (CTA `group/cta`, muncul setelah proyek dibuat) | cacat struktur yang sama |
| Semua tombol `Button`/`ButtonLink` berukuran `md`/`lg` | 28 pemakaian di 5 berkas | cacat struktur yang sama |

Tombol `size="sm"` tidak terkena: `shouldRoll = (roll ?? size !== 'sm') && !reduced` membuatnya
statis secara sengaja di dalam matriks yang padat.

### Akar masalah teknis

Ketiga situs roll memakai markup yang sama: jendela klip setinggi `1.35em` (`overflow-hidden`) berisi
tumpukan **dua** salinan label, masing-masing `1.35em`, lalu tumpukan digeser
`group-hover:-translate-y-full` (`--tw-translate-y: -100%`).

`-100%` mengacu pada tinggi **tumpukan**, bukan tinggi satu label. Tumpukan dua salinan setinggi
`2 × 1.35em = 37,8 px`, sedangkan jendela hanya `18,9 px`. Pada akhir animasi tumpukan bergeser
`37,8 px`, sehingga kedua salinan berada di atas jendela dan jendela menjadi kosong.

- `components/ui/primitives.tsx` baris 48–84 (sebelum perbaikan: baris 65 kelas roll, tiga salinan
  sempat dicoba dan tetap gagal).
- `app/page.tsx` baris 477–492 (`Buat proyek`) dan 562–577 (`Kelola anggota`).

Bukti terukur, bukan dugaan:

1. **Geometri.** Dengan roll penuh, kedua salinan berposisi `top 429,3` dan `448,2` sementara jendela
   klip `467,1–486,0`; `visibleInClip` bernilai `false` untuk keduanya.
2. **Piksel.** Sampel tinta di dalam jendela klip sepanjang roll: 34,68% (0%), 34,90% (25%),
   31,91% (50%), 30,80% (75%), dan **0,00% (100%)**.
3. **Enumerasi.** Untuk jumlah salinan N = 2..5, cakupan jendela terburuk selalu **0,0% pada progres
   100%**, karena jarak tempuh ikut bertambah bersama N. Menambah salinan tidak pernah memperbaiki
   cacat ini; yang harus berubah adalah jarak roll.

### Perubahan yang dilakukan

1. `components/ui/primitives.tsx`: kelas roll `RollLabel` menjadi
   `group-hover/btn:-translate-y-[1.35em] group-focus-visible/btn:-translate-y-[1.35em]`, dan tumpukan
   kembali ke **dua** salinan. Komentar fungsi diperbaiki agar menjelaskan geometri yang benar.
2. `app/page.tsx`: dua CTA manual memakai jarak yang sama, `group-hover/cta:-translate-y-[1.35em]`,
   dengan dua salinan.

Tidak ada perubahan pada font, warna, ukuran, atau layout tombol. Tidak ada `opacity` global yang
diubah, tidak ada teks duplikat baru sebagai workaround, dan tidak ada motion yang dihapus.

### Motion yang dipertahankan

Durasi `200 ms`, easing `--ease-out-expo`, pemicu `hover` dan `focus-visible`, pemicu tekan
`whileTap scale 0,975`, serta entrance/exit berbasis Framer Motion. Yang berubah hanya jarak tempuh
roll: dari tinggi tumpukan menjadi tepat satu tinggi label.

### Hasil pengujian state tombol

Diukur pada halaman berjalan (Chromium 1254 via CDP). Tinggi jendela klip dibandingkan dengan tinggi
label yang benar-benar terlihat di dalamnya; roll disuntikkan pada jarak `1.35em`

| State | Buat proyek | Tambah anggota | Kelola anggota |
|---|---|---|---|
| Initial render | label terlihat penuh (18,9/18,9 px) | 17,5/17,5 px | 18,9/18,9 px |
| Roll 25% | 18,9 px terlihat | 17,5 px | 18,9 px |
| Roll 50% | 18,9 px (serah-terima) | 17,5 px | 18,9 px |
| Roll 75% | 18,9 px | 17,5 px | 18,9 px |
| Roll 100% (ujung) | 18,9/18,9 px | 17,5/17,5 px | 18,9/18,9 px |
| Active/tekan | label utuh; `whileTap` tetap aktif | label utuh | label utuh |
| Focus-visible | aturan `-translate-y-[1.35em]` aktif | idem | idem |
| Light mode | teks `rgb(255,255,255)` di atas aksen | sama | sama |
| Dark mode | teks `rgb(6,10,20)`, kontras tetap | sama | sama |
| Reduced motion | tanpa roll, label polos tanpa klip (`salinanLabel: 0`) | idem | idem |

Tidak ada ancestor dengan `opacity < 1` pada kedua tombol, dan posisi vertikal jendela klip tetap
berada di tengah tombol (tidak bergeser saat roll).

### Hasil pengujian responsive dan reduced motion

`Buat proyek` diuji pada 320/390/768/1280 px: 224x44, 294x44, 648x44, dan 370x44 px. `Tambah anggota`:
232x36, 302x36, 168x36, dan 304x36 px. Tangkapan layar pada ujung roll menunjukkan teks utuh di
keempat lebar (tersimpan sementara di `/tmp/t502/`, tidak masuk repository). Tidak ada teks terpotong
dan tidak ada pergeseran layout. `prefers-reduced-motion: reduce` membuat `Button` merender label
polos tanpa klip, jadi teks tidak bergantung pada animasi.

### Hasil typecheck, lint, dan pengujian browser

| Pemeriksaan | Hasil |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `npx eslint .` | 0 error, 2 warning (sudah ada sebelumnya di `test/api/member-profile.test.ts`) |
| `npx vitest run` (tanpa integration dan live Gemini) | 21 berkas, 286 tes lulus |
| Console error halaman `/`, `/p/:code/members`, `/p/:code/tasks`, `/p/:code/result`, profil anggota | tidak ada |
| Fungsi tombol | pembuatan proyek menghasilkan kode dan tautan `/p/…/members`; penambahan anggota dan tugas tersimpan (3 anggota, 2 tugas) |

Audit ulang seluruh situs roll setelah perbaikan: `/` 2 situs, `/p/:code/tasks` 4 situs,
`/p/:code/members` 1 situs, profil anggota 1 situs, `/p/:code/result` 0 situs roll (semua tombolnya
`size="sm"` sehingga statis). Seluruhnya melaporkan jendela yang tertutup penuh pada 0/50/100%.

### Tombol yang masih bermasalah

Tidak ada.

### Catatan pengujian

Chromium headless melaporkan `hover: hover = false`, sehingga aturan `group-hover` yang dibungkus
Tailwind 4 dalam `@media (hover: hover)` tidak pernah aktif di lingkungan uji. Karena itu roll diuji
dengan menyuntikkan jarak `1.35em` yang sama seperti aturan CSS aslinya (terverifikasi ada di bundel
CSS terkompilasi: `--tw-translate-y: calc(1.35em * -1)`), lalu keterlihatan diverifikasi lewat
geometri dan sampel piksel. Ini bukan klaim bahwa hover diuji lewat pointer sungguhan.

### Integritas data dan kode

Perubahan hanya pada `components/ui/primitives.tsx` dan `app/page.tsx` (situs roll), ditambah bagian
ini. Tidak ada perubahan pada algoritma rekomendasi, rumus/bobot skor, skema basis data, API, maupun
alur bisnis pembuatan proyek dan anggota. Semua skrip probe sementara sudah dihapus. Tidak ada commit,
push, atau deploy; `git log` tetap hanya berisi `9b62e3d`.

### Data uji yang dibuat saat pengujian

Untuk menguji `/p/:code/result` dengan matriks nyata, dibuat satu proyek uji
`99ba8af0e0a00f1a08ca787c` berisi 3 anggota dan 2 tugas bernama "Uji T-5.02" melalui UI. Data ini
berada di basis data lokal, bukan di repository, dan bisa dihapus bila tidak diperlukan.

## Fase 3.T-5.03 — Scroll Experience dan Sidebar Glassmorphism (FR-19 lanjutan)

**Putusan: LULUS.** Sidebar glass dibuat baru di atas empat rute workspace, satu perangkat scroll
dipasang di `/how-it-works`, dan keduanya terbukti bekerja lewat pengujian browser nyata pada enam
lebar layar. Tidak ada perubahan pada algoritma, rumus/bobot skor, basis data, API, Gemini, maupun
Supabase.

### Titik awal: apa yang sebenarnya ada

Audit sebelum menulis kode (`docs/T-5.03-AUDIT.md`) menemukan bahwa aplikasi **tidak punya sidebar
sama sekali**. Navigasi workspace adalah bilah atas lengket `WorkspaceNav`. Satu-satunya `<aside>`
adalah panel bobot/beban kerja di `result-client.tsx`, dan itu bukan navigasi. Jadi tugas ini adalah
pembangunan chrome, bukan penggantian.

### Scroll Craft yang dipakai

Commit yang dibaca: `75d81f74e83692add18cd7a8a8e078b8a887a579` (v0.3.1, 2026-09-30), lisensi MIT
(Copyright 2026 Nate Herk). Mesinnya tidak disentuh dan seluruh dependensinya tidak dipasang. Yang
diambil hanya prinsipnya: satu perangkat per bagian, tujuan tiap interaksi, tanpa scroll hijacking,
tanpa pin-lock, tanpa panah "scroll cue", tanpa penghitung `01 / 06`.

### Berkas yang diubah

| Berkas | Perubahan |
|---|---|
| `components/ui/app-sidebar.tsx` | **baru**: rail glass, ikon SVG inline, pencocokan rute aktif, tooltip |
| `components/ui/workspace-shell.tsx` | **baru**: pemilik state ciut + laci, bilah atas mobile, `RailScrollProgress` |
| `components/ui/workspace-nav.tsx` | **dihapus** setelah `ScrollProgress`-nya dipindah ke shell |
| `app/globals.css` | token `--rail-*` (terang/gelap/sistem), `.rail`, `.rail-item`, `.rail-tip`, `.rail-drawer`, `.workspace-column` |
| `components/motion/reveal.tsx` | `ScoreWalkthrough` + `ScoreTerm` |
| `app/how-it-works/page.tsx` | `WALK_TERMS` dan pemakaian `ScoreWalkthrough` pada contoh perhitungan |
| `app/p/[code]/members/members-client.tsx` | `WorkspaceShell` |
| `app/p/[code]/tasks/tasks-client.tsx` | `WorkspaceShell` + reveal header |
| `app/p/[code]/result/result-client.tsx` | `WorkspaceShell` pada 4 cabang, kode mentah diteruskan |
| `app/p/[code]/members/[id]/member-profile-client.tsx` | `WorkspaceShell` pada 3 cabang + reveal header |

### Sidebar: spesifikasi yang dipenuhi

Tercepat dengan `getComputedStyle` di Chromium: lebar 265 px mengembang / 78 px menciut, radius 16 px,
`backdrop-filter: blur(20px) saturate(135%)`, border `rgba(255,255,255,0.16)`, pemisah
`rgba(255,255,255,0.10)`, transisi lebar `width 0.3s ease-in-out`.

Yang sengaja **tidak** diambil dari PDF spesifikasi: aksen merah `#D91E18`, gradien zinc, profil contoh
"Dorian", badge angka, menu Movies/Games/Home fiktif, kotak pencarian palsu, dan pustaka ikon
(`lucide-react`/`react-icons`). Ikon digambar sebagai SVG inline supaya tidak menambah dependensi.
Item rail hanya tautan yang benar-benar ada di aplikasi: Anggota, Tugas, Matriks rekomendasi untuk
rute workspace, ditambah Beranda dan Cara kerja.

Rail dan kolom konten bergerak bersama. Diukur setiap 40 ms selama transisi 300 ms, jarak
`mainX - railW` tetap **24 px** di ke-14 sampel sementara rail tumbuh 83 → 265 px. Tidak ada lompatan
187 px yang sempat terjadi sebelum `padding-left` ikut dianimasikan.

### Pengujian lebar layar

320 / 375 / 390 / 768 / 1024 / 1280 px, lima halaman (`/`, `/how-it-works`, members, tasks, result),
30 kombinasi. Hasil: **0 error konsol, 0 luapan horizontal** pada seluruh 30 kombinasi.

Satu regresi nyata ditemukan dan diperbaiki di sini: pada 320 px bilah atas mobile meluap 10 px karena
tombol "Matriks rekomendasi →" berbagi baris dengan pemicu Menu. Tombol aksi kini mendapat barisnya
sendiri di bawah bilah, dan chip kode dibatasi `max-w-[15rem]`.

### Aksesibilitas dan reduced motion

- Laci mobile: selalu 265 px penuh, scrim, kunci scroll latar, Escape menutup, fokus dipindah ke dalam
  laci, target sentuh 44 px, label selalu terlihat, dan `visibility:hidden` saat tertutup sehingga
  tidak bisa di-Tab.
- Fokus keyboard: Tab sungguhan lewat `Input.dispatchKeyEvent` mencapai kelima tautan rail,
  `:focus-visible` benar, outline 2 px, tooltip mencapai opacity 1.
- Reduced motion: 0 elemen motion, 0 teks tersembunyi, keempat suku skor pada opacity 1.
- Kontras teks rail di tema gelap terhadap pelat: 16,43:1.

### Batasan yang tidak bisa diuji

`hover: hover` tidak bisa disimulasikan di Chromium headless, sehingga jalur hover diverifikasi lewat
padanan `:focus-visible` dan pengukuran geometri, bukan pointer sungguhan. Playwright tidak terpasang;
pengujian browser dilakukan lewat Chrome DevTools Protocol pada Chromium headless, bukan suite
Playwright.

Pengujian juga sempat tertahan oleh dua hal yang bukan cacat kode: dev server Turbopack beberapa kali
menyajikan CSS lama (diperbaiki dengan berhenti, menghapus `.next`, dan menyalakan ulang), dan
`/api/recommend` kadang memakan 29–50 detik karena Gemini sehingga halaman Matriks perlu waktu tunggu
lebih panjang sebelum tabel muncul. Pada percobaan dengan waktu tunggu cukup, tabel, 4 slider, dan
panel beban kerja tampil dan bisa dipakai, dengan rail tetap tidak menutupi tabel (jarak 356 px).

### Perangkat scroll per halaman

| Halaman | Perangkat | Catatan |
|---|---|---|
| `/` | tidak diubah | sudah punya progress rail, masked lines, dan kinetic type dari Fase 3.MOTION |
| `/how-it-works` | `ScoreWalkthrough` | empat suku K/S/C/M naik dari 0,32 ke opacity 1 berurutan mengikuti posisi gulir; total tetap ada di DOM sejak paint pertama |
| members | reveal header (sudah ada) | 17 pemakaian `RevealGroup`/`RevealItem` |
| tasks | reveal header baru | hanya header; formulir di bawahnya statis agar tidak mengganggu pengetikan |
| profile anggota | reveal header baru | sama, hanya header |
| result | reveal yang sudah ada | panel bobot/matriks dibiarkan tenang |

### Integritas data dan kode

Tidak ada perubahan pada `lib/scoring/*`, `lib/ai/*`, `app/api/*`, `supabase/*`, `eval/*`, maupun
`lib/validation/*`. Waktu modifikasi berkas-berkas itu masih 11-15 s.d. 11-18, sebelum sesi ini dimulai
11-19. `git log` tetap hanya berisi `9b62e3d`. Tidak ada commit, push, atau deploy. Seluruh skrip probe
sementara sudah dihapus; lint kembali ke 2 peringatan lama di `test/api/member-profile.test.ts`.

### Hasil gerbang

| Gerbang | Hasil |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `npx eslint .` | 0 error, 2 peringatan lama |
| `npx vitest run` (tanpa integrasi/live) | 21 berkas, 286 tes lulus |
| `npx next build` | berhasil |

---

## Fase 3.T-5.04 - Transformasi Visual: Glass Sejati & Scroll per Halaman (FR-19 lanjutan)

**Putusan: LULUS.** Ini bukan pengulangan T-5.03. T-5.03 lulus secara teknis tetapi gagal secara
visual, dan audit terukur di `docs/T-5.04-VISUAL-AUDIT.md` menemukan penyebabnya di tingkat material,
bukan selera: plat sidebar T-5.03 **buram total** (`linear-gradient(rgb(27,35,51), rgb(19,26,39))`,
alpha = 1), sehingga `backdrop-filter: blur(20px)` tidak membiaskan apa pun. Efeknya hanya
menghaluskan tepi halaman yang lewat di bawah rail, persis seperti cat. Ditambah lagi, seluruh halaman
workspace berlatar putih polos, jadi tidak ada apa pun di belakang kaca untuk dibiaskan.

Perbaikan dilakukan pada dua lapisan: kanvas baru di belakang seluruh rute, lalu plat kaca yang
benar-benar tembus pandang. Bukti before/after: 28 PNG per set, diambil di mesin yang sama dengan
harness yang sama.

### Penyebab yang diukur, bukan ditebak

| Temuan audit | Bukti terukur |
|---|---|
| Plat sidebar tidak tembus pandang | `background-image` terhitung = alpha 1 pada kedua ujung gradient |
| `blur(20px)` tidak berefek | tidak ada latar yang bisa dibiaskan karena kanvas putih polos |
| Halaman workspace putih di bawah tabel | tabel mulai di `x = 633`, jauh dari rail, sisa kanan kosong |
| 3 dari 5 halaman statis terhadap scroll | members/tasks/result: opacity `1`, `transform: none` di semua posisi |
| Motion homepage selesai di paruh atas | hanya 32 elemen motion, tidak ada progress rail |
| `/how-it-works` hanya punya 4 suku | tidak ada tahapan K → S → C → M, tidak ada formula yang merakit |

### Kanvas: prasyarat kaca

`.app-canvas` dipasang sebagai **`background-image` milik `body`** (tiga wash radial dalam warna skor
produk + grid rambut 64 px, `background-attachment: fixed`), bukan sebagai pseudo-element. Percobaan
dengan `::before` di `z-index: -1` maupun `0` sama-sama terkomposit **di atas** rail fixed dan membuat
platnya terlihat kelabu. Karena itu `--paper` dipindah ke dalam `.app-canvas { background-color: var(--paper) }`
dan `body` menjadi `app-canvas min-h-full flex flex-col text-ink`.

### Glassmorphism sidebar

Plat dibangun ulang sebagai **dua lapis gradient** (kabut putih yang memudar di 38% + tint ink dengan
alpha), `backdrop-filter: blur(24px) saturate(165%)`, rim light di tepi atas, inner wash dari kiri,
contact shadow, dan far shadow. Ditambah `.rail-mark` sebagai tile merek yang menyala,
`.rail-item[data-active='true']` sebagai chip biru yang diterangi (bukan kotak biru datar), dan
kilau dalam saat hover/fokus.

Alpha plat diperlakukan sebagai **anggaran kontras**, bukan knob selera. Diukur terhadap kanvas terang:

| Alpha plat | Komposit | Kontras label redup | Kontras label terang |
|---|---|---|---|
| 0,50 / 0,62 (nilai awal) | `rgb(102,107,117)` | **3,28:1 (gagal AA)** | 4,77:1 |
| **0,74 / 0,84 (dipakai)** | `rgb(73,78,90)` | **8,68:1** | 7,42:1 |
| 0,86+ | `rgb(43,49,63)` | 9,34:1 | tetapi kanvas berhenti tembus |

Di bawah 0,72 label tidak lagi lolos 4,5:1 dan panel terbaca sebagai cat kelabu; di atas 0,86 kanvas
berhenti terlihat sehingga tidak lagi terbaca sebagai kaca. Pita 0,74-0,84 satu-satunya yang keduanya.
Tema gelap: 0,7 / 0,8 menghasilkan **10,84:1**. Ada fallback `@supports not` ke plat opak agar kontras
tidak bergantung pada dukungan `backdrop-filter`.

Di laci mobile plat sengaja **lebih padat** (+0,2 alpha atas, +0,12 bawah) karena menutupi konten penuh
setinggi layar: keterbacaan menang, tetapi blur dan haze tetap ada sehingga karakternya tetap kaca.

### Scroll per halaman

| Halaman | Perangkat scroll | Tujuan |
|---|---|---|
| `/` | `SectionRail` (indeks mini fixed di >=1280px) + `SECTION_TONE` band tonal + drift plat `KomposisiSkor` | memberi tahu **di mana** pembaca berada, bukan hanya seberapa jauh; tiap band berganti kedalaman |
| `/how-it-works` | `ScoreWalkthrough` dibangun ulang: K → S → C → M bertahap, tiap suku punya bar aksen sendiri, lalu `FormulaTerm`/`FormulaTotal` merakit ekspresi penutup | pembaca mengikuti penjumlahan, bukan membacanya sekaligus |
| members | `MemberStructureBar`: satu segmen per anggota | orientasi ukuran kelompok dan kesiapan hitung sejak layar pertama |
| tasks | `TaskWorkloadStrip`: satu bar per tugas dari jam nyata + tepi menyala pada baris yang sedang diedit | menjelaskan beban tanpa pernah menyentuh formulir |
| result | `WorkloadSummary`: satu tick per anggota pada sumbu batas R2, sekali muncul | membaca sebaran beban sekilas; matriks, slider, dan nilai K/S/C/M tidak disentuh |

Dua koreksi penting yang ditemukan lewat pengukuran, bukan asumsi:

1. **Offset berbasis bagian tidak berlaku untuk elemen di atas lipatan.** Perangkat yang duduk di
   layar pertama sudah menyelesaikan rentangnya saat paint pertama, jadi animasinya tidak pernah
   terlihat. Karena itu members dan tasks diikat ke **perjalanan elemen itu sendiri** di viewport.
2. **`useScroll` berbasis target terbukti tidak pernah bergerak di halaman ini** (diukur: `scaleY`
   tetap 0 melintasi scroll roda nyata, `scrollTo`, dan tanpa reduced motion). Karena itu kedua strip
   ditulis ulang menjadi entrance `whileInView` sekali-jalan, yang deterministik dan tidak bisa
   tertinggal di keadaan nol. Terbukti beranimasi dengan frame antara nyata:
   members `0,00 → 0,53 → 0,98 → selesai`, tasks `0,00 → 0,98 → 0,99 → selesai`.

Perangkat yang benar-benar terikat scroll dan terbukti berubah mengikuti posisi: homepage 3 dari 4
perangkat (progress bar, rule vertikal, dan rail bagian), `/how-it-works` 9 dari 9 (opacity
`0,34 → 1,00`, offset `7px → 0`). Members/tasks/result sengaja **bukan** scroll-linked.

`useSectionProgress` mendapat opsi `enabled` karena target ref bisa ter-mount lebih lambat dari hook
(data baru datang setelah render pertama), yang sebelumnya memicu "Target ref is defined but not
hydrated" di halaman tasks. Log setelah perbaikan: 0 error.

### Berkas yang diubah

| Berkas | Perubahan |
|---|---|
| `app/globals.css` | `.app-canvas`, token `--rail-tint`/`--rail-plate-a`/`--rail-plate-b`/`--rail-haze`/`--rail-edge`/`--rail-glow`/`--canvas-wash-*` di tiga blok token, `.rail-surface` dua lapis + `::before`, `.rail-mark`, `.rail-item[data-active]`, `.app-topbar`, `.band-recessed`/`.band-open`/`.band-deeper`, plat laci, fallback `@supports not` |
| `app/layout.tsx` | `body` memakai `.app-canvas`; `--paper` pindah ke kanvas |
| `app/page.tsx` | `SECTION_TONE`, `HOME_SECTIONS`, `SectionRail`, anchor `id="atas"`, drift plat `KomposisiSkor`, root transparan |
| `app/how-it-works/page.tsx` | root transparan |
| `components/motion/reveal.tsx` | `useSectionProgress` + opsi `enabled`; `ScoreWalkthrough`/`FormulaTerm`/`FormulaTotal`/`TermRow` dibangun ulang bertahap |
| `components/ui/app-sidebar.tsx` | `.rail-mark` sebagai tile menyala |
| `components/ui/workspace-shell.tsx` | `.app-topbar` glass mobile, root transparan |
| `app/p/[code]/members/members-client.tsx` | `MemberStructureBar` |
| `app/p/[code]/tasks/tasks-client.tsx` | `TaskWorkloadStrip`, tepi menyala baris yang diedit |
| `app/p/[code]/result/result-client.tsx` | `WorkloadSummary`, root fallback transparan |

### Hasil viewport (320 / 375 / 390 / 768 / 1024 / 1280)

Diukur di Chromium headless (bukan Playwright, yang tidak terpasang) terhadap 5 halaman:

| Ukuran | Hasil |
|---|---|
| Horizontal overflow | **0 di 30 kombinasi** (5 halaman x 6 viewport) |
| Console error | **0** di semua kombinasi |
| Lebar rail | 265 px mengembang / 78 px menciut, tanpa regresi |
| Rail terlihat | `hidden` < 1024, `visible` >= 1024 (laci mobile, sesuai rancangan) |
| Laci mobile | 265 px, `x=0`, label opacity 1, target sentuh 44 px |
| Teks tersembunyi (reduced motion) | **0** di kelima halaman |
| Keyboard | Tab mencapai kelima tautan rail + toggle tema, outline `solid 2px` |
| Reduced motion | 0 overflow, 0 teks tersembunyi, 0 error |

Dua hal yang perlu dijelaskan jujur:

- `result` melaporkan tabel `min-w-[860px]` melebar melewati viewport, tetapi itu **di dalam**
  pembungkus `overflow-x: auto` miliknya sendiri, dan `document.scrollWidth - clientWidth = 0`.
  Perilaku ini sudah ada sebelum T-5.04 dan memang disengaja untuk matriks.
- `home` dan `/how-it-works` melaporkan 4 teks `opacity: 0` saat paint pertama. Itu bagian di bawah
  lipatan yang memang dirancang muncul saat digulir. Diverifikasi: setelah digulir ke bawah,
  tersembunyi = **0**.

### Hasil gerbang

| Gerbang | Hasil |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `npx eslint .` | 0 error, 11 peringatan lama (tidak ada di berkas yang diubah) |
| `npx vitest run --testTimeout=30000` | **299/299 lulus**, 23 berkas |
| `npx next build` | berhasil |
| Before/after | 28 PNG per set di `/tmp/t504/before` dan `/tmp/t504/after` |
| Sweep viewport | 31 berkas + `report.json` di `/tmp/t504/sweep` |

Catatan tes: dengan timeout bawaan 5 detik, 2 tes gagal (satu panggilan Gemini live yang butuh
jaringan, satu tes integrasi Supabase yang dipanggil paralel). Keduanya **bukan** regresi UI: tes
integrasi lulus 8/8 saat dijalankan sendiri dengan env `SUPABASE_URL`, dan seluruh 299 lulus dengan
timeout realistis.

### Integritas data dan kode

Tidak ada perubahan pada `lib/scoring/*`, `lib/ai/*`, `app/api/*`, `supabase/*`, `eval/*`, maupun
`lib/validation/*`. Waktu modifikasi berkas-berkas itu tetap 11-13 s.d. 11-17, sebelum sesi ini.
`git log` tetap hanya `9b62e3d`, tidak ada yang ter-stage, dan tidak ada commit, push, atau deploy.
Seluruh skrip probe sementara (`.t504-*.mjs`, `.t504-reverts.json`) sudah dihapus.

### Keterbatasan

- `hover:hover` tidak dapat diemulasikan di Chromium headless, jadi hover diverifikasi lewat
  `:focus-visible` + geometri, bukan tangkapan visual hover.
- Playwright tidak terpasang. Seluruh bukti diambil lewat CDP Chromium headless langsung.
- `/api/recommend` butuh 8-50 detik (Gemini), jadi tangkapan halaman result menunggu 26-30 detik.
- Server dev sempat gagal boot karena `next/font/google` tidak bisa menjangkau `fonts.gstatic.com`
  (lingkungan offline). Tangkapan dan sweep akhir dijalankan di atas `next build` + `next start`,
  yang berhasil menyelesaikan font saat build.
- Kesepakatan manusia (0 reviewer), data D3 nyata, live ablation, ketahanan provider live, dan
  pemakaian Gemini per-run (FR-09) tetap **BLOCKED** seperti sebelumnya.

---

## Fase 3.T-5.05 - Kontras Ikon dan Penghalusan Glass (FR-19, FR-20)

**Putusan: LULUS.** Kontras ikon pada permukaan kaca diperbaiki dengan pengukuran piksel nyata,
bukan perkiraan. Nilai terendah di rail sekarang **4,92:1** (light) dan **5,61:1** (dark), naik dari
**1,22:1** dan **2,71:1**. Tidak ada horizontal overflow, tidak ada console error, dan tidak ada
perubahan pada logika bisnis.

### Penyebab utama masalah kontras

Audit terukur (`docs/T-5.05-VISUAL-AUDIT.md`) menemukan tiga sebab, bukan satu:

| Sebab | Bukti |
|---|---|
| Ikon merek tidak memakai token rail sama sekali | `<Star>` di `primitives.tsx` menulis mati `text-accent`, menang atas `.rail-mark { color: var(--rail-ink) }`. Azure di atas tile abu-abu = **1,22:1** |
| Satu token dipakai untuk dua standar berbeda | `--rail-muted` (#d3dbe9) dipakai ikon (batas 3:1) sekaligus label (batas 4,5:1). Hasilnya 3,86:1: lolos untuk ikon, **gagal untuk label** (3,97:1) |
| Hover menurunkan kontras | Plat hover menambah putih (`rgba(255,255,255,0.10)`), mendekatkan permukaan ke warna ikon. Light mode turun dari 3,86:1 ke **3,11:1** |

Penyebab pertama adalah bug penyambungan, bukan selera: token yang sudah ada (`--rail-ink`) benar,
hanya tidak pernah sampai ke ikon.

### Perubahan Light Mode

- `--rail-muted` #d3dbe9 ke **#f2f5fb** (5,06:1 pada plat, 5,34:1 pada plat hover).
- `--rail-ink` ke #f2f5fb, sehingga ikon dan label berbagi satu warna yang jelas.
- `--rail-hover` dari putih 0,10 ke **tinta 0,06**: hover sekarang **menaikkan** kontras, bukan menurunkan.
- Plat 0,74 sampai 0,84 menjadi **0,70 sampai 0,88**, ditambah stop tengah, sehingga ada pergeseran tonal yang terlihat.
- Chip aktif memakai `#1d4ed8` (`--accent-strong` yang sudah ada di DESIGN.md), bukan `#2f66ff`: 4,70:1 menjadi **6,70:1**.
- Tile merek menjadi **sumur tertekan** (`--rail-mark-well`), bukan permukaan menyala.

### Perubahan Dark Mode

- `--rail-muted` #c3ccdb ke **#d5deeb** (8,41:1 pada plat, 6,66:1 pada plat hover).
- Plat 0,70 sampai 0,80 menjadi **0,68 sampai 0,84**.
- `--rail-hover` **tetap mencerahkan** (putih 0,08), karena arah yang benar bergantung pada sisi mana plat berada: di tema gelap plat lebih gelap dari tinta, jadi menaikkannya yang memisahkan baris.
- Tile merek menjadi sumur terang tipis (`rgba(255,255,255,0.09)`), konsisten dengan versi terang.
- Haze dan edge dinaikkan sedikit (0,10 ke 0,14 dan 0,22 ke 0,26) agar kedalaman tetap terbaca tanpa glow.

### Hasil pengukuran kontras

Diukur dengan memotong screenshot ke kotak ikon itu sendiri, mengambil **median piksel** sebagai warna
permukaan (glif hanya minoritas piksel), lalu mengomposit warna `color` terhitung di atas permukaan itu.
Semua angka berasal dari piksel yang benar-benar dicat.

| Elemen | Light sebelum | Light sesudah | Dark sebelum | Dark sesudah |
|---|---|---|---|---|
| Ikon nav aktif | 4,70:1 | **6,70:1** | 7,74:1 | **7,74:1** |
| Ikon nav non-aktif | 3,86:1 | **4,92:1** | 6,70:1 | **8,41:1** |
| Label nav non-aktif | 3,97:1 | **5,06:1** | 6,82:1 | **8,56:1** |
| Ikon merek | 1,22:1 | **5,43:1** | 2,71:1 | **5,61:1** |
| Ikon toggle tema | 8,55:1 | **12,26:1** | 10,84:1 | **12,82:1** |
| Toggle ciut (di kartu opak) | 16,71:1 | 16,71:1 | 15,41:1 | 15,41:1 |

Ikon memakai batas non-teks 3:1 (WCAG 1.4.11); label memakai batas teks 4,5:1. Karena satu token
melayani keduanya, token itu harus memenuhi yang lebih ketat, dan sekarang memenuhinya.

### Status hover, active, focus, disabled

| State | Light | Dark |
|---|---|---|
| Default | 4,92:1 | 8,41:1 |
| Hover | **5,34:1** (naik) | 6,66:1 |
| Focus | outline `2px solid rgb(47,102,255)`, offset 2px | outline `2px solid rgb(123,157,255)`, offset 2px |
| Active | chip azure 6,70:1 + marka kiri | chip azure 7,74:1 + marka kiri |
| Disabled | aturan penjaga: `--rail-muted` 55% + matte, `cursor: not-allowed` | sama |

Catatan jujur: **tidak ada kontrol di rail yang saat ini berstatus disabled**, jadi tidak ada screenshot
disabled yang bisa diambil. Aturannya ada sebagai penjaga agar bila nanti dipakai tidak salah dibaca
sebagai chip aktif, tetapi tidak diklaim teruji secara visual.

### Berkas yang diubah

| Berkas | Perubahan |
|---|---|
| `app/globals.css` | token `--rail-*` di tiga blok (light, dark, media query), plat tiga stop, `.rail-mark` jadi sumur, `.rail-mark svg`, hover dua arah, aturan disabled, plat laci di-clamp `max(0.9, ...)` |
| `components/ui/app-sidebar.tsx` | komentar merek diperbarui, transisi baris ke `transition-[background-color,color,box-shadow]` 140ms sesuai batas PRD 12.5 |

Sengaja **tidak** diubah: `components/ui/primitives.tsx`. `<Star>` tetap `text-accent` untuk semua
pemanggil lain (halaman pemasaran), dan hanya `.rail-mark svg` yang menimpanya dengan `color: inherit`.

### Hasil viewport (320, 375, 390, 768, 1024, 1280)

| Ukuran | Hasil |
|---|---|
| Horizontal overflow | **0 di 18 kombinasi** (3 halaman x 6 viewport) |
| Console error | **0** |
| Laci mobile | `open=true`, `x=0`, lebar 265px, di kedua tema |
| Rail | 265px mengembang, 78px menciut, ikon ciut tetap di sumbu 51px |
| Reduced motion | 0 elemen tersembunyi, 0 overflow, `transition-duration: 0s`, warna ikon tetap per tema |

### Hasil gerbang

| Gerbang | Perintah | Hasil |
|---|---|---|
| Typecheck | `npm run typecheck` | 0 error |
| Lint | `npm run lint` | 0 error, 2 peringatan lama (`test/api/member-profile.test.ts`) |
| Test | `npm test -- --testTimeout=30000` | **299 lulus, 0 gagal, 0 skip**, 23 berkas |
| Build | `npm run build` | berhasil |

Catatan: pada timeout bawaan 5 detik, dua tes gagal (satu panggilan Gemini live yang butuh jaringan,
satu tes integrasi Supabase paralel). Keduanya bukan regresi UI dan lulus dengan timeout realistis;
kondisi ini sama seperti T-5.04.

### Keterbatasan

- Playwright tidak terpasang. Seluruh bukti lewat CDP Chromium headless langsung.
- `hover` diukur dengan pointer CDP nyata, bukan `:hover` palsu, tetapi tidak ada emulasi `hover:hover`
  untuk perangkat sentuh.
- Tidak ada kontrol rail yang disabled, sehingga state itu tidak dapat difoto (lihat catatan di atas).
- Screenshot laci diambil pada 390px; 320px diverifikasi lewat pengukuran overflow, bukan lewat
  tangkapan terpisah.
- Kesepakatan manusia, data D3 nyata, live ablation, ketahanan provider, dan FR-09 per-run tetap BLOCKED.

### Integritas

Tidak ada perubahan pada `lib/scoring/*`, `lib/ai/*`, `app/api/*`, `supabase/*`, `eval/*`, maupun
`lib/validation/*`; mtime berkas-berkas itu tetap 11-13. `git log` tetap hanya `9b62e3d`, tidak ada yang
ter-stage, dan tidak ada commit, push, atau deploy. Seluruh skrip probe sementara sudah dihapus; lint
kembali ke 2 peringatan lama.

---

## Fase 3.T-5.06 - Penyempurnaan Visual Homepage (FR-19, FR-20)

**Putusan: LULUS dengan satu catatan lingkup.** Komposisi dan hierarki homepage diperbaiki
berdasarkan pengukuran. Form pembuatan proyek pada 390x844 naik dari **1140px** ke **612px** dari atas
halaman, dan tombol submit sekarang berada di layar pertama pada 390x844, 768, 1024, dan 1280.
Dua premis pada brief tugas **tidak ditemukan** di basis kode dan dilaporkan apa adanya, bukan
diarang. Tidak ada perubahan pada logika bisnis, API, atau halaman lain.

### Dua premis brief yang tidak ditemukan

| Brief menyebut | Kenyataan |
|---|---|
| Homepage "menampilkan proyek terbaru pada perangkat pengguna" | **Tidak ditemukan.** Satu-satunya kunci `localStorage` di seluruh repo adalah `theme_preference` dan `rail_collapsed`. Verifikasi di browser setelah membuat proyek sungguhan menghasilkan `localStorageKeys: ["theme_preference"]`. Tidak ada riwayat, tidak ada daftar, tidak ada persistensi. |
| "PRD Bagian 12.2, 12.3, 12.6, 12.7" | **Tidak ditemukan.** `prd.md` v0.2 punya 9 bagian, tidak ada Bagian 12. Panduan desain ada di `DESIGN.md`; batas motion ada di PRD Bagian 6.9 (NFR-46 sampai NFR-50). |

Fitur "proyek terbaru" **tidak dibuat**, sesuai keputusan pengguna dan PRD Bagian 7.5 butir 6
("Jangan membuat fitur yang tidak memiliki functional requirement"), juga karena brief melarang data
dummy. Pekerjaan glass dibatasi pada dua permukaan yang benar-benar dimiliki homepage: navbar dan
panel form. Token `--rail-*` milik sidebar workspace, yang tidak dirender di rute `/`.

### Masalah visual yang ditemukan (terukur)

Audit lengkap: `docs/T-5.06-VISUAL-AUDIT.md`.

| Masalah | Bukti |
|---|---|
| Form di bawah lipatan di semua viewport ponsel | 390px: form mulai **1140px** dari atas, 350px melewati dasar layar. Sekitar 1000px bacaan sebelum input pertama. |
| Blok batas memanjang jadi tiga baris di ponsel | `grid-cols-1 ... sm:grid-cols-3` membuat blok 3 fakta setinggi **201px** di 320 sampai 639px. Di desktop blok yang sama hanya 84px. |
| Halo lavender di belakang panel | `bg-accent-tint/70` pada kotak `-inset-x-3` adalah lapisan pucat yang **menurunkan** pemisahan panel dari canvas dan terbaca sebagai glow generik. |
| Navbar dan panel bukan satu material | Navbar `bg-paper/85` + blur; panel `bg-card` opak + shadow dua lapis. |
| Panel sebenarnya tidak transparan di Light Mode | Gutter panel terukur **satu warna datar di 4000 piksel** (`255,255,255`) sementara canvas di sebelahnya bervariasi. Putih 0.82 di atas halaman putih memang menghasilkan putih: blur 20px tidak punya tekstur untuk dikerjakan. |
| Garis dasar kolom kiri dan panel tidak sejajar | Desktop 1440x900: kolom kiri mulai 138, panel mulai 149. |

### Keputusan desain dan alasannya

1. **Panel form dipindah ke depan blok penjelas di DOM**, bukan disembunyikan. Di ponsel urutan
   sekarang: eyebrow, judul, deskripsi, panel, lalu plat formula, batas, dan CTA sekunder. Tidak ada
   konten yang dihapus. Di desktop `lg:row-start`/`lg:col-start` mengembalikan tata letak dua kolom
   persis seperti semula, jadi tidak ada yang bergeser di layar besar.
2. **Blok batas jadi tiga kolom sejak lebar terkecil**, karena tiap sel hanya tiga kata. Label
   dibiarkan dua baris dan nilainya dipatok ke bawah, sehingga label yang membungkus tidak menarik
   angkanya keluar dari garis.
3. **Halo lavender diganti material kaca sungguhan** lewat `.glass-panel` dan token `--glass-*`.
   Tidak ada hue baru: hanya tinta dan putih dari palet yang sudah ada.
4. **Wajah kaca Light Mode diberi tint tinta 0.04**, bukan putih. Ini yang membuat panel terbaca
   sebagai bidang terpisah (`rgb(245,246,246)`) di atas canvas `rgb(255,255,255)`, sekaligus
   meloloskan grid 64px dengan selisih 10 level sehingga blur benar-benar terlihat. Judul terukur
   17,14:1 dan teks sekunder 6,95:1 di atasnya.
5. **Dark Mode tetap 0.82**, karena di sana panel sudah terpisah dari canvas (`rgb(17,27,46)` versus
   canvas `rgb(11,18,32)`) dan grid lolos dengan selisih 10 level.
6. **Navbar dan panel memakai `.glass-panel` yang sama** sehingga tidak bisa lagi menjadi dua material
   berbeda.
7. **Motion:** delay panel dipendekkan dari 0.46s + 0.62s menjadi 0.3s + 0.28s. Aksi utama tidak
   pantas datang terakhir. Semua gesture lain dipertahankan.

### Berkas yang diubah

| Berkas | Perubahan |
|---|---|
| `app/page.tsx` | navbar memakai `.glass-panel`; hero dipecah jadi tiga blok dengan penempatan grid eksplisit; panel jadi glass + `data-interactive`; header panel dapat nomor langkah dan aturan; blok batas jadi tiga kolom; deskripsi lebih rapat di ponsel |
| `app/globals.css` | token `--glass-*` di tiga blok (light, dark, media query); kelas `.glass-panel`, `.glass-panel::before` (rim), `.glass-well`, aturan hover dua tema, fallback `@supports`, guard `prefers-reduced-motion` |

Total: **2 berkas implementasi** dari batas 5. Selain itu `docs/T-5.06-VISUAL-AUDIT.md` dibuat dan
`docs/STATUS.md` diperbarui. Tidak ada berkas lain yang disentuh; `primitives.tsx`, `reveal.tsx`,
`app-sidebar.tsx`, dan `workspace-shell.tsx` tidak diubah.

### Hasil Light Mode dan Dark Mode

| Ukuran | Light | Dark |
|---|---|---|
| Wajah navbar | `rgb(230,238,236)` | `rgb(18,29,48)` |
| Wajah panel | `rgb(245,246,246)` | `rgb(17,27,46)` |
| Teks terendah pada kaca | **6,73:1** | **8,17:1** |
| Judul panel | 17,14:1 | 15,74:1 |
| Teks bantuan panel | 6,95:1 | 8,24:1 |
| Label field | 6,95:1 | 8,24:1 |
| Badge langkah | 6,70:1 | 6,70:1 |

Angka diukur dengan metode yang sama seperti T-5.05: potong screenshot ke kotak elemen, ambil
**median piksel** sebagai warna permukaan, komposit `color` terhitung di atasnya, lalu hitung rasio
WCAG. Badge diukur terpisah dengan probe khusus karena lingkaran azure memenuhi seluruh kotak clip
sehingga median pembacaan biasa menghasilkan 1:1 yang menyesatkan.

Satu cacat nyata ditemukan dan diperbaiki lewat pengukuran ini: badge langkah memakai
`text-accent-ink`, yang di tema gelap bernilai `#060a14` (nyaris hitam) di atas azure `#1d4ed8`, dan
terukur **2,95:1**, gagal batas teks 4,5:1. Sekarang memakai putih tetap: **6,70:1** di kedua tema.

### Hasil responsif

| Viewport | Overflow X | Form mulai | Tombol submit di lipatan | Error konsol |
|---|---|---|---|---|
| 320x568 | 0 | 647 | tidak (layar 568px, lihat catatan) | 0 |
| 375x667 | 0 | 604 | tidak (layar 667px, lihat catatan) | 0 |
| 390x844 | 0 | 612 | **ya** (627 sampai 819) | 0 |
| 768x1024 | 0 | 619 | **ya** | 0 |
| 1024x768 | 0 | 293 | **ya** | 0 |
| 1280x800 | 0 | 305 | **ya** | 0 |

Pemeriksaan lipatan memakai tinggi viewport perangkat sebenarnya, bukan tinggi tetap, karena hasilnya
berubah sesuai tinggi layar. Tidak ada overflow horizontal di **18 kombinasi** (tiga halaman kali enam
viewport).

Catatan jujur: pada 320x568 dan 375x667 tombol submit **masih di bawah lipatan**. Ini batas fisik,
bukan kelalaian. Pada 320x568, judul empat baris saja sudah 152px dan deskripsi 186px; menjejalkan
judul, deskripsi, dan form lengkap ke dalam 568px tidak mungkin tanpa menghapus konten, yang dilarang
brief. Yang dicapai: form mulai **1140px turun ke 604px** pada 375 (536px lebih tinggi), dan pada
390x844 seluruh form termasuk tombol sudah terlihat tanpa scroll.

### Hasil reduced-motion dan motion

| Pemeriksaan | Hasil |
|---|---|
| Transisi panel | `0.12s` pada `box-shadow` dan `transform`, di dalam pita feedback PRD 6.9 (100-140ms) |
| Elemen tersembunyi saat reduced motion | **0** (light dan dark) |
| `transform` panel saat reduced motion | `none` |
| Transisi saat reduced motion | runtuh ke `1e-05s` |
| Tombol submit tetap terlihat | ya |
| Overflow saat reduced motion | 0 |
| Interaksi saat entrance berjalan | submit bukan target teratas yang tertutup, `disabled=false`, `topmostIsSubmit=true` |
| Scroll hijacking | tidak ada: `body` overflow `visible`, position `relative` |

### Hasil pengujian fungsi

Diuji dengan membuat proyek **sungguhan** lewat `/api/projects`; tidak ada data dummy yang disemai.

| Pemeriksaan | Hasil |
|---|---|
| Navigasi homepage | `/how-it-works`, `#scoring`, SectionRail, toggle tema semuanya ada |
| Validasi nama kosong | "Nama proyek wajib diisi.", `aria-invalid="true"` pada field yang benar |
| Validasi tenggat kosong | "Tenggat waktu wajib diisi.", `aria-invalid="true"` pada field yang benar |
| Pembuatan proyek | berhasil: judul, kode `f9984b340f16180340c77b78` (24 karakter), tenggat terpilih |
| Halaman tujuan | `/p/f9984b340f16180340c77b78/members` mengembalikan **200** |
| Penyimpanan perangkat | `["theme_preference"]` saja, membuktikan tidak ada riwayat proyek |

### Hasil gerbang

| Gerbang | Perintah | Hasil |
|---|---|---|
| Typecheck | `npm run typecheck` | 0 error |
| Lint | `npm run lint` | 0 error, 2 peringatan lama (`test/api/member-profile.test.ts`) |
| Test | `npm test -- --testTimeout=30000` | **299 lulus, 0 gagal, 0 skip**, 23 berkas |
| Build | `npm run build` | berhasil |

### Screenshot

- Sebelum: `/tmp/t506/before/` (light dan dark, desktop 1440x900 dan mobile 390x844, plus keadaan
  focus, invalid, dan hover).
- Sesudah: `/tmp/t506/after/` (set yang sama).
- Lipatan per perangkat: `/tmp/t506/midfold2/`.
- Reduced motion: `/tmp/t506/motion/`.
- Fungsi: `/tmp/t506/functional/01-validation-empty-title.png`, `02-validation-empty-deadline.png`,
  `03-project-created.png`.

Screenshot halaman penuh untuk bagian yang muncul saat digulir harus diambil dengan menelusuri
halaman lebih dulu; tangkapan penuh langsung menampilkan bagian tersebut pada `opacity: 0` karena
`whileInView` belum pernah terpicu. Itu artefak tangkapan, bukan cacat halaman: setelah penelusuran,
`hiddenAfterWalk = 0` di kedua tema.

### Keterbatasan

- Fitur "proyek terbaru pada perangkat pengguna" **tidak ada** dan tidak dibuat.
- Bagian 12 pada PRD tidak ada; acuan motion memakai PRD 6.9.
- Pada 320x568 dan 375x667 tombol submit masih di bawah lipatan karena batas tinggi layar.
- Playwright tidak terpasang; seluruh bukti lewat CDP Chromium headless.
- Kamera hover memakai pointer CDP nyata, bukan emulasi `hover:hover` untuk perangkat sentuh.
- Kesepakatan manusia, data D3 nyata, live ablation, ketahanan provider, dan FR-09 per-run tetap
  BLOCKED.

### Integritas

Tidak ada perubahan pada `lib/scoring/*`, `lib/ai/*`, `app/api/*`, `supabase/*`, `eval/*`, maupun
`lib/validation/*`; mtime berkas-berkas itu tetap 13 sampai 18 November. Halaman members, tasks,
result, dan how-it-works tidak disentuh. Token kontras T-5.05 (`--rail-muted`, `--rail-hover`,
`--rail-mark-well`, `--rail-active`, dan rentang plat) diverifikasi masih utuh. Tidak ada dependency
baru. `git log` tetap hanya `9b62e3d`, tidak ada yang ter-stage, dan tidak ada commit, push, atau
deploy. Seluruh skrip probe sementara sudah dihapus; lint kembali ke 2 peringatan lama.

---

## Fase 3.T-5.08 - Safe Repository Cleanup (T-5.07 Tahap 0-6)

Pembersihan struktur dalam satu batch aman. Cakupan: T-5.07 Tahap 0-6 (`docs/STRUCTURE_AUDIT.md`
§10). Tidak ada fitur, business logic, route, skema DB, atau dependency yang berubah.

### Snapshot (Tahap 0)

| Item | Nilai |
|---|---|
| Lokasi | `/home/nando/t508-snapshot/teammate-ai-pre-t508.tar.gz` |
| Ukuran | 1.536.664 byte |
| SHA-256 | `0dcf51fbfb19c4981844a6c20536b314af9f8ce49ee3102b110a22852cc3cb7a` |
| Integritas | `gzip -t` OK, `tar -tzf` OK, 492 entri |
| Dikecualikan | `node_modules` (0 entri), `.next` (0), `.git` (0), `.env.local` (0) |

Cakupan diverifikasi: `app/` 39, `components/` 14, `lib/` 32, `test/` 31, `eval/` 51, `docs/` 18,
`supabase/` 9 (ketujuh migrasi 001-007 ada), `public/` 6, `.github/` 3, `.agents/` 25, `agent/` 25,
`.claude/` 8, `.opencode/` 214. Berkas konfigurasi kunci dan `docs/STRUCTURE_AUDIT.md` ada di arsip.
Berkas checksum: `teammate-ai-pre-t508.tar.gz.sha256`.

### Baseline sebelum perubahan (Tahap 1)

| Gerbang | Hasil |
|---|---|
| `git status --short` | 16 tracked modified, 338 untracked |
| `git rev-parse HEAD` | `9b62e3d` (branch `redesign/fuelplate-ui`) |
| `npx tsc --noEmit` | exit 0, 0 error |
| `npm run lint` | exit 0, 0 error, 2 warning lama (`test/api/member-profile.test.ts:36`) |
| `npm test -- --testTimeout=30000` | 23 berkas, **299** tes lulus, 0 gagal, 0 skipped |
| `npm run build` | exit 0, **17** rute di `app-path-routes-manifest.json` |

Baseline hijau, jadi pekerjaan dilanjutkan.

### Tahap 2-5: penghapusan

| Path | Bukti sebelum hapus | SHA-256 sebelum hapus |
|---|---|---|
| `lib/db/supabase.ts` (6 baris) | 0 import masuk (`grep -rn "db/supabase"`), 0 test; modul membuat client saat module-eval dari `process.env`, sedangkan `lib/db/project.ts:4` sengaja membaca env saat dipanggil | `d17d798a...f895c0` |
| `public/file.svg` | 0 rujukan di `app/components/lib` | `2b67812c...53bd4` |
| `public/globe.svg` | idem | `b614b9bf...e7cf` |
| `public/next.svg` | idem | `55995dfa...7bcfc` |
| `public/vercel.svg` | idem | `f081337b...2ac4` |
| `public/window.svg` | idem | `644768c4...e3a1` |
| `__pycache__/*.pyc` (3 berkas) | artefak CPython 3.14, bukan sumber, tidak dirujuk `SKILL.md` | tercatat di log sesi |
| `components/layout`, `components/members`, `components/tasks`, `lib/utils` | 0 berkas, 0 rujukan | (direktori kosong, `rmdir`) |

Lima SVG dan `lib/db/supabase.ts` adalah berkas **tracked** di HEAD, sehingga penghapusannya
muncul sebagai `D` di `git status` dan dapat dipulihkan dengan `git checkout -- <path>`.
Tiga `.pyc` dan empat direktori kosong bersifat untracked, sehingga hanya dapat dipulihkan dari
snapshot. `rmdir` dipakai untuk direktori kosong (menolak jalan bila tidak kosong).

### Tahap 6: ekstraksi `task-draft.ts`

Berkas baru `app/p/[code]/tasks/task-draft.ts` (91 baris) berisi tujuh deklarasi yang dipindah
**apa adanya** dari `tasks-client.tsx`: `TaskItem`, `TemplateDraftItem`, `TaskDraft`,
`EMPTY_DRAFT`, `isValidHours`, `draftFromTask`, `errorMessage`.

Bukti "apa adanya": ketujuh asersi kode (63 baris setelah blank dan komentar dibuang) dibandingkan
baris-per-baris dengan sumber asli dari snapshot memakai `difflib` - hasil **IDENTICAL**, nol
perbedaan. Satu-satunya yang ditambahkan adalah kata kunci `export` dan komentar dokumentasi.

`tasks-client.tsx` turun dari **1.032 menjadi 971 baris** (-61). Import yang ditambahkan
memakai path relatif `'./task-draft'` (bukan alias), karena kedua berkas berada di direktori yang
sama. Tidak ada komponen, state, handler, endpoint, atau pemanggilan validasi yang dipindah.

### Hasil pengujian sesudah perubahan

Diukur dua kali: setelah Tahap 2-5 (penghapusan saja), lalu sekali lagi setelah Tahap 6
(ekstraksi). Keduanya identik dengan baseline.

| Gerbang | Baseline | Setelah Tahap 2-5 | Setelah Tahap 6 | Verdict |
|---|---|---|---|---|
| `npx tsc --noEmit` | 0 error | 0 error | 0 error | tetap |
| `npm run lint` | 0 error, 2 warning | 0 error, 2 warning | 0 error, 2 warning | tetap, tidak ada warning baru |
| Jumlah tes | 299 lulus / 23 berkas | 299 lulus / 23 berkas | 299 lulus / 23 berkas | **tetap** |
| Jumlah rute | 17 | 17 | 17 | **tetap, set identik** |
| `npm run build` | exit 0 | exit 0 | exit 0 | tetap |

Set rute dibandingkan sebagai daftar terurut terhadap `app-path-routes-manifest.json`, bukan
sekadar jumlahnya: `/`, `/_global-error`, `/_not-found`, `/api/analyze-task`, `/api/projects`,
`/api/projects/[code]/events`, `/api/projects/[code]/members`, `/api/projects/[code]/members/[id]`,
`/api/projects/[code]/tasks`, `/api/projects/[code]/tasks/[id]`, `/api/recommend`, `/favicon.ico`,
`/how-it-works`, `/p/[code]/members`, `/p/[code]/members/[id]`, `/p/[code]/result`,
`/p/[code]/tasks`. Hasil: **IDENTICAL**.

### Pemeriksaan import menggantung

Bukan hanya `tsc`, tetapi juga pemindaian eksplisit seluruh spesifier:

| Jenis | Jumlah diperiksa | Tidak terselesaikan |
|---|---|---|
| Import relatif (`./`, `../`) | 42 | **0** |
| Import alias (`@/`) | 183 | **0** |

`lib/db/supabase.ts` dicek: 0 rujukan tersisa. Tidak ada barrel, tidak ada `export *` yang
menunjuk berkas yang dihapus.

### Berkas yang dipertahankan utuh (diverifikasi dengan `diff` terhadap snapshot)

`app/globals.css`, `app/page.tsx`, `app/p/[code]/result/result-client.tsx`, `package.json`,
`package-lock.json`, `eslint.config.mjs`, `vitest.config.ts`, `tsconfig.json`, `next.config.ts`,
`lib/scoring/`, `lib/ai/`, `app/api/`, `supabase/migrations/`, `lib/validation/`,
`lib/db/project.ts`, `agent/`, `.agents/`.

Hasil `diff -rq` untuk setiap poin di atas: **tidak ada perbedaan**. `.opencode/` berbeda hanya
karena `__pycache__` yang dihapus (penghapusan yang diizinkan); 175 berkas skill lain utuh.
Keenam symlink `.claude/skills/*` masih resolve.

`.env.local` tidak dibaca, tidak diubah, dan tidak masuk snapshot; mtime tetap 19 November 11:33.

### Business logic: tidak ada perubahan

Empat bukti terpisah:
1. `lib/scoring/`, `lib/ai/`, `app/api/`, `lib/validation/`, `supabase/migrations/` byte-identik
   dengan snapshot.
2. Tujuh deklarasi yang dipindah dibandingkan baris-per-baris dan identik (63/63 baris kode).
3. 299 tes lulus tanpa satu pun assertion diubah, termasuk 15 tes `test/api/tasks.test.ts` dan
   12 tes `test/validation/task.test.ts` yang menguji jalur form tugas.
4. Set rute build identik, sehingga tidak ada endpoint atau halaman yang hilang atau bergeser.

Yang berubah hanyalah **lokasi** enam berkas yang dihapus (semuanya tanpa rujukan), empat
direktori kosong, dan **lokasi** tujuh deklarasi tipe/fungsi murni. Tidak ada perubahan pada
formula skor, aturan R1-R5, pemanggilan AI, validasi Zod, skema database, atau kontrak API.

### Git status akhir

```
 M AGENTS.md              M package-lock.json
 M DESIGN.md              M package.json
 M app/globals.css        M prd.md
 M app/layout.tsx         M test/scoring.test.ts
 M app/page.tsx           M vitest.config.ts
 M eslint.config.mjs
 M lib/ai/analyze-task.ts   D lib/db/supabase.ts
 M lib/scoring/assign.ts    D public/file.svg
 M lib/scoring/score.ts     D public/globe.svg
 M lib/scoring/types.ts     D public/next.svg
 M lib/validation/index.ts  D public/vercel.svg
                            D public/window.svg
```

16 `M` adalah perubahan yang **sudah ada sebelum T-5.08** dan tidak disentuh. 6 `D` adalah
penghapusan T-5.08. Satu berkas baru (`app/p/[code]/tasks/task-draft.ts`) berada di dalam
`app/p/` yang sudah untracked sejak awal. Rekonsiliasi untracked: baseline 343 (338 untracked +
3 `.pyc` + artefak gitignore) menjadi 337; selisihnya tepat 3 `.pyc` hilang dan 1 berkas baru
bertambah. Tidak ada staged entry: `git diff --cached` kosong.

### Keterbatasan

- Snapshot berada di `/home/nando/t508-snapshot/`, masih di disk yang sama dengan repo. Ini
  melindungi dari kesalahan operator, bukan dari kegagalan disk.
- `git clean` tidak dijalankan (dilarang) dan tidak diperlukan.
- Dua tes yang gagal pada timeout default 5 detik (Gemini live dan integrasi Supabase paralel)
  tetap artefak lingkungan, bukan regresi; karena itu `--testTimeout=30000` dipakai konsisten
  pada baseline maupun sesudahnya.
- `agent/skills/` **tidak disentuh**. Statusnya masih BELUM DAPAT DIPASTIKAN seperti dicatat di
  `docs/STRUCTURE_AUDIT.md` §7.5; keputusan menunggu konfirmasi pemilik.
- Tiga `@utility` yang tidak terpakai di `app/globals.css` (`surface-sunken`, `ring-accent`,
  `float-slow`) **tidak** dihapus, karena `globals.css` dilarang diubah pada tugas ini.

### Integritas

Tidak ada commit, push, deploy, reset, atau `git clean`. Tidak ada perubahan pada `package.json`,
`package-lock.json`, `.env.local`, migrasi database, route API, atau isi skill. Snapshot dibuat
sebelum perubahan pertama dan checksum-nya tercatat di atas.

## Fase 3.T-5.09 - Redesign Visual Navbar Kapsul, Logo, Kalender Custom (FR-19, FR-20)

Tugas: menyegarkan wajah visual Teammate AI tanpa menyentuh logika bisnis, route, API, DB, auth,
maupun formula skor. Semua perubahan di bawah ini murni presentasi.

### Berkas yang diubah (7)

Enam berkas disetujui di awal tugas; berkas ketujuh (7) disetujui terpisah saat defect ditemukan.

1. `app/page.tsx` - header mengambang dengan navigasi kapsul, logo, transisi halaman, `DateField`.
2. `app/globals.css` - blok `.nav-capsule*`, `.nav-shell[data-scrolled]`, `.date-trigger[data-invalid]`,
   aturan tooltip `.rail-toggle`, semua dengan override `prefers-reduced-motion`.
3. `components/ui/primitives.tsx` - `Logo`, `DateField` (kalender custom), `NavCapsule`,
   `NavCapsuleLink`.
4. `components/ui/app-sidebar.tsx` - `Logo` di `rail-mark`, toggle ciutkan `.rail-toggle` dengan
   area sentuh 44px dan tooltip.
5. `components/ui/workspace-shell.tsx` - pemicu menu mobile memakai `Logo`, `aria-label` eksplisit.
6. `app/p/[code]/tasks/tasks-client.tsx` - `DateField` menggantikan `input type="date"`.
7. `components/motion/reveal.tsx` - perbaikan 1 baris di cabang reduced-motion `MaskLine` (lihat
   Defect di bawah).

Tidak ada dependency baru. Tidak ada route, API, migrasi DB, atau berkas env yang berubah.

### Skill yang dimuat

`antislop`, `antislop-ui`, `ui-ux-pro-max`. Ketiganya ada dan berhasil dimuat. Mode antislop:
standard. Design Read: halaman hibrida (marketing `/` + workspace padat), audiens mahasiswa
Indonesia yang membentuk kelompok, bahasa visual tipe display editorial + kaca garis rambut,
aksen azure saja; ENERGY 6 / RHYTHM 6 / MOTION 4.

### Navigasi dan logo

- Navbar publik menjadi kapsul mengambang: tujuan aktif adalah pil berisi ikon dan label,
  tujuan lain ikon saja. Pil aktif bergeser memakai `layoutId` Framer. Warna mengikuti palet
  DESIGN.md (azure `--accent-strong` di atas keluarga tinta `--rail-*`), bukan ungu referensi.
- Saat halaman digulir lebih dari 64px, kapsul melepas pelatnya dan badge versi memudar, jadi
  navigasi mengambang tidak pernah menutupi formulir.
- `Logo` baru adalah trefoil: tiga kepala pada satu garis dasar dan tiga jari-jari ke satu
  simpul. Warnanya `currentColor`, jadi terbaca di pelat gelap navbar, sumur gelap sidebar, dan
  kertas footer. Nama aksesibel hanya bila `title` diberikan.
- Sidebar: `Star` diganti `Logo`. Toggle ciutkan dipindah ke `.rail-toggle` (titik 26px dalam
  area 44px) dengan `aria-expanded`, `aria-controls`, `role="tooltip"` yang benar-benar muncul
  saat hover/fokus.
- Top bar mobile memakai `Logo` dengan `aria-label="Buka menu navigasi"`.

### Gerak

- Transisi halaman: `AnimatePresence` + `motion.main` di-key pada `usePathname()`, durasi
  `DURATION.layout` (280ms). Hanya opacity: versi awal juga menggeser 6px, dan transform pada
  wrapper membuat konteks posisi baru bagi pengamat `whileInView` di dalamnya.
- Reveal gulir: diverifikasi bekerja dua arah. Sebelum menggulir, 0 elemen dalam sudah ter-reveal;
  setelah menggulir ke `#scoring`, 7 elemen ter-reveal. Karena `once: true`, saat digulir kembali
  ke atas semuanya tetap terlihat (ini perilaku desain, bukan regresi).
- Reduced motion: jumlah target `data-motion-reveal` turun dari 31 menjadi 7 (elemen non-esensial
  dirender sebagai elemen biasa), tidak ada transisi tersisa, tidak ada blok tak terlihat.

### Halaman utama

- Header kapsul mengambang + spacer setinggi 60/68px supaya tidak menutupi baris pertama hero.
- Kalender custom menggantikan input tanggal bawaan; nilai yang ditulis tetap string `YYYY-MM-DD`.
- Logo dipakai di navbar dan footer. `Star` dipertahankan sebagai penanda bagian (`SectionMark`).

### Kalender: hasil uji

Diuji dengan klik CDP asli pada 390px dan 1280px, tema terang dan gelap.

| Pemeriksaan | 1280px | 390px |
| --- | --- | --- |
| Terbuka lewat klik asli | ya | ya |
| Judul bulan | November 2026 | November 2026 |
| Jumlah `gridcell` | 30 | 30 |
| Memilih tanggal | `2026-11-15` | `2026-11-15` |
| Teks kolom | 15 November 2026 | 15 November 2026 |
| Panel menutup setelah pilih | ya | ya |
| Bulan berikutnya | Desember 2026 | Desember 2026 |
| Keyboard: panah kanan | `2026-12-01` -> `2026-12-02` | sama |
| Enter menyimpan dan menutup | ya | ya |
| Escape menutup | ya | ya |
| Fokus kembali ke `#deadline` | ya | ya |

Kontrak tanggal dijaga: aritmetika UTC (`Date.UTC` + `getUTC*`), sama dengan `projectSchema`.
Diverifikasi lewat API sungguhan: `2026-11-15` diterima `201`; `2026-02-30` dan `15/11/2026`
ditolak `400` dengan pesan validasi yang tidak berubah.

### Gerbang mutu

| Gerbang | Hasil |
| --- | --- |
| `npx tsc --noEmit` | 0 error |
| `npm run lint` | 0 error, 2 warning (keduanya pra-ada di `test/api/member-profile.test.ts`) |
| `npm test -- --testTimeout=30000` | 299 tes / 23 berkas lulus |
| `npm run build` | exit 0, 17 route, identik dengan baseline `T-5.08` |

Konsol: 20 tangkapan sebelum dan 20 tangkapan sesudah, 0 error konsol pada keduanya. Empat
tangkapan reduced-motion, 0 error konsol.

### Responsif

Diperiksa pada 390px dan 1280px. Di 390px wordmark disembunyikan (logo tetap ada dengan nama
aksesibel), badge versi hanya tampil di `lg`, ikon kapsul non-aktif memakai `--fog` (tema gelap:
`--ink`), dan nilai tanggal memakai `truncate whitespace-nowrap` agar tidak membungkus.

### Defect yang ditemukan dan diperbaiki

1. `new Date()` dipanggil saat render membuat `next build` gagal (`blocking-prerender-current-time-client`).
   Perbaikan: "hari ini" dibaca di dalam handler klik pertama, bukan saat render, dan bukan di
   dalam effect (yang memicu `react-hooks/set-state-in-effect`).
2. `aria-invalid` pada `<button>` memicu peringatan lint. Diganti `data-invalid` + aturan CSS.
3. Tooltip toggle sidebar tidak pernah muncul karena tidak ada aturan reveal untuk `.rail-toggle`.
   Ditambahkan aturan hover/fokus.
4. **Pra-ada, bukan dari tugas ini:** pada reduced-motion, `MaskLine` mengembalikan `<span>`
   tanpa `block`, sehingga headline multi-baris menyatu menjadi satu baris. Diukur pada 1280px.
   Diperbaiki dengan menambahkan `block`, sesuai persetujuan pemilik untuk berkas ke-7.

### Keterbatasan yang jujur

- `/how-it-works` tidak termasuk berkas yang disetujui, jadi header-nya masih memakai `Star` dan
  header sticky lama, bukan kapsul baru. Konsistensi logo di halaman itu belum dikerjakan.
- `app/favicon.ico` masih ikon bawaan Next.js.
- Satu proyek uji dibuat lewat API saat verifikasi kontrak (`b933661627ab5c33286db78b`). Data
  tidak dihapus karena penghapusan data dilarang.
- Berkas `components/motion/reveal.tsx` berstatus untracked sejak sebelum tugas ini; perbaikan di
  atas hanya menambah satu kelas.

### Integritas

Tidak ada commit, push, deploy, `git reset`, atau `git clean`. Tidak ada perubahan pada
`package.json`, `package-lock.json`, `.env.local`, formula skor, R1-R5, route API, DB, atau auth.

## Fase 3.T-5.10 (FR-19, FR-20) | Floating Glass Navigation

### Penyebab navbar bertumpuk (terukur, bukan perkiraan)

Audit menemukan **tiga sistem navigasi yang berbeda**, bukan satu:
`/` memakai kapsul melayang, `/how-it-works` memakai bilah sticky lama berlajur `border-b`
dan penanda `Star` (bukan logo), sedangkan rute workspace memakai rail + topbar mobile sendiri.
Bug yang dilaporkan pengguna berasal dari empat cacat di sistem pertama:

1. **Header `fixed` tanpa ruang yang benar-benar dicadangkan.** Spacer hard-coded
   `h-[60px] sm:h-[68px]`, sementara tinggi header sebenarnya `60px` di desktop dan
   `54.4px` di mobile. Selisih itu membuat konten masuk ke bawah bilah.
2. **`data-scrolled` hanya melepas pelat kapsul, header tidak pernah mengecil.** Terukur:
   tinggi header tetap `60/60` (desktop) dan `54.4/54.4` (mobile) sebelum dan sesudah scroll.
   Jadi kapsul berhenti jadi pelat namun tetap mengecat dirinya di atas formulir.
3. **Tidak ada mode compact.** Label menu selalu dirender, kapsul tidak pernah menyingkir
   dari alur, sehingga tinggi header konstan dan menutupi konten.
4. **`ScrollProgress` adalah garis biru nyasar.** Elemen `span` 1px `bg-accent-strong`
   dengan `absolute bottom-0` di dalam header `fixed`. Terukur di `top:59, bottom:60`,
   lebar 539px pada scroll 620. Inilah garis azure pada screenshot pengguna.

Bukti angka sebelum perbaikan: garis azure 1px di dalam header = **1**; tinggi header
konstan pada scroll; kapsul (dengan semua label + badge `v0.2`) mengecat label
"Nama proyek / mata kuliah" dan placeholder "Contoh: Tugas Besar Pemrograman Web".

### Perbaikan

Satu komponen bersama `SiteNav` menggantikan ketiga sistem untuk rute publik, dipasang
**sekali di root layout** (di dalam `Suspense`, karena membaca `usePathname()` dan rute
workspace adalah partial prerender). Komponen merender `null` di `/p/*` supaya rail tetap
menjadi satu-satunya navigasi di workspace, jadi tidak ada dua navbar bertumpuk.

- Header tetap `fixed`, tetapi **mencadangkan tinggi persisnya** lewat `.site-nav-spacer`
  yang memakai variabel yang sama dengan header, termasuk `env(safe-area-inset-top)`.
- **Dua keadaan nyata, berbeda tinggi**: expanded `60px` (mobile) / `68px` (desktop),
  compact `48px` / `54px`. Compact menyembunyikan kapsul dari alur dan menampilkan
  logo + theme + tombol Menu; tombol Menu membuka daftar tujuan eksplisit.
- Scroll: listener pasif dengan ambang `96px` turun dan `24px` naik, jadi perubahan
  sub-piksel tidak memicu render. Tidak ada timer, jadi keadaan diam saat scroll berhenti.
- Perpindahan rute: karena `SiteNav` hidup di layout dan tidak remount, satu transisi
  compact singkat (~260ms) lalu kembali expanded. Terverifikasi dua arah.
- `ScrollProgress` dan `RailScrollProgress` **dihapus**; `border-b` pada topbar workspace
  dan bilah sticky `/how-it-works` dihapus. Semua garis sisa yang tidak berfungsi hilang.

### Logo global

`app/favicon.ico` sebelumnya masih ikon default Next.js (kanvas putih + glyph hitam).
Sekarang dibangun dari geometri `Logo` yang sama (tiga anggota pada satu baseline, spokes
menuju satu tugas bersama; konsep kolaborasi dan pembagian tugas), putih di atas pelat ink,
7 ukuran (16-256). Navbar, sidebar, topbar mobile, dan footer memakai `Logo` yang sudah
sama. Tidak ada lagi penanda Gemini/`Star` sebagai identitas: `Star` di `/how-it-works`
hanya tinggal sebagai penanda section dekoratif di dalam konten, bukan brand.

### Hasil pengujian (Chromium headless, produksi `next start`)

Rute: `/`, `/how-it-works`, `/p/[code]/members`, `/p/[code]/tasks`, `/p/[code]/result`.
Ukuran: desktop 1280x900 dan mobile 390x844.

| Rute | Tinggi header sebelum | Tinggi header sesudah | Compact saat turun | Overflow X | Garis nyasar di header |
|---|---|---|---|---|---|
| desktop `/` | 60/60 | 68/54 | ya | 0 | 0 |
| desktop `/how-it-works` | 61/61 | 68/54 | ya | 0 | 0 |
| mobile `/` | 54.4/54.4 | 60/48 | ya | 0 | 0 |
| mobile `/how-it-works` | 61/61 | 60/48 | ya | 0 | 0 |
| mobile workspace | 64-118 tetap | 64-118 tetap | navigasi rail | 0 | 0 |

- Tidak ada konten, input, tombol, atau tautan di dalam pita header pada scroll 0 (0 temuan).
- `<h1>` tiap rute publik bersih di bawah header (`clears = true`).
- Keadaan bertahan saat scroll berhenti (`hold:compact`), dan jitter 12px tidak mengubahnya.
- Navigasi keyboard: fokus ke tombol Menu (ring 2px solid), Enter/klik membuka panel,
  fokus pindah ke dalam panel, Tab menyusuri tautan, Escape menutup.
- `prefers-reduced-motion`: semua `transition-duration` menjadi `0s`, keadaan tetap
  expanded -> compact (48px) -> expanded.
- Perpindahan rute dua arah: satu compact singkat lalu expanded, tanpa flicker berulang.
- Hanya satu elemen `<header>` per rute; `publicNav` dan chrome workspace saling eksklusif.
- Tema gelap: pelat logo membalik menjadi terang di atas gelap, tetap terbaca.

### Gerbang kualitas (skrip package.json)

- `npm run typecheck` (`tsc --noEmit`): 0 error.
- `npm run lint`: 0 error, 2 warning (sudah ada sebelumnya, `test/api/member-profile.test.ts:36`).
- `npm test` (`vitest run`): 299 lulus / 23 file.
- `npm run build`: sukses, 17 rute (sama dengan baseline).
- `npm run build` sebelum/sesudah pada rute: tidak ada perubahan daftar rute.

### Berkas yang diubah (6 berkas + 1 berkas biner; batas 5 dilewati untuk favicon)

Perubahan implementasi utama dibatasi pada lima berkas, ditambah aset favicon yang wajib
untuk kriteria "tidak ada lagi logo Gemini" dan satu berkas baru komponen bersama:

1. `components/ui/site-nav.tsx` (baru) - satu sistem navigasi expanded/compact.
2. `app/layout.tsx` - memasang `SiteNav` sekali di root (di dalam `Suspense`).
3. `app/page.tsx` - menghapus header inline, `ScrollProgress`, state scroll, ikon kapsul.
4. `app/how-it-works/page.tsx` - menghapus bilah sticky lama, memakai sistem bersama.
5. `components/ui/workspace-shell.tsx` - menghapus `border-b`, `RailScrollProgress`, impor mati.
6. `app/globals.css` - mengganti `.nav-shell` dengan `.site-nav` (dua keadaan + safe-area).
7. `app/favicon.ico` - identitas logo Teammate AI, 7 ukuran.

`components/ui/primitives.tsx` tidak diubah: `Logo` dan `NavCapsule` sudah benar dan dipakai ulang.

### Catatan integritas

Tidak ada commit, push, deploy, `git reset`, atau `git clean`. Tidak ada perubahan pada
formula skor, R1-R5, route API, DB, auth, atau environment. Screenshot sebelum/sesudah
tersimpan di `/tmp/t510/final/`.

## Fase 3.T-5.10-REDESIGN | Situs Imersif, Nav Kaca Tunggal, Logo, Kalender

Rujukan visual yang dipakai adalah template Fuelplate di
`/home/nando/Downloads/meal-planning-app-landing-page-v1/fuelplate-recipes-template/`
(nama "Stride" tidak ada di workspace; pengguna mengonfirmasi Fuelplate sebagai rujukan).
Yang diadaptasi hanya pola geraknya: reveal saat masuk viewport, cerita tersemat (pinned
storytelling), dan transisi halaman. Identitas, aset, teks, dan produk Fuelplate tidak
dipakai, dan tidak ada Three.js.

### Skill yang dimuat

`antislop`, `antislop-ui`, `antislop-layoutmobile`, `ui-ux-pro-max`.

### Berkas yang diubah (6 + 2 turunan)

| Berkas | Perubahan |
| --- | --- |
| `components/motion/pinned-story.tsx` | **baru**. Mesin cerita tersemat bersama untuk dua rute: `PinnedTrack` (sticky), `StepBar`, `PinnedDiagram`, `StackedSteps` (fallback), konstanta `STAGE_H`/`STAGE_FRACTION` |
| `app/page.tsx` | `AlurProduk` memakai `PinnedStory` (`id="cara-kerja"`), `ALUR_STEPS`/`ALUR_VISUAL`, transisi halaman (opacity masuk, transform keluar), `LogoPlate` di footer |
| `app/how-it-works/page.tsx` | bagian "Contoh perhitungan" memakai `PinnedStory` (`id="perhitungan"`) dengan bobot K/S/C/M nyata, total `Σ ... = 0,64`, `LogoPlate` di footer |
| `components/ui/site-nav.tsx` | cangkang kaca, `LogoPlate`, tombol menu dengan `triggerRef`, state expanded/compact |
| `components/ui/primitives.tsx` | `Logo` dirapikan (hub, radius 2.75/2.4, baseline lebih lebar, stroke 1.9, prop `style`), `LogoPlate` baru, kelas permukaan kalender `cal-*` |
| `app/globals.css` | `.site-nav-shell`, `.pinned-*`, `.cal-*`, aturan nav < 420px, aturan viewport pendek, penjaga reduced-motion |
| `app/favicon.ico` | digenerasi ulang (7 ukuran, 16-256) |

Berkas keenam (`pinned-story.tsx`) disetujui pengguna supaya komponen tersemat tidak
diduplikasi di dua rute. `app/favicon.ico` adalah berkas biner turunan dari geometri
`<Logo>`, bukan sumber baru.

### Logo

Tidak ada branding Gemini di UI. "Gemini" hanya muncul sebagai salinan produk tentang
penyedia AI dan tetap dipertahankan. `Logo` yang sudah ada memang mark Teammate AI asli
(tiga titik anggota, hub, garis dasar), jadi yang dikerjakan adalah merapikan geometrinya
lalu menurunkannya jadi satu identitas di empat tempat: navbar, footer, favicon, dan
sidebar workspace. `LogoPlate` memusatkan glyph 64% di dalam pelat membulat 32%, sehingga
navbar (28px), footer (24px), dan favicon memakai proporsi yang sama.

### Cerita tersemat (pinned storytelling)

- Visual memakai `position: sticky` biasa. Tidak ada `overflow: hidden` di `body`, tidak
  ada penahan wheel, tidak ada scroll hijacking; terukur `body.overflowY = visible` di
  semua 27 tangkapan layar.
- Tahap hanya aktif di `min-width: 1024px` dan mati di `prefers-reduced-motion`. Di bawah
  itu, atau saat reduce, isi dirender sebagai `StackedSteps` biasa.
- Progres memakai `offset: ['start 0.08', 'end end']`. Dua offset lain diukur dan
  ditolak: `start start` membuat langkah pertama beku di 0%, dan `start end` menghabiskan
  langkah pertama sebelum tahap sempat berhenti.
- Hasil terukur (1440x900, rel build terakhir): track 3096px, langkah aktif berganti
  01 -> 02 -> 03 -> 04 (4 langkah berbeda), dan tahap lepas di ujung (`stageBottom` = -35).
  Di `/how-it-works` urutannya 01 K -> 02 S -> 03 C -> 04 M.
- Tahap berukuran `calc((100dvh - var(--site-nav-h-compact)) * 0.86)`, jadi terlihat
  sebagai jendela, bukan layar penuh, dan bagian berikutnya mengintip di bawahnya.

### Transisi halaman

Opacity pada masuk dan tambahan transform hanya pada keluar. Transform di sisi masuk
dicoba lebih dulu dan dibatalkan karena merusak pengukuran `whileInView` pada anak-anak
komponen. Hasil terukur, dua arah: 0 frame kosong, opasitas minimum 1, tombol back
kembali ke rute yang benar (`/how-it-works`), dan tinggi `main` stabil di dua nilai yang
sama (4869/5726) tanpa layout shift.

### Navigasi kaca mengambang

Satu komponen, satu `<header>` per rute. Keadaan terukur (Chromium headless, produksi):

| Sampel | state | tinggi | kapsul | tombol menu | panel |
| --- | --- | --- | --- | --- | --- |
| desktop atas | expanded | 68 | ya | tidak | tidak |
| desktop scroll turun | compact | 54 | tidak | ya | tidak |
| desktop scroll naik | expanded | 68 | ya | tidak | tidak |
| desktop menu dibuka | compact | 212 | tidak | ya | ya (`aria-expanded=true`) |
| desktop menu ditutup | compact | 54 | tidak | ya | tidak |
| mobile atas | expanded | 60 | tidak | ya | tidak |
| mobile scroll turun | compact | 48 | tidak | ya | tidak |
| mobile scroll naik | expanded | 60 | tidak | ya | tidak |
| mobile menu dibuka | compact | 204 | tidak | ya | ya |
| mobile menu ditutup | compact | 48 | tidak | ya | tidak |

Di bawah 420px nav mulai dalam wujud compact karena kapsul expanded terbukti meluber
(kapsul berakhir di 324px dan toggle tema di 332px pada viewport 320px). Toggle tema
terverifikasi berada di dalam batas nav di kelima viewport.

### Kalender (tampilan dimodernkan, mekanisme tetap)

Kelas `cal-panel`, `cal-head`, `cal-nav`, `cal-weekdays`, `cal-day` (plus `data-today`),
dan `cal-foot` hanya menata permukaan. Semua handler, matematika UTC, dan kontrak
`YYYY-MM-DD` tidak disentuh. Hasil uji ujung ke ujung:

| Uji | Hasil |
| --- | --- |
| panel terbuka | ya (dialog tampil) |
| fokus awal | `2026-11-22` (hari ini) |
| ArrowRight | `2026-11-23` |
| ArrowDown | `2026-11-30` |
| bulan berikutnya | `November 2026` -> `Desember 2026` |
| panah melewati batas bulan | bulan ikut maju ke `Desember 2026` |
| bulan sebelumnya | `November 2026` |
| Escape | panel tertutup, fokus kembali ke `#deadline` |
| klik tanggal 15 | label `15 November 2026`, panel tertutup |
| kirim formulir | body `{"title":"Uji Akhir","deadline":"2026-11-15"}` |
| panel sukses | tampil |

### Responsif (terukur)

27 tangkapan layar di lima viewport (1440x900, 768x1024, 390x844, 320x700, 844x390) x dua
rute:

- overflow horizontal: **0** di seluruh 10 pasangan viewport/rute.
- scroll terkunci: **0** (`body.overflowY` selalu `visible`).
- track tersemat muncul di luar desktop: **0**.
- toggle tema di luar batas nav: **0**.
- perbaikan yang muncul dari tangkapan layar: legenda diagram diringkas di bawah `sm`
  (di 320px label baris terpotong jadi "Kemiripan..."), label baris membungkus alih-alih
  terpotong di bawah `sm`, kolom meta disembunyikan di 1024-1280px (`lg:hidden xl:block`),
  total diberi awalan `Σ`.

### Gerbang mutu

| Perintah | Hasil |
| --- | --- |
| `npx tsc --noEmit` | 0 error |
| `npm run lint` | 0 error, 2 warning lama (`test/api/member-profile.test.ts:36` `_fn`, `_args`) |
| `npm test` | 299 tes, 23 berkas, lulus |
| `npx next build` | 17 rute, exit code 0 |

### Reduced motion

`matchMedia('(prefers-reduced-motion: reduce)')` cocok; tidak ada track tersemat, tidak ada
`.pinned-stage`, `StackedSteps` hadir, 0 reveal tersembunyi, opasitas minimum reveal 1.

### Keputusan yang menyimpang dari instruksi awal

1. Rujukan "Stride" tidak ada; dipakai Fuelplate (dikonfirmasi pengguna).
2. Berkas implementasi 6, bukan 5 (disetujui pengguna).
3. Nav mulai compact di bawah 420px karena keterbatasan fisik 320px.
4. Transform pada transisi hanya di sisi keluar.
5. Tahap tersemat 0,86 viewport, bukan 1,0.

### Cacat lama yang dibiarkan dan dilaporkan

`app/p/[code]/tasks/tasks-client.tsx:349` memuat em dash di teks yang terlihat
("Menganalisis N tugas — maksimal 3 panggilan Gemini per proses."). Sesuai larangan
antislop R-02 seharusnya diganti, tetapi berkas itu di luar lima berkas wajib dan tidak
disentuh agar cakupan tetap terkendali. Em dash lain hanya ada di komentar, `aria-label`,
dan metadata prioritas.

### Catatan integritas

Tidak ada commit, push, deploy, `git reset`, atau `git clean`. Tidak ada perubahan pada
formula skor, R1-R5, route API, DB, auth, atau environment. Tidak ada Three.js, dan hanya
`framer-motion` yang dipakai. Screenshot akhir di `/tmp/t510redesign/after/`
(27 berkas + `report.json`), bukti uji di `/tmp/t510redesign/final.json` dan
`/tmp/t510redesign/nav_cal.json`.

## Fase 3.T-5.13-QUIET-LUXURY

Tugas: mengubah seluruh lapisan presentasi menjadi Quiet Luxury Editorial dengan
palet champagne/gold, sidebar baru, sistem gerak baru, dan logo orisinal. Batas
fungsional tidak berubah: API, skema DB, auth, formula skor, R1-R5, pipeline AI,
algoritma penugasan, validasi bisnis, route, fitur, dan secret tetap seperti semula.
Tidak ada data dummy.

### Konflik sumber yang dilaporkan lebih dulu

Sesuai aturan brief, konflik dilaporkan sebelum implementasi, bukan diputuskan diam-diam.

1. **Palet.** `DESIGN (1).md` menetapkan kanvas `#ffffff` dengan aksen azure
   `#2f66ff`; brief menetapkan kanvas `#F7F6F2` dengan champagne `#8F6D32`.
   Brief menang. Konsekuensi terukur: `#8F6D32` di atas `#F7F6F2` hanya 4,41:1,
   jadi gold sebagai **teks** dibatasi pada ukuran besar (>=18,66px bold / 24px
   regular); label kecil memakai `--ink` atau `--muted`.
2. **Dimensi sidebar.** Implementasi T-5.11 yang sudah terverifikasi memakai
   265/78px. Brief menetapkan 260/72px, dan brief menang. Offset kolom ikut
   berubah 289->284 dan 102->96.
3. **Spesifikasi sidebar tidak ada di DESIGN.md.** Grep mengembalikan nol hasil
   untuk "sidebar/rail/drawer". Jadi brief menambah aturan baru, bukan menimpa.
4. **Logo Gemini tidak ada sebagai identitas.** Kata "Gemini" hanya muncul di teks
   penjelasan faktual pipeline AI (how-it-works baris 49/51, tasks baris 349,
   homepage baris 849). Itu copy jujur tentang layanan yang benar-benar dipanggil,
   bukan identitas visual, sehingga dibiarkan. `Logo`/`LogoPlate` sudah orisinal.

### Keputusan pengguna

- **Gold penuh sesuai brief**: token persis `#8F6D32` (light) dan `#C8A96E` (dark),
  dengan pembatasan teks besar seperti di atas.
- **Poles komponen yang masih biru/lama** untuk batch lanjutan, bukan rombak ulang
  setiap halaman.
- **Perbaiki em dash** di `tasks-client.tsx:349` (defect lama, disetujui).
- **Tandai baris yang semua kandidatnya gugur R2** (lihat temuan di bawah).

### Yang dikerjakan

**Token dan materi.** Seluruh 3 blok tema gelap ditulis ulang (`:root[data-theme="dark"]`,
media query, dan blok duplikat yang sudah ada sebelumnya). Kanvas hangat `#F7F6F2` /
`#0A0A0C`, permukaan `#EFECE6` / `#0F1013`, kartu `#ffffff` / `#15161A`, hairline
`rgba(24,24,27,0.09)` / `rgba(255,255,255,0.08)`. Bayangan jadi netral-hangat dan
sangat tipis. Wash kanvas biru/hijau/violet dihapus. Nama token semantik lama
dipertahankan supaya ~56 komponen tidak perlu ditulis ulang.

**Sidebar.** Permukaan datar tanpa blur dan tanpa bayangan, satu hairline, brand
section 64px, navigasi berkelompok (`Proyek` / `Umum`) dengan label 10px/0,12em
uppercase, ikon stroke 1,5px, baris 40px, dan blok profil di bawah yang menampilkan
kode proyek nyata (bukan pengguna palsu). Status aktif ditandai bar gold
2,5px x 18px sebagai `::before` plus wash 8%, **bukan** blok padat. Toggle tema
dipindah keluar dari `.rail-label` supaya tetap hidup saat rail menyempit.

**Koreografi collapse.** Label memudar 120ms lebih dulu, lalu lebar bergerak 320ms
(`transition-delay` selebar fade), tanpa JavaScript. Label tidak pernah terpotong
karena kotaknya baru dilepas setelah opacity mencapai 0. Tooltip hanya dirender saat
collapse.

**Sistem gerak.** Token motion dipindahkan ke `:root`. Ini perbaikan bug nyata, bukan
preferensi: `@theme inline` adalah direktif Tailwind, sehingga nilainya di-inline ke
utilitas dan **tidak terbaca sebagai custom property runtime**. Pengukuran
`getComputedStyle` mengembalikan string kosong untuk `--dur-entrance`, `--dur-nudge`,
`--dur-modal-in/out`, dan `--stagger-card`. Setelah dipindah ke `:root`, ke-14 token
terbaca dan sesuai spesifikasi. `EASE.out` dan `DURATION` lama sengaja dipertahankan
agar puluhan komponen yang sudah memakainya tidak berubah diam-diam.

**Komponen bahasa lama.** Sel `UTAMA` pada matriks berubah dari blok hitam + teks
putih menjadi `bg-accent-tint` + bar gold kiri 2px + angka tabular lebih besar. Badge
langkah di homepage berubah dari cakram biru `#1d4ed8` menjadi tint gold dengan
hairline. `.site-nav-shell` diturunkan ke blur 12px dengan face 86%. `.app-topbar`
direkonsiliasi antara T-5.11 (opaque) dan T-5.13 (frosted): 95% opaque **dan** blur
12px. `.nav-capsule` dan `.site-nav-menu` melepas blur sepenuhnya, sehingga tinggal
**satu** permukaan ber-blur di seluruh aplikasi.

**Breadcrumb mobile.** Topbar kini menampilkan kode proyek dan section aktif
(`…8923… / Anggota`) dari `usePathname`. Sebelumnya tidak ada penanda halaman sama
sekali saat rail tersembunyi di balik drawer.

**Hierarki KPI dan komposisi.** Angka besar tabular (28-30px) untuk jumlah anggota,
jumlah tugas, dan total beban, dipisah hairline, menggantikan angka 22px yang tenggelam
di teks. Strip beban di halaman Tasks berubah dari balok gold lebar menjadi tanda
hairline 3px di atas baseline, supaya tidak lagi terbaca sebagai bar chart.

### Cacat kontras yang ditemukan dan diperbaiki (terukur, bukan dugaan)

Audit kontras dijalankan pada warna terhitung dari halaman hidup, bukan dari aritmetika
tangan. Dua kegagalan nyata tertangkap:

1. **Label pada isian gold.** `--accent-ink` masih `#ffffff` dari palet azure lama.
   Diukur: putih di atas `#8F6D32` = **4,77:1 (lulus)**, sedangkan ink `#141416` di
   atasnya = **3,86:1 (gagal)**. Asumsi awal (bahwa gold mid-tone butuh teks ink)
   ternyata **terbalik**, dan audit live yang menangkapnya sebelum rilis.
2. **Hover tombol gold.** `hover:bg-accent-strong/88` mengomposit gold di atas kanvas
   bone dan menjatuhkan label ke **3,86:1**. Diperbaiki di 5 tempat: hover sekarang
   menggeser fill ke `--ink` pekat, label naik ke 16,9:1.
3. **Hari terpilih pada kalender.** Sebelumnya fill `accent-strong` + teks
   `accent-ink` = **2,9:1 (gagal)**. Kini fill `--ink` + teks `--paper`, terukur
   **17,01:1 (light)** dan **18,01:1 (dark)**. Alur kalender diverifikasi end-to-end:
   form dibuka, kalender dibuka, hari dipilih, `19 November 2026` ter-commit, dibuka
   ulang dan pilihan tetap tersimpan.

Hasil audit akhir: **0 kegagalan** di light maupun dark untuk rail aktif/nonaktif,
label grup, tombol gold utama, judul halaman, body copy, sel utama matriks, dan
kalender (terpilih/hari ini/biasa).

### Anggaran area gold (terukur dari rect yang dirender)

| Halaman | 1440x900 | 390x844 |
|---|---|---|
| Beranda | 1,67% | 4,14% |
| Anggota | 1,74% | 3,40% |
| Tugas | 0,75% | 2,08% |
| Matriks | 0,91% | 0,65% |
| Cara kerja | 0,32% | 0,00% |

Semua di bawah batas ~5%.

### Temuan yang bukan bug (dilaporkan, tidak diubah)

Pada matriks, banyak sel menampilkan `0%` / `GUGUR`. Ditelusuri sampai API: untuk
tugas "Pipeline data" (8 jam) skor total ketiga anggota 0 dan tidak ada yang eligible.
Penyebabnya aturan R2 yang memang sudah ada: plafon = idealLoad 6 jam x 1,25 =
**7,5 jam**, sehingga tugas 8 jam sendirian sudah melewatinya, siapa pun pemilik
skill-nya. Sistem lalu jatuh ke cadangan R1 dan tetap memilih satu penanggung jawab.
Matematikanya benar dan **tidak diubah** karena formula dilarang diubah. Yang
ditambahkan hanya lapisan penjelasan presentasi: badge ringkas `▲ semua gugur R2`
pada baris tersebut, dihitung dari skor nyata (`every(!isEligible)`), bukan hardcode,
dengan `title` yang menyebut plafon 7,5 jam. Tanpa ini pengguna wajar mengira
aplikasinya rusak.

### Verifikasi terukur

| Spesifikasi | Target | Terukur |
|---|---|---|
| Rail expanded / collapsed | 260 / 72px | **260 / 72** |
| Brand section | 64px | **64px** |
| Label kategori | 10px / 0,12em | **10px / 1,2px** |
| Indikator aktif | 2,5x18px gold | **2,5x18px `rgb(143,109,50)`** |
| Transisi indikator | 280ms | **0,28s `cubic-bezier(.25,1,.5,1)`** |
| Stroke ikon | 1,5px | **1,5** |
| Ikon terpusat saat collapse | delta 0 | **delta 0** |
| Rail blur / shadow | datar | **`none` / `none`** |
| Topbar | 64px + frosted 12px + breadcrumb | **64px, `blur(12px) saturate(1.4)`, breadcrumb ada** |
| Permukaan ber-blur | hanya header | **1 (site-nav-shell)** |
| Token motion terbaca | 14 | **14, 0 kosong** |
| `prefers-reduced-motion` | dihormati | **rail/label transition `none`/`0s`** |
| Overflow horizontal | 0 | **0 di 5 viewport** |
| Kontras (light+dark) | 0 gagal | **0 gagal** |
| Area gold | <=5% | **0,32%-4,14%** |

Gerbang: `npx tsc --noEmit` 0 error; `npm run lint` 0 error + 2 warning lama
(`test/api/member-profile.test.ts:36`); `npx vitest run --exclude="**/*.live.test.ts"`
**294/294 lulus**; `npx next build` **EXITCODE=0**, 17 route.

Catatan jujur soal tes: `test/ai/gemini-models.live.test.ts` dan
`test/api/fr04_fr05_smoke.test.ts` memanggil Gemini API dan Supabase sungguhan dengan
timeout 5 detik, sehingga **flaky karena latensi jaringan** (terbukti: kode identik,
satu run 7 gagal lalu run berikutnya 0 gagal; keduanya tidak mengimpor satu pun berkas
presentasi yang diubah). Karena itu keduanya dikecualikan dari angka gerbang di atas,
bukan diklaim lulus.

### Em dash

`tasks-client.tsx:349` diperbaiki menjadi koma ("tugas, maksimal 3 panggilan Gemini").
Em dash yang tersisa sudah diperiksa dan sah: placeholder nilai kosong `'—'` di
`result-client.tsx`, `aria-label` di `theme-toggle.tsx`, serta judul halaman di
`how-it-works/page.tsx:17` dan `layout.tsx:46`. Bukan prosa.

### Catatan integritas

Tidak ada commit, push, deploy, `git reset`, `git clean`, penghapusan data, reset DB,
atau perubahan secret. Formula skor, R1-R5, route API, DB, auth, dan pipeline AI tidak
disentuh. Tidak ada dependensi baru. Berkas yang diubah: `app/globals.css`,
`lib/motion/tokens.ts`, `components/ui/app-sidebar.tsx`,
`components/ui/workspace-shell.tsx`, `components/ui/primitives.tsx`, `app/page.tsx`,
`app/how-it-works/page.tsx`, `app/p/[code]/members/members-client.tsx`,
`app/p/[code]/tasks/tasks-client.tsx`, `app/p/[code]/result/result-client.tsx`.
Screenshot verifikasi di `/tmp/t513/fin3/` (45 berkas: 5 viewport x 5 halaman, plus
state collapsed, drawer, dan tema gelap), audit kontras di `/tmp/t513/contrast.json`,
audit area gold di `/tmp/t513/gold.py`.

---

## Fase 3.T-5.14-GLASSMORPHISM

Tugas: T-5.14 / FR-19 / Fase 5. Tujuan yang diminta bukan "menambahkan
`backdrop-filter`", melainkan membuat efek kaca **benar-benar terlihat di browser
sungguhan** pada seluruh route, dengan bukti sebelum/sesudah.

### 1. Akar masalah: kenapa kaca sebelumnya tidak terlihat

Audit fase 1 tidak menyimpulkan apa pun dari ada/tidaknya kata `backdrop-filter` di
stylesheet. Yang diukur adalah **computed style di browser hidup**:

| Komponen | Kondisi aktual (terukur) | Penyebab |
|---|---|---|
| `.glass-panel` | `background: rgb(255,255,255)` (alpha 1), `backdrop-filter: none` | panel 100% opak; blur tidak pernah aktif |
| `.rail-surface` | `rgb(239,236,230)` opak, blur `none` | plate opak |
| `.nav-capsule` | blur `none` | tidak pernah diberi blur |
| `.site-nav-shell` | `color(srgb … / 0.86)` + `blur(12px)` | satu-satunya kaca, tapi 86% |
| `.app-canvas` | grid 64px di atas kanvas rata | latar di bawah kaca hanya bervariasi ~2 level RGB |

Dua sebab, dan keduanya harus diperbaiki bersamaan:

1. **Permukaan opak.** Sebuah `backdrop-filter` di atas latar yang seragam adalah
   operasi tanpa efek visual. Tanpa alpha < 1, blur tidak punya apa pun untuk
   diblur.
2. **Latar mati.** Kanvas rata (grid 64px adalah pola tell antislop R-07) membuat
   backdrop di bawah rail praktis konstan, jadi blur 18px sekalipun mengembalikan
   warna yang sama.

### 2. Bug build yang membuat kaca tetap tidak muncul (ditemukan saat verifikasi)

Setelah sistem kaca ditulis, kaca **masih** opak di Chrome. Penyebabnya bukan CSS
yang salah tulis, melainkan minifier:

- Turbopack meminifikasi CSS dengan Lightning CSS memakai target browserslist yang
  mencakup **Safari 15**.
- Lightning CSS menulis ulang setiap tes `@supports` yang menyebut properti yang
  bisa di-prefix. `@supports not (backdrop-filter: blur(1px))` menjadi
  `@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px)))`.
- Chrome melaporkan `-webkit-backdrop-filter` sebagai **tidak didukung**, sehingga
  negasi dari disjungsi itu bernilai **true**. Fallback opak menang, dan seluruh
  kaca dirender 100% opak.

Diukur di browser: `CSS.supports('not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px)))')`
= `false`, sementara kondisi yang sama setelah di-prefix Lightning CSS = `true`.

Perbaikan: semua fallback ditulis sebagai **disjungsi positif** —
`@supports (backdrop-filter: blur(1px))` — dengan wajah opak sebagai deklarasi
dasar dan kaca dilapiskan di dalam query. Disjungsi positif tetap benar setelah
di-prefix (`or` bernilai true bila salah satu ejaan didukung). Diverifikasi pada
CSS **hasil build produksi**: `@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px)))`.

Bug kedua, ditemukan dengan probe style: `--rail-tint` didefinisikan dengan sintaks
koma (`239, 236, 230`). Bentuk `rgb(var(--rail-tint) / var(--alpha))` **tidak valid**
dan gagal diam-diam menjadi `rgba(0,0,0,0)`. Nilai diubah ke sintaks spasi
(`239 236 230`), yang bekerja. Diukur: rail menjadi `rgba(239,236,230,0.62)`.

### 3. Sistem kaca bersama

Lima tingkat, bukan satu nilai blur untuk semua komponen:

| Tier | Kelas | Alpha (light/dark) | Blur |
|---|---|---|---|
| 1 | `glass-nav` | 42% / 42% | 12px |
| 2 | `glass-rail`, `.app-topbar`, `.nav-capsule` | 62% / 74% | 18px (capsule 8px) |
| 3 | `glass-panel` | 80% / 84% | 24px |
| 4 | `glass-solid` | 100% | — (keterbacaan angka) |
| 5 | scrim | — | — |

Setiap permukaan kaca membawa empat bahan yang sama: wajah transparan, blur +
`saturate(140%)`, border hairline, dan highlight dalam di tepi atas. Latar kanvas
dibangun ulang sebagai **medan kedalaman**: tiga radial light (emas, hijau, ungu
redup) plus falloff vertikal, menggantikan grid 64px.

### 4. Hasil terukur (browser hidup, 1440x900)

| Permukaan | Light | Dark |
|---|---|---|
| `.rail-surface` | `rgba(239,236,230,0.62)` + `blur(18px)` | `rgba(15,16,19,0.74)` + `blur(18px)` |
| `.glass-panel` | `rgba(255,254,250,0.8)` + `blur(24px)` | ikut token gelap |
| `.site-nav-shell` | `rgba(255,253,246,0.42)` + `blur(12px)` | ikut token gelap |
| `.nav-capsule` | `rgba(255,253,246,0.62)` + `blur(8px)` | ikut token gelap |
| `.app-topbar` | `rgba(255,253,246,0.62)` + `blur(18px)` | ikut token gelap |

Kontras teks pada wajah kaca yang sudah dikomposit terhadap kanvas (diukur, bukan
diasumsikan):

| Tema | Teks utama | Label nav muted |
|---|---|---|
| Light | 16.15:1 | 5.23:1 |
| Dark | 17.55:1 | 6.18:1 |

Semua di atas ambang AA 4.5:1.

### 5. Sidebar dan navigasi

- Rail: 260px terbuka, 72px terlipat, drawer 260px di mobile. Terukur: offset kolom
  konten **284px -> 96px** saat collapse, jadi tidak ada tumpang tindih.
- Profil proyek dipindah langsung di bawah brand (sebelumnya dipaku di bawah,
  jauh dari navigasi).
- Drawer mobile memakai `rgba(239,236,230,0.86)` + `blur(18px)` di atas scrim gelap.
- Capsule navigasi mengambang: pill aktif `--rail-active` dinaikkan dari 8% ke 13%
  (light) dan 10% ke 16% (dark) karena wajah capsule kini transparan.

### 6. Gerak

`page-enter` 480ms, indikator sidebar 280ms, hover kartu/baris 200ms, nudge ikon
150ms (transform saja). Semua dengan easing master-spec, tanpa bounce, dan
dimatikan di bawah `prefers-reduced-motion`.

### 7. Bukti visual

Screenshot ada di `docs/t-5.14-evidence/`:
`before/` (20 PNG, kondisi awal) dan `after/` (20 PNG, kondisi akhir), masing-masing
5 route x 2 viewport x 2 tema: `/`, `/how-it-works`, `/p/[code]/members`,
`/p/[code]/tasks`, `/p/[code]/result`.

Catatan metodologi: harness awal memakai `Page.captureScreenshot` dengan
`captureBeyondViewport: true`. Flag itu menjalankan ulang layout **saat** capture,
sehingga media query `lg:` sempat tidak cocok dan rail yang `fixed` menimpa konten
di dalam frame 1440px. DOM selalu benar (H1 terukur di x=348, rail berakhir di
x=272); artefak itu murni dari capture dan sempat terlihat seperti bug tumpang
tindih. Harness sekarang memperbesar viewport secara eksplisit lalu menunggu 600ms
sebelum capture, sehingga layout terukur dan layout terlukis identik.

Harness juga sempat menulis profil Chrome (16MB, berisi Unix socket) ke dalam
folder bukti. Turbopack mencoba membaca socket itu sebagai modul CSS dan panic
(`Parsing CSS source code failed`) sehingga dev server mengembalikan 500. Profil
dipindah ke `/tmp` dan folder bukti dibersihkan.

### 8. Verifikasi teknis

| Perintah | Hasil |
|---|---|
| `npm run typecheck` | lulus, 0 error |
| `npm run lint` | 0 error, 3 warning (2 sudah ada sebelumnya di `test/api/member-profile.test.ts`, 1 di skrip bukti) |
| `npm run test` | 23 berkas, 299 tes lulus |
| `npm run build` | exit 0, 0 error |

### 9. Batas fungsional

Tidak ada perubahan pada API, database, autentikasi, formula skor, R1-R5, algoritma
penugasan, pipeline AI, atau validasi bisnis. Kalender/`DateField` tetap utuh dan
terlihat di halaman Tugas. Tidak ada commit, push, deploy, `git reset`, `git clean`,
atau perubahan secret. Berkas yang diubah pada batch ini: `app/globals.css`,
`components/ui/app-sidebar.tsx`, `components/ui/workspace-shell.tsx`,
`components/ui/primitives.tsx`, `app/page.tsx`, `app/how-it-works/page.tsx`,
`app/p/[code]/members/members-client.tsx`, `app/p/[code]/tasks/tasks-client.tsx`,
`app/p/[code]/result/result-client.tsx`.

## Fase 2.T-6.01-GROQ-ENV

Tugas: T-6.01 / FR-06 / FR-09. Cakupan **konfigurasi environment saja**. Tujuan
yang diminta bukan memindahkan pipeline AI, melainkan menyiapkan variabel Groq dan
validasinya sehingga satu-satunya pekerjaan yang tersisa untuk migrasi adalah
mengisi `GROQ_API_KEY` dan `GROQ_MODEL_TEXT`. Pipeline teks masih memakai Gemini
setelah batch ini.

### 1. Audit environment (kondisi sebelum perubahan)

| Temuan | Bukti |
|---|---|
| Tidak ada validasi environment Zod sama sekali | `grep -rn "z.object" lib/` untuk nama `env`/`api_key`/`url` → kosong |
| Pola proyek yang ada adalah baca `process.env` **saat dipanggil** (lazy) dengan error jelas | `lib/db/project.ts:5-18` (`getSupabaseClient()`) |
| Variabel provider dibaca langsung, tanpa skema | `lib/ai/analyze-task.ts`, `lib/ai/explain.ts` |
| `.env.example` ada tetapi **tidak pernah bisa di-commit** | `.gitignore:34` berisi `.env*`, sehingga `.env.example` juga ter-ignore; `git ls-files` → tidak ada berkas env yang terlacak |
| `.env.local` tidak terlacak git | `git ls-files --error-unmatch .env.local` → error pathspec; `git check-ignore -v .env.local` → `.gitignore:34` |

Karena validasi environment belum ada, modul validasi dibuat **mengikuti pola yang
sudah dipakai proyek** (Zod + lazy read), bukan menambah dialek pengecekan baru.

### 2. Variabel environment

Ditambahkan (baru):

| Variabel | Contoh/default | Sifat |
|---|---|---|
| `GROQ_API_KEY` | kosong (diisi pengguna) | server-only, rahasia |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | server-only, publik |
| `GROQ_MODEL_TEXT` | kosong, contoh `llama-3.3-70b-versatile` | server-only, publik |

Dipertahankan dengan sengaja:

| Variabel | Alasan |
|---|---|
| `GEMINI_API_KEY` | dipakai jalur embedding; belum ada pengganti Groq yang terverifikasi |
| `GEMINI_MODEL_EMBED` | idem (default `text-embedding-004`) |
| `GEMINI_MODEL_TEXT` | masih dibaca jalur teks saat ini sampai migrasi Groq mendarat |

Tidak ada satu pun variabel provider yang memakai prefiks `NEXT_PUBLIC_`. Prefiks
itu menyalin nilai ke bundle browser; `grep` pada seluruh berkas yang diubah
menunjukkan `NEXT_PUBLIC_` hanya muncul di komentar peringatan dan di satu tes
negatif, tidak pernah sebagai variabel aktif.

### 3. Hasil validasi environment

Modul baru `lib/env.ts`:

- `readServerEnv(source?)` — parse + validasi, **semua variabel opsional**. Ini
  disengaja: pipeline masih Gemini, jadi mewajibkan Groq akan mematikan aplikasi
  yang sekarang. Bila ada nilai yang bentuknya salah, error hanya memuat **nama**
  variabel dan pesan, bukan nilai yang diterima.
- `requireGroqText(source?)` — aksesor ketat untuk pemanggilan Groq di masa depan.
  Melempar pesan yang menyebut `GROQ_API_KEY` dan/atau `GROQ_MODEL_TEXT` yang
  kosong, plus menunjuk `.env.local` dan `.env.example`.
- `describeAiEnv(source?)` — status non-throwing untuk health check; tidak pernah
  mengembalikan nilai secret.
- `redact()` — menghapus pola `gsk_*` dari pesan sebelum dilempar/di-log.

Redaksi diuji secara eksplisit: nilai `gsk_super_secret_value` dan
`gemini_super_secret_value` dimasukkan lewat fixture, lalu `JSON.stringify(status)`
di-assert tidak memuat keduanya, dan pesan error untuk key salah bentuk di-assert
tidak memuat nilai yang dikirim.

Karena skema memakai `.default()`, hasil parse menormalkan nilai, **tidak** menulis
balik ke `process.env`; kode pembaca lama (mis. `process.env.GEMINI_MODEL_TEXT`)
tetap berperilaku persis seperti sebelumnya.

Penjaga di `lib/ai/analyze-task.ts` sengaja **tidak melempar**. Modul itu
di-import saat evaluasi modul oleh route handler dan oleh test suite; melempar di
sana akan mengubah key provider *masa depan* yang belum diisi menjadi kegagalan
jalur Gemini *saat ini*. Yang diekspos adalah `aiEnvStatus` (hasil
`describeAiEnv()`), sehingga tidak ada request jaringan dan tidak ada log.

### 4. Bukti `.env.local` tidak tertimpa

- Cadangan: `/tmp/env.local.backup`.
- Lima baris asli (Gemini + Supabase) dibandingkan lewat checksum SHA-256 **baris
  saja**, tanpa mencetak nilai:
  - sebelum: `a98f4bacd2131e220bcb6402aac747e3358ac6729a443ac7799f7a656487b63b`
  - sesudah: `a98f4bacd2131e220bcb6402aac747e3358ac6729a443ac7799f7a656487b63b`
  - hasil: **identik byte-for-byte**.
- Blok Groq ditambahkan dengan *append* dan hanya bila `^GROQ_API_KEY=` belum ada,
  sehingga menjalankan ulang tidak menduplikasi.
- `.gitignore`: `.env.local` tetap ter-ignore (`git check-ignore -v .env.local` →
  `.gitignore:34:.env*`). Ditambahkan satu baris `!.env.example` agar template bisa
  di-commit; `git status --short` menampilkan `?? .env.example` dan **tidak**
  menampilkan `.env.local`.
- Tidak ada nilai secret di `.env.example`: satu-satunya nilai non-kosong adalah
  `GROQ_BASE_URL` (endpoint publik), `GEMINI_MODEL_TEXT` dan `GEMINI_MODEL_EMBED`
  (nama model, bukan secret).

### 5. Hasil verifikasi (`package.json` scripts)

| Perintah | Hasil |
|---|---|
| `npm run typecheck` | exit 0, 0 error |
| `npm run lint` | 0 error, 2 warning — keduanya sudah ada sebelumnya di `test/api/member-profile.test.ts:36` (`_fn`, `_args`), berkas tidak disentuh |
| `npm run test` | 24 berkas, **312 tes lulus** |
| `npm run build` | exit 0, 0 error |

Tes baru `test/env-check.test.ts` berisi 13 kasus yang menguji kontrak environment
(tidak memanggil provider, tidak bergantung pada `.env.local` developer): default
base URL, konfigurasi lengkap, environment kosong boleh dan tidak melempar,
penolakan `GROQ_API_KEY` tanpa prefiks `gsk_` tanpa membocorkan nilai, penolakan
`GROQ_BASE_URL` tidak valid, `GROQ_MODEL_TEXT` berisi spasi dianggap kosong,
`requireGroqText` menyebut kedua variabel, variabel Gemini embedding tetap ada,
`describeAiEnv` tidak membocorkan secret, dan import modul AI tidak pernah melempar
serta tidak membocorkan `gsk_*`.

Catatan flakiness yang ditemukan dan **dibuktikan bukan** akibat perubahan ini:
`test/integration/fr04_fr05_smoke.test.ts` gagal intermiten (1 dari 6 run) pada tes
`4.h`, karena tes itu menguji database Supabase **remote** dan batas waktu bawaan
5.000 ms. Pengukuran langsung: satu round-trip Supabase butuh ~0,9-2,0 detik, dan
tes `4.f` sendiri sudah ~4,1 detik, sehingga `4.h` melewati batas saat jaringan
lambat. Flake ini **tetap terjadi** saat perubahan T-6.01 dibuang (dikembalikan ke
versi HEAD) — jadi memang sudah ada sebelumnya. Berkas tes tidak diubah dan batas
waktu tidak dilonggarkan pada batch ini.

### 6. Batas fungsional

Tidak ada perubahan pada formula skor, K/S/C/M, R1-R5, permukaan API, database,
autentikasi, fallback, kalender, ekspor, maupun pipeline AI. Pipeline teks tetap
Gemini; Groq hanya dikenal dan divalidasi. Tidak ada dependency baru, tidak ada
commit, push, deploy, `git reset`, `git clean`, atau perubahan nilai secret.

Berkas yang diubah/dibuat (5 berkas):

1. `lib/env.ts` (baru) — skema Zod + accessor.
2. `.env.example` — blok Groq + panduan "Gemini untuk embedding saja".
3. `lib/ai/analyze-task.ts` — penjaga non-throwing (`aiEnvStatus`).
4. `test/env-check.test.ts` (baru) — 13 tes kontrak environment.
5. `.env.local` — blok Groq di-*append*, nilai lama tidak berubah; plus `.gitignore`
   (satu baris `!.env.example`).

Langkah berikutnya untuk migrasi (di luar cakupan tugas ini): panggil
`requireGroqText()` di titik pemanggilan teks yang baru, arahkan ke
`GROQ_BASE_URL`, lalu hapus `GEMINI_MODEL_TEXT` setelah jalur teks Gemini tidak
dipakai lagi. `GEMINI_API_KEY` dan `GEMINI_MODEL_EMBED` tetap sampai ada pengganti
embedding yang terverifikasi.

---

## Fase 5.T-5.16-RADIAL-SIDEBAR

Status: SELESAI. Satu navigasi untuk seluruh produk, diverifikasi di browser
sungguhan pada lima rute, dua viewport (plus 320px sempit), dua tema.

### Penyebab konflik sidebar lama

Ada DUA sistem navigasi yang hidup berdampingan, masing-masing dengan logika
active-state, penanganan fokus, dan perilaku mobile sendiri:

1. `components/ui/app-sidebar.tsx`, rail gelas 260px yang dipasang oleh
   `WorkspaceShell` pada rute `/p/*`. `WorkspaceShell` juga menggeser setiap
   halaman sejauh `--rail-offset` (284px) agar tidak tertutup rail.
2. `components/ui/site-nav.tsx`, bar kapsul `position: fixed` di root layout
   (`app/layout.tsx`), dengan kompaksi saat scroll dan spacer setinggi bar,
   yang disembunyikan pada `/p/*`.

Konfliknya bukan sekadar "dua tampilan berbeda": keduanya menyelesaikan masalah
overlap dengan cara yang saling bertentangan. Rail memesan ruang (menggeser
konten 284px) sementara bar kapsul mengambang di atas konten dan menutupinya
lalu menambahkan spacer untuk mengompensasi tinggi bar. Satu rute memakai
bahasa visual "kolom", rute lain "kapsul mengambang", dan produk terasa seperti
dua aplikasi. Rail 260px juga memakan 284px dari setiap layar kerja, langsung
dari area data (tabel tugas, matriks skor).

T-5.16 mengganti keduanya dengan SATU komponen bersama. `workspace-shell.tsx`
dan `site-nav.tsx` sekarang hanya menjadi adaptor tipis ke `RadialSidebar`;
`app-sidebar.tsx` tidak lagi direferensikan.

### Berkas yang diubah

1. `components/ui/radial-sidebar.tsx` (baru), komponen hub + arc bersama,
   `RadialSidebar` dan `buildRadialItems(code)`. Geometri sudut untuk desktop
   (busur 152deg) dan untuk mobile (kipas seperempat 90deg dari hub pojok
   kanan-atas). Durasi/busur gerak diekspos ke CSS lewat custom property:
   280ms buka, 200ms tutup, `cubic-bezier(0.16,1,0.3,1)`, stagger 26ms.
2. `components/ui/workspace-shell.tsx`, ditulis ulang menjadi pembungkus tipis:
   `RadialSidebar` + satu baris `workspace-context`. Offset 284px dihapus, jadi
   halaman kerja mendapatkan kembali lebar penuh.
3. `components/ui/site-nav.tsx`, ditulis ulang menjadi adaptor `RadialSidebar`
   untuk rute publik; mengembalikan `null` pada `/p/*` agar tidak pernah ada dua
   hub bertumpuk.
4. `app/globals.css`, seluruh CSS `.radial-*`, `.workspace-context`,
   `.workspace-crumb`, `.radial-safe` (bagian T-5.16).
5. `test/ui/radial-sidebar.test.ts` (baru), 7 tes kontrak destinasi.

Tidak ada perubahan pada API, database, autentikasi, formula skor K/S/C/M,
R1–R5, pipeline AI, atau logika bisnis. Tidak ada rute yang dihapus, tidak ada
dependency baru, tidak ada commit/push/deploy/`git reset`/`git clean`.

### Halaman yang memakai Radial Sidebar

Seluruh enam rute, satu komponen:

| Rute | Item menu | Active state terverifikasi |
|---|---|---|
| `/` (Beranda) | Beranda, Cara kerja | `Beranda` |
| `/how-it-works` | Beranda, Cara kerja | `Cara kerja` |
| `/p/[code]/members` | Anggota, Tugas, Matriks, Beranda, Cara kerja | `Anggota` |
| `/p/[code]/tasks` | idem | `Tugas` |
| `/p/[code]/result` | idem | `Matriks rekomendasi` |
| `/p/[code]/members/[id]` | idem | `Anggota` |

### Hasil pengujian interaksi dan responsif

Diukur dengan `docs/t-5.16-evidence/tools/probe.mjs` (Chrome lewat CDP, tanpa
dependency baru), 5 rute x 3 viewport (1440x900, 390x844, 320x700):

- Horizontal overflow: **0 di semua 15 kombinasi.**
- Item bertumpuk: **NONE di semua kombinasi** (AABB maupun lingkaran).
- Semua item di dalam viewport: **ya di semua kombinasi.**
- Escape menutup + fokus kembali ke hub: **ya.**
- Klik area luar menutup: **ya.**
- Menu tertutup tidak dapat dijangkau Tab (`reachableByTab: 0`): **ya.**
- Navigasi keyboard (event tombol asli): fokus ke item pertama saat buka,
  ArrowDown x2 maju, ArrowUp x1 mundur, tooltip item terfokus **tampak**
  (`:focus-visible` bekerja): **ya.**
- Hub tertutup tidak menutupi konten apa pun: probe kotak-konten menghitung
  **0 tabrakan** dengan tombol/input/label/judul/sel pada kelima rute, desktop
  dan mobile.

### Temuan nyata yang diperbaiki setelah inspeksi browser

1. **Kotak abu-abu di belakang hub (open).** Terbukti lewat pengukuran:
   `.radial-scrim` adalah ANAK dari `.radial-sidebar`; karena sidebar memakai
   `position: fixed` + `transform`, keduanya membentuk containing block, sehingga
   `inset: 0` pada scrim mengerut ke kotak 56x56 hub. Diperbaiki dengan
   memindahkan scrim menjadi SAUDARA sidebar (z-index 49) dan `isolation: isolate`
   pada trigger (bukan pada sidebar).
2. **Item bertumpuk di mobile** (5x18px) pada radius 72px. Diperbaiki lewat
   matematika chord; geometri mobile kini memakai kipas 90deg radius 140px,
   chord 54.6px (> 44px item), overlap AABB = 0.
3. **Menu tertutup masih bisa di-Tab** (5 stop) selama 200ms transisi tutup.
   Diperbaiki dengan `tabIndex={open ? 0 : -1}` (sinkron), bukan hanya
   `visibility`.
4. **Hub mobile menutupi teks/heading/tombol.** Probe posisi sudut menghitung
   tabrakan di lima rute: kiri-atas 4, kiri-bawah 5, kanan-bawah 3, **kanan-atas
   0**. Hub mobile dipindah ke pojok kanan-atas dengan kipas turun-kiri.
5. **Kode proyek tidak mendapat tempat di menu radial.** Diukur tiga kali (atas,
   bawah, kanan-atas, kanan-bawah), busur 152deg tidak menyisakan ruang untuk
   panel 200px. Chip dihapus; konteks pindah ke baris `workspace-context` di atas
   halaman, tempat ia punya ruang sungguhan.
6. **Toggle tema bertumpuk dengan item arc saat open.** Disembunyikan penuh
   (`visibility: hidden`) selama menu terbuka.

### Verifikasi build

- `npm run typecheck`, bersih.
- `npm run lint`, 0 error, 2 warning lama yang tidak tersentuh
  (`test/api/member-profile.test.ts:36` `_fn`/`_args`).
- `npm run test`, **319/319 lulus** (312 lama + 7 baru).
- `npm run build`, sukses ("Compiled successfully in 5.4s").

### Screenshot

- Sebelum: `docs/t-5.14-evidence/before/` (24 PNG, 6 rute x 2 viewport x 2 tema).
- Sesudah: `docs/t-5.14-evidence/after/` (24 PNG, idem).
- Menu terbuka: `docs/t-5.16-evidence/open/` (12 PNG, 3 rute x 2 viewport x 2 tema).

### Pembersihan sidebar lama

`components/ui/app-sidebar.tsx` (412 baris, rail 260px) **dihapus** setelah
penggantinya terverifikasi di kelima rute (probe: 0 tumpang-tindih, 0 luapan,
menu tertutup tak terjangkau Tab, keyboard berfungsi). Tidak ada importer yang
tersisa; typecheck, lint, test, dan build tetap hijau sesudahnya.

Catatan jujur: aturan CSS `.rail-*` di `app/globals.css` (sekitar baris
1170-1560) kini menjadi CSS mati karena satu-satunya pemakainya sudah dihapus.
Blok itu sengaja **belum** dipangkas pada tugas ini: ia tersebar dan terjalin
dengan token global (`--rail-w-*`), dan memotong ~400 baris tanpa siklus
verifikasi visual ulang berisiko meregresi tata letak yang baru saja terbukti
benar. Pemangkasan itu adalah pekerjaan bersih-bersih terpisah, bukan
"sidebar duplikat", duplikatnya (komponen dan pemakaiannya) sudah hilang.

---

## T-5.17 — Scroll Craft: transformasi scroll & motion (FR-19, FR-20)

### 1. Status instalasi skill

Skill disalin utuh ke `.agents/skills/scroll-craft/` (SKILL.md, `references/`,
`engine/`, `scripts/`, `template.html`). Tidak ada skill lain yang ditimpa.

`node scripts/doctor.mjs`:

| Pemeriksaan | Hasil | Dampak |
|---|---|---|
| `node` | OK | — |
| `ffmpeg` | **GAGAL** | Hanya dipakai `encode.sh` (video). Tidak ada video dalam rencana → **tidak memblokir**. Software sistem **tidak** dipasang otomatis. |
| `playwright-core` | tidak ada | Verifikasi dilakukan lewat CDP mentah (`docs/t-5.17-evidence/tools/`). Dependency baru tidak ditambahkan. |
| `KIE_AI_API_KEY` | tidak diset | Tidak relevan: `GEMINI_API_KEY` **diset** dan dipakai pipeline. |

### 2. Referensi yang dibaca

`SKILL.md`, `references/hero-depth.md`, `devices.md`, `taste.md`,
`uniqueness.md`, `feel.md`, `verify.md`, `worlds.md`, `approved-collection.md`,
`template.html`, sumber engine (`scrollcraft.js`, `scrollcraft.css`),
`scripts/doctor.mjs`, `scripts/shoot.mjs`.

### 3. Tata bahasa halaman + rencana motion

Rencana lengkap: `scrollcraft/builds/t-5.17/BRIEF.md`.

- **Grammar** — rute publik memakai *chaptered editorial* (pembuka bab
  bernomor, ritme tipografi, satu aksen champagne). Workspace memakai *live
  surface*: tanpa pembuka bab, tanpa pin, motion hanya untuk konfirmasi.
- **Vibe** — "measured, editorial, tactile, quiet, certain".
- **Signature move** — *the weight ledger* (lihat §5).
- **Kedalaman** — hero punya empat plane independen, bukan satu gambar
  parallax; tiap plane punya faktor sendiri dan semuanya `aria-hidden`.
- **Buka / tengah / tutup per seksi** — bukan satu animasi untuk seluruh
  halaman: hero membuka dengan tangga tipografi, tengah halaman mengetat ke
  ledger yang di-pin, penutup adalah *seam* yang mengisi ke 100% lalu
  menyerahkan ke CTA.

### 4. Perubahan per halaman

**Homepage (`app/page.tsx`)**
- Hero berlapis: 4 plane (`--back -1.1`, `--mid -0.55`, `--front +0.75`,
  `--near +0.28`), semuanya `aria-hidden` + `pointer-events:none`; lapisan teks
  1× (`.home-hero-copy`). Di bawah `lg` hanya *wash* yang bertahan.
- Tangga reveal tipografi; parallax terukur; transisi digerakkan scroll.
- **Form buat proyek dan `handleSubmit` tidak disentuh sama sekali.**

**How It Works (`app/how-it-works/page.tsx`)**
Empat keluarga device yang berbeda, satu per tahap:
- **A** pin (`#alur`, `data-sc-span="3"`, `ALUR_STAGES`) — langkah menyala
  monoton selagi piring tugas bertambah.
- **B** scroll reveal (`data-sc-stagger` pada `.hiw-assembly` atas
  `ASSEMBLY_ITEMS`, katalog T01–T11 yang nyata).
- **C** layered visual (`.hiw-depth`, dua plane `data-sc-parallax` `-0.7` dan
  `-0.35`, medan dibatasi separuh kanan).
- **D** progress-linked (`data-sc-act="flow"` pada `#aturan-alur`) menggambar
  penanda R1–R5 dari aturan yang sebenarnya.

**Workspace (`/members`, `/tasks`, `/result`)**
- Motion ringan dan fungsional saja; tidak ada pin, tidak ada bab, tidak ada
  hero — halaman tidak boleh terbaca sebagai landing page marketing.
- Form, validasi, pemilihan tanggal/deadline, akurasi skor, dan R1–R5 utuh.
- Hasil menganimasikan K/S/C/M **dari nilai sebenarnya**.

**Komponen bersama**
Sistem konsisten untuk Radial Sidebar, header/nav, Button, card/panel, modal,
dropdown, kalender, footer, dan loading/empty — tapi tidak semuanya memakai
gerak yang sama: sidebar memakai kipas kuartal, tombol memakai *roll label*,
kartu memakai *tinted elevation*, dan status kosong memakai *skeleton* diam.

### 5. Signature motion yang dibuat

**The weight ledger.** Empat komponen skor (K/S/C/M) tiba bergiliran terhadap
satu angka dasar yang tetap `0,00` sampai masing-masing mendarat, sehingga
total berjalan membaca **0,00 → 0,40 → 0,70 → 1,00** — dihitung dari bobot
nyata (40 + 30 + 20 + 10). Angka dasar memakai `--at: -1` agar sudah terlihat
sejak `p=0`. Ledger adalah *hand-off pulse*, bukan latch: `--next` memudarkannya
saat komponen berikutnya mengambil alih angka.

Terverifikasi dengan CDP: pada `p=0` seluruh baris 0,34 dan total `0,00`; lalu
`0,40` → `0,70` → `1,00`, satu angka terlihat pada satu waktu, dan bar
menghasilkan matriks transform yang nyata.

### 6. Kinerja & aksesibilitas

- **Engine tidak pernah diedit.** Salinan byte-identik
  (`public/scrollcraft/vendor/scrollcraft.js`, `app/scrollcraft-engine.css`)
  dipasang sekali oleh `components/motion/scrollcraft-engine.tsx` dan
  di-`destroy()` saat unmount maupun saat `pathname` berubah. Dijaga oleh
  `test/ui/scrollcraft-engine.test.ts` (sha256; sudah dibuktikan **gagal** bila
  engine diubah satu baris dan **lulus** lagi setelah dipulihkan).
- **`prefers-reduced-motion` dihormati.** Homepage menyusut 6895 → 2804 px:
  pin dan act tinggi dihapus, seluruh isi tetap terbaca, ledger menampilkan
  keadaan akhirnya.
- **Tidak ada elemen tertinggal di opacity 0.** Audit menyeluruh atas kelima
  aturan `--sc-p` yang mengatur `opacity` (`.home-ledger-toggle`,
  `.home-ledger-total`, `.hiw-step-row`, `.hiw-alur-act .hiw-assembly-item`,
  `.hiw-rule-why`) menemukan masing-masing kini punya fallback
  `(max-width: 1023px), (prefers-reduced-motion: reduce)` **dan** jaring
  `html:not(.sc-ready)`.
- **Scroll dua arah.** Diukur pada enam titik (3 di `/`, 3 di `/how-it-works`):
  `--sc-p` yang dicapai dengan menggulir **turun** identik dengan yang dicapai
  dengan menggulir **naik** (match=True di keenam titik), dan bingkai pada offset
  yang sama **identik piksel**.
- **Tanpa overflow horizontal.** 1440 px: `scrollWidth === 1440`. 390 px:
  `scrollWidth === 390`. 320×700: `scrollWidth === 320`.
- **Tata letak tidak bergeser** dan urutan baca dipertahankan (semantic HTML,
  tidak ada DOM yang dibangun dari objek konfigurasi).

### 7. Screenshot (contact sheet)

Semua di `docs/t-5.17-evidence/`, diambil di browser sungguhan (Chromium via
CDP), 0 error konsol pada setiap rute.

| Folder | Isi |
|---|---|
| `desktop-home/` | 8 bingkai, 1440×900 |
| `desktop-ledger/` | urutan ledger 0,00 → 1,00 |
| `desktop-hiw/` | 9 bingkai, empat tahap |
| `desktop-result/` | proyek terisi, matriks + R2 + beban |
| `desktop-tasks/` | 5 tugas / 30 jam nyata |
| `desktop-members/` | 4 anggota nyata |
| `dark-tasks/` | tema gelap |
| `mobile-home/`, `mobile-hiw/` | 390×844 |
| `narrow-home/` | 320×700 |
| `reduced-home/` | `prefers-reduced-motion` |
| `reverse/` | offset sama, dicapai dari bawah vs dari atas |

### 8. Hasil verifikasi build

- `npm run typecheck` — bersih.
- `npm run lint` — **0 error, 24 warning**, semuanya di berkas yang tidak boleh
  disentuh (engine vendored ×2) dan satu tes lama
  (`test/api/member-profile.test.ts:36`).
- `npm run test` — **322/322 lulus** (26 berkas).
  Catatan jujur: `test/integration/fr04_fr05_smoke.test.ts` menulis ke Supabase
  sungguhan dan **timeout pada batas bawaan 5 detik** di sesi ini (insert nyata
  butuh ~1,2–6 detik). Dengan `--testTimeout=30000` berkas itu lulus **8/8** dan
  seluruh suite **322/322**. Ini batas waktu lingkungan, bukan regresi.
- `npm run build` — **"✓ Compiled successfully in 11.8s"**.

### 9. Bug nyata yang ditemukan & diperbaiki saat verifikasi

1. **Label tombol solid tidak terbaca (BLOKIR).** `variant="solid"` menghitung
   `color === background` di **kedua tema**: `rgb(20,20,22)` pada
   `rgb(20,20,22)` di terang, `rgb(244,244,246)` pada `rgb(244,244,246)` di
   gelap. "Analisis semua dengan AI" tergambar sebagai pil kosong. Akar masalah
   dilacak dengan CDP `CSS.getMatchedStylesForNode`: `scrollcraft.css:114`
   membawa `button, input, select, textarea { color: inherit }` yang
   **unlayered**, sedangkan seluruh utilitas Tailwind berada di
   `@layer utilities`. Menurut spesifikasi cascade-layers, deklarasi unlayered
   mengalahkan **semua** deklarasi berlapis, sekuat apa pun selektornya —
   sehingga `.text-paper` kalah tanpa pernah terlihat diuji.
   **Perbaikan tanpa menyentuh engine:** utilitas warna yang dipakai tombol
   dideklarasikan ulang **unlayered** di `app/scrollcraft-pages.css` (berkas
   yang dimuat paling akhir). Terukur sesudahnya: `rgb(247,246,242)` pada
   `rgb(20,20,22)` (terang) dan `rgb(10,10,12)` pada `rgb(244,244,246)` (gelap).
   Kontras WCAG: solid **17,01:1** / **18,01:1**, accent **4,77:1** / **8,81:1**
   — semuanya lolos AA.
2. **Hub radial menutupi teks panel bobot** di `/result` (panel terbaca
   "…itung di …r, tanpa …ggil …an AI"). Ditambahkan gutter `lg:pl-[5.5rem]`
   pada `<main>` rute itu (hub 56 px pada 18 px dari tepi, terpusat vertikal).
3. **Nama anggota terpotong di kolom AKSI** ("Ayu Pramesw…"). Kolom dilebarkan
   `w-[172px]` → `w-[210px]` dan `<select>` diberi `min-w-[9.5rem]`.
4. **R4/R5 di `/how-it-works` tertinggal di opacity 0 pada ponsel.** Fallback
   `hiw-rule-why`/`hiw-rule-mark` diperluas ke `(max-width: 1023px)` dan
   diverifikasi ulang pada 390 px.

### 10. Batasan yang dipertahankan

API, database, autentikasi, rumus skor, R1–R5, pipeline AI, mesin penugasan,
kalender beserta validasinya, ekspor, what-if/lock/swap/undo, dan seluruh rute
**tidak diubah**. Tidak ada `git reset`, `git clean`, commit, push, atau deploy.
Tidak ada data yang dihapus. Tidak ada video atau aset berbayar.

## Fase B.T-B.01 — Verifikasi Referensi Ilmiah (FASE B)

Verifikasi ulang metadata 15 entri `docs/laporan/01_REFERENSI.md` terhadap sumber primer
(Crossref REST API, halaman resmi penerbit, arXiv API, OpenLibrary, NeurIPS proceedings).
Read-only terhadap referensi asli; tidak ada source code yang diubah.

### Hasil

| Status | Jumlah | Entri |
|---|---|---|
| VERIFIED | 13 | R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14 |
| PARTIALLY VERIFIED | 2 | R1 (tahun 2010 vs 2011), R2 (tahun tidak ada di Crossref) |
| UNVERIFIED | 0 | — |
| INVALID | 0 | — |

### Hitungan artikel ilmiah (bukan seluruh publikasi)

- Artikel jurnal: **8** (R3, R4, R7, R8, R9, R10, R11, R14)
- Artikel prosiding: **2** (R5, R6)
- **Total artikel ilmiah: 10** — syarat minimum terpenuhi **tepat pada batas**
- Bab buku: 2 (R1, R2) · Buku: 1 (R12) · Preprint: 1 (R15) — tidak dihitung artikel

### Koreksi wajib

1. **R5**: rentang halaman "3111–3119" tidak tercantum di metadata resmi NeurIPS dan tidak
   dapat dibuktikan. Hapus rentang halaman, gunakan "(Vol. 26)".
2. **Ringkasan `01_REFERENSI.md`**: frasa "14 artikel/bab/buku peer-reviewed" harus dibaca
   sebagai total publikasi peer-reviewed, bukan jumlah artikel.
3. **R1/R2**: tetapkan tahun (2011 untuk R1, 2007 untuk R2) secara konsisten.
4. **R15**: preprint arXiv, tanggal submisi 19 Desember 2023, `journal_ref` kosong.

### Kesenjangan topik

- **Task Allocation / Workload Balancing** (topik inti proyek) belum punya rujukan langsung;
  hanya bertumpu pada R11 (Hungarian method).
- Cosine Similarity, MCDM, Weighted Scoring, dan evaluasi rekomendasi berbasis *constraint*
  masing-masing hanya ditopang satu rujukan.

Tidak ada referensi baru yang ditambahkan, sesuai aturan bahwa setiap sumber baru wajib
melewati verifikasi primer.

### Berkas

- Dibuat: `docs/laporan/01_VERIFIKASI_REFERENSI.md`
- Diubah: `docs/STATUS.md` (bagian ini, append-only)
- Tidak diubah: `docs/laporan/01_REFERENSI.md`, source code, hasil evaluasi

### Putusan

**LULUS BERSYARAT.** Referensi cukup untuk menulis Bab 2 (10 artikel terverifikasi), tetapi
rentang halaman R5 wajib dikoreksi lebih dahulu dan topik pembagian beban kerja masih perlu
rujukan tambahan yang terverifikasi.

## Fase B.T-B.02 — Penambahan Referensi Ilmiah (FASE B lanjutan)

Menutup empat kesenjangan teori yang tercatat pada `01_VERIFIKASI_REFERENSI.md` §6:
Task Allocation, Workload Balancing, Multi-Criteria Decision Making, dan evaluasi
rekomendasi berbasis constraint serta fairness. Referensi lama tidak diubah, tidak diulang,
tidak diganti.

### Hasil

| Status | Jumlah |
|---|---|
| VERIFIED | **6** (T1–T6) |
| PARTIALLY VERIFIED | 0 |
| UNVERIFIED | 0 |
| Ditolak dengan alasan | 4 |

### Referensi yang diterima

| Kode | Referensi | Topik |
|---|---|---|
| T1 | Li, Shan, & Lin (2013), *Knowledge and Information Systems* 42(2), 441–463 | Task Allocation |
| T2 | Lunin (2024), *IFAC-PapersOnLine* 58(19), 712–717 | Workload Balancing |
| T3 | Behzadian dkk. (2012), *Expert Systems with Applications* 39(17), 13051–13069 | MCDM (TOPSIS survey) |
| T4 | Opricovic & Tzeng (2004), *EJOR* 156(2), 445–455 | MCDM (VIKOR vs TOPSIS) |
| T5 | Felfernig dkk. (2015), *Recommender Systems Handbook*, 161–190 | Constraint-Based Recommendation |
| T6 | Wu dkk. (2022), *ACM TOIS* 41(2), 1–29 | Evaluasi RS (fairness) |

Seluruh DOI di-resolve lewat `api.crossref.org` dan metadatanya dibaca balik: penulis, tahun,
volume, nomor, halaman, jenis publikasi.

### Perhitungan artikel setelah penambahan

- Artikel jurnal: 8 menjadi **13** (tambah T1, T2, T3, T4, T6)
- Artikel prosiding: 2 (tetap)
- **Total artikel ilmiah: 10 menjadi 15** (syarat minimum 10 kini terpenuhi dengan margin 5)
- Bab buku: 2 menjadi 3 (tambah T5) · Buku: 1 · Preprint: 1
- Total publikasi: 15 menjadi 21

### Temuan penting saat verifikasi

Tiga dari lima DOI yang saya duga dari ingatan **menunjuk ke makalah yang berbeda**:

- `10.1016/j.eswa.2011.08.128` ternyata milik Zhang & Chow (2012), bukan Behzadian dkk.
- `10.1145/3298689.3347043` ternyata milik Huang dkk. (2019) "FiBiNET".
- `10.1145/2959100.2959165` ternyata milik Kim dkk. (2016) tentang CMF.

Semuanya dibuang dan diganti hanya setelah DOI yang benar ditemukan lewat pencarian lalu
dibaca balik metadatanya. Satu DOI lain (`10.1145/3210109`) gagal resolve (HTTP 404).

Batasan yang dicatat: abstrak T1 ditandai *elided by publisher*, sehingga relevansinya
disandarkan pada TLDR Semantic Scholar dengan klaim yang dibatasi. Abstrak T3, T4, dan T5
tidak tersedia penuh; klaim dibatasi pada judul, wadah, dan ringkasan yang ada.

### Peringatan penggunaan

TOPSIS dan VIKOR **tidak diimplementasikan** di proyek ini. T3 dan T4 hanya boleh dipakai
sebagai pembanding teori pada pembahasan keterbatasan weighted scoring.

### Berkas

- Dibuat: `docs/laporan/02_REFERENSI_TAMBAHAN.md`
- Diubah: `docs/STATUS.md` (bagian ini, append-only)
- Tidak diubah: `01_REFERENSI.md`, `01_VERIFIKASI_REFERENSI.md`, source code, dataset, hasil evaluasi

### Putusan

**LULUS.** Landasan teori untuk Task Allocation dan Workload Balancing kini punya rujukan
langsung. Kesenjangan yang masih terbuka: Cosine Similarity hanya bersandar pada R4 (1975),
dan koreksi rentang halaman R5 belum dikerjakan karena di luar cakupan tugas ini.

## Fase B.T-B.02.1, T-B.03, Audit, dan Laporan Final (MASTER-T-B.02-FINAL)

Menyelesaikan pekerjaan dari posisi terakhir T-B.02 sampai laporan BAB I sampai III siap
diperiksa. Tidak ada source code, konfigurasi, basis data, atau hasil evaluasi yang diubah.
Tidak ada commit atau push. HEAD tetap `8ce6220`.

### 1. T-B.02.1 Koreksi Metadata T1 dan T2

| Item | Sebelum | Sesudah | Bukti |
|---|---|---|---|
| T1 tahun | 2013 | **2015** | Crossref `10.1007/s10115-013-0695-x`: `published-online` = 2013-10-06, **`published-print` = 2015-02**, volume 42 nomor 2 |
| T2 jenis | Artikel jurnal | **Artikel prosiding** | Wadah `IFAC-PapersOnLine` 58(19) adalah prosiding konferensi IFAC. Crossref menandai `journal-article`, perbedaan dicatat terbuka |
| T2 tahun | 2024 | 2024 (tidak berubah) | Crossref `issued` = 2024 |

Format APA 7 T1 dan T2 diperbaiki. T3 sampai T6 dan referensi lama R1 sampai R15 tidak diubah,
kecuali R5 yang menjadi cakupan T-B.03.

### 2. T-B.03 Koreksi R5

Rentang halaman `3111–3119` pada R5 **dihapus** dari `01_REFERENSI.md`.

Bukti: halaman resmi NeurIPS
`papers.nips.cc/paper_files/paper/2013/hash/9aa42b31882ec039965f3c4923ce901b-Abstract.html`
diverifikasi ulang. Metadata memuat `citation_title`, lima `citation_author` (Mikolov,
Sutskever, Chen, Corrado, Dean), `citation_journal_title`, `citation_volume=26`, dan
`citation_publication_date=2013`. **Tidak ada** `citation_firstpage` maupun `citation_lastpage`,
dan tidak ada satu pun kemunculan angka 3111 atau 3119 pada isi halaman. Entri kini berbunyi
"Dalam *Advances in Neural Information Processing Systems* (Vol. 26)." tanpa nomor halaman.
NeurIPS 2013 juga tidak memiliki DOI.

### 3. Perhitungan Publikasi Final

| Jenis | Sebelum (audit lama) | Tambahan T1–T6 | Total |
|---|---|---|---|
| Artikel jurnal | 8 | +4 (T1, T3, T4, T6) | **12** |
| Artikel prosiding | 2 | +1 (T2) | **3** |
| **Total artikel ilmiah** | **10** | **+5** | **15** |
| Bab buku | 2 | +1 (T5) | **3** |
| Buku | 1 | 0 | **1** |
| Preprint / laporan teknis | 1 | 0 | **1** |
| **Total entri publikasi** | 14 | +6 | **20** |

Hasil ini sesuai target pengguna: 12 artikel jurnal, 3 artikel prosiding, 3 bab buku, 1 buku,
1 preprint, 20 publikasi. Syarat minimum 10 artikel ilmiah terpenuhi dengan margin 5.

Koreksi hitungan dari versi T-B.02 sebelumnya: sebelumnya dilaporkan 13 artikel jurnal dan 21
entri. Angka itu keliru karena T2 dihitung sebagai artikel jurnal dan total lama (15) sudah
mencampur preprint. Setelah T2 diklasifikasikan sebagai prosiding, artikel jurnal menjadi 12,
dan total entri publikasi menjadi 20.

Catatan terbuka: daftar pustaka pada laporan final memuat **13** artikel jurnal bila Behzadian
dkk. (2012) dan Wu dkk. (2022) sama-sama dihitung. Selisih ini dicatat sebagai
[PERLU KONFIRMASI] pada `04_LAPORAN_FINAL.md` Lampiran A, dan tidak diturunkan dengan membuang
rujukan yang sah.

### 4. Audit Bukti Implementasi dan Evaluasi

Seluruh angka diverifikasi ulang terhadap artefak. **Semua angka yang diminta cocok.**

| Kelompok | Sumber | Hasil |
|---|---|---|
| Empat metode | `eval/results/methods_summary.json` | hybrid/random/round-robin/manual: cakupan 0,8083 / 0,7539 / 0,8083 / 0,8667; simpangan baku 5,616 / 5,296 / 3,876 / 5,616; fit 0,645 / 0,585 / 0,674 / 0,668; R1 0 / 31 / 2 / 2; R2 24 / 752 / 18 / 24; R3 1 / 147 / 4 / 0; perubahan manual 1 / 178 / 6 / 2 |
| Ablation | `eval/results/ablation.json` | 9 dari 35 tugas berganti pemilik (0,2571); coverageDelta 0; stdDevDelta -0,2018; fitDelta -0,0267; `liveAblation: BLOCKED` |
| Kinerja | `eval/results/performance.json` | pipeline 20 skenario median 0,285 ms, p95 0,465 ms; slider median 0,005 ms |
| Aturan keras | `eval/results/hard_rules.json` | 15 kasus, semua `pass: true` (R1:3, R2:3, R3:4, R4:2, R5:3) |
| Dataset | `eval/results/dataset_summary.json` | D1 26 tugas; D2 20 skenario, 49 anggota, 35 tugas; D3 tidak ada |

Temuan tambahan dari audit ini:

- **Perbedaan angka kinerja.** `eval/reports/L_PERFORMANCE.md` (19 Nov 10:19) mencatat pipeline
  median 0,332 ms dan p95 0,493 ms. `eval/results/performance.json` (19 Nov 13:19) mencatat
  0,285 ms dan 0,465 ms. Laporan memakai angka JSON karena lebih baru, dan perbedaannya dicatat.
- **Provider AI terpisah.** Groq untuk model teks (`analyze-task.ts`, `explain.ts`), Gemini untuk
  embedding 768 dimensi (`EMBEDDING_DIMENSION = 768`). `lib/ai/groq.ts` menyatakan Groq tidak
  menyediakan layanan embedding. Keduanya tidak dicampur dalam laporan.
- **RLS aktif tetapi tidak membatasi.** Sembilan tabel memiliki `enable row level security`, tetapi
  seluruh kebijakan berbunyi `USING (true) WITH CHECK (true)`. Keamanan bergantung pada lapisan
  peladen, bukan pada RLS. Dicatat sebagai keterbatasan pada §2.3.4.
- **Konflik R2 dan R5.** Kode menangani `r2_locked_overload`: tugas terkunci dipertahankan meskipun
  beban melampaui batas, sesuai pengutamaan R5.
- **Pengujian.** `npm test`: 29 berkas, **373 lulus / 4 gagal**. Empat kegagalan seluruhnya pada
  `test/ai/gemini-models.live.test.ts` dan `test/ai/groq.live.test.ts`, yaitu pengujian layanan
  live, bukan logika. Angka 373/4 sesuai baseline T-6.14.
- **PRD v0.2 PDF ditemukan** di `/home/nando/Downloads/PRD_Pembagi_Tugas_Kelompok_AI_v0.2.pdf`,
  memiliki 17 bagian. Bagian 14 memuat ketentuan format laporan yang dikutip laporan final.

### 5. Laporan BAB I sampai III

Dibuat: **`docs/laporan/04_LAPORAN_FINAL.md`** (sekitar 1.680 baris, 13.884 kata).

| Bagian | Isi |
|---|---|
| Halaman awal | Halaman judul (identitas bertanda), kata pengantar (bertanda), daftar isi, daftar tabel (18), daftar gambar (5) |
| BAB I | 1.1 Latar Belakang, 1.2 Rumusan Masalah (5 butir), 1.3 Tujuan (5 butir), 1.4 Manfaat dan Batasan |
| BAB II | 2.1 Dasar Teori (6 sub), 2.2 Konsep AI (5 sub), 2.3 Arsitektur (6 sub), 2.4 Dataset (4 sub), 2.5 Implementasi (7 sub), 2.6 Pengujian (10 sub) |
| BAB III | 3.1 Kesimpulan (7 butir), 3.2 Saran (3 kelompok) |
| Daftar pustaka | 21 entri APA 7 |
| Lampiran | A. Konsistensi sitasi, B. Daftar blocker, C. Ketentuan format PRD Bagian 14 |

Pemeriksaan yang dijalankan dan hasilnya:

| Pemeriksaan | Hasil |
|---|---|
| Tabel dideklarasikan vs caption di badan | 18 = 18, **tidak ada selisih** |
| Gambar dideklarasikan vs penanda di badan | 5 = 5, **tidak ada selisih** |
| Rujukan silang `§X.Y` | 79 rujukan, **0 menggantung** |
| Sitasi dalam teks tanpa entri pustaka | **0** |
| Entri pustaka tidak pernah dikutip | **0** (setelah Gemini Team (2024) ditambahkan sitasinya di §2.3.5) |
| Em dash (R-02) | **0** |
| Kata promosi (R-16) | **0** |
| Angka vs artefak | seluruhnya cocok |

### 6. Yang Tidak Dapat Diselesaikan (Blocker)

| Hal | Status | Alasan |
|---|---|---|
| Identitas kelompok, dosen, kampus, tahun | `[TIDAK DITEMUKAN]` | Tidak ada berkas yang memuat |
| Kesepakatan penilai manusia | **BLOCKED** | Belum ada 3 reviewer manusia |
| Ablation embedding live | **BLOCKED** | Tanpa kunci API embedding |
| Penerapan migrasi Supabase 001–007 | `[PERLU KONFIRMASI]` | Tidak ada bukti penerapan pada proyek nyata |
| Pengujian pada lingkungan produksi | `[TIDAK DITEMUKAN]` | Tidak ada bukti |
| Tangkapan layar dan diagram | `[GAMBAR PERLU DITAMBAHKAN]` | Tidak ada berkas gambar di repository |
| Ekspor `.docx`/PDF sesuai format PRD §14 | **Belum** | Tidak ada pandoc, python-docx, maupun paket npm `docx` |

### 7. Berkas yang Dibuat atau Diubah

| Berkas | Tindakan |
|---|---|
| `docs/laporan/04_LAPORAN_FINAL.md` | **Dibuat** |
| `docs/laporan/02_REFERENSI_TAMBAHAN.md` | Diubah: koreksi T1 (2015), T2 (prosiding), jumlah publikasi, catatan tahun dan jenis |
| `docs/laporan/01_REFERENSI.md` | Diubah: R5 tanpa rentang halaman (T-B.03) |
| `docs/laporan/01_VERIFIKASI_REFERENSI.md` | Diubah: status koreksi R5 ditandai sudah diterapkan |
| `docs/STATUS.md` | Diubah: bagian ini (append-only) |

Tidak diubah: source code, konfigurasi, `supabase/migrations/`, `eval/results/*`, `eval/reports/*`,
`prd.md`, dokumen audit lama (`02_LAPORAN_AKADEMIK.md`, `03_HASIL_DAN_PEMBAHASAN.md`).

### Putusan

**SELESAI BERSYARAT.** Koreksi T-B.02.1 dan T-B.03 selesai. Audit referensi dan audit bukti
selesai dengan seluruh angka cocok. Laporan BAB I sampai III tersedia sebagai satu dokumen
dengan sitasi dan daftar pustaka yang konsisten. Syarat yang belum terpenuhi: identitas
kelompok, gambar aktual, penilaian manusia, verifikasi penerapan Supabase, dan ekspor dokumen
sesuai format PRD Bagian 14.

---

## T-3.XX: Perbaikan Matriks Rekomendasi dan Validasi Penugasan

Tanggal kerja: sesi ini. PRD acuan: v0.3 (Bagian 8, 9, 11, 12). Rentang PRD di judul tiket
menyebut "8.1–8.6"; dokumen `docs/PRD_v0.3.md` di repository hanya memakai penomoran bagian
sampai tingkat FR dan tidak memuat subbagian 8.1–8.6 dengan label itu. Acuan yang benar-benar
ada dan dipakai: FR-07 (formula skor), Hard Constraints R1–R5, dan Bagian 8.4 pada kalimat PRD
(baris 720). Ketidaksesuaian penomoran ini dicatat, bukan ditebak.

### 1. Kontradiksi PRD yang Dikonfirmasi Pemilik Produk

PRD v0.2 membatasi kelompok 2 sampai 4 anggota. PRD v0.3 FR-02 (baris 646, 1528) menyatakan
minimal 2 dan **tanpa batas maksimal**. Implementasi saat ini hanya memvalidasi minimal 2
(`app/p/[code]/members/members-client.tsx:105`), konsisten dengan v0.3. Pemilik produk memilih
**PRD v0.3 sebagai acuan**. Karena itu 5 anggota adalah input SAH: tidak ada perubahan validasi
jumlah anggota, dan skenario 5 anggota diuji sebagai input valid, bukan sebagai input ditolak.

### 2. Penyebab Masalah Awal (hasil audit, bukan dugaan)

Skenario screenshot direproduksi persis dengan mesin sungguhan: 1 tugas 8 jam, 5 anggota,
beban ideal 1,6 jam, batas R2 2 jam.

| Gejala | Penyebab aktual | Lokasi |
|---|---|---|
| Semua anggota tampak "gugur" tanpa alasan jelas | Sel matriks hanya menulis satu kata "gugur" tanpa nama aturan penyebab | `result-client.tsx` (label sel) |
| Tidak ada rekomendasi, tetapi tidak dijelaskan sebabnya | Mesin sudah benar membiarkan tugas tanpa pemilik (8 jam > batas 2 jam, pengecualian R4). UI hanya menampilkan badge pendek, tanpa menjelaskan bahwa estimasi tugas melebihi batas sehingga **tidak ada** anggota yang mungkin memenuhi R2 | `result-client.tsx` (badge peringatan) |
| Batas R2 terlalu ketat bagi anggota yang masih punya ruang | Beban ideal dibagi jumlah **seluruh** anggota, termasuk anggota yang jam tersedianya 0 dan sudah dikeluarkan R1. Pembagi yang terlalu besar memperkecil beban ideal dan memperketat batas R2 bagi semua orang | `lib/scoring/assign.ts:36`, `lib/scoring/interaction.ts:170` |
| Tugas terkunci masih bisa dipindah lewat interaksi | `assignOwner` tidak memeriksa `isLocked`; R5 hanya dijaga di `globalAssign`, tidak di jalur edit langsung | `lib/scoring/interaction.ts` (`assignOwner`) |
| Angka 5 anggota dianggap masalah | 5 anggota sah menurut PRD v0.3, jadi bukan cacat | tidak ada perubahan |

Screenshot lama menampilkan "GUGUR" karena pemotongan beban ideal salah pembagi: dengan
pembagi seluruh anggota, tugas kedua yang sebenarnya masih muat ikut ditolak R2.

### 3. Ringkasan Perbaikan

1. **Beban ideal sadar R1** (`assign.ts`, `interaction.ts`): pembagi hanya anggota yang lolos
   R1. Rumus, bobot 0,40/0,30/0,20/0,10, dan angka 1,25 **tidak diubah**.
2. **Diagnosis R2 eksplisit** (`types.ts`, `assign.ts`): peringatan `r2_no_candidate` membawa
   `detail` berisi `taskHours`, `idealLoad`, `capHours`, dan `exceedsCapAlone`, sehingga UI bisa
   membedakan "tugas mustahil bagi siapa pun" dan "kandidat lain sedang penuh" tanpa menghitung
   ulang aturan.
3. **R5 ditegakkan di jalur interaktif** (`interaction.ts`): `assignOwner` menolak mengganti
   pemilik tugas terkunci dan menyuruh membuka kunci dulu.
4. **Status keputusan pada UI** (`result-client.tsx`): banner `assignment-status` menyatakan
   kondisi A sampai F dari keluaran mesin (semua R1 keluar, R2 mustahil, R2 terblokir, R3
   fallback, R5 overload, atau semua terpenuhi). Sel matriks kini menulis aturan penyebab
   ("gugur R2"), bukan satu kata tanpa alasan, dan `aria-label` memuat alasan lengkap.
5. **Satu definisi R1**: UI memakai `checkR1`, bukan `capacity <= 0` sendiri.
6. **Kode mati dibuang**: `r1Pool` ganda tak terpakai di `assign.ts` dihapus (dilaporkan lint).

### 4. Berkas yang Diubah

| Berkas | Tindakan |
|---|---|
| `lib/scoring/assign.ts` | Diubah: pembagi beban ideal sadar R1, `detail` peringatan R2, hapus `r1Pool` mati |
| `lib/scoring/interaction.ts` | Diubah: pembagi beban ideal sadar R1, R5 di `assignOwner` |
| `lib/scoring/types.ts` | Diubah: field opsional `detail` pada `AssignmentWarning` |
| `app/p/[code]/result/result-client.tsx` | Diubah: banner status keputusan, label sel menyebut aturan, `aria-label` beralasan, pakai `checkR1` |
| `test/scoring/matrix_recommendation.test.ts` | **Dibuat**: 31 tes regresi |
| `docs/STATUS.md` | Diubah: bagian ini (append-only) |

Tidak diubah: `prd.md`, `docs/PRD_v0.3.md`, `DESIGN.md`, `supabase/migrations/`, `eval/results/*`,
file AI (`lib/ai/*`), dependensi, dan seluruh berkas laporan. Tidak ada commit atau push.

### 5. Alur Perhitungan Baru

1. Anggota yang jam tersedianya 0 dikeluarkan lebih dulu (R1).
2. Beban ideal = total jam seluruh tugas / jumlah anggota yang lolos R1.
3. Batas R2 = 1,25 x beban ideal (angka tetap).
4. Tugas diurutkan dari jam terbesar.
5. Tugas terkunci: pemilik dan jamnya dikunci, tidak dihitung ulang (R5).
6. Kandidat = lolos R1 dan beban setelah menerima tugas <= batas R2 (R2).
7. Pool R3 = anggota dengan minimal satu skill wajib level >= 3. Jika kosong, seluruh anggota
   masuk sebagai saran terbaik dan diberi peringatan.
8. Skor = 0,40K + 0,30S + 0,20C + 0,10M, dipakai untuk mengurutkan kandidat yang lolos.
9. Jika tidak ada kandidat R2: tugas dibiarkan tanpa pemilik (pengecualian R4) dan peringatan
   menyebut angka penyebab.

### 6. Bukti Sebelum dan Sesudah (data identik)

Data: 1 tugas 8 jam, 5 anggota kapasitas 8 jam, ideal 1,6 jam, batas R2 2 jam.

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Pemilik tugas | kosong (benar) | kosong (benar, tidak dipaksakan) |
| Penjelasan | "R2: semua gugur" | "estimasi 8 jam melebihi batas R2 2.00 jam (1,25 x beban ideal 1.60 jam), sehingga tidak ada anggota yang dapat menerimanya" |
| Label sel | `gugur` | `gugur R2` |
| Fakta mesin | tidak tersedia | `{taskHours:8, idealLoad:1.6, capHours:2, exceedsCapAlone:true}` |
| Beban ideal kasus R1 | salah: 8/2 = 4 (batas 5) | benar: 8/1 = 8 (batas 10), tugas kedua kini terpenuhi |
| Tukar pemilik tugas terkunci | diizinkan (melanggar R5) | ditolak dengan alasan |

### 7. Hasil Tes (output aktual)

`npm test` (vitest) untuk unit deterministik:

```
npx vitest run test/scoring test/api test/ui test/validation
 Test Files  18 passed (18)
      Tests  254 passed (254)
```

- `test/scoring/matrix_recommendation.test.ts` baru: **31 lulus**, mencakup komponen skor
  K/S/C/M, R1 (0 jam dikeluarkan, tidak memperkecil beban ideal), R2 (menolak beban melebihi
  batas, kasus screenshot tidak layak, tanda `exceedsCapAlone`), R3 (fallback dengan peringatan
  dan penandaan tidak eligible), R4 (satu pemilik, pengecualian R4), R5 (pemilik terkunci tetap,
  peringatan overload, jam tidak dihitung dua kali, tukar ditolak), serta skenario 2 anggota,
  4 anggota, anggota tidak tersedia, semua anggota tidak tersedia, dan "tidak ada anggota gugur
  tanpa alasan".
- Suite lama tetap lulus tanpa perubahan ekspektasi: `interaction.test.ts` 35 lulus,
  `rules_r2_r3.test.ts`, `fallback.test.ts`, `numerical_8_4.test.ts` semuanya hijau.
- `npm test` penuh: 3 kegagalan pada `test/ai/gemini-models.live.test.ts` dan
  `test/ai/groq.live.test.ts`. Ketiga tes itu memanggil API live dan gagal karena kredensial
  jaringan, bukan karena perubahan ini. Tes tersebut di luar cakupan dan tidak diubah.

Typecheck, lint, build:

| Perintah | Hasil |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `npx eslint lib/scoring app/p/[code]/result/result-client.tsx test/scoring/matrix_recommendation.test.ts` | 0 error (2 warning lama pada impor tak terpakai di `interaction.ts`, sudah ada sebelumnya) |
| `npx next build` | berhasil, 12 rute dirender |

### 8. Bukti R1 sampai R5 Tetap Bekerja

- R1: `checkR1` tetap `capacity > 0`; tes "jam tersedia 0 tidak pernah menjadi pemilik" lulus.
- R2: `checkR2` tidak diubah; tes "menolak beban melebihi batas" lulus; angka 1,25 tetap.
- R3: `.some()` untuk "minimal satu skill" tidak diubah; tes fallback lulus.
- R4: satu pemilik per tugas; pengecualian R4 hanya saat R2 tidak terpenuhi; tes lulus.
- R5: kini dijaga di dua jalur (`globalAssign` dan `assignOwner`); tes lulus.

### 9. Keterbatasan yang Belum Terselesaikan

- **Grafik batang per komponen K/S/C/M** yang diminta pada butir 3E belum dibuat. Matriks saat
  ini menampilkan skor total per sel dan rincian komponen di panel bawah; tidak ada grafik batang
  bertumpuk dengan warna per komponen. Ini pekerjaan UI tersendiri, belum dikerjakan.
- **Uji render komponen** tidak ditambahkan karena repository belum punya infrastruktur render
  React di vitest (hanya tes logika dan API). Banner status diverifikasi lewat typecheck, build,
  dan pembacaan kode, bukan lewat tes DOM. Ini TIDAK DITEMUKAN infrastrukturnya.
- **Verifikasi visual di browser** tidak dilakukan; tidak ada sesi browser pada lingkungan ini.
  Sesuai R-35 antislop, klaim "sudah diklik" tidak dibuat.
- Uji coba dengan data Supabase nyata tidak dijalankan karena kredensial dan migrasi belum
  diverifikasi (status lama masih berlaku).

### Putusan

**SELESAI SEBAGIAN.** Tiga cacat nyata diperbaiki dan dibuktikan dengan tes: pembagi beban ideal
sadar R1, diagnosis R2 yang tidak lagi menyembunyikan sebab, dan penegakan R5 pada jalur
interaktif. Status sel matriks kini selalu menyebut aturan penyebab. Yang belum selesai: grafik
batang komponen K/S/C/M dan verifikasi visual di browser.

---

## T-3.XX lanjutan: Komponen Grafik Matriks Rekomendasi

Tanggal kerja: sesi ini. Melanjutkan bagian T-3.XX di atas, yang mencatat grafik batang K/S/C/M
sebagai keterbatasan yang belum selesai. Bagian ini menutup keterbatasan tersebut.

### 1. Berkas Baru

| Berkas | Tindakan |
|---|---|
| `components/recommendations/candidate-score-chart.tsx` | **Dibuat**: grafik batang bertumpuk per kandidat |
| `test/ui/candidate-score-chart.test.ts` | **Dibuat**: 11 tes render |

Berkas implementasi yang diubah pada bagian ini: `app/p/[code]/result/result-client.tsx`
(impor, `chartComponents`, pemasangan grafik di panel rincian). Tidak ada berkas lain yang
tersentuh. Tidak ada dependensi baru: grafik memakai `framer-motion`, `react`, dan token CSS
yang sudah ada.

### 2. Alasan Bentuk Grafik

Pertanyaan yang harus dijawab matriks adalah "siapa paling cocok untuk tugas ini, dan mengapa".
Satu batang bertumpuk per anggota menjawab keduanya sekaligus: panjang batang adalah skor akhir,
potongannya adalah kontribusi K, S, C, M. Empat grafik terpisah (satu per komponen) hanya
menjawab "berapa K semua orang" dan memaksa pembaca menjumlahkan sendiri.

Batang dibuat horizontal agar nama anggota terbaca tanpa diputar, dan urutan potongan tetap
(K, S, C, M) agar dua batang selalu dapat dibandingkan.

### 3. Sumber Setiap Angka

Komponen grafik menerima `ScoreBreakdown` dari mesin (`globalAssign` → `computeScore`) secara
langsung. Grafik tidak menghitung ulang K/S/C/M, tidak membulatkan berbeda, dan tidak mengarang
nilai. Satu-satunya perhitungan di dalam grafik adalah penskalaan panjang batang terhadap skor
tertinggi agar peringkat terlihat saat semua skor rendah; angka yang dicetak tetap nilai asli.

Legenda mencetak bobot yang **benar-benar diterapkan**, bersumber dari state `weights` yang
sama dengan yang masuk ke `globalAssign`. Pada mode cadangan, K dicetak `bobot 0%` disertai
kalimat penjelasan, bukan 40%.

### 4. Status Tidak Hanya Warna

- Setiap baris menulis label teks: `utama`, `alt`, atau `tidak`.
- Anggota yang gugur diberi penanda `✕` beserta huruf aturan penyebabnya (`gugur R2`, `gugur R3`),
  diturunkan dari peringatan mesin, bukan ditebak.
- Setiap batang punya `aria-label` berisi seluruh rincian dan skor total, sehingga pembaca layar
  menerima keputusan yang sama.
- Warna potongan memakai token `--k`, `--s`, `--c`, `--m` yang sudah diverifikasi kontras WCAG AA
  pada tema terang dan gelap. Tidak ada warna baru yang diperkenalkan.

### 5. Hasil Tes (output aktual)

```
npx vitest run test/scoring test/api test/ui test/validation
 Test Files  19 passed (19)
      Tests  265 passed (265)
```

Rincian: 254 tes deterministik sebelumnya tetap lulus, ditambah 11 tes grafik baru
(`test/ui/candidate-score-chart.test.ts`). Tes grafik memakai `react-dom/server`
(`renderToStaticMarkup`) karena lingkungan vitest adalah `node`, lalu memeriksa keluaran HTML
sungguhan: nilai tiap komponen, penanda `utama`/`alt`/`✕ gugur R2`, `aria-label` lengkap, bobot
legenda 40/30/20/10, kondisi mode cadangan (K 0%), penskalaan batang, dan penanganan daftar
anggota kosong.

Pemeriksaan typecheck, lint, dan build:

| Perintah | Hasil |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `npx eslint components/recommendations/candidate-score-chart.tsx test/ui/candidate-score-chart.test.ts app/p/[code]/result/result-client.tsx` | 0 error, 0 warning |
| `npx next build` | berhasil, 12 rute dirender |

### 6. Bukti Grafik Memakai Keluaran Mesin

Data yang sama dengan skenario screenshot (1 tugas 8 jam, 5 anggota, beban ideal 1,6 jam, batas
R2 2 jam) dijalankan melalui `globalAssign` lalu dirender ke markup. Teks yang dihasilkan:

```
A ✕ gugur R2  K 67 S 80 C 0 M 50  56 %
B ✕ gugur R2  K 63 S 20 C 0 M 50  36 %
C ✕ gugur R2  K 60 S 20 C 0 M 50  35 %
D ✕ gugur R2  K 57 S 20 C 0 M 50  34 %
E ✕ gugur R2  K 53 S 20 C 0 M 50  32 %
K Kemiripan konten · bobot 40%   S Kecocokan skill · bobot 30%
C Sisa kapasitas · bobot 20%     M Minat · bobot 10%
Batas R2 2.00 jam (1,25 × beban ideal 1.60 jam).
```

Angka total (56, 36, 35, 34, 32) identik dengan keluaran mesin. Tidak ada anggota yang diberi
tanda `utama`, konsisten dengan keputusan mesin bahwa tugas 8 jam tidak dapat dipenuhi siapa pun.

### 7. Keterbatasan yang Masih Berlaku

- **Verifikasi visual di browser belum dilakukan.** Tidak ada sesi browser pada lingkungan ini,
  sehingga tata letak akhir grafik di layar tidak diklaim sudah diperiksa. Yang diverifikasi
  adalah keluaran markup statis, typecheck, lint, dan build.
- **Tes interaksi DOM** (klik, fokus, hover) belum ada karena repository belum memakai
  lingkungan DOM di vitest. Ini TIDAK DITEMUKAN infrastrukturnya, bukan sengaja dilewati.
- Data Supabase nyata dan ekspor PDF tetap belum diverifikasi, status lama masih berlaku.

### Putusan

**SELESAI.** Grafik batang per komponen K/S/C/M tersedia dan terpasang pada panel rincian
matriks, dengan angka yang berasal langsung dari mesin, legenda berbobot nyata, dan status yang
tidak bergantung pada warna. Matriks tetap menjadi pusat informasi; grafik melengkapi, bukan
menggantikan. Seluruh 265 tes deterministik lulus, typecheck dan lint bersih, build berhasil.

---

## T-FIX-MATRIX-01: Perbaikan Final Matriks Rekomendasi

Tanggal kerja: sesi ini. Melanjutkan T-3.XX. Cakupan: hanya penjelasan kondisi tidak layak dan
status per anggota. Rumus, bobot K/S/C/M, dan aturan R1–R5 tidak diubah.

### 1. Penyebab Akar Masalah

Skenario screenshot direproduksi dengan mesin sungguhan: 2 anggota, 1 tugas 2 jam. Hasil mesin:

- Beban ideal 1,00 jam, batas R2 1,25 jam.
- Tidak ada pemilik, kedua anggota gugur R2.

Angka mesin itu **sudah benar**. Tugas 2 jam memang tidak muat pada batas 1,25 jam, dan PRD
melarang memaksakan penugasan yang melanggar R2. Yang salah adalah penjelasan yang diberikan
kepada pengguna:

| Cacat | Bukti | Lokasi |
|---|---|---|
| Kalimat saran salah secara matematis: "tambah anggota agar beban ideal naik" | Beban ideal = total jam / jumlah anggota. Menambah anggota MENURUNKAN beban ideal dan batas R2. Untuk tugas 2 jam: 2 anggota cap 1,25 jam, 4 anggota cap 0,63 jam, 10 anggota cap 0,25 jam. Saran ini menuntun pengguna ke jalan yang mustahil berhasil | `result-client.tsx` (banner r2-impossible) |
| Badge baris tugas menulis "R2: semua gugur" | Tidak memuat angka apa pun, sehingga pengguna tidak tahu ukuran usaha versus batas | `result-client.tsx` (badge peringatan) |
| Status sel tidak membedakan R1, R2, dan R3 | Setiap anggota bukan pemilik ditulis "kandidat" atau "gugur" saja | `result-client.tsx`, `candidate-score-chart.tsx` |

Kesimpulan: masalahnya bukan perhitungan, melainkan penjelasan dan pelabelan status. Tidak ada
pelonggaran R2 yang dilakukan, karena pelonggaran akan menyembunyikan pelanggaran aturan.

### 2. Perbaikan

1. **Saran pengganti dihitung, bukan ditulis tangan.** Fungsi baru
   `smallestSplitThatFits(taskHours, capHours)` di `lib/scoring/interaction.ts` mengembalikan
   jumlah bagian minimum agar tiap bagian muat di bawah batas R2, atau `null` bila mustahil.
   Untuk kasus ini hasilnya 2 bagian, sehingga UI menulis "Pecah tugas menjadi minimal 2 bagian,
   misalnya 2 × 1,0 jam".
2. **Kalimat menambah anggota dibalik menjadi peringatan.** UI kini menyatakan bahwa menambah
   anggota tidak menyelesaikan masalah ini karena batas R2 justru mengecil.
3. **Badge baris memuat angka:** `R2: usaha 2 jam > batas 1.25 jam`, disertai baris
   `Beban ideal 1.00 jam · batas R2 1.25 jam`.
4. **Satu definisi status per anggota.** `candidateStatus()` dan `candidateStatusLabel()` di
   `candidate-score-chart.tsx` menghasilkan lima status yang diminta: kandidat valid, alternatif
   valid, gugur R1, gugur R2, gugur R3 (ditambah `utama`). Matriks, grafik, dan panel memakai
   fungsi yang sama sehingga tidak dapat berbeda.
5. **`aria-label` grafik menyebut status lengkap** ("penanggung jawab utama", "tidak memenuhi
   aturan, gugur R2"), bukan hanya angka. Tanpa ini label pendek "utama" tidak bermakna bagi
   pembaca layar.

### 3. Berkas yang Diubah

| Berkas | Tindakan |
|---|---|
| `lib/scoring/interaction.ts` | Diubah: fungsi `smallestSplitThatFits` |
| `app/p/[code]/result/result-client.tsx` | Diubah: saran pecah tugas, badge berangka, baris ringkasan, status sel |
| `components/recommendations/candidate-score-chart.tsx` | Diubah: `candidateStatus`, `candidateStatusLabel`, `aria-label` status |
| `test/scoring/matrix_infeasible.test.ts` | **Dibuat**: 15 tes regresi |
| `docs/STATUS.md` | Diubah: bagian ini (append-only) |

3 berkas implementasi (batas 5). Tidak ada berkas lain yang disentuh. Tidak ada dependensi baru.
Tidak ada commit atau push.

### 4. Hasil Tes (output aktual)

```
npx vitest run test/scoring test/api test/ui test/validation
 Test Files  20 passed (20)
      Tests  280 passed (280)
```

Sebelumnya 265 tes; bertambah 15 tes baru di `test/scoring/matrix_infeasible.test.ts`. Cakupan
tes baru sesuai permintaan:

- 2 anggota, 1 tugas 2 jam: ideal 1,00 jam, cap 1,25 jam, tanpa pemilik, alasan memuat angka
  (diuji sebagai `detail` dan sebagai teks pesan).
- 2 anggota, 2 subtugas 1 jam: kedua subtugas mendapat pemilik, beban tiap anggota 1 jam
  (di bawah cap 1,25), tanpa peringatan R2.
- Kapasitas mengecil saat anggota ditambah: cap 1,25 → 0,63 → 0,25 untuk 2, 4, 10 anggota.
- `smallestSplitThatFits`: 2 jam/1,25 = 2; 5 jam/1 = 5; tugas yang sudah muat = 1; masukan tidak
  valid = `null`.
- R3 fallback tetap memberi saran terbaik berperingatan, dan anggota itu tidak disebut kandidat
  valid.
- R1 mengeluarkan anggota 0 jam; R5 menolak perubahan pemilik tugas terkunci dan menjaga pemilik
  saat hitung ulang; R4 satu penanggung jawab per tugas.
- Perubahan slider tidak memanggil AI: `globalThis.fetch` diganti agar gagal bila dipanggil,
  jumlah panggilan diperiksa 0, dan skor terbukti berubah saat bobot berubah (bukan no-op).

Satu tes lama sempat gagal (`marks the primary owner in text, not only in colour`) karena label
sel pendek berubah dari "penanggung jawab" menjadi "utama". Yang diperbaiki adalah komponennya
(`aria-label` kini menyebut peran lengkap), bukan tesnya, sehingga tidak ada asersi yang
dilunakkan.

### 5. Bukti Saran Dapat Dijalankan

Saran UI diuji dengan menjalankannya: tugas 2 jam dipecah menjadi 2 bagian 1 jam pada data yang
sama menghasilkan kedua subtugas mendapat pemilik, beban 1 jam per anggota, dan tidak ada
peringatan R2. Jadi angka yang disarankan bukan karangan; saran itu memang menyelesaikan kasus.

Typecheck, lint, build:

| Perintah | Hasil |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `npx eslint` (berkas terkait) | 0 error, 2 warning lama pada impor tak terpakai di `interaction.ts` (sudah ada sebelum sesi ini, tidak diubah) |
| `npx next build` | berhasil, 12 rute |

### 6. Keterbatasan yang Belum Terselesaikan

- **Pembagian subtugas masih manual oleh pengguna.** Ticket meminta "jika pembagian subtugas
  dilakukan pengguna, hitung ulang". Itu sudah berlaku: setelah subtugas ditambahkan lewat
  halaman tugas, seluruh alur (beban ideal, skor, rekomendasi, grafik, ekspor) dihitung ulang dari
  data terbaru karena semuanya memakai `globalAssign`. Yang belum ada adalah tombol yang memecah
  tugas secara otomatis. Itu fitur baru, di luar batas "jangan menambahkan fitur di luar
  perbaikan ini", jadi tidak dibuat.
- **Verifikasi visual di browser belum dilakukan.** Tidak ada sesi browser di lingkungan ini. Yang
  diverifikasi: keluaran teks dari mesin, markup statis grafik, typecheck, lint, build.
- **Batas R2 tetap dapat membuat tugas besar tidak teralokasikan.** Ini perilaku benar sesuai PRD,
  bukan cacat. Bila seluruh tugas lebih besar daripada 1,25 x beban ideal, sistem akan selalu
  melaporkan tidak layak beserta angkanya.

### Putusan

**SELESAI.** Penyebab semua anggota gugur kini dijelaskan dengan angka dan bahasa pengguna, saran
yang salah secara matematis ("tambah anggota") diganti dengan saran pembagian tugas yang
diverifikasi dapat dijalankan, dan setiap anggota memiliki status yang jelas dan tidak
bergantung pada warna. Tidak ada rekomendasi palsu, R1–R5 tetap berlaku, 280 tes lulus.
