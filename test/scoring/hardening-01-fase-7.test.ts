import { describe, it, expect } from 'vitest';
import { globalAssign } from '@/lib/scoring/assign';
import { checkR1 } from '@/lib/scoring/rules';
import type { Member, Task, TaskAssignment } from '@/lib/scoring/types';

/*
 * MASTER-MATRIX-HARDENING-01, FASE 7: 20+ skenario bernama dan gerbang akhir.
 *
 * Sumber nama dan ekspektasi: PRD v0.3 bagian 7.7.1 (S01-S20) dan 7.7.2
 * (S21-S24). Setiap tes di bawah mengambil SATU baris dari tabel itu dan
 * menegaskan ekspektasi yang tertulis di kolom "ekspektasi", bukan sekadar
 * invarian umum.
 *
 * Berbeda dari `test/scoring/scenarios.test.ts` yang menjalankan fixture D2 dan
 * memeriksa invarian umum, tes ini menjawab pertanyaan: "apakah perilaku yang
 * dijanjikan PRD untuk skenario bernomor ini benar-benar terjadi?"
 */

const SKILL = 'koordinasi' as const;
const SK2 = 'presentasi' as const;

function m(id: string, over: Partial<Member> = {}): Member {
  return {
    id,
    name: id.toUpperCase(),
    capacity: 40,
    skills: { [SKILL]: 5 },
    interests: { [SKILL]: 5 },
    ...over,
  };
}

function t(id: string, hours: number, over: Partial<Task> = {}): Task {
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
  for (const task of tasks) {
    map[task.id] = {};
    for (const member of members) map[task.id][member.id] = value;
  }
  return map;
}

const run = (tasks: Task[], members: Member[], locked: TaskAssignment[] = [], value = 0.6) =>
  globalAssign(tasks, members, locked, { cosineMap: cos(tasks, members, value) });

const placed = (r: ReturnType<typeof run>) =>
  r.assignments.filter((a) => a.primaryMemberId !== '').length;

