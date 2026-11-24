# STRUCTURE_AUDIT.md - Audit Struktur & Dependensi (T-5.07)

Audit read-only. Dokumen ini **tidak** mengubah satu pun berkas implementasi, tidak memindahkan,
tidak menghapus, dan tidak mengganti nama berkas atau direktori. Seluruh temuan berasal dari
pemeriksaan repository aktual pada sesi ini, dengan perintah yang dicantumkan agar dapat diulang.

- Tanggal audit: sesi T-5.07
- Branch: `redesign/fuelplate-ui`
- HEAD: `9b62e3d` - `chore: initialize project repository`
- Remote: `origin https://github.com/ndodawar/teammate-ai.git` (hanya `refs/heads/main` = `9b62e3d`)
- Baseline gerbang yang **diukur ulang pada sesi ini**: `npx tsc --noEmit` exit 0 (0 error);
  `npx eslint` 0 error + 2 warning lama (`test/api/member-profile.test.ts:36` `_fn`, `_args`);
  `npm test -- --testTimeout=30000` **23 berkas lulus, 299 tes lulus, 0 gagal, 0 skipped**;
  `npm run build` exit 0 dengan **15 entri rute** di tabel Route: 4 halaman statis/partial
  (`/`, `/_not-found`, `/how-it-works`, dan `_not-found` bawaan), 8 `ƒ /api/*` dinamis, dan
  4 rute `/p/[code]/*` (partial prerender)

---

## 1. Executive summary

1. **Repository ini praktis tidak punya riwayat versi.** Dari 369 berkas di luar
   `node_modules`/`.git`/`.next`, hanya **33 yang tracked** di HEAD. **338 berkas untracked** dan
   **16 berkas tracked termodifikasi**. Artinya: `app/api/`, `app/p/`, `app/how-it-works/`,
   `components/`, `docs/`, `eval/`, sebagian besar `lib/`, `test/ai|api|integration|validation`,
   dan `supabase/migrations/002–007` **tidak dapat dipulihkan dengan `git`.**
   Konsekuensi langsung: **setiap pemindahan atau penghapusan pada audit ini berisiko
   tidak dapat di-rollback.** Rekomendasi urutan kerja karena itu dimulai dari snapshot, bukan
   dari pemindahan berkas.

2. **Duplikasi skill terverifikasi tiga lapis, bukan satu.** `agent/skills/` dan `.agents/skills/`
   berisi 15 berkas identik byte-per-byte kecuali **2 baris frontmatter** per `SKILL.md`
   (`name:` dan `allowed-tools:`). `.claude/skills/` bukan duplikasi isi: keenam entrinya adalah
   **symlink** ke `.agents/skills/*` yang resolve dengan benar. `.opencode/skills/` adalah set yang
   **berbeda** (7 skill, 4,8 MB, 175 berkas) dan memuat 6 pasang berkas duplikat di dalam dirinya.

3. **Satu modul aplikasi terbukti tidak direferensikan:** `lib/db/supabase.ts`. Tidak ada import,
   tidak ada test, dan modul ini membuat Supabase client **saat modul dievaluasi** dari
   `process.env` (`lib/db/supabase.ts:3-6`), sementara satu-satunya jalur yang dipakai aplikasi
   adalah `getSupabaseClient()` di `lib/db/project.ts` yang membaca env **saat dipanggil**.
   Ini klasifikasi A dengan catatan: verifikasi akhir tetap harus lewat build + test.

4. **Empat berkas besar** menampung 5.040 baris (`result-client.tsx` 1.634, `globals.css` 1.219,
   `app/page.tsx` 1.155, `tasks-client.tsx` 1.032). Pemisahan yang paling aman dan paling
   terukur bukan memecah `result-client.tsx` lebih dulu, melainkan memindahkan blok yang
   **sudah mandiri secara deklaratif** di `app/page.tsx` (`ScrollProgress`, `SectionRail`,
   `AlurProduk`, `KomposisiSkor`, `SiteFooter`) dan mengelompokkan CSS presentasional
   `globals.css` tanpa memecah satu selektor pun.

5. **Direktori kosong:** 3 di `components/` (`layout`, `members`, `tasks`) dan 1 di `lib/`
   (`utils`). Keempatnya sisa rencana struktur yang tidak pernah diisi. Dihapus berdampak nol
   pada resolusi import, tetapi tetap berkas/direktori sehingga masuk klasifikasi B/A dengan
   verifikasi.

6. **Dokumentasi:** 15 berkas `docs/` (5.063 baris), 17 `eval/reports/` (1.906 baris),
   6 `docs/laporan/` (2.401 baris). Tidak ada dokumentasi historis yang direkomendasikan hapus.
   Yang ditemukan adalah **referensi basi** (bukan berkas berlebih): `docs/VISUAL-CATALIS.md:30`
   dan `REDESIGN_NOTES.md:144` masih menyebut `components/ui/workspace-nav.tsx` yang sudah
   dihapus per `docs/STATUS.md:1201`; `app/globals.css:8` dan `lib/motion/tokens.ts:4` merujuk
   `DESIGN (1).md` yang **tidak ada** di repo (menurut `docs/VISUAL-CATALIS.md:25` berkas itu ada
   di `/home/nando/Downloads/`).

7. **Risiko terbesar bukan pemindahan, melainkan CI yang belum pernah menjalankan kode ini.**
   `.github/workflows/ci.yml:5-7` hanya terpicu pada `push`/`pull_request` ke `main` atau `master`.
   Pekerjaan berjalan di `redesign/fuelplate-ui`, yang tidak ada di remote. Jadi seluruh klaim
   "CI hijau" tidak berlaku untuk tree ini, dan seluruh gerbang di laporan ini dijalankan lokal.

---

## 2. Kondisi repository aktual

### 2.1 Angka dasar

| Ukuran | Nilai | Perintah |
|---|---|---|
| Berkas (tanpa `node_modules`, `.git`, `.next`) | 369 | `find . -path ./node_modules -prune -o -path ./.git -prune -o -path ./.next -prune -o -type f -print \| wc -l` |
| Direktori (idem) | 117 | varian `-type d` |
| Berkas tracked di HEAD | 33 | `git ls-files \| wc -l` |
| Berkas untracked | 338 | `git ls-files --others --exclude-standard \| wc -l` |
| Berkas tracked termodifikasi | 16 | `git status --porcelain \| grep -c '^ M'` |
| Direktori kosong | 4 | `find . -path ./node_modules -prune -o -type d -empty -print` |

### 2.2 16 berkas tracked yang termodifikasi

`AGENTS.md`, `DESIGN.md`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`,
`eslint.config.mjs`, `lib/ai/analyze-task.ts`, `lib/scoring/assign.ts`, `lib/scoring/score.ts`,
`lib/scoring/types.ts`, `lib/validation/index.ts`, `package-lock.json`, `package.json`,
`prd.md`, `test/scoring.test.ts`, `vitest.config.ts`.

Enam di antaranya adalah **logika domain** (`lib/scoring/{assign,score,types}.ts`,
`lib/ai/analyze-task.ts`, `lib/validation/index.ts`, `test/scoring.test.ts`). Audit ini tidak
menyentuhnya dan rencana refactoring juga tidak boleh dimulai dari sana, karena `git checkout`
pada berkas-berkas itu akan menghapus pekerjaan yang tidak tersimpan di tempat lain.

### 2.3 338 berkas untracked per direktori teratas

| Direktori | Berkas untracked | Catatan |
|---|---|---|
| `.opencode/` | 175 | aset skill vendor (4,8 MB, termasuk 3 `.pyc`) |
| `eval/` | 44 | harness + results + reports |
| `test/` | 22 | 22 dari 23 berkas test |
| `app/` | 17 | `app/api/` (8 route), `app/p/` (8), `app/how-it-works/` (1) |
| `docs/` | 15 | seluruh dokumentasi |
| `agent/` | 15 | skill tree duplikat |
| `.agents/` | 15 | skill tree sumber (`.claude` menunjuk ke sini) |
| `lib/` | 14 | `lib/ai/*` (6), `lib/client`, `lib/constants`, `lib/db/project.ts`, `lib/motion/*` (2), `lib/scoring/*` (3) |
| `components/` | 7 | seluruh komponen |
| `supabase/` | 6 | migration `002`–`007` |
| `.claude/` | 6 | symlink |
| akar | 2 | `skills-lock.json`, `REDESIGN_NOTES.md` |

### 2.4 Distribution LOC

| Area | Berkas | Baris |
|---|---|---|
| `app/` | 21 | 7.222 |
| `components/` | 7 | 1.664 |
| `lib/` | 23 | 2.305 |
| `test/` | 24 | 4.664 |
| `eval/` | 44 | 4.543 |
| `docs/` | 15 | 5.063 |
| `supabase/` | 7 | 342 |
| `public/` | 5 | 0 (SVG) |

18 berkas terbesar:

```
1634  app/p/[code]/result/result-client.tsx
1219  app/globals.css
1155  app/page.tsx
1032  app/p/[code]/tasks/tasks-client.tsx
 573  components/motion/reveal.tsx
 485  test/ai/ai-run-explanations.test.ts
 473  app/p/[code]/members/[id]/member-profile-client.tsx
 441  lib/scoring/interaction.ts
 433  eval/datasets/d2_scenarios.ts
 412  app/p/[code]/members/members-client.tsx
 390  test/ai/analyze-task.test.ts
 359  test/scoring/interaction.test.ts
 326  components/ui/app-sidebar.tsx
 320  test/api/tasks.test.ts
 311  eval/lib/metrics.ts
 309  eval/scripts/run_hard_rules.test.ts
 298  test/ai/gemini-integration.test.ts
 297  test/scoring/fallback.test.ts
```

### 2.5 Konfigurasi yang mengikat struktur

| Berkas | Isi yang mengikat struktur |
|---|---|
| `tsconfig.json` | `paths: { "@/*": ["./*"] }`; `include` `**/*.ts`, `**/*.tsx`, `**/*.mts`, `next-env.d.ts`, `.next/types/**`; `exclude: ["node_modules"]` (jadi `.opencode/` **tidak** dikecualikan, tetapi tidak berisi `.ts`) |
| `next.config.ts` | `cacheComponents: true`, `partialPrefetching: true`, `turbopack.rules` memuat `@tailwindcss/turbopack` untuk `*.css` |
| `eslint.config.mjs` | `globalIgnores` menambahkan `.opencode/**` (ditambahkan pada tree kerja ini, lihat `git diff eslint.config.mjs`) |
| `vitest.config.ts` | `test.exclude: ['node_modules/**', '.git/**', 'eval/**']`; alias `@` → repo root |
| `eval/vitest.eval.config.ts` | `test.include: ['eval/**/*.test.ts']`; `testTimeout: 120000`; alias `@` → `repoRoot` |
| `.github/workflows/ci.yml` | `typecheck` → `lint` → `test`; trigger hanya `main`/`master` |
| `.gitignore` | `.env*`, `*.tsbuildinfo`, `next-env.d.ts`, `/node_modules`, `/.next/` |

### 2.6 Inventaris direktori penting

```
app/                    6 page.tsx, 1 layout.tsx, 8 route.ts, 4 *-client.tsx, 1 globals.css, 1 favicon.ico
components/             7 berkas di ui/ (4), motion/ (2), recommendations/ (1); 3 direktori kosong
lib/                    ai/ (7), scoring/ (9), db/ (2), motion/ (2), client/ (1), constants/ (1), validation/ (1); utils/ kosong
test/                   23 *.test.ts (+1 fixture) di akar (2), ai/ (7), api/ (5), integration/ (1), scoring/ (7), validation/ (2)
eval/                   7 script, 5 lib, 2 dataset, 1 instrumen, 12 results, 17 reports, 1 README, 1 config
supabase/migrations/    001–007
docs/                   15 berkas (10 di docs/, 6 di laporan/)
.agents/skills/         6 skill (15 berkas)
agent/skills/           6 skill (15 berkas) - duplikat .agents
.claude/skills/         6 symlink → .agents/skills/*
.opencode/skills/       7 skill (175 berkas)
```

