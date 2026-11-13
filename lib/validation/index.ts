import { z } from 'zod';

export const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  difficulty: z.number().int().min(1).max(5),
  estimated_hours: z.number().positive(),
  required_skills: z.array(z.string())
});

export const memberSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  skills: z.array(z.string()),
  capacity: z.number().positive(),
  preference_score: z.number().min(0).max(1)
});