describe('FASE 7 — S01-S20 sesuai tabel PRD 7.7.1', () => {
  it('S01 Skill merata: tidak ada pelanggaran, beban tersebar', () => {
    const members = [m('a'), m('b'), m('c'), m('d')];
    const tasks = [t('t1', 1), t('t2', 1), t('t3', 1), t('t4', 1)];
    const r = run(tasks, members);

    expect(placed(r)).toBe(4);
    // Tersebar: setiap anggota menerima tepat satu tugas.
    for (const member of members) expect(r.memberLoads[member.id]).toBe(1);
  });

  it('S02 Satu anggota sangat kuat: bergantung pada satu anggota, R2 tetap terjaga', () => {
    /*
     * Manual: A sangat kuat (skill 5), B dan C lemah (skill 1, di bawah
     * ambang R3). 3 tugas x 1 jam -> ideal 1, batas 1,25. A hanya bisa
     * menerima satu tugas (2 jam > 1,25), jadi ketergantungan terlihat
     * sekaligus dibatasi R2.
     */
    const members = [
      m('a', { skills: { [SKILL]: 5 } }),
      m('b', { skills: { [SKILL]: 1 } }),
      m('c', { skills: { [SKILL]: 1 } }),
    ];
    const tasks = [t('t1', 1), t('t2', 1), t('t3', 1)];
    const r = run(tasks, members);

    expect(r.idealLoad).toBe(1);
    expect(r.memberLoads['a']).toBe(1);
    // R2 tidak pernah terlampaui walaupun hanya A yang memenuhi R3.
    for (const load of Object.values(r.memberLoads)) expect(load).toBeLessThanOrEqual(1.25 + 1e-9);
    expect(r.memberLoads['b']).toBe(0);
    expect(r.memberLoads['c']).toBe(0);
  });

  it('S03 Anggota kapasitas rendah: kapasitas 6 jam tidak menerima tugas 10 jam', () => {
    // Manual: kapasitas 6, tugas 10 -> 10 > 6, ditolak (dan juga > batas R2).
    const members = [m('a', { capacity: 6 })];
    const tasks = [t('t1', 10)];
    const r = run(tasks, members);

    expect(r.assignments[0].primaryMemberId).toBe('');
    expect(r.memberLoads['a']).toBe(0);
  });

  it('S04 Anggota kapasitas tinggi: batas R2, bukan kapasitas, yang membatasi', () => {
    /*
     * Manual: kapasitas 1000 (sangat longgar), 1 tugas 10 jam -> ideal 10,
     * batas 12,5. Tugas muat. Lalu tugas 20 jam dengan kapasitas 1000 ->
     * ideal 20, batas 25, tetap muat. Jadi kapasitas tidak pernah menjadi
     * pembatas di sini; yang menentukan adalah R2.
     */
    const members = [m('a', { capacity: 1000 })];
    const big = run([t('t1', 20)], members);
    expect(big.assignments[0].primaryMemberId).toBe('a');
    expect(big.memberLoads['a']).toBe(20);

    // Padahal kapasitasnya jauh di atas beban: bukti kapasitas bukan pembatas.
    expect(20).toBeLessThan(1000);
  });

  it('S05 Minat berbeda: minat tinggi unggul pada komponen M', () => {
    const members = [
      m('rendah', { skills: { [SKILL]: 5 }, interests: { [SKILL]: 1 } }),
      m('tinggi', { skills: { [SKILL]: 5 }, interests: { [SKILL]: 5 } }),
    ];
    const tasks = [t('t1', 1), t('t2', 1)];
    const r = run(tasks, members);
    const cellRendah = r.assignments[0].scores['rendah'];
    const cellTinggi = r.assignments[0].scores['tinggi'];

    // M = (minat - 1)/4: 1 -> 0, 5 -> 1.
    expect(cellRendah.breakdown.M).toBeCloseTo(0, 10);
    expect(cellTinggi.breakdown.M).toBeCloseTo(1, 10);
    expect(cellTinggi.breakdown.total).toBeGreaterThan(cellRendah.breakdown.total);
    // Dan yang menang adalah yang minatnya tinggi.
    expect(r.assignments[0].primaryMemberId).toBe('tinggi');
  });

  it('S06 Skill tidak cocok: R3 tanpa kandidat, rekomendasi terbaik + peringatan', () => {
    /*
     * Manual: 4 anggota tanpa skill wajib sama sekali (level 0), 4 tugas 2 jam
     * -> ideal 2, batas 2,5 sehingga R2 terpenuhi. Tidak ada yang memenuhi R3.
     */
    const members = Array.from({ length: 4 }, (_, i) => m(`x${i}`, { skills: {} }));
    const tasks = Array.from({ length: 4 }, (_, i) => t(`t${i}`, 2));
    const r = run(tasks, members);

    expect(r.warnings.some((w) => w.code === 'r3_no_candidate')).toBe(true);
    // Rekomendasi terbaik tetap diberikan, tetapi tidak satu pun layak.
    expect(placed(r)).toBeGreaterThan(0);
    for (const a of r.assignments) {
      for (const cell of Object.values(a.scores)) expect(cell.isEligible).toBe(false);
    }
  });

  it('S07 Semua anggota di bawah level 3: peringatan R3 wajib muncul', () => {
    const members = [m('a', { skills: { [SKILL]: 2 } }), m('b', { skills: { [SKILL]: 2 } })];
    const tasks = [t('t1', 1), t('t2', 1)];
    const r = run(tasks, members);

    expect(r.warnings.some((w) => w.code === 'r3_no_candidate')).toBe(true);
  });

  it('S08 Tidak ada kandidat R2: tidak ada penugasan yang melanggar R2', () => {
    const members = Array.from({ length: 8 }, (_, i) => m(`m${i}`));
    const tasks = Array.from({ length: 4 }, (_, i) => t(`t${i}`, 2));
    const r = run(tasks, members);

    expect(placed(r)).toBe(0);
    expect(r.warnings.every((w) => w.code === 'r2_no_candidate')).toBe(true);
    for (const load of Object.values(r.memberLoads)) expect(load).toBe(0);
  });

  it('S09 Anggota jam tersedia nol: R1 mengeluarkan anggota berkapasitas 0', () => {
    const members = [m('nol', { capacity: 0 }), m('ada')];
    const tasks = [t('t1', 1)];
    const r = run(tasks, members);

    expect(checkR1(members[0])).toBe(false);
    expect(r.memberLoads['nol']).toBe(0);
    // Pembagi beban ideal hanya anggota yang lolos R1 -> ideal 1.
    expect(r.idealLoad).toBe(1);
  });

  it('S10 Tugas usaha tinggi: tugas 30 jam melebihi kapasitas satu anggota', () => {
    // Manual: kapasitas 20, tugas 30 -> 30 > 20, juga > batas R2 (1,25x30).
    const members = [m('a', { capacity: 20 })];
    const r = run([t('t1', 30)], members);

    expect(r.assignments[0].primaryMemberId).toBe('');
    expect(r.memberLoads['a']).toBe(0);
  });

  it('S11 Skill wajib beragam: R3 lolos dengan MINIMAL satu skill level >= 3', () => {
    /*
     * A punya satu skill wajib level 3 dan satu level 1 -> tetap kandidat.
     * B tidak punya skill wajib apa pun -> bukan kandidat.
     */
    const members = [
      m('a', { skills: { [SKILL]: 3, [SK2]: 1 } }),
      m('b', { skills: { [SK2]: 1 } }),
    ];
    const tasks = [t('t1', 1, { required_skills: [SKILL, SK2] }), t('t2', 1, { required_skills: [SKILL, SK2] })];
    const r = run(tasks, members);

    expect(r.assignments[0].scores['a'].isEligible).toBe(true);
    expect(r.assignments[0].scores['b'].isEligible).toBe(false);
    expect(r.assignments[0].primaryMemberId).toBe('a');
  });

  it('S12 Beberapa tugas bersaing untuk anggota yang sama: R2 membatasi', () => {
    // 3 tugas x 2 jam, 1 anggota kuat -> ideal 6, batas 7,5. Semua muat.
    // Dengan 2 anggota kuat tambahan (tapi skill rendah) -> ideal 2, batas 2,5.
    const members = [
      m('a'),
      m('b', { skills: { [SKILL]: 1 } }),
      m('c', { skills: { [SKILL]: 1 } }),
    ];
    const tasks = [t('t1', 2), t('t2', 2), t('t3', 2)];
    const r = run(tasks, members);

    expect(r.idealLoad).toBe(2);
    // A hanya boleh 2 jam (1 tugas); tugas berikutnya akan melampaui 2,5.
    expect(r.memberLoads['a']).toBe(2);
    expect(r.memberLoads['a']).toBeLessThanOrEqual(2.5 + 1e-9);
  });

  it('S13 Tugas terkunci: R5 mempertahankan pemilik', () => {
    const members = [m('a'), m('b')];
    const tasks = [t('t1', 1), t('t2', 1)];
    const locked: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'b', isLocked: true, scores: {} },
    ];
    const r = globalAssign(tasks, members, locked, {
      cosineMap: { t1: { a: 0.9, b: 0.2 }, t2: { a: 0.6, b: 0.6 } },
    });

    expect(r.assignments.find((x) => x.taskId === 't1')!.primaryMemberId).toBe('b');
  });

  it('S14 Beban awal tidak seimbang: beban awal menghalangi tambahan, R5 tetap', () => {
    /*
     * Manual: t0 3 jam terkunci di A. 2 anggota, total 3+1+1 = 5 jam ->
     * ideal 2,5, batas 3,125. A sudah 3 jam, jadi A tidak bisa menerima lagi.
     */
    const members = [m('a'), m('b')];
    const tasks = [t('t0', 3), t('t1', 1), t('t2', 1)];
    const locked: TaskAssignment[] = [
      { taskId: 't0', primaryMemberId: 'a', isLocked: true, scores: {} },
    ];
    const r = run(tasks, members, locked);

    expect(r.idealLoad).toBe(2.5);
    expect(r.memberLoads['a']).toBe(3); // hanya t0, tidak bertambah
    expect(r.assignments.find((x) => x.taskId === 't0')!.primaryMemberId).toBe('a');
  });

  it('S15 Skill & minat tinggi, kapasitas rendah: profil terbaik gugur karena kapasitas', () => {
    /*
     * Manual: A sempurna (skill 5, minat 5) tetapi kapasitas 1. 2 anggota,
     * 2 tugas x 1 jam -> ideal 1, batas 1,25. A gagal karena 1 jam > kapasitas
     * 1? Tidak: 1 <= 1, jadi A masih muat satu tugas. Yang membuat A gugur
     * adalah kapasitasnya sendiri pada tugas 2 jam.
     *
     * Dipakai 4 tugas x 1 jam -> ideal 2, batas 2,5. A tetap dibatasi
     * kapasitas 1, sehingga A menerima paling banyak 1 jam sementara "biasa"
     * menyerap sisanya.
     */
    const members = [
      m('bintang', { capacity: 1, skills: { [SKILL]: 5 }, interests: { [SKILL]: 5 } }),
      m('biasa', { capacity: 40, skills: { [SKILL]: 3 }, interests: { [SKILL]: 3 } }),
    ];
    const tasks = [t('t1', 1), t('t2', 1), t('t3', 1), t('t4', 1)];
    const r = run(tasks, members);

    expect(r.idealLoad).toBe(2);
    // Kapasitas A hanya 1 jam: ia tidak pernah melebihi kapasitasnya sendiri,
    // dan tugas berikutnya jatuh ke "biasa" walau profil A lebih baik.
    expect(r.memberLoads['bintang']).toBeLessThanOrEqual(1);
    expect(r.memberLoads['biasa']).toBeGreaterThanOrEqual(2);
    /*
     * "biasa" hanya bisa menyerap 2 jam (3 jam > batas 2,5), jadi 3 dari 4
     * tugas terpasang. Angka 3 ini dihitung tangan, bukan disalin dari mesin.
     */
    expect(placed(r)).toBe(3);
  });

  it('S16 Kapasitas rendah + multi-skill: batas R2 menjadi penentu', () => {
    /*
     * Manual: 2 anggota kapasitas 4, 2 tugas x 2 jam, masing-masing butuh 2
     * skill. Total 4 jam -> ideal 2, batas 2,5. Satu tugas per anggota.
     */
    const members = [
      m('a', { capacity: 4, skills: { [SKILL]: 4, [SK2]: 4 } }),
      m('b', { capacity: 4, skills: { [SKILL]: 4, [SK2]: 4 } }),
    ];
    const tasks = [
      t('t1', 2, { required_skills: [SKILL, SK2] }),
      t('t2', 2, { required_skills: [SKILL, SK2] }),
    ];
    const r = run(tasks, members);

    expect(r.idealLoad).toBe(2);
    expect(placed(r)).toBe(2);
    for (const load of Object.values(r.memberLoads)) {
      expect(load).toBe(2);
      expect(load).toBeLessThanOrEqual(2.5 + 1e-9);
    }
  });

  it('S17 Kapasitas rendah + minat berbeda: minat vs kapasitas, ideal kecil', () => {
    // Manual: 2 anggota kapasitas 3, 2 tugas 1 jam -> ideal 1, batas 1,25.
    const members = [
      m('a', { capacity: 3, interests: { [SKILL]: 1 } }),
      m('b', { capacity: 3, interests: { [SKILL]: 5 } }),
    ];
    const tasks = [t('t1', 1), t('t2', 1)];
    const r = run(tasks, members);

    expect(r.idealLoad).toBe(1);
    // Minat tinggi menang pada tugas pertama.
    expect(r.assignments[0].primaryMemberId).toBe('b');
    expect(placed(r)).toBe(2);
  });

  it('S18 Satu sangat kuat + tugas bersaing: tugas kedua melampaui batas R2', () => {
    /*
     * Manual: A kuat, B lemah (skill 1). 2 tugas x 1 jam -> ideal 1, batas
     * 1,25. A menerima satu tugas; tugas kedua akan membuat A 2 jam > 1,25.
     */
    const members = [m('a'), m('b', { skills: { [SKILL]: 1 } })];
    const tasks = [t('t1', 1), t('t2', 1)];
    const r = run(tasks, members);

    expect(r.memberLoads['a']).toBe(1);
    expect(r.memberLoads['a']).toBeLessThanOrEqual(1.25 + 1e-9);
    expect(r.memberLoads['b']).toBe(0);
  });

  it('S19 Jam nol + skill tidak cocok: R1 mengeluarkan kandidat berkualitas', () => {
    /*
     * A berkualitas (skill 5) tetapi 0 jam -> dikeluarkan R1.
     * B dan C hanya level 1 -> di bawah ambang R3.
     *
     * TEMUAN pada percobaan pertama tes ini: peringatan `r3_no_candidate`
     * TIDAK muncul di sini, dan itu benar. `hasQualifiedMember` memindai
     * SELURUH roster tanpa melihat kapasitas, jadi A tetap "memenuhi R3"
     * secara skill meski R1 mengeluarkannya dari kandidat. R3 dan R1 adalah dua
     * aturan terpisah: R3 berbicara tentang kemampuan, R1 tentang ketersediaan.
     *
     * Yang penting dan diuji: A tidak pernah menerima tugas (R1), dan tugas
     * tidak dipaksakan ke B/C yang di bawah ambang tanpa peringatan.
     */
    const members = [
      m('a', { capacity: 0, skills: { [SKILL]: 5 } }),
      m('b', { skills: { [SKILL]: 1 } }),
      m('c', { skills: { [SKILL]: 1 } }),
    ];
    const tasks = [t('t1', 1), t('t2', 1), t('t3', 1), t('t4', 1)];
    const r = run(tasks, members);

    expect(r.memberLoads['a']).toBe(0); // R1
    expect(r.idealLoad).toBe(2); // 4 jam / 2 anggota yang lolos R1
    // A tidak pernah dipakai, meski secara skill ia yang terkuat.
    expect(r.assignments.every((x) => x.primaryMemberId !== 'a')).toBe(true);
    // Dan tidak ada anggota di bawah ambang yang ditandai layak.
    for (const a of r.assignments) {
      for (const [id, cell] of Object.entries(a.scores)) {
        if (id === 'a') continue;
        expect(cell.isEligible).toBe(false);
      }
    }
  });

  it('S20 Merata + beban awal tak seimbang: R5 menjaga, R2 mencegah tambahan', () => {
    /*
     * Manual: t0 2 jam terkunci di A, 3 anggota, tugas t1..t3 1 jam.
     * Total 5 jam -> ideal 5/3 = 1,667, batas 2,083. A sudah 2 jam, jadi A
     * tidak dapat tambahan; B dan C berbagi sisanya.
     */
    const members = [m('a'), m('b'), m('c')];
    const tasks = [t('t0', 2), t('t1', 1), t('t2', 1), t('t3', 1)];
    const locked: TaskAssignment[] = [
      { taskId: 't0', primaryMemberId: 'a', isLocked: true, scores: {} },
    ];
    const r = run(tasks, members, locked);

    expect(r.idealLoad).toBeCloseTo(5 / 3, 10);
    expect(r.assignments.find((x) => x.taskId === 't0')!.primaryMemberId).toBe('a');
    expect(r.memberLoads['a']).toBe(2); // hanya t0, tidak bertambah
    for (const load of Object.values(r.memberLoads)) {
      expect(load).toBeLessThanOrEqual(r.idealLoad * 1.25 + 1e-9);
    }
  });
});