---

## 3. Dependency map

### 3.1 Alias TypeScript `@/*` → `./*`

Alias memetakan ke **root repo**, bukan ke `src/`. Konsekuensi: **setiap pemindahan berkas
memutus import `@/…` di semua pemakai**, dan `tsc` akan melaporkannya sebagai error, bukan warning.
Frekuensi import per target (dihitung dari `app components lib test eval`):

| Target | Jumlah import | Pemakai |
|---|---|---|
| `@/lib/scoring/types` | 25 | 9 berkas (app, lib, test, eval) |
| `@/lib/db/project` | 19 | 8 route/api + test |
| `@/lib/scoring/assign` | 16 | app, lib, test, eval |
| `@/lib/motion/use-reduced-motion` | 10 | 5 client page + 5 komponen |
| `@/lib/validation` | 10 | 6 route/api + 2 test + 1 client |
| `@/lib/motion/tokens` | 9 | 10 berkas (app, components) |
| `@/lib/scoring/constants` | 9 | lib, test, eval |
| `@/lib/scoring/score` | 6 | lib, test, eval |
| `@/lib/ai/call-budget` | 6 | 2 route, lib, test |
| `@/lib/ai/analyze-task` | 7 | 2 route, lib, 4 test |
| `@/components/ui/primitives` | 7 | 6 client page |
| `@/components/motion/reveal` | 6 | 5 halaman + 1 komponen |
| `@/lib/scoring/pipeline` | 5 | route, test |
| `@/components/ui/workspace-shell` | 4 | 4 client page |
| `@/lib/ai/{ai-run,embedding-cache,explain}` | 3–4 masing-masing | route, lib, test |
| `@/lib/scoring/{interaction,rules,explain-local}` | 3–4 masing-masing | app, lib, test, eval |
| `@/lib/ai/explanation-validator`, `@/lib/client/events`, `@/lib/constants/task-templates` | 1–3 | route, client, test, eval |
| `@/components/{motion/score-bar, recommendations/score-breakdown, ui/app-sidebar, ui/theme-toggle}` | 1–3 | client page, workspace-shell |
| `@/test/scoring/fixtures/scenarios` | 1 | `test/scoring/scenarios.test.ts` - **satu-satunya `@/test/…`** |
| `@/eval/{datasets/*, lib/*}` | 4 | `eval/scripts/*` |
| `@/app/api/*/route` | 7 | berkas test (`test/api/*`) |

### 3.2 Import relatif

Relatif hanya dipakai **di dalam direktori yang sama** dan pada `page.tsx` → `*-client.tsx`:

- `lib/scoring/*`: `./types`, `./constants`, `./rules`, `./score`, `./assign`
- `lib/ai/*`: `./schemas`, `./embedding-cache`, `./call-budget`, `./analyze-task`, `./explanation-validator`
- `app/p/[code]/{members,members/[id],tasks,result}/page.tsx` → `./<name>-client`
- `test/scoring/*` → `../../lib/scoring/*`; `test/scoring/fixtures/scenarios.ts` → `../../../lib/scoring/types`
- `test/scoring.test.ts` → `../lib/scoring/*`

Tidak ditemukan import relatif yang melompat antar-area (mis. `app/` → `test/` atau `eval/` → `test/`).

### 3.3 Penemuan route Next.js

| Konvensi | Berkas |
|---|---|
`page.tsx` | `app/page.tsx`, `app/how-it-works/page.tsx`, `app/p/[code]/{members,members/[id],result,tasks}/page.tsx`
`layout.tsx` | `app/layout.tsx` (satu-satunya)
`route.ts` | `app/api/{analyze-task,recommend,projects}/route.ts`, `app/api/projects/[code]/{events,members,tasks}/route.ts`, `app/api/projects/[code]/members/[id]/route.ts`, `app/api/projects/[code]/tasks/[id]/route.ts`
`loading.tsx`, `error.tsx`, `not-found.tsx` | **tidak ada satu pun** (6 page, 0 loading, 0 error, 0 not-found)

Efek pemindahan:
- `page.tsx` dan `route.ts` **adalah nama berkas sekaligus URL**. Mengganti nama = mengganti URL.
  Karena itu tidak boleh diusulkan di audit ini.
- `*-client.tsx` (4 berkas) **bukan** konvensi Next; ia hanya dikonsumsi `page.tsx` lewat
  import relatif. Empat berkas ini **aman dipindah** ke `components/` atau `features/` asalkan
  import di `page.tsx` ikut berubah dan `page.tsx` tetap `Suspense`/server boundary-nya.
- `'use client'` ada di 14 berkas; `'use server'` **tidak ada**. Tidak ada Server Action, jadi
  tidak ada file konvensi tersembunyi yang perlu dipertahankan.

### 3.4 Pemindaian Tailwind CSS

- `app/globals.css` hanya punya `@import "tailwindcss";` (baris 1). **Tidak ada `@source`,
  tidak ada `@config`.** Tailwind 4 memakai deteksi sumber otomatis.
- Kelas Tailwind **tidak** ditulis di berkas `.ts` non-JSX: `grep -rn "className" lib` kosong,
  `grep -rn "className" eval` kosong. Konstanta kelas berbasis `.ts`
  (`FIELD`, `FIELD_LABEL` di `components/ui/primitives.tsx:259,266`) berada di `.tsx` dan akan
  tetap terpindai selama berkas itu tetap di dalam project.
- 12 `@utility` dideklarasikan; **3 di antaranya tidak dipakai**:
  `surface-sunken` (hanya definisi di `globals.css:530`), `ring-accent` (`:540`),
  `float-slow` (`:604`). Sisanya dipakai 1–30 kali.
- 2 `@keyframes` (`motion-error-in`, `float-y`); 8 `@media` (5 `prefers-reduced-motion`,
  3 `max-width: 1023px`).

Efek pemindahan: memindahkan `globals.css` keluar dari `app/` akan **memutus**
`import "./globals.css"` di `app/layout.tsx:3` dan bisa membuat Tailwind kehilangan akar
pemindaian. Karena itu `globals.css` **tidak direkomendasikan dipindah** (klasifikasi D),
hanya dikelompokkan secara internal.

### 3.5 Konfigurasi Vitest (dua config, dua lingkungan)

| Config | `include`/`exclude` | Alias | Timeout |
|---|---|---|---|
| `vitest.config.ts` | default include; **exclude `eval/**`** | `@` → root | 5.000 ms (default) |
| `eval/vitest.eval.config.ts` | **include `eval/**/*.test.ts`** | `@` → repo root | 120.000 ms |

- 23 berkas `*.test.ts` di `test/`, 7 di `eval/scripts/`. **Nol import silang**: tidak ada
  `test/` → `eval/` dan tidak ada `eval/` → `test/`. Pemisahan ini memang sudah bersih;
  menggabungkan keduanya akan **merusak** dua sifat sekaligus: `npm test` tidak lagi mengukur
  produk saja, dan test produk akan berjalan dengan timeout 120 s.
- `eval/scripts/*.test.ts` **menulis** ke `eval/results/` dengan path relatif ke CWD
  (mis. `writeFileSync(join('eval/results', 'ablation.json'), …)` di
  `eval/scripts/run_ablation.test.ts:138`). Path ini bergantung pada CWD, bukan pada lokasi berkas.
  Memindahkan `eval/` akan memutus 10 penulisan hasil (`grep -c "join('eval/results'"`).
- `test/ai/gemini-models.live.test.ts:15` dan `test/integration/fr04_fr05_smoke.test.ts:7`
  membaca `path.resolve(process.cwd(), '.env.local')`. Keduanya bergantung pada CWD = root repo.

### 3.6 GitHub Actions

`.github/workflows/ci.yml` menjalankan `npm install --legacy-peer-deps` → `npx tsc --noEmit` →
`npm run lint` → `npm run test`. **Tidak ada langkah `npm run build`.**

Kesenjangan terverifikasi:
1. `next build` **tidak** dijalankan CI, padahal build adalah satu-satunya yang memvalidasi route
   discovery, `cacheComponents`, dan pemindaian Tailwind secara nyata.
2. Trigger `branches: [main, master]` (baris 5-7) sementara branch kerja adalah
   `redesign/fuelplate-ui` dan remote hanya punya `main`. **CI belum pernah melihat kode ini.**

Efek pemindahan: CI merujuk perintah, bukan path. Pemindahan berkas yang tetap memenuhi
`include` `tsconfig`/`vitest` tidak memutus CI. Yang memutus CI adalah bila pemindahan membuat
`npm test` menemukan 0 tes atau membuat `tsc` gagal.

### 3.7 Konfigurasi OpenCode / agen dan skill

| Lokasi | Isi | Rujukan yang ditemukan |
|---|---|---|
| `.opencode/skills/` (7 skill, 175 berkas, 4,8 MB) | `ui-ux-pro-max`, `ui-styling`, `slides`, `banner-design`, `brand`, `design`, `design-system` | `eslint.config.mjs:16` (`.opencode/**`), `REDESIGN_NOTES.md:52`, `docs/STATUS.md:46`, `docs/laporan/01_REFERENSI.md:5` |
| `.agents/skills/` (6 skill, 15 berkas) | `antislop`, `antislop-ui`, `antislop-code`, `antislop-copywriting`, `antislop-human`, `antislop-layoutmobile` | tidak ada rujukan path tertulis; `AGENTS.md:9-14` menyebut **nama** skill, bukan path |
| `agent/skills/` (6 skill, 15 berkas) | sama dengan `.agents/skills/` | **tidak ada rujukan sama sekali** |
| `.claude/skills/` (6 symlink) | → `../../.agents/skills/*` (keenamnya resolve) | tidak ada rujukan tertulis |
| `skills-lock.json` | 6 entri `antislop*` dengan `computedHash` | tidak dirujuk berkas lain |

Catatan penting: **`AGENTS.md` dan `skills-lock.json` tidak menyebut path direktori skill sama
sekali.** `AGENTS.md:9-14` hanya menyebut nama (`antislop-ui`, dst.), dan `skills-lock.json`
menyebut `skills/<nama>/SKILL.md` sebagai *path di repo sumber* (`miqdadbadjuber/anti-slop`),
bukan path di repo ini. Artinya tidak ada konfigurasi yang secara eksplisit menunjuk
`agent/skills/`. Ini membuat `agent/skills/` **kandidat kuat** duplikat yang tidak dipakai,
tetapi pemakaian tidak dapat dibuktikan hanya dari repo (lihat §6, klasifikasi E untuk
pertanyaan ini).

### 3.8 Referensi dokumentasi ke path berkas

Dokumen yang merujuk path kode (berjumlah signifikan): `docs/STATUS.md` (paling banyak),
`docs/PHASE_2_ACCEPTANCE.md`, `docs/IMPLEMENTATION_AUDIT.md`, `docs/T-5.03-AUDIT.md`,
`docs/T-5.05-VISUAL-AUDIT.md`, `docs/T-5.06-VISUAL-AUDIT.md`, `docs/VISUAL-CATALIS.md`,
`docs/laporan/{00,02,03,05}`, `eval/reports/{A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,T-2.06,T-2.07}`,
`eval/README.md`, `REDESIGN_NOTES.md`.

Referensi yang **sudah basi** (target tidak ada):

