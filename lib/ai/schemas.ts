import { z } from 'zod';
import { SKILL_TAXONOMY } from '@/lib/scoring/types';

export const TaskAnalysisItemSchema = z.object({
  taskId: z.string(),
  requiredSkills: z
    .array(z.enum(SKILL_TAXONOMY))
    .min(1, 'Minimal 1 skill required')
    .max(4, 'Maksimal 4 skill required'),
  effort: z
    .number()
    .int('Effort must be an integer')
    .min(1, 'Effort minimal 1')
    .max(5, 'Effort maksimal 5'),
  note: z
    .string()
    .max(160, 'Note maksimal 160 karakter')
});

export const TaskAnalysisResponseSchema = z.object({
  analyses: z.array(TaskAnalysisItemSchema)
});

export type TaskAnalysisItem = z.infer<typeof TaskAnalysisItemSchema>;
export type TaskAnalysisResponse = z.infer<typeof TaskAnalysisResponseSchema>;
