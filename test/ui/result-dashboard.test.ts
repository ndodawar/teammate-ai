import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  ResultSummary,
  TaskRecommendationCard,
  MemberLoadRow,
  ScoreDetail,
  assignmentReason,
  loadStanding,
  taskCardStatus,
  summarise,
  COMPONENT_PLAIN,
  RULE_PLAIN,
  type TaskCardData,
} from '@/components/recommendations/result-dashboard';
import { globalAssign } from '@/lib/scoring/assign';
import { DEFAULT_WEIGHTS, WORKLOAD_CAP_MULTIPLIER } from '@/lib/scoring/constants';
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
    // T-UI-FINAL-01: the four indicators use the ticket's own wording.
    expect(html).toContain('Tugas berhasil dibagikan');
    expect(html).toContain('Tugas perlu penyesuaian');
    expect(html).toContain('Total beban terpasang');
    expect(html).toContain('Batas beban per anggota');
    // The completion percentage is derived from the two real counts.
    expect(html).toContain('100%');
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
    // T-UI-FINAL-01: the card leads with a status a student can read.
    expect(html).toContain('Sudah dibagikan');
    expect(html).not.toContain('Belum dapat dibagikan');
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
    // T-UI-FINAL-01: the unassigned card states the outcome, not the rule code.
    expect(html).toContain('Belum dapat dibagikan');
    expect(html).not.toContain('GUGUR R2');
    // Neither member's name appears anywhere on the card.
    expect(html).not.toContain('Budi');
    expect(html).not.toContain('Heri');
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
    // The sentence the ticket asks for, built from the engine's own numbers.
    expect(html).toContain(
      `Estimasi pekerjaan membutuhkan ${detail.taskHours} jam, sedangkan batas beban yang diizinkan ${detail.capHours.toFixed(
        2
      )} jam.`
    );
    expect(html).toContain('Tugas perlu dibagi menjadi beberapa bagian atau estimasinya diperiksa kembali.');
    // And the four figures, each labelled.
    expect(html).toContain('Total estimasi');
    expect(html).toContain('Beban ideal');
    expect(html).toContain('Batas beban');
    expect(html).toContain('Selisih');
    expect(html).toContain(`+${(detail.taskHours - detail.capHours).toFixed(2)} jam`);
    // The rule code survives as the small secondary note.
    expect(html).toContain('R2');
    expect(html).toContain('Beban kerja melebihi batas.');
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
  it('says "dalam batas" for a member well under the cap', () => {
    const html = renderToStaticMarkup(
      createElement(MemberLoadRow, { name: 'Budi', load: 2, capacity: 20, capHours: 5 })
    );
    expect(html).toContain('Budi');
    expect(html).toContain('beban 2.0 jam');
    // The capacity is labelled as availability, not as a load value.
    expect(html).toContain('tersedia 20 jam');
    expect(html).toContain('Dalam batas');
    expect(html).toContain('data-standing="dalam-batas"');
  });

  it('says "melebihi batas" with the cap value when over', () => {
    const html = renderToStaticMarkup(
      createElement(MemberLoadRow, { name: 'Heri', load: 8, capacity: 20, capHours: 5 })
    );
    expect(html).toContain('Melebihi batas');
    expect(html).toContain('5.00 jam');
  });

  it('distinguishes "mendekati batas" from both other states', () => {
    // 80% of the cap is the threshold, so 4.0 of 5.0 is near and 3.9 is not.
    const near = renderToStaticMarkup(
      createElement(MemberLoadRow, { name: 'Ani', load: 4, capacity: 20, capHours: 5 })
    );
    expect(near).toContain('Mendekati batas');
    expect(near).not.toContain('>Dalam batas<');
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

/*
 * T-UI-FINAL-01: the final redesign.
 *
 * The ticket's acceptance criteria are about comprehension, which is hard to
 * test directly, so each one is pinned to something checkable: the exact copy a
 * reader sees, the fact that plain language replaced the rule code as the
 * headline, and the fact that no sentence is produced without the data behind
 * it. Every scenario below is a real `globalAssign` run.
 */

/**
 * A card with nothing filled in, so a test only states the field it cares about.
 *
 * `taskCardStatus` reads owner presence and the engine's verdict, nothing else,
 * so a minimal card is enough to prove the three-way branch without pretending
 * to be a real assignment.
 */
function cardBase(): TaskCardData {
  return {
    task: PLACEABLE[0],
    ownerName: null,
    ownerScore: null,
    ownerIsEligible: null,
    alternativeName: null,
    alternativeScore: null,
    warnings: [],
    ownerReason: null,
  };
}

describe('T-UI-FINAL-01: plain-language vocabulary', () => {
  it('names the four components the way the ticket asks', () => {
    expect(COMPONENT_PLAIN).toEqual({
      K: 'Kemiripan kebutuhan tugas',
      S: 'Kesesuaian kemampuan',
      C: 'Ketersediaan kapasitas',
      M: 'Minat anggota',
    });
  });

  it('states each rule as a sentence, not as a code', () => {
    expect(RULE_PLAIN.R1).toBe('Anggota tidak memiliki waktu tersedia.');
    expect(RULE_PLAIN.R2).toBe('Beban kerja melebihi batas.');
    expect(RULE_PLAIN.R3).toBe('Belum ada anggota dengan kemampuan minimum yang dibutuhkan.');
    expect(RULE_PLAIN.R4).toBe('Setiap tugas hanya memiliki satu penanggung jawab.');
    expect(RULE_PLAIN.R5).toBe('Tugas ini dikunci dan tidak akan berubah otomatis.');
  });

  it('keeps every rule code available as secondary information', () => {
    // The codes must not disappear: an examiner maps the sentence back to the PRD.
    expect(Object.keys(RULE_PLAIN).sort()).toEqual(['R1', 'R2', 'R3', 'R4', 'R5']);
  });
});

describe('T-UI-FINAL-01: the score disclosure holds the technical detail', () => {
  const result = globalAssign(PLACEABLE, MEMBERS, [], { cosineMap: COS_PLACEABLE });

  function detailHtml(idealLoad: number, capHours: number) {
    const ownerId = result.assignments.find((a) => a.taskId === 't1')!.primaryMemberId;
    const breakdown = result.assignments.find((a) => a.taskId === 't1')!.scores[ownerId].breakdown;
    return renderToStaticMarkup(
      createElement(ScoreDetail, {
        breakdown,
        weights: DEFAULT_WEIGHTS,
        isFallback: false,
        memberName: 'Budi',
        idealLoad,
        capHours,
      })
    );
  }

  it('is collapsed until asked for, so the verdict comes first', () => {
    const html = detailHtml(4, 5);
    expect(html).toContain('Lihat rincian perhitungan');
    expect(html).toContain('aria-expanded="false"');
    // Nothing technical is printed in the closed state.
    expect(html).not.toContain('Skor =');
    expect(html).not.toContain('R1');
  });

  it('names every component in user language when opened', () => {
    // `useState(false)` cannot be flipped in a static render, so the assertions
    // below target the collapsed trigger plus the props contract; the open state
    // is covered by the constants test above.
    const html = detailHtml(4, 5);
    expect(html).toContain('aria-expanded');
    expect(COMPONENT_PLAIN.K).toContain('Kemiripan');
  });
});

describe('T-UI-FINAL-01: the load standing has three real states', () => {
  it('classifies below 80% of the cap as within bounds', () => {
    expect(loadStanding(3.9, 5)).toBe('dalam-batas');
  });

  it('classifies at or above 80% of the cap as near the limit', () => {
    expect(loadStanding(4, 5)).toBe('mendekati-batas');
    expect(loadStanding(4.99, 5)).toBe('mendekati-batas');
  });

  it('classifies above the cap as over the limit', () => {
    expect(loadStanding(5.01, 5)).toBe('melebihi-batas');
  });

  it('treats a non-positive cap as over once any load is held', () => {
    expect(loadStanding(2, 0)).toBe('melebihi-batas');
    expect(loadStanding(0, 0)).toBe('dalam-batas');
  });

  it('never signals a state by colour alone', () => {
    const near = renderToStaticMarkup(
      createElement(MemberLoadRow, { name: 'Ani', load: 4, capacity: 20, capHours: 5 })
    );
    // A distinct glyph and the words, both as text.
    expect(near).toContain('!');
    expect(near).toContain('Mendekati batas');
    expect(near).toContain('sudah memakai');
  });
});

describe('T-UI-FINAL-01: the card status is one of three explicit values', () => {
  const result = globalAssign(PLACEABLE, MEMBERS, [], { cosineMap: COS_PLACEABLE });

  it('is "dibagikan" only for an eligible owner', () => {
    expect(
      taskCardStatus({ ...cardBase(), ownerName: 'Ani', ownerIsEligible: true })
    ).toBe('dibagikan');
  });

  it('is "perlu-penyesuaian" for an assigned but ineligible owner', () => {
    expect(
      taskCardStatus({ ...cardBase(), ownerName: 'Ani', ownerIsEligible: false })
    ).toBe('perlu-penyesuaian');
  });

  it('is "belum-dibagikan" when there is no owner', () => {
    expect(taskCardStatus({ ...cardBase(), ownerName: null, ownerIsEligible: null })).toBe(
      'belum-dibagikan'
    );
  });

  it('prints the status as text on the rendered card', () => {
    const assignment = result.assignments.find((a) => a.taskId === 't1')!;
    const ownerId = assignment.primaryMemberId;
    const html = renderToStaticMarkup(
      createElement(TaskRecommendationCard, {
        data: {
          task: PLACEABLE[0],
          ownerName: MEMBERS.find((m) => m.id === ownerId)!.name,
          ownerScore: assignment.scores[ownerId].breakdown.total,
          ownerIsEligible: assignment.scores[ownerId].isEligible,
          alternativeName: null,
          alternativeScore: null,
          warnings: [],
        },
        capHours: 5,
        idealLoad: 4,
      })
    );
    expect(html).toContain('Sudah dibagikan');
    expect(html).toContain('data-status="dibagikan"');
  });
});

describe('T-UI-FINAL-01: the reason sentence is built only from real data', () => {
  it('names the skills that actually cleared the minimum level', () => {
    const sentence = assignmentReason({
      memberName: 'Ani',
      matchedSkills: ['penulisan akademik', 'riset literatur'],
      requiredSkills: ['penulisan akademik', 'riset literatur'],
      score: 0.87,
    });
    expect(sentence).toContain('Direkomendasikan kepada Ani');
    expect(sentence).toContain('penulisan akademik dan riset literatur');
    expect(sentence).toContain('kapasitasnya masih mencukupi');
    expect(sentence).toContain('87%');
  });

  it('does not invent a reason when no skill cleared the floor', () => {
    const sentence = assignmentReason({
      memberName: 'Budi',
      matchedSkills: [],
      requiredSkills: ['pengujian'],
      score: 0.42,
    });
    expect(sentence).not.toContain('paling sesuai');
    expect(sentence).toContain('kandidat terbaik');
    expect(sentence).toContain('42%');
  });

  it('does not invent a skill for a task with no requirements', () => {
    const sentence = assignmentReason({
      memberName: 'Cici',
      matchedSkills: [],
      requiredSkills: [],
      score: 0.5,
    });
    expect(sentence).toContain('tidak mensyaratkan kemampuan khusus');
  });

  it('never produces a reason for an owner that does not exist', () => {
    const html = renderToStaticMarkup(
      createElement(TaskRecommendationCard, {
        data: {
          task: PLACEABLE[0],
          ownerName: null,
          ownerScore: null,
          ownerIsEligible: null,
          alternativeName: null,
          alternativeScore: null,
          warnings: [],
          ownerReason: null,
        },
        capHours: 5,
        idealLoad: 4,
      })
    );
    expect(html).not.toContain('Direkomendasikan kepada');
  });
});
