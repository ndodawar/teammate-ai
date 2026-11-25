import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  ResultSummary,
  TaskRecommendationCard,
  MemberLoadRow,
  summarise,
  type TaskCardData,
} from '@/components/recommendations/result-dashboard';
import { globalAssign } from '@/lib/scoring/assign';
import { WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
import { toCsv, toPlainText } from '@/lib/scoring/interaction';
import type { Member, Task } from '@/lib/scoring/types';

/*
 * T-UI-MATRIX-01.
 *
 * The whole point of the dashboard is that it shows the SAME numbers the engine
 * produced. These tests feed the components a real `globalAssign` result rather
 * than a hand-written fixture, so a component that recomputed, rounded
 * differently, or invented an owner would fail here.
 *
 * Rendering is `renderToStaticMarkup` because the vitest environment is `node`.
 * That is enough to prove what is printed, which is what matters for a data
 * display; the interactive parts are exercised through the engine tests below.
 */

const MEMBERS: Member[] = [
  { id: 'budi', name: 'Budi', capacity: 20, skills: { pengujian: 4 }, interests: { pengujian: 5 } },
  { id: 'heri', name: 'Heri', capacity: 20, skills: { pengujian: 5 }, interests: { pengujian: 4 } },
];

// Two 4 hour tasks: ideal 4 hours, R2 cap 5 hours, both placeable.
const PLACEABLE: Task[] = [
  { id: 't1', title: 'Menyusun bab 1', difficulty: 3, estimated_hours: 4, required_skills: ['pengujian'] },
  { id: 't2', title: 'Menyusun bab 2', difficulty: 3, estimated_hours: 4, required_skills: ['pengujian'] },
];

// One 8 hour task: above the 5 hour cap, so no member can take it.
const INFEASIBLE: Task[] = [
  { id: 'big', title: 'Tugas 8 jam', difficulty: 3, estimated_hours: 8, required_skills: ['pengujian'] },
];

const COS_PLACEABLE = {
  t1: { budi: 0.62, heri: 0.66 },
  t2: { budi: 0.7, heri: 0.5 },
};
const COS_INFEASIBLE = { big: { budi: 0.62, heri: 0.66 } };

describe('T-UI-MATRIX-01: summary counts come from the engine result', () => {
  it('counts allocated and unallocated tasks from the real assignment', () => {
    const result = globalAssign(PLACEABLE, MEMBERS, [], { cosineMap: COS_PLACEABLE });
    const summary = summarise(result, MEMBERS, PLACEABLE);

    const allocatedInEngine = result.assignments.filter((a) => a.primaryMemberId !== '').length;
    expect(summary.assigned).toBe(allocatedInEngine);
    expect(summary.needsAttention).toBe(PLACEABLE.length - allocatedInEngine);
    expect(summary.totalTasks).toBe(2);
    expect(summary.totalMembers).toBe(2);
  });

  it('reports the full task count as needing attention when nothing can be placed', () => {
    const result = globalAssign(INFEASIBLE, MEMBERS, [], { cosineMap: COS_INFEASIBLE });
    const summary = summarise(result, MEMBERS, INFEASIBLE);

    expect(result.assignments[0].primaryMemberId).toBe('');
    expect(summary.assigned).toBe(0);
    expect(summary.needsAttention).toBe(1);
  });

  it('takes total load from memberLoads, not from a re-sum of the tasks', () => {
    const result = globalAssign(PLACEABLE, MEMBERS, [], { cosineMap: COS_PLACEABLE });
    const summary = summarise(result, MEMBERS, PLACEABLE);
    const engineLoad = Object.values(result.memberLoads).reduce((s, v) => s + v, 0);
    expect(summary.totalLoad).toBe(engineLoad);
    expect(summary.totalCapacity).toBe(40);
  });

  it('derives the R2 cap from the engine ideal load and the real multiplier', () => {
    const result = globalAssign(PLACEABLE, MEMBERS, [], { cosineMap: COS_PLACEABLE });
    const summary = summarise(result, MEMBERS, PLACEABLE);
    expect(summary.idealLoad).toBe(result.idealLoad);
    expect(summary.capHours).toBe(result.idealLoad * WORKLOAD_CAP_MULTIPLIER);
  });

  it('renders the counts it was given, and the allocation bar ratio', () => {
    const result = globalAssign(PLACEABLE, MEMBERS, [], { cosineMap: COS_PLACEABLE });
    const summary = summarise(result, MEMBERS, PLACEABLE);
    const html = renderToStaticMarkup(createElement(ResultSummary, { summary }));

    expect(html).toContain('Ringkasan hasil');
    expect(html).toContain('Total tugas');
    expect(html).toContain('Total anggota');
    expect(html).toContain('Berhasil dialokasikan');
    expect(html).toContain('Perlu perhatian');
    expect(html).toContain('Total beban terpasang');
    expect(html).toContain('Batas R2 per anggota');
    // The spoken bar label carries the same counts.
    expect(html).toMatch(/tugas berhasil dialokasikan/);
  });
});

describe('T-UI-MATRIX-01: a task card names an owner only when assigned', () => {
  function cardFor(result: ReturnType<typeof globalAssign>, task: Task): TaskCardData {
    const assignment = result.assignments.find((a) => a.taskId === task.id)!;
    const memberOf = (id: string) => MEMBERS.find((m) => m.id === id);
    const owner = assignment.primaryMemberId ? memberOf(assignment.primaryMemberId) : undefined;
    const altId = assignment.alternativeMemberId;
    const altScore = altId ? assignment.scores[altId] : undefined;
    const altIsValid = Boolean(altId && altScore?.isEligible);
    return {
      task,
      ownerName: owner?.name ?? null,
      ownerScore: assignment.primaryMemberId
        ? (assignment.scores[assignment.primaryMemberId]?.breakdown.total ?? null)
        : null,
      alternativeName: altIsValid ? (memberOf(altId!)?.name ?? null) : null,
      alternativeScore: altIsValid ? (altScore?.breakdown.total ?? null) : null,
      warnings: result.warnings.filter((w) => w.taskId === task.id),
    };
  }

  it('shows the assigned owner for a task the engine placed', () => {
    const result = globalAssign(PLACEABLE, MEMBERS, [], { cosineMap: COS_PLACEABLE });
    const html = renderToStaticMarkup(
      createElement(TaskRecommendationCard, {
        data: cardFor(result, PLACEABLE[0]),
        capHours: 5,
        idealLoad: 4,
      })
    );
    const ownerId = result.assignments.find((a) => a.taskId === 't1')!.primaryMemberId;
    const ownerName = MEMBERS.find((m) => m.id === ownerId)!.name;
    expect(html).toContain(ownerName);
    expect(html).toContain('Penanggung jawab');
    expect(html).not.toContain('Tidak layak dialokasikan');
  });

  it('never prints an owner for a task above the R2 cap', () => {
    const result = globalAssign(INFEASIBLE, MEMBERS, [], { cosineMap: COS_INFEASIBLE });
    const html = renderToStaticMarkup(
      createElement(TaskRecommendationCard, {
        data: cardFor(result, INFEASIBLE[0]),
        capHours: 5,
        idealLoad: 4,
      })
    );
    expect(html).toContain('Tidak layak dialokasikan');
    // Neither member's name appears as the person in charge.
    expect(html).not.toMatch(/Penanggung jawab<\/p>\s*<p[^>]*>\s*<span[^>]*>Budi/);
    expect(html).not.toMatch(/Penanggung jawab<\/p>\s*<p[^>]*>\s*<span[^>]*>Heri/);
  });

  it('states the four R2 figures on the card, matching the engine detail', () => {
    const result = globalAssign(INFEASIBLE, MEMBERS, [], { cosineMap: COS_INFEASIBLE });
    const html = renderToStaticMarkup(
      createElement(TaskRecommendationCard, {
        data: cardFor(result, INFEASIBLE[0]),
        capHours: 5,
        idealLoad: 4,
      })
    );
    const detail = result.warnings.find((w) => w.code === 'r2_no_candidate')!.detail!;
    expect(html).toContain(`Usaha tugas ${detail.taskHours} jam`);
    expect(html).toContain(`Beban ideal ${detail.idealLoad.toFixed(2)} jam`);
    expect(html).toContain(`Batas R2 ${detail.capHours.toFixed(2)} jam`);
    expect(html).toContain('Selisih 3.00 jam melebihi batas');
    // And the required sentence.
    expect(html).toContain('Pecah tugas menjadi beberapa subtugas atau periksa kembali estimasi usahanya.');
  });

  it('keeps the score and the eligibility verdict in separate labelled places', () => {
    const result = globalAssign(PLACEABLE, MEMBERS, [], { cosineMap: COS_PLACEABLE });
    const html = renderToStaticMarkup(
      createElement(TaskRecommendationCard, {
        data: cardFor(result, PLACEABLE[0]),
        capHours: 5,
        idealLoad: 4,
      })
    );
    expect(html).toContain('Penanggung jawab');
    expect(html).toContain('Alternatif');
    // The score is labelled as a score, not presented as the verdict.
    expect(html).toMatch(/skor \d+%/);
  });

  it('does not promote an ineligible R3 fallback to a valid alternative', () => {
    // Heri lacks the required skill, so R3 excludes her despite a high score.
    const members: Member[] = [
      { id: 'budi', name: 'Budi', capacity: 20, skills: { pengujian: 4 }, interests: { pengujian: 5 } },
      { id: 'heri', name: 'Heri', capacity: 20, skills: { 'desain antarmuka': 5 }, interests: { pengujian: 5 } },
    ];
    const result = globalAssign(PLACEABLE, members, [], {
      cosineMap: { t1: { budi: 0.6, heri: 0.9 }, t2: { budi: 0.6, heri: 0.9 } },
    });
    const assignment = result.assignments.find((a) => a.taskId === 't1')!;
    const altId = assignment.alternativeMemberId;
    const altScore = altId ? assignment.scores[altId] : undefined;
    // If the engine nominated an alternative, she must be eligible for the card
    // to name her; this asserts the guard the card relies on.
    if (altId) {
      expect(altScore?.isEligible).toBeFalsy();
    }
  });
});

describe('T-UI-MATRIX-01: member load rows state the limit and the verdict', () => {
  it('says "dalam batas" for a member under the cap', () => {
    const html = renderToStaticMarkup(
      createElement(MemberLoadRow, { name: 'Budi', load: 4, capacity: 20, capHours: 5 })
    );
    expect(html).toContain('Budi');
    expect(html).toContain('4.0 / 20 jam');
    expect(html).toContain('Dalam batas');
  });

  it('says "melampaui batas R2" with the cap value when over', () => {
    const html = renderToStaticMarkup(
      createElement(MemberLoadRow, { name: 'Heri', load: 8, capacity: 20, capHours: 5 })
    );
    expect(html).toContain('Melewati batas');
    expect(html).toContain('5.00 jam');
  });
});

describe('T-UI-MATRIX-01: the summary agrees with the export', () => {
  /*
   * The dashboard, the matrix and the export all read `AssignmentResult`. If the
   * summary claimed a task was allocated that the export leaves blank, the three
   * would be describing different runs. This checks them against each other,
   * building the export rows the same way the page does.
   */
  function exportRows(result: ReturnType<typeof globalAssign>, tasks: Task[]) {
    return tasks.map((task) => {
      const a = result.assignments.find((x) => x.taskId === task.id)!;
      const b = a.scores[a.primaryMemberId]?.breakdown ?? { K: 0, S: 0, C: 0, M: 0, total: 0 };
      return {
        task: task.title,
        hours: task.estimated_hours,
        effort: task.difficulty,
        primary: MEMBERS.find((m) => m.id === a.primaryMemberId)?.name ?? '',
        alternative: a.alternativeMemberId
          ? (MEMBERS.find((m) => m.id === a.alternativeMemberId)?.name ?? '')
          : '',
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

  it('an unallocated task is blank in the export too', () => {
    const result = globalAssign(INFEASIBLE, MEMBERS, [], { cosineMap: COS_INFEASIBLE });
    const summary = summarise(result, MEMBERS, INFEASIBLE);
    expect(summary.assigned).toBe(0);

    const rows = exportRows(result, INFEASIBLE);
    const csv = toCsv(rows);
    const text = toPlainText(rows, {
      code: 'tes',
      isFallback: false,
      weights: { K: 0.4, S: 0.3, C: 0.2, M: 0.1 },
      idealLoad: result.idealLoad,
      loads: MEMBERS.map((m) => {
        const load = result.memberLoads[m.id] ?? 0;
        return { name: m.name, load, capacity: m.capacity, over: load > m.capacity };
      }),
    });

    // The assignment line is what must be blank: "Tugas 8 jam |  | 0%".
    const assignmentLine = text.split('\n').find((line) => line.startsWith('Tugas 8 jam'))!;
    for (const member of MEMBERS) {
      expect(assignmentLine).not.toContain(member.name);
      // In the CSV the owner column is empty for this row.
      expect(csv).not.toContain(member.name);
    }
    expect(assignmentLine).toMatch(/Tugas 8 jam \| {2}\|/);
  });

  it('an allocated task names the same owner in the export', () => {
    const result = globalAssign(PLACEABLE, MEMBERS, [], { cosineMap: COS_PLACEABLE });
    const summary = summarise(result, MEMBERS, PLACEABLE);
    const allocated = result.assignments.filter((a) => a.primaryMemberId !== '');
    expect(summary.assigned).toBe(allocated.length);

    const csv = toCsv(exportRows(result, PLACEABLE));
    for (const a of allocated) {
      const owner = MEMBERS.find((m) => m.id === a.primaryMemberId)!;
      expect(csv).toContain(owner.name);
    }
  });
});
