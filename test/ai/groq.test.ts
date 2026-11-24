import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { groqChat, readGroqText, readGroqUsage, GroqApiError, GroqTimeoutError } from '@/lib/ai/groq';
import { analyzeTasks } from '@/lib/ai/analyze-task';
import { explainAssignments } from '@/lib/ai/explain';
import { AiRun, CallBudgetExceededError } from '@/lib/ai/call-budget';
import { globalAssign } from '@/lib/scoring/assign';
import { computeTaskMemberCosineMap } from '@/lib/scoring/pipeline';
import { Task, Member } from '@/lib/scoring/types';

/**
 * T-6.02 — Groq text generation.
 *
 * These tests hit a REAL local HTTP server that speaks Groq's OpenAI-compatible
 * protocol, not a `fetch` mock. That is deliberate: the things most likely to be
 * wrong in this integration are the wire contract (path, Authorization header,
 * JSON body shape) and the error mapping (non-2xx, timeout), and a mocked `fetch`
 * would assert those against my own assumptions instead of against HTTP.
 *
 * The one thing that cannot be proven here is that a live Groq account accepts
 * the key and model. That requires a real `GROQ_API_KEY` and is covered by
 * `test/ai/groq.live.test.ts`, which SKIPS (never fakes) when the key is absent.
 */

/**
 * Embeddings stay on Gemini (T-6.02 swapped text generation only). This stubs
 * the embedding edge so the FR-09 tests exercise only the Groq path under test.
 * Top-level because `vi.mock` is hoisted above every import in this file.
 */
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return {
      models: {
        generateContent: vi.fn(),
        embedContent: vi.fn(async (params: { contents: string | string[] }) => {
          const n = Array.isArray(params.contents) ? params.contents.length : 1;
          return { embeddings: Array.from({ length: n }, () => ({ values: Array(768).fill(0.1) })) };
        }),
      },
    };
  }),
}));

/** Records what the server actually received, so assertions read real traffic. */
const seen = {
  paths: [] as string[],
  auth: [] as string[],
  bodies: [] as Record<string, unknown>[],
  methods: [] as string[],
};

type Behaviour = 'ok' | 'json-error' | 'rate-limit' | 'slow' | 'no-content' | 'not-json';

