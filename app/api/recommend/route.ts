import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db/project';
import { computeTaskMemberCosineMap } from '@/lib/scoring/pipeline';
import { globalAssign } from '@/lib/scoring/assign';
import { explainAssignments } from '@/lib/ai/explain';
import { AiRun, sanitizeErrorMessage } from '@/lib/ai/call-budget';
import { recordAiRun } from '@/lib/ai/ai-run';
import { Task, Member, SkillTag } from '@/lib/scoring/types';

export async function POST(request: Request) {
  // FR-09/NFR-43: one run per recommendation process, created before any AI call.
  let run: AiRun | null = null;

  try {
    const { code, weights, isFallback } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Project code is required' }, { status: 400 });
    }

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
        skills[s.skill_name] = s.skill_level;
        interests[s.skill_name] = s.interest_level;
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
