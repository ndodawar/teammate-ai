import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoPlate, Star } from '@/components/ui/primitives';

import {
  DrawRule,
  Floating,
  MaskLine,
  RevealGroup,
  RevealItem,
  ScoreWalkthrough,
  type ScoreTerm,
} from '@/components/motion/reveal';
import { PinnedStory } from '@/components/motion/pinned-story';

export const metadata: Metadata = {
  title: 'Cara Kerja — Teammate AI',
  description:
    'Penjelasan formula skor 0,40K + 0,30S + 0,20C + 0,10M, aturan wajib R1–R5, peran AI, dan mode cadangan.',
};

const RULES = [
  { id: 'R1', title: 'Jam tersedia nol dikeluarkan', body: 'Anggota tanpa sisa kapasitas tidak dipertimbangkan sebagai kandidat penanggung jawab.' },
  { id: 'R2', title: 'Beban maksimal 1,25× ideal', body: 'Penugasan dijaga agar beban anggota tidak melampaui 1,25 kali beban ideal kelompok. Pelanggaran ditandai pada halaman hasil.' },
  { id: 'R3', title: 'Kandidat skill minimal level 3', body: 'Kandidat difilter berdasarkan level skill wajib. Jika tidak ada kandidat yang memenuhi, sistem menampilkan peringatan.' },
  { id: 'R4', title: 'Satu penanggung jawab per tugas', body: 'Setiap tugas memiliki tepat satu penanggung jawab utama, beserta satu anggota alternatif.' },
  { id: 'R5', title: 'Tugas terkunci tetap', body: 'Penugasan yang dikunci pengguna tidak diubah oleh perhitungan berikutnya.' },
];

const COMPONENTS = [
  { k: 'K', name: 'Kemiripan konten', weight: '40%', color: 'var(--k)', source: 'Cosine similarity antara embedding deskripsi tugas dan profil teks anggota.' },
  { k: 'S', name: 'Kecocokan skill', weight: '30%', color: 'var(--s)', source: 'Rata-rata level skill wajib yang dimiliki anggota, dinormalisasi ke 0–1.' },
  { k: 'C', name: 'Sisa kapasitas', weight: '20%', color: 'var(--c)', source: 'Rasio sisa jam anggota setelah dikurangi beban tugas yang sudah diterima.' },
  { k: 'M', name: 'Minat anggota', weight: '10%', color: 'var(--m)', source: 'Tingkat minat anggota pada skill terkait tugas (skala 1–5).' },
];

/*
 * The four terms of the worked example, matching the weights in COMPONENTS and
 * the illustration in the prose below. Values are illustrative only.
 */
const WALK_TERMS: ScoreTerm[] = [
  { code: 'K', weight: '0,40', component: '0,80', product: '0,32', hue: 'var(--k)' },
  { code: 'S', weight: '0,30', component: '0,60', product: '0,18', hue: 'var(--s)' },
  { code: 'C', weight: '0,20', component: '0,50', product: '0,10', hue: 'var(--c)' },
  { code: 'M', weight: '0,10', component: '0,40', product: '0,04', hue: 'var(--m)' },
];

/*
 * The four product stages, as the scrollytelling section walks them.
 *
 * This is the page's own copy restated as data so one array can drive the step
 * list, the pinned stage's items and their `--at` windows. The text is the
 * product's real behaviour (FR-04 … FR-07), not a description invented for the
 * motion. `code` is the stage number the row prints; `body` is what that stage
 * actually does.
 */
const ALUR_STAGES = [
  {
    code: '01',
    title: 'Daftarkan anggota',
    body: 'Satu nama per anggota. Skill, minat, dan kapasitas jam diisi di halaman profil anggota.',
  },
  {
    code: '02',
    title: 'Susun tugas',
    body: 'Pakai template T01–T11 atau tulis tugas manual, lengkap dengan estimasi jam dan skill wajib.',
  },
  {
    code: '03',
    title: 'Analisis teks',
    body: 'Gemini membuat embedding deskripsi tugas dan menulis alasan penilaian. AI tidak memilih anggota.',
  },
  {
    code: '04',
    title: 'Sesuaikan hasil',
    body: 'Geser bobot, kunci penugasan, tukar penanggung jawab, atau undo. Semua dihitung di browser.',
  },
] as const;

