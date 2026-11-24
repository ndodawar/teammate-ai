'use client';

import Link from 'next/link';
import { AnimatePresence, motion, type HTMLMotionProps } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DURATION, EASE } from '@/lib/motion/tokens';

/*
 * Presentational primitives in the Catalis visual language.
 *
 * These carry no product behaviour — every one of them is a styled wrapper
 * around an element the product already rendered. Decisions and reasons:
 * docs/VISUAL-CATALIS.md §D.
 */

type ButtonVariant = 'solid' | 'accent' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'group/btn relative inline-flex items-center justify-center gap-1.5 rounded-full font-medium ' +
  'whitespace-nowrap transition-[background-color,color,box-shadow,transform,opacity] ' +
  'duration-200 ease-[var(--ease-out-expo)] select-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

const VARIANTS: Record<ButtonVariant, string> = {
  // Ink button: the reference's default dark action.
  solid: 'bg-ink text-paper hover:bg-ink/88 shadow-[0_1px_2px_rgba(20,20,22,0.08)]',
  // Gold: the single "go" action on a screen.
  //
  // T-5.13: hover darkens the FILL to ink instead of dropping its alpha. The old
  // rule was `hover:bg-accent-strong/88`, which composites gold over the bone
  // canvas and pulled the white label down to 3.9:1, under AA. A solid shift to
  // ink keeps the label at 16.9:1 and reads as a firmer press.
  accent:
    'bg-accent-strong text-accent-ink hover:bg-ink shadow-[0_1px_2px_rgba(20,20,22,0.08)]',
  // Hairline: secondary actions that sit next to a card. Border darkens on hover.
  outline:
    'bg-card text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-mist hover:shadow-[inset_0_0_0_1px_var(--ink)]',
  ghost: 'bg-transparent text-muted hover:bg-mist hover:text-ink',
  danger:
    'bg-card text-danger shadow-[inset_0_0_0_1px_var(--danger)] hover:bg-danger-surface hover:text-danger',
};

const SIZES: Record<ButtonSize, string> = {
  // `sm` stays compact so dense rows (matrix cells, metadata chips) keep their
  // rhythm, but it clears the 28px mark by one step and grows to a 44px-tall
  // hit target on touch-sized screens, where a thumb is doing the aiming.
  sm: 'h-8 px-3 text-[11.5px] max-sm:h-11',
  md: 'h-9 px-4 text-[13px]',
  lg: 'h-11 px-6 text-[15px]',
};

/**
 * Text-roll label: on hover/focus the label slides up and the next copy takes
 * its place inside the same 1.35em window.
 *
 * The roll distance must equal one label height, not the whole stack height.
 * At -100% the stack travels 2 × 1.35em while the window is only 1.35em tall,
 * so both copies leave the window together and the label blanks out at the end
 * of the motion. Rolling by exactly 1.35em keeps a copy centred in the window
 * at every frame, including the last one. Adding copies cannot fix it: the
 * travel scales with the copy count, so the window empties either way.
 *
 * Accessibility: the rendered copies are `aria-hidden`, and the accessible name
 * comes from a single visually hidden string. Screen readers therefore read the
 * label once, never twice. The wrapper is sized by the visible label, so rolling
 * never changes the button's size, and the roll is driven by CSS on hover/focus
 * only — it cannot block a click or a key press.
 */
function RollLabel({ children, roll }: { children: ReactNode; roll: boolean }) {
  if (!roll) return <>{children}</>;

  return (
    <span className="relative inline-flex flex-col overflow-hidden" style={{ height: '1.35em' }}>
      <span className="sr-only">{children}</span>
      <span
        aria-hidden="true"
        className="flex flex-col transition-transform duration-200 ease-[var(--ease-out-expo)] group-hover/btn:-translate-y-[1.35em] group-focus-visible/btn:-translate-y-[1.35em]"
      >
        <span className="flex h-[1.35em] shrink-0 items-center justify-center leading-[1.35em]">
          {children}
        </span>
        <span className="flex h-[1.35em] shrink-0 items-center justify-center leading-[1.35em]">
          {children}
        </span>
      </span>
    </span>
  );
}

