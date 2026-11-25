import { NextResponse } from 'next/server';
import { projectSchema } from '@/lib/validation';
import { getSupabaseClient, generateProjectCode } from '@/lib/db/project';

export async function POST(request: Request) {
  /*
   * T-FINAL-QA-01: a body that is not JSON is a client error, not a server one.
   *
   * `request.json()` throws on malformed input, and the outer catch turned that
   * into a 500 "Internal server error". Every sibling route (members, tasks,
   * events) already answers 400 with a readable sentence, so the browser showed
   * a server fault for a mistake the user can fix by retrying the form.
   */
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body request harus berupa JSON.' }, { status: 400 });
  }

  try {
    const parsed = projectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { title, deadline } = parsed.data;
    const code = generateProjectCode();

    const { data, error } = await getSupabaseClient()
      .from('projects')
      .insert([{ title, deadline, code }])
      .select('id, title, deadline, code')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Project code collision. Please try again.' },
          { status: 409 }
        );
      }
      // Browser gets a generic message; the server log carries the code only.
      console.error('[POST /api/projects] insert failed', {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      title: data.title,
      deadline: data.deadline,
      code: data.code,
      link: `/p/${data.code}/members`
    }, { status: 201 });

  } catch (err) {
    console.error('[POST /api/projects] unhandled', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
