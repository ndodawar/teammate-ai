'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import {
  DrawRule,
  Floating,
  MaskLine,
  RevealGroup,
  RevealItem,
  RevealOnce,
  useSectionProgress,
} from '@/components/motion/reveal';
import { Reveal } from '@/components/motion/scroll-reveal';
import { DURATION, EASE, SCROLL } from '@/lib/motion/tokens';
import { PinnedStory } from '@/components/motion/pinned-story';
import {
  ButtonLink,
  DateField,
  FIELD,
  FIELD_LABEL,
  LogoPlate,
  SectionMark,
  Star,
} from '@/components/ui/primitives';

/*
 * Route `/` — project creation (FR-01) plus the explanatory sections that were
 * already on this page.
 *
 * Visual language: Catalis. White canvas, Mist bands, Inter Tight display lines
 * with a single Instrument Serif italic accent word, azure used only for the
 * star motif, the accent word, the primary action and the focus ring.
 *
 * Motion language (T-3.MOTION-REDESIGN): the hero arrives as one choreographed
 * sequence — star, eyebrow, three masked headline lines, description, formula
 * plate, limits, then the form — and the page below it is scroll-driven:
 *  - "Alur Produk" is a storytelling rail whose connecting line draws itself as
 *    the section passes, with each step's number unveiling from its own mask.
 *  - "Komposisi Skor" stages its labels, then grows each bar from the value the
 *    formula actually uses.
 *  - The footer closes with an upward reveal and a drawing rule.
 *
 * Functional scope is unchanged: one POST to /api/projects, the same client-side
 * validation, the same success block, the same links.
 */

/*
 * The page's tonal sequence (T-5.04). Before this, every band was the same
 * white, so scrolling never changed the field the reader was looking at and the
 * page read as one long sheet. Each section now owns a depth: the hero sits on
 * the canvas, `Alur Produk` is a recessed tint, `Komposisi Skor` sits on an
 * open band, and the footer closes on a deeper plate. The tones are the app's
 * own `--mist` family, never a new colour, and they are painted as background
 * only, so no layout moves.
 */
const SECTION_TONE = {
  recessed: 'band-recessed',
  open: 'band-open',
  deeper: 'band-deeper',
} as const;

/*
 * The bar width is `weight * 2.5` because the rail is 2.5× the largest weight
 * (40 → 100%). The percentage shown next to it is the formula's own weight, not
 * a rounded decoration: 40% of K, 30% of S, 20% of C, 10% of M.
 */
const SCORE_ROWS = [
  { k: 'K', w: '40%', t: 'Kemiripan konten', d: 'Cosine similarity antara embedding tugas dan profil anggota.', color: 'var(--k)', width: 40 },
  { k: 'S', w: '30%', t: 'Kecocokan skill', d: 'Rata-rata level skill wajib yang dimiliki anggota (skala 1–5).', color: 'var(--s)', width: 30 },
  { k: 'C', w: '20%', t: 'Sisa kapasitas', d: 'Rasio jam tersedia setelah beban tugas yang sudah diterima.', color: 'var(--c)', width: 20 },
  { k: 'M', w: '10%', t: 'Minat anggota', d: 'Preferensi anggota terhadap jenis pekerjaan terkait.', color: 'var(--m)', width: 10 },
];

