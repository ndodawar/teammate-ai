import { Member, Task } from './types';
import { WORKLOAD_CAP_MULTIPLIER } from './constants';

export function checkR1(member: Member): boolean {
  return member.capacity > 0;
}

export function checkR2(member: Member, task: Task, currentLoad: number, idealLoad: number): boolean {
  const newLoad = currentLoad + task.estimated_hours;
  const maxAllowed = idealLoad * WORKLOAD_CAP_MULTIPLIER;
  return newLoad <= maxAllowed && newLoad <= member.capacity;
}

export function checkR3(task: Task, members: Member[]): Member[] {
  // R3: Jika ada anggota dengan minimal satu skill wajib berlevel 3 atau lebih, hanya anggota tersebut yang menjadi kandidat.
  // Jika tidak ada, sistem tetap memberikan rekomendasi terbaik dengan peringatan.
  const qualifiedMembers = members.filter(member => {
    if (task.required_skills.length === 0) return true;
    return task.required_skills.some(skill => {
      const level = member.skills[skill] ?? 0;
      return level >= 3;
    });
  });

  if (qualifiedMembers.length > 0) {
    return qualifiedMembers;
  }
  return members; // Fallback to all members with a warning
}

export function checkR4(assignmentsCount: number): boolean {
  return assignmentsCount === 1;
}

export function checkR5(isLocked: boolean): boolean {
  return isLocked;
}
