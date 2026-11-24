import { NextResponse } from 'next/server';
import { projectCodeSchema, taskSchema } from '@/lib/validation';
import { getSupabaseClient } from '@/lib/db/project';

interface RouteContext {
  params: Promise<{ code: string; id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const { code, id } = await context.params;

  if (!projectCodeSchema.safeParse(code).success) {
    return NextResponse.json({ error: 'Kode proyek tidak valid.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body request harus berupa JSON.' }, { status: 400 });
  }

  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Data tugas tidak valid.';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const project = await supabase.from('projects').select('id').eq('code', code).maybeSingle();
  if (project.error) {
    console.error('[PUT /api/tasks/[id]] project lookup', { code, id, error: project.error });
    return NextResponse.json({ error: 'Gagal memperbarui tugas.' }, { status: 500 });
  }
  if (!project.data) {
    return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
  }

  const existingTask = await supabase
    .from('tasks')
    .select('id')
    .eq('id', id)
    .eq('project_id', project.data.id)
    .maybeSingle();

  if (existingTask.error) {
    console.error('[PUT /api/tasks/[id]] task lookup', { id, error: existingTask.error });
    return NextResponse.json({ error: 'Gagal memperbarui tugas.' }, { status: 500 });
  }
  if (!existingTask.data) {
    return NextResponse.json({ error: 'Tugas tidak ditemukan.' }, { status: 404 });
  }

  const taskData = parsed.data;
  const effortValue = taskData.effort;

  const updated = await supabase
    .from('tasks')
    .update({
      title: taskData.title,
      description: taskData.description ?? null,
      effort: effortValue,
      difficulty: effortValue,
      estimated_hours: taskData.estimated_hours,
      required_skills: taskData.required_skills ?? [],
      due_date: taskData.due_date ?? null,
      locked: taskData.locked ?? false,
      source: taskData.source ?? 'manual',
    })
    .eq('id', id)
    .eq('project_id', project.data.id)
    .select('id, project_id, title, description, effort, difficulty, estimated_hours, required_skills, due_date, locked, source, created_at')
    .single();

  if (updated.error) {
    console.error('[PUT /api/tasks/[id]] update failed', { id, error: updated.error });
    return NextResponse.json({ error: 'Gagal memperbarui tugas.' }, { status: 500 });
  }

  return NextResponse.json(updated.data);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { code, id } = await context.params;

  if (!projectCodeSchema.safeParse(code).success) {
    return NextResponse.json({ error: 'Kode proyek tidak valid.' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const project = await supabase.from('projects').select('id').eq('code', code).maybeSingle();
  if (project.error) {
    console.error('[DELETE /api/tasks/[id]] project lookup', { code, id, error: project.error });
    return NextResponse.json({ error: 'Gagal menghapus tugas.' }, { status: 500 });
  }
  if (!project.data) {
    return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
  }

  const existingTask = await supabase
    .from('tasks')
    .select('id')
    .eq('id', id)
    .eq('project_id', project.data.id)
    .maybeSingle();

  if (existingTask.error) {
    console.error('[DELETE /api/tasks/[id]] task lookup', { id, error: existingTask.error });
    return NextResponse.json({ error: 'Gagal menghapus tugas.' }, { status: 500 });
  }
  if (!existingTask.data) {
    return NextResponse.json({ error: 'Tugas tidak ditemukan.' }, { status: 404 });
  }

  const deleted = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('project_id', project.data.id);

  if (deleted.error) {
    console.error('[DELETE /api/tasks/[id]] delete failed', { id, error: deleted.error });
    return NextResponse.json({ error: 'Gagal menghapus tugas.' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Tugas berhasil dihapus.' });
}
