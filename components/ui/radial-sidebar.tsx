'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Logo } from '@/components/ui/primitives';

/**
 * Radial sidebar (T-5.16).
 *
 * ONE navigation for the whole product. Before this file there were two: the
 * 260px workspace rail (`app-sidebar.tsx`, mounted by `WorkspaceShell`, which
 * also shifted the page right by 284px) and the public capsule bar
 * (`site-nav.tsx`, mounted in the root layout and hidden on `/p/*`). Each had its
 * own active-state logic, its own focus handling and its own mobile behaviour,
 * so the same product presented two different navigations depending on the URL.
 * This component replaces both call sites.
 *
 * WHY A RADIAL MENU AND WHAT IT SERVES
 * A horizontal rail spends 284px of every workspace screen on five links. The
 * audience here works on a laptop next to a member list and a score matrix, so
 * that column is taken directly from the data. A radial menu spends 56px at rest
 * and grows only while it is being used, which is the whole point: the navigation
 * becomes an instrument you pick up and put down rather than a permanent wall.
 *
 * The arc is a real spatial metaphor, not decoration: the trigger is the hub, and
 * every destination is one radius away from it. That is why the labels sit on the
 * outside of the ring (where they never collide with the hub) and why the items
 * are placed at increasing angles rather than at a fixed grid.
 *
 * WHAT IT DOES NOT DO: it adds no route, removes none, and changes no API, data,
 * score or AI behaviour. The route set below is exactly the set the two old
 * navigations already offered.
 */

/* ---------------------------------------------------------------------------
 * Destinations
 *
 * Icons are drawn from the subject (antislop R-04), reusing the shapes the old
 * rail already drew for these same routes: two heads for people, a lined page
 * for tasks, a grid for the score matrix (literally a grid of member x task
 * scores), a house for home, a question glyph for the guide. None of them is a
 * sparkle, star or robot.
 * ------------------------------------------------------------------------- */

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  // 1.5px is the editorial weight the rest of the system uses for hairlines and
  // icon strokes, so the menu does not read as a different icon family.
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  className: 'h-[19px] w-[19px]',
};

const ICONS = {
  home: (
    <svg {...ICON_PROPS}>
      <path d="M4 10.4 12 3.8l8 6.6V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19v-8.6Z" />
      <path d="M9.6 20.4v-6.2h4.8v6.2" />
    </svg>
  ),
  guide: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.25-1 .85-1 1.5v.4" />
      <path d="M12 16.9h.01" />
    </svg>
  ),
  members: (
    <svg {...ICON_PROPS}>
      <path d="M15.5 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20" />
      <circle cx="9.25" cy="7.6" r="3.1" />
      <path d="M21 20v-1.6a3.4 3.4 0 0 0-2.55-3.29M16.1 4.7a3.1 3.1 0 0 1 0 5.8" />
    </svg>
  ),
  tasks: (
    <svg {...ICON_PROPS}>
      <path d="M8.5 3.5h7M7 6.2h10a1.8 1.8 0 0 1 1.8 1.8v11.4a1.8 1.8 0 0 1-1.8 1.8H7a1.8 1.8 0 0 1-1.8-1.8V8A1.8 1.8 0 0 1 7 6.2Z" />
      <path d="M8.9 11.4h6.2M8.9 15.2h4.2" />
    </svg>
  ),
  matrix: (
    <svg {...ICON_PROPS}>
      <rect x="3.2" y="4.2" width="17.6" height="15.6" rx="2" />
      <path d="M3.2 9.3h17.6M3.2 14.6h17.6M9.1 9.3v10.5M15 9.3v10.5" />
    </svg>
  ),
} as const;

export type RadialItem = { label: string; href: string; icon: React.ReactNode };

/**
 * The navigation set for a given project code.
 *
 * The workspace links are omitted while the code is still resolving, exactly as
 * the old rail did: `/p//members` normalises to `/p/members`, and Next.js
 * prefetches that dead URL on first paint. A menu that points at a 404 is a
 * defect, so an unresolved code shows the two public destinations only.
 */
export function buildRadialItems(code: string): RadialItem[] {
  const general: RadialItem[] = [
    { label: 'Beranda', href: '/', icon: ICONS.home },
    { label: 'Cara kerja', href: '/how-it-works', icon: ICONS.guide },
  ];

  /* A whitespace-only code is as unresolved as an empty one, and it used to
     produce `/p/%20%20%20/members`: a URL that looks valid, encodes only spaces,
     and 404s. Trim before deciding, so "still resolving" means the same thing
     whatever shape the empty value arrives in. */
  const trimmed = code.trim();
  if (!trimmed) return general;

  const base = `/p/${encodeURIComponent(trimmed)}`;
  return [
    { label: 'Anggota', href: `${base}/members`, icon: ICONS.members },
    { label: 'Tugas', href: `${base}/tasks`, icon: ICONS.tasks },
    { label: 'Matriks rekomendasi', href: `${base}/result`, icon: ICONS.matrix },
    ...general,
  ];
}

