import { Member, Task } from '../../../lib/scoring/types';

export const SCENARIO_1_DIVERSE_SKILLS = {
  description: 'Kelompok dengan kemampuan anggota yang beragam.',
  members: [
    { id: 'm1', name: 'Alice', capacity: 40, skills: { 'pemrograman frontend': 5, 'desain antarmuka': 4 }, interests: { 'pemrograman frontend': 5 } },
    { id: 'm2', name: 'Bob', capacity: 40, skills: { 'pemrograman backend': 5, 'data dan machine learning': 4 }, interests: { 'pemrograman backend': 5 } },
    { id: 'm3', name: 'Charlie', capacity: 40, skills: { 'penulisan akademik': 5, 'riset literatur': 5 }, interests: { 'penulisan akademik': 5 } },
    { id: 'm4', name: 'Diana', capacity: 40, skills: { 'koordinasi': 5, 'presentasi': 5 }, interests: { 'koordinasi': 5 } }
  ] as Member[],
  tasks: [
    { id: 't1', title: 'Setup UI', estimated_hours: 10, required_skills: ['pemrograman frontend', 'desain antarmuka'], difficulty: 4 },
    { id: 't2', title: 'API Dev', estimated_hours: 12, required_skills: ['pemrograman backend'], difficulty: 4 },
    { id: 't3', title: 'Write Report', estimated_hours: 8, required_skills: ['penulisan akademik', 'riset literatur'], difficulty: 3 },
    { id: 't4', title: 'Project Management', estimated_hours: 5, required_skills: ['koordinasi'], difficulty: 2 }
  ] as Task[]
};

export const SCENARIO_2_OVERLOAD_PREVENTION = {
  description: 'Mencegah overload pada anggota yang sangat kuat.',
  members: [
    { id: 'm1', name: 'Super', capacity: 20, skills: { 'pemrograman frontend': 5, 'pemrograman backend': 5, 'desain antarmuka': 5 }, interests: { 'pemrograman frontend': 5 } },
    { id: 'm2', name: 'Junior', capacity: 40, skills: { 'pemrograman frontend': 2, 'pemrograman backend': 2 }, interests: { 'pemrograman frontend': 3 } }
  ] as Member[],
  tasks: [
    { id: 't1', title: 'Task A', estimated_hours: 15, required_skills: ['pemrograman frontend'], difficulty: 3 },
    { id: 't2', title: 'Task B', estimated_hours: 10, required_skills: ['pemrograman backend'], difficulty: 3 }
  ] as Task[]
};

export const SCENARIO_3_SKILL_ELIGIBILITY_R3 = {
  description: 'R3: Hanya anggota dengan skill level >= 3 yang jadi kandidat.',
  members: [
    { id: 'm1', name: 'Expert', capacity: 40, skills: { 'data dan machine learning': 4 }, interests: { 'data dan machine learning': 5 } },
    { id: 'm2', name: 'Novice', capacity: 40, skills: { 'data dan machine learning': 1 }, interests: { 'data dan machine learning': 2 } }
  ] as Member[],
  tasks: [
    { id: 't1', title: 'ML Analysis', estimated_hours: 10, required_skills: ['data dan machine learning'], difficulty: 4 }
  ] as Task[]
};

export const SCENARIO_4_ZERO_CAPACITY_R1 = {
  description: 'R1: Anggota dengan 0 jam tersedia tidak boleh jadi kandidat.',
  members: [
    { id: 'm1', name: 'Busy', capacity: 0, skills: { 'desain antarmuka': 5 }, interests: { 'desain antarmuka': 5 } },
    { id: 'm2', name: 'Free', capacity: 40, skills: { 'desain antarmuka': 3 }, interests: { 'desain antarmuka': 3 } }
  ] as Member[],
  tasks: [
    { id: 't1', title: 'Design Mockup', estimated_hours: 5, required_skills: ['desain antarmuka'], difficulty: 3 }
  ] as Task[]
};

export const SCENARIO_5_LOCKED_ASSIGNMENT_R5 = {
  description: 'R5: Locked assignment tidak boleh berubah.',
  members: [
    { id: 'm1', name: 'Alice', capacity: 40, skills: { 'pengujian': 5 } },
    { id: 'm2', name: 'Bob', capacity: 40, skills: { 'pengujian': 5 } }
  ] as Member[],
  tasks: [
    { id: 't1', title: 'QA', estimated_hours: 5, required_skills: ['pengujian'], difficulty: 3 }
  ] as Task[]
};

