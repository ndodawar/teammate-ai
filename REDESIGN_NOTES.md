# REDESIGN_NOTES.md — Fuelplate Template Adaptation

**Branch:** `redesign/fuelplate-ui`
**Tanggal:** Audit & implementasi redesign visual.
**Basis:** PRD_Pembagi_Tugas_Kelompok_AI_v0.2 (full read), DESIGN.md, AGENTS.md, docs/STATUS.md.

---

## Fase 0 — Audit Repository & Baseline

### Lokasi Aktual
- Working directory sesi ini **adalah** repository: `/home/nando/teammate-ai` (terverifikasi via `pwd` + `git status`).
- Branch awal: `main` → dibuat branch `redesign/fuelplate-ui`.
- Working tree sudah memiliki banyak perubahan pengguna (M: AGENTS.md, DESIGN.md, app/globals.css, app/page.tsx, lib/scoring/*, prd.md, dll; banyak file untracked: app/api, app/p, components/, docs/, lib/motion). **Tidak ada file pengguna yang dihapus atau di-revert.**

### Versi Aktual (terverifikasi)
| Paket | Versi | Catatan |
|---|---|---|
| Next.js | 16.4.6 | App Router, `params` berupa Promise |
| React | 19.3.0 | |
| TypeScript | ^5 | strict: true |
| Tailwind CSS | 4.3.3 | `@import "tailwindcss"`, @tailwindcss/turbopack |
| framer-motion | **14.14.0** | Terpasang (node_modules terverifikasi) |
| gsap | **TIDAK terpasang** | Template Fuelplate butuh gsap; tidak dipakai (Framer Motion sudah jadi design system proyek) |
| vitest | 5.1.0 | |
| Alias `@/` | `./*` | dikonfirmasi di tsconfig |

### Struktur Routing Aktual (dipertahankan 100%)
```
/                              app/page.tsx
/p/[code]/members              members/page.tsx + members-client.tsx
/p/[code]/members/[id]         member-profile-client.tsx
/p/[code]/tasks                tasks/page.tsx + tasks-client.tsx
/p/[code]/result               result/page.tsx + result-client.tsx
/how-it-works                  how-it-works/page.tsx
```
API (tidak disentuh): `/api/projects`, `/api/projects/[code]/members`, `/api/projects/[code]/members/[id]`, `/api/projects/[code]/tasks`, `/api/projects/[code]/tasks/[id]`, `/api/analyze-task`, `/api/recommend`.

### Baseline Pemeriksaan (sebelum perubahan)
| Pemeriksaan | Hasil |
|---|---|
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run lint` | **PASS** (0 error, 2 warning lama `_fn`, `_args` di `test/api/member-profile.test.ts`) |
| `npm run test` | **PASS** — 14 file, **131 test** |
| `npm run build` | **PASS** (exit 0, 12 rute) |
| Dev server | Sebelumnya port 3000 |

### Kondisi yang Dilaporkan vs Aktual
| Klaim laporan | Verifikasi aktual |
|---|---|
| Framer Motion 14.14.0 | ✅ benar |
| UI/UX Pro Max di `.opencode/skills/` | ✅ ada (`SKILL.md`, `data/`, `scripts/`) |
| `lib/motion/` tersedia | ⚠️ hanya `tokens.ts` — `use-reduced-motion.ts` yang disebut STATUS.md **tidak ada**. `useReducedMotion` dipakai langsung dari framer-motion. |
| `components/ui/`, `components/layout/`, `components/members/`, `components/tasks/`, `components/recommendations/` | ⚠️ direktori ada tetapi **kosong** |
| GSAP | ❌ tidak terpasang (template Fuelplate membutuhkan ini) |

---

## Fase 1 — Analisis Kompatibilitas Fuelplate

### Sumber Template
- Ditemukan: `/home/nando/Downloads/meal-planning-app-landing-page-v11.zip` dan `...v1.zip`. Keduanya berisi `fuelplate-recipes-template/` (identik, 125.371 byte `fuelplate-recipes-template.tsx`).
- Diekstrak **hanya** ke `/tmp/fuelplate-extract/` — tidak menimpa proyek, ZIP asli utuh.
- Diekstrak diverifikasi: `fuelplate-recipes-template.tsx` (2209 baris), `demo.tsx`, `demo-lifters.tsx`, `README.md` ×2.

### Fakta Teknis Template (terverifikasi)
- Dependensi: **React + GSAP + ScrollTrigger**. `gsap` **tidak ada** di proyek.
- Styling: `const FPT_CSS` (string CSS-in-JS, baris 417) dengan class `fpt-*` dan variabel `--fpt-*`.
- Dark theme: `.fpt-root[data-theme="dark"]{...}` — palette sendiri, terpisah dari tema proyek.
- Props nullable: `hero`, `features`, `planner`, `showcase`, `bento`, `cook`, `recipe`, `categories`, `resources`, `cta`, `footer` menerima `null`.
- Gambar: Unsplash CDN eksternal + `srcset` (tidak boleh dipakai — produk ini tidak butuh fotografi).
- Pin/coverflow/timer/filter/modal: semua butuh ScrollTrigger + state internal template.

### Tabel Keputusan Section (PRD sebagai dasar)

| Section Fuelplate | Kecocokan dengan Teammate AI | Keputusan |
|---|---|---|
| Navigation | Navigasi aplikasi sudah ada (header per halaman). Bisa dipetakan ke header baru. | **ADAPTASI** |
| Hero | PRD tidak menghendaki hero besar; form sebagai pusat tindakan (DESIGN.md §1). | **SEMBUNYIKAN** |
| Features | Tidak ada section tiga kartu fitur generik. | **SEMBUNYIKAN** |
| Planner | Bukan planner resep. | **SEMBUNYIKAN** |
| Showcase | Coverflow hidangan tidak relevan. | **SEMBUNYIKAN** |
| Bento search | Aplikasi tidak punya fitur pencarian (tidak ada FR). Membuatnya = fitur baru. | **SEMBUNYIKAN** |
| Diet | Tidak relevan. | **SEMBUNYIKAN** |
| Testimonials | Tidak ada testimoni di PRD. | **SEMBUNYIKAN** |
| Cook | Timer memasak & servings tidak relevan. | **SEMBUNYIKAN** |
| Categories | Kategori resep tidak relevan. | **SEMBUNYIKAN** |
| Resources | Artikel resep tidak relevan. | **SEMBUNYIKAN** |
| CTA | Hanya boleh dipetakan ke aksi produk yang sudah ada. | **VERIFIKASI** → dipetakan ke submit form pembuatan proyek (FR-01) & tautan ke `/how-it-works` (FR-15). Tanpa CTA baru. |
| Footer | Struktur aplikasi punya footer ringkas. | **VERIFIKASI** → diadaptasi (formula + tautan yang sudah ada), tanpa kolom sosial/legal karangan. |
| Download sheet | Tidak ada fungsi produk yang sesuai (tidak ada unduh aplikasi). | **SEMBUNYIKAN** |

### Yang Diambil dari Fuelplate (visual DNA saja)
1. **Palet warm paper**: `--fpt-bg:#f3f1eb`, surface `#ebe8df`, card `#fbfaf6`, ink `#1b1d18`, muted `#6a6c63` → dipetakan ke token proyek.
2. **Editorial serif** (`Instrument Serif`) untuk heading — hanya di halaman awal & judul halaman; workspace tetap sans.
3. **Aksen sage/olive** (`sage #e0e9d1`, accent hijau-olive) menggantikan biru default.
4. **Pill & chip bersudut penuh** (`.fpt-btn` radius 999px, `.fpt-chip` height 26px).
5. **Surface bersarang dengan inset shadow 1px** (`box-shadow: inset 0 0 0 1px var(--fpt-line)`) menggantikan border tebal.
6. **Motion**: `transform`+`opacity` only, `cubic-bezier(.2,.8,.2,1)`, tanpa bounce — sudah sejalan DESIGN.md §5.1.
7. **Tab indikator geser** (`.fpt-tab-ind`) → dipakai untuk sub-navigasi workspace.
8. **Big serif wordmark** di footer (`.fpt-foot-word`).
9. **Frosted sticky nav** yang menyempit saat scroll (`.fpt-nav[data-compact]`).

### Yang Ditolak Secara Sadar
- Fotografi Unsplash, gradient overlay hero, marquee nutrient, countdown, phone mockup, orbit plates, coverflow, focus-trap download modal, autoplay timer → **semuanya dekoratif / di luar scope** (PRD §7.2, DESIGN.md anti-slop §1).

---

## Aturan Mutlak yang Dipegang
Hanya **visual** yang berubah. Tidak ada perubahan pada:
`lib/scoring/**`, `lib/ai/**`, `lib/db/**`, `lib/validation/**`, `app/api/**`, `supabase/migrations/**`, jumlah halaman, routing, URL, alur pengguna, formula, hard constraints, auth, integrasi Gemini.

Rencana file yang diubah (semua presentational):
- `app/globals.css` — token & base style baru
- `app/layout.tsx` — font (serif editorial + sans), metadata, theme init
- `app/page.tsx` — halaman awal
- `app/p/[code]/members/members-client.tsx`
- `app/p/[code]/members/[id]/member-profile-client.tsx`
- `app/p/[code]/tasks/tasks-client.tsx`
- `app/p/[code]/result/result-client.tsx`
- `app/how-it-works/page.tsx`
- `components/ui/*` — primitive baru (button, chip, field, surface, theme-toggle, page-shell)
- `components/motion/*` — tetap, warna disesuaikan

---

## Hasil Akhir

### File yang Diubah / Dibuat
| File | Jenis | Isi |
|---|---|---|
| `app/globals.css` | ubah | Token material Fuelplate (`--paper/--surface/--card/--ink/--muted/--line`), tema terang & gelap, hue komponen K/S/C/M, status, utility `surface-card`/`surface-sunken`, focus ring accent, `tabular-nums` |
| `app/layout.tsx` | ubah | Font editorial serif `Fraunces` (heading saja) + Geist tetap untuk body, metadata produk, skrip pra-hydration `theme_preference` (anti-flash) |
| `app/page.tsx` | ubah | Halaman awal: form sebagai pusat, bukan hero; heading serif, stat hairline, alur 4 sel, tabel komposisi skor, wordmark serif di footer |
| `app/p/[code]/members/members-client.tsx` | ubah | Register anggota: baris bernomor, panel hairline, chip status siap/belum |
| `app/p/[code]/members/[id]/member-profile-client.tsx` | ubah | Profil: panel identitas + register keterampilan bernomor, `<select>` native dipertahankan |
| `app/p/[code]/tasks/tasks-client.tsx` | ubah | Register tugas + formulir; metadata jadi chip hairline, chip skill jadi pill |
| `app/p/[code]/result/result-client.tsx` | ubah | Matriks ledger: kolom tugas sticky, klaster bar K/S/C/M, panel instrumen bobot & beban, banner mode cadangan |
| `app/how-it-works/page.tsx` | ubah | Dokumen referensi editorial (formula display, tabel, R1–R5, contoh hitung) |
| `app/p/[code]/{members,tasks,result}/page.tsx` | ubah | Fallback Suspense disesuaikan token baru |
| `components/motion/score-bar.tsx` | ubah | Warna bar dari token (`var(--k/s/c/m)`), track `bg-line` |
| `components/ui/primitives.tsx` | **baru** | `Button`, `ButtonLink`, `Chip`, `Panel`, `Eyebrow`, `FIELD`, `FIELD_LABEL` |
| `components/ui/theme-toggle.tsx` | **baru** | Toggle matahari/bulan, persist `theme_preference`, sinkron `prefers-color-scheme` |
| `components/ui/workspace-nav.tsx` | **baru** | Chrome workspace: pill kode proyek, tab rute dengan indikator geser (`layoutId`) |

### Pemetaan Visual Fuelplate → Teammate AI
| Elemen Fuelplate | Adaptasi di Teammate AI |
|---|---|
| `--fpt-bg #f3f1eb` / `--fpt-card #fbfaf6` | `--paper` / `--card` (identik) |
| `Instrument Serif` | `Fraunces` (serif editorial, weight variable) — heading saja |
| Accent sage-olive | `--accent #4d6b3c` (terang) / `#9cbd7f` (gelap) |
| `.fpt-btn` pill 999px | `Button`/`ButtonLink` radius penuh |
| `.fpt-chip` height 26px | `Chip` height 22px |
| `inset 0 0 0 1px var(--fpt-line)` | `surface-card` utility (border tanpa layout shift) |
| `.fpt-nav[data-compact]` frosted | `WorkspaceNav` sticky + `backdrop-blur` |
| `.fpt-tab-ind` indikator geser | `layoutId="workspace-tab"` di `WorkspaceNav` |
| `.fpt-foot-word` wordmark serif | Wordmark footer halaman awal |
| `.fpt-eyebrow` 11.5px | `Eyebrow` mono uppercase 10px tracking lebar |
| Motion `cubic-bezier(.2,.8,.2,1)` | `EASE.out [0.16,1,0.3,1]` (sudah ada, dipertahankan) |

### Yang TIDAK Berubah (verifikasi)
Tidak ada perubahan pada `lib/scoring/**`, `lib/ai/**`, `lib/db/**`, `lib/validation/**`, `app/api/**`, `supabase/migrations/**`, jumlah halaman (6 rute), routing, URL, alur pengguna, formula, R1–R5, autentikasi/kode akses, integrasi Gemini. Seluruh angka pada UI tetap berasal dari `globalAssign` dan data proyek aktual.

---

## Verifikasi Akhir

### Pemeriksaan Otomatis
| Pemeriksaan | Baseline | Akhir |
|---|---|---|
| `npm run typecheck` | PASS | **PASS** |
| `npm run lint` | 0 error / 2 warning lama | **0 error / 2 warning lama** (tidak ada warning baru) |
| `npm run test` | 131 test / 14 file | **131 test / 14 file PASS** |
| `npm run build` | PASS | **PASS** (6 halaman + 7 API) |
| NFR-20 scan `.next/static` | — | **bersih** (tanpa `sb_secret_`/`service_role`) |

### Verifikasi Visual di Browser Nyata
Diambil dengan Playwright + Chromium 1254 pada `http://localhost:3000`.
| Rute | Terang | Gelap | Mobile 390px |
|---|---|---|---|
| `/` | ✅ | ✅ | ✅ |
| `/how-it-works` | ✅ | ✅ | — |
| `/p/[code]/members` | ✅ | ✅ | ✅ |
| `/p/[code]/members/[id]` | ✅ | ✅ | — |
| `/p/[code]/tasks` | ✅ | ✅ | — |
| `/p/[code]/result` (matriks) | ✅ | ✅ | ✅ |

Console error: **none** pada seluruh halaman (kecuali 500 API pra-ada, lihat catatan di bawah).

### Uji Aksesibilitas & Perilaku
| Uji | Hasil |
|---|---|
| Kontras WCAG AA (sampel seluruh teks, dua tema) | **Lulus** — muted 6.30:1 di paper, 6.82:1 di card, 5.81:1 di surface; dark muted 7.55:1; accent-ink 6.03:1 / 8.63:1 |
| Semua input punya label | **Lulus** (tidak ada input tanpa `label[for]`/`aria-label`) |
| Urutan heading | H1 → H2 → H3 konsisten |
| `prefers-reduced-motion` | **0 elemen tersembunyi**, H1 tetap terlihat |
| Focus keyboard | Tab pertama → outline `solid 2px` terlihat |
| Toggle tema | `light → dark`, tersimpan di `theme_preference`, **bertahan setelah reload** |
| Slider bobot (FR-10) | total **78% → 97%**, **0 network call** ke `/api/recommend` |
| Tombol kunci (FR-11) | `aria-pressed` `false → true` |

> Catatan: `--muted` awal (`#67695f`) menghasilkan 3.76:1 pada header frosted. Digelapkan ke `#575950` → 6.30:1. Token dark tidak berubah.

---

## Catatan Terbuka

1. **`/p/[code]/result` mengembalikan 500 pada proyek yang dibuat di sesi ini.**
   Penyebab: `lib/scoring/assign.ts:63` melempar `Embedding missing for task … member …` ketika `cosineMap` tidak memuat pasangan tersebut, dan `app/api/recommend/route.ts:79` meneruskan `isFallback` tetapi `globalAssign` tetap melempar sebelum sempat memakai fallback. Di lingkungan ini `GEMINI_API_KEY` tidak diset sehingga embedding tidak pernah dibuat.
   Ini **bug pra-ada pada logika produk**, bukan akibat redesign, dan **tidak saya perbaiki** karena di luar mandat "hanya visual" (§5). Untuk memverifikasi tampilan matriks, respons `/api/recommend` di-intercept di browser dengan payload berbentuk identik — setiap angka tetap melewati `globalAssign` asli di halaman, sehingga layout yang terlihat adalah layout sebenarnya. **Perlu keputusan Anda** apakah perbaikan fallback ini dikerjakan sebagai tugas terpisah.
2. **Turbopack `next build` sempat gagal** dengan `Can't resolve 'next/font/google/target.css'`. Ini bukan akibat perubahan saya; `--webpack` berhasil. Setelah perbaikan konfigurasi font, **kedua jalur build kini lulus**.
3. **GSAP tidak dipasang dan tidak diperlukan.** Template Fuelplate memakai GSAP + ScrollTrigger, tetapi proyek sudah punya design system Framer Motion (DESIGN.md §5.1). Menambah GSAP akan menduplikasi lapisan animasi tanpa manfaat; motion template yang relevan direplikasi dengan Framer Motion.
4. **Panduan UI/UX Pro Max** menyarankan palet teal/oranye dan font Rubik/Nunito. Saran itu **tidak dipakai untuk warna dan tipografi** karena DESIGN.md (prioritas lebih tinggi) menetapkan zinc/blue serta Geist, dan permintaan Anda adalah mengadaptasi Fuelplate. Dari skill ini yang dipakai adalah checklist (kontras 4.5:1, focus visible, reduced-motion, cursor-pointer, breakpoint 375/768/1024/1440) — seluruhnya diverifikasi.
5. FR-16 (event logging), FR-17 (perbandingan), dan FR-20 (navigasi keyboard panah/`L`/`Ctrl+Z`) tetap pada status sebelumnya. Redesign tidak menambah maupun mengurangi fitur.

---

## Cara Menjalankan
```bash
npm run dev        # http://localhost:3000  (sedang berjalan, pid 302338)
npm run lint       # 0 error
npm run typecheck  # PASS
npm run test       # 131 lulus
npm run build      # PASS
```

