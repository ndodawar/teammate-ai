import { z } from 'zod';
import { SKILL_TAXONOMY } from '@/lib/scoring/types';
// Shared with the engine so the dedup rule and the scoring lookup agree on what
// "the same skill" means: same case, spacing, underscore and hyphen handling.
import { normalizeSkillName, isTaxonomySkill } from '@/lib/scoring/rules';

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Judul tugas wajib diisi.'),
  /*
   * PRD US-06 lists "Deskripsi tugas wajib diisi" as an acceptance criterion, so
   * this is a required field, not an optional one. It used to be
   * `.optional().nullable()`, which meant the form accepted a blank description
   * and stored NULL, while `/api/analyze-task` required at least one character.
   * The two schemas disagreed, and the user met the API's raw Zod text
   * ("Too small: expected string to have >=1 characters") instead of a
   * sentence. `trim()` runs before `min(1)` so a field holding only spaces is
   * treated as empty rather than as content.
   */
  description: z
    .string('Deskripsi tugas wajib diisi.')
    .trim()
    .min(1, 'Deskripsi tugas wajib diisi.')
    .max(500, 'Deskripsi tugas maksimal 500 karakter.'),
  difficulty: z.number().int().min(1).max(5).optional().default(3),
  estimated_hours: z
    .number('Estimasi jam wajib diisi berupa angka.')
    .int('Estimasi jam harus berupa angka bulat.')
    .positive('Estimasi jam harus bernilai positif.'),
  required_skills: z.array(z.string()).refine(
    (skills) => skills.every((s) => (SKILL_TAXONOMY as readonly string[]).includes(s)),
    'Keterampilan harus berasal dari taksonomi tetap.'
  ),
  effort: z.number().int().min(1).max(5, 'Bobot usaha harus di antara 1 dan 5.').default(3),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid, gunakan YYYY-MM-DD')
    .optional()
    .nullable(),
  locked: z.boolean().optional().default(false),
  source: z.enum(['template', 'manual']).default('manual'),
});

export const memberSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export const memberProfileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  note: z.string().max(300).nullable().optional(),
  /*
   * MASTER-MATRIX-HARDENING-01 H1-03: `positive()` on its own emits Zod's own
   * English text ("Too small: expected number to be >0") into the API `details`,
   * while every other message here is an Indonesian sentence. Supplying the
   * message keeps the rejection identical and only changes what the caller
   * reads.
   */
  capacity: z
    .number('Kapasitas waktu wajib diisi berupa angka.')
    .int('Kapasitas waktu harus berupa angka bulat.')
    .positive('Kapasitas waktu harus lebih besar dari 0 jam.'),
  skills: z
    .array(
      z.object({
        skill_name: z.string().trim().min(1, 'Nama keterampilan wajib diisi.'),
        skill_level: z.number().int().min(1).max(5),
        interest_level: z.number().int().min(1).max(5),
      })
    )
    /*
     * H1-01, user decision K-3(b): reject two rows that name the same skill once
     * spelling is normalised ("Frontend" and "frontend"), instead of storing both
     * and leaving the form with two confusing rows.
     *
     * The scoring engine already survived duplicates by taking the highest level,
     * so this is not a correctness fix for the score. It stops the duplicate at
     * the door, which is cheaper than explaining later why a member has the same
     * skill twice at different levels.
     *
     * Only the duplicate is rejected; the remaining rows are kept verbatim, and
     * stored data is untouched (no migration, no backfill).
     */
    .refine(
      (rows) => {
        const seen = new Set<string>();
        for (const row of rows) {
          const key = normalizeSkillName(row.skill_name);
          if (!key) continue;
          if (seen.has(key)) return false;
          seen.add(key);
        }
        return true;
      },
      {
        message:
          'Keterampilan yang sama tidak boleh dicantumkan dua kali. Gabungkan menjadi satu baris.',
      }
    ),
});

export const projectSchema = z.object({
  title: z.string().min(1).max(100),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid format, expected YYYY-MM-DD').refine((val) => {
    const [y, m, d] = val.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return (
      date.getUTCFullYear() === y &&
      date.getUTCMonth() === m - 1 &&
      date.getUTCDate() === d
    );
  }, 'Invalid calendar date'),
});

export const projectCodeSchema = z.string().regex(/^[0-9a-f]{24}$/, 'Invalid project code');

/**
 * T-FINAL-QA-01: the four K/S/C/M weights a caller may send with a
 * recommendation request (FR-10).
 *
 * `/api/recommend` previously forwarded `weights` from the request body straight
 * into `globalAssign`. A body of `{"K": NaN}` or `{"K": 0.8, "S": 0.8, ...}`
 * therefore produced a NaN score or a total above 100%, and the PRD invariant
 * "bobot berjumlah 100%" was enforced only by the client slider.
 *
 * Each weight is a finite number in [0, 1] and the four must sum to 1 within a
 * small tolerance, because the sliders redistribute to an exact 1.00 and only
 * floating-point drift can exceed it. Nothing here changes the weights
 * themselves: an invalid set is rejected, never silently corrected, so the
 * caller cannot believe a score was produced with weights it did not ask for.
 */
const WEIGHT_TOLERANCE = 1e-6;

export const weightsSchema = z
  .object({
    K: z.number().min(0).max(1),
    S: z.number().min(0).max(1),
    C: z.number().min(0).max(1),
    M: z.number().min(0).max(1),
  })
  .refine(
    (w) => Math.abs(w.K + w.S + w.C + w.M - 1) <= WEIGHT_TOLERANCE,
    'Total bobot K, S, C, dan M harus 100%.'
  );

/**
 * The recommendation request body. `weights` is optional so an older client that
 * sends only `code` keeps working: the engine then applies its own defaults.
 */
export const recommendRequestSchema = z.object({
  code: z.string().min(1, 'Kode proyek wajib diisi.'),
  weights: weightsSchema.optional(),
  isFallback: z.boolean().optional(),
});

/**
 * MASTER-MATRIX-HARDENING-01 H1-02, user decision K-1(b): warn, never reject.
 *
 * A member's skills are free text, while a task's `required_skills` must come
 * from `SKILL_TAXONOMY`. Normalisation only equates spellings, so a member typed
 * as "Python" or "Frontend" holds a skill no task can ever require, and the score
 * silently reads S = 0 with an R3 warning that looks like missing ability.
 *
 * Rejecting the save would throw away what the user wrote, which is not ours to
 * decide. Blocking the whole profile for a label the user may legitimately want
 * is also worse than the problem. So this returns a list of human sentences for
 * the names the engine cannot resolve, and the caller shows them; the save
 * proceeds exactly as before.
 *
 * Deliberately NOT a synonym map: "Python" is not translated to "pemrograman
 * backend". Inventing that mapping would be guessing at meaning, and the
 * vocabulary of every study group is not ours to assume.
 */
export function skillTaxonomyWarnings(skills: { skill_name: string }[]): string[] {
  const unmatched = skills
    .map((row) => row.skill_name.trim())
    .filter((name) => name.length > 0 && !isTaxonomySkill(name));

  if (unmatched.length === 0) return [];

  const unique = Array.from(new Set(unmatched));
  const list = unique.map((name) => `"${name}"`).join(', ');
  return [
    `${list} tidak ada dalam daftar keterampilan sistem, sehingga tidak akan cocok dengan keterampilan wajib tugas mana pun. ` +
      `Gunakan salah satu dari: ${SKILL_TAXONOMY.join(', ')}. Profil tetap tersimpan.`,
  ];
}
