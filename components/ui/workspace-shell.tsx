'use client';

import { usePathname } from 'next/navigation';
import { RadialSidebar, buildRadialItems } from '@/components/ui/radial-sidebar';

/**
 * Workspace shell (T-5.16).
 *
 * This file used to be the workspace chrome: a 260px glass rail on desktop, a
 * drawer plus a sticky top bar with a breadcrumb below lg, and a `--rail-offset`
 * that pushed every page 284px to the right to clear the rail.
 *
 * All of that is now one shared Radial Sidebar, so what is left here is the part
 * that is genuinely workspace-shaped: the project code, which the radial menu has
 * no room to carry as a heading, is still the page's context. The shell keeps a
 * single mobile line stating which project the reader is in, because the hub is
 * deliberately not a wall of text.
 *
 * Why the offset is gone: the radial menu is a 56px fixed circle over the canvas,
 * not a column in the layout. Pages reclaim the full width they had before
 * T-5.03, which is the main practical win of this redesign for the tasks form and
 * the score matrix.
 */
const CRUMB_LABELS: Record<string, string> = {
  members: 'Anggota',
  tasks: 'Tugas',
  result: 'Matriks',
};

export function WorkspaceShell({
  code,
  actions,
  children,
}: {
  /** The resolved project code. Empty while it is still resolving. */
  code: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const section = pathname?.split('/').filter(Boolean).pop() ?? '';
  const crumbLabel = CRUMB_LABELS[section] ?? null;
  const codeLabel = code || '…';

  return (
    <div className="min-h-[100dvh] text-ink">
      <RadialSidebar items={buildRadialItems(code)} />

      {/* One line of context, above the page. It is not a navigation: the hub is
          the navigation. It states the project code and the current section so a
          screenshot of this page is self-describing, and it is the only thing
          the old 260px rail carried that a radial menu cannot. */}
      <div className="workspace-context">
        <div className="workspace-context-inner">
          <nav aria-label="Breadcrumb" className="workspace-crumb">
            <ol>
              <li className="workspace-crumb-code" title={code ? `Kode proyek ${code}` : 'Kode proyek belum dimuat'}>
                {codeLabel}
              </li>
              {crumbLabel && (
                <>
                  <li aria-hidden="true" className="workspace-crumb-sep">
                    /
                  </li>
                  <li className="workspace-crumb-here" aria-current="page">
                    {crumbLabel}
                  </li>
                </>
              )}
            </ol>
          </nav>
          {actions ? <div className="workspace-context-actions">{actions}</div> : null}
        </div>
      </div>

      {children}
    </div>
  );
}