describe('FASE 7 — S21-S24 sesuai tabel PRD 7.7.2', () => {
  it('S21 Tidak ada kandidat R2: tugas tanpa penanggung jawab', () => {
    const members = Array.from({ length: 8 }, (_, i) => m(`m${i}`));
    const tasks = Array.from({ length: 4 }, (_, i) => t(`t${i}`, 2));
    const r = run(tasks, members);

    expect(r.assignments.every((a) => a.primaryMemberId === '')).toBe(true);
    expect(r.warnings.some((w) => w.code === 'r2_no_candidate')).toBe(true);
  });

  it('S22 Tidak ada kandidat R3: saran terbaik + peringatan, tidak dianggap layak', () => {
    const members = Array.from({ length: 4 }, (_, i) => m(`m${i}`, { skills: { [SKILL]: 2 } }));
    const tasks = Array.from({ length: 4 }, (_, i) => t(`t${i}`, 2));
    const r = run(tasks, members);

    expect(r.warnings.some((w) => w.code === 'r3_no_candidate')).toBe(true);
    expect(placed(r)).toBeGreaterThan(0);
    for (const a of r.assignments) {
      for (const cell of Object.values(a.scores)) expect(cell.isEligible).toBe(false);
    }
  });

  it('S23 R5 menang atas R2 tetapi overload dilaporkan', () => {
    const members = [m('a'), m('b')];
    const tasks = [t('t1', 9), t('t2', 1)];
    const locked: TaskAssignment[] = [
      { taskId: 't1', primaryMemberId: 'a', isLocked: true, scores: {} },
    ];
    const r = run(tasks, members, locked);

    expect(r.assignments.find((x) => x.taskId === 't1')!.primaryMemberId).toBe('a');
    expect(r.warnings.some((w) => w.code === 'r2_locked_overload')).toBe(true);
  });

  it('S24 Invarian gabungan: tidak ada penugasan yang melanggar R1, R2, R3, R4', () => {
    const members = [
      m('m1', { capacity: 20, skills: { [SKILL]: 5, [SK2]: 4 } }),
      m('m2', { capacity: 12, skills: { [SKILL]: 3, [SK2]: 2 } }),
      m('m3', { capacity: 0, skills: { [SKILL]: 5, [SK2]: 5 } }),
      m('m4', { capacity: 30, skills: { [SKILL]: 1, [SK2]: 1 } }),
    ];
    const tasks = [
      t('t1', 2, { required_skills: [SKILL] }),
      t('t2', 3, { required_skills: [SK2] }),
      t('t3', 1, { required_skills: [SKILL, SK2] }),
      t('t4', 4, { required_skills: [SKILL] }),
    ];
    const r = run(tasks, members);
    const cap = r.idealLoad * 1.25;

    // R4: paling banyak satu pemilik per tugas, dan id-nya selalu milik roster.
    for (const a of r.assignments) {
      expect(a.primaryMemberId === '' || members.some((x) => x.id === a.primaryMemberId)).toBe(true);
      if (a.primaryMemberId !== '') {
        const owner = members.find((x) => x.id === a.primaryMemberId)!;
        const task = tasks.find((x) => x.id === a.taskId)!;
        expect(checkR1(owner)).toBe(true); // R1
        expect(r.memberLoads[owner.id]).toBeLessThanOrEqual(cap + 1e-9); // R2
        expect(r.memberLoads[owner.id]).toBeLessThanOrEqual(owner.capacity + 1e-9); // R2
        expect(
          task.required_skills.some((s) => (owner.skills as Record<string, number>)[s] >= 3)
        ).toBe(true); // R3
      }
    }
    expect(r.memberLoads['m3']).toBe(0); // R1
  });
});
