/**
 * Explanation truthfulness (bagian I).
 *
 * Memeriksa apakah kalimat alasan rekomendasi sesuai DATA sebenarnya.
 * Dua sumber diperiksa:
 *   (1) `generateExplanation` (lib/scoring/assign.ts) — template yang dipakai saat
 *       AI gagal/tak tersedia; dikirim ke jalur explain dan disimpan di `reason`.
 *   (2) `memberReason` (lib/scoring/explain-local.ts) — teks yang benar-benar
 *       dirender di matriks dan diekspor ke CSV.
 *
 * Tiap klaim diperiksa otomatis terhadap data (nama, skill, level, minat,
 * kapasitas, skor, kondisi fallback). Klasifikasi:
 *   - "benar"            : klaim didukung data.
 *   - "tidak_didukung"   : klaim yang tidak bisa diverifikasi dari data (default).
 *   - "bertentangan"     : klaim berlawanan dengan data.
 *   - "tidak_cukup_info" : kalimat tidak memuat klaim yang bisa diuji.
 *
 * Output: eval/results/truthfulness.json + sampel untuk pemeriksaan manual.
 */

import { it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Member, Task, SkillTag } from '@/lib/scoring/types';
import { computeScore } from '@/lib/scoring/score';
import { generateExplanation } from '@/lib/scoring/assign';
import { memberReason } from '@/lib/scoring/explain-local';

const T = (s: string) => s as SkillTag;

type Verdict = 'benar' | 'tidak_didukung' | 'bertentangan' | 'tidak_cukup_info';

interface ClaimCheck {
  claim: string;
  verdict: Verdict;
  evidence: string;
}

interface TextAudit {
  source: 'generateExplanation' | 'memberReason';
  text: string;
  fallback: boolean;
  scorePercentInText: number | null;
  actualScorePercent: number;
  claims: ClaimCheck[];
  overall: Verdict;
}

/** Ekstrak persen skor dari teks: utamakan angka setelah "skor"/"skor kesesuaian". */
function extractPercent(text: string): number | null {
  const scoreFirst = text.match(/skor(?:\s+kesesuaian)?\s+(\d+)\s*%/i);
  if (scoreFirst) return Number(scoreFirst[1]);
  const m = text.match(/(\d+)\s*%/);
  return m ? Number(m[1]) : null;
}

function worst(verdicts: Verdict[]): Verdict {
  if (verdicts.includes('bertentangan')) return 'bertentangan';
  if (verdicts.includes('tidak_didukung')) return 'tidak_didukung';
  if (verdicts.every((v) => v === 'benar')) return 'benar';
  return 'tidak_cukup_info';
}

/** Audit `generateExplanation`. */
function auditGenerate(task: Task, member: Member, breakdown: { total: number; C: number }, fallback: boolean): TextAudit {
  const text = generateExplanation(task, member, { K: 0, S: 0, C: breakdown.C, M: 0, total: breakdown.total });
  const claims: ClaimCheck[] = [];

  // Klaim nama: harus menyebut nama anggota.
  claims.push({
    claim: `menyebut nama "${member.name}"`,
    verdict: text.includes(member.name) ? 'benar' : 'bertentangan',
    evidence: `teks memuat nama=${text.includes(member.name)}`,
  });

  // Klaim skill: "memiliki keterampilan relevan (X)" harus cocok dengan skill >=3.
  const matched = task.required_skills.filter((s) => (member.skills[s] ?? 0) >= 3);
  if (text.includes('memiliki keterampilan relevan')) {
    const inside = /\(([^)]*)\)/.exec(text)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    const matchesData = inside.length === matched.length && inside.every((s, i) => s === matched[i]);
    claims.push({
      claim: 'daftar skill relevan sama dengan skill wajib level>=3',
      verdict: matchesData ? 'benar' : 'bertentangan',
      evidence: `teks=[${inside.join(',')}] data=[${matched.join(',')}]`,
    });
  } else if (text.includes('memenuhi persyaratan dasar')) {
    // Klaim "memenuhi persyaratan dasar" padahal TIDAK ada skill >=3 → menyesatkan.
    claims.push({
      claim: '"memenuhi persyaratan dasar" saat tidak ada skill wajib level>=3',
      verdict: matched.length === 0 ? 'tidak_didukung' : 'bertentangan',
      evidence: `skill>=3=${matched.length}; klaim generik tanpa dasar spesifik`,
    });
  }

  // Klaim kapasitas: "sisa kapasitas yang memadai" — TIDAK PERNAH diperiksa fungsinya.
  if (text.includes('sisa kapasitas yang memadai')) {
    const c = breakdown.C;
    claims.push({
      claim: '"sisa kapasitas yang memadai"',
      verdict: c > 0 ? 'tidak_didukung' : 'bertentangan',
      evidence: `C=${c.toFixed(2)}${c <= 0 ? ' (kapasitas 0 → klaim bertentangan)' : ' (klaim klaim tetap muncul tanpa mengecek besaran)'}`,
    });
  }

  // Klaim skor: "skor kesesuaian N%" harus sama dengan round(total*100).
  const pct = extractPercent(text);
  const actual = Math.round(breakdown.total * 100);
  claims.push({
    claim: `"skor kesesuaian ${pct}%"`,
    verdict: pct === actual ? 'benar' : 'bertentangan',
    evidence: `teks=${pct}%, aktual=${actual}%`,
  });
  // Jika skor 0%, frasa "dengan skor kesesuaian 0%" secara tata bahasa menyiratkan rekomendasi
  // positif. Tandai sebagai tidak_didukung saat total=0.
  if (actual === 0) {
    claims.push({
      claim: 'menyajikan skor 0% sebagai kalimat rekomendasi tanpa peringatan',
      verdict: 'tidak_didukung',
      evidence: 'total=0 (gagal R1/R2) tetapi kalimat tetap berbentuk afirmatif',
    });
  }

  return {
    source: 'generateExplanation',
    text,
    fallback,
    scorePercentInText: pct,
    actualScorePercent: actual,
    claims,
    overall: worst(claims.map((c) => c.verdict)),
  };
}

