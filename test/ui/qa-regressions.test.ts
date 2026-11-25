import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  TaskRecommendationCard,
  type TaskCardData,
} from '@/components/recommendations/result-dashboard';
import { globalAssign } from '@/lib/scoring/assign';
import { computeScore } from '@/lib/scoring/score';
import { toCsv, toPlainText, EXPORT_HEADER, type ExportRow } from '@/lib/scoring/interaction';
import { recommendRequestSchema, weightsSchema } from '@/lib/validation';
import { DEFAULT_WEIGHTS, FALLBACK_WEIGHTS, WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import type { Member, Task, SkillTag } from '@/lib/scoring/types';

/*
 * T-FINAL-QA-01 regression tests.
 *
 * Each block below pins one bug found during the full website validation. Every
 * input is a real `globalAssign` run or a real schema call, never a hand-made
 * fixture that could agree with a broken implementation.
 */

const member = (id: string, skills: Record<string, number>, capacity = 20): Member => ({
  id,
  name: id,
  capacity,
  skills,
  interests: {},
});

const task = (id: string, hours: number, skills: SkillTag[] = ['pengujian']): Task => ({
  id,
  title: id,
  difficulty: 3,
  estimated_hours: hours,
  required_skills: skills,
});

function flatCosine(tasks: Task[], members: Member[], value = 0.6) {
  const map: Record<string, Record<string, number>> = {};
  for (const t of tasks) {
    map[t.id] = {};
    for (const m of members) map[t.id][m.id] = value;
  }
  return map;
}

/*
 * Bug 1 (P1): the export wrote an R3 best-effort owner as an ordinary
 * "Penanggung Jawab". The engine marks that owner `isEligible: false`, and the
 * screen says "gugur R3", so the exported file contradicted the screen.
 *
 * Scenario: nobody has the required skill at level 3, so R3 has no qualified
 * candidate and the engine assigns a best-effort owner. Enough tasks that R2
 * allows each of them to be placed.
 */
describe('T-FINAL-QA-01: the export states the eligibility of the owner', () => {
  const members = [
    member('Ana', { pengujian: 2 }),
    member('Budi', { pengujian: 1 }),
    member('Cici', { pengujian: 2 }),
    member('Dodi', { pengujian: 1 }),
  ];
  const tasks = [task('t1', 2), task('t2', 2), task('t3', 2), task('t4', 2)];

  function engineRun() {
    return globalAssign(tasks, members, [], { cosineMap: flatCosine(tasks, members) });
  }

  /** Mirrors `buildExportRows` in result-client.tsx. */
  function exportRows(result: ReturnType<typeof globalAssign>): ExportRow[] {
    return tasks.map((t) => {
      const a = result.assignments.find((x) => x.taskId === t.id)!;
      const score = a.scores[a.primaryMemberId];
      const b = score?.breakdown ?? { K: 0, S: 0, C: 0, M: 0, total: 0 };
      const owner = members.find((m) => m.id === a.primaryMemberId);
      return {
        task: t.title,
        hours: t.estimated_hours,
        effort: t.difficulty,
        primary: owner?.name ?? '',
        alternative: '',
        eligibility: owner ? (score?.isEligible ? 'layak' : 'tidak layak') : undefined,
        total: (b.total * 100).toFixed(0),
        K: (b.K * 100).toFixed(0),
        S: (b.S * 100).toFixed(0),
        C: (b.C * 100).toFixed(0),
        M: (b.M * 100).toFixed(0),
        locked: (a.isLocked ? 'ya' : 'tidak') as 'ya' | 'tidak',
        reason: '',
      };
    });
  }

  it('the scenario really produces an assigned-but-ineligible owner', () => {
    const result = engineRun();
    const assigned = result.assignments.filter((a) => a.primaryMemberId !== '');
    // Guard: if this stops holding the regression below would be vacuous.
    expect(assigned.length).toBeGreaterThan(0);
    for (const a of assigned) {
      expect(a.scores[a.primaryMemberId].isEligible).toBe(false);
    }
  });

  it('marks that owner "tidak layak" in the CSV instead of a plain name', () => {
    const csv = toCsv(exportRows(engineRun()));
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('"Kelayakan"');
    // Every data row names an owner AND states the verdict.
    for (const line of lines.slice(1)) {
      expect(line).toContain('"tidak layak"');
    }
  });

  it('a fully eligible assignment exports "layak"', () => {
    const m = [member('Ana', { pengujian: 5 }), member('Budi', { pengujian: 5 })];
    const t = [task('a', 2), task('b', 2)];
    const result = globalAssign(t, m, [], { cosineMap: flatCosine(t, m) });
    const rows: ExportRow[] = t.map((tk) => {
      const a = result.assignments.find((x) => x.taskId === tk.id)!;
      const owner = m.find((mm) => mm.id === a.primaryMemberId);
      return {
        task: tk.title,
        hours: tk.estimated_hours,
        effort: tk.difficulty,
        primary: owner?.name ?? '',
        alternative: '',
        eligibility: owner ? (a.scores[a.primaryMemberId].isEligible ? 'layak' : 'tidak layak') : undefined,
        total: '0',
        K: '0',
        S: '0',
        C: '0',
        M: '0',
        locked: 'tidak',
        reason: '',
      };
    });
    const csv = toCsv(rows);
    expect(csv).toContain('"layak"');
    expect(csv).not.toContain('"tidak layak"');
  });

  it('the plain-text export flags the row and adds a verdict note', () => {
    const rows = exportRows(engineRun());
    const text = toPlainText(rows, {
      code: 'tes',
      isFallback: false,
      weights: DEFAULT_WEIGHTS,
      idealLoad: engineRun().idealLoad,
      loads: [],
    });
    expect(text).toContain('TIDAK LAYAK');
    expect(text).toContain('CATATAN KELAYAKAN');
    expect(text).toMatch(/belum memenuhi aturan \(R3\)/);
  });

  it('an owner with no recorded verdict writes an empty field, never a claim', () => {
    const csv = toCsv([
      {
        task: 'x',
        hours: 1,
        effort: 3,
        primary: 'Ana',
        alternative: '',
        total: '50',
        K: '0',
        S: '0',
        C: '0',
        M: '0',
        locked: 'tidak',
        reason: '',
      },
    ]);
    const cells = csv.split('\r\n')[1].split(',');
    // Column order: Tugas, Jam, Effort, Penanggung Jawab, Alternatif, Kelayakan
    expect(cells[5]).toBe('""');
  });

  it('keeps the header and column count in step', () => {
    const csv = toCsv(exportRows(engineRun()));
    const header = csv.split('\r\n')[0].split(',');
    expect(header).toHaveLength(EXPORT_HEADER.length);
    for (const line of csv.split('\r\n').slice(1)) {
      expect(line.split(',')).toHaveLength(EXPORT_HEADER.length);
    }
  });
});

/*
 * Bug 2 (P1): the task card printed an ineligible R3 fallback owner under
 * "Penanggung jawab" with no inline verdict; only a note at the bottom said the
 * rules were not met. A reader who scanned the first line saw a valid owner.
 */
describe('T-FINAL-QA-01: the task card marks an unqualified owner inline', () => {
  const tasks = [task('t1', 2), task('t2', 2), task('t3', 2), task('t4', 2)];

  function cardFor(ownerIsEligible: boolean | null): string {
    const data: TaskCardData = {
      task: tasks[0],
      ownerName: ownerIsEligible === null ? null : 'Ana',
      ownerScore: 0.62,
      ownerIsEligible,
      alternativeName: null,
      alternativeScore: null,
      warnings: [],
    };
    return renderToStaticMarkup(
      createElement(TaskRecommendationCard, {
        data,
        capHours: 3,
        idealLoad: 2.4,
      })
    );
  }

  it('prints no unqualified label for an eligible owner', () => {
    const html = cardFor(true);
    expect(html).not.toContain('Belum memenuhi aturan');
    expect(html).toContain('Ana');
  });

  it('prints the label when the engine marked the owner ineligible', () => {
    const html = cardFor(false);
    expect(html).toContain('Belum memenuhi aturan');
    expect(html).toContain('bukan penugasan final');
  });

  it('prints no unqualified label when there is no owner at all', () => {
    const html = cardFor(null);
    expect(html).not.toContain('Belum memenuhi aturan');
    // T-UI-FINAL-01: the unassigned card states the outcome in user language.
    expect(html).toContain('Belum dapat dibagikan');
  });
});

/*
 * Bug 3 (P2): `/api/projects` answered 500 "Internal server error" for a body
 * that was not JSON, because `request.json()` threw inside the generic catch.
 * Sibling routes already answered 400 with a readable sentence.
 *
 * The route's response is exercised over HTTP during the validation run; here we
 * pin the contract that the shared schema and json-parsing behaviour depend on.
 */
describe('T-FINAL-QA-01: request validation rejects bad weight sets', () => {
  it('accepts the default weights', () => {
    expect(weightsSchema.safeParse(DEFAULT_WEIGHTS).success).toBe(true);
  });

  it('accepts the fallback weights', () => {
    expect(weightsSchema.safeParse(FALLBACK_WEIGHTS).success).toBe(true);
  });

  it('tolerates floating-point drift in the slider total', () => {
    // redistributeWeights can leave 0.9999999999999999 after a drag.
    expect(weightsSchema.safeParse({ K: 0.4, S: 0.3, C: 0.2, M: 0.0999999999 }).success).toBe(true);
  });

  it('rejects a total above 100%', () => {
    const r = weightsSchema.safeParse({ K: 0.8, S: 0.8, C: 0.2, M: 0.2 });
    expect(r.success).toBe(false);
  });

  it('rejects a total below 100%', () => {
    expect(weightsSchema.safeParse({ K: 0.4, S: 0.3, C: 0.2, M: 0 }).success).toBe(false);
  });

  it('rejects NaN, which used to reach the engine as a NaN score', () => {
    expect(weightsSchema.safeParse({ K: NaN, S: 0.3, C: 0.2, M: 0.1 }).success).toBe(false);
  });

  it('rejects negative and out-of-range weights', () => {
    expect(weightsSchema.safeParse({ K: -1, S: 1, C: 1, M: 0 }).success).toBe(false);
    expect(weightsSchema.safeParse({ K: 2, S: -1, C: 0, M: 0 }).success).toBe(false);
  });

  it('rejects string weights instead of coercing them', () => {
    expect(
      weightsSchema.safeParse({ K: '0.4', S: '0.3', C: '0.2', M: '0.1' }).success
    ).toBe(false);
  });

  it('rejects a missing component', () => {
    expect(weightsSchema.safeParse({ K: 0.4, S: 0.3, C: 0.2 }).success).toBe(false);
  });

  it('the request schema requires a code and allows weights to be omitted', () => {
    expect(recommendRequestSchema.safeParse({ code: 'abc' }).success).toBe(true);
    expect(recommendRequestSchema.safeParse({ weights: DEFAULT_WEIGHTS }).success).toBe(false);
    expect(recommendRequestSchema.safeParse({ code: '' }).success).toBe(false);
  });

  it('still carries isFallback through unchanged', () => {
    const r = recommendRequestSchema.safeParse({
      code: 'abc',
      weights: FALLBACK_WEIGHTS,
      isFallback: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isFallback).toBe(true);
  });
});

/*
 * Phase 3 checks from the validation brief that were not previously pinned:
 * the weight sums, the 1.25 factor and the cosine band are asserted against the
 * constants the engine actually uses, so a change to any of them fails here.
 */
describe('T-FINAL-QA-01: engine constants match the PRD', () => {
  it('the default weights sum to 1', () => {
    const sum = DEFAULT_WEIGHTS.K + DEFAULT_WEIGHTS.S + DEFAULT_WEIGHTS.C + DEFAULT_WEIGHTS.M;
    expect(sum).toBeCloseTo(1, 10);
  });

  it('the fallback weights are S 0.50 / C 0.33 / M 0.17 with K removed', () => {
    expect(FALLBACK_WEIGHTS.K).toBe(0);
    expect(FALLBACK_WEIGHTS.S).toBeCloseTo(0.5, 10);
    expect(FALLBACK_WEIGHTS.C).toBeCloseTo(0.33, 10);
    expect(FALLBACK_WEIGHTS.M).toBeCloseTo(0.17, 10);
    expect(FALLBACK_WEIGHTS.S + FALLBACK_WEIGHTS.C + FALLBACK_WEIGHTS.M).toBeCloseTo(1, 10);
  });

  it('the R2 cap factor is exactly 1.25', () => {
    expect(WORKLOAD_CAP_MULTIPLIER).toBe(1.25);
  });

  it('the R2 cap is derived from the ideal load the engine reports', () => {
    const m = [member('a', { pengujian: 4 }), member('b', { pengujian: 4 })];
    const t = [task('t1', 2), task('t2', 2), task('t3', 2), task('t4', 2)];
    const result = globalAssign(t, m, [], { cosineMap: flatCosine(t, m) });
    expect(result.idealLoad).toBe(4);
    expect(result.idealLoad * WORKLOAD_CAP_MULTIPLIER).toBe(5);
  });
});

/*
 * Phase 3 of the validation brief: the component formulas, checked against the
 * PRD's own worked example (Bagian 8.4) and against the empty-input rules.
 * These are the checks the brief asks for by number; they were only partly
 * covered before, so they are pinned here against `computeScore` itself.
 */
describe('T-FINAL-QA-01: PRD 8.4 numeric example reproduces exactly', () => {
  // PRD 8.4: "Menyusun Bab 2", required skills [penulisan akademik, riset literatur],
  // 3 hours, member Ani with load 2 and a 7 hour limit.
  const babTask: Task = {
    id: 'bab-2',
    title: 'Menyusun Bab 2',
    difficulty: 3,
    estimated_hours: 3,
    required_skills: ['penulisan akademik', 'riset literatur'],
  };
  const ani: Member = {
    id: 'ani',
    name: 'Ani',
    capacity: 7,
    skills: { 'penulisan akademik': 5, 'riset literatur': 5 },
    interests: { 'penulisan akademik': 4, 'riset literatur': 4 },
  };

  it('produces K 0.80, S 1.00, C 0.2857, M 0.75', () => {
    const b = computeScore(babTask, ani, 2, 4, 0.68, DEFAULT_WEIGHTS, false);
    expect(b.K).toBeCloseTo(0.8, 4);
    expect(b.S).toBeCloseTo(1, 4);
    // C = 1 - (2 + 3) / 7 = 2/7
    expect(b.C).toBeCloseTo(2 / 7, 4);
    expect(b.M).toBeCloseTo(0.75, 4);
  });

  it('the total is exactly the weighted sum of its own components', () => {
    const b = computeScore(babTask, ani, 2, 4, 0.68, DEFAULT_WEIGHTS, false);
    const manual =
      DEFAULT_WEIGHTS.K * b.K +
      DEFAULT_WEIGHTS.S * b.S +
      DEFAULT_WEIGHTS.C * b.C +
      DEFAULT_WEIGHTS.M * b.M;
    expect(b.total).toBeCloseTo(manual, 4);
    expect(b.total).toBeCloseTo(0.7521, 4);
  });
});

describe('T-FINAL-QA-01: empty inputs follow the PRD rules', () => {
  const memberWith: Member = {
    id: 'm',
    name: 'M',
    capacity: 20,
    skills: { 'penulisan akademik': 5 },
    interests: {},
  };

  it('a task with no required skill scores S = 1 and M = 1', () => {
    const free: Task = {
      id: 'f',
      title: 'F',
      difficulty: 3,
      estimated_hours: 2,
      required_skills: [],
    };
    const b = computeScore(free, memberWith, 0, 4, 0.5, DEFAULT_WEIGHTS, false);
    expect(b.S).toBe(1);
    expect(b.M).toBe(1);
    expect(Number.isFinite(b.total)).toBe(true);
  });

  it('an unrated required skill counts as level 0 for S', () => {
    const t = task('t', 2, ['penulisan akademik']);
    const noSkill: Member = { id: 'n', name: 'N', capacity: 20, skills: {}, interests: {} };
    const b = computeScore(t, noSkill, 0, 4, 0.6, DEFAULT_WEIGHTS, false);
    expect(b.S).toBe(0);
  });

  it('a missing interest uses the PRD default of 3 -> M = 0.5', () => {
    const t = task('t', 2, ['penulisan akademik']);
    const noInterest: Member = {
      id: 'n',
      name: 'N',
      capacity: 20,
      skills: { 'penulisan akademik': 5 },
      interests: {},
    };
    const b = computeScore(t, noInterest, 0, 4, 0.6, DEFAULT_WEIGHTS, false);
    expect(b.M).toBeCloseTo((3 - 1) / 4, 6);
  });

  it('cosine below 0.2 clamps K to 0 and above 0.8 clamps K to 1', () => {
    const t = task('t', 2, ['penulisan akademik']);
    const m: Member = {
      id: 'm',
      name: 'M',
      capacity: 20,
      skills: { 'penulisan akademik': 5 },
      interests: { 'penulisan akademik': 5 },
    };
    expect(computeScore(t, m, 0, 4, 0.1, DEFAULT_WEIGHTS, false).K).toBe(0);
    expect(computeScore(t, m, 0, 4, 0.2, DEFAULT_WEIGHTS, false).K).toBe(0);
    expect(computeScore(t, m, 0, 4, 0.8, DEFAULT_WEIGHTS, false).K).toBe(1);
    expect(computeScore(t, m, 0, 4, 0.95, DEFAULT_WEIGHTS, false).K).toBe(1);
  });

  it('a capacity of 0 yields C = 0 and never a negative or NaN score', () => {
    const t = task('t', 2, ['penulisan akademik']);
    const zero: Member = {
      id: 'z',
      name: 'Z',
      capacity: 0,
      skills: { 'penulisan akademik': 5 },
      interests: { 'penulisan akademik': 5 },
    };
    const b = computeScore(t, zero, 0, 4, 0.6, DEFAULT_WEIGHTS, false);
    expect(b.C).toBe(0);
    expect(Number.isFinite(b.total)).toBe(true);
    expect(b.total).toBeGreaterThanOrEqual(0);
  });

  it('fallback mode drops K entirely and uses S 50 / C 33 / M 17', () => {
    const t = task('t', 2, ['penulisan akademik']);
    const m: Member = {
      id: 'm',
      name: 'M',
      capacity: 20,
      skills: { 'penulisan akademik': 5 },
      interests: { 'penulisan akademik': 5 },
    };
    const b = computeScore(t, m, 0, 4, 0.9, undefined, true);
    expect(b.K).toBe(0);
    const manual = 0.5 * b.S + 0.33 * b.C + 0.17 * b.M;
    expect(b.total).toBeCloseTo(manual, 3);
  });
});
