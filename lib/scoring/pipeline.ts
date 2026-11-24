import { Task, Member } from './types';
import { embedTexts } from '@/lib/ai/analyze-task';
import { cosineSimilarity, isValidEmbeddingValues } from '@/lib/ai/embedding-cache';
import { AiRun } from '@/lib/ai/call-budget';
import { TaskMemberCosineMap } from './assign';

// embedding_cache.embedding is vector(768) in migration 001, so any other
// length cannot be persisted or compared meaningfully.
export function isValidEmbedding(vec: number[] | null | undefined): vec is number[] {
  return isValidEmbeddingValues(vec);
}

export function formatTaskText(task: Task): string {
  const desc = task.description ? ` - ${task.description}` : '';
  const skills = task.required_skills.length > 0 ? ` (Skills: ${task.required_skills.join(', ')})` : '';
  return `${task.title}${desc}${skills}`;
}

export function formatMemberText(member: Member): string {
  const skillList = Object.entries(member.skills)
    .map(([skill, level]) => `${skill}: level ${level}`)
    .join(', ');
  const interestList = member.interests
    ? Object.entries(member.interests)
        .map(([skill, level]) => `${skill}: minat ${level}`)
        .join(', ')
    : '';
  const skillsText = skillList ? ` Skills: ${skillList}.` : '';
  const interestsText = interestList ? ` Minat: ${interestList}.` : '';
  return `${member.name}.${skillsText}${interestsText}`;
}

export interface CosineMapResult {
  cosineMap: TaskMemberCosineMap;
  isEmbeddingFailed: boolean;
  failedPairs: string[];
}

export async function computeTaskMemberCosineMap(
  tasks: Task[],
  members: Member[],
  run?: AiRun
): Promise<CosineMapResult> {
  const cosineMap: TaskMemberCosineMap = {};
  const failedPairs: string[] = [];

  const taskEmbeddings = new Map<string, number[]>();
  const memberEmbeddings = new Map<string, number[]>();

  // One request for every text in the process. Cache hits are filtered out inside
  // embedTexts, so a warm run reaches Gemini zero times.
  const taskTexts = tasks.map((task) => formatTaskText(task));
  const memberTexts = members.map((member) => formatMemberText(member));
  const vectors = await embedTexts([...taskTexts, ...memberTexts], run);

  tasks.forEach((task, index) => {
    const vec = vectors[index];
    if (isValidEmbedding(vec)) {
      taskEmbeddings.set(task.id, vec);
    }
  });

  members.forEach((member, index) => {
    const vec = vectors[tasks.length + index];
    if (isValidEmbedding(vec)) {
      memberEmbeddings.set(member.id, vec);
    }
  });

  for (const task of tasks) {
    cosineMap[task.id] = {};
    const taskVec = taskEmbeddings.get(task.id);

    for (const member of members) {
      const memberVec = memberEmbeddings.get(member.id);

      if (!taskVec || !memberVec) {
        failedPairs.push(`${task.id}:${member.id}`);
        continue;
      }

      cosineMap[task.id][member.id] = cosineSimilarity(taskVec, memberVec);
    }
  }

  return { cosineMap, isEmbeddingFailed: failedPairs.length > 0, failedPairs };
}