| Dokumen | Path yang dirujuk | Status |
|---|---|---|
| `docs/VISUAL-CATALIS.md:30` | `components/ui/workspace-nav.tsx` | tidak ada (dihapus per `docs/STATUS.md:1201`) |
| `REDESIGN_NOTES.md:144` | `components/ui/workspace-nav.tsx` | tidak ada |
| `eval/reports/O_RECOMMENDATIONS.md:78` | `test/config` | tidak ada |
| `app/globals.css:8`, `lib/motion/tokens.ts:4`, `docs/VISUAL-CATALIS.md:5,25` | `DESIGN (1).md` | tidak ada di repo (`docs/VISUAL-CATALIS.md:25` mencatat lokasinya di `/home/nando/Downloads/`) |

### 3.9 Script yang memakai path tertentu

`package.json` hanya berisi `next dev|build|start` dan `vitest run`, tanpa path literal.
Satu-satunya path yang ditulis literal ada di dalam kode: 10 penulisan `eval/results/*`
(§3.5) dan 2 pembacaan `.env.local` lewat `process.cwd()`.

### 3.10 Ringkasan dampak pemindahan per dependensi

| Jika memindahkan… | Yang rusak | Terdeteksi oleh |
|---|---|---|
| berkas di `lib/` atau `components/` | semua `@/lib/...`/`@/components/...` | `npx tsc --noEmit` |
| `app/p/[code]/*/page.tsx` | URL route (bukan error kompilasi) | `npm run build` (daftar route) + uji browser |
| `app/p/[code]/*/*-client.tsx` | import relatif `./*-client` di `page.tsx` | `npx tsc --noEmit` |
| `app/api/**` | URL API yang dipanggil `fetch('/api/...')` (6 lokasi) | `npm test` (`test/api/*`) + uji alur |
| `app/globals.css` | `import "./globals.css"`, pemindaian Tailwind, `next.config.ts` `*.css` rule | `npm run build` + cek visual |
| `eval/**` | 10 `join('eval/results', …)`, `eval/vitest.eval.config.ts` `include` | jalankan tiap runner eval |
| `test/**` | `@/test/scoring/fixtures/scenarios` | `npx tsc --noEmit` + `npm test` |
| `supabase/migrations/**` | urutan migrasi (nama = urutan) | **tidak ada gerbang otomatis** - jangan diusulkan |

---

## 4. Temuan duplikasi

### 4.1 `agent/skills/` vs `.agents/skills/` - duplikat nyaris sempurna

```
diff -r agent/skills .agents/skills
```

Hasil: **6 berkas berbeda, semuanya `SKILL.md`, dan semuanya hanya pada 2 baris frontmatter.**

| Berkas | `agent/skills/` | `.agents/skills/` |
|---|---|---|
| `antislop/SKILL.md` | frontmatter: `description` saja | `description`, `name: antislop`, `allowed-tools: Read, Write, Edit, Glob, Grep` |
| `antislop-code/SKILL.md` | `description` saja | + `name: antislop-code`, + `allowed-tools: Read, Write, Edit, Glob, Grep` |
| `antislop-copywriting/SKILL.md` | idem | idem |
| `antislop-ui/SKILL.md` | idem | idem |
| `antislop-layoutmobile/SKILL.md` | idem | idem |
| `antislop-human/SKILL.md` | idem | + `name` + `allowed-tools: Bash(python *), Bash(python3 *), Read, Write, Edit, Glob, Grep` |

Berkas lain (`VERSION`, `LICENSE-web-quality-skills`, `references/*.md`, `contrast-check.py`,
`contrast-mcp.py`) **identik byte-per-byte**. Ukuran: `agent/skills` 188.982 byte,
`.agents/skills` 189.414 byte (selisih 432 byte = 12 baris frontmatter).

`agent/skills/antislop/VERSION` = `3.2.29`.

**Versi:** kedua tree melaporkan versi yang sama (`3.2.29`) dan hash isi yang sama kecuali
frontmatter. Jadi ini bukan "versi berbeda yang kebetulan mirip", melainkan **satu tree yang
disalin lalu frontmatter-nya dilucuti/ditambah**. `skills-lock.json` menyimpan
`computedHash` per skill, tetapi hash itu dihitung di repo sumber dan tidak dapat dicocokkan
ke isi lokal dari dalam repo ini tanpa mengunduh sumbernya.

### 4.2 `.claude/skills/` - symlink, bukan duplikasi isi

Keenam entri adalah symlink relatif dan **semuanya resolve**:

```
.claude/skills/antislop            -> ../../.agents/skills/antislop            (resolves: YES)
.claude/skills/antislop-code       -> ../../.agents/skills/antislop-code       (resolves: YES)
.claude/skills/antislop-copywriting-> ../../.agents/skills/antislop-copywriting(resolves: YES)
.claude/skills/antislop-human      -> ../../.agents/skills/antislop-human      (resolves: YES)
.claude/skills/antislop-layoutmobile-> ../../.agents/skills/antislop-layoutmobile(resolves: YES)
.claude/skills/antislop-ui         -> ../../.agents/skills/antislop-ui         (resolves: YES)
```

Ini **bukan** temuan duplikasi dan **bukan** direktori kosong. Menghapus `.claude/skills/`
akan memutus pemuatan skill untuk klien Claude, dan menghapus `.agents/skills/` akan membuat
keenam symlink menggantung. Keduanya klasifikasi **D**.

### 4.3 `.opencode/skills/` - set berbeda, dengan duplikasi internal

7 skill, 175 berkas, 4,8 MB. Nama tidak beririsan dengan tree `antislop`:

| Skill | `name` | version | Berkas |
|---|---|---|---|
| `banner-design` | `banner-design` | 1.0.0 | 2 |
| `brand` | `brand` | 1.0.0 | 18 |
| `design` | `design` | 2.1.0 | 35 |
| `design-system` | `design-system` | 1.0.0 | 27 |
| `slides` | `slides` | 1.0.0 | 6 |
| `ui-styling` | `ui-styling` | 1.0.0 | 16 |
| `ui-ux-pro-max` | `ui-ux-pro-max` | (tidak ada) | 71 |

**Duplikasi internal terverifikasi lewat sha256** (6 pasang berkas identik):

```
design/references/slides-create.md            == slides/references/create.md
design/references/slides-layout-patterns.md   == slides/references/layout-patterns.md
design/references/slides-strategies.md        == slides/references/slide-strategies.md
design/references/slides-html-template.md     == slides/references/html-template.md
design/references/slides-copywriting-formulas.md == slides/references/copywriting-formulas.md
banner-design/references/banner-sizes-and-styles.md == design/references/banner-sizes-and-styles.md
```

Bentuknya adalah **skill "agregator" (`design`, 2.1.0) yang menyalin referensi dari skill
tunggal (`slides`, `banner-design`)**. Ini duplikasi struktural, bukan kesalahan.
`design` dan `design-system` hanya berbagi **1 nama berkas** (`SKILL.md`, isi berbeda).

**Kesimpulan `.opencode/`:** 4,8 MB aset vendor yang sebagian besar tidak pernah dipakai
pekerjaan ini (tidak ada rute, tidak ada `@utility`, tidak ada komponen yang berasal darinya).
Namun ia **dirujuk eksplisit** oleh `eslint.config.mjs:16` dan 3 dokumen, sehingga
penghapusan bukan keputusan audit ini. Klasifikasi **E** untuk pemakaian, **D** untuk
`eslint.config.mjs` yang merujuknya.

### 4.4 Artefak di dalam skill tree

- `.opencode/skills/ui-ux-pro-max/scripts/__pycache__/` berisi **3 berkas `.pyc`**
  (`core`, `design_system`, `reasoning_contract`, CPython 3.14). Ini sisa eksekusi Python,
  bukan sumber. Klasifikasi **A** (aman dihapus setelah verifikasi), tetapi berada di dalam
  `.opencode/` yang bukan milik aplikasi.
- Tidak ada `.pyc` di `.agents/` maupun `agent/`.

### 4.5 Direktori kosong

| Path | Isi | Rujukan |
|---|---|---|
| `components/layout/` | kosong | tidak ada; `grep -rn "components/layout"` = 0 |
| `components/members/` | kosong | tidak ada |
| `components/tasks/` | kosong | tidak ada |
| `lib/utils/` | kosong | tidak ada |

Keempatnya tercatat sebagai "direktori ada tetapi kosong" di `REDESIGN_NOTES.md:49`.
Tidak ada `index.ts`, tidak ada barrel, tidak ada import ke path tersebut.

### 4.6 Berkas yang tidak direferensikan

| Path | Bukti | Klasifikasi |
|---|---|---|
| `lib/db/supabase.ts` | `grep -rn "db/supabase\|from './supabase'"` di `app components lib test eval` = **0 hasil**. Modul membuat client pada module-eval dari `process.env.SUPABASE_URL`/`SUPABASE_SECRET_KEY` (`:3-6`). Jalur yang dipakai aplikasi adalah `getSupabaseClient()` di `lib/db/project.ts` yang membaca env saat dipanggil (`:5-14`). | **A** |
| `lib/scoring/index.ts` | Barrel `export *` dari 5 modul. `grep -rn "scoring/index\|from '@/lib/scoring'\|from './index'"` = **0 hasil**. Risiko rendah tetapi **tidak nol**: barrel `export *` adalah konvensi yang mungkin dipakai konsumen luar repo (mis. notebook evaluasi manual). | **E** |
| `components/motion/score-bar.tsx` → `ScoreBar` | `ScoreBar` **tidak dipakai**; yang dipakai hanya `LoadMeter` dari berkas yang sama (1 import, di `result-client.tsx:29`). Jadi berkasnya **dipakai**, hanya satu ekspornya tidak. | **D** (berkas), ekspor `ScoreBar` = **E** |
| `components/recommendations/score-breakdown.tsx` → `useDisclosure` | `useDisclosure` **tidak dipakai** (0 hasil). `ScoreBreakdown` dipakai 1 kali. | **D** (berkas) |
| `lib/motion/tokens.ts` → `TRANSITION`, `STAGGER` | `grep -rn "TRANSITION\|STAGGER"` di luar definisi = **0 hasil**. `DURATION`, `EASE`, `SCROLL` dipakai. | **D** (berkas), 2 ekspor = **E** |
| `lib/ai/analyze-task.ts` → `ai` | dipakai `lib/ai/explain.ts:1` dan 2 test. Ekspor ini **dipakai**. | **D** |
| `public/{file,globe,next,vercel,window}.svg` | tidak disebut di `app/`, `components/`, `lib/`. Sisa `create-next-app`. | **A** |
| `tsconfig.tsbuildinfo`, `next-env.d.ts` | di-gitignore (`.gitignore:40,41`), bukan sumber. | **D** (dibiarkan, artefak) |
| `app/api/projects/[code]/events/route.ts`, `app/api/projects/[code]/members/route.ts`, `app/api/projects/[code]/members/[id]/route.ts`, `app/api/projects/[code]/tasks/route.ts`, `app/api/projects/[code]/tasks/[id]/route.ts` | **tidak punya import masuk**, karena route Next dipanggil lewat URL, bukan import. Dipanggil `fetch` di `members-client.tsx:46,84`, `tasks-client.tsx:120,214,564`, `lib/client/events.ts:18`. | **D** - contoh persis aturan "jangan simpulkan tidak terpakai karena tidak ada import" |
| `app/page.tsx`, `app/layout.tsx`, `app/how-it-works/page.tsx`, seluruh `page.tsx` | tidak punya import masuk; ditemukan oleh filesystem routing. | **D** |

### 4.7 Duplikasi dokumen

