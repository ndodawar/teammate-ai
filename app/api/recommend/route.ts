import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db/project';
import { computeTaskMemberCosineMap } from '@/lib/scoring/pipeline';
import { globalAssign } from '@/lib/scoring/assign';
import { explainAssignments } from '@/lib/ai/explain';
import { AiRun, sanitizeErrorMessage } from '@/lib/ai/call-budget';
import { recordAiRun } from '@/lib/ai/ai-run';
import { recommendRequestSchema } from '@/lib/validation';
import { Task, Member, SkillTag } from '@/lib/scoring/types';
import { normalizeSkillName } from '@/lib/scoring/rules';

export async function POST(request: Request) {
  // FR-09/NFR-43: one run per recommendation process, created before any AI call.
  let run: AiRun | null = null;

  try {
    /*
     * T-FINAL-QA-01: validate the body before it reaches the engine.
     *
     * `weights` used to be forwarded as-is, so a NaN or an over-100% set produced
     * a NaN or inflated score instead of an error. Validation runs before the
     * project lookup and before `AiRun`, so a malformed request costs no quota.
     */
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body request harus berupa JSON.' }, { status: 400 });
    }

    const parsed = recommendRequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstMessage = parsed.error.issues[0]?.message;
      return NextResponse.json(
        { error: firstMessage || 'Data permintaan tidak valid.' },
        { status: 400 }
      );
    }

    const { code, weights, isFallback } = parsed.data;

    const supabase = getSupabaseClient();

    // 1. Fetch project
    const { data: project, error: pError } = await supabase
      .from('projects')
      .select('id')
      .eq('code', code)
      .single();

    if (pError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Fetch members with skills
    const { data: membersData, error: mError } = await supabase
      .from('members')
      .select('*, member_skills(*)')
      .eq('project_id', project.id);

    if (mError) throw mError;

    // 3. Fetch tasks
    const { data: tasksData, error: tError } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', project.id);

    if (tError) throw tError;

    // Map to internal types
    const members: Member[] = (membersData || []).map((m) => {
      const skills: Record<string, number> = {};
      const interests: Record<string, number> = {};

      const mSkills = (m as { member_skills: { skill_name: string; skill_level: number; interest_level: number }[] }).member_skills || [];
      mSkills.forEach((s) => {
        /*
         * T-ROOT-CAUSE-03: stored skill names are free text ("Frontend",
         * "Penulisan Akademik"), while a task's required_skills are taxonomy
         * tags. Keying this map by the raw string meant a member holding the
         * skill at level 5 matched nothing, so S scored 0 and R3 reported "no
         * capable member" for a roster that was in fact capable. The canonical
         * key is written first so every downstream lookup agrees; the raw name
         * is kept as a fallback for any reader that still expects it.
         */
        const canonical = normalizeSkillName(s.skill_name);
        if (!canonical) return;
        // Highest level wins when two labels collapse to the same skill.
        skills[canonical] = Math.max(skills[canonical] ?? 0, s.skill_level);
        interests[canonical] = Math.max(interests[canonical] ?? 0, s.interest_level);
      });

      return {
        id: m.id,
        name: m.name,
        skills,
        interests,
        capacity: m.capacity || 0,
      };
    });

    const tasks: Task[] = (tasksData || []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description || undefined,
      difficulty: t.effort,
      estimated_hours: t.estimated_hours,
      required_skills: (t.required_skills as SkillTag[]) || [],
    }));

    // 4. Compute Cosine Map (one batched embedding call on a cold cache)
    run = new AiRun(project.id);
    const cosineResult = await computeTaskMemberCosineMap(tasks, members, run);

    // FR-13: degrade to fallback when any embedding is missing provider-side.
    // Database and mapping failures above stay fatal.
    const isFallbackMode = isFallback === true || cosineResult.isEmbeddingFailed;

    // 5. Initial Assignment
    const assigned = globalAssign(tasks, members, [], {
      weights,
      isFallback: isFallbackMode,
      cosineMap: cosineResult.cosineMap
    });

    // 6. FR-09: one batched explanation call, template-only in fallback mode.
    const result = await explainAssignments({
      tasks,
      members,
      result: assigned,
      isFallback: isFallbackMode,
      run,
    });

    // NFR-43/44: one row per process. A logging failure never fails the request.
    const summary = run.finish(isFallbackMode ? 'fallback' : 'success');
    if (summary) {
      await recordAiRun(summary);
    }

    return NextResponse.json({
      tasks,
      members,
      cosineMap: cosineResult.cosineMap,
      result,
      isFallback: isFallbackMode
    });

  } catch (error: unknown) {
    // NFR-41: operators get the sanitized detail in the server log; the browser
    // gets a stable message so a provider response cannot leak into the UI.
    console.error('Recommendation API error:', sanitizeErrorMessage(error));
    if (run) {
      run.noteError(error);
      const summary = run.finish('error');
      if (summary) {
        await recordAiRun(summary);
      }
    }
    return NextResponse.json({ error: 'Gagal menghitung rekomendasi. Coba lagi.' }, { status: 500 });
  }
}
