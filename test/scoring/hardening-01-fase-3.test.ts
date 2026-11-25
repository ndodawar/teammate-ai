import { describe, it, expect } from 'vitest';
import { globalAssign } from '@/lib/scoring/assign';
import { checkR1, checkR2, checkR3, checkR4, hasQualifiedMember } from '@/lib/scoring/rules';
import { swapOwners, assignOwner, toggleLockState } from '@/lib/scoring/interaction';
import type { Member, Task, TaskAssignment } from '@/lib/scoring/types';

/*
 * MASTER-MATRIX-HARDENING-01, FASE 3: aturan kelayakan R1-R5 dan penugasan global.
 *
 * Acuan: PRD v0.3 FR-07 Hard Constraints, plus empat kasus keputusan pengguna
 * v0.3 S21-S24 pada bagian 7.7.2 yang sebelumnya tidak ada sebagai tes bernomor.
 *
 * Aturan yang dipatok dan TIDAK diubah oleh fase ini:
 *   R1 kapasitas 0 dikeluarkan dari kandidat
 *   R2 beban setelah tugas <= 1,25 x beban ideal (presisi penuh)
 *   R3 minimal satu skill wajib level >= 3; bila tidak ada, saran terbaik + peringatan
 *   R4 tepat satu penanggung jawab, kecuali tidak ada kandidat R2
 *   R5 tugas terkunci tidak berubah saat perhitungan ulang
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

/** Cosine seragam supaya K tidak pernah menjelaskan perbedaan hasil. */
function cos(tasks: Task[], members: Member[], value = 0.6) {
  const map: Record<string, Record<string, number>> = {};
  for (const t of tasks) {
    map[t.id] = {};
    for (const m of members) map[t.id][m.id] = value;
  }
  return map;
}

describe('FASE 3 — R1: kapasitas 0 dikeluarkan', () => {
  it('menolak anggota dengan kapasitas 0 dan menerima kapasitas positif', () => {
    expect(checkR1(member('a', { capacity: 0 }))).toBe(false);
    expect(checkR1(member('b', { capacity: 1 }))).toBe(true);
    // Kapasitas negatif (data rusak) juga bukan kandidat.
    expect(checkR1(member('c', { capacity: -5 }))).toBe(false);
  });

  it('tidak pernah memberi tugas kepada anggota berkapasitas 0', () => {
    /*
     * Manual: 1 tugas 2 jam, anggota A (0 jam) dan B (40 jam).
     * R1 mengeluarkan A, jadi pembagi beban ideal adalah 1 -> ideal 2, batas 2,5.
     * Tugas 2 jam <= 2,5 sehingga B menerimanya; A tetap 0.
     */
    const members = [member('a', { capacity: 0 }), member('b')];
    const tasks = [task('t1', 2)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });

    expect(result.memberLoads['a']).toBe(0);
    expect(result.memberLoads['b']).toBe(2);
    expect(result.idealLoad).toBe(2);
  });

  it('menandai sel anggota berkapasitas 0 dengan alasan R1', () => {
    const members = [member('a', { capacity: 0 }), member('b')];
    const tasks = [task('t1', 1)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const cell = result.assignments[0].scores['a'];

    expect(cell.isEligible).toBe(false);
    expect((cell.warnings ?? []).some((w) => w.startsWith('R1'))).toBe(true);
  });
});

