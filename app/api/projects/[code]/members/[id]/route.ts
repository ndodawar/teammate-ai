import { NextResponse } from 'next/server';
import { memberProfileSchema, projectCodeSchema } from '@/lib/validation';
import { getSupabaseClient } from '@/lib/db/project';

interface RouteContext {
  params: Promise<{ code: string; id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { code, id } = await context.params;
  if (!projectCodeSchema.safeParse(code).success) {
    return NextResponse.json({ error: 'Kode proyek tidak valid.' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const project = await supabase.from('projects').select('id').eq('code', code).maybeSingle();
  if (project.error) {
    console.error('[GET /api/projects/[code]/members/[id]] project lookup', { code, error: project.error });
    return NextResponse.json({ error: 'Gagal memuat profil anggota.' }, { status: 500 });
  }
  if (!project.data) {
    return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
  }

  const member = await supabase
    .from('members')
    .select('id, project_id, name, capacity, note, preference_score, created_at')
    .eq('id', id)
    .maybeSingle();

  if (member.error) {
    console.error('[GET /api/projects/[code]/members/[id]] member lookup', { memberId: id, error: member.error });
    return NextResponse.json({ error: 'Gagal memuat profil anggota.' }, { status: 500 });
  }
  if (!member.data) {
    return NextResponse.json({ error: 'Anggota tidak ditemukan.' }, { status: 404 });
  }

  // Ensure member belongs to this project
  if (member.data.project_id !== project.data.id) {
    return NextResponse.json({ error: 'Anggota tidak ditemukan dalam proyek ini.' }, { status: 404 });
  }

  const skillsRes = await supabase
    .from('member_skills')
    .select('id, skill_name, skill_level, interest_level')
    .eq('member_id', id);

  if (skillsRes.error) {
    console.error('[GET /api/projects/[code]/members/[id]] skills lookup', { memberId: id, error: skillsRes.error });
    return NextResponse.json({ error: 'Gagal memuat keterampilan anggota.' }, { status: 500 });
  }

  return NextResponse.json({
    ...member.data,
    skills: skillsRes.data ?? [],
  });
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

  const parsed = memberProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Data profil anggota tidak valid.', details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { name, note, capacity, skills } = parsed.data;
  const supabase = getSupabaseClient();

  // Single RPC call for atomic update
  const { data, error } = await supabase.rpc('update_member_profile', {
    p_member_id: id,
    p_project_code: code,
    p_name: name,
    p_note: note || null, // Normalize empty string to null
    p_capacity: capacity,
    p_skills: skills,
  });

  if (error) {
    console.error('[PUT /api/projects/[code]/members/[id]] RPC error', { memberId: id, error });
    
    // Handle known exceptions from the function
    if (error.message.includes('Proyek tidak ditemukan')) {
      return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
    }
    if (error.message.includes('Anggota tidak ditemukan')) {
      return NextResponse.json({ error: 'Anggota tidak ditemukan dalam proyek ini.' }, { status: 404 });
    }
    
    return NextResponse.json({ error: 'Gagal memperbarui profil anggota.' }, { status: 500 });
  }

  return NextResponse.json(data);
}