export function Button({
  children,
  variant = 'outline',
  size = 'md',
  className = '',
  roll,
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Text-roll on hover. Default: on for md/lg, off for dense sm controls. */
  roll?: boolean;
} & HTMLMotionProps<'button'>) {
  const reduced = usePrefersReducedMotion();
  // Dense controls (sm) keep a still label: inside the matrix the cursor moves
  // across rows faster than a 200ms roll can finish.
  const shouldRoll = (roll ?? size !== 'sm') && !reduced;

  return (
    <motion.button
      // Framer Motion adds `tabindex="0"` on the client when a tap/hover
      // gesture is present, but not during SSR. That mismatch makes React log a
      // hydration error on every page. Buttons are already keyboard-focusable,
      // so we pin tabIndex explicitly and both renders agree.
      tabIndex={rest.tabIndex ?? 0}
      whileTap={reduced ? undefined : { scale: 0.975 }}
      transition={{ duration: DURATION.feedback, ease: EASE.out }}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      <RollLabel roll={shouldRoll}>{children}</RollLabel>
    </motion.button>
  );
}

/** Pill-shaped link with the same skin and roll behaviour as `Button`. */
export function ButtonLink({
  children,
  href,
  variant = 'outline',
  size = 'md',
  className = '',
  roll,
  ...rest
}: {
  children: ReactNode;
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  roll?: boolean;
} & Omit<React.ComponentProps<typeof Link>, 'href' | 'className' | 'children'>) {
  const reduced = usePrefersReducedMotion();
  const shouldRoll = (roll ?? size !== 'sm') && !reduced;

  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest}>
      <RollLabel roll={shouldRoll}>{children}</RollLabel>
    </Link>
  );
}

/**
 * Hairline chip: skills, metadata, and status labels.
 * `accent` is the azure-tinted label used for selected/verified state.
 */
