import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/lib/db/project';

/**
 * FR-16 / US-17: records a decision event for a project.
 *
 * The `events` table already exists (migration 001) with `project_id`, `type`,
 * `payload`, `created_at`, so no schema change is needed. Two constraints from
 * PRD §6.4 shape this route:
 *
 *  - `type` is an allow-list, so the client cannot invent new event kinds;
 *  - the payload is scalar-only and stripped of free text, because a note or a
 *    task description may hold personal data. Only the nickname PRD allows is
 *    kept.
 */

const EVENT_TYPES = [
  'recommendation_created',
  'recommendation_accepted',
  'assignment_changed',
  'assignment_swapped',
  'assignment_locked',
  'assignment_unlocked',
  'recommendation_fallback',
  'export_generated',
  'system_error',
] as const;

const payloadSchema = z
  .object({
    taskId: z.string().uuid().optional(),
    taskTitle: z.string().max(160).optional(),
    memberId: z.string().uuid().optional(),
    memberName: z.string().max(60).optional(),
    previousMemberName: z.string().max(60).optional(),
    fromMemberName: z.string().max(60).optional(),
    toMemberName: z.string().max(60).optional(),
    weightK: z.number().optional(),
    weightS: z.number().optional(),
    weightC: z.number().optional(),
    weightM: z.number().optional(),
    isFallback: z.boolean().optional(),
    changedTaskCount: z.number().int().min(0).optional(),
    taskCount: z.number().int().min(0).optional(),
    memberCount: z.number().int().min(0).optional(),
    format: z.enum(['csv', 'text']).optional(),
    message: z.string().max(200).optional(),
  })
  .strict();

const eventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  payload: payloadSchema.optional().default({}),
});

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { code } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body request harus berupa JSON.' }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Jenis atau isi kejadian tidak valid.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseClient();
    const project = await supabase.from('projects').select('id').eq('code', code).maybeSingle();
    if (project.error) throw project.error;
    if (!project.data) {
      return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
    }

    const { error } = await supabase.from('events').insert([
      {
        project_id: project.data.id,
        type: parsed.data.type,
        payload: parsed.data.payload,
      },
    ]);

    if (error) {
      // FR-16 is observability, not a gate on the user's work: the client treats
      // a failed write as a failed write and keeps going.
      console.error('[POST /api/projects/[code]/events] insert failed', {
        code,
        eventType: parsed.data.type,
        error: error.message,
      });
      return NextResponse.json({ error: 'Gagal mencatat kejadian.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/projects/[code]/events] unhandled', {
      code,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Gagal mencatat kejadian.' }, { status: 500 });
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { code } = await context.params;

  try {
    const supabase = getSupabaseClient();
    const project = await supabase.from('projects').select('id').eq('code', code).maybeSingle();
    if (project.error) throw project.error;
    if (!project.data) {
      return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
    }

    const events = await supabase
      .from('events')
      .select('id, type, payload, created_at')
      .eq('project_id', project.data.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (events.error) throw events.error;
    return NextResponse.json(events.data ?? []);
  } catch (error: unknown) {
    console.error('[GET /api/projects/[code]/events] failed', {
      code,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Gagal memuat kejadian.' }, { status: 500 });
  }
}
