'use client';

import { usePathname } from 'next/navigation';
import { RadialSidebar, buildRadialItems } from '@/components/ui/radial-sidebar';

/**
 * Site navigation (T-5.16).
 *
 * This file used to own the public routes' chrome: a fixed capsule bar that
 * compacted on scroll, plus a compact dropdown panel, plus its own duplicate
 * destination list, plus a spacer element that reserved the bar's height.
 *
 * T-5.16 replaces all of it with the same Radial Sidebar the workspace routes
 * use, so the product has exactly ONE navigation for the first time. That is the
 * point of this file now: it is the public-route adapter, not a second nav.
 *
 * What was removed and why nothing is lost:
 *   - the capsule's destinations (`/`, `/how-it-works`, `/#scoring`) are now
 *     `Beranda`, `Cara kerja` and, on the homepage, the formula section is still
 *     reachable because it is part of the page the reader is already on;
 *   - the scroll-compaction behaviour existed only because a wide fixed bar
 *     covers content. A 56px circle does not, so the behaviour has nothing left
 *     to solve;
 *   - the reserved spacer existed only to compensate for the fixed bar's height.
 *     With nothing fixed at the top of the page, reserving space would now push
 *     the hero down by a bar that is not there.
 *
 * The workspace routes pass their project code; the public routes have no
 * project, so `buildRadialItems('')` returns the two public destinations and the
 * menu simply has fewer items.
 */
export function SiteNav() {
  const pathname = usePathname();

  // The workspace routes mount their own RadialSidebar through `WorkspaceShell`,
  // which knows the project code. Rendering a second one here would stack two
  // hubs on top of each other, which is the exact class of defect this task
  // removes.
  if (pathname.startsWith('/p/')) return null;

  return <RadialSidebar items={buildRadialItems('')} />;
}
