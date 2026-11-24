import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load env vars from .env.local manually for the test environment
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

// Import handlers AFTER env vars are set
import { POST as projectPOST } from '@/app/api/projects/route';
import { POST as tasksPOST, GET as tasksGET } from '@/app/api/projects/[code]/tasks/route';
import { PUT as taskPUT, DELETE as taskDELETE } from '@/app/api/projects/[code]/tasks/[id]/route';

let supabase: SupabaseClient;
let testProjectCode: string;
let testProjectId: string;

describe('Integration: FR-04/FR-05 Smoke Test', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SECRET_KEY!;
    if (!url || !key) {
      throw new Error('SUPABASE_URL or SUPABASE_SECRET_KEY not set in .env.local');
    }
    supabase = createClient(url, key);
  });

  it('4.a Buat proyek pengujian', async () => {
    const payload = { title: 'Smoke Test FR04 FR05', deadline: '2026-12-31' };
    const req = new Request('http://localhost/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const res = await projectPOST(req);
    const json = await res.json();

    console.log('4.a Project Create Status:', res.status);
    expect(res.status).toBe(201);
    expect(json.code).toBeDefined();
    testProjectCode = json.code;
    testProjectId = json.id;
    console.log('    Project Code:', testProjectCode);
  });

  it('4.b Panggil load_templates dan pastikan 11 draft diterima', async () => {
    const req = new Request(`http://localhost/api/projects/${testProjectCode}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load_templates' }),
    });

    const res = await tasksPOST(req, { params: Promise.resolve({ code: testProjectCode }) });
    const json = await res.json();

    console.log('4.b Load Templates Status:', res.status);
    expect(res.status).toBe(200);
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBe(11);
    expect(json[0].source).toBe('template');
    
    // Verify no tasks inserted yet
    const { count } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', testProjectId);
    expect(count).toBe(0);
    console.log('    Draft count:', json.length, '| DB Task count:', count);
  });

  it('4.c Simpan satu tugas template dengan effort 3 dan estimated_hours 12', async () => {
    const payload = {
      title: 'Tugas Template',
      description: 'Dari template',
      effort: 3,
      estimated_hours: 12,
      required_skills: ['desain sistem'],
      source: 'template'
    };
    const req = new Request(`http://localhost/api/projects/${testProjectCode}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await tasksPOST(req, { params: Promise.resolve({ code: testProjectCode }) });
    const json = await res.json();

    console.log('4.c Save Template Task Status:', res.status);
    expect(res.status).toBe(201);
    expect(json.effort).toBe(3);
    expect(json.difficulty).toBe(3);
    expect(json.estimated_hours).toBe(12);
    console.log('    Effort:', json.effort, '| Difficulty:', json.difficulty, '| Hours:', json.estimated_hours);
  });

  it('4.d Simpan satu tugas manual dengan effort 4 dan estimated_hours 20', async () => {
    const payload = {
      title: 'Tugas Manual',
      description: 'Input manual',
      effort: 4,
      estimated_hours: 20,
      required_skills: ['pemrograman backend'],
      source: 'manual'
    };
    const req = new Request(`http://localhost/api/projects/${testProjectCode}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await tasksPOST(req, { params: Promise.resolve({ code: testProjectCode }) });
    const json = await res.json();

    console.log('4.d Save Manual Task Status:', res.status);
    expect(res.status).toBe(201);
    expect(json.effort).toBe(4);
    expect(json.difficulty).toBe(4);
    expect(json.estimated_hours).toBe(20);
    console.log('    Effort:', json.effort, '| Difficulty:', json.difficulty, '| Hours:', json.estimated_hours);
  });

  it('4.e Verifikasi difficulty mengikuti effort dan estimated_hours tetap independen', async () => {
    const res = await tasksGET(
      new Request(`http://localhost/api/projects/${testProjectCode}/tasks`),
      { params: Promise.resolve({ code: testProjectCode }) }
    );
    const json = await res.json();

    console.log('4.e GET Tasks Status:', res.status);
    expect(res.status).toBe(200);
    expect(json.length).toBe(2);

    const manual = json.find((t: { title: string }) => t.title === 'Tugas Manual');
    expect(manual.effort).toBe(4);
    expect(manual.difficulty).toBe(4);
    expect(manual.estimated_hours).toBe(20);

    const template = json.find((t: { title: string }) => t.title === 'Tugas Template');
    expect(template.effort).toBe(3);
    expect(template.difficulty).toBe(3);
    expect(template.estimated_hours).toBe(12);
    console.log('    Verification PASSED');
  });

  it('4.f Edit tugas manual menjadi effort 5 dan estimated_hours 25', async () => {
    const getRes = await tasksGET(
      new Request(`http://localhost/api/projects/${testProjectCode}/tasks`),
      { params: Promise.resolve({ code: testProjectCode }) }
    );
    const tasks = await getRes.json();
    const manualTask = tasks.find((t: { title: string }) => t.title === 'Tugas Manual');

    const payload = {
      ...manualTask,
      effort: 5,
      estimated_hours: 25,
    };

    const req = new Request(`http://localhost/api/projects/${testProjectCode}/tasks/${manualTask.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await taskPUT(req, { params: Promise.resolve({ code: testProjectCode, id: manualTask.id }) });
    const json = await res.json();

    console.log('4.f Edit Task Status:', res.status);
    expect(res.status).toBe(200);
    expect(json.effort).toBe(5);
    expect(json.difficulty).toBe(5);
    expect(json.estimated_hours).toBe(25);
    console.log('    Updated Effort:', json.effort, '| Updated Difficulty:', json.difficulty, '| Updated Hours:', json.estimated_hours);
  });

  it('4.g Uji input estimated_hours tidak valid', async () => {
    const payload = {
      title: 'Tugas Invalid',
      effort: 3,
      estimated_hours: -5,
      required_skills: ['pengujian'],
    };
    const req = new Request(`http://localhost/api/projects/${testProjectCode}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await tasksPOST(req, { params: Promise.resolve({ code: testProjectCode }) });
    console.log('4.g Invalid Input Status:', res.status);
    expect(res.status).toBe(400);
  });

  it('4.h Hapus tugas pengujian', async () => {
    const getRes = await tasksGET(
      new Request(`http://localhost/api/projects/${testProjectCode}/tasks`),
      { params: Promise.resolve({ code: testProjectCode }) }
    );
    const tasks = await getRes.json();
    
    console.log('4.h Deleting', tasks.length, 'tasks...');
    for (const task of tasks) {
      const res = await taskDELETE(
        new Request(`http://localhost/api/projects/${testProjectCode}/tasks/${task.id}`, {
          method: 'DELETE'
        }),
        { params: Promise.resolve({ code: testProjectCode, id: task.id }) }
      );
      expect(res.status).toBe(200);
    }

    const { count } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', testProjectId);
    expect(count).toBe(0);
    console.log('    Tasks remaining in DB:', count);
  });

  afterAll(async () => {
    if (testProjectId) {
      console.log('4.i Cleaning up project:', testProjectId);
      const { error } = await supabase.from('projects').delete().eq('id', testProjectId);
      if (error) console.error('    Cleanup failed:', error);
      else console.log('    Project deleted successfully');
    }
  });
});