| Pasangan | Hubungan | Tindakan |
|---|---|---|
| `docs/ACCEPTANCE_MATRIX.md` (24 baris) vs `docs/STATUS.md` §"Status Berdasarkan Fitur (FR)" | `ACCEPTANCE_MATRIX.md` menyatakan US-08..US-16 `MISSING`/`READY`, sedangkan `STATUS.md:3-27` menyatakan FR-08..FR-16 `VERIFIED`. **Berlawanan arah.** | **D** (jangan hapus), tetapi §11 mencatatnya sebagai risiko kesalahbacaan. Bukan duplikasi yang boleh dihapus. |
| `docs/IMPLEMENTATION_AUDIT.md` (36 baris) vs `docs/STATUS.md` | `IMPLEMENTATION_AUDIT.md:30` menyebut "GAP: halaman hasil rekomendasi belum ada", padahal `app/p/[code]/result/` ada dan tercatat VERIFIED. Stale. | **D** |
| `docs/laporan/02_LAPORAN_AKADEMIK.md` (591) vs `03_HASIL_DAN_PEMBAHASAN.md` (561) | Berbeda peran (metode vs hasil). Bukan duplikat. | **D** |
| `eval/reports/A_P_FINAL.md` vs `B`…`O` | `A_P_FINAL.md` adalah ringkasan yang merujuk 14 laporan lain. Bukan duplikat. | **D** |
| `docs/T-5.03-AUDIT.md` vs `docs/T-5.04/05/06-VISUAL-AUDIT.md` | Empat dokumen audit per tugas, masing-masing merujuk tugasnya. Riwayat. | **D** |
| `REDESIGN_NOTES.md` (226) vs `docs/VISUAL-CATALIS.md` (224) | Keduanya mencatat keputusan visual; `REDESIGN_NOTES.md` adalah catatan proses (Fase 0–N), `VISUAL-CATALIS.md` adalah spesifikasi hasil. Tumpang tindih sebagian (token, motion). | **E** - kandidat konsolidasi **isi**, bukan penghapusan berkas |

---

## 5. Temuan file besar

Aturan yang dipegang: **tidak memecah berkas pada tahap audit**, tidak mengubah struktur route,
tidak mengubah business logic. Rekomendasi di bawah hanya menandai batas yang **sudah ada**.

### 5.1 `app/page.tsx` - 1.155 baris

Struktur aktual (deklarasi top-level, dengan nomor baris):

| Baris | Deklarasi | Peran | Dapat dipisah? |
|---|---|---|---|
| 50 | `SECTION_TONE` | konstanta presentasional | ya, dengan pemiliknya |
| 56 | `STEPS` | data konten `AlurProduk` | ya |
| 68 | `SCORE_ROWS` | data konten `KomposisiSkor` | ya |
| 75 | `Home()` | state form + `handleSubmit` + komposisi | **jangan dipisah dulu** |
| 208 | `ScrollProgress()` | hook `useScroll` + `useTransform` | **ya, mandiri** |
| 240 | `HOME_SECTIONS` | data `SectionRail` | ya |
| 246 | `SectionRail()` | hook + `useState` + anchor | **ya, mandiri** |
| 336 | `Hero({...})` | 10 props, form + animasi | tidak; props terlalu berderet |
| 779 | `FloatShell()` | wrapper animasi | ya, bersama Hero |
| 816 | `FormulaPlate()` | presentasional | ya |
| 857 | `AlurProduk()` | bagian storytelling | **ya, mandiri** |
| 985 | `KomposisiSkor()` | bagian skor | **ya, mandiri** |
| 1109 | `SiteFooter()` | presentasional | **ya, mandiri** |

Temuan: dari 1.155 baris, sekitar **530 baris** (baris 857–1.155 → `AlurProduk` +
`KomposisiSkor` + `SiteFooter` = 298 baris, ditambah `ScrollProgress` + `SectionRail` +
konstantanya = ±230 baris) adalah komponen **tanpa state bersama**. Hanya `Home`, `Hero`, dan
`FormulaPlate` yang berbagi state/props.

### 5.2 `app/globals.css` - 1.219 baris

| Baris | Blok | Sifat |
|---|---|---|
| 1 | `@import "tailwindcss"` | harus tetap di posisi pertama |
| 18–85 | `@theme inline` (token → utility namespace) | global, **jangan dipindah** |
| 87–222 | `:root` token light (+ `--rail-*`, `--canvas-*`, `--glass-*`) | global |
| 223–424 | `:root[data-theme="dark"]` | global, **harus tetap setelah `:root`** (spesifisitas setara, urutan menentukan) |
| 426–615 | 12 `@utility` + 2 `@keyframes` + rule fokus + reduced-motion | blok deklaratif |
| 609–674 | `input[type="range"]` | elemen global |
| 675–748 | theme toggle, workspace rail | komponen |
| 749–892 | homepage bands + homepage glass (T-5.04/T-5.06) | halaman |
| 893–1.219 | workspace rail glass (T-5.03/T-5.04) + mobile drawer + rail theme toggle | komponen |

Temuan: berkas ini **tidak punya satu komponen pun**, tetapi ia mencampur empat tingkat:
token global, utility, komponen, halaman. Ini sumber nilai tinggi untuk dikelompokkan.
Namun: **setiap pemecahan menjadi beberapa berkas memerlukan `@import` bertingkat, dan urutan
cascade adalah bagian dari perilaku** (mis. `:root` sebelum `:root[data-theme="dark"]`,
`:root` token sebelum `@theme inline` membacanya). Karena itu pemecahan berkas menempati
prioritas **terakhir**, bukan pertama.

### 5.3 `app/p/[code]/result/result-client.tsx` - 1.634 baris

Satu komponen `ResultClient` (baris 52–1.568) + satu helper `WorkloadSummary` (1.581–1.634)
+ 2 konstanta. Di dalamnya:

- **34 `useState`** dan **7 `useRef`** (baris 53–99) untuk: data fetch, bobot, snapshot,
  undo, status, rowChanges, timing, copy state, logging, fokus sel, detail, preview, move target,
  swap anchor, perbandingan.
- **±20 fungsi handler** (`handleWeightChange:234`, `resetHybridWeights:289`,
  `snapshotForUndo:307`, `endWeightDrag:313`, `applyOwnerChange:317`, `handleSwap:357`,
  `toggleLock:397`, `undo:416`, `buildExportRows:451`, `handleExportCsv:484`,
  `handleCopyText:502`, `focusCellAt:538`, `isTypingTarget:549`, `handleCellKeyDown:588`, dst.).
- **1 render return** 747–1.568: di dalamnya dua blok besar yang dipisahkan komentar
  `{/* Instruments: weights + workload + mode */}` (baris 792) dan `{/* Matrix */}` (baris 968).

Temuan: batas pemisahan yang **paling jelas dan paling rendah risiko** adalah **dua blok JSX
itu**, bukan state. Keduanya dipisah komentar penulis sendiri. Namun keduanya memakai
≥20 state yang sama, sehingga memisahkannya menjadi komponen mensyaratkan **props yang
sangat lebar** atau **context/hook ekstrasi** - dan itu adalah perubahan struktur state,
bukan kosmetik. Ini masuk **C (perlu refactoring bertahap)**, bukan B.

Yang **sudah** terpisah dan tidak perlu disentuh: logika murni ada di
`lib/scoring/interaction.ts` (441 baris, 30 ekspor), penjelasan lokal di
`lib/scoring/explain-local.ts`, breakdown di `components/recommendations/score-breakdown.tsx`.

### 5.4 `app/p/[code]/tasks/tasks-client.tsx` - 1.032 baris

| Baris | Deklarasi |
|---|---|
| 21–66 | `TaskItem`, `TemplateDraftItem`, `TaskDraft`, `EMPTY_DRAFT` - **tiga tipe lokal** |
| 67 | `isValidHours()` |
| 74 | `draftFromTask()` |
| 87 | `errorMessage()` |
| 97 | `TasksClient()` - komponen utama |
| 991 | `TaskWorkloadStrip()` |

Render utama (364–990) sudah dibagi komentar penulis menjadi 6 blok: header + tools (365),
progress AI (398), status banner (414), saran AI (450), template drafts (495), task register
(588), form manual (787).

Temuan: tiga fungsi murni (`isValidHours`, `draftFromTask`, `errorMessage`) dan tiga tipe
lokal adalah **kandidat ekstraksi termurah** di seluruh audit: tanpa state, tanpa JSX, dan
dapat diuji tanpa render. Ini satu-satunya bagian dari keempat berkas besar yang memenuhi
syarat "aman dipindah setelah verifikasi referensi" (B).

### 5.5 Berkas besar lain yang tidak diminta tetapi perlu dicatat

| Berkas | Baris | Catatan |
|---|---|---|
| `components/motion/reveal.tsx` | 573 | 9 ekspor, semuanya primitif motion. Sudah satu tanggung jawab. |
| `app/p/[code]/members/[id]/member-profile-client.tsx` | 473 | 1 komponen + 9 `useState`, tidak ada helper terpisah. |
| `app/p/[code]/members/members-client.tsx` | 412 | 1 komponen + `MemberStructureBar`. |
| `lib/scoring/interaction.ts` | 441 | 30 ekspor murni. Ini **sudah** hasil pemisahan yang benar. |
| `components/ui/app-sidebar.tsx` | 326 | 2 ekspor (`RailItem`, `buildRailItems`, `AppSidebar`). |

---

## 6. Temuan dokumentasi

### 6.1 Peta dokumen

| Dokumen | Baris | Peran | Rujukan masuk | Klasifikasi |
|---|---|---|---|---|
| `prd.md` | 1.443 | PRD v0.2 (9 bagian) | 12 dokumen | **D** |
| `DESIGN.md` | 132 | referensi desain | 8 dokumen + 4 berkas kode | **D** |
| `AGENTS.md` | 29 | aturan teknis agen | dirujuk `REDESIGN_NOTES.md`, `docs/STATUS.md`, `docs/laporan/00` | **D** |
| `README.md` | 36 | boilerplate `create-next-app` | 0 | **D** (lihat catatan) |
| `REDESIGN_NOTES.md` | 226 | catatan proses redesign | dirujuk 0 dokumen lain | **E** |
| `docs/STATUS.md` | 1.744 | log protokol per tugas | dirujuk 5 dokumen | **D** |
| `docs/VISUAL-CATALIS.md` | 224 | spesifikasi visual | dirujuk `docs/STATUS.md:506,606`; `app/globals.css:8`; `lib/motion/tokens.ts:4` | **D** |
| `docs/T-5.03-AUDIT.md` | 148 | audit pra-kerja | dirujuk `docs/STATUS.md:1183` | **D** |
| `docs/T-5.04-VISUAL-AUDIT.md` | 130 | audit visual | dirujuk `docs/STATUS.md` | **D** |
| `docs/T-5.05-VISUAL-AUDIT.md` | 86 | audit visual | dirujuk `docs/STATUS.md` | **D** |
| `docs/T-5.06-VISUAL-AUDIT.md` | 146 | audit visual | dirujuk `docs/STATUS.md` | **D** |
| `docs/ACCEPTANCE_MATRIX.md` | 24 | matriks Fase A | 0 | **D** (stale, lihat 6.3) |
| `docs/IMPLEMENTATION_AUDIT.md` | 36 | audit Fase A | 0 | **D** (stale) |
| `docs/PHASE_2_ACCEPTANCE.md` | 124 | matriks penerimaan Fase 2 | dirujuk `docs/STATUS.md` | **D** |
| `docs/laporan/00_MATRIKS_KETERLACAKAN.md` | 194 | keterlacakan akademik | dirujuk `docs/STATUS.md` | **D** |
| `docs/laporan/01_REFERENSI.md` | 179 | referensi | 0 | **D** |
| `docs/laporan/02_LAPORAN_AKADEMIK.md` | 591 | laporan | dirujuk `00`, `docs/STATUS.md` | **D** |
| `docs/laporan/03_HASIL_DAN_PEMBAHASAN.md` | 561 | hasil | dirujuk `docs/STATUS.md` | **D** |
| `docs/laporan/04_SLIDE_PRESENTASI.html` | 506 | deck presentasi | dirujuk `docs/STATUS.md` | **D** |
| `docs/laporan/05_SKRIP_DEMONSTRASI.md` | 370 | skrip demo | dirujuk `docs/STATUS.md` | **D** |
| `eval/README.md` | 92 | cara menjalankan eval | dirujuk `eval/reports/N_FILES.md` | **D** |
| `eval/reports/00_AUDIT.md` | 105 | audit Fase 4 | dirujuk `A_P_FINAL.md` | **D** |
| `eval/reports/A_P_FINAL.md` … `O_RECOMMENDATIONS.md` | 14 berkas, 1.203 | laporan per metrik | saling merujuk | **D** |
| `eval/reports/T-2.06_*.md`, `T-2.07_*.md` | 462 | audit integrasi Gemini | dirujuk `docs/laporan/05` | **D** |
| `eval/instruments/human_agreement_instrument.md` | - | instrumen (BLOCKED) | dirujuk `G`, `M`, `O`, `03` | **D** |
| `eval/results/*` (12 berkas) | - | artefak hasil | dirujuk 10+ laporan | **D** |
| `supabase/migrations/001–007` | 342 | skema | dirujuk dokumen | **D** (tidak boleh disentuh) |

