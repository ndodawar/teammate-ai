/**
 * Validasi dataset D1 & D2 — dijalankan sebagai vitest:
 *   npx vitest run eval/scripts/validate_datasets.eval.ts
 *
 * Menulis eval/results/dataset_summary.json dan gagal bila dataset tidak sah.
 */

import { it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { TASK_TEMPLATES } from '@/lib/constants/task-templates';
import { buildD1, validateD1 } from '@/eval/datasets/d1_tasks';
import { D2_SCENARIOS, validateD2 } from '@/eval/datasets/d2_scenarios';

const d1 = buildD1(TASK_TEMPLATES);
const d1Errors = validateD1(d1);
const d2Errors = validateD2(D2_SCENARIOS);

const summary = {
  d1: {
    total: d1.length,
    templates: d1.filter((t) => t.origin === 'template').length,
    nonIt: d1.filter((t) => t.origin === 'synthetic-non-it').length,
    domains: [...new Set(d1.map((t) => t.domain))],
    descriptionLengths: {
      pendek: d1.filter((t) => t.descriptionLength === 'pendek').length,
      sedang: d1.filter((t) => t.descriptionLength === 'sedang').length,
      panjang: d1.filter((t) => t.descriptionLength === 'panjang').length,
    },
    effortBuckets: {
      rendah: d1.filter((t) => t.estimated_hours <= 4).length,
      sedang: d1.filter((t) => t.estimated_hours > 4 && t.estimated_hours <= 10).length,
      tinggi: d1.filter((t) => t.estimated_hours > 10).length,
    },
    skillCount: {
      none: d1.filter((t) => t.required_skills.length === 0).length,
      single: d1.filter((t) => t.required_skills.length === 1).length,
      multi: d1.filter((t) => t.required_skills.length > 1).length,
    },
    distinctSkills: [...new Set(d1.flatMap((t) => t.required_skills))].sort(),
  },
  d2: {
    total: D2_SCENARIOS.length,
    coveredConditions: [...new Set(D2_SCENARIOS.flatMap((s) => s.conditionTags))].sort(),
    totalMembers: D2_SCENARIOS.reduce((a, s) => a + s.members.length, 0),
    totalTasks: D2_SCENARIOS.reduce((a, s) => a + s.tasks.length, 0),
  },
  errors: { d1: d1Errors, d2: d2Errors },
  ok: d1Errors.length === 0 && d2Errors.length === 0,
};

it('D1: 11 template + 15 tugas non-IT sintetis, skill valid', () => {
  expect(d1Errors, JSON.stringify(d1Errors)).toEqual([]);
  expect(d1.length).toBe(26);
  expect(d1.filter((t) => t.origin === 'template').length).toBe(11);
  expect(d1.filter((t) => t.origin === 'synthetic-non-it').length).toBe(15);
  expect(d1.every((t) => t.synthetic)).toBe(true);
});

it('D1: variasi usaha & jumlah skill tercakup', () => {
  expect(summary.d1.effortBuckets.rendah).toBeGreaterThan(0);
  expect(summary.d1.effortBuckets.sedang).toBeGreaterThan(0);
  expect(summary.d1.effortBuckets.tinggi).toBeGreaterThan(0);
  expect(summary.d1.skillCount.single).toBeGreaterThan(0);
  expect(summary.d1.skillCount.multi).toBeGreaterThan(0);
  expect(summary.d1.descriptionLengths.pendek).toBeGreaterThan(0);
  expect(summary.d1.descriptionLengths.panjang).toBeGreaterThan(0);
});

it('D2: tepat 20 skenario & 15 kondisi wajib tercakup', () => {
  expect(d2Errors, JSON.stringify(d2Errors)).toEqual([]);
  expect(D2_SCENARIOS.length).toBe(20);
});

it('menulis ringkasan dataset', () => {
  mkdirSync('eval/results', { recursive: true });
  writeFileSync(join('eval/results', 'dataset_summary.json'), JSON.stringify(summary, null, 2));
  expect(summary.ok).toBe(true);
});
