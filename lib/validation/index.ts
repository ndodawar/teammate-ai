import { z } from 'zod';
import { SKILL_TAXONOMY } from '@/lib/scoring/types';

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Judul tugas wajib diisi.'),
  description: z.string().max(500, 'Deskripsi tugas maksimal 500 karakter.').optional().nullable(),
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
  capacity: z.number().int().positive(),
  skills: z.array(
    z.object({
      skill_name: z.string().trim().min(1),
      skill_level: z.number().int().min(1).max(5),
      interest_level: z.number().int().min(1).max(5),
    })
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