export function Chip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'muted';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-card text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]',
    accent: 'bg-accent-tint text-accent-strong',
    muted: 'bg-mist text-muted shadow-[inset_0_0_0_1px_var(--line)]',
  } as const;

  return (
    <span
      className={`inline-flex h-[24px] items-center gap-1 rounded-full px-2.5 text-[11.5px] whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * A labelled block of data. Cards are white with a hairline at rest and a soft
 * shadow on hover: elevation marks the pane the reader is working in, not every
 * element (reference: cards float only where they earn it).
 */
export function Panel({
  as: Tag = 'section',
  eyebrow,
  title,
  action,
  children,
  className = '',
  bodyClassName = '',
}: {
  as?: 'section' | 'div' | 'aside';
  eyebrow?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Tag className={`surface-card rounded-[var(--radius-card)] ${className}`}>
      {(eyebrow || title || action) && (
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (
              <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-[17px] font-medium tracking-[-0.01em] text-ink">
                {title}
              </h2>
            )}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </Tag>
  );
}

/** Small uppercase label used above figures and sections. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

/**
 * Teammate AI brand mark: three people in one unit.
 *
 * Read as collaboration, not as decoration: three heads sit on one shared
 * baseline (the team), each tied to the centre by a spoke (the assignment
 * passing between them), and the centre node is the task they share. The
 * geometry is a trefoil, so it stays legible at 12px in a favicon and at 40px
 * in a navbar without a second drawing.
 *
 * Colours come from the current text colour only. That is deliberate: the mark
 * has to sit on the dark navbar plate, on the dark sidebar well, and on paper in
 * the footer, and a hard-coded azure fails on one of the three. Every caller
 * sets a foreground that already clears its own background.
 *
 * `title` is opt-in. With a title it is an image with an accessible name; without
 * one it is decoration (`aria-hidden`), which is what every place that already
 * prints the words "Teammate AI" beside it needs.
 */
export function Logo({
  className = '',
  title,
  style,
}: {
  className?: string;
  /** Accessible name. Omit where the wordmark is already adjacent. */
  title?: string;
  /** Size overrides. `LogoPlate` uses this to derive the glyph from the plate. */
  style?: React.CSSProperties;
}) {
  const a11y = title
    ? ({ role: 'img', 'aria-label': title } as const)
    : ({ 'aria-hidden': true } as const);

  return (
    <svg
      viewBox="0 0 30 30"
      className={`inline-block shrink-0 ${className}`}
      fill="none"
      style={style}
      {...a11y}
    >
      {/* One shared baseline: the team standing on the same line. Drawn as the
          ground the three members share, so the mark says "one group" before it
          says anything else. */}
      <path
        d="M8.4 20.6v1.5a2.7 2.7 0 0 0 2.7 2.7h7.8a2.7 2.7 0 0 0 2.7-2.7v-1.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      {/* The spokes: one task splitting outward from a single hub to each
          member. This is the assignment itself, so the three lines meet at one
          point rather than each hanging from its own member. */}
      <path
        d="M15 15.7 9.8 11.85M15 15.7l5.2-3.85M15 15.7V9.05"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The hub: where the task is decided before it is divided. */}
      <circle cx="15" cy="15.7" r="1.35" fill="currentColor" />
      {/* Three members, the centre one raised: one team, one shared task. The
          radii are uneven on purpose (2.75 / 2.4) so the centre reads as the
          lead and the pair as the team, not as three interchangeable dots. */}
      <circle cx="15" cy="6.55" r="2.75" fill="currentColor" />
      <circle cx="8.05" cy="9.95" r="2.4" fill="currentColor" />
      <circle cx="21.95" cy="9.95" r="2.4" fill="currentColor" />
    </svg>
  );
}

/**
 * The brand plate: the mark reversed out of a filled tile (T-5.10-REDESIGN).
 *
 * Every surface in the app used to invent its own size, corner radius and
 * fill for the logo: the nav drew a 28px ink tile, the sidebar a 19px glyph on
 * the rail's own plate, the workspace bar a bare azure glyph, the footer a
 * 24px square. Four spellings of one identity is how an identity stops
 * reading as one.
 *
 * This is that one spelling. The proportions are fixed (`size` only scales
 * them), the plate is ink in both themes, and the mark is `--paper`, so the
 * logo is the same object wherever it appears. Callers pass a size and, at
 * most, extra classes for spacing.
 */
export function LogoPlate({
  size = 28,
  className = '',
  title,
}: {
  /** Plate edge length in px. The glyph is sized from it, never independently. */
  size?: number;
  className?: string;
  title?: string;
}) {
  const radius = Math.round(size * 0.32);
  const glyph = Math.round(size * 0.64);

  return (
    <span
      className={`grid shrink-0 place-items-center bg-ink text-paper ${className}`}
      style={{ width: size, height: size, borderRadius: radius }}
      data-logo-plate=""
    >
      <Logo className="shrink-0" title={title} style={{ width: glyph, height: glyph }} />
    </span>
  );
}

/**
 * The small azure star that precedes every section eyebrow. It is the repeated
 * identity motif from the reference. `aria-hidden`: it marks the section, it is
 * not content. It never rotates or pulses (antislop R-19: no endless loops).
 *
 * This is the section marker, not the brand: the brand is `<Logo>` above.
 */
export function Star({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`inline-block h-3.5 w-3.5 shrink-0 text-accent ${className}`}
      fill="currentColor"
    >
      <path d="M12 1.6c.3 4.6 1.5 7.2 3.2 8.5 1.5 1.2 3.6 1.7 6.2 1.9-2.6.2-4.7.7-6.2 1.9-1.7 1.3-2.9 3.9-3.2 8.5-.3-4.6-1.5-7.2-3.2-8.5-1.5-1.2-3.6-1.7-6.2-1.9 2.6-.2 4.7-.7 6.2-1.9C10.5 8.8 11.7 6.2 12 1.6Z" />
    </svg>
  );
}

/**
 * Star + eyebrow, the reference's section marker. The star carries the accent,
 * the label carries the words, so the motif never competes with the heading.
 */
export function SectionMark({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-2 ${className}`}>
      <Star />
      <span className="eyebrow">{children}</span>
    </p>
  );
}

/**
 * The bordered form field skin. Radius 12px, hairline outline that becomes an
 * azure ring on focus (reference: input focus transition).
 */
export const FIELD =
  'w-full rounded-[var(--radius-input)] bg-card px-3 text-[13.5px] text-ink placeholder:text-fog ' +
  'shadow-[inset_0_0_0_1px_var(--line-strong)] transition-[box-shadow,background-color] duration-200 ' +
  'ease-[var(--ease-out-expo)] hover:shadow-[inset_0_0_0_1px_var(--fog)] ' +
  'focus:outline-none focus:shadow-[inset_0_0_0_2px_var(--accent),0_0_0_4px_rgba(47,102,255,0.12)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export const FIELD_LABEL = 'block text-[12px] font-medium text-muted';

/**
 * Navigation capsule (T-5.09).
 *
 * Structure taken from the reference, identity taken from DESIGN.md:
 *  - a floating capsule: translucent plate, backdrop blur, one hairline edge;
 *  - the active destination is a filled pill carrying icon *and* label, so the
 *    current page is readable without hovering;
 *  - inactive destinations are icon-only, which is what keeps the capsule short
 *    enough not to eat the header.
 *
 * Colour follows the app, not the reference: the pill is `--accent-strong`
 * azure, the plate is the `--rail-*` ink family, so the homepage capsule and the
 * workspace sidebar are visibly the same material.
 *
 * Glass dose (antislop R-10): the app already spends its glass on the sidebar
 * plate and the homepage form panel. The capsule is the *third* surface, so it
 * stays the lightest of the three: a thinner face, the smallest blur, and no
 * second inner glow. One moving element only, the sliding pill.
 */