/* ---------------------------------------------------------------------------
 * Motion
 *
 * The spec fixes the two durations and one curve, so they live here as the
 * single source of truth and are handed to CSS through custom properties. Doing
 * it this way (rather than hard-coding a different curve in three places) is
 * what makes opening, closing and the per-item stagger share one feel.
 * ------------------------------------------------------------------------- */

const OPEN_MS = 280;
const CLOSE_MS = 200;
/** cubic-bezier(0.16, 1, 0.3, 1): fast out, long settle. Already the project's
 *  `--ease-entrance`, repeated here so this component owns its own contract. */
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** Each item starts 26ms after the one before it. Five items land inside the
 *  280ms window, so the stagger reads as a ripple instead of a queue. */
const STAGGER_MS = 26;

const RADIAL_VARS = {
  '--radial-open': `${OPEN_MS}ms`,
  '--radial-close': `${CLOSE_MS}ms`,
  '--radial-ease': EASE,
  '--radial-stagger': `${STAGGER_MS}ms`,
} as React.CSSProperties;

/* Angular layout ---------------------------------------------------------- *
 * Items are spread across a bounded arc rather than a full circle. Starting at
 * -90deg and sweeping 180deg would place one item straight above the hub and one
 * straight below, which on a phone pushes the last item under the browser
 * chrome. A 160deg sweep anchored so the arc opens outward from the screen edge
 * keeps every item inside the viewport. The fan is also mirrored to the screen
 * edge it is docked to, so the arc always opens toward the page content.
 */
const ARC_START = -76; // degrees, measured from +x axis (clockwise, y down)
const ARC_SPAN = 152;

/* Mobile fan.
 *
 * The hub docks to the TOP-RIGHT corner below 640px (the only corner whose
 * 48px circle covered zero content boxes on any route, measured). From that
 * corner only the lower-left quadrant has room, i.e. angles from +180deg
 * (pointing left) round to +90deg (pointing straight down). A full 152deg arc
 * would put its first two items above the hub and off the top of the screen,
 * which the probe caught. So mobile uses a fixed 90deg quarter fan, and the CSS
 * radius on mobile is larger (116px) so that five 44px items on that tighter
 * span still clear each other: chord = 2*116*sin(22.5deg/2) = 45px... measured
 * at 51px in the probe. */
const MOBILE_ARC_START = 180; // pointing left
const MOBILE_ARC_END = 90; // pointing down

function mobileItemAngle(index: number, total: number): number {
  if (total <= 1) return (MOBILE_ARC_START + MOBILE_ARC_END) / 2;
  return MOBILE_ARC_START + ((MOBILE_ARC_END - MOBILE_ARC_START) / (total - 1)) * index;
}

function itemAngle(index: number, total: number): number {
  if (total <= 1) return ARC_START + ARC_SPAN / 2;
  return ARC_START + (ARC_SPAN / (total - 1)) * index;
}

