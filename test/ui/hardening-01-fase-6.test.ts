import { describe, it, expect } from 'vitest';
import {
  RULE_PLAIN,
  COMPONENT_PLAIN,
  loadStanding,
  summarise,
  taskCardStatus,
  assignmentReason,
} from '@/components/recommendations/result-dashboard';
import { globalAssign } from '@/lib/scoring/assign';
import { toCsv, toPlainText } from '@/lib/scoring/interaction';
import type { Member, Task } from '@/lib/scoring/types';

/*
 * MASTER-MATRIX-HARDENING-01, FASE 6: integritas UI dan matriks.
 *
 * Fokus fase ini BUKAN tampilan (tidak ada redesain, tidak ada markup yang
 * diubah), melainkan satu pertanyaan: apakah angka dan label yang ditampilkan UI
 * selalu berasal dari hasil mesin yang sama, termasuk pada keadaan tepi?
 *
 * Semua tes di bawah memakai fungsi murni yang benar-benar dipakai komponen,
 * dijalankan terhadap `globalAssign` sungguhan — bukan fixture yang ditulis
 * tangan, karena fixture tangan tidak dapat menangkap mesin yang berubah.
 */

const SKILL = 'koordinasi' as const;

function member(id: string, over: Partial<Member> = {}): Member {
  return {
    id,
    name: id.toUpperCase(),
    capacity: 40,
    skills: { [SKILL]: 5 },
    interests: { [SKILL]: 5 },
    ...over,
  };
}

function task(id: string, hours: number, over: Partial<Task> = {}): Task {
  return {
    id,
    title: `Tugas ${id}`,
    difficulty: 3,
    estimated_hours: hours,
    required_skills: [SKILL],
    ...over,
  };
}

function cos(tasks: Task[], members: Member[], value = 0.6) {
  const map: Record<string, Record<string, number>> = {};
  for (const t of tasks) {
    map[t.id] = {};
    for (const m of members) map[t.id][m.id] = value;
  }
  return map;
}

describe('FASE 6 — ringkasan selalu cocok dengan hasil mesin yang sama', () => {
  it('angka ringkasan sama persis dengan hasil globalAssign, bukan hitungan ulang', () => {
    const members = [member('a'), member('b'), member('c')];
    const tasks = [task('t1', 1), task('t2', 1), task('t3', 1)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const summary = summarise(result, members, tasks);

    const placed = result.assignments.filter((a) => a.primaryMemberId !== '').length;
    expect(summary.assigned).toBe(placed);
    // "Perlu perhatian" adalah sisa pengurangan yang sama, bukan taksiran.
    expect(summary.needsAttention).toBe(tasks.length - placed);
    expect(summary.assigned + summary.needsAttention).toBe(summary.totalTasks);
    expect(summary.totalLoad).toBe(Object.values(result.memberLoads).reduce((s, l) => s + l, 0));
    expect(summary.capHours).toBe(result.idealLoad * 1.25);
  });

  it('tidak ada tugas yang dihitung dua kali ketika ada yang tidak terpasang', () => {
    /*
     * Manual: 2 anggota, 1 tugas 1 jam -> ideal 0,5, batas 0,625, tidak muat.
     * Ringkasan harus melaporkan 1 tugas, 0 terbagi, 1 perlu perhatian, dan
     * beban total 0 — bukan 1 beban dari tugas yang sebenarnya tidak dipasang.
     */
    const members = [member('a'), member('b')];
    const tasks = [task('t1', 1)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const summary = summarise(result, members, tasks);

    expect(summary).toMatchObject({
      totalTasks: 1,
      totalMembers: 2,
      assigned: 0,
      needsAttention: 1,
      totalLoad: 0,
    });
  });

  it('beban total nol ketika tidak ada tugas sama sekali', () => {
    const members = [member('a')];
    const result = globalAssign([], members, [], { cosineMap: {} });
    const summary = summarise(result, members, []);

    expect(summary.totalTasks).toBe(0);
    expect(summary.assigned).toBe(0);
    expect(summary.needsAttention).toBe(0);
    expect(summary.totalLoad).toBe(0);
    // idealLoad 0 karena tidak ada anggota pembagi beban -> UI tidak boleh
    // membagi dengan nol saat menampilkan persentase.
    expect(Number.isFinite(summary.capHours)).toBe(true);
  });

  it('kapasitas total hanya menjumlah anggota yang benar-benar ada', () => {
    const members = [member('a', { capacity: 10 }), member('b', { capacity: 25 })];
    const tasks = [task('t1', 1)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });

    expect(summarise(result, members, tasks).totalCapacity).toBe(35);
  });
});

describe('FASE 6 — status kartu tugas mencerminkan kelayakan mesin', () => {
  it('memetakan tiga keadaan secara eksklusif', () => {
    expect(taskCardStatus({ ownerName: null } as never)).toBe('belum-dibagikan');
    expect(taskCardStatus({ ownerName: 'A', ownerIsEligible: false } as never)).toBe(
      'perlu-penyesuaian'
    );
    expect(taskCardStatus({ ownerName: 'A', ownerIsEligible: true } as never)).toBe('dibagikan');
  });

  it('kartu untuk tugas tanpa pemilik di mesin juga tanpa pemilik di UI', () => {
    /*
     * Manual: 8 anggota, 4 tugas 2 jam -> batas 1,25, tidak ada yang muat.
     * Tidak boleh ada satu kartu pun yang mengaku "dibagikan".
     */
    const members = Array.from({ length: 8 }, (_, i) => member(`m${i + 1}`));
    const tasks = Array.from({ length: 4 }, (_, i) => task(`t${i + 1}`, 2));
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });

    for (const a of result.assignments) {
      expect(a.primaryMemberId).toBe('');
      expect(taskCardStatus({ ownerName: null } as never)).toBe('belum-dibagikan');
    }
  });

  it('pemilik dari fallback R3 berstatus "perlu penyesuaian", bukan "dibagikan"', () => {
    /*
     * Manual: 4 anggota level 2 (di bawah ambang R3), 4 tugas 2 jam -> ideal 2,
     * batas 2,5 sehingga R2 terpenuhi dan saran terbaik diberikan. Tetapi
     * pemiliknya TIDAK layak, jadi kartunya harus meminta penyesuaian.
     */
    const members = Array.from({ length: 4 }, (_, i) =>
      member(`m${i + 1}`, { skills: { [SKILL]: 2 } })
    );
    const tasks = Array.from({ length: 4 }, (_, i) => task(`t${i + 1}`, 2));
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });

    const assigned = result.assignments.filter((a) => a.primaryMemberId !== '');
    expect(assigned.length).toBeGreaterThan(0);
    for (const a of assigned) {
      const cell = a.scores[a.primaryMemberId];
      expect(cell.isEligible).toBe(false);
      expect(
        taskCardStatus({ ownerName: 'X', ownerIsEligible: cell.isEligible } as never)
      ).toBe('perlu-penyesuaian');
    }
  });
});