/*
 * A slice of the real task catalogue (`lib/constants/task-templates.ts`), used
 * by the scroll-reveal stage to show what "susun tugas" actually produces.
 *
 * These are the product's own template ids and titles, not invented examples.
 * The `meta` column is the template's real position in the catalogue, not an
 * estimate of its effort: `task-templates.ts` carries no hours, because hours
 * are entered per project on the tasks page and are not a property of the
 * template. Printing a made-up estimate here would be fake data.
 */
const ASSEMBLY_ITEMS = [
  { code: 'T01', title: 'Identifikasi Masalah dan Domain', meta: 'template' },
  { code: 'T02', title: 'Pemilihan Pendekatan AI', meta: 'template' },
  { code: 'T03', title: 'Penyusunan Latar Belakang', meta: 'template' },
  { code: 'T04', title: 'Rumusan Masalah dan Tujuan', meta: 'template' },
  { code: 'T06', title: 'Desain Sistem', meta: 'template' },
  { code: 'T09', title: 'Pengembangan Prototipe', meta: 'template' },
] as const;

const AI_POINTS = [
  'Gemini menganalisis deskripsi tugas, membuat embedding, dan menulis alasan penilaian.',
  'AI tidak memilih anggota dan tidak mengubah nilai skor.',
  'Maksimal tiga panggilan Gemini per satu proses rekomendasi.',
  'Perubahan bobot, kunci, penugasan ulang, dan undo dihitung di browser tanpa panggilan AI.',
];

/*
 * Route `/how-it-works` — FR-15. A server component whose only client code is
 * the shared motion primitives (masked lines, the section rule, and the
 * scroll-linked worked example). There is no page state and no data fetching.
 *
 * Visual language (T-5.13): Quiet Luxury Editorial. Bone canvas, white plates,
 * Inter Tight display lines with one Instrument Serif italic accent word in
 * champagne gold, and hairline rules doing the separating that shadows used to
 * do. Gold appears on the star, the accent word, and the single primary action,
 * which keeps it inside the 5% area budget. Numbers stay in Geist Mono with
 * tabular figures so the formula reads as a formula rather than as prose.
 *
 * The page is one long document, so the composition is deliberately not a stack
 * of identical cards: the formula is a full-bleed display line, the rules are a
 * single ruled list, and the worked example is a pinned story.
 */