export function NavCapsule({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`nav-capsule relative flex items-center gap-0.5 rounded-full p-1 ${className}`}>
      {children}
    </div>
  );
}

/**
 * One destination inside a `NavCapsule`.
 *
 * The label is always in the DOM (screen readers and the collapsed state read
 * it); the visual collapse of the inactive label is CSS on `.nav-capsule-link`,
 * so there is no state to keep in sync and no content that appears only on hover.
 * Under reduced motion the pill still moves, because it is the selected-state
 * indicator rather than decoration, but the width change snaps instead of easing.
 */
export function NavCapsuleLink({
  href,
  icon,
  label,
  active,
  onNavigate,
  shared,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active: boolean;
  onNavigate?: () => void;
  /** Marks the element that should carry the shared sliding pill (`layoutId`). */
  shared: string;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      data-active={active ? 'true' : 'false'}
      className="nav-capsule-link group relative flex h-9 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      {active && (
        <motion.span
          aria-hidden="true"
          layoutId={reduced ? undefined : shared}
          className="absolute inset-0 rounded-full bg-[var(--rail-active)] nav-capsule-pill"
          transition={{ duration: DURATION.layout, ease: EASE.inOut }}
        />
      )}
      <span className="nav-capsule-icon relative grid shrink-0 place-items-center">{icon}</span>
      <span className="nav-capsule-label relative truncate text-[12.5px] font-medium whitespace-nowrap">
        {label}
      </span>
    </Link>
  );
}

