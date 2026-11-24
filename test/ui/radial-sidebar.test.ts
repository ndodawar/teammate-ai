import { describe, it, expect } from 'vitest';
import { buildRadialItems } from '@/components/ui/radial-sidebar';

/**
 * T-5.16 radial sidebar, non-rendering contract.
 *
 * Vitest here runs in the `node` environment (see vitest.config.ts), so these
 * cases cover the one part of the component that is pure data: which
 * destinations the menu offers for a given project code. The interaction
 * behaviour (open/close, Escape, outside click, keyboard reachability, geometry,
 * overlap, overflow) is measured against the real browser by
 * `docs/t-5.16-evidence/tools/probe.mjs`, because a DOM simulation here would
 * prove nothing about the layout this task is actually about.
 *
 * What matters in these cases: the menu never invents a destination, never drops
 * one the product already had, and never points at `/p//...`.
 */
describe('T-5.16 radial sidebar destinations', () => {
  it('offers the workspace routes plus the two public pages for a real code', () => {
    const items = buildRadialItems('abc123');
    expect(items.map((item) => item.href)).toEqual([
      '/p/abc123/members',
      '/p/abc123/tasks',
      '/p/abc123/result',
      '/',
      '/how-it-works',
    ]);
  });

  it('labels every destination in Indonesian, matching the old rail', () => {
    const labels = buildRadialItems('abc123').map((item) => item.label);
    expect(labels).toEqual(['Anggota', 'Tugas', 'Matriks rekomendasi', 'Beranda', 'Cara kerja']);
  });

  it('drops the workspace links while the code is unresolved, so no /p// is built', () => {
    const items = buildRadialItems('');
    expect(items.map((item) => item.href)).toEqual(['/', '/how-it-works']);
    expect(items.some((item) => item.href.includes('//'))).toBe(false);
  });

  it('never emits a bare /p/ route when the code is empty', () => {
    for (const code of ['', '   ']) {
      const hrefs = buildRadialItems(code).map((item) => item.href);
      expect(hrefs.every((href) => !href.startsWith('/p/'))).toBe(true);
    }
  });

  it('url-encodes a code that needs it rather than pasting it raw', () => {
    const [first] = buildRadialItems('a b/c');
    expect(first.href).toBe('/p/a%20b%2Fc/members');
  });

  it('gives every destination an icon, so no ring item is a blank circle', () => {
    for (const item of buildRadialItems('abc123')) {
      expect(item.icon).toBeTruthy();
    }
  });

  it('has no duplicate destinations', () => {
    const hrefs = buildRadialItems('abc123').map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