### 6.2 Cross-reference: apa yang akan rusak jika dokumen dipindah

`docs/STATUS.md` merujuk **lebih dari 20** berkas `docs/` dan `eval/reports/` dengan path
eksplisit. `docs/laporan/00_MATRIKS_KETERLACAKAN.md` merujuk `docs/STATUS.md`,
`eval/reports/A_P_FINAL.md`, `L_PERFORMANCE.md`, `G_HUMAN_AGREEMENT.md`, `O_RECOMMENDATIONS.md`.
`app/globals.css:8` dan `lib/motion/tokens.ts:4` **mengutip path dokumen di dalam komentar kode**.

Efek: memindahkan satu dokumen di `docs/` memutus rujukan dari kode dan dari dokumen lain,
dan rujukan itu **tidak diperiksa oleh `tsc`, `eslint`, maupun `vitest`**. Tidak ada gerbang
otomatis untuk path dokumen. Karena itu **tidak ada satu pun dokumen yang direkomendasikan
dipindah** pada audit ini.

### 6.3 Inkonsistensi dokumen (bukan duplikasi, bukan alasan hapus)

1. `docs/ACCEPTANCE_MATRIX.md:12-21` menyatakan US-08…US-16 `MISSING`/`READY`/`PARTIAL`;
   `docs/STATUS.md:3-27` menyatakan FR-08…FR-16 `VERIFIED`. Matriks Fase A jelas lebih tua.
2. `docs/IMPLEMENTATION_AUDIT.md:30` menyatakan halaman hasil belum ada.
3. `docs/VISUAL-CATALIS.md:30` menyebut `components/ui/workspace-nav.tsx` - sudah dihapus.
4. `REDESIGN_NOTES.md:144` menyebut `workspace-nav.tsx` sebagai berkas "baru".
5. `eval/reports/O_RECOMMENDATIONS.md:78` menyebut `test/config` yang tidak ada.
6. `vitest.config.ts:15` dan `eval/vitest.eval.config.ts:10` menyebut "287 test"; hitungan
   statis `it(`/`test(` di `test/` adalah **277**; hasil lulus terakhir yang tercatat di
   `docs/STATUS.md` (T-5.06) adalah **299**. Angka di komentar berarti angka pada saat ditulis,
   bukan sekarang. Ini sumber salah baca, bukan bug.
7. `AGENTS.md:7` merujuk "PRD Bagian 12" sebagai panduan desain. `prd.md` punya **9 bagian
   top-level** tanpa Bagian 12. Panduan desain yang nyata ada di `DESIGN.md`; batas motion ada
   di PRD §6.9 (NFR-46…NFR-50). **Ini sudah dilaporkan pada T-5.06 dan tetap belum diperbaiki.**

**Tidak ada dokumentasi historis yang direkomendasikan untuk dihapus.** Setiap berkas
dokumentasi di atas berada di klasifikasi **D** atau **E**.

---

## 7. Kandidat penghapusan dan pemindahan

Format: **path - bukti penggunaan - dependensi - risiko - rekomendasi - cara menguji setelah perubahan.**
Tidak ada satu pun tindakan di bagian ini yang dilakukan pada T-5.07.

### 7.1 Klasifikasi A - aman dihapus setelah verifikasi

**A-1. `lib/db/supabase.ts` (6 baris)**
- Bukti tidak dipakai: `grep -rn "db/supabase\|from './supabase'" app components lib test eval` → 0 hasil.
  Tidak ada test yang mengimpor. Tidak ada rujukan dokumen ke modul ini sebagai jalur aktif.
- Dependensi: `@supabase/supabase-js` tetap dibutuhkan `lib/db/project.ts:1` dan
  `test/integration/fr04_fr05_smoke.test.ts:4`. Jadi menghapus berkas ini **tidak**
  membuat paket menjadi tidak terpakai.
- Bukti perilaku: modul membuat client **saat modul dievaluasi** (`:3-6`); `lib/db/project.ts:4`
  secara eksplisit mencatat alasan membaca env saat dipanggil. Dua sumber client dengan
  semantik berbeda adalah sumber bug, bukan fitur.
- Risiko: **rendah**, tetapi tidak nol karena berkas ini **untracked** - penghapusan tidak dapat
  di-rollback dengan `git`. Mitigasi: kompresi/snapshot dulu (§10 Tahap 0).
- Rekomendasi: hapus **setelah** Tahap 0 dan setelah `npx tsc --noEmit` + `npm test` hijau.
- Uji setelah perubahan: `npx tsc --noEmit` (0 error) → `npm run lint` (0 error, 2 warning) →
  `npm test -- --testTimeout=30000` (299 lulus) → `npm run build` (exit 0, 15 entri rute) →
  `grep -rn "db/supabase" app lib test eval components` (0 hasil).

**A-2. `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`**
- Bukti tidak dipakai: tidak ada nama berkas tersebut dirujuk di `app/`, `components/`, `lib/`.
  Tidak ada `next/image` di repo (`grep -rn "next/image"` → 0).
- Dependensi: tidak ada. `public/` tidak dipindai Tailwind, tidak ada di `tsconfig` include.
- Risiko: **sangat rendah**, tetapi **untracked-and-ignored? bukan** - kelima berkas ini
  **tracked di HEAD** (`git ls-tree -r HEAD public/` → 5 berkas), jadi penghapusan **dapat**
  di-rollback dengan `git checkout -- public/`.
- Rekomendasi: hapus. Sisa `create-next-app`.
- Uji: `npm run build` exit 0; muat `/` di browser dan pastikan 0 permintaan 404 di network panel.

**A-3. `.opencode/skills/ui-ux-pro-max/scripts/__pycache__/` (3 berkas `.pyc`)**
- Bukti: artefak CPython 3.14 dari eksekusi `core.py`/`design_system.py`/`reasoning_contract.py`.
  Bukan sumber; tidak dirujuk `SKILL.md`.
- Dependensi: tidak ada. `.pyc` akan dibuat ulang bila skrip Python dijalankan lagi.
- Risiko: **sangat rendah**. Catatan: `.opencode/` **tidak** di-gitignore, jadi artefak ini
  akan ikut ter-commit bila `git add` dijalankan tanpa hati-hati di kemudian hari.
- Rekomendasi: hapus; bila pipeline skill Python dipakai, tambahkan `__pycache__/` ke
  `.gitignore` sebagai tugas terpisah (bukan bagian audit ini).
- Uji: `find .opencode -name "*.pyc"` → kosong; `ls .opencode/skills/ui-ux-pro-max/scripts`.

### 7.2 Klasifikasi B - aman dipindah setelah verifikasi referensi

**B-1. Direktori kosong: `components/layout/`, `components/members/`, `components/tasks/`, `lib/utils/`**
- Bukti: `find … -type d -empty`; `grep -rn "components/layout\|components/members\|components/tasks\|lib/utils"` → 0 hasil.
- Dependensi: tidak ada. Tidak ada barrel, tidak ada import.
- Risiko: **nol** terhadap build; hanya menghilangkan tempat yang bisa menyesatkan
  (membaca struktur `components/members/` akan mengira ada komponen member di sana padahal
  ada di `app/p/[code]/members/`).
- Rekomendasi: `rmdir` (bukan `rm -rf`), setelah `git status` dipastikan bersih dari berkas
  tak terduga. Keempatnya **tidak tracked** (direktori kosong tidak pernah di git).
- Uji: `find components lib -type d -empty` → kosong; `npx tsc --noEmit`; `npm test`.

**B-2. Tiga fungsi murni + tiga tipe lokal di `app/p/[code]/tasks/tasks-client.tsx`**
- Target yang diusulkan (belum dieksekusi): `isValidHours` (baris 67), `draftFromTask` (74),
  `errorMessage` (87), `TaskItem`/`TemplateDraftItem`/`TaskDraft`/`EMPTY_DRAFT` (21–66) →
  `app/p/[code]/tasks/task-draft.ts` (di sebelah berkasnya, bukan di `lib/`).
- Bukti: ketiganya fungsi murni tanpa akses state/JSX; `TaskItem` juga dipakai
  `TaskWorkloadStrip` (991) di berkas yang sama.
- Dependensi: hanya `@/lib/scoring/types` (`SKILL_TAXONOMY`) dan `@/lib/validation`
  (`taskSchema`) - keduanya sudah diimpor di berkas asal.
- Risiko: **rendah**, dan terdeteksi penuh oleh `tsc` bila import tertinggal. Risiko nyata:
  bila tipe dipindah dan ada perbedaan `TaskItem` vs `Task` di `lib/scoring/types`, salah
  pemetaan bisa lolos `tsc` karena struktural. Mitigasi: jangan mengubah definisi tipe saat
  memindahkan; pindahkan apa adanya.
- Rekomendasi: lakukan **hanya** setelah Tahap 0–2 hijau, sebagai satu tahap tersendiri
  dengan 0 perubahan isi tipe.
- Uji: `npx tsc --noEmit`; `npm test -- --testTimeout=30000`; buka `/p/<code>/tasks` dan
  jalankan alur tambah/edit/hapus tugas; bandingkan jumlah tes sebelum/sesudah (harus sama).

**B-3. Komponen presentasional dari `app/page.tsx`**
- Target yang diusulkan: `ScrollProgress` (208), `SectionRail` (246) + `HOME_SECTIONS` (240)
  → `components/home/section-rail.tsx`; `AlurProduk` (857) + `STEPS` (56) →
  `components/home/alur-produk.tsx`; `KomposisiSkor` (985) + `SCORE_ROWS` (68) →
  `components/home/komposisi-skor.tsx`; `SiteFooter` (1109) → `components/home/site-footer.tsx`.
- Bukti: kelima komponen tidak menerima props dari `Home` dan tidak berbagi state;
  `Hero`, `FloatShell`, `FormulaPlate` **tetap** di `app/page.tsx` karena berbagi state form.
- Dependensi: `@/components/motion/reveal`, `@/lib/motion/tokens`, `@/lib/motion/use-reduced-motion`,
  `@/components/ui/primitives`. Semuanya resolusi lewat alias `@/`, sehingga menjadi
  **lebih pendek** setelah dipindah ke `components/`.
- Risiko: **sedang**. `app/page.tsx` adalah berkas **tracked dan termodifikasi**; kesalahan di
  sini tidak dapat di-`git checkout` tanpa menghapus pekerjaan T-5.04/T-5.06. Selain itu
  memindahkan komponen yang memakai `AnimatePresence`/`useScroll` mengubah urutan mount
  relatif terhadap `SectionRail` - harus diverifikasi di browser, bukan hanya `tsc`.
- Rekomendasi: **satu komponen per tahap**, dimulai dari `SiteFooter` (paling sederhana,
  tanpa hook), lalu `AlurProduk`, lalu `KomposisiSkor`, lalu `SectionRail` + `ScrollProgress`
  bersamaan (mereka berbagi `useScroll` pada `#atas`/`#cara-kerja`/`#scoring`).