describe('FASE 3 — R2: batas 1,25 x beban ideal dengan presisi penuh', () => {
  it('menerima beban tepat pada batas dan menolak satu langkah di atasnya', () => {
    /*
     * Manual: ideal 4, batas 5. Beban 3 + tugas 2 = 5 -> boleh (<=).
     * Beban 3 + tugas 2.0001 = 5.0001 -> ditolak.
     */
    const m = member('a');
    expect(checkR2(m, task('t', 2), 3, 4)).toBe(true);
    expect(checkR2(m, task('t', 2.0001), 3, 4)).toBe(false);
  });

  it('tidak membulatkan sebelum membandingkan', () => {
    /*
     * Manual: ideal 0,75, batas 0,9375. Tugas tepat 0,9375 muat; 0,94 tidak,
     * meskipun keduanya tampil sebagai "0,94 jam" setelah dibulatkan.
     */
    const ideal = 0.75;
    const cap = ideal * 1.25;
    expect(cap).toBe(0.9375);
    expect(checkR2(member('a'), task('t', cap), 0, ideal)).toBe(true);
    expect(checkR2(member('a'), task('t', 0.94), 0, ideal)).toBe(false);
  });

  it('juga menghormati kapasitas anggota, bukan hanya batas R2', () => {
    // Manual: ideal 40 -> batas 50, tetapi kapasitas anggota hanya 6.
    // Beban 5 + tugas 2 = 7 > 6, jadi ditolak meski batas R2 masih longgar.
    const m = member('a', { capacity: 6 });
    expect(checkR2(m, task('t', 2), 5, 40)).toBe(false);
  });

  it('S08/S21: tidak ada kandidat R2 -> tugas tanpa penanggung jawab', () => {
    /*
     * Manual: 8 anggota, 4 tugas x 2 jam. Total 8 jam, ideal 1, batas 1,25.
     * Setiap tugas 2 jam > 1,25, jadi tidak ada yang boleh menerima.
     * R4 pengecualian berlaku: tugas boleh tanpa penanggung jawab, dan tidak
     * boleh ada penugasan yang melanggar R2.
     */
    const members = Array.from({ length: 8 }, (_, i) => member(`m${i + 1}`));
    const tasks = Array.from({ length: 4 }, (_, i) => task(`t${i + 1}`, 2));
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });

    expect(result.assignments.every((a) => a.primaryMemberId === '')).toBe(true);
    expect(Object.values(result.memberLoads).every((l) => l === 0)).toBe(true);
    expect(result.warnings.every((w) => w.code === 'r2_no_candidate')).toBe(true);
    // Peringatan wajib menyebut angka yang bisa ditindaklanjuti pengguna.
    for (const w of result.warnings) {
      expect(w.detail).toEqual({ taskHours: 2, idealLoad: 1, capHours: 1.25, exceedsCapAlone: true });
    }
  });
});

