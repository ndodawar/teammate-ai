import { NextResponse } from 'next/server';
import { projectCodeSchema, taskSchema } from '@/lib/validation';
import { getSupabaseClient } from '@/lib/db/project';
import { TASK_TEMPLATES } from '@/lib/constants/task-templates';

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { code } = await context.params;
  if (!projectCodeSchema.safeParse(code).success) {
    return NextResponse.json({ error: 'Kode proyek tidak valid.' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const project = await supabase.from('projects').select('id').eq('code', code).maybeSingle();
  if (project.error) {
    console.error('[GET /api/tasks] project lookup', { code, error: project.error });
    return NextResponse.json({ error: 'Gagal memuat daftar tugas.' }, { status: 500 });
  }
  if (!project.data) {
    return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
  }

  const tasks = await supabase
    .from('tasks')
    .select('id, project_id, title, description, effort, difficulty, estimated_hours, required_skills, due_date, locked, source, created_at')
    .eq('project_id', project.data.id)
    .order('created_at', { ascending: true });

  if (tasks.error) {
    console.error('[GET /api/tasks] list failed', { projectId: project.data.id, error: tasks.error });
    return NextResponse.json({ error: 'Gagal memuat daftar tugas.' }, { status: 500 });
  }

  return NextResponse.json(tasks.data ?? []);
}

export async function POST(request: Request, context: RouteContext) {
  const { code } = await context.params;
  if (!projectCodeSchema.safeParse(code).success) {
    return NextResponse.json({ error: 'Kode proyek tidak valid.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body request harus berupa JSON.' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const project = await supabase.from('projects').select('id').eq('code', code).maybeSingle();
  if (project.error) {
    console.error('[POST /api/tasks] project lookup', { code, error: project.error });
    return NextResponse.json({ error: 'Gagal memproses tugas.' }, { status: 500 });
  }
  if (!project.data) {
    return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
  }

  const { id: projectId } = project.data;

  // Handle template catalog retrieval (returns drafts without DB insertion)
  if (typeof body === 'object' && body !== null && (body as { action?: string }).action === 'load_templates') {
    const templateDrafts = TASK_TEMPLATES.map((tmpl) => ({
      template_id: tmpl.id,
      title: tmpl.title,
      description: tmpl.description,
      effort: 3,
      required_skills: [],
      due_date: null,
      locked: false,
      source: 'template',
    }));

    return NextResponse.json(templateDrafts, { status: 200 });
  }

  // Handle manual task creation
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Data tugas tidak valid.';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const taskData = parsed.data;
  const effortValue = taskData.effort;

  const inserted = await supabase
    .from('tasks')
    .insert([
      {
        project_id: projectId,
        title: taskData.title,
        description: taskData.description ?? null,
        effort: effortValue,
        difficulty: effortValue,
        estimated_hours: taskData.estimated_hours,
        required_skills: taskData.required_skills ?? [],
        due_date: taskData.due_date ?? null,
        locked: taskData.locked ?? false,
        source: taskData.source ?? 'manual',
      },
    ])
    .select('id, project_id, title, description, effort, difficulty, estimated_hours, required_skills, due_date, locked, source, created_at')
    .single();

  if (inserted.error) {
    console.error('[POST /api/tasks] insert failed', { projectId, error: inserted.error });
    return NextResponse.json({ error: 'Gagal membuat tugas.' }, { status: 500 });
  }

  return NextResponse.json(inserted.data, { status: 201 });
}