- Uji per tahap: `npx tsc --noEmit`; `npm run build`; muat `/` pada 390 dan 1280 px;
  cek 0 error konsol, 0 overflow horizontal, anchor `#cara-kerja`/`#scoring` masih melompat,
  dan (khusus `SectionRail`) tick aktif masih berubah saat scroll.

### 7.3 Klasifikasi C - perlu refactoring bertahap

**C-1. `app/p/[code]/result/result-client.tsx` (1.634 baris)**
- Bukti struktur: 34 `useState` + 7 `useRef` (53–99), ±20 handler (234–739), satu `return`
  747–1.568 dengan dua blok JSX bertanda komentar sendiri: `Instruments` (792) dan
  `Matrix` (968).
- Dependensi: seluruh 34 state dipakai lintas kedua blok (mis. `weights` dipakai slider di
  `Instruments` **dan** sel di `Matrix`). Karena itu memisahkan JSX tanpa memisahkan state
  hanya memindahkan masalah.
- Risiko: **tinggi**. Berkas ini memuat FR-08, FR-09, FR-10, FR-11, FR-12, FR-13, FR-14,
  FR-16, FR-17, FR-18, FR-20, FR-21 (dicatat di komentar 35–46). Setiap kesalahan state
  adalah regresi fitur, bukan regresi tampilan. Berkas **untracked** → tidak ada rollback git.
- Rekomendasi: **jangan** dipecah lebih dulu. Bila nanti diperlukan, urutannya:
  (1) ekstrak `WorkloadSummary` (sudah terpisah, 1.581–1.634) → `components/result/workload-summary.tsx`;
  (2) ekstrak hook data-fetch murni (baris 101–181) → `use-result-data.ts` tanpa mengubah
  signature state; (3) **baru** pertimbangkan `Instruments`/`Matrix`. Setiap langkah
  harus lulus seluruh 299 tes dan uji manual matriks (klik sel, geser slider, kunci, tukar,
  undo, ekspor CSV, salin teks, navigasi keyboard panah).
- Uji: seluruh gerbang + uji keyboard 2D (`handleCellKeyDown`) + ekspor CSV yang dibandingkan
  byte-per-byte dengan hasil sebelum refactor.

**C-2. `app/globals.css` (1.219 baris)**
- Bukti: 4 tingkat tercampur (§5.2). Tidak ada satu pun komponen.
- Dependensi: `app/layout.tsx:3` mengimpor berkas ini; `next.config.ts:9-12` memasang
  `@tailwindcss/turbopack` untuk `*.css`; **urutan cascade adalah perilaku**
  (`:root` sebelum `:root[data-theme="dark"]`; `@theme inline` membaca `:root`).
- Risiko: **tinggi untuk tampilan, nol untuk logika**. Kesalahan urutan `@import` menghasilkan
  tema gelap yang salah tanpa error kompilasi. Berkas **tracked dan termodifikasi**.
- Rekomendasi: **prioritas terakhir**. Langkah aman pertama bukan memecah berkas melainkan
  **menambah komentar batas bagian** dan menghapus/tidak menghapus 3 `@utility` tak terpakai
  (`surface-sunken`, `ring-accent`, `float-slow`) sebagai keputusan terpisah dengan uji visual.
  Bila suatu saat dipecah: pertahankan `globals.css` sebagai satu-satunya entrypoint dan
  `@import` sub-berkas **dengan urutan eksplisit**; jangan memindahkan `@theme inline` atau
  `:root`.
- Uji: `npm run build`; bandingkan tangkapan `/`, `/how-it-works`, `/p/<code>/result` pada
  tema terang **dan** gelap serta `prefers-reduced-motion` sebelum/sesudah; hitung kontras
  terendah di kedua tema dan pastikan tidak turun dari baseline T-5.06
  (terang 6,73:1, gelap 8,17:1).

**C-3. `app/p/[code]/tasks/tasks-client.tsx` (1.032 baris) selain B-2**
- Bukti: render 364–990 sudah dibagi 6 blok komentar penulis; 12 `useState` (98–117).
- Rekomendasi: setelah B-2, ekstrak `TaskWorkloadStrip` (991–1.032) sebagai langkah kecil
  berikutnya; blok form/template **jangan** disentuh sebelum itu karena berbagi `draft`,
  `templateDrafts`, `analyzing`.
- Uji: alur tugas penuh + `npm test` (test/api/tasks.test.ts 15 tes) + `tsc`.

### 7.4 Klasifikasi D - wajib dipertahankan

| Path | Alasan wajib dipertahankan |
|---|---|
| `app/page.tsx`, `app/layout.tsx`, `app/how-it-works/page.tsx`, 4 × `app/p/[code]/**/page.tsx` | konvensi route Next; nama = URL |
| 8 × `app/api/**/route.ts` | dipanggil `fetch` lewat URL (6 lokasi client) + 5 berkas test |
| 4 × `app/p/[code]/**/*-client.tsx` | diimpor `page.tsx`; berisi seluruh interaksi |
| `app/globals.css` | `layout.tsx:3`, `next.config.ts`, deteksi sumber Tailwind |
| `app/layout.tsx` | `next/font/google` (4 family) + skrip anti-flash tema + `app-canvas` |
| `components/ui/{primitives,workspace-shell,app-sidebar,theme-toggle}.tsx` | 7/4/1/3 import |
| `components/motion/reveal.tsx` (`DrawRule`, `Floating`, `MaskLine`, `RevealGroup`, `RevealItem`, `RevealOnce`, `ScoreWalkthrough`, `useSectionProgress`) | 6 import, 2 halaman |
| `components/motion/score-bar.tsx` (`LoadMeter`) | `result-client.tsx:29` |
| `components/recommendations/score-breakdown.tsx` (`ScoreBreakdown`) | `result-client.tsx` |
| `lib/scoring/**` (9 berkas) | inti domain; 25/16/9/6 import; dirujuk 5 dokumen |
| `lib/ai/**` (7 berkas) | FR-06/FR-09, NFR-06, AiRun |
| `lib/validation/index.ts` | 6 route + 2 test + 1 client |
| `lib/motion/tokens.ts`, `lib/motion/use-reduced-motion.ts` | 9/10 import |
| `lib/client/events.ts` | FR-16, `result-client.tsx` |
| `lib/constants/task-templates.ts` | route + 2 test + eval |
| `lib/db/project.ts` | 19 import, satu-satunya Supabase accessor server |
| `test/**` (23 test) | satu-satunya pengukur produk |
| `eval/**` (7 script + 5 lib + dataset + results + reports) | Fase 4; **tidak boleh digabung dengan `test/`** |
| `supabase/migrations/001–007` | skema; nama berkas = urutan; **tidak boleh disentuh** |
| `prd.md`, `DESIGN.md`, `AGENTS.md`, `docs/STATUS.md`, `docs/VISUAL-CATALIS.md`, 4 audit T-5.0x, `docs/PHASE_2_ACCEPTANCE.md`, `docs/laporan/**`, `eval/reports/**`, `eval/instruments/**`, `eval/results/**` | dokumentasi + bukti; dirujuk silang |
| `.agents/skills/**` | sumber symlink `.claude/skills/*` (6 symlink akan menggantung bila dihapus) |
| `.claude/skills/*` (6 symlink) | menunjuk `.agents/skills`; satu-satunya jalur pemuatan skill untuk klien Claude |
| `.opencode/skills/**` | dirujuk `eslint.config.mjs:16` + 3 dokumen |
| `.github/workflows/ci.yml` | satu-satunya definisi CI (meskipun belum terpicu) |
| `skills-lock.json` | manifest hash 6 skill antislop |
| `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `eval/vitest.eval.config.ts`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example` | konfigurasi; `package.json`/lockfile **tidak boleh diubah** pada tugas ini |
| `next-env.d.ts`, `tsconfig.tsbuildinfo` | di-gitignore; artefak yang diperlukan `tsc`/`next` |

### 7.5 Klasifikasi E - belum dapat dipastikan

| Path | Alasan tidak dapat dipastikan |
|---|---|
| `agent/skills/**` (15 berkas) | **Tidak ada rujukan path tertulis di repository ini** (`grep -rn "agent/skills"` di luar `agent/` = 0), tetapi `AGENTS.md:9-14` hanya menyebut **nama** skill. Ada tiga kemungkinan yang tidak dapat dibedakan dari repo: (a) artefak duplikat dari alat yang menyalin `.agents/skills` → `agent/skills` dengan frontmatter berbeda; (b) direktori sumber yang dibaca alat lain di luar repo (mis. konfigurasi global di `~/.config`); (c) sisa percobaan. **Tidak boleh dihapus tanpa konfirmasi pemilik.** Direktori ini **untracked** → penghapusan tidak dapat di-rollback. |
| `lib/scoring/index.ts` | Barrel tanpa import masuk, tetapi `export *` adalah konvensi konsumen luar repo (notebook/skrip evaluasi manual). Tidak ada bukti dipakai, tidak ada bukti tidak dipakai. |
| `components/motion/score-bar.tsx` ekspor `ScoreBar` | Berkas dipakai (`LoadMeter`), ekspor `ScoreBar` tidak. Mungkin disiapkan untuk pemakaian yang belum ditulis. |
| `components/recommendations/score-breakdown.tsx` ekspor `useDisclosure` | 0 pemakaian; kemungkinan sisa refactor. |
| `lib/motion/tokens.ts` ekspor `TRANSITION`, `STAGGER` | 0 pemakaian; dipakai `DURATION`, `EASE`, `SCROLL`. |
| `.opencode/skills/**` (7 skill) | Pemakaian tidak dapat dibuktikan dari repo: tidak ada kode produk yang berasal darinya, tetapi direktori ini dirujuk konfigurasi eslint dan 3 dokumen. Menghapus berarti mengubah asumsi tooling di luar repo. |
| `REDESIGN_NOTES.md` | Tidak dirujuk dokumen lain, tetapi memuat catatan proses (keputusan, alternatif yang ditolak) yang tidak ada di tempat lain. |
| `docs/ACCEPTANCE_MATRIX.md`, `docs/IMPLEMENTATION_AUDIT.md` | Tidak dirujuk dokumen lain **dan** isinya bertentangan dengan `docs/STATUS.md`. Mungkin sengaja disimpan sebagai jejak Fase A, mungkin tertinggal. Tidak boleh dihapus tanpa keputusan pemilik. |
| `README.md` (36 baris, boilerplate) | Tidak memuat informasi proyek yang benar (menyebut `app/page.tsx` "you can start editing"), tetapi merupakan entrypoint konvensi. Tidak diusulkan dihapus; diusulkan **ditulis ulang** sebagai tugas terpisah. |
| `public/` 5 SVG | Alasan teknis aman dihapus (A-2), tetapi pemakaian statis di luar repo (mis. PRD/laporan merujuk screenshot) tidak dapat diperiksa. Verifikasi manual 1 menit. |

---

## 8. Struktur target yang direkomendasikan

Usulan, **belum diterapkan**. Tujuannya menghilangkan ambiguitas, bukan menambah lapisan.

