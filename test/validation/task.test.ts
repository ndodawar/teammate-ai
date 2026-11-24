import { describe, it, expect } from 'vitest';
import { taskSchema } from '@/lib/validation';

const VALID_PAYLOAD = {
  title: 'Setup UI',
  description: 'Membangun antarmuka awal.',
  effort: 4,
  estimated_hours: 12,
  required_skills: ['pemrograman frontend', 'desain antarmuka'],
  due_date: '2026-12-01',
  locked: false,
  source: 'manual' as const,
};

describe('Task Validation Schema (T-3.30 / T-3.36)', () => {
  it('should validate valid task payload', () => {
    const parsed = taskSchema.safeParse(VALID_PAYLOAD);
    expect(parsed.success).toBe(true);
  });

  it('should reject empty title', () => {
    const parsed = taskSchema.safeParse({ ...VALID_PAYLOAD, title: '   ' });
    expect(parsed.success).toBe(false);
  });

  it('should reject description > 500 chars', () => {
    const parsed = taskSchema.safeParse({ ...VALID_PAYLOAD, description: 'a'.repeat(501) });
    expect(parsed.success).toBe(false);
  });

  it('should reject effort outside 1-5', () => {
    expect(taskSchema.safeParse({ ...VALID_PAYLOAD, effort: 6 }).success).toBe(false);
    expect(taskSchema.safeParse({ ...VALID_PAYLOAD, effort: 0 }).success).toBe(false);
  });

  it('should reject decimal effort', () => {
    const parsed = taskSchema.safeParse({ ...VALID_PAYLOAD, effort: 3.5 });
    expect(parsed.success).toBe(false);
  });

  it('should reject unknown required skills not in taxonomy', () => {
    const parsed = taskSchema.safeParse({
      ...VALID_PAYLOAD,
      required_skills: ['skill-ngawur-tidak-ada'],
    });
    expect(parsed.success).toBe(false);
  });

  it('should reject invalid due date format', () => {
    const parsed = taskSchema.safeParse({ ...VALID_PAYLOAD, due_date: '01-12-2026' });
    expect(parsed.success).toBe(false);
  });

  it('should reject invalid source enum', () => {
    const parsed = taskSchema.safeParse({ ...VALID_PAYLOAD, source: 'ai-generated' });
    expect(parsed.success).toBe(false);
  });

  it('should reject non-boolean locked', () => {
    const parsed = taskSchema.safeParse({ ...VALID_PAYLOAD, locked: 'true' });
    expect(parsed.success).toBe(false);
  });

  it('should require estimated_hours', () => {
    const withoutHours = { ...VALID_PAYLOAD } as Record<string, unknown>;
    delete withoutHours.estimated_hours;
    const parsed = taskSchema.safeParse(withoutHours);
    expect(parsed.success).toBe(false);
  });

  it('should reject estimated_hours of zero, negative, decimal, and string', () => {
    expect(taskSchema.safeParse({ ...VALID_PAYLOAD, estimated_hours: 0 }).success).toBe(false);
    expect(taskSchema.safeParse({ ...VALID_PAYLOAD, estimated_hours: -2 }).success).toBe(false);
    expect(taskSchema.safeParse({ ...VALID_PAYLOAD, estimated_hours: 2.5 }).success).toBe(false);
    expect(taskSchema.safeParse({ ...VALID_PAYLOAD, estimated_hours: '8' }).success).toBe(false);
  });

  it('should keep estimated_hours independent from effort', () => {
    const parsed = taskSchema.safeParse({ ...VALID_PAYLOAD, effort: 2, estimated_hours: 18 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.effort).toBe(2);
      expect(parsed.data.estimated_hours).toBe(18);
    }
  });
});
