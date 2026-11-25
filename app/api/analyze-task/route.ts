import { NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeTasks } from '@/lib/ai/analyze-task';
import { AiRun, sanitizeErrorMessage } from '@/lib/ai/call-budget';
import { recordAiRun } from '@/lib/ai/ai-run';

const requestSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      // PRD limit: a task description is at most 500 characters, and US-06 makes
      // it required. `trim()` runs before `min(1)` so a description holding only
      // whitespace is rejected here, matching `taskSchema`.
      description: z
        .string('Deskripsi tugas wajib diisi.')
        .trim()
        .min(1, 'Deskripsi tugas wajib diisi.')
        .max(500, 'Deskripsi tugas maksimal 500 karakter.'),
    })
  ).min(1).max(50),
});

export async function POST(request: Request) {
  let run: AiRun | null = null;

  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      /*
       * Surface the first readable message instead of the opaque
       * "Invalid request payload". The generic sentence stays as the fallback
       * for a body that is not shaped like the schema at all, but a field-level
       * problem now reaches the user as the sentence the schema already
       * carries ("Deskripsi tugas wajib diisi.").
       */
      const firstMessage = parsed.error.issues[0]?.message;
      return NextResponse.json(
        {
          error: firstMessage || 'Invalid request payload',
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    // Analysis is its own process, so it gets its own run (max 1 call).
    run = new AiRun(null);
    const analyses = await analyzeTasks(parsed.data.tasks, run);

    const summary = run.finish('success');
    if (summary) {
      await recordAiRun(summary);
    }

    return NextResponse.json({ analyses });
  } catch (error: unknown) {
    // NFR-41: log for operators, return a message safe for the browser. Provider
    // responses can echo the request back, so the raw text is redacted and the
    // client only sees a stable summary.
    console.error('Task analysis failed:', sanitizeErrorMessage(error));

    if (run) {
      const summary = run.finish('error');
      if (summary) {
        await recordAiRun(summary);
      }
    }

    return NextResponse.json(
      { error: 'Analisis AI gagal. Periksa kembali tugas Anda atau gunakan mode cadangan.' },
      { status: 500 }
    );
  }
}