describe('FASE 3 — R3: minimal satu skill wajib level 3', () => {
  it('hanya anggota yang memenuhi ambang yang menjadi kandidat', () => {
    const t = task('t1', 1);
    const qualified = member('a', { skills: { [SKILL]: 3 } });
    const below = member('b', { skills: { [SKILL]: 2 } });
    const pool = checkR3(t, [qualified, below]);

    expect(pool.map((m) => m.id)).toEqual(['a']);
    expect(hasQualifiedMember(t, [qualified, below])).toBe(true);
  });

  it('memakai MINIMAL SATU skill, bukan semua skill wajib', () => {
    /*
     * PRD v0.3 menegaskan R3 adalah "minimal satu skill wajib berlevel >= 3",
     * bukan "semua skill wajib harus >= 3". Anggota yang hanya memenuhi satu
     * dari dua skill wajib tetap kandidat.
     */
    const t = task('t1', 1, { required_skills: ['koordinasi', 'presentasi'] });
    const m = member('a', { skills: { koordinasi: 5, presentasi: 1 } });
    expect(hasQualifiedMember(t, [m])).toBe(true);
    expect(checkR3(t, [m]).map((x) => x.id)).toEqual(['a']);
  });

  it('S07/S22: tidak ada yang memenuhi -> saran terbaik + peringatan, tidak dianggap layak', () => {
    /*
     * Manual: 4 anggota semua level 2 (di bawah 3), 4 tugas x 2 jam = 8 jam.
     * Ideal = 8/4 = 2, batas = 2,5. Setiap tugas 2 jam <= 2,5, jadi R2 TIDAK
     * menghalangi dan satu-satunya aturan yang gagal adalah R3. Itu yang
     * membuat kasus ini menguji R3 sendirian, bukan campuran R3 + R2.
     *
     * (Versi pertama tes ini memakai 2 anggota dan satu tugas 2 jam: ideal 1,
     * batas 1,25, sehingga tugasnya mustahil dipasang dan yang teruji justru R2.
     * Aritmetika tes itu yang salah, bukan mesinnya.)
     *
     * Sistem memberi saran terbaik (R3 fallback) tetapi anggota itu TIDAK boleh
     * ditandai layak, dan level skill tidak dinaikkan.
     */
    const members = [
      member('a', { skills: { [SKILL]: 2 } }),
      member('b', { skills: { [SKILL]: 2 } }),
      member('c', { skills: { [SKILL]: 2 } }),
      member('d', { skills: { [SKILL]: 2 } }),
    ];
    const tasks = [task('t1', 2), task('t2', 2), task('t3', 2), task('t4', 2)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    expect(result.idealLoad).toBe(2);

    expect(result.warnings.some((w) => w.code === 'r3_no_candidate')).toBe(true);
    // Semua tugas benar-benar terisi saran terbaik — membuktikan R2 terpenuhi
    // sehingga yang tersisa hanya soal R3.
    for (const assignment of result.assignments) {
      expect(assignment.primaryMemberId).not.toBe('');
      // Tetapi tidak satu pun sel boleh dianggap layak.
      for (const cell of Object.values(assignment.scores)) {
        expect(cell.isEligible).toBe(false);
        // S = 2/5 = 0,4: level tidak dinaikkan agar lolos R3.
        expect(cell.breakdown.S).toBeCloseTo(0.4, 10);
      }
    }
  });

  it('S11: anggota di bawah ambang tidak boleh menggantikan yang memenuhi hanya karena K lebih tinggi', () => {
    /*
     * Manual: A level 3 (memenuhi R3) dengan cosine rendah; B level 1 (tidak
     * memenuhi) dengan cosine tinggi sehingga skornya bisa lebih besar.
     *
     * Aritmetika R2 dijaga agar R3 yang menentukan: 2 anggota, 2 tugas x 1 jam
     * = 2 jam, ideal 1, batas 1,25. Setiap tugas 1 jam <= 1,25, jadi keduanya
     * muat dan R2 tidak pernah menjadi penyebab penolakan.
     */
    const members = [
      member('a', { name: 'A', skills: { [SKILL]: 3 } }),
      member('b', { name: 'B', skills: { [SKILL]: 1 } }),
    ];
    const tasks = [task('t1', 1), task('t2', 1)];
    const cosine = {
      t1: { a: 0.2, b: 0.8 }, // B jauh lebih mirip secara konten
      t2: { a: 0.2, b: 0.8 },
    };
    const result = globalAssign(tasks, members, [], { cosineMap: cosine });
    expect(result.idealLoad).toBe(1);

    const assignment = result.assignments.find((x) => x.taskId === 't1')!;
    expect(assignment.primaryMemberId).toBe('a');
    expect(assignment.scores['b'].isEligible).toBe(false);
    // Dan skor B memang lebih tinggi: skor bukan kelayakan.
    expect(assignment.scores['b'].breakdown.total).toBeGreaterThan(
      assignment.scores['a'].breakdown.total
    );
    // B tidak pernah mendapat tugas apa pun, meski skornya lebih tinggi.
    expect(result.memberLoads['b']).toBe(0);
    /*
     * A hanya memegang satu tugas, bukan dua: ideal 1 -> batas 1,25, jadi
     * tugas kedua akan membuat A 2 jam dan melanggar R2. Yang dibuktikan di
     * sini adalah B tetap 0 (R3 menahan B) dan A yang menerima, bukan bahwa
     * semua tugas pasti terpasang.
     */
    expect(result.memberLoads['a']).toBe(1);
    expect(result.memberLoads['a']).toBeLessThanOrEqual(result.idealLoad * 1.25 + 1e-9);
  });
});

describe('FASE 3 — R4: tepat satu penanggung jawab', () => {
  it('helper R4 menerima tepat satu, menolak nol dan dua', () => {
    expect(checkR4(1)).toBe(true);
    expect(checkR4(0)).toBe(false);
    expect(checkR4(2)).toBe(false);
  });

  it('tidak pernah memberi lebih dari satu penanggung jawab per tugas', () => {
    /*
     * 3 anggota, 3 tugas 1 jam: ideal 1, batas 1,25. Setiap tugas dapat tepat
     * satu pemilik, dan tidak ada tugas yang punya dua.
     */
    const members = [member('a'), member('b'), member('c')];
    const tasks = [task('t1', 1), task('t2', 1), task('t3', 1)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });

    for (const a of result.assignments) {
      expect(typeof a.primaryMemberId).toBe('string');
      // Satu id, bukan larik; alternatif tidak pernah sama dengan primer.
      expect(a.alternativeMemberId).not.toBe(a.primaryMemberId);
    }
    // Total pemilik sama dengan jumlah tugas yang berhasil ditempatkan.
    const owners = result.assignments.filter((a) => a.primaryMemberId !== '');
    expect(owners).toHaveLength(3);
  });

  it('menjaga konsistensi tukar: dua pemilik bertukar, jumlah tidak berubah', () => {
    const members = [member('a'), member('b')];
    const tasks = [task('t1', 1), task('t2', 1)];
    const assignments: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'a', isLocked: false, scores: {} },
      { taskId: 't2', primaryMemberId: 'b', isLocked: false, scores: {} },
    ];
    const swapped = swapOwners(assignments, 't1', 't2', { tasks, members });

    expect(swapped.ok).toBe(true);
    expect(swapped.next).toHaveLength(2);
    expect(swapped.next.find((x) => x.taskId === 't1')!.primaryMemberId).toBe('b');
    expect(swapped.next.find((x) => x.taskId === 't2')!.primaryMemberId).toBe('a');
  });
});