```
app/                          # route & konvensi Next - TIDAK berubah namanya
  layout.tsx
  globals.css                 # tetap satu entrypoint CSS (klasifikasi D)
  page.tsx                    # Home + Hero + FloatShell + FormulaPlate
  how-it-works/page.tsx
  p/[code]/
    members/page.tsx  members-client.tsx
    members/[id]/page.tsx  member-profile-client.tsx
    tasks/page.tsx  tasks-client.tsx  task-draft.ts     <- BARU (B-2)
    result/page.tsx  result-client.tsx
  api/**/route.ts             # TIDAK berubah

components/                   # komponen bersama (bukan route)
  ui/            primitives.tsx  app-sidebar.tsx  workspace-shell.tsx  theme-toggle.tsx
  motion/        reveal.tsx  score-bar.tsx
  recommendations/ score-breakdown.tsx
  home/          site-footer.tsx  alur-produk.tsx  komposisi-skor.tsx  section-rail.tsx   <- BARU (B-3)
  result/        workload-summary.tsx                                                    <- BARU (C-1 langkah 1)

lib/
  ai/            analyze-task.ts  ai-run.ts  call-budget.ts  embedding-cache.ts
                 explain.ts  explanation-validator.ts  schemas.ts
  scoring/       assign.ts  constants.ts  explain-local.ts  interaction.ts
                 pipeline.ts  rules.ts  score.ts  types.ts
                 index.ts        # dipertahankan (E), atau dihapus hanya bila pemilik mengonfirmasi
  db/            project.ts      # supabase.ts dihapus hanya di Tahap 2 (A-1)
  motion/        tokens.ts  use-reduced-motion.ts
  client/        events.ts
  constants/     task-templates.ts
  validation/    index.ts

test/                         # TIDAK digabung dengan eval/
  ai/ api/ integration/ scoring/ validation/ + test/{scoring,task-templates}.test.ts

eval/                         # TIDAK digabung dengan test/
  datasets/ lib/ scripts/ instruments/ results/ reports/ README.md vitest.eval.config.ts

docs/                         # struktur tidak berubah
  STATUS.md  VISUAL-CATALIS.md  T-5.0x-*.md  PHASE_2_ACCEPTANCE.md
  ACCEPTANCE_MATRIX.md  IMPLEMENTATION_AUDIT.md
  laporan/  STRUCTURE_AUDIT.md   <- dokumen ini

.agents/skills/               # sumber skill antislop (D)
.claude/skills/               # symlink → .agents/skills (D)
.opencode/skills/             # aset vendor (D/E)
agent/                        # status BELUM DIPUTUSKAN (E) - tidak disentuh
```

Prinsip yang dipegang:
1. **Tidak ada direktori `src/`.** Alias `@/*` → root, dan menambahkan `src/` akan memaksa
   penulisan ulang ≥100 import. Biaya tinggi, manfaat nol.
2. **Tidak ada pemisahan `features/`.** Hanya 4 alur, semuanya sudah terikat route.
3. **`app/` tetap tipis:** `page.tsx` sebagai boundary server, `*-client.tsx` sebagai interaksi.
   Bagian presentasional homepage pindah ke `components/home/`.
4. **`test/` dan `eval/` tetap dua direktori dan dua config**, karena keduanya mengukur hal
   berbeda (produk vs eksperimen) dengan timeout berbeda.
5. **Satu berkas baru per tahap**, supaya setiap tahap dapat di-rollback secara terpisah.

---

## 9. Risiko dan mitigasi

| # | Risiko | Bukti | Dampak | Mitigasi |
|---|---|---|---|---|
| R-1 | **Tidak ada rollback git.** 338 berkas untracked, 16 tracked termodifikasi, HEAD tunggal `9b62e3d`. | `git ls-files \| wc -l` = 33; `git status` | Penghapusan/pemindahan berkas untracked **permanen**. `git checkout` pada `lib/scoring/*` atau `app/page.tsx` menghapus pekerjaan T-5.02…T-5.06. | **Tahap 0 wajib**: `tar` snapshot seluruh repo (kecuali `node_modules`/`.next`) ke luar repo sebelum perubahan apa pun. |
| R-2 | **CI tidak pernah menjalankan tree ini.** Trigger hanya `main`/`master`; branch kerja `redesign/fuelplate-ui` tidak ada di remote. | `.github/workflows/ci.yml:5-7`; `git ls-remote --heads origin` | "CI hijau" tidak dapat diklaim untuk tree ini. Regresi hanya terdeteksi oleh gerbang lokal. | Semua tahap memakai gerbang lokal yang sama (§11) dan hasilnya dicatat di laporan tugas. |
| R-3 | **`next build` tidak ada di CI.** | `ci.yml` tidak punya langkah `build` | Route hilang, `cacheComponents` rusak, atau Tailwind kehilangan sumber **tidak** tertangkap CI. | `npm run build` menjadi bagian wajib gerbang local. |
| R-4 | **Cascade CSS bergantung urutan.** | `globals.css`: `:root` (87) sebelum `:root[data-theme="dark"]` (225); `@theme inline` (18) membaca `:root` | Memecah `globals.css` tanpa urutan `@import` eksplisit menghasilkan tema salah **tanpa** error kompilasi. | `globals.css` **tidak dipindah**; pemecahan hanya setelah semua tahap lain hijau, dengan pembanding tangkapan sebelum/sesudah. |
| R-5 | **Berkas besar adalah berkas tracked+modified.** | `git status`: `M app/page.tsx`, `M app/globals.css` | Kesalahan pada refactor `app/page.tsx` tidak dapat dibatalkan dengan git. | Snapshot Tahap 0; satu komponen per tahap; commit lokal di branch terpisah (bukan push). |
| R-6 | **`eval/` bergantung CWD, bukan lokasi berkas.** | 10 × `writeFileSync(join('eval/results', …))`; 2 × `path.resolve(process.cwd(), '.env.local')` | Memindahkan `eval/` memutus penulisan hasil tanpa error kompilasi. | `eval/` **tidak dipindah**. Bila suatu saat perlu, path harus diubah menjadi berbasis `import.meta.url` lebih dulu, sebagai tugas terpisah. |
| R-7 | **Duplikasi skill tidak dapat diputuskan tanpa pemilik.** | `agent/skills/` identik kecuali frontmatter; 0 rujukan path | Menghapus `agent/skills/` bisa memutus tooling di luar repo; membiarkannya menyimpan 189 KB duplikat. | Klasifikasi **E**. Tidak dihapus. Diusulkan sebagai pertanyaan ke pemilik, bukan tindakan. |
| R-8 | **`.claude/skills` adalah symlink.** | 6 symlink → `.agents/skills/*` | Menghapus `.agents/skills/` membuat 6 symlink menggantung; menghapus `.claude/skills/` menghilangkan pemuatan skill. | Keduanya **D**, tidak disentuh. |
| R-9 | **`.opencode/` dirujuk konfigurasi.** | `eslint.config.mjs:16`, 3 dokumen | Menghapus `.opencode/` membuat entri `globalIgnores` menunjuk path tidak ada (tidak error, tetapi menyesatkan) dan membuat 3 dokumen salah. | **D**. Tidak menyentuh folder; hanya `.pyc` (A-3) yang diusulkan hapus. |
| R-10 | **Dokumen saling merujuk tanpa gerbang otomatis.** | ≥20 rujukan dari `docs/STATUS.md`; 1 dari `app/globals.css:8`; 1 dari `lib/motion/tokens.ts:4` | Memindahkan dokumen memutus rujukan yang tidak diperiksa `tsc`/`eslint`/`vitest`. | **Tidak ada dokumen yang dipindah.** |
| R-11 | **Angka di komentar config sudah basi.** | `vitest.config.ts:15` & `eval/vitest.eval.config.ts:10` = "287 test"; hitungan statis 277; hasil lulus terakhir 299 | Orang dapat menyimpulkan tes hilang padahal penomoran bergeser. | Dicatat sebagai temuan; **tidak** diperbaiki di audit ini (mengubah config dilarang). |
| R-12 | **`AGENTS.md` merujuk PRD Bagian 12 yang tidak ada.** | `AGENTS.md:7`; `prd.md` hanya 9 bagian | Agen berikutnya dapat mencari dokumen yang tidak ada. | Dicatat (sudah dilaporkan T-5.06); perbaikan = tugas terpisah yang menyentuh `AGENTS.md`. |
| R-13 | **Migrasi database tidak punya gerbang otomatis.** | `supabase/migrations/001–007`; 6 untracked | Menyentuh nama/urutan migrasi tidak akan ditangkap tes mana pun. | **Tidak disentuh.** Dicatat hanya sebagai batas. |
| R-14 | **Berkas besar memuat banyak FR.** | `result-client.tsx` mengimplementasikan FR-08…FR-21 | Refactor di sana adalah regresi fitur, bukan regresi tampilan. | Masuk **C**, bukan B; dilakukan terakhir; uji manual matriks wajib. |

---

## 10. Urutan refactoring

Prinsip: **terkecil lebih dulu**, satu tahap = satu cakupan berkas terbatas, setiap tahap punya
risiko/rollback/kriteria lulus, dan **tidak menggabungkan perubahan struktur dengan perubahan
fitur**. Tidak ada tahap yang mengubah `package.json`, lockfile, `.env.local`, migrasi,
route API, domain logic, isi skill, atau struktur database.

### Tahap 0 - Snapshot (prasyarat, bukan refactor)

- **Cakupan:** seluruh repo kecuali `node_modules/`, `.next/`, `.git/`.
- **Aksi:** buat arsip di luar repo, catat `git status --short` dan `git rev-parse HEAD`, salin
  keluaran gerbang baseline.
- **Risiko:** nol (read-only terhadap repo).
- **Rollback:** tidak diperlukan.
- **Kriteria lulus:** arsip dapat dibuka (`tar -tf`), ukuran wajar, dan `git status --short`
  **identik** dengan sebelum tahap ini.

### Tahap 1 - Baseline hijau (verifikasi, bukan refactor)

- **Cakupan:** tidak ada berkas diubah.
- **Aksi:** jalankan §11 baris 1–5 dan simpan keluaran; hitung jumlah tes.
- **Risiko:** nol.
- **Rollback:** tidak diperlukan.
- **Kriteria lulus:** `tsc` 0 error; `eslint` 0 error + 2 warning lama; `npm test` 299 lulus /
  0 gagal / 0 skipped; `npm run build` exit 0 dengan 15 entri rute. Bila salah satu gagal, **berhenti**
  dan laporkan, jangan lanjut ke Tahap 2.

### Tahap 2 - Hapus `lib/db/supabase.ts` (A-1)

- **Cakupan:** 1 berkas (6 baris). Tidak ada berkas lain disentuh.
- **Risiko:** rendah. Berkas untracked, tetapi arsip Tahap 0 menutupinya.
- **Rollback:** `cp` dari arsip Tahap 0.
- **Kriteria lulus:** `npx tsc --noEmit` 0 error; `npm test -- --testTimeout=30000` 299 lulus;
  `npm run build` exit 0; `grep -rn "db/supabase" app components lib test eval` → 0 hasil.

### Tahap 3 - Hapus 5 SVG sisa `create-next-app` (A-2)

- **Cakupan:** `public/*.svg` (5 berkas, 0 baris, tracked di HEAD).
- **Risiko:** sangat rendah; rollback tersedia lewat git.
- **Rollback:** `git checkout -- public/`.
- **Kriteria lulus:** `npm run build` exit 0; `/` dimuat tanpa 404 di network panel.

### Tahap 4 - Hapus `.opencode/**/__pycache__/*.pyc` (A-3)

- **Cakupan:** 3 berkas `.pyc` di dalam satu direktori.
- **Risiko:** sangat rendah; berkas dibuat ulang bila skrip dijalankan.
- **Rollback:** `cp` dari arsip.
- **Kriteria lulus:** `find .opencode -name "*.pyc"` kosong; `npx eslint` tetap 0 error (path
  ini sudah di-`globalIgnores`).

### Tahap 5 - Hapus 4 direktori kosong (B-1)

- **Cakupan:** `components/layout/`, `components/members/`, `components/tasks/`, `lib/utils/`.
- **Risiko:** nol terhadap build (tidak ada import).
- **Rollback:** `mkdir -p` keempat path (direktori kosong tidak memiliki isi untuk dipulihkan).
- **Kriteria lulus:** `find components lib -type d -empty` kosong; `npx tsc --noEmit` 0 error;
  `npm test` 299 lulus.
