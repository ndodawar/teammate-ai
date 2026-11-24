import { describe, it, expect } from 'vitest';
import { TASK_TEMPLATES } from '@/lib/constants/task-templates';

describe('Task Templates Catalog (T-3.28)', () => {
  it('should have exactly 11 templates', () => {
    expect(TASK_TEMPLATES).toHaveLength(11);
  });

  it('should have unique IDs and non-empty titles/descriptions', () => {
    const ids = new Set<string>();
    for (const t of TASK_TEMPLATES) {
      expect(t.id).toBeDefined();
      expect(t.title.trim().length).toBeGreaterThan(0);
      expect(t.description.trim().length).toBeGreaterThan(0);
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
    }
  });

  it('should have consistent expected template IDs', () => {
    const expectedIds = ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11'];
    const actualIds = TASK_TEMPLATES.map((t) => t.id);
    expect(actualIds).toEqual(expectedIds);
  });
});