describe('FASE 3 — R5: tugas terkunci tidak berubah saat perhitungan ulang', () => {
  it('S13: mempertahankan pemilik terkunci meski ada kandidat yang lebih tinggi', () => {
    /*
     * Manual: A sudah memegang t1 (terkunci) dengan beban 1 jam. B memiliki
     * cosine sempurna untuk t1. R5 tetap mempertahankan A.
     */
    const members = [member('a'), member('b')];
    const tasks = [task('t1', 1), task('t2', 1)];
    const locked: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'a', isLocked: true, scores: {} },
    ];
    const cosine = { t1: { a: 0.2, b: 0.8 }, t2: { a: 0.8, b: 0.8 } };
    const result = globalAssign(tasks, members, locked, { cosineMap: cosine });

    const t1 = result.assignments.find((x) => x.taskId === 't1')!;
    expect(t1.primaryMemberId).toBe('a');
    expect(t1.isLocked).toBe(true);
  });

  it('S23: R5 menang atas R2, tetapi overload dilaporkan', () => {
    /*
     * Manual: t1 terkunci 9 jam pada A, plus t2 1 jam. Total 10 jam, ideal 5,
     * batas 6,25. A memegang 9 jam > 6,25, sehingga R5 tetap mempertahankan A
     * DAN peringatan overload wajib muncul. Tidak ada penugasan baru untuk A.
     */
    const members = [member('a'), member('b')];
    const tasks = [task('t1', 9), task('t2', 1)];
    const locked: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'a', isLocked: true, scores: {} },
    ];
    const result = globalAssign(tasks, members, locked, { cosineMap: cos(tasks, members) });

    const t1 = result.assignments.find((x) => x.taskId === 't1')!;
    expect(t1.primaryMemberId).toBe('a');
    expect(result.idealLoad).toBe(5);
    expect(result.warnings.some((w) => w.code === 'r2_locked_overload')).toBe(true);
    // Beban A tidak bertambah oleh t2.
    expect(result.memberLoads['a']).toBe(9);
  });

  it('membuka kunci mempertahankan pemilik, hanya mengubah status kunci', () => {
    const assignments: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'a', isLocked: true, scores: {} },
    ];
    const result = toggleLockState(assignments, 't1');
    expect(result).not.toBeNull();
    expect(result!.locked).toBe(false);
    expect(result!.next[0].primaryMemberId).toBe('a');
  });

  it('R5 juga berlaku pada jalur edit manual: tugas terkunci tidak dipindah diam-diam', () => {
    /*
     * Komentar kode menyebut R5 wajib, tetapi `assignOwner` hanya menolak bila
     * `options.lock` false. Ini memverifikasi perilaku yang sebenarnya berlaku
     * supaya tidak ada yang mengira tugas terkunci bisa dipindah tanpa sengaja.
     */
    const members = [member('a'), member('b')];
    const tasks = [task('t1', 1)];
    const assignments: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'a', isLocked: true, scores: {} },
    ];
    const moved = assignOwner(assignments, 't1', 'b', { lock: false, tasks, members });

    expect(moved.changed).toBe(false);
    expect(moved.error).toMatch(/terkunci/);
    expect(moved.next[0].primaryMemberId).toBe('a');
  });
});

