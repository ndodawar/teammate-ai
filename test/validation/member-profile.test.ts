import { describe, it, expect } from 'vitest';
import { memberProfileSchema } from '@/lib/validation';

describe('FR-03 memberProfileSchema validation', () => {
  it('menerima profil anggota yang valid secara keseluruhan', () => {
    const valid = {
      name: 'Rani',
      note: 'Catatan opsional',
      capacity: 40,
      skills: [
        { skill_name: 'Frontend', skill_level: 4, interest_level: 5 },
      ],
    };
    const result = memberProfileSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('menolak nama kosong atau hanya spasi', () => {
    expect(memberProfileSchema.safeParse({ name: '', capacity: 40, skills: [] }).success).toBe(false);
    expect(memberProfileSchema.safeParse({ name: '   ', capacity: 40, skills: [] }).success).toBe(false);
  });

  it('memvalidasi note: opsional/null, tepat 300 karakter, dan lebih dari 300 karakter', () => {
    const base = { name: 'Rani', capacity: 40, skills: [] };
    
    // Kosong / null / undefined
    expect(memberProfileSchema.safeParse({ ...base, note: undefined }).success).toBe(true);
    expect(memberProfileSchema.safeParse({ ...base, note: null }).success).toBe(true);
    expect(memberProfileSchema.safeParse({ ...base, note: '' }).success).toBe(true);

    // Tepat 300 karakter
    const exactly300 = 'a'.repeat(300);
    expect(memberProfileSchema.safeParse({ ...base, note: exactly300 }).success).toBe(true);

    // Lebih dari 300 karakter
    const over300 = 'a'.repeat(301);
    expect(memberProfileSchema.safeParse({ ...base, note: over300 }).success).toBe(false);
  });

  it('memvalidasi capacity: menolak 0, negatif, desimal; menerima bilangan bulat positif', () => {
    const base = { name: 'Rani', skills: [] };

    expect(memberProfileSchema.safeParse({ ...base, capacity: 0 }).success).toBe(false);
    expect(memberProfileSchema.safeParse({ ...base, capacity: -10 }).success).toBe(false);
    expect(memberProfileSchema.safeParse({ ...base, capacity: 10.5 }).success).toBe(false);
    expect(memberProfileSchema.safeParse({ ...base, capacity: 1 }).success).toBe(true);
    expect(memberProfileSchema.safeParse({ ...base, capacity: 40 }).success).toBe(true);
  });

  it('memvalidasi skill_level dan interest_level rentang 1-5', () => {
    const base = { name: 'Rani', capacity: 40 };

    // Di bawah 1
    expect(memberProfileSchema.safeParse({
      ...base,
      skills: [{ skill_name: 'JS', skill_level: 0, interest_level: 3 }]
    }).success).toBe(false);

    expect(memberProfileSchema.safeParse({
      ...base,
      skills: [{ skill_name: 'JS', skill_level: 3, interest_level: -1 }]
    }).success).toBe(false);

    // Tepat 1 dan 5
    expect(memberProfileSchema.safeParse({
      ...base,
      skills: [{ skill_name: 'JS', skill_level: 1, interest_level: 5 }]
    }).success).toBe(true);

    // Di atas 5
    expect(memberProfileSchema.safeParse({
      ...base,
      skills: [{ skill_name: 'JS', skill_level: 6, interest_level: 3 }]
    }).success).toBe(false);

    expect(memberProfileSchema.safeParse({
      ...base,
      skills: [{ skill_name: 'JS', skill_level: 3, interest_level: 6 }]
    }).success).toBe(false);
  });

  it('menolak skill_name kosong atau hanya spasi', () => {
    const base = { name: 'Rani', capacity: 40 };

    expect(memberProfileSchema.safeParse({
      ...base,
      skills: [{ skill_name: '', skill_level: 3, interest_level: 3 }]
    }).success).toBe(false);

    expect(memberProfileSchema.safeParse({
      ...base,
      skills: [{ skill_name: '   ', skill_level: 3, interest_level: 3 }]
    }).success).toBe(false);
  });

  it('menerima array skills kosong maupun beberapa skill valid', () => {
    const base = { name: 'Rani', capacity: 40 };

    expect(memberProfileSchema.safeParse({ ...base, skills: [] }).success).toBe(true);

    expect(memberProfileSchema.safeParse({
      ...base,
      skills: [
        { skill_name: 'Frontend', skill_level: 4, interest_level: 5 },
        { skill_name: 'Backend', skill_level: 3, interest_level: 4 },
      ]
    }).success).toBe(true);
  });
});
