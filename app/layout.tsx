import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Inter_Tight, Instrument_Serif, Geist_Mono } from "next/font/google";
import "./globals.css";
/* Scroll Craft (T-5.17). The engine stylesheet is the mechanism and ships
   unedited from `.agents/skills/scroll-craft/engine/`; the bridge that follows
   it is the only file allowed to re-point its tokens at the product's own.
   Order matters: mechanism, then bridge, then the product's own layer. */
import "./scrollcraft-engine.css";
import "./scrollcraft-bridge.css";
/* The page compositions: the shapes the routes build with the engine's
   devices. Separate from the bridge because the bridge is a token map and must
   stay boring, and separate from `globals.css` because this layer is allowed to
   change whenever a page's scroll composition changes. */
import "./scrollcraft-pages.css";
import { SiteNav } from "@/components/ui/site-nav";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { ScrollCraftEngine } from "@/components/motion/scrollcraft-engine";

/*
 * Type is loaded through `next/font/google`, the loader this project already
 * used, so no package or font file is added by hand.
 *
 *  - Inter Tight 500 carries every display line. Its tighter fit is what makes
 *    a 40-64px headline read as editorial instead of merely large.
 *  - Instrument Serif italic sets the one accent word per headline. It is the
 *    only serif in the product, which is what keeps the gesture meaningful.
 *  - Inter covers body, UI, labels, buttons.
 *  - Geist Mono is kept for numbers that get compared with other numbers.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Teammate AI — Pembagi Tugas Kelompok Berbasis Rekomendasi",
  description:
    "Bagi tugas kelompok berdasarkan data: kemiripan konten, kecocokan skill, sisa kapasitas, dan minat. Hitungan deterministik, AI hanya membaca teks tugas.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No `maximum-scale` / `user-scalable=no`: zoom must stay available.
};

/*
 * Applies the stored theme before first paint so there is no light-to-dark
 * flash. DESIGN.md §7: default follows prefers-color-scheme, the toggle writes
 * `theme_preference` = 'light' | 'dark' | 'system'.
 */
const THEME_INIT = `
(function () {
  try {
    var pref = localStorage.getItem('theme_preference');
    if (pref !== 'light' && pref !== 'dark') pref = 'system';
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${inter.variable} ${interTight.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      {/* The app canvas (T-5.04). A fixed, low-contrast field behind every
          route: two soft radial washes in the product's own hues plus a hairline
          grid. It exists for one reason: a glass surface can only look like
          glass when there is something behind it to refract. It is painted
          behind `children` and never intercepts a pointer. */}
      <body className="app-canvas min-h-full flex flex-col text-ink">
        {/* Navigation (T-5.10) lives in the root layout so there is exactly one
            instance for the whole session. Mounted per page it remounted on
            every route change, which reset its scroll and transition state and
            is why the old three-system nav never felt continuous. It renders
            nothing on `/p/*`, where the workspace rail is the navigation.

            `Suspense` is required, not decorative: `SiteNav` reads
            `usePathname()`, and on the partially-prerendered workspace routes
            Next.js rejects URL data in a client component outside a Suspense
            boundary. The `null` fallback is deliberate: the bar is fixed, so
            nothing shifts while it resolves. */}
        <Suspense fallback={null}>
          <SiteNav />
        </Suspense>
        {/* Scrollytelling transport (T-5.15). Mounted once for the session; it
            renders nothing. It smooths desktop wheel/keyboard scrolling and
            gives GSAP ScrollTrigger a single clock, so the sticky stages and the
            scroll position can never drift apart. It disables itself entirely
            under `prefers-reduced-motion` and on coarse-pointer devices, where
            native touch momentum is already the right feel. */}
        <SmoothScroll />
        {/* Scroll Craft engine (T-5.17). Mounted once for the session, next to
            the transport it shares a scroll position with. It renders nothing:
            it reads `data-sc-*` off markup the pages already rendered and
            drives it from the real `window.scrollY` that Lenis interpolates.

            Two engines on one page would be a bug, which is why this is the
            only mount site in the codebase and why it tears the previous
            instance down on every route change.

            `Suspense` is required for the same reason `SiteNav` needs it, and
            the build proved it: `ScrollCraftEngine` reads `usePathname()` to
            re-mount on navigation, and Next.js rejects URL data in a client
            component outside a Suspense boundary on the partially-prerendered
            `/p/*` routes (measured: a prerender error in the console). */}
        <Suspense fallback={null}>
          <ScrollCraftEngine />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
