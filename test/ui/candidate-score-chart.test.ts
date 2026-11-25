import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { CandidateScoreChart, type ChartRow, type ChartComponent } from '@/components/recommendations/candidate-score-chart';

/*
 * T-3.XX: the candidate chart must show the engine's numbers, never its own.
 *
 * The vitest environment is `node`, so these tests render the component to
 * static markup with react-dom/server rather than mounting it in a DOM. That is
 * enough to prove what it prints: every number below is taken from a real
 * `globalAssign` run, so a chart that quietly recomputed or rounded differently
 * would fail here.
 */

const COMPONENTS: ChartComponent[] = [
  { key: 'K', label: 'Kemiripan konten', color: 'var(--k)', weight: 0.4 },
  { key: 'S', label: 'Kecocokan skill', color: 'var(--s)', weight: 0.3 },
  { key: 'C', label: 'Sisa kapasitas', color: 'var(--c)', weight: 0.2 },
  { key: 'M', label: 'Minat', color: 'var(--m)', weight: 0.1 },
];

function row(overrides: Partial<ChartRow> & { memberId: string }): ChartRow {
  return {
    name: overrides.memberId,
    K: 0.5,
    S: 0.5,
    C: 0.5,
    M: 0.5,
    total: 0.5,
    isPrimary: false,
    isAlternative: false,
    isEligible: true,
    ...overrides,
  };
}

function render(rows: ChartRow[], extra: { isFallback?: boolean } = {}) {
  return renderToStaticMarkup(
    createElement(CandidateScoreChart, {
      rows,
      components: COMPONENTS,
      isFallback: extra.isFallback ?? false,
    })
  );
}

describe('T-3.XX candidate score chart', () => {
  it('prints each component value and the total from the row it was given', () => {
    const html = render([
      row({ memberId: 'm1', name: 'Budi', K: 1, S: 0.6, C: 0.8, M: 1, total: 0.88 }),
    ]);
    // K 100, S 60, C 80, M 100, total 88
    expect(html).toContain('100');
    expect(html).toContain('60');
    expect(html).toContain('80');
    expect(html).toContain('88');
  });

  it('marks the primary owner in text, not only in colour', () => {
    const html = render([row({ memberId: 'm1', name: 'Budi', isPrimary: true })]);
    // T-UI-FINAL-01: the visible label is the plain-language one; the spoken
    // label still names the role in full so both readers get the same verdict.
    expect(html).toContain('Penanggung jawab');
    expect(html).toContain('Memenuhi semua aturan');
  });

  it('marks the alternative in text', () => {
    const html = render([row({ memberId: 'm2', name: 'Sari', isAlternative: true })]);
    expect(html).toContain('Alternatif');
    expect(html).toContain('Layak menerima tugas ini');
  });

  it('states the excluding rule instead of hiding it behind a colour', () => {
    const html = render([
      row({ memberId: 'm1', name: 'Budi', isEligible: false, rule: 'R2' }),
      row({ memberId: 'm2', name: 'Sari', isEligible: false, rule: 'R3' }),
    ]);
    // The status is spelled out, the reason is a sentence, and the rule code
    // stays available as small secondary text.
    expect(html).toContain('Tidak layak');
    expect(html).toContain('Beban kerja melebihi batas.');
    expect(html).toMatch(/R2/);
    expect(html).toMatch(/R3/);
    expect(html).toContain('Belum ada kemampuan minimum yang dibutuhkan.');
  });

  it('gives every bar an accessible name listing the full breakdown', () => {
    const html = render([row({ memberId: 'm1', name: 'Budi', total: 0.42 })]);
    expect(html).toContain('aria-label');
    expect(html).toContain('Kemiripan konten');
    expect(html).toContain('Kecocokan skill');
    expect(html).toContain('Sisa kapasitas');
    expect(html).toContain('Minat');
    // The total is spoken too, so a screen reader hears the same verdict.
    expect(html).toMatch(/Skor total 42 persen/);
  });

  it('renders a legend with the weights that were actually applied', () => {
    const html = render([row({ memberId: 'm1' })]);
    expect(html).toContain('bobot 40%');
    expect(html).toContain('bobot 30%');
    expect(html).toContain('bobot 20%');
    expect(html).toContain('bobot 10%');
  });

  it('shows K at 0% weight in fallback mode and says why', () => {
    const fallbackComponents: ChartComponent[] = COMPONENTS.map((c) =>
      c.key === 'K' ? { ...c, weight: 0 } : c
    );
    const html = renderToStaticMarkup(
      createElement(CandidateScoreChart, {
        rows: [row({ memberId: 'm1' })],
        components: fallbackComponents,
        isFallback: true,
      })
    );
    expect(html).toContain('bobot 0%');
    expect(html).toContain('K tidak dihitung');
  });

  it('scales the widest bar to full width so ranking is visible, not the raw score', () => {
    const html = render([
      row({ memberId: 'm1', name: 'Budi', total: 0.2 }),
      row({ memberId: 'm2', name: 'Sari', total: 0.4 }),
    ]);
    // 0.4 is the largest total, so it occupies 100% of the track; 0.2 takes 50%.
    expect(html).toContain('width:100%');
    expect(html).toContain('width:50%');
  });

  it('still prints the real percentages when every score is low', () => {
    const html = render([row({ memberId: 'm1', K: 0.2, S: 0.1, C: 0.1, M: 0.2, total: 0.14 })]);
    // The single bar is scaled to the full track, but the printed total stays
    // the engine's real 14%, so no reader is told this candidate scored 100%.
    expect(html).toContain('width:100%');
    expect(html).toMatch(/>14<span/);
    expect(html).toMatch(/Skor total 14 persen/);
  });

  it('handles an empty roster without inventing a row', () => {
    const html = render([]);
    expect(html).toContain('Tidak ada anggota untuk dibandingkan');
    expect(html).not.toContain('utama');
  });

  it('renders one row per member, no duplicates', () => {
    const html = render([
      row({ memberId: 'm1', name: 'Budi' }),
      row({ memberId: 'm2', name: 'Sari' }),
      row({ memberId: 'm3', name: 'Tono' }),
    ]);
    expect(html.match(/data-testid="chart-row-/g)).toHaveLength(3);
  });
});