/** Audit `memberReason`. */
function auditMember(task: Task, member: Member, breakdown: { K: number; S: number; total: number; C: number; M: number }, fallback: boolean, isPrimary: boolean): TextAudit {
  const text = memberReason({ task, member, breakdown, isPrimary, isFallback: fallback });
  const claims: ClaimCheck[] = [];

  claims.push({ claim: `menyebut nama "${member.name}"`, verdict: text.includes(member.name) ? 'benar' : 'bertentangan', evidence: 'nama anggota' });

  const matched = task.required_skills.filter((s) => (member.skills[s] ?? 0) >= 3);
  if (matched.length > 0) {
    const ok = text.includes('menguasai') && matched.every((s) => text.includes(s));
    claims.push({ claim: 'skill yang "dikuasai" = skill wajib level>=3', verdict: ok ? 'benar' : 'bertentangan', evidence: `matched=[${matched.join(',')}]` });
  }

  // Kapasitas
  let capVerdict: Verdict;
  let capEvidence: string;
  if (member.capacity <= 0) {
    capVerdict = text.includes('R1') ? 'benar' : 'bertentangan';
    capEvidence = `capacity=${member.capacity}; teks menyebut R1=${text.includes('R1')}`;
  } else if (breakdown.C <= 0) {
    capVerdict = text.includes('tidak menyisakan kapasitas') ? 'benar' : 'bertentangan';
    capEvidence = `C=${breakdown.C}; teks menyebut kapasitas habis=${text.includes('tidak menyisakan kapasitas')}`;
  } else {
    const pctMatch = text.match(/menyisakan (\d+)% kapasitas/);
    const ok = pctMatch ? Number(pctMatch[1]) === Math.round(breakdown.C * 100) : false;
    capVerdict = ok ? 'benar' : 'bertentangan';
    capEvidence = `C*100=${Math.round(breakdown.C * 100)}; teks=${pctMatch?.[1] ?? '—'}`;
  }
  claims.push({ claim: 'pernyataan kapasitas konsisten dengan C', verdict: capVerdict, evidence: capEvidence });

  // Minat
  const interestWord = breakdown.M >= 0.75 ? 'berminat tinggi' : breakdown.M >= 0.25 ? 'minat sedang' : 'minat rendah';
  claims.push({ claim: `pernyataan minat "${interestWord}" sesuai M=${breakdown.M.toFixed(2)}`, verdict: text.includes(interestWord) ? 'benar' : 'bertentangan', evidence: `M=${breakdown.M.toFixed(2)}` });

  // Skor
  const pct = extractPercent(text);
  const actual = Math.round(breakdown.total * 100);
  claims.push({ claim: `"Skor ${pct}%"`, verdict: pct === actual ? 'benar' : 'bertentangan', evidence: `teks=${pct}%, aktual=${actual}%` });

  // Fallback
  if (fallback) {
    claims.push({ claim: 'menyatakan K tidak dihitung pada mode cadangan', verdict: text.includes('mode cadangan') ? 'benar' : 'bertentangan', evidence: `fallback=${fallback}` });
  }

  return {
    source: 'memberReason',
    text,
    fallback,
    scorePercentInText: pct,
    actualScorePercent: actual,
    claims,
    overall: worst(claims.map((c) => c.verdict)),
  };
}