- **Catatan:** jalankan `git status --short` sebelum dan sesudah; **tidak boleh** ada berkas
  tak terduga yang hilang.

### Tahap 6 - Ekstrak `task-draft.ts` dari `tasks-client.tsx` (B-2)

- **Cakupan:** 1 berkas baru (`app/p/[code]/tasks/task-draft.ts`) + 1 berkas diubah
  (`tasks-client.tsx` kehilangan 6 deklarasi, mendapat 1 import). **Isi tipe tidak berubah.**
- **Risiko:** rendah. Tipe struktural dapat salah petakan tanpa error `tsc` bila definisi
  diubah; karena itu definisi disalin apa adanya.
- **Rollback:** hapus berkas baru; kembalikan `tasks-client.tsx` dari arsip Tahap 0.
- **Kriteria lulus:** `tsc` 0 error; `npm test` 299 lulus dengan **jumlah tes sama**;
  `npm run build` exit 0; alur `/p/<code>/tasks` (tambah, edit, hapus, isi 3 template,
  analisis AI) berjalan dengan 0 error konsol.

### Tahap 7 - Pindahkan `SiteFooter` (B-3, langkah 1 dari 4)

- **Cakupan:** `components/home/site-footer.tsx` (baru) + `app/page.tsx` (1 deklarasi dihapus).
- **Risiko:** sedang; `app/page.tsx` berkas tracked+modified.
- **Rollback:** kembalikan `app/page.tsx` dari arsip; hapus berkas baru.
- **Kriteria lulus:** `tsc`, `npm test`, `npm run build`; `/` pada 390 & 1280 px: footer tampak
  identik (bandingkan tangkapan), 0 error konsol, 0 overflow horizontal.

### Tahap 8 - Pindahkan `AlurProduk` + `STEPS` (B-3, langkah 2)

- **Cakupan:** `components/home/alur-produk.tsx` (baru) + `app/page.tsx`.
- **Risiko:** sedang. Komponen memakai `DrawRule`/`MaskLine`/`useSectionProgress` dan animasi
  scroll; urutan mount berubah.
- **Rollback:** seperti Tahap 7.
- **Kriteria lulus:** seluruh gerbang; di browser: garis penghubung masih menggambar saat scroll,
  nomor langkah masih unveil, reduced-motion tidak menyembunyikan konten.

### Tahap 9 - Pindahkan `KomposisiSkor` + `SCORE_ROWS` (B-3, langkah 3)

- **Cakupan:** `components/home/komposisi-skor.tsx` (baru) + `app/page.tsx`.
- **Risiko:** sedang, idem Tahap 8 (bar bertumbuh dari nilai formula).
- **Rollback:** idem.
- **Kriteria lulus:** gerbang + bar masih tumbuh ke lebar `weight × 2.5` (40/75/50/25) dan
  label persentase tetap 40/30/20/10.

### Tahap 10 - Pindahkan `SectionRail` + `ScrollProgress` + `HOME_SECTIONS` (B-3, langkah 4)

- **Cakupan:** `components/home/section-rail.tsx` (baru) + `app/page.tsx`.
- **Risiko:** **sedang-tinggi** di antara tahap B: keduanya berbagi `useScroll` dan
  `ScrollProgress` berada **di dalam** `<header>` sedangkan `SectionRail` di luar `<main>`.
- **Rollback:** idem.
- **Kriteria lulus:** gerbang + tick aktif berpindah saat scroll; `ScrollProgress` masih 1px di
  bawah navbar; anchor `#atas`/`#cara-kerja`/`#scoring` masih melompat; reduced-motion
  tidak merender progress.

### Tahap 11 - Evaluasi ulang `agent/skills/` (keputusan pemilik, bukan refactor)

- **Cakupan:** tidak ada sampai pemilik menjawab.
- **Aksi:** ajukan bukti §4.1 + pertanyaan: "apakah `agent/skills/` dibaca tooling di luar repo
  ini?" Bila tidak, kandidat A/B; bila ya, **D**.
- **Risiko:** tinggi bila diputuskan tanpa jawaban (untracked → permanen).
- **Rollback:** hanya dari arsip Tahap 0.
- **Kriteria lulus:** ada keputusan tertulis pemilik.

### Tahap 12 - Refactor bertahap berkas besar (C), hanya bila diminta

Urutan di dalam tahap ini tetap "terkecil dulu":
`WorkloadSummary` → hook data-fetch `result-client.tsx` → evaluasi `@utility` tak terpakai
di `globals.css` → (baru) pertimbangkan pemecahan `globals.css` dengan `@import` berurutan →
(baru) pertimbangkan `Instruments`/`Matrix`.
- **Risiko:** tinggi (C-1, C-2). Berkas tracked+modified.
- **Rollback:** per langkah, dari arsip.
- **Kriteria lulus:** gerbang + uji manual matriks (klik sel, slider, kunci, tukar, undo,
  ekspor CSV byte-identik, salin teks, panah keyboard) + pembanding tangkapan tema terang/gelap.

**Aturan lintas tahap:** satu tahap = satu commit lokal (bukan push). Bila satu tahap gagal
kriteria lulus, **revert tahap itu saja** dan jangan lanjut. Tidak ada tahap yang boleh
menggabungkan perbaikan fitur/copy dengan pemindahan berkas.

---

## 11. Perintah validasi dan rollback

### 11.1 Gerbang wajib (jalankan identik sebelum dan sesudah setiap tahap)

```bash
# 0. keadaan awal
git status --short
git rev-parse HEAD

# 1. typecheck
npx tsc --noEmit

# 2. lint (harus 0 error + tepat 2 warning lama di test/api/member-profile.test.ts)
npm run lint

# 3. tes produk (timeout dinaikkan karena satu tes memanggil Gemini live
#    dan satu tes integrasi Supabase paralel; keduanya artefak, bukan regresi)
npm test -- --testTimeout=30000

# 4. build (satu-satunya yang memvalidasi route discovery + Tailwind + cacheComponents)
npm run build

# 5. daftar route (baseline: 15 entri di tabel Route)
#    hasil "npm run build" memuat tabel rute; simpan dan bandingkan
```

### 11.2 Pemeriksaan khusus per temuan

```bash
# A-1: pastikan tidak ada import ke modul yang dihapus
grep -rn "db/supabase" app components lib test eval          # harap: 0

# A-2: pastikan tidak ada rujukan SVG
grep -rn "file.svg\|globe.svg\|next.svg\|vercel.svg\|window.svg" app components lib   # harap: 0

# A-3: pastikan artefak Python hilang
find .opencode -name "*.pyc"                                 # harap: kosong

# B-1: pastikan direktori kosong hilang
find components lib -type d -empty                           # harap: kosong

# B-2/B-3: pastikan tidak ada import yang menggantung setelah pemindahan
npx tsc --noEmit

# C-2: hitung jumlah selektor/utility agar tidak ada yang hilang saat mengelompokkan
grep -c "^@utility" app/globals.css                          # baseline: 12
grep -c "@media" app/globals.css                             # baseline: 8
grep -c "^@keyframes" app/globals.css                        # baseline: 2
```

### 11.3 Uji eval (terpisah, tidak boleh digabung dengan `npm test`)

```bash
# dataset
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/validate_datasets.test.ts
# hard rules R1-R5
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/run_hard_rules.test.ts
# 4 metode pembanding
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/run_methods.test.ts
# ablation, truthfulness, budget/robustness, performance
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/run_ablation.test.ts
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/run_truthfulness.test.ts
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/run_ai_budget.test.ts
npx vitest run --config eval/vitest.eval.config.ts eval/scripts/run_performance.test.ts
```

Catatan: runner di atas **menulis** ke `eval/results/`. Jalankan hanya bila ingin
meregenerasi artefak; bandingkan isi berkas sebelum/sesudah bila refactor menyentuh `lib/scoring/`
(perbandingan byte adalah bukti terkuat bahwa domain logic tidak berubah).

### 11.4 Uji browser (setelah tahap yang menyentuh UI)

```bash
npx next build
(setsid npx next start -p 3123 > /tmp/p3123.log 2>&1 &)
# tunggu sampai 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3123/
```

Periksa, pada 390 px dan 1280 px: `/`, `/how-it-works`, `/p/<code>/members`,
`/p/<code>/members/<id>`, `/p/<code>/tasks`, `/p/<code>/result`, masing-masing tema terang dan
gelap: HTTP 200, 0 error konsol, 0 overflow horizontal, dan elemen kunci masih terlihat.
Hentikan server setelah selesai (`kill` pada PID `next start`, bukan pada proses lain).

### 11.5 Rollback

```bash
# R-a. Rollback berkas yang TRACKED dan berubah
git checkout -- <path>          # bila dan hanya bila perubahan itu milik tahap ini

# R-b. Rollback berkas UNTRACKED (tidak ada di git) -> hanya dari arsip Tahap 0
tar -xf /path/di/luar/repo/t507-snapshot.tar.gz -C . <path>
# atau, bila snapshot dibuat per berkas:
cp /path/di/luar/repo/snapshot/<path> <path>

# R-c. Rollback direktori kosong yang di-rmdir
mkdir -p components/layout components/members components/tasks lib/utils

# R-d. Verifikasi bahwa rollback selesai
git status --short
npx tsc --noEmit
npm test -- --testTimeout=30000
```

Peringatan yang harus dibaca sebelum rollback apa pun:
- `git checkout -- app/page.tsx app/globals.css lib/scoring/*.ts lib/ai/analyze-task.ts
  lib/validation/index.ts` **akan menghapus pekerjaan T-5.02 … T-5.06** pada berkas-berkas itu.
  Jangan jalankan tanpa terlebih dahulu menyimpan isi berkas tersebut.
- `git clean -fd` **dilarang** pada repository ini: ia akan menghapus 338 berkas untracked,
  termasuk seluruh `app/api/`, `app/p/`, `components/`, `docs/`, `eval/`, `test/ai|api|…`, dan
  `supabase/migrations/002–007`.
- Tidak ada commit, push, atau deploy yang dilakukan pada T-5.07.

---

## 12. Kriteria selesai T-5.07

| Kriteria | Status | Bukti |
|---|---|---|
| Seluruh direktori dan berkas penting sudah dipetakan | terpenuhi | §2, §3.3, §3.7, §6.1 |
| Duplikasi skill sudah diverifikasi | terpenuhi | §4.1 (`diff -r` = 6 berkas, 2 baris frontmatter), §4.2 (6 symlink resolve), §4.3 (sha256, 6 pasang) |
| Dependency dan import sudah diperiksa | terpenuhi | §3.1–§3.10 |
| File besar memiliki rekomendasi pemisahan konkret | terpenuhi | §5.1–§5.4 (deklarasi + nomor baris per blok) |
| Risiko pemindahan dan penghapusan dicatat | terpenuhi | §9 (14 risiko dengan bukti) |
| Rencana refactoring memiliki urutan dan rollback | terpenuhi | §10 (Tahap 0–12), §11.5 |
| Tidak ada perubahan implementasi | terpenuhi | hanya `docs/STRUCTURE_AUDIT.md` dibuat |
| Git diff hanya dokumen audit yang diizinkan | terpenuhi | lihat §13 |
| Tidak ada klaim berkas tidak terpakai tanpa bukti | terpenuhi | setiap klaim A disertai perintah grep; sisanya **E** |

## 13. Berkas yang dibuat oleh T-5.07

Satu berkas: `docs/STRUCTURE_AUDIT.md`.

Tidak ada berkas lain yang dibuat, diubah, dipindah, diganti nama, atau dihapus. Tidak ada
`git add`, `git commit`, `git push`, atau deploy. Tidak ada migrasi database yang dijalankan.
`.env.local` tidak dibaca isinya (hanya nama kunci yang diperiksa, nilai diabaikan).