/* ---------------------------------------------------------------------------
 * Date field (T-5.09)
 *
 * Replaces `<input type="date">` with a calendar whose *value* is the same
 * `YYYY-MM-DD` string the native control produced.
 *
 * What is preserved, deliberately and verifiably:
 *  - the bound value is a plain string in `YYYY-MM-DD`, never a `Date`, so the
 *    API contract and `projectSchema`'s regex stay the only format authority;
 *  - every day calculation is done in UTC (`Date.UTC` + `getUTC*`), the exact
 *    arithmetic `projectSchema` uses to reject things like `2026-02-30`, so the
 *    grid, the highlighted day and the server can never disagree about a date
 *    because of the browser's timezone;
 *  - the native input's own `min`/`max` limits are not invented here. Where the
 *    caller passed none, none is enforced; the `bounds` prop exists so a future
 *    caller can pass the same limits the native field had;
 *  - nothing is cleared or defaulted on open. An empty field stays empty until
 *    the user picks, so validation still runs on submit exactly where it did.
 *
 * What is new: the surface, the month header, keyboard movement, and a selected
 * state you can actually see.
 * ------------------------------------------------------------------------- */

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const;
const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const PAD = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` → the same calendar day in UTC, or `null` if it is not one. */
function parseIso(value: string): { y: number; m: number; d: number } | null {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

const toIso = (y: number, m: number, d: number) => `${y}-${PAD(m)}-${PAD(d)}`;

/** Days in a month, in UTC: day 0 of the next month is the last of this one. */
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Monday-first index (0 = Monday) of the first of the month. */
const firstWeekday = (y: number, m: number) => (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;

/** Today in the visitor's own timezone, converted once to an ISO string. */
function todayIso(): string {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Why "today" is read lazily instead of at render.
 *
 * Next.js refuses a `new Date()` that runs during prerender (it would bake the
 * build machine's clock into the static HTML), and React's own lint rules
 * refuse the obvious workaround of setting it from an effect, because that is a
 * cascading render. So nothing reads the clock while the field is closed: the
 * date is resolved inside the click handler, the first moment a real user is
 * looking at the calendar. The field then renders today's ring and the
 * "Hari ini" jump, and the server-rendered HTML stays clock-free.
 */

/** "12 Maret 2026". Display only; never parsed back. */
function formatHuman(value: string): string {
  const parts = parseIso(value);
  if (!parts) return value;
  return `${parts.d} ${MONTHS[parts.m - 1]} ${parts.y}`;
}

export function DateField({
  id,
  value,
  onChange,
  /** Same limits a native `min`/`max` would have carried. Optional. */
  bounds,
  disabled,
  invalid,
  describedBy,
  className = '',
  fieldClassName,
}: {
  id: string;
  /** `YYYY-MM-DD`, or `''` when nothing is chosen. */
  value: string;
  onChange: (next: string) => void;
  bounds?: { min?: string; max?: string };
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  /** The field height the surrounding form uses (e.g. `h-11`, `h-10`). */
  fieldClassName?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const selected = parseIso(value);

  const [open, setOpen] = useState(false);
  // The month on screen starts on the selection, or on nothing at all. Nothing
  // is shown until the panel opens, so an empty initial value is never visible.
  const [view, setView] = useState(() =>
    selected ? { y: selected.y, m: selected.m } : { y: 0, m: 0 },
  );
  // Resolved on first open, then reused: null means "no user has opened this
  // field yet", not "unknown date".
  const [today, setToday] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // The day the arrow keys are on, independent of the committed value: moving
  // the cursor must not select a date, and Enter commits only that day.
  const [cursor, setCursor] = useState<{ y: number; m: number; d: number } | null>(null);

  const min = bounds?.min ? parseIso(bounds.min) : null;
  const max = bounds?.max ? parseIso(bounds.max) : null;

  const isDisabledDay = (y: number, m: number, d: number) => {
    const iso = toIso(y, m, d);
    if (min && iso < toIso(min.y, min.m, min.d)) return true;
    if (max && iso > toIso(max.y, max.m, max.d)) return true;
    return false;
  };

  const focusDay = (y: number, m: number, d: number) => {
    // Deferred so it lands after the re-render that paints the target month.
    requestAnimationFrame(() => {
      const node = gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${toIso(y, m, d)}"]`);
      node?.focus();
    });
  };

  const openCalendar = () => {
    // The clock is read here, in the user's own click, never during prerender
    // and never in an effect. Every open after the first reuses the value.
    const iso = today ?? todayIso();
    if (today === null) setToday(iso);
    const start =
      selected ??
      parseIso(iso) ?? {
        y: view.y || Math.max(2000, parseInt(iso.slice(0, 4), 10)),
        m: view.m || 1,
        d: 1,
      };
    setView({ y: start.y, m: start.m });
    setCursor(start);
    setOpen(true);
    requestAnimationFrame(() => {
      const node = gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${toIso(start.y, start.m, start.d)}"]`);
      (node ?? gridRef.current)?.focus();
    });
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const commit = (y: number, m: number, d: number) => {
    if (isDisabledDay(y, m, d)) return;
    onChange(toIso(y, m, d));
    close(true);
  };

  const shiftMonth = (delta: number) => {
    const monthIndex = view.y * 12 + (view.m - 1) + delta;
    const y = Math.floor(monthIndex / 12);
    const m = (monthIndex % 12) + 1;
    setView({ y, m });
    // Keep the cursor inside the visible month so arrows resume sensibly.
    const d = Math.min(cursor?.d ?? 1, daysInMonth(y, m));
    setCursor({ y, m, d });
  };

  // Close on an outside press and on Escape. Same contract as the mobile
  // drawer: Escape returns focus to the control that opened the panel.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // Capture phase: the grid's own keydown handler runs first on the bubble
    // path, and a focused grid cell must never swallow Escape.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  /** Grid keyboard model: arrows move a day, PageUp/Down a month, Home/End a week. */
  const onGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!cursor) return;
    const { y, m, d } = cursor;
    const move = (nextY: number, nextM: number, nextD: number) => {
      event.preventDefault();
      setCursor({ y: nextY, m: nextM, d: nextD });
      if (nextY !== view.y || nextM !== view.m) setView({ y: nextY, m: nextM });
      focusDay(nextY, nextM, nextD);
    };
    // Step across a month boundary by converting to a real UTC date first.
    const step = (deltaDays: number) => {
      const dt = new Date(Date.UTC(y, m - 1, d) + deltaDays * 86400000);
      move(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    };

    switch (event.key) {
      case 'ArrowLeft':
        return step(-1);
      case 'ArrowRight':
        return step(1);
      case 'ArrowUp':
        return step(-7);
      case 'ArrowDown':
        return step(7);
      case 'Home':
        return step(-((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7));
      case 'End':
        return step(6 - ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7));
      case 'PageUp':
        return move(
          m === 1 ? y - 1 : y,
          m === 1 ? 12 : m - 1,
          Math.min(d, daysInMonth(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1)),
        );
      case 'PageDown':
        return move(
          m === 12 ? y + 1 : y,
          m === 12 ? 1 : m + 1,
          Math.min(d, daysInMonth(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1)),
        );
      case 'Enter':
        event.preventDefault();
        return commit(y, m, d);
      case ' ':
        event.preventDefault();
        return commit(y, m, d);
      case 'Tab':
        return close(false);
      default:
        return;
    }
  };

  const total = daysInMonth(view.y, view.m);
  const lead = firstWeekday(view.y, view.m);
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (open ? close(false) : openCalendar())}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`date-trigger ${FIELD} flex items-center justify-between gap-2 text-left font-mono tabular-nums ${
          fieldClassName ?? 'h-11'
        }`}
      >
        {/* `whitespace-nowrap`: "15 November 2026" wrapped onto two lines inside
            the 44px field on a 390px screen, which broke the field's height. */}
        <span className={`truncate whitespace-nowrap ${selected ? 'text-ink' : 'text-fog'}`}>
          {selected ? formatHuman(value) : 'Pilih tanggal'}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 text-muted"
        >
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M3.5 9.6h17M8.2 3.4v3.2M15.8 3.4v3.2" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="false"
            aria-label="Pilih tanggal"
            initial={reduced ? false : { opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: reduced ? 0 : DURATION.data, ease: EASE.out }}
            className="cal-panel absolute top-[calc(100%+8px)] left-0 z-50 w-[min(19.5rem,calc(100vw-2.5rem))] rounded-[var(--radius-plate)] p-3 shadow-[0_0_0_1px_var(--line-strong),0_18px_40px_-16px_rgba(11,18,32,0.28)]"
          >
            <div className="cal-head mb-2 flex items-center justify-between gap-1 px-1 py-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Bulan sebelumnya"
                className="cal-nav grid h-8 w-8 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M14.5 6 8.5 12l6 6" />
                </svg>
              </button>
              <p aria-live="polite" className="text-[13px] font-medium text-ink">
                {MONTHS[view.m - 1]} {view.y}
              </p>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Bulan berikutnya"
                className="cal-nav grid h-8 w-8 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M9.5 6l6 6-6 6" />
                </svg>
              </button>
            </div>

            <div className="cal-weekdays grid grid-cols-7 gap-0.5 pb-1" aria-hidden="true">
              {WEEKDAYS.map((day) => (
                <span key={day} className="py-1 text-center font-mono text-[10px] tracking-[0.04em] uppercase">
                  {day}
                </span>
              ))}
            </div>

            <div
              ref={gridRef}
              role="grid"
              aria-label="Tanggal"
              tabIndex={-1}
              onKeyDown={onGridKeyDown}
              className="mt-1 grid grid-cols-7 gap-0.5 outline-none"
            >
              {cells.map((day, index) => {
                if (day === null) return <span key={`pad-${index}`} aria-hidden="true" />;
                const iso = toIso(view.y, view.m, day);
                const isSelected = selected !== null && iso === value;
                const isToday = today !== null && iso === today;
                const isCursor = cursor !== null && toIso(cursor.y, cursor.m, cursor.d) === iso;
                const dayDisabled = isDisabledDay(view.y, view.m, day);
                return (
                  <button
                    key={iso}
                    type="button"
                    role="gridcell"
                    data-day={iso}
                    tabIndex={isCursor ? 0 : -1}
                    aria-selected={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    data-today={isToday ? 'true' : undefined}
                    disabled={dayDisabled}
                    onClick={() => commit(view.y, view.m, day)}
                    onFocus={() => setCursor({ y: view.y, m: view.m, d: day })}
                    className={[
                      'cal-day relative grid h-9 place-items-center rounded-[9px] font-mono text-[12.5px] tabular-nums',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                      isSelected ? '' : 'text-ink hover:bg-mist',
                    ].join(' ')}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="cal-foot mt-2 flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const parts = today ? parseIso(today) : null;
                  if (!parts) return;
                  setView({ y: parts.y, m: parts.m });
                  setCursor(parts);
                  focusDay(parts.y, parts.m, parts.d);
                }}
                disabled={today === null}
                className="rounded-full px-2 py-1 text-[11.5px] font-medium text-accent-strong transition-colors duration-150 hover:bg-accent-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Hari ini
              </button>
              {value ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    close(true);
                  }}
                  className="rounded-full px-2 py-1 text-[11.5px] text-muted transition-colors duration-150 hover:bg-mist hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Hapus
                </button>
              ) : (
                <span />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