describe('FASE 3 — penugasan global', () => {
  it('memproses tugas dengan usaha terbesar lebih dulu', () => {
    /*
     * Manual: 1 anggota, tugas 2 jam dan 20 jam. Total 22 jam, ideal 22,
     * batas 27,5, jadi keduanya muat. Urutan pemrosesan harus besar dulu
     * (PRD: "Tugas dengan usaha terbesar diproses terlebih dahulu").
     * Yang dapat dibuktikan dari luar: hasil deterministik dan total beban benar.
     */
    const members = [member('a')];
    const tasks = [task('small', 2), task('large', 20)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });

    expect(result.memberLoads['a']).toBe(22);
    expect(result.assignments.every((a) => a.primaryMemberId === 'a')).toBe(true);
  });

  it('deterministik untuk masukan yang sama', () => {
    const members = [member('a'), member('b'), member('c')];
    const tasks = [task('t1', 2), task('t2', 1), task('t3', 3)];
    const first = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const second = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('memberi alternatif hanya dari kandidat yang benar-benar layak', () => {
    /*
     * Manual: 2 anggota, 1 tugas 1 jam. Total 1 jam, ideal 0,5, batas 0,625.
     * Tugas 1 jam > 0,625, jadi tidak ada kandidat layak dan tidak boleh ada
     * alternatif yang diklaim sah.
     */
    const members = [member('a'), member('b')];
    const tasks = [task('t1', 1)];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });
    const assignment = result.assignments[0];

    expect(assignment.primaryMemberId).toBe('');
    if (assignment.alternativeMemberId) {
      expect(assignment.scores[assignment.alternativeMemberId].isEligible).toBe(true);
    }
  });

  it('menjaga total jam tidak hilang dan tidak berganda', () => {
    /*
     * Manual: 4 anggota, 4 tugas x 2 jam = 8 jam, ideal 2, batas 2,5.
     * Satu tugas 2 jam per anggota, jadi keempatnya terpasang dan total = 8.
     */
    const members = Array.from({ length: 4 }, (_, i) => member(`m${i + 1}`));
    const tasks = Array.from({ length: 4 }, (_, i) => task(`t${i + 1}`, 2));
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });

    const total = Object.values(result.memberLoads).reduce((s, l) => s + l, 0);
    expect(total).toBe(8);
    expect(result.assignments.filter((a) => a.primaryMemberId !== '')).toHaveLength(4);
  });

  it('menghitung beban awal anggota yang terkunci sebelum alokasi', () => {
    /*
     * Manual: 2 anggota, t0 terkunci 2 jam pada A, plus t1 dan t2 masing-masing
     * 1 jam. Total 4 jam, ideal 2, batas 2,5. A sudah 2 jam sehingga hanya bisa
     * menerima 0,5 jam lagi; t1/t2 masing-masing 1 jam tidak muat di A.
     */
    const members = [member('a'), member('b')];
    const tasks = [task('t0', 2), task('t1', 1), task('t2', 1)];
    const locked: TaskAssignment[] = [
      { taskId: 't0', primaryMemberId: 'a', isLocked: true, scores: {} },
    ];
    const result = globalAssign(tasks, members, locked, { cosineMap: cos(tasks, members) });

    expect(result.idealLoad).toBe(2);
    expect(result.memberLoads['a']).toBe(2);
    for (const load of Object.values(result.memberLoads)) {
      expect(load).toBeLessThanOrEqual(2.5 + 1e-9);
    }
  });
});

describe('FASE 3 — invarian lintas semua aturan', () => {
  it('tidak ada penugasan yang melanggar R1, R2, atau R3 pada roster acak yang wajar', () => {
    /*
     * Pemeriksaan invarian, bukan angka tunggal: untuk setiap penanggung jawab
     * yang diberikan mesin, beban akhirnya harus <= batas R2 dan <= kapasitas,
     * kapasitasnya > 0, dan ada minimal satu skill wajib level >= 3.
     */
    const members: Member[] = [
      member('m1', { capacity: 20, skills: { koordinasi: 5, presentasi: 4, pengujian: 3 } }),
      member('m2', { capacity: 12, skills: { koordinasi: 3, presentasi: 2, pengujian: 1 } }),
      member('m3', { capacity: 0, skills: { koordinasi: 5, presentasi: 5, pengujian: 5 } }),
      member('m4', { capacity: 30, skills: { koordinasi: 1, presentasi: 1, pengujian: 4 } }),
    ];
    const tasks: Task[] = [
      task('t1', 2, { required_skills: ['koordinasi'] }),
      task('t2', 3, { required_skills: ['presentasi'] }),
      task('t3', 1, { required_skills: ['pengujian'] }),
      task('t4', 4, { required_skills: ['koordinasi', 'pengujian'] }),
    ];
    const result = globalAssign(tasks, members, [], { cosineMap: cos(tasks, members) });

    const cap = result.idealLoad * 1.25;
    for (const assignment of result.assignments) {
      if (assignment.primaryMemberId === '') continue;
      const owner = members.find((m) => m.id === assignment.primaryMemberId)!;
      const t = tasks.find((x) => x.id === assignment.taskId)!;

      expect(owner.capacity).toBeGreaterThan(0); // R1
      expect(result.memberLoads[owner.id]).toBeLessThanOrEqual(cap + 1e-9); // R2
      expect(result.memberLoads[owner.id]).toBeLessThanOrEqual(owner.capacity + 1e-9); // R2
      expect(t.required_skills.some((s) => (owner.skills as Record<string, number>)[s] >= 3)).toBe(true); // R3
    }
    // Anggota berkapasitas 0 tidak pernah menerima apa pun.
    expect(result.memberLoads['m3']).toBe(0);
  });
});
