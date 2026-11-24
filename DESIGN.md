# DESIGN SYSTEM & GUIDELINES (DESIGN.md)

**Status Document:** Draft Specification v0.2
**Target Application:** Pembagi Tugas Kelompok Berbasis Rekomendasi AI
**Visual Style:** Fungsional, padat informatif (dense spreadsheet/workspace), tegas, zero-noise.
**Inspirasi Visual:** [Glide Apps](https://www.glideapps.com/) (pendekatan HYBRID: Marketing untuk halaman awal, Workspace untuk pengelolaan data).

---

## 1. KARAKTER VISUAL & LANDASAN DESAIN

Aplikasi ini menggunakan pendekatan visual hybrid:
- **Halaman Awal (Route `/`):** Mengadaptasi karakter Glide Marketing (Clean typography, hierarki kuat, form sebagai pusat tindakan).
- **Workspace (Route `/p/[code]/*`):** Mengadaptasi karakter Glide App Workspace (Data-first, padat, efisien, navigasi konsisten).

### Anti-Slop / Anti-Generic Guardrails (PRD §12.6)
Secara eksplisit DILARANG:
- Gradient background / glowing background.
- Ikon/efek visual dekoratif AI (sparkles, robot).
- Floating card dengan box-shadow blur berlebihan.
- Skema warna neon dekoratif.
- Modal overlay berlapis.
- Animasi dekoratif berulang.

---

## 2. PALET WARNA & RASIO KONTRAS (WCAG AA)

Sistem mendukung **Light Mode** dan **Dark Mode**. Pasangan warna diuji rasio kontras WCAG AA.

### 2.1 Token Light Mode
| Token Role | Tailwind Class / HEX | Pair Token | Contrast |
|---|---|---|---|
| Background Utama | `bg-white` (`#ffffff`) | Text Primary | 19.8:1 |
| Background Surface | `bg-zinc-100` (`#f4f4f5`) | Text Primary | 17.9:1 |
| Text Utama | `text-zinc-950` (`#09090b`) | Bg Utama | 19.8:1 |
| Text Sekunder | `text-zinc-600` (`#52525b`) | Bg Utama | 7.62:1 |
| Border | `border-zinc-200` (`#e4e4e7`) | Bg Surface | UI Border |
| Focus Ring | `ring-blue-600` (`#2563eb`) | Bg Utama | 5.17:1 |
| Success (K) | Text `#15803d` / Bg `#f0fdf4` | Text vs Bg | 4.53:1 |
| Warning (C) | Text `#a16207` / Bg `#fefce8` | Text vs Bg | 5.11:1 |
| Error | Text `#b91c1c` / Bg `#fef2f2` | Text vs Bg | 5.95:1 |

### 2.2 Token Dark Mode
| Token Role | Tailwind Class / HEX | Pair Token | Contrast |
|---|---|---|---|
| Background Utama | `bg-zinc-950` (`#09090b`) | Text Primary | 18.0:1 |
| Background Surface | `bg-zinc-900` (`#18181b`) | Text Primary | 16.3:1 |
| Text Utama | `text-zinc-100` (`#f4f4f5`) | Bg Utama | 18.0:1 |
| Text Sekunder | `text-zinc-400` (`#a1a1aa`) | Bg Utama | 7.58:1 |
| Border | `border-zinc-800` (`#27272a`) | Bg Surface | UI Border |
| Focus Ring | `ring-blue-400` (`#60a5fa`) | Bg Utama | 9.01:1 |
| Success (K) | Text `#4ade80` / Surf `#14532d` | Text vs Surf | 5.03:1 |
| Warning (C) | Text `#facc15` / Surf `#713f12` | Text vs Surf | 6.47:1 |
| Error | Text `#fca5a5` / Surf `#7f1d1d` | Text vs Surf | 5.93:1 |

---

## 3. TIPOGRAFI & NUMERIK BERTABULASI

### Font Stack
- Primary: `var(--font-geist-sans)` (fallback: `Inter`, `system-ui`, `sans-serif`).
- Monospace / Tabular: `var(--font-geist-mono)` (fallback: `ui-monospace`, `monospace`).

### Skala Ukuran
- Heading 1: `text-2xl font-bold tracking-tight` (24px/32px).
- Heading 2: `text-lg font-semibold` (18px/28px).
- Body: `text-sm font-normal` (14px/20px).
- Small: `text-xs font-medium` (12px/16px).

### Tabular Numerals
Seluruh angka pada matriks, rincian skor, nilai slider, dan ringkasan jam kerja **wajib** menggunakan kelas `font-mono tabular-nums`.

---

## 4. KERAPATAN & RESPONSIVITAS

### Kepadatan per Route
- **Halaman Awal:** Layout lapang, fokus pada form penciptaan proyek.
- **Workspace:** Layout padat, matriks sebagai elemen utama.

### Matriks & Tabel
- **Tinggi Baris:** 40px - 48px.
- **Padding Sel:** `px-3 py-2`.
- **Kolom Min:** Tugas (220px), Anggota (140px), Aksi (100px).
- **Responsive:**
  - Mobile (< 640px): Stacked cards, horizontal scroll tabel rincian.
  - Tablet (640-1023px): `overflow-x-auto` dengan header `sticky`.
  - Desktop (≥ 1024px): Matriks penuh.

---

## 5. TOKEN GERAK, INTERAKSI & SPESIFIKASI PERILAKU (PRD §12.4–12.7)

### 5.1 Token Durasi & Properti
- **Feedback Interaksi (Hover / Focus):** 100–140ms (`opacity`, `transform`).
- **Pembaruan Data Lokal (Slider / Swap / Lock):** 160–240ms (`transform`, `opacity`).
- **Perpindahan Layout / Drag Preview:** 240–320ms (`transform`).
- **Batas Maksimum Umum:** ≤ 400ms (kecuali progres AI kalkulasi).
- **Aturan Teknis:** Wajib tanpa `transition-all`. Hanya properti `transform` dan `opacity` yang dianimasikan. Wajib menghormati `prefers-reduced-motion`.

### 5.2 Spesifikasi Interaksi Matriks & Keyboard (PRD §12.5)
- **Matriks & Panel Rincian:** Hover atau fokus pada sel matriks memunculkan panel lokal berisi rincian K, S, C, M (mini-bars) dalam waktu < 120ms. Aksesibel penuh via keyboard (Tab, panah).
- **Realtime Slider (What-if):** Slider menggeser bobot, memperbarui skor secara instan tanpa memanggil API AI/network. Baris yang berubah disorot dengan highlight transien selama 600ms (`transform` / `opacity`).
- **Drag-and-Drop & Alternatif Keyboard:** Preview drag muncul < 100ms. Alternatif keyboard: Tombol panah untuk navigasi, `Enter` untuk memilih/memindahkan, `L` untuk mengunci (*lock*) tugas, `Ctrl/Cmd+Z` untuk *undo*.
- **Indikator Beban & Batas R2:** Batang visual beban menggunakan `transform: scaleX()`. Jika batas R2 terlampaui, label teks peringatan muncul tegas berwarna merah/kuning sesuai kontras token.
- **Lock State & Status Analisis:** Tugas terkunci menampilkan ikon gembok fungsional dan mencegah pemindahan otomatis. Status analisis tugas per baris ditandai dengan indikator status bersih.
- **Tombol Kalkulasi & Progres:** Menampilkan tahapan progres dengan stagger maksimal 6 item dan jeda antar-item 30ms.

### 5.3 Protokol Pengujian & Anti-Generic Tests (PRD §12.2)
- **CPU Throttling 4x:** Pengujian interaksi slider dan drag matriks wajib mulus tanpa *dropped frames* pada pembatasan CPU 4x.
- **4 Anti-Generic Tests (PRD §12.2):**
  1. *Logo-Cover Test:* Antarmuka langsung menunjukkan fungsi lembar kerja data kelompok, bukan cover pemasaran kosong.
  2. *3-Second Clarity:* Pengguna langsung memahami matriks rekomendasi dan beban kerja dalam 3 detik pertama.
  3. *Data Replacement:* Desain tetap kokoh ketika seluruh nama/tugas diganti dengan data mentah nyata.
  4. *Reduced-Motion Comprehension:* Seluruh informasi tetap dapat dipahami secara instan ketika animasi dimatikan via `prefers-reduced-motion`.

---

## 6. KONDISI UI & STATE MANAGEMENT
- **Empty State:** Panduan langkah eksplisit.
- **Loading State:** Skeleton loading (`animate-pulse`).
- **Error State:** Banner error tegas.
- **Fallback Mode:** Banner kuning/amber: `MODE CADANGAN AKTIF (TANPA AI)`.

---

## 7. PENGALIH TEMA LIGHT / DARK MODE (DISETUJUI)

- **Default Theme:** Ikuti preferensi sistem (`prefers-color-scheme`).
- **Toggle:** Ikon (Matahari / Bulan).
- **Persistensi:** `localStorage` key `theme_preference` (values: `'light' | 'dark' | 'system'`).