export default function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col text-ink">
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 py-12 sm:px-8 sm:py-16 lg:px-16">
        {/* Opening */}
        <section className="space-y-4 border-b border-line pb-10">
          {/* The one moving element on this page, and it is decorative: a star
              mark with no hit target, no text, and nothing that depends on it.
              Under reduced motion it renders as a plain span. */}
          <Floating className="w-fit" amplitude={4}>
            <Star className="h-4 w-4" />
          </Floating>
          <p className="flex items-center gap-2">
            <span className="eyebrow">Referensi perhitungan · FR-15</span>
          </p>
          <h1 className="display max-w-[22ch] text-[clamp(2.1rem,4.6vw,3.4rem)] text-ink">
            <MaskLine delay={0.1}>Bagaimana Teammate AI</MaskLine>
            <MaskLine delay={0.2}>menyusun</MaskLine>
            <MaskLine delay={0.3}>
              <span className="accent-word">penugasan</span>
            </MaskLine>
          </h1>
          <MaskLine delay={0.4}>
            <span className="block max-w-[58ch] text-[14px] leading-[1.65] text-muted">
              Skor setiap pasangan tugas–anggota dihitung dari empat komponen berbobot tetap. AI hanya
              membantu membaca teks tugas; keputusan penugasan dihitung secara deterministik dan dapat
              Anda sesuaikan.
            </span>
          </MaskLine>
        </section>

        {/* Formula — the page's display line */}
        <section className="space-y-5 pt-10">
          <h2 className="heading text-[17px] text-ink">
            <MaskLine delay={0}>Formula skor</MaskLine>
          </h2>
          {/* The component hues are calibrated against the bone canvas. The K
              step is the champagne gold at 4.41:1 on --paper, which clears the
              3:1 bar for this large mono display line but not body text, so the
              formula stays at this size and is never shrunk into a paragraph. */}
          <p
            className="glass-panel overflow-x-auto rounded-[var(--radius-card)] px-6 py-6 font-mono text-[15px] font-medium tracking-tight tabular-nums sm:text-[20px]"
            data-numeric
          >
            score = <span style={{ color: 'var(--k)' }}>0,40K</span> +{' '}
            <span style={{ color: 'var(--s)' }}>0,30S</span> +{' '}
            <span style={{ color: 'var(--c)' }}>0,20C</span> +{' '}
            <span style={{ color: 'var(--m)' }}>0,10M</span>
          </p>

          <div className="glass-solid overflow-hidden rounded-[var(--radius-card)]">
            <table className="w-full text-left">
              <caption className="sr-only">Komponen skor dan bobotnya</caption>
              <thead>
                <tr className="border-b border-line bg-mist text-[10.5px] uppercase tracking-[0.1em] text-muted">
                  <th scope="col" className="w-14 px-5 py-2.5 font-medium">Kode</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Komponen</th>
                  <th scope="col" className="w-20 px-5 py-2.5 text-right font-medium">Bobot</th>
                  <th scope="col" className="hidden px-5 py-2.5 font-medium sm:table-cell">
                    Sumber nilai
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPONENTS.map((row) => (
                  <tr
                    key={row.k}
                    className="border-b border-line transition-colors duration-200 last:border-b-0 hover:bg-accent-tint/40"
                  >
                    <td className="px-5 py-3">
                      <span className="font-mono text-[14px] font-medium" style={{ color: row.color }}>
                        {row.k}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[13.5px] font-medium text-ink">{row.name}</td>
                    <td className="px-5 py-3 text-right font-mono text-[12.5px] tabular-nums text-ink" data-numeric>
                      {row.weight}
                    </td>
                    <td className="hidden px-5 py-3 text-[12px] leading-relaxed text-muted sm:table-cell">
                      {row.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Rules */}
        <section className="space-y-5 pt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="heading text-[17px] text-ink">Aturan wajib R1–R5</h2>
            <p className="text-[12px] text-muted">
              Diterapkan setelah skor dihitung, sebelum matriks ditampilkan.
            </p>
          </div>
          <DrawRule />
          <RevealGroup
            as="div"
            className="glass-solid overflow-hidden rounded-[var(--radius-card)]"
          >
            {RULES.map((rule) => (
              <RevealItem
                key={rule.id}
                className="grid grid-cols-[3rem_1fr] gap-4 border-b border-line px-5 py-4 transition-colors duration-200 last:border-b-0 hover:bg-accent-tint/40"
              >
                <dt className="font-mono text-[12.5px] font-medium text-accent">{rule.id}</dt>
                <dd className="space-y-1">
                  <p className="text-[13.5px] font-medium tracking-[-0.01em] text-ink">{rule.title}</p>
                  <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-muted">{rule.body}</p>
                </dd>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* ------------------------------------------------------------------
         * Scrollytelling: the four stages of the product (T-5.17).
         *
         * The task forbids one animation for a whole page, so each stage is a
         * *different kind* of scroll response rather than a different fade:
         *
         *   A  member signup     sticky storytelling  — engine `pin`, cues advance
         *   B  task assembly     scroll reveal        — engine `reveal` + stagger
         *   C  text analysis     layered visual       — engine `parallax`, 3 planes
         *   D  result adjustment progress transition  — engine `--sc-p` drives R1–R5
         *
         * Every stage prints the product's own copy: the four ALUR steps, the
         * real template range T01–T11, the real component weights, and the real
         * R1–R5 text. Nothing here is invented for the animation.
         *
         * The class names are `hiw-*`, never `sc-*`: `sc-*` is the engine's own
         * utility namespace and a plain rule with a class in it could silently
         * override `sc-copy` / `sc-wrap` / `sc-display`.
         * ----------------------------------------------------------------- */}

        {/* A — sticky storytelling. One pinned stage, four beats, the reader's
            scroll advancing through them. This is the only pinned act in the
            page, because two pins in a row is a page that keeps stopping. */}
        <section
          id="alur"
          data-sc-act="pin"
          data-sc-span="3"
          /* The engine annotates every act it mounts over: it adds
             `sc-act--pinned`, writes a px track height and publishes `--sc-p`
             on the element itself. That is correct for the engine and invisible
             to a reader, but React hydrates this element from the server HTML
             and would otherwise warn about attributes it did not render.
             `suppressHydrationWarning` is the documented answer for exactly this
             case — the same one `app/layout.tsx` already uses for the theme
             class the init script sets before paint. It suppresses the warning
             for this element's attributes only; it does not skip hydration of
             its children, so the copy inside is still fully hydrated. */
          suppressHydrationWarning
          className="hiw-world hiw-alur-act pt-14"
        >
          <div data-sc-stage className="sc-stage hiw-alur-stage">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-14">
              <div className="space-y-4 lg:col-span-5">
                <p className="eyebrow">Alur</p>
                <h2 className="heading text-[clamp(1.6rem,2.8vw,2.25rem)] text-ink">
                  Empat tahap, satu <span className="accent-word">penugasan</span>
                </h2>
                <p className="max-w-[44ch] text-[13px] leading-relaxed text-muted">
                  Setiap tahap menyimpan datanya sendiri, jadi Anda bisa berhenti di mana saja dan
                  kembali memakai kode proyek.
                </p>

                {/* The step list is the *progress display*, not the copy: the
                    description of the current step lives in the visual column,
                    which is what gives the pin something to advance. Each row
                    brightens from the act's own progress via `--at`, so it runs
                    backwards correctly and never replays as a trigger. */}
                <ol className="space-y-3 border-t border-line pt-4">
                  {ALUR_STAGES.map((stage, index) => (
                    <li
                      key={stage.code}
                      className="hiw-step-row grid grid-cols-[2.25rem_1fr] items-baseline gap-3"
                      /* Step 01 opens at 0 so the list already reads as started
                         when the pin engages; the last step lands at 0.60, with
                         the whole last quarter of the act left for the plate to
                         finish. A list whose last row only lights as the pin
                         releases is a list the reader never sees complete. */
                      style={{ ['--at' as string]: String(index * 0.2) }}
                    >
                      <span className="font-mono text-[11.5px] tabular-nums text-muted">
                        {stage.code}
                      </span>
                      <span className="text-[13.5px] font-medium text-ink">{stage.title}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="space-y-3 lg:col-span-7">
                <div className="hiw-assembly">
                  <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3">
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
                      Tahap aktif
                    </p>
                    <p className="font-mono text-[10.5px] tabular-nums text-muted">4 tahap</p>
                  </div>
                  {ALUR_STAGES.map((stage, index) => (
                    <div
                      key={stage.code}
                      className="hiw-assembly-item flex gap-4 border-b border-line px-5 py-4 last:border-b-0"
                      /* The plate fills one row per 0.18 of the act, starting at
                         0.04: the first row is present as the stage arrives, and
                         the fourth is fully set at 0.58 — well before the pin
                         releases at 1. The 0.05 opacity window is narrow enough
                         that two rows are never mid-fade on top of each other. */
                      style={{ ['--at' as string]: String(0.04 + index * 0.18) }}
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 font-mono text-[11px] tabular-nums text-accent"
                      >
                        {stage.code}
                      </span>
                      <div className="space-y-1">
                        <p className="text-[13.5px] font-medium text-ink">{stage.title}</p>
                        <p className="text-[12.5px] leading-relaxed text-muted">{stage.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11.5px] leading-relaxed text-muted">
                  AI hanya membaca teks tugas. Pembagian akhirnya tetap dihitung dan diputuskan di
                  browser Anda.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* B — scroll reveal. Where A pins and advances, B is a plain document
            that arrives: the engine's `data-sc-stagger` wipes each item in as it
            enters. A different *kind* of response on purpose. This stage's
            subject is the task list being assembled, so the reveal is what
            builds it, item by item, and it needs no pinned track to do that. */}
        <section className="space-y-5 pt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
            <h2 className="heading text-[17px] text-ink">Tahap 02 · Tugas disusun</h2>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
              Template T01–T11
            </p>
          </div>
          <div className="hiw-assembly" data-sc-stagger>
            {ASSEMBLY_ITEMS.map((item) => (
              <div
                key={item.code}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-5 py-3.5 last:border-b-0"
              >
                <span className="font-mono text-[11px] tabular-nums text-accent">{item.code}</span>
                <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">{item.title}</span>
                <span className="font-mono text-[11px] tabular-nums text-muted">{item.meta}</span>
              </div>
            ))}
          </div>
          <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-muted">
            Skill wajib dan bobot usaha diisi manual di sisi tugas. Estimasi jam menentukan beban
            yang dibandingkan dengan sisa kapasitas setiap anggota, jadi angkanya harus jujur.
          </p>
        </section>

        {/* C — layered visual. Three planes at three rates: the task text lags,
            the embedding field sits in the middle, the four score components
            come forward. This is the only place on the page where depth is the
            device, and the middle plane is decorative (`aria-hidden`): the same
            four letters are printed as text in the formula table above. */}
        <section className="space-y-5 pt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
            <h2 className="heading text-[17px] text-ink">Tahap 03 · Teks dibaca</h2>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
              Embedding + empat komponen
            </p>
          </div>
          <div className="hiw-depth">
            <div
              aria-hidden="true"
              className="hiw-depth-plane hiw-depth-plane--back"
              data-sc-parallax="-0.7"
            >
              <div className="h-full w-full rounded-[var(--radius-card)] bg-[linear-gradient(180deg,var(--mist),transparent_70%)]" />
            </div>
            <div
              aria-hidden="true"
              className="hiw-depth-plane hiw-depth-plane--mid"
              data-sc-parallax="-0.35"
            >
              <div className="mx-auto grid h-full max-w-[30rem] grid-cols-8 gap-1.5 opacity-40">
                {Array.from({ length: 32 }, (_, i) => (
                  <span
                    key={i}
                    className="rounded-sm"
                    style={{
                      backgroundColor:
                        i % 4 === 0 ? 'var(--k)' : i % 4 === 1 ? 'var(--s)' : i % 4 === 2 ? 'var(--c)' : 'var(--m)',
                      opacity: 0.08 + (i % 7) * 0.035,
                    }}
                  />
                ))}
              </div>
            </div>
            {/* The reading layer: two columns, so the quoted task text sits on a
                real measure instead of a ~280px sliver, and the plane field gets
                its own right-hand half rather than floating in dead space. */}
            <div className="relative z-10 grid gap-8 px-1 py-8 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-12">
              <div className="space-y-3 lg:col-span-5">
                <p className="max-w-[34ch] text-[15px] leading-relaxed text-ink">
                  &ldquo;Susun laporan audit aksesibilitas untuk halaman utama.&rdquo;
                </p>
                <div className="flex flex-wrap gap-2">
                  {COMPONENTS.map((row) => (
                    <span
                      key={row.k}
                      className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-[11.5px] shadow-[inset_0_0_0_1px_var(--line)]"
                    >
                      <span className="font-mono font-medium" style={{ color: row.color }}>
                        {row.k}
                      </span>
                      <span className="text-muted">{row.weight}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-muted">
            Teks tugas diubah menjadi embedding, lalu dibandingkan dengan profil teks setiap
            anggota. Empat komponen di bawah ini yang kemudian dihitung menjadi skor 0,00–1,00.
          </p>
        </section>

        {/* D — progress-linked transition. The five hard rules are printed in
            reading order; each row's *explanation* and its marker draw
            themselves as the reader passes that row. The rule text never hides,
            because a rule legible at only one scroll position is a rule the
            reader can miss. This is the fourth distinct device: not a pin, not
            an entrance, not depth — the act's own progress driving a line. */}
        <section
          id="aturan-alur"
          data-sc-act="flow"
          suppressHydrationWarning
          className="hiw-world hiw-rules-act space-y-5 pt-16"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
            <h2 className="heading text-[17px] text-ink">Tahap 04 · Hasil disesuaikan</h2>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
              R1–R5 · setelah skor
            </p>
          </div>
          <ol className="glass-solid overflow-hidden rounded-[var(--radius-card)]">
            {RULES.map((rule, index) => (
              <li
                key={rule.id}
                className="relative border-b border-line px-5 py-4 last:border-b-0"
                style={{
                  ['--at' as string]: String(index / RULES.length),
                  ['--next' as string]: String((index + 1) / RULES.length),
                }}
              >
                {/* The marker is drawn by the act's progress, so the reader can
                    see how far through the rule set they are without a second
                    progress bar anywhere on the page. */}
                <span
                  aria-hidden="true"
                  className="hiw-rule-mark absolute inset-y-0 left-0 w-px bg-accent"
                  style={{
                    ['--at' as string]: String(index / RULES.length),
                  }}
                />
                <div className="flex gap-4">
                  <span className="font-mono text-[12.5px] font-medium text-accent">{rule.id}</span>
                  <div className="space-y-1">
                    <p className="text-[13.5px] font-medium tracking-[-0.01em] text-ink">
                      {rule.title}
                    </p>
                    <p className="hiw-rule-why max-w-[62ch] text-[12.5px] leading-relaxed text-muted">
                      {rule.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4 pt-12">
          <h2 className="heading text-[17px] text-ink">Peran AI dan batasnya</h2>
          <RevealGroup
            as="ul"
            className="glass-solid space-y-3 rounded-[var(--radius-card)] px-6 py-5"
          >
            {AI_POINTS.map((point) => (
              <RevealItem key={point} as="li" className="flex gap-3 text-[13px] leading-relaxed text-ink">
                <Star className="mt-[5px] h-2.5 w-2.5 shrink-0" />
                <span>{point}</span>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* Fallback */}
        <section className="space-y-4 pt-12">
          <h2 className="heading text-[17px] text-ink">Mode cadangan</h2>
          <p className="max-w-[68ch] text-[13px] leading-relaxed text-muted">
            Jika layanan AI gagal atau dibatasi, komponen K tidak dapat dihitung. Aplikasi beralih ke
            mode cadangan dengan bobot{' '}
            <span className="font-mono tabular-nums text-ink" data-numeric>
              S 0,50 · C 0,33 · M 0,17
            </span>
            , dan menampilkan penanda
            <span className="mx-1.5 inline-flex items-center rounded-full bg-warn-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-warn shadow-[inset_0_0_0_1px_var(--warn)]">
              mode cadangan
            </span>
            pada halaman hasil. Slider K dinonaktifkan pada mode ini.
          </p>
        </section>

        {/* Worked example, as a pinned story (T-5.10-REDESIGN).
            The four terms used to tighten in place as the reader scrolled. Now
            the sum is pinned and walked one term at a time, which is the order
            the arithmetic actually happens in. Every value shown is the real
            term from COMPONENTS: the weight is the formula's own 0,40 / 0,30 /
            0,20 / 0,10, and the component value is the illustrative pair the
            prose above already states. Nothing is hidden: the full sum is
            printed below the section, and on mobile every step is a plain list. */}
        <section className="space-y-4 pt-12">
          <h2 className="heading text-[17px] text-ink">Contoh perhitungan</h2>
          <p className="text-[13px] leading-relaxed text-muted">
            Untuk satu pasangan tugas–anggota dengan K = 0,80 · S = 0,60 · C = 0,50 · M = 0,40.
            Gulir untuk mengikuti tiap suku sampai totalnya.
          </p>

          <PinnedStory
            id="perhitungan"
            eyebrow="Contoh perhitungan"
            heading={
              <>
                Empat suku, satu <span className="accent-word">skor</span>
              </>
            }
            lede="Setiap komponen dikalikan bobotnya, lalu dijumlahkan. Urutannya tetap: K, S, C, M."
            steps={[
              {
                label: 'K · Kemiripan konten',
                title: 'Kemiripan konten, bobot 0,40',
                body: 'Cosine similarity antara embedding tugas dan profil teks anggota. Nilai contoh 0,80, jadi suku ini menyumbang 0,32.',
              },
              {
                label: 'S · Kecocokan skill',
                title: 'Kecocokan skill, bobot 0,30',
                body: 'Rata-rata level skill wajib yang dimiliki anggota. Nilai contoh 0,60, jadi suku ini menyumbang 0,18.',
              },
              {
                label: 'C · Sisa kapasitas',
                title: 'Sisa kapasitas, bobot 0,20',
                body: 'Rasio sisa jam setelah beban yang sudah diterima. Nilai contoh 0,50, jadi suku ini menyumbang 0,10.',
              },
              {
                label: 'M · Minat anggota',
                title: 'Minat anggota, bobot 0,10',
                body: 'Tingkat minat pada skill terkait tugas. Nilai contoh 0,40, jadi suku ini menyumbang 0,04.',
              },
            ]}
            visual={{
              label: 'Perhitungan',
              aside: 'score = Σ bobot × nilai',
              rows: COMPONENTS.map((row, index) => ({
                code: row.k,
                label: row.name,
                meta: `${WALK_TERMS[index].weight} × ${WALK_TERMS[index].component}`,
                value: WALK_TERMS[index].product,
                hue: row.color,
              })),
              total: {
                label: 'Total skor',
                value: `Σ ${WALK_TERMS.map((term) => term.product).join(' + ')} = 0,64`,
              },
            }}
            visualLabel="Empat suku skor K, S, C, dan M beserta bobot dan hasil kalinya, dengan suku aktif ditandai."
          />

          <ScoreWalkthrough terms={WALK_TERMS} total="0,64" />
          <p
            className="glass-solid overflow-x-auto rounded-[var(--radius-card)] px-5 py-4 font-mono text-[12px] leading-loose tabular-nums sm:text-[13px]"
            data-numeric
          >
            0,40×0,80 + 0,30×0,60 + 0,20×0,50 + 0,10×0,40
            <br />
            = 0,32 + 0,18 + 0,10 + 0,04 ={' '}
            <strong className="font-medium text-accent-strong">0,64</strong>
          </p>
          <p className="max-w-[68ch] text-[11.5px] leading-relaxed text-muted">
            Angka di atas adalah ilustrasi nilai komponen, bukan hasil dari proyek tertentu. Nilai
            sebenarnya selalu ditampilkan pada halaman Matriks Rekomendasi untuk proyek Anda.
          </p>
        </section>

        <div className="mt-12 border-t border-line pt-8">
          {/* The single gold fill on the page. Hover darkens the FILL rather than
              reducing its alpha: at 88% the white label fell to 3.9:1 over the
              bone canvas, which failed. A solid ink shift keeps the label at
              4.77:1 and still reads as a press. */}
          <Link
            href="/"
            className="group inline-flex h-11 items-center gap-2 rounded-full bg-accent-strong px-6 text-[14px] font-medium text-accent-ink transition-colors duration-[200ms] ease-[var(--ease-hover)] hover:bg-ink"
          >
            Buat proyek
            <span
              aria-hidden="true"
              className="transition-transform duration-[150ms] ease-[var(--ease-nudge)] group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-3 px-6 py-6 sm:px-8 lg:px-16">
          <div className="flex items-center gap-2.5">
            <LogoPlate size={24} />
            <p className="text-[12.5px] text-muted">Teammate AI, pembagi tugas kelompok berbasis rekomendasi.</p>
          </div>
          <p className="font-mono text-[12px] tabular-nums text-muted" data-numeric>
            0,40K + 0,30S + 0,20C + 0,10M
          </p>
        </div>
      </footer>
    </div>
  );
}