it('truthfulness: periksa klaim generateExplanation & memberReason terhadap data', () => {
  // Bangun kumpulan (task, member, breakdown) dari beragam kondisi nyata.
  const cases: { task: Task; member: Member; fallback: boolean; isPrimary: boolean }[] = [
    // Kondisi normal: skill cocok, kapasitas cukup
    { task: { id: 't1', title: 'Tulis', estimated_hours: 4, difficulty: 2, required_skills: [T('penulisan akademik')] }, member: { id: 'm1', name: 'Ani', capacity: 40, skills: { [T('penulisan akademik')]: 4 }, interests: { [T('penulisan akademik')]: 5 } }, fallback: true, isPrimary: true },
    // Kapasitas habis (C=0) — memicu klaim "sisa kapasitas memadai" yang salah
    { task: { id: 't2', title: 'Data', estimated_hours: 10, difficulty: 4, required_skills: [T('data dan machine learning')] }, member: { id: 'm2', name: 'Budi', capacity: 5, skills: { [T('data dan machine learning')]: 3 }, interests: {} }, fallback: true, isPrimary: true },
    // Capacity 0 (R1)
    { task: { id: 't3', title: 'Koord', estimated_hours: 3, difficulty: 2, required_skills: [T('koordinasi')] }, member: { id: 'm3', name: 'Citra', capacity: 0, skills: { [T('koordinasi')]: 5 }, interests: {} }, fallback: true, isPrimary: true },
    // Tidak ada skill >=3
    { task: { id: 't4', title: 'Backend', estimated_hours: 5, difficulty: 3, required_skills: [T('pemrograman backend')] }, member: { id: 'm4', name: 'Dodi', capacity: 40, skills: { [T('pemrograman backend')]: 2 }, interests: {} }, fallback: true, isPrimary: true },
    // Minat rendah
    { task: { id: 't5', title: 'Presentasi', estimated_hours: 4, difficulty: 2, required_skills: [T('presentasi')] }, member: { id: 'm5', name: 'Eka', capacity: 40, skills: { [T('presentasi')]: 4 }, interests: { [T('presentasi')]: 1 } }, fallback: false, isPrimary: true },
    // Tugas tanpa skill
    { task: { id: 't6', title: 'Umum', estimated_hours: 2, difficulty: 1, required_skills: [] }, member: { id: 'm6', name: 'Fani', capacity: 40, skills: {} }, fallback: true, isPrimary: false },
  ];

  const audits: TextAudit[] = [];
  for (const c of cases) {
    // idealLoad dipilih agar sebagian besar kasus lolos R2 kecuali yang memang ekstrem
    const ideal = 20;
    const b = computeScore(c.task, c.member, 0, ideal, 0.5, undefined, c.fallback);
    audits.push(auditGenerate(c.task, c.member, { total: b.total, C: b.C }, c.fallback));
    audits.push(auditMember(c.task, c.member, { K: b.K, S: b.S, total: b.total, C: b.C, M: b.M }, c.fallback, c.isPrimary));
  }

  // Ringkasan
  const bySource = (s: TextAudit['source']) => audits.filter((a) => a.source === s);
  const summarize = (arr: TextAudit[]) => {
    const counts: Record<Verdict, number> = { benar: 0, tidak_didukung: 0, bertentangan: 0, tidak_cukup_info: 0 };
    for (const a of arr) for (const c of a.claims) counts[c.verdict] += 1;
    return counts;
  };
  const summary = {
    generateExplanation: { texts: bySource('generateExplanation').length, overallVerdicts: bySource('generateExplanation').map((a) => a.overall), claimCounts: summarize(bySource('generateExplanation')) },
    memberReason: { texts: bySource('memberReason').length, overallVerdicts: bySource('memberReason').map((a) => a.overall), claimCounts: summarize(bySource('memberReason')) },
  };

  mkdirSync('eval/results', { recursive: true });
  writeFileSync(join('eval/results', 'truthfulness.json'), JSON.stringify({ summary, audits }, null, 2));

  // Ekspektasi berbasis perilaku yang sudah didokumentasikan di explain-local.ts:
  // generateExplanation PASTI menghasilkan minimal satu "bertentangan"/"tidak_didukung"
  // (klaim sisa kapasitas / skor 0%), sedangkan memberReason TIDAK boleh ada yang "bertentangan".
  const genHasProblem = bySource('generateExplanation').some((a) => a.overall === 'bertentangan' || a.overall === 'tidak_didukung');
  const memberHasContradiction = bySource('memberReason').some((a) => a.claims.some((c) => c.verdict === 'bertentangan'));
  expect(genHasProblem, 'generateExplanation seharusnya memuat klaim tak terdukung/bertentangan').toBe(true);
  expect(memberHasContradiction, 'memberReason tidak boleh memuat klaim yang BERTENTANGAN dengan data').toBe(false);
});