export default function Home() {
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    id: string;
    title: string;
    deadline: string;
    code: string;
    link: string;
  } | null>(null);
  // Navigation (T-5.10) is `SiteNav`, a shared component: the scroll state and
  // the listener that used to live here moved into it, so this page no longer
  // owns any chrome state.
  const reduced = usePrefersReducedMotion();
  // Drives the page transition below: one key per route.
  const pathname = usePathname();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Nama proyek wajib diisi.');
      return;
    }
    if (title.length > 100) {
      setError('Nama proyek maksimal 100 karakter.');
      return;
    }
    if (!deadline) {
      setError('Tenggat waktu wajib diisi.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), deadline }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Gagal membuat proyek. Silakan coba lagi.');
        setLoading(false);
        return;
      }

      setSuccessData(json);
    } catch {
      setError('Terjadi kesalahan jaringan. Periksa koneksi Anda.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col text-ink">
      <SectionRail />

      {/* Page transition (T-5.09): the incoming route fades up over one 280ms
          layout curve. It is keyed on the pathname, so it runs once per
          navigation and never replays on a re-render.

          Opacity, plus a transform that only exists *while leaving*.

          The prior task had to drop the transform entirely, and the note it
          left explains why: a `transform` on this wrapper makes it a containing
          block for every descendant, and Framer's `whileInView` observers then
          measure their targets against that shifted box. Measured at the time,
          every below-fold reveal sat at opacity 1 with no style attribute, so
          the page appeared unrevealed.

          That failure is a property of an *outgoing* transform, not of
          transforms in general. So the entry is opacity alone (the element
          carries no transform while it is on screen and the observers run),
          and only the exit adds a 8px lift. By the time `exit` runs the route
          is on its way out and nothing below it is being observed. The reader
          gets direction from the transition; the reveal machinery keeps a
          clean, untransformed reference box. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={pathname}
          id="konten-utama"
          className="flex-1"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: reduced ? 0 : DURATION.layout, ease: EASE.out }}
        >
          <Hero
            reduced={reduced}
            title={title}
            setTitle={setTitle}
            deadline={deadline}
            setDeadline={setDeadline}
            loading={loading}
            error={error}
            clearFieldError={(field) =>
              setError((prev) =>
                prev && prev.includes(field === 'title' ? 'Nama proyek' : 'Tenggat') ? null : prev
              )
            }
            successData={successData}
            handleSubmit={handleSubmit}
          />

          <AlurProduk />
          <KomposisiSkor />
        </motion.main>
      </AnimatePresence>

      <SiteFooter />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Section rail (T-5.04)
 *
 * The homepage's orienting device. Before this, the only scroll feedback on the
 * page was a 1px line under the navbar, which told the reader *how far* they
 * were but not *where*. This is a fixed miniature index on the right edge
 * (desktop only, >=1280px where there is room for it) with one tick per band.
 *
 * It is deliberately not a scrollbar replacement: the ticks are real links to
 * the real section ids, the current band is derived from scroll position, and
 * the whole thing is `aria-hidden` decoration around ordinary anchor links.
 * Under reduced motion the progress fill is not rendered at all, because a
 * static full bar would claim a position the reader has not reached.
 * ------------------------------------------------------------------------- */
const HOME_SECTIONS = [
  { id: 'atas', label: 'Mulai' },
  { id: 'cara-kerja', label: 'Alur produk' },
  { id: 'scoring', label: 'Komposisi skor' },
] as const;

function SectionRail() {
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleY = useTransform(scrollYProgress, (v) => (Number.isFinite(v) ? v : 0));
  const [activeId, setActiveId] = useState<string>(HOME_SECTIONS[0].id);

  // One IntersectionObserver for the three bands. Cheap, and it never runs per
  // scroll frame, so it cannot add work to the scroll path.
  useEffect(() => {
    const targets = HOME_SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (targets.length === 0) return;

    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        const next = HOME_SECTIONS.find((section) => visible.get(section.id));
        if (next) setActiveId(next.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Bagian halaman"
      className="pointer-events-none fixed top-1/2 right-6 z-20 hidden -translate-y-1/2 xl:block"
    >
      <div className="pointer-events-auto relative flex flex-col gap-4 pl-3">
        {/* The travelling line: one scaleY on a 1px track. */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 h-full w-px bg-line-strong/60"
        >
          {!reduced && (
            <motion.span
              data-motion-scroll=""
              className="block h-full w-px origin-top bg-accent-strong"
              style={{ scaleY }}
            />
          )}
        </div>
        {HOME_SECTIONS.map((section) => {
          const current = activeId === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="group flex items-center gap-2.5 py-0.5"
            >
              <span
                aria-hidden="true"
                className={`block h-px transition-all duration-200 ease-[var(--ease-out-expo)] ${
                  current ? 'w-4 bg-accent-strong' : 'w-2 bg-line-strong group-hover:w-3.5'
                }`}
              />
              <span
                className={`font-mono text-[10.5px] tracking-[0.06em] uppercase transition-colors duration-200 ${
                  current ? 'text-ink' : 'text-fog group-hover:text-muted'
                }`}
              >
                {section.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------------------------
 * Hero
 *
 * The sequence is deliberately uneven: the star leads, the eyebrow follows
 * 80ms later, the three headline lines step in at 120/240/360ms, the italic
 * accent lands another 120ms after its own line, then the description, the
 * formula plate, the limits and finally the form panel. No two elements share
 * the same delay or the same travel.
 *
 * Two things move with the scroll, both through `useSectionProgress` (a
 * MotionValue scoped to this section, not React state): the headline lifts 26px
 * and the form panel drifts 18px the other way, which gives the fold depth
 * without aggressive parallax. Both are pinned to 0 under reduced motion, and
 * the section is only as tall as its content, so it can never trap a scroll.
 * ------------------------------------------------------------------------- */
function Hero({
  reduced,
  title,
  setTitle,
  deadline,
  setDeadline,
  loading,
  error,
  clearFieldError,
  successData,
  handleSubmit,
}: {
  reduced: boolean;
  title: string;
  setTitle: (v: string) => void;
  deadline: string;
  setDeadline: (v: string) => void;
  loading: boolean;
  error: string | null;
  /** Drops the current error when the user edits the field it refers to. */
  clearFieldError: (field: 'title' | 'deadline') => void;
  successData: { id: string; title: string; deadline: string; code: string; link: string } | null;
  handleSubmit: (e: React.FormEvent) => void;
}) {
  // A single scroll-linked value for the whole hero: the headline lifts a
  // little faster than the decorative layer, which is the only parallax on the
  // page. `target` scopes it to the hero, so it stops computing once the hero
  // is gone. No setState, no per-frame render.
  const { ref, progress } = useSectionProgress<HTMLDivElement>({
    offset: SCROLL.through,
  });
  const titleY = useTransform(progress, [0, 1], [0, reduced ? 0 : -26]);
  const visualY = useTransform(progress, [0, 1], [0, reduced ? 0 : 18]);

  return (
    <section
      id="atas"
      ref={ref}
      data-sc-act="flow"
      suppressHydrationWarning
      className="home-hero mx-auto grid w-full max-w-[1240px] grid-cols-1 items-start gap-y-7 px-6 pt-7 pb-12 sm:px-8 sm:pt-10 lg:grid-cols-12 lg:gap-x-16 lg:gap-y-0 lg:pt-20 lg:pb-24 lg:px-16"
    >
      {/* T-5.17: the hero is a stack of independent planes (hero-depth.md).
          Four surfaces move at four rates while the copy rides at 1x, so the
          fold reads as a lit space the headline sits inside rather than as a
          flat sheet with a gradient on it.

          Every plane is `aria-hidden` and `pointer-events: none`: they carry no
          information the text below does not carry, and the create-project form
          lives inside this section, so a decoration that could catch a pointer
          would be a form the reader cannot type into. Rates are in the engine's
          own unit (hundreds of px across the act); see `app/scrollcraft-pages.css`
          for why each of the four was chosen. */}
      <div aria-hidden="true" className="home-planes">
        <div className="home-plane home-plane--back" data-sc-parallax="-1.1" />
        <div className="home-plane home-plane--mid" data-sc-parallax="-0.55" />
        <div className="home-plane home-plane--front" data-sc-parallax="0.75" />
        <div className="home-plane home-plane--near" data-sc-parallax="0.28">
          {SCORE_ROWS.map((row) => (
            <span key={row.k}>{row.k}</span>
          ))}
        </div>
      </div>

      {/* T-5.14: the hero carries its own light.
          The page-level depth field (`.app-canvas`) gives the whole document a
          warm high-light at the top-left. The hero needs a second, tighter one
          so the headline sits INSIDE a lit area rather than on a flat sheet —
          that contrast between lit focal point and calmer page below is what
          makes the section read as a composition instead of a stack of blocks.
          It is a `::before`-style span rather than a wrapper so it never
          becomes a containing block or a tab stop, and it is `pointer-events:
          none` so it cannot intercept the form.

          T-5.17: the wash moved into the back plane above, because it is now
          one of four layers that separate on scroll rather than a static plate
          behind the type. Nothing is lost when the engine is unavailable: the
          plane keeps its position, and the page's own `.app-canvas` light is
          untouched. */}

      {/* Two columns, not one and a half. On mobile the DOM order is
          intro -> panel -> details, which puts the create-project form on the
          first screen instead of 1140px down (T-5.06 audit 3.1). On desktop the
          explicit row/column placement below restores the original layout:
          details in the left 7 columns, panel in the right 5. `order` is not
          used because the grid re-placement is what keeps the desktop DOM
          reading order sensible for screen readers.

          T-5.17: `home-hero-copy` lifts this column above the planes. It is the
          1x layer — the one thing in the fold that does not move relative to
          the reader — which is the rule hero-depth.md is most explicit about:
          text being read should never slide against the thing it is read
          against. */}
      <div className="home-hero-copy relative space-y-6 pt-16 lg:col-span-7 lg:row-start-1 lg:pt-24">
        {/* 1 & 2 — star motif, then the eyebrow. T-5.15: this block used to be a
            framer `motion.div` with `variants` inherited by `whileInView` on the
            parent. Measured in this app that pattern resolves to the final state
            on the first frame and never animates (see scroll-reveal.tsx), so the
            star simply appeared. `Reveal` gives the star a real entrance and the
            eyebrow keeps its own masked line. */}
        <Reveal
          as="div"
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
          distance="sm"
          duration={0.32}
          start="top 95%"
        >
          <span aria-hidden="true" className="inline-block">
            <Star className="h-3 w-3 text-accent-strong" />
          </span>
          <MaskLine delay={0.08}>
            <span className="eyebrow">Pembagi tugas kelompok</span>
          </MaskLine>
        </Reveal>

        {/* 3 — headline: four real lines, each behind its own mask. */}
        <motion.h1
          className="display space-y-0 text-[clamp(2.15rem,5.2vw,4rem)] text-ink"
          style={reduced ? undefined : { y: titleY }}
        >
          <MaskLine className="display" delay={0.14}>
            Bagi tugas
          </MaskLine>
          <MaskLine className="display" delay={0.24}>
            <span className="accent-word">kelompok</span>
          </MaskLine>
          <MaskLine className="display" delay={0.34}>
            berdasarkan data,
          </MaskLine>
          <MaskLine className="display" delay={0.42}>
            bukan tebakan.
          </MaskLine>
        </motion.h1>

        {/* 4 — description. It stays with the headline, because it is the
            sentence that explains what the form asks for. Shorter on phones
            (T-5.06): the same sentence at 15.5px/1.65 wrapped to seven lines and
            pushed the submit button 30px past the fold at 390px. The line height
            tightens, not the text, so nothing is hidden or rewritten. On a 568px
            tall screen no typographic choice can fit the whole form below a
            four-line headline; the field is what has to be reachable, and it is. */}
        <RevealGroup inView={false} nested className="space-y-7">
          <RevealItem
            as="p"
            className="max-w-[54ch] text-[14.5px] leading-[1.5] text-muted sm:text-[15.5px] sm:leading-[1.65]"
          >
            Masukkan anggota, skill, kapasitas jam, dan daftar tugas. Sistem menghitung kecocokan
            konten, skill, sisa kapasitas, dan minat, lalu menghasilkan matriks penugasan yang bisa
            Anda sesuaikan sendiri. AI hanya menganalisis teks tugas. Keputusan tetap di tangan Anda.
          </RevealItem>
        </RevealGroup>
      </div>

      {/* 7 — the form panel. It moved ahead of the two explanatory blocks in DOM
          order (T-5.06): on mobile those blocks were 350px of content past the
          fold before the first input, which is exactly the failure the brief
          names. On desktop it is placed back into the right column, so nothing
          about the two-column layout changes. It is the one surface that floats:
          the page's action, 6px over 7s, on a non-clickable shell, so it never
          moves the input under the pointer.

          T-5.15: the entrance now runs through GSAP (`Reveal`), not framer.
          Measured on this route, the previous framer version of this panel
          reported `opacity: 1; transform: none` from the first sampled frame and
          never animated — the same framer-14 `initial`-not-applied failure that
          broke every other reveal. It also nested a `y` MotionValue in `style`
          and a `y` in `initial`, where the style value always wins.

          `Reveal` animates the wrapper; the scroll parallax (`visualY`) is moved
          onto an inner div so the two never write the same property. The form is
          interactive from the first frame: GSAP only touches opacity and
          transform, so no input ever waits for the animation. */}
      <div className="relative order-2 lg:order-none lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2">
        <Reveal
          distance="lg"
          duration={0.52}
          start="top 92%"
          className="relative"
        >
          <motion.div style={reduced ? undefined : { y: visualY }}>
        {/* The panel is real glass now, not an opaque card on a lavender halo
            (T-5.06). The wash that used to sit here was a pale accent-tint sheet
            that lowered separation from the canvas and read as a generic glow.
            `data-interactive` gives it a 120ms edge response on hover/focus. */}
        <FloatShell reduced={reduced}>
          <div
            className="glass-panel relative rounded-[var(--radius-panel)] p-4 sm:p-7"
            data-interactive="true"
          >
            <AnimatePresence mode="wait" initial={false}>
              {!successData ? (
                <motion.div
                  key="form"
                  className="space-y-4 sm:space-y-5"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduced ? undefined : { opacity: 0 }}
                  transition={{ duration: reduced ? 0 : DURATION.feedback, ease: EASE.out }}
                >
                  {/* The header carries a numbered rule above it: the panel is
                      step 1 of a real four-step product, so the number is a
                      functional signpost, not decoration. The rule gives the
                      dense panel a top edge to hang from instead of starting
                      the eye mid-air.

                      T-5.13: the badge is gold-outlined on a gold tint, not a
                      filled azure disc. A saturated disc was the single loudest
                      blue element left on the page, and a filled gold disc would
                      spend a chunk of the 5% gold budget on a decorative
                      numeral. A tint plus a hairline reads as a mark, and the
                      numeral stays --ink so it clears AA at 10.5px where gold
                      text would not. */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-tint font-mono text-[10.5px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--accent)]"
                        data-numeric
                      >
                        1
                      </span>
                      <span className="eyebrow">Buat proyek</span>
                      <span aria-hidden="true" className="h-px flex-1 bg-line" />
                    </div>
                    <h2 className="heading text-[1.45rem] text-ink sm:text-[1.6rem]">
                      Mulai dari satu proyek
                    </h2>
                    <p className="text-[13px] leading-relaxed text-muted">
                      Dua isian, lalu Anda mendapat kode akses proyek untuk dibagikan ke anggota.
                    </p>
                  </div>

                  {/* The visible message lives next to its field (see below), where
                      `aria-describedby` can bind it to the input. This block is the
                      live region only: it announces the same sentence once, without
                      printing it a second time on screen or in the accessibility
                      tree. */}
                  <AnimatePresence>
                    {error && (
                      <RevealOnce
                        key="error"
                        role="alert"
                        className="rounded-[var(--radius-input)] bg-danger-surface px-3 py-2 text-[12.5px] font-medium text-danger shadow-[inset_0_0_0_1px_var(--danger)]"
                        as="div"
                      >
                        Periksa isian bertanda merah di bawah.
                      </RevealOnce>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <label htmlFor="title" className={FIELD_LABEL}>
                        Nama proyek / mata kuliah <span className="text-danger">*</span>
                      </label>
                      <input
                        id="title"
                        type="text"
                        required
                        maxLength={100}
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          // Clear the message for this field the moment the user
                          // starts fixing it, so a corrected field never keeps
                          // painting as an error. Validation itself is unchanged:
                          // it still runs on submit.
                          clearFieldError('title');
                        }}
                        /*
                         * Only flag the field once a submit has actually failed on
                         * it. Before that the field is neutral, so an untouched
                         * empty input never paints as an error. The validation
                         * itself is untouched: it still runs in handleSubmit.
                         */
                        aria-invalid={Boolean(error) && Boolean(error?.includes('Nama proyek'))}
                        aria-describedby={error && error.includes('Nama proyek') ? 'title-error' : undefined}
                        placeholder="Contoh: Tugas Besar Pemrograman Web"
                        className={`${FIELD} h-11`}
                      />
                      {error && error.includes('Nama proyek') && (
                        <p id="title-error" className="motion-error text-[12px] text-danger">
                          {error}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="deadline" className={FIELD_LABEL}>
                        Tenggat proyek <span className="text-danger">*</span>
                      </label>
                      {/* The custom calendar (T-5.09) replaces the native date
                          input. The value it writes is the same `YYYY-MM-DD`
                          string the native control produced, through the same
                          `setDeadline` and `clearFieldError` pair, so validation,
                          the API payload and the submit guard are untouched. */}
                      <DateField
                        id="deadline"
                        value={deadline}
                        onChange={(next) => {
                          setDeadline(next);
                          clearFieldError('deadline');
                        }}
                        invalid={Boolean(error) && Boolean(error?.includes('Tenggat'))}
                        describedBy={error && error.includes('Tenggat') ? 'deadline-error' : undefined}
                        fieldClassName="h-11"
                      />
                      {error && error.includes('Tenggat') && (
                        <p id="deadline-error" className="motion-error text-[12px] text-danger">
                          {error}
                        </p>
                      )}
                    </div>

                    <motion.button
                      type="submit"
                      disabled={loading}
                      // Pinned so SSR and hydration agree (see primitives.tsx).
                      tabIndex={0}
                      whileTap={reduced ? undefined : { scale: 0.985 }}
                      transition={{ duration: DURATION.feedback, ease: EASE.out }}
                      className="group/cta relative inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-accent-strong text-[14px] font-medium text-accent-ink transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-ink disabled:opacity-60"
                    >
                      <span className="flex flex-col overflow-hidden" style={{ height: '1.35em' }}>
                        <span
                          aria-hidden="true"
                          className="flex flex-col transition-transform duration-200 ease-[var(--ease-out-expo)] group-hover/cta:-translate-y-[1.35em]"
                        >
                          <span className="flex h-[1.35em] shrink-0 items-center justify-center leading-[1.35em]">
                            {loading ? 'Membuat kode proyek…' : 'Buat proyek'}
                          </span>
                          <span className="flex h-[1.35em] shrink-0 items-center justify-center leading-[1.35em]">
                            {loading ? 'Membuat kode proyek…' : 'Buat proyek'}
                          </span>
                        </span>
                      </span>
                      <span className="sr-only">{loading ? 'Membuat kode proyek' : 'Buat proyek'}</span>
                      {loading && (
                        <span
                          aria-hidden="true"
                          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                        />
                      )}
                    </motion.button>
                  </form>

                  <p className="border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
                    Kode proyek dibagikan ke anggota agar setiap orang dapat mengisi profilnya
                    sendiri. Tidak ada akun yang perlu dibuat.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  className="space-y-5"
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduced ? 0 : DURATION.data, ease: EASE.out }}
                >
                  <div className="flex items-start gap-3">
                    <motion.span
                      aria-hidden="true"
                      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent"
                      initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: DURATION.data, ease: EASE.out, delay: reduced ? 0 : 0.1 }}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="h-3.5 w-3.5 text-accent-ink"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5l4 4 8-8" />
                      </svg>
                    </motion.span>
                    <div className="space-y-1">
                      <p className="heading text-[1.25rem] text-ink">Proyek siap</p>
                      <p className="text-[13px] text-muted">
                        Simpan kode berikut untuk kembali ke proyek ini.
                      </p>
                    </div>
                  </div>

                  <dl className="divide-y divide-line rounded-[var(--radius-input)] bg-mist px-4 py-1 shadow-[inset_0_0_0_1px_var(--line)]">
                    <div className="py-3">
                      <dt className="eyebrow">Nama proyek</dt>
                      <dd className="mt-0.5 text-[14px] font-medium text-ink">{successData.title}</dd>
                    </div>
                    <div className="py-3">
                      <dt className="eyebrow">Kode akses</dt>
                      <dd className="mt-0.5 select-all font-mono text-[15px] font-medium tracking-tight text-accent">
                        {successData.code}
                      </dd>
                    </div>
                    <div className="py-3">
                      <dt className="eyebrow">Tenggat</dt>
                      <dd className="mt-0.5 font-mono text-[13.5px] font-medium tabular-nums text-ink">
                        {successData.deadline}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    href={successData.link}
                    className="group/cta relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-accent-strong text-[14px] font-medium text-accent-ink transition-colors duration-200 hover:bg-ink"
                  >
                    <span className="flex flex-col overflow-hidden" style={{ height: '1.35em' }}>
                      <span
                        aria-hidden="true"
                        className="flex flex-col transition-transform duration-200 ease-[var(--ease-out-expo)] group-hover/cta:-translate-y-[1.35em]"
                      >
                        <span className="flex h-[1.35em] shrink-0 items-center justify-center leading-[1.35em]">
                          Kelola anggota
                        </span>
                        <span className="flex h-[1.35em] shrink-0 items-center justify-center leading-[1.35em]">
                          Kelola anggota
                        </span>
                      </span>
                    </span>
                    <span className="sr-only">Kelola anggota</span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </FloatShell>
          </motion.div>
        </Reveal>
      </div>

      {/* 5 & 6 — the formula plate, the limits and the secondary CTA. These are
          the page's explanations, not its action, so they come after the form in
          DOM order and sit back in the left column on desktop. The limits are a
          three-across row from the smallest width now: each cell holds three
          words, so stacking them cost 201px on mobile for no gain (audit 3.3). */}
      <div className="order-3 space-y-6 lg:order-none lg:col-span-7 lg:col-start-1 lg:row-start-2">
        <RevealGroup inView={false} nested className="space-y-6">
          {/* 5 — the formula, as its own plate rather than body copy. */}
          <RevealItem>
            <FormulaPlate reduced={reduced} />
          </RevealItem>

          {/* 6 — the limits, three across from the smallest width. Each cell is
              three words, so stacking them cost 201px on mobile for nothing
              (audit 3.3). The label is allowed two lines and the value is pinned
              to the bottom, so a wrapping label ("Batas beban") cannot pull its
              number out of line with the other two. */}
          <RevealItem className="grid max-w-xl grid-cols-3 gap-x-3 border-y border-line py-4 sm:gap-x-6 sm:py-5">
            {[
              { label: 'Formula', value: '40K+30S+20C+10M' },
              { label: 'Batas beban', value: '1,25× ideal' },
              { label: 'Anggota', value: 'Min. 2' },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`flex flex-col justify-between ${
                  i > 0 ? 'border-l border-line pl-3 sm:pl-6' : ''
                }`}
              >
                <span className="eyebrow block">{stat.label}</span>
                <span
                  className="mt-1 block break-words font-mono text-[12.5px] font-medium tabular-nums text-ink sm:text-[14px]"
                  data-numeric
                >
                  {stat.value}
                </span>
              </div>
            ))}
          </RevealItem>

          <RevealItem className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/how-it-works" variant="outline" size="md">
              Baca formula & aturan R1–R5
            </ButtonLink>
            <span className="text-[12.5px] text-muted">Tanpa login. Tanpa batas jumlah anggota.</span>
          </RevealItem>
        </RevealGroup>
      </div>
    </section>
  );
}

/**
 * The float shell for the form panel.
 *
 * The float animation lives on the outermost wrapper and only translates it, so
 * the inputs inside keep their hit areas.
 *
 * It stops for good as soon as the panel is touched. A form that keeps drifting
 * while someone is aiming at it is hostile — it also means a synthetic pointer
 * click can never resolve the target as "stable". Once the user has engaged with
 * the panel the decoration has done its job and must get out of the way.
 *
 * Under reduced motion no animation element is created at all.
 */
function FloatShell({ reduced, children }: { reduced: boolean; children: React.ReactNode }) {
  const [engaged, setEngaged] = useState(false);
  const [settled, setSettled] = useState(false);

  // The drift is an entrance gesture, not a permanent state: it stops by itself
  // after the hero has had its moment, whether or not anyone has interacted.
  // That keeps the panel from moving forever (indefinite drift is both
  // distracting and impossible to aim at with a synthetic pointer).
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setSettled(true), 4200);
    return () => clearTimeout(t);
  }, [reduced]);

  const still = reduced || engaged || settled;

  if (still) return <div>{children}</div>;

  return (
    <Floating amplitude={5} delay={0.5}>
      <div
        onPointerEnter={() => setEngaged(true)}
        onPointerDown={() => setEngaged(true)}
        onFocusCapture={() => setEngaged(true)}
      >
        {children}
      </div>
    </Floating>
  );
}

/**
 * The formula plate: the weight of each component printed as a proportioned
 * scale. Bars are static — this is a legend, not a data readout — but they carry
 * the real 40/30/20/10 split so the reader can see the weighting before reading
 * the section below.
 */
function FormulaPlate({ reduced }: { reduced: boolean }) {
  return (
    <div
      className="max-w-xl rounded-[var(--radius-card)] border border-line bg-mist/70 px-4 py-3.5"
      aria-hidden="true"
    >
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="eyebrow">Bobot skor</span>
        <span className="font-mono text-[11.5px] tabular-nums text-muted">0,40K + 0,30S + 0,20C + 0,10M</span>
      </div>
      <div className="flex items-end gap-1">
        {SCORE_ROWS.map((row, i) => (
          <div key={row.k} className="flex-1 space-y-1.5">
            <motion.span
              className="block h-1.5 origin-left rounded-full"
              style={{ backgroundColor: row.color, width: '100%' }}
              initial={reduced ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.78, ease: EASE.outSoft, delay: 0.3 + i * 0.06 }}
            />
            <span className="block font-mono text-[10px] tabular-nums text-fog">{row.k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * "Alur Produk" — pinned storytelling (T-5.10-REDESIGN)
 *
 * This band used to be four step cards on a drawn rail: a diagram of a
 * sequence, read all at once. It now *is* the sequence. On desktop the four
 * steps pin beside a visual and advance as the reader scrolls, so each step
 * gets the full width of attention before the next one arrives. On a phone, and
 * under reduced motion, it stays the stacked list it was, because pinning a
 * viewport on a 390px screen would hide the step the reader is meant to read.
 *
 * The visual is honest: it prints the four steps' own numbers and titles, and
 * the highlight follows the real scroll position. It never invents a fifth
 * step, a timing, or a value the product does not have.
 * ------------------------------------------------------------------------- */
const ALUR_STEPS = [
  {
    label: 'Daftarkan anggota',
    title: 'Daftarkan anggota',
    body: 'Nama, skill 1–5, minat, dan kapasitas jam per minggu.',
  },
  {
    label: 'Susun tugas',
    title: 'Susun tugas',
    body: 'Pakai template T01–T11 atau tulis tugas manual beserta estimasi jam.',
  },
  {
    label: 'Analisis teks',
    title: 'Analisis teks',
    body: 'Gemini membuat embedding deskripsi tugas; AI tidak memilih anggota.',
  },
  {
    label: 'Sesuaikan hasil',
    title: 'Sesuaikan hasil',
    body: 'Geser bobot, kunci, tukar, atau undo. Semua dihitung di browser.',
  },
];

const ALUR_VISUAL = {
  label: 'Alur penugasan',
  aside: '4 langkah',
  rows: ALUR_STEPS.map((item, index) => ({
    code: String(index + 1).padStart(2, '0'),
    label: item.label,
  })),
  note: 'AI hanya membaca teks tugas. Pembagian akhirnya tetap dihitung dan diputuskan di browser Anda.',
};

function AlurProduk() {
  return (
    <div className={`border-y border-line ${SECTION_TONE.recessed}`}>
      <PinnedStory
        id="cara-kerja"
        eyebrow="Alur produk"
        heading={
          <>
            Empat langkah sampai <span className="accent-word">penugasan</span>
          </>
        }
        lede="Setiap langkah menyimpan datanya sendiri, jadi Anda bisa berhenti dan kembali kapan saja memakai kode proyek."
        steps={ALUR_STEPS}
        visual={ALUR_VISUAL}
        visualLabel="Empat langkah alur produk, dengan langkah aktif ditandai."
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * "Komposisi Skor" — the weight ledger (T-5.17, the page's signature move)
 *
 * The section used to stage each row's entrance with three separate framer
 * tweens. It now *is* the argument: a pinned act in which the four weights
 * arrive in the formula's own order while a running total in the margin
 * accumulates 0.40 → 0.70 → 0.90 → 1.00.
 *
 * Why this is the signature move and not just a nice animation: the product's
 * entire credibility rests on those four numbers adding up to exactly one. Any
 * competitor can print the formula; watching it close is the thing a reader
 * describes to someone else afterwards.
 *
 * How it is built, and what was deliberately not done:
 *  - The mechanism is the engine's documented `--sc-p`, which it publishes on
 *    the act element. Every moving part below is a CSS `calc()` against that
 *    variable with a per-row `--at` offset. There is no React state, no
 *    per-frame render, and no third animation loop competing with GSAP and
 *    Lenis for the scroll position.
 *  - Progress is *derived*, never triggered, so the ledger runs forwards and
 *    backwards correctly with the scroll wheel. That is a hard requirement of
 *    the task, and a `whileInView` entrance (what this replaced) cannot do it.
 *  - Nothing is left hidden without JavaScript. If the engine never marks the
 *    document `sc-ready`, `app/scrollcraft-pages.css` paints every row at full
 *    opacity; if the reader asks for reduced motion, the same file pins the
 *    geometry to its final value.
 *  - The numbers are the formula's own weights, taken from `SCORE_ROWS`. The
 *    running total is computed by summing them, so it cannot drift out of step
 *    with the rows it is totalling. Nothing here is estimated or illustrated.
 *  - The row copy, the descriptions and the fallback note are unchanged. The
 *    fallback note matters: `M` is 10% of the hybrid score, but in fallback
 *    mode K disappears and the weight is redistributed, and a reader who sees
 *    "1.00" must be told that before they build a plan on it.
 * ------------------------------------------------------------------------- */
function KomposisiSkor() {
  /*
   * The pin degrades through CSS, not through this component: the ledger's
   * `@media (max-width: 1023px), (prefers-reduced-motion: reduce)` block drops
   * the sticky stage and shows the final total, so no JS branch is needed here.
   * A `usePrefersReducedMotion()` value was left unused in this function and
   * lint flagged it; removing it keeps the component honest about that.
   */

  /*
   * Each row's window inside the act, and the shape it gives the ledger.
   *
   * The act opens on an *unwritten* ledger: the ground total reads 0,00 and
   * every row is dim, which is the truth before the first weight is counted.
   * Row K therefore opens at 0.10 rather than 0 — a pinned stage is on screen
   * for a full viewport before its progress leaves zero, so 0.10 still arrives
   * while the reader is looking at the plate, and the empty beat at the top is
   * a fraction of a screen rather than one.
   *
   * The last row opens at 0.70 and closes at 1, where the total lands on 1,00
   * and holds. Measured against the engine's live range, that leaves the whole
   * fourth row on screen before the pin releases: at 0.72 the last row was
   * still at 0.34 opacity when the act went `live: false`, so the reader never
   * saw it settle.
   */
  const windows = [0.1, 0.33, 0.53, 0.7] as const;

  /*
   * The running total after each row, in the page's own order. Derived from
   * `SCORE_ROWS` rather than typed in, so editing a weight in one place keeps
   * the ledger honest. `0,40` style formatting matches the rest of the page,
   * which is written in Indonesian and uses the comma as the decimal mark.
   *
   * `row.width` is a percentage (40, 30, 20, 10) because that is what the bar
   * geometry needs; the weight the formula actually uses is that number over
   * 100. Accumulating before dividing is what keeps 0.40 + 0.30 exact instead
   * of a sequence of float sums that lands on 0.9999999 and formats as "1,00"
   * by luck rather than by arithmetic.
   */
  const runningTotals = SCORE_ROWS.reduce<number[]>((acc, row, index) => {
    const previousPercent = index === 0 ? 0 : acc[index - 1] * 100;
    acc.push((previousPercent + row.width) / 100);
    return acc;
  }, []);

  const formatWeight = (value: number) =>
    value.toFixed(2).replace('.', ',');

  return (
    <section
      id="scoring"
      data-sc-act="pin"
      data-sc-span="2.6"
      /* The engine writes `sc-act--pinned`, a px height and `--sc-p` onto the
         act element it mounts over. That is the engine's documented behaviour
         and it is invisible to a reader, but React hydrates this element from
         the server HTML and would warn about attributes it did not render.
         `suppressHydrationWarning` is the documented answer for that case, and
         the same one `app/layout.tsx` already uses for the theme class. It
         covers this element's attributes only; the copy inside still hydrates. */
      suppressHydrationWarning
      className={`home-world home-ledger-act mx-auto w-full max-w-[1240px] px-6 sm:px-8 lg:px-16 ${SECTION_TONE.open}`}
    >
      {/* The stage is sticky rather than fixed: the browser keeps the native
          scrollbar, native keyboard paging and native touch inertia, and the
          pin releases by itself when the track ends. No scroll hijack.

          It carries the engine's `sc-stage` class *and* the attribute on
          purpose: the attribute is how the engine finds the stage, but the
          sticky geometry (`position: sticky`, `height: 100svh`) lives on the
          `.sc-stage` class in `scrollcraft-engine.css`. A stage with only the
          attribute is "found" and never sticks — measured here, the ledger sat
          at `--sc-p: 0` for three viewports and then jumped to 1.

          A pinned stage is exactly one viewport tall, so everything inside it
          must fit one viewport. On a phone (and under reduced motion) it does
          not, and pinning there would hide the ledger behind a 100svh clip
          frame. `home-ledger-act` in `app/scrollcraft-pages.css` therefore
          drops the pin back to an ordinary document section below `lg` and for
          readers who ask for less motion; the content is identical, and every
          row is complete in that form. */}
      <div
        data-sc-stage
        className="sc-stage flex flex-col justify-center gap-6 py-10 lg:gap-5 lg:py-0"
      >
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
          <div className="space-y-4 lg:col-span-5">
            <MaskLine delay={0}>
              <SectionMark>Komposisi skor</SectionMark>
            </MaskLine>
            <h2 className="heading max-w-[24ch] text-[clamp(1.75rem,3.2vw,2.5rem)] text-ink">
              <MaskLine className="heading" delay={0.06}>
                Empat bobot yang
              </MaskLine>
              <MaskLine className="heading" delay={0.14}>
                berjumlah tepat <span className="accent-word">satu</span>
              </MaskLine>
            </h2>
            <p className="max-w-[46ch] text-[13.5px] leading-relaxed text-muted">
              Setiap skor dihitung 0,00–1,00 dan dirinci per komponen, sehingga rekomendasi bisa Anda
              telusuri, bukan sekadar diterima.
            </p>

            {/* The running total. It is the peak of the page and the reason
                this act is pinned: the reader is given a number to watch.

                How the accumulation works without a single line of JavaScript:
                the four totals are stacked in the same grid cell, and each one
                takes the *next* row's arrival as its own cue to appear. At
                progress 0 the ledger reads 0,00; as row K settles, 0,40
                replaces it; then 0,70, then 0,90, then 1,00. Because every
                value is present in the DOM and only opacity moves, the number
                runs forwards and backwards with the scroll, there is no state
                to fall out of step with the rows, and there is nothing to
                re-render per frame.

                `--at` per number is the window at which that total is true.
                Below `lg` and under reduced motion the CSS shows only the last
                one, because a reader on a phone is reading a document, not
                scrubbing a film.

                `aria-hidden` on the visual stack, with a real sentence beside
                it, for the same reason the numbers are tabular: a figure that
                changes on every scroll frame is unreadable aloud. The sentence
                carries the conclusion, and the four totals are printed as
                plain text under the plate. */}
            <div className="flex items-end gap-4 border-t border-line pt-4">
              <div className="home-ledger">
                <p className="home-ledger-running grid text-ink" data-numeric aria-hidden="true">
                  {/* The ground of the count: 0,00 before any weight has
                      arrived. It is a `.home-ledger-total` like the rest so it
                      hands over to 0,40 on the same narrow ramp instead of
                      sitting behind every later value.

                      Its own window starts *before* the act does (`--at: -1`).
                      Every numeral fades in across its own `--at`, so a ground
                      that opened at 0 would itself be invisible at progress 0
                      and the ledger would show an empty box until the first
                      weight landed — which is exactly what the first pass did. */}
                  <span
                    className="home-ledger-total col-start-1 row-start-1 font-normal text-muted"
                    style={{ ['--at' as string]: '-1', ['--next' as string]: String(windows[0]) }}
                  >
                    0,00
                  </span>
                  {runningTotals.map((value, index) => (
                    <span
                      key={value}
                      /* `--next` is the following numeral's window. The last one
                         gets 2, past the end of the act, so its outgoing ramp
                         never opens and 1,00 holds. */
                      className="home-ledger-total col-start-1 row-start-1"
                      style={{
                        ['--at' as string]: String(windows[index]),
                        ['--next' as string]: String(windows[index + 1] ?? 2),
                      }}
                    >
                      {formatWeight(value)}
                    </span>
                  ))}
                </p>
                <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
                  Total bobot
                </p>
              </div>
              <p className="max-w-[26ch] text-[12px] leading-relaxed text-muted">
                Bobot selalu berjumlah 1,00, jadi skor akhir berada pada skala 0–1.
              </p>
            </div>
          </div>

          {/* The ledger plate. One row per component, in the formula's order. */}
          <div className="lg:col-span-7">
            <div className="home-ledger-plate overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[0_1px_2px_rgba(11,18,32,0.04),0_18px_44px_-28px_rgba(11,18,32,0.35),inset_0_0_0_1px_var(--line)]">
              {SCORE_ROWS.map((row, i) => (
                <div
                  key={row.k}
                  /*
                   * `--at` is the row's window start. `home-ledger-toggle` reads
                   * it together with the act's own `--sc-p` to fade the row in,
                   * and `home-ledger-bar` uses the same pair to grow the bar.
                   * Both are set inline because they are the only per-row data
                   * the stylesheet needs; the stylesheet itself holds no ids.
                   */
                  style={{ ['--at' as string]: String(windows[i]) }}
                  className="home-ledger-row home-ledger-toggle grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-x-4 gap-y-1 border-b border-line px-6 py-5 last:border-b-0 sm:grid-cols-[2.25rem_11rem_1fr_auto]"
                >
                  <span
                    className="font-mono text-[17px] font-medium leading-none"
                    style={{ color: row.color }}
                    aria-hidden="true"
                  >
                    {row.k}
                  </span>
                  <span className="text-[14.5px] font-medium tracking-[-0.01em] text-ink">
                    <span className="sr-only">{row.k}: </span>
                    {row.t}
                  </span>
                  <span className="order-4 col-span-2 text-[13px] leading-relaxed text-muted sm:order-none sm:col-span-1">
                    {row.d}
                  </span>
                  <div className="col-start-3 row-start-1 flex items-center gap-2.5 sm:col-start-auto sm:row-start-auto">
                    <span
                      aria-hidden="true"
                      className="relative block h-[3px] w-16 overflow-hidden rounded-full bg-cloud"
                    >
                      <span
                        className="home-ledger-bar absolute inset-y-0 left-0 rounded-full"
                        style={{ width: `${row.width * 2.5}%`, backgroundColor: row.color }}
                      />
                    </span>
                    <span
                      className="home-ledger-weight text-[12.5px] tabular-nums text-muted"
                      data-numeric
                    >
                      {row.w}
                    </span>
                  </div>
                </div>
              ))}

              {/* The total row. It is the last thing to arrive and it is the
                  only row with a heavier rule above it, so the ledger reads as
                  a sum rather than as a fifth component. */}
              <div className="flex items-baseline justify-between gap-4 bg-mist px-6 py-4 shadow-[inset_0_1px_0_var(--line-strong)]">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
                  Jumlah
                </span>
                <span
                  className="font-mono text-[14px] font-medium tabular-nums text-ink"
                  data-numeric
                >
                  {SCORE_ROWS.map((row) => row.w.replace('%', '')).join(' + ')} = 100%
                </span>
              </div>
            </div>

            {/* The per-row running totals, printed as text as well as animated
                in the margin. A reader who lands mid-act, or who has motion
                turned off, still gets the same four numbers in the same order. */}
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] tabular-nums text-muted">
              <li className="sr-only">Akumulasi bobot per komponen:</li>
              {SCORE_ROWS.map((row, i) => (
                <li key={row.k}>
                  <span style={{ color: row.color }}>{row.k}</span> → {formatWeight(runningTotals[i])}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="max-w-[68ch] text-[13px] leading-relaxed text-muted">
          Jika layanan AI gagal atau dibatasi, aplikasi otomatis masuk ke mode cadangan tanpa komponen
          K dan membagi bobot ke S, C, dan M. Status mode selalu ditampilkan pada halaman hasil.
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Footer — the page's closer.
 *
 * The rule draws itself, the two text rows rise slightly behind it, and the
 * oversized wordmark slides up from behind the bottom crop. Nothing is
 * interactive here, so nothing can be blocked by the motion; the links that
 * exist stay in the navbar where they already were.
 * ------------------------------------------------------------------------- */
function SiteFooter() {
  const reduced = usePrefersReducedMotion();

  return (
    <footer className={`border-t border-line ${SECTION_TONE.deeper}`}>
      <div className="mx-auto w-full max-w-[1240px] px-6 pt-10 sm:px-8 lg:px-16">
        <DrawRule />
        <motion.div
          className="flex flex-wrap items-center justify-between gap-4 pt-8"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: DURATION.reveal, ease: EASE.out, delay: 0.08 }}
        >
          <div className="flex items-center gap-2.5">
            <LogoPlate size={24} />
            <p className="text-[13px] text-muted">
              Teammate AI, pembagi tugas kelompok berbasis rekomendasi.
            </p>
          </div>
          <p className="font-mono text-[12px] tabular-nums text-muted" data-numeric>
            0,40K + 0,30S + 0,20C + 0,10M
          </p>
        </motion.div>
      </div>
      {/* Oversized wordmark: the reference's graphic closer. The line box is
          cropped at the bottom only (padding-bottom=-), never at the top, so
          ascenders stay intact. `leading-[0.9]` keeps the cap line inside the
          box; the wrapper's `-mb-*` trims the empty descender space instead of
          clipping a shorter line box. */}
      <div aria-hidden="true" className="mt-8 overflow-hidden">
        <motion.p
          data-motion-reveal=""
          className="pointer-events-none -mb-[0.16em] select-none whitespace-nowrap px-6 font-[family-name:var(--font-display)] text-[clamp(3.5rem,14vw,11rem)] font-medium leading-[0.9] tracking-[-0.045em] text-ink/[0.06] sm:px-8 lg:px-16"
          initial={reduced ? false : { y: '45%' }}
          whileInView={{ y: '0%' }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: DURATION.line, ease: EASE.outSoft }}
        >
          Teammate AI
        </motion.p>
      </div>
    </footer>
  );
}