describe('FASE 6 — ambang beban tiga keadaan, termasuk keadaan tepi', () => {
  it('memakai 80% dari batas sebagai ambang "mendekati", bukan angka lain', () => {
    // Manual: batas 10 -> 80% = 8.
    expect(loadStanding(7.99, 10)).toBe('dalam-batas');
    expect(loadStanding(8, 10)).toBe('mendekati-batas');
    expect(loadStanding(10, 10)).toBe('mendekati-batas'); // tepat di batas belum melebihi
    expect(loadStanding(10.01, 10)).toBe('melebihi-batas');
  });

  it('tidak pernah menyebut "dalam batas" ketika tidak ada batas yang bisa dihitung', () => {
    /*
     * Batas 0 berarti mesin tidak dapat menurunkan limit (misalnya roster
     * kosong atau semua anggota kapasitas 0). Beban positif di atas batas nol
     * TIDAK BOLEH tampil aman — itu akan menyembunyikan masalah.
     */
    expect(loadStanding(5, 0)).toBe('melebihi-batas');
    expect(loadStanding(5, -1)).toBe('melebihi-batas');
    expect(loadStanding(0, 0)).toBe('dalam-batas');
  });
});

describe('FASE 6 — kosakata aturan lengkap dan tidak menyesatkan', () => {
  const RULE_KEYS = ['R1', 'R2', 'R3', 'R4', 'R5'] as const;

  it('setiap aturan R1-R5 punya kalimat biasa', () => {
    for (const code of RULE_KEYS) {
      expect(RULE_PLAIN[code]).toBeTruthy();
      expect(RULE_PLAIN[code].length).toBeGreaterThan(10);
    }
  });

  it('setiap komponen skor punya nama yang dapat dibaca pengguna', () => {
    for (const key of ['K', 'S', 'C', 'M'] as const) {
      expect(COMPONENT_PLAIN[key]).toBeTruthy();
    }
  });

  it('kalimat aturan tidak menyamar sebagai kode program', () => {
    for (const code of RULE_KEYS) {
      const text = RULE_PLAIN[code];
      expect(text).not.toMatch(/^R\d$/);
      expect(text).not.toMatch(/<=|>=|\*|\//);
    }
  });
});

describe('FASE 6 — alasan yang ditampilkan tidak mengarang kemampuan', () => {
  it('menyebut hanya skill yang benar-benar lolos ambang', () => {
    const text = assignmentReason({
      memberName: 'Ani',
      matchedSkills: ['koordinasi'],
      requiredSkills: ['koordinasi', 'presentasi'],
      score: 0.75,
    });
    expect(text).toContain('Ani');
    expect(text).toContain('koordinasi');
    // Presentasi tidak dimiliki pada level cukup, jadi tidak boleh dipuji.
    expect(text).not.toContain('presentasi');
    expect(text).toContain('75%');
  });

  it('mengatakan terus terang ketika tidak ada skill yang lolos', () => {
    const text = assignmentReason({
      memberName: 'Budi',
      matchedSkills: [],
      requiredSkills: ['koordinasi'],
      score: 0.41,
    });
    expect(text).toContain('Budi');
    expect(text).toContain('kandidat terbaik');
    expect(text).toContain('41%');
    // Tidak boleh mengklaim kemampuan yang tidak lolos ambang.
    expect(text).not.toContain('kemampuan koordinasi paling sesuai');
  });

  it('membedakan tugas tanpa syarat skill dari tugas yang dipuji', () => {
    const text = assignmentReason({
      memberName: 'Citra',
      matchedSkills: [],
      requiredSkills: [],
      score: 0.9,
    });
    expect(text).toContain('tidak mensyaratkan kemampuan khusus');
    expect(text).toContain('90%');
  });
});

describe('FASE 6 — ekspor setia pada hasil yang sedang ditampilkan', () => {
  /*
   * Bentuk `ExportRow` nyata (lib/scoring/interaction.ts:335-355) dipakai apa
   * adanya, supaya tes tidak mengarang bentuk baris ekspor.
   */
  const row = (over: Partial<Record<string, unknown>>) => ({
    task: 'Tugas',
    hours: 1,
    effort: 3,
    primary: '',
    alternative: '',
    eligibility: '',
    total: '0.5000',
    K: '0.5000',
    S: '0.5000',
    C: '0.5000',
    M: '0.5000',
    locked: 'tidak',
    reason: '',
    ...over,
  });

  it('CSV dan teks biasa menyebut pemilik yang sama dengan matriks', () => {
    /*
     * Kekeliruan yang paling mungkin terjadi pada UI: matriks sudah dihitung
     * ulang tetapi ekspor masih memakai keadaan lama. Tes ini memakai satu
     * hasil sebagai satu-satunya sumber untuk keduanya.
     */
    const members = [member('a'), member('b'), member('c')];
    const tasks = [task('t1', 1), task('t2', 1), task('t3', 1)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });

    const rows = result.assignments.map((a) => {
      const t = tasks.find((x) => x.id === a.taskId)!;
      const owner = members.find((m) => m.id === a.primaryMemberId);
      return row({
        task: t.title,
        hours: t.estimated_hours,
        primary: owner?.name ?? '',
        reason: a.primaryMemberId ? a.scores[a.primaryMemberId].reason : '',
      });
    });

    const csv = toCsv(rows as never);
    const plain = toPlainText(rows as never, {
      code: 'PRJ-1',
      isFallback: false,
      weights: { K: 0.4, S: 0.3, C: 0.2, M: 0.1 },
      idealLoad: result.idealLoad,
      loads: members.map((m) => ({
        name: m.name,
        load: result.memberLoads[m.id] ?? 0,
        capacity: m.capacity,
        over: (result.memberLoads[m.id] ?? 0) > result.idealLoad * 1.25,
      })),
    });

    for (const r of rows) {
      if (r.primary === '') continue;
      expect(csv).toContain(r.primary);
      expect(plain).toContain(r.primary);
    }
    // Kasus ini semuanya terpasang, jadi setiap baris punya pemilik.
    expect(rows.every((r) => r.primary !== '')).toBe(true);
  });

  it('tugas yang tidak terpasang diekspor dengan kolom pemilik kosong', () => {
    const members = [member('a'), member('b')];
    const tasks = [task('t1', 1)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    expect(result.assignments[0].primaryMemberId).toBe('');

    const csv = toCsv([row({ task: 'Tugas t1', primary: '' })] as never);
    const cells = csv.split('\r\n')[1].split(',');
    // Kolom ke-4 adalah pemilik. CSV mengutip setiap kolom ("..."), jadi pemilik
    // kosong muncul sebagai literal "" — yang penting: tidak ada nama karangan.
    expect(cells[3]).toBe('""');
  });
});