let behaviour: Behaviour = 'ok';
let replyContent = '';
let server: Server;
let baseUrl = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      seen.paths.push(req.url ?? '');
      seen.methods.push(req.method ?? '');
      seen.auth.push(String(req.headers.authorization ?? ''));
      try {
        seen.bodies.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        seen.bodies.push({});
      }

      if (behaviour === 'slow') {
        // Never answers within the test timeout window below.
        setTimeout(() => {
          res.writeHead(200).end('{}');
        }, 5_000);
        return;
      }
      if (behaviour === 'rate-limit') {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Rate limit reached for model' } }));
        return;
      }
      if (behaviour === 'json-error') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'model_not_found' } }));
        return;
      }
      if (behaviour === 'no-content') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: null } }] }));
        return;
      }
      if (behaviour === 'not-json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: 'not json at all' } }] }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'chatcmpl-test',
          choices: [{ index: 0, message: { role: 'assistant', content: replyContent } }],
          usage: { prompt_tokens: 278, completion_tokens: 90, total_tokens: 368 },
        })
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  // Mirrors the real base URL shape, which already ends in `/v1`.
  baseUrl = `http://127.0.0.1:${port}/openai/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  behaviour = 'ok';
  replyContent = '';
  seen.paths.length = 0;
  seen.auth.length = 0;
  seen.bodies.length = 0;
  seen.methods.length = 0;

  vi.stubEnv('GROQ_API_KEY', 'gsk_ci_placeholder_key');
  vi.stubEnv('GROQ_MODEL_TEXT', 'llama-3.3-70b-versatile');
  vi.stubEnv('GROQ_BASE_URL', baseUrl);
});

const env = () => ({
  GROQ_API_KEY: 'gsk_ci_placeholder_key',
  GROQ_MODEL_TEXT: 'llama-3.3-70b-versatile',
  GROQ_BASE_URL: baseUrl,
});

const chat = () =>
  groqChat(
    {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Balas JSON.' }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 64,
    },
    { env: env(), timeoutMs: 2_000 }
  );

describe('T-6.02 — Groq wire contract', () => {
  it('posts to {base}/chat/completions with a Bearer token and the JSON-mode body', async () => {
    replyContent = '{"ok":true}';

    const response = await chat();

    expect(seen.methods).toEqual(['POST']);
    // The base URL already carries `/v1`; the path must be appended once.
    expect(seen.paths[0]).toBe('/openai/v1/chat/completions');
    expect(seen.auth[0]).toBe('Bearer gsk_ci_placeholder_key');
    expect(seen.bodies[0]).toMatchObject({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: 'Balas JSON.' }],
    });
    expect(readGroqText(response)).toBe('{"ok":true}');
  });

  it('survives a base URL with a trailing slash without doubling it', async () => {
    replyContent = '{"ok":true}';
    await groqChat(
      {
        model: 'm',
        messages: [{ role: 'user', content: 'x' }],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 8,
      },
      { env: { ...env(), GROQ_BASE_URL: `${baseUrl}/` }, timeoutMs: 2_000 }
    );
    expect(seen.paths[0]).toBe('/openai/v1/chat/completions');
  });

  it('maps OpenAI-style usage onto the token shape the budget guard records', async () => {
    replyContent = '{"ok":true}';
    const response = await chat();

    expect(readGroqUsage(response)).toEqual({
      promptTokenCount: 278,
      candidatesTokenCount: 90,
    });
  });

  it('returns undefined usage when the provider omits it, never inventing a count', () => {
    expect(readGroqUsage({ choices: [] })).toBeUndefined();
    expect(readGroqUsage(null)).toBeUndefined();
  });
});

describe('T-6.02 — Groq failure paths', () => {
  it('raises GroqApiError with the provider status on 429', async () => {
    behaviour = 'rate-limit';
    await expect(chat()).rejects.toBeInstanceOf(GroqApiError);
    await expect(chat()).rejects.toMatchObject({ status: 429 });
  });

  it('raises GroqApiError carrying the provider reason on 400', async () => {
    behaviour = 'json-error';
    await expect(chat()).rejects.toThrow(/400/);
    await expect(chat()).rejects.toThrow(/model_not_found/);
  });

  it('raises GroqTimeoutError when the provider hangs past the deadline', async () => {
    behaviour = 'slow';
    await expect(chat()).rejects.toBeInstanceOf(GroqTimeoutError);
  }, 10_000);

  it('refuses to send a request at all when the key is missing', async () => {
    // The strict accessor must fail before any socket is opened.
    await expect(
      groqChat(
        {
          model: 'm',
          messages: [{ role: 'user', content: 'x' }],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 8,
        },
        { env: { GROQ_BASE_URL: baseUrl } }
      )
    ).rejects.toThrow(/GROQ_API_KEY/);

    expect(seen.paths).toHaveLength(0);
  });

  it('does not leak the API key into an error message', async () => {
    behaviour = 'rate-limit';
    try {
      await chat();
      expect.unreachable('expected the call to fail');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain('gsk_ci_placeholder_key');
      expect(message).toContain('429');
    }
  });

  it('treats an empty content field as a failure instead of returning ""', async () => {
    behaviour = 'no-content';
    const response = await chat();
    expect(() => readGroqText(response)).toThrow(/no text content/);
  });
});

describe('T-6.02 — FR-06 task analysis on Groq', () => {
  const tasks = [{ id: 't-db-01', title: 'Merancang database sistem informasi akademik', description: 'Rancang skema tabel.' }];

  it('validates a well-formed Groq answer through the unchanged Zod schema', async () => {
    replyContent = JSON.stringify({
      analyses: [
        {
          taskId: 't-db-01',
          requiredSkills: ['desain sistem', 'pemrograman backend'],
          effort: 4,
          note: 'Perancangan skema relasional.',
        },
      ],
    });

    const out = await analyzeTasks(tasks);

    expect(out).toHaveLength(1);
    expect(out[0].requiredSkills).toEqual(['desain sistem', 'pemrograman backend']);
    expect(out[0].effort).toBe(4);
    // One request for all tasks, carrying Groq's JSON mode.
    expect(seen.bodies[0]).toMatchObject({ response_format: { type: 'json_object' } });
    // Groq requires the literal word "JSON" in the prompt for json_object mode.
    const messages = seen.bodies[0].messages as { content: string }[];
    expect(messages.map((m) => m.content).join('\n')).toMatch(/JSON/);
  });

  it('rejects a skill outside the fixed taxonomy even though the wire call succeeded', async () => {
    replyContent = JSON.stringify({
      analyses: [{ taskId: 't-db-01', requiredSkills: ['React Ninja'], effort: 3, note: 'n' }],
    });
    await expect(analyzeTasks(tasks)).rejects.toThrow(/Task analysis failed/);
  });

  it('rejects an invented task id', async () => {
    replyContent = JSON.stringify({
      analyses: [{ taskId: 'ghost', requiredSkills: ['desain sistem'], effort: 3, note: 'n' }],
    });
    await expect(analyzeTasks(tasks)).rejects.toThrow(/unknown taskId/);
  });

  it('rejects an answer whose count does not match the input', async () => {
    replyContent = JSON.stringify({ analyses: [] });
    await expect(analyzeTasks(tasks)).rejects.toThrow(/Result count mismatch/);
  });

  it('turns a non-JSON body into a task analysis failure, not a crash', async () => {
    behaviour = 'not-json';
    await expect(analyzeTasks(tasks)).rejects.toThrow(/Task analysis failed/);
  });

  it('surfaces a provider 429 as a task analysis failure', async () => {
    behaviour = 'rate-limit';
    await expect(analyzeTasks(tasks)).rejects.toThrow(/429/);
  });

  it('fails loudly when GROQ_MODEL_TEXT is not configured', async () => {
    vi.stubEnv('GROQ_MODEL_TEXT', '');
    await expect(analyzeTasks(tasks)).rejects.toThrow(/GROQ_MODEL_TEXT/);
    // No request may be attempted without a model.
    expect(seen.paths).toHaveLength(0);
  });
});

describe('T-6.02 — FR-09 explanations on Groq', () => {
  // T-6.09: the fixture carries a second, small task. R2 caps a task at 1.25 x
  // ideal load, and ideal = total effort / member count, so a single 8h task
  // shared by two members (ideal 4h, ceiling 5h) can never be assigned. The 1h
  // "Rapat" task makes ideal 4.5h and behaves exactly as before for FR-09.
  // T-6.09: the fixture needs more than one task. R2 caps a task at 1.25 x ideal
  // load (ideal = total effort / member count), and a lone 8h task over two
  // members gives a 5h ceiling — unassignable by construction. Two 1h tasks give
  // ideal 1h and a 1.25h ceiling, so FR-09 is exercised on a real assignment.
  const tasks: Task[] = [
    { id: 't1', title: 'Buat UI', difficulty: 3, estimated_hours: 1, required_skills: ['pengujian'] },
    { id: 't2', title: 'Rapat', difficulty: 1, estimated_hours: 1, required_skills: [] },
  ];
  const members: Member[] = [
    { id: 'm1', name: 'Budi', skills: { pengujian: 4 }, interests: { pengujian: 4 }, capacity: 40 },
    { id: 'm2', name: 'Sari', skills: { pengujian: 3 }, interests: { pengujian: 5 }, capacity: 40 },
  ];

  // Embeddings stay on Gemini; stub that edge so only Groq is live here.
  const assigned = () => {
    const cosineMap = { t1: { m1: 0.6, m2: 0.5 }, t2: { m1: 0.6, m2: 0.5 } };
    return globalAssign(tasks, members, [], { cosineMap });
  };

  it('accepts a valid Groq explanation and attaches it to the result', async () => {
    const result = assigned();
    const primary = result.assignments.find((a) => a.taskId === 't1')!.primaryMemberId;
    const name = members.find((m) => m.id === primary)!.name;

    replyContent = JSON.stringify({
      explanations: [{ taskId: 't1', memberId: primary, reason: `${name} cocok untuk tugas ini.` }],
    });

    const out = await explainAssignments({ tasks, members, result, isFallback: false });
    const scores = out.assignments.find((a) => a.taskId === 't1')!.scores;
    expect(scores[primary].reason).toBe(`${name} cocok untuk tugas ini.`);
  });

  it('keeps the template when Groq returns an invalid explanation', async () => {
    const result = assigned();
    const primary = result.assignments.find((a) => a.taskId === 't1')!.primaryMemberId;

    // An invented percentage is exactly what the validator exists to reject.
    replyContent = JSON.stringify({
      explanations: [{ taskId: 't1', memberId: primary, reason: 'Cocok 95% untuk tugas ini.' }],
    });

    const out = await explainAssignments({ tasks, members, result, isFallback: false });
    const scores = out.assignments.find((a) => a.taskId === 't1')!.scores;
    expect(scores[primary].reason).not.toContain('95%');
  });

  it('falls back to the template when Groq answers 429, without throwing', async () => {
    const result = assigned();
    behaviour = 'rate-limit';

    const out = await explainAssignments({ tasks, members, result, isFallback: false });
    const first = out.assignments.find((a) => a.taskId === 't1')!;
    expect(first.scores[first.primaryMemberId].reason).toBeTruthy();
    expect(out.assignments.map((a) => a.taskId).sort()).toEqual(['t1', 't2']);
  });

  it('never calls Groq at all in fallback mode', async () => {
    const result = assigned();
    await explainAssignments({ tasks, members, result, isFallback: true });
    expect(seen.paths).toHaveLength(0);
  });

  it('falls back to the template when Groq is UNCONFIGURED, never throwing', async () => {
    // Regression: `requireGroqText()` must be resolved INSIDE the try. If it is
    // hoisted above it, a missing GROQ_MODEL_TEXT escapes as an exception and the
    // whole recommendation route answers 500 instead of degrading to templates.
    const result = assigned();
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('GROQ_MODEL_TEXT', '');

    const out = await explainAssignments({ tasks, members, result, isFallback: false });

    expect(out.assignments).toHaveLength(2);
    const first = out.assignments.find((a) => a.taskId === 't1')!;
    expect(first.scores[first.primaryMemberId].reason).toBeTruthy();
    // No request may have been attempted without a configuration.
    expect(seen.paths).toHaveLength(0);
  });
});

describe('T-6.02 — the 3-call budget is unchanged by the provider swap', () => {
  const tasks: Task[] = [
    { id: 't1', title: 'Buat UI', difficulty: 3, estimated_hours: 8, required_skills: ['pengujian'] },
  ];
  const members: Member[] = [
    { id: 'm1', name: 'Budi', skills: { pengujian: 4 }, interests: { pengujian: 4 }, capacity: 40 },
  ];

  it('counts the Groq explanation as the third call and refuses a fourth', async () => {
    replyContent = JSON.stringify({ explanations: [] });
    const run = new AiRun('proj');

    const { cosineMap, isEmbeddingFailed } = await computeTaskMemberCosineMap(tasks, members, run);
    const result = globalAssign(tasks, members, [], { isFallback: isEmbeddingFailed, cosineMap });
    await explainAssignments({ tasks, members, result, isFallback: isEmbeddingFailed, run });

    // 1 embedding (Gemini) + 1 explanation (Groq) = 2, leaving room under the cap.
    expect(run.callCount).toBe(2);
    expect(run.remaining).toBe(1);
    await expect(run.track('analysis', 'm', undefined, async () => ({}))).resolves.toBeDefined();
    await expect(run.track('analysis', 'm', undefined, async () => ({}))).rejects.toBeInstanceOf(
      CallBudgetExceededError
    );
  });

  it('spends no budget when the explanation call fails, matching Gemini behaviour', async () => {
    behaviour = 'rate-limit';
    const run = new AiRun('proj');
    const result = globalAssign(tasks, members, [], { cosineMap: { t1: { m1: 0.6 } } });

    await explainAssignments({ tasks, members, result, isFallback: false, run });

    // A failed call still left the machine, so it still counts.
    expect(run.callCount).toBe(1);
  });
});