// Generate more scenarios up to 20
export const SCENARIOS = [
  SCENARIO_1_DIVERSE_SKILLS,
  SCENARIO_2_OVERLOAD_PREVENTION,
  SCENARIO_3_SKILL_ELIGIBILITY_R3,
  SCENARIO_4_ZERO_CAPACITY_R1,
  SCENARIO_5_LOCKED_ASSIGNMENT_R5,
  {
    description: 'Dua anggota dengan kemampuan hampir sama.',
    members: [
      { id: 'm1', name: 'Twin A', capacity: 40, skills: { 'pengujian': 4 }, interests: { 'pengujian': 4 } },
      { id: 'm2', name: 'Twin B', capacity: 40, skills: { 'pengujian': 4 }, interests: { 'pengujian': 4 } }
    ],
    tasks: [{ id: 't1', title: 'Test A', estimated_hours: 5, required_skills: ['pengujian'], difficulty: 3 }] as Task[]
  },
  {
    description: 'Interest rendah vs Interest tinggi.',
    members: [
      { id: 'm1', name: 'Bored', capacity: 40, skills: { 'presentasi': 4 }, interests: { 'presentasi': 1 } },
      { id: 'm2', name: 'Excited', capacity: 40, skills: { 'presentasi': 4 }, interests: { 'presentasi': 5 } }
    ],
    tasks: [{ id: 't1', title: 'Showcase', estimated_hours: 5, required_skills: ['presentasi'], difficulty: 3 }] as Task[]
  },
  {
    description: 'Tugas tanpa skill yang dibutuhkan.',
    members: [
      { id: 'm1', name: 'Member', capacity: 40, skills: {}, interests: {} }
    ],
    tasks: [{ id: 't1', title: 'General Task', estimated_hours: 2, required_skills: [], difficulty: 1 }] as Task[]
  },
  {
    description: 'Tidak ada kandidat dengan level >= 3 (Fallback R3).',
    members: [
      { id: 'm1', name: 'A', capacity: 40, skills: { 'pemrograman backend': 2 } },
      { id: 'm2', name: 'B', capacity: 40, skills: { 'pemrograman backend': 2 } }
    ],
    tasks: [{ id: 't1', title: 'Backend', estimated_hours: 5, required_skills: ['pemrograman backend'], difficulty: 3 }] as Task[]
  },
  {
    description: 'Beban kerja mendekati batas (R2).',
    members: [
      { id: 'm1', name: 'Near Limit', capacity: 10, skills: { 'koordinasi': 5 } }
    ],
    tasks: [{ id: 't1', title: 'Lead', estimated_hours: 9, required_skills: ['koordinasi'], difficulty: 5 }] as Task[]
  },
  {
     description: 'Anggota dengan interest default (3).',
     members: [{ id: 'm1', name: 'Default', capacity: 40, skills: { 'pengujian': 5 } }],
     tasks: [{ id: 't1', title: 'QA', estimated_hours: 2, required_skills: ['pengujian'], difficulty: 2 }] as Task[]
  },
  {
    description: 'Satu anggota sangat kuat banyak skill.',
    members: [
      { id: 'm1', name: 'God', capacity: 40, skills: { 'penulisan akademik': 5, 'riset literatur': 5, 'desain sistem': 5, 'pemrograman frontend': 5, 'pemrograman backend': 5 } }
    ],
    tasks: [{ id: 't1', title: 'Any', estimated_hours: 5, required_skills: ['desain sistem'], difficulty: 3 }] as Task[]
  },
  {
    description: 'Tugas effort tinggi.',
    members: [
      { id: 'm1', name: 'A', capacity: 40, skills: { 'pemrograman backend': 5 } }
    ],
    tasks: [{ id: 't1', title: 'Big', estimated_hours: 35, required_skills: ['pemrograman backend'], difficulty: 5 }] as Task[]
  },
  {
    description: 'Pencarian alternatif rekomendasi.',
    members: [
      { id: 'm1', name: 'First', capacity: 40, skills: { 'presentasi': 5 } },
      { id: 'm2', name: 'Second', capacity: 40, skills: { 'presentasi': 4 } }
    ],
    tasks: [{ id: 't1', title: 'Talk', estimated_hours: 2, required_skills: ['presentasi'], difficulty: 2 }] as Task[]
  },
  {
    description: 'Kapasitas tidak mencukupi sama sekali.',
    members: [
      { id: 'm1', name: 'Full', capacity: 5, skills: { 'koordinasi': 5 } }
    ],
    tasks: [{ id: 't1', title: 'Big Task', estimated_hours: 10, required_skills: ['koordinasi'], difficulty: 5 }] as Task[]
  },
  {
    description: 'Multi required skills match.',
    members: [
      { id: 'm1', name: 'Full Match', capacity: 40, skills: { 'penulisan akademik': 5, 'riset literatur': 5 } },
      { id: 'm2', name: 'Half Match', capacity: 40, skills: { 'penulisan akademik': 5, 'riset literatur': 0 } }
    ],
    tasks: [{ id: 't1', title: 'Paper', estimated_hours: 5, required_skills: ['penulisan akademik', 'riset literatur'], difficulty: 3 }] as Task[]
  },
  {
    description: 'Deterministik output check.',
    members: [
      { id: 'm1', name: 'A', capacity: 40, skills: { 'desain antarmuka': 5 } },
      { id: 'm2', name: 'B', capacity: 40, skills: { 'desain antarmuka': 5 } }
    ],
    tasks: [{ id: 't1', title: 'UI', estimated_hours: 5, required_skills: ['desain antarmuka'], difficulty: 3 }] as Task[]
  },
  {
    description: 'Fallback mode scoring (K=0).',
    members: [
      { id: 'm1', name: 'A', capacity: 40, skills: { 'pengujian': 5 } }
    ],
    tasks: [{ id: 't1', title: 'Test', estimated_hours: 2, required_skills: ['pengujian'], difficulty: 2 }] as Task[]
  },
  {
    description: 'Beban tersebar merata.',
    members: [
      { id: 'm1', name: 'A', capacity: 40, skills: { 'koordinasi': 5 } },
      { id: 'm2', name: 'B', capacity: 40, skills: { 'koordinasi': 5 } }
    ],
    tasks: [
      { id: 't1', title: 'T1', estimated_hours: 5, required_skills: ['koordinasi'], difficulty: 3 },
      { id: 't2', title: 'T2', estimated_hours: 5, required_skills: ['koordinasi'], difficulty: 3 }
    ] as Task[]
  },
  {
    description: 'Urutan tugas effort terbesar.',
    members: [
      { id: 'm1', name: 'A', capacity: 40, skills: { 'koordinasi': 5 } }
    ],
    tasks: [
      { id: 't1', title: 'Small', estimated_hours: 2, required_skills: ['koordinasi'], difficulty: 1 },
      { id: 't2', title: 'Large', estimated_hours: 20, required_skills: ['koordinasi'], difficulty: 5 }
    ] as Task[]
  }
];