export function RadialSidebar({
  items,
  side = 'left',
  label = 'Navigasi aplikasi',
}: {
  items: RadialItem[];
  /** Which edge the hub docks to. The arc mirrors accordingly. */
  side?: 'left' | 'right';
  label?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const panelId = useId();

  // Respecting prefers-reduced-motion is not a nicety: the arc is the only thing
  // that communicates where the items came from, so under reduced motion it must
  // simply be present, with no travel and no stagger.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + '/'),
    [pathname],
  );

  // A route change closes the menu. Without this the menu would stay open over
  // the freshly loaded page and the reader would have to dismiss it again.
  //
  // Done by tracking the last pathname in state and comparing DURING render,
  // not by calling setState in an effect. An effect would render one frame of
  // the new route with the old menu still open, and the project's lint rule
  // rejects synchronous setState in an effect because of exactly that cascading
  // second render.
  const [openedForPath, setOpenedForPath] = useState(pathname);
  if (openedForPath !== pathname) {
    setOpenedForPath(pathname);
    if (open) setOpen(false);
  }

  // Outside click, Escape, and focus return. All three live in one effect so the
  // listeners exist only while the menu is open.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // The trigger owns its own toggle; ignoring it here is what stops a click
      // from closing and immediately reopening the menu.
      if (triggerRef.current?.contains(target)) return;
      if (rootRef.current?.contains(target)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
        return;
      }
      // Arrow keys walk the ring in DOM order, which is also visual order. Tab is
      // left alone so the browser's own traversal still works.
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const focused = document.activeElement;
        const current = itemRefs.current.findIndex((node) => node === focused);
        if (current === -1) return;
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = (current + delta + items.length) % items.length;
        itemRefs.current[next]?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close, items.length]);

  // Hand focus to the first destination when the menu opens, so a keyboard user
  // is never left on the trigger with a menu they cannot reach.
  useEffect(() => {
    if (!open) return;
    const first = itemRefs.current[0];
    // `preventScroll` because focusing an item would otherwise scroll the page
    // to keep the fixed menu in view.
    first?.focus({ preventScroll: true });
  }, [open]);

  const total = items.length;
  const mirrored = side === 'right';

  /* The mobile radius is smaller because a 390px viewport cannot carry a 128px
   * ring plus labels; the desktop radius is larger because it has the room. Both
   * are decided in CSS off the same custom property so the geometry maths below
   * stays in one place. */
  const geometry = useMemo(
    () =>
      items.map((item, index) => {
        const angle = itemAngle(index, total);
        const rad = (angle * Math.PI) / 180;
        const mAngle = mobileItemAngle(index, total);
        const mRad = (mAngle * Math.PI) / 180;
        // Desktop direction (right-opening) and mobile direction (lower-left
        // quarter fan from a top-right hub). Both unit vectors are handed to CSS
        // so each breakpoint picks the one it needs; the radius stays a CSS
        // length so the same vectors work at both sizes.
        return {
          item,
          index,
          x: Math.cos(rad),
          y: Math.sin(rad),
          mx: Math.cos(mRad),
          my: Math.sin(mRad),
          mirrored,
        };
      }),
    [items, total, mirrored],
  );

  return (
    <>
      {/* The scrim is a SIBLING of the sidebar, not a child.
          MEASURED: as a child it inherited the sidebar's containing block (the
          sidebar is `position: fixed` + `transform`, both of which create one), so
          `inset: 0` resolved to a 56x56 square parked exactly over the hub. That
          grey square in the open-state screenshot was the scrim, not a shadow. As
          a sibling with no transformed ancestor it covers the viewport as intended. */}
      <div
        aria-hidden="true"
        className="radial-scrim"
        data-open={open ? 'true' : 'false'}
        onClick={() => close()}
      />

    <div
      ref={rootRef}
      className="radial-sidebar"
      data-side={side}
      data-open={open ? 'true' : 'false'}
      data-reduce-motion={reduceMotion ? 'true' : 'false'}
      style={RADIAL_VARS}
    >

      <button
        ref={triggerRef}
        type="button"
        className="radial-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
        onClick={() => setOpen((value) => !value)}
      >
        {/* The mark, not a hamburger. The hub IS the brand: that is what makes
            this menu belong to Teammate AI rather than to any app with an
            overflow button. It is the same logo the rail and nav already drew. */}
        <span className="radial-trigger-glyph" aria-hidden="true">
          <Logo className="h-[21px] w-[21px]" />
        </span>
        {/* A 45deg rotated glyph pair turns the logo into a close affordance
            while the menu is open, so the hub states its own toggle state. */}
        <span className="radial-trigger-x" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" />
          </svg>
        </span>
      </button>

      <nav id={panelId} aria-label={label} className="radial-panel" data-open={open ? 'true' : 'false'}>
        <ul className="radial-list">
          {geometry.map(({ item, index, x, y, mx, my }) => {
            const active = isActive(item.href);
            return (
              <li
                key={item.href}
                className="radial-item"
                style={
                  {
                    '--radial-x': x,
                    '--radial-y': y,
                    // Mobile unit vector (lower-left quarter fan). CSS uses these
                    // below 640px and ignores them above.
                    '--radial-mx': mx,
                    '--radial-my': my,
                    // Stagger is index-based and applied on open; on close the
                    // CSS reverses the delay so the ring collapses inward in the
                    // opposite order and the motion has a direction.
                    '--radial-delay': `${index * STAGGER_MS}ms`,
                    '--radial-delay-out': `${(total - 1 - index) * STAGGER_MS * 0.5}ms`,
                  } as React.CSSProperties
                }
                data-open={open ? 'true' : 'false'}
              >
                <Link
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  data-active={active ? 'true' : 'false'}
                  className="radial-link"
                  /* The closed menu must be unreachable by keyboard. CSS
                     `visibility: hidden` does remove a link from the tab order,
                     but it only applies after the close transition finishes, so
                     for 200ms a closed menu still had 5 tabbable stops (the probe
                     measured exactly that). `tabIndex` is synchronous and closes
                     the gap. */
                  tabIndex={open ? 0 : -1}
                  onClick={() => close()}
                >
                  <span className="radial-link-icon">{item.icon}</span>
                  {/* The tooltip is the label. It is always in the DOM (so it is
                      the accessible name too) and only its visibility changes,
                      which keeps screen readers and sighted users reading the
                      same string. */}
                  <span className="radial-tooltip" role="tooltip">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* The project code is NOT rendered here.
          MEASURED three times: a semicircular arc leaves no free floating region
          around the hub. Above, below, upper-right and lower-right each met an
          item at some viewport height (the arc spans 152deg, so only a narrow
          vertical slot is clear and a 200px-wide code string does not fit in it).
          Rather than shrink the code to an unreadable stub, the context lives in
          the workspace-context line at the top of the page, where it has real
          room. This is the honest trade: the menu stays clean, and the reader
          still always knows which project they are in. */}

      {/* The theme control sits in the hub column, below the trigger, so it is
          always reachable without opening the menu. It was in the old rail's
          footer; it keeps that job here. */}
      <div className="radial-theme" data-open={open ? 'true' : 'false'}>
        <ThemeToggle />
      </div>
    </div>
    </>
  );
}
