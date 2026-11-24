import { NextResponse } from 'next/server';
import { memberSchema, projectCodeSchema } from '@/lib/validation';
import { getSupabaseClient } from '@/lib/db/project';

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
    console.error('[GET /api/members] lookup', { code, error: project.error });
    return NextResponse.json({ error: 'Gagal memuat anggota.' }, { status: 500 });
  }
  if (!project.data) {
    return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
  }

  const members = await supabase
    .from('members')
    .select('id, name')
    .eq('project_id', project.data.id);

  if (members.error) {
    console.error('[GET /api/members] list', { projectId: project.data.id, error: members.error });
    return NextResponse.json({ error: 'Gagal memuat anggota.' }, { status: 500 });
  }

  return NextResponse.json(members.data ?? []);
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

  const parsed = memberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Nama anggota wajib diisi, maksimal 60 karakter.' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();
  const project = await supabase.from('projects').select('id').eq('code', code).maybeSingle();
  if (project.error) {
    console.error('[POST /api/members] project lookup', { code, error: project.error });
    return NextResponse.json({ error: 'Gagal menambahkan anggota.' }, { status: 500 });
  }
  if (!project.data) {
    return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
  }

  const { id: projectId } = project.data;
  const inserted = await supabase
    .from('members')
    .insert([{ project_id: projectId, name: parsed.data.name.trim() }])
    .select('id, name')
    .single();

  if (inserted.error) {
    console.error('[POST /api/members] insert failed', { projectId, error: inserted.error });
    return NextResponse.json({ error: 'Gagal menambahkan anggota.' }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: inserted.data.id,
      name: inserted.data.name,
      link: `/p/${code}/members`,
    },
    { status: 201 }
  );
}
