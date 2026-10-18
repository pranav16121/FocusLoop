import { GoogleGenAI } from '@google/genai';
import { PLAN_JSON_SCHEMA, validatePlan } from './planSchema.js';

// Server-only Gemini planner. The API key is read from env and never sent to the browser.
export const TIMEOUT_MS = 15000;
export const MAX_OUTPUT_TOKENS = 2048;

export class PlanError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const SYSTEM_INSTRUCTION = `You are a study planner inside FocusLoop, a calm focus app.
Plans are small, concrete and realistic. Never invent facts about the learner's material.
Each nextAction is ONE physical micro-action that takes under 2 minutes to start, begins with a verb, and is under 20 words.
Respond only with JSON matching the provided schema.`;

export function buildPrompt({ topic, sessionMinutes, examDate, excerpts = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const exam = examDate ? `Exam date: ${examDate} (today is ${today}). Prioritise high-yield topics.` : '';
  if (excerpts.length > 0) {
    const sections = excerpts.map(item => `[${item.id}] ${item.title}\n${item.excerpt}`).join('\n\n');
    return `The learner's material was split into the sections below${topic ? ` for the goal "${topic}"` : ''}.
For EVERY section return one topic with the SAME id, a clearer title, a realistic estimatedMinutes, and one concrete nextAction.
Do not add, merge or drop ids. Focus sessions are ${sessionMinutes} minutes long. ${exam}

${sections}`;
  }
  return `Build a study plan for: "${topic}".
Return 3-8 topics in a sensible learning order. Focus sessions are ${sessionMinutes} minutes long, so keep each topic between 5 and ${Math.max(10, sessionMinutes)} minutes. ${exam}`;
}

function parseJson(text) {
  try {
    return JSON.parse(String(text || '').replace(/^```(?:json)?\s*|```\s*$/g, '').trim());
  } catch {
    return null;
  }
}

async function callOnce(ai, model, prompt, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new PlanError('timeout', 'Gemini did not answer in time'));
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseJsonSchema: PLAN_JSON_SCHEMA,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          abortSignal: controller.signal,
        },
      }),
      timeout,
    ]);
    return response?.text;
  } catch (error) {
    if (error instanceof PlanError) throw error;
    if (error?.status === 429) throw new PlanError('rate_limited', 'Gemini quota reached');
    if (error?.name === 'AbortError') throw new PlanError('timeout', 'Gemini did not answer in time');
    throw new PlanError('upstream', `Gemini request failed${error?.status ? ` (${error.status})` : ''}`);
  } finally {
    clearTimeout(timer);
  }
}

// One call, plus exactly one retry if the output is not valid plan JSON.
// Rate limits, timeouts and upstream errors are never retried.
export async function generatePlan(request, { client, model, timeoutMs = TIMEOUT_MS } = {}) {
  const modelName = model || process.env.GEMINI_MODEL;
  if (!client && !process.env.GEMINI_API_KEY) throw new PlanError('no_key', 'GEMINI_API_KEY is not set');
  if (!modelName) throw new PlanError('no_model', 'GEMINI_MODEL is not set');
  const ai = client || new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = buildPrompt(request);
  const ids = request.excerpts?.length ? request.excerpts.map(item => item.id) : undefined;
  const deadline = Date.now() + timeoutMs;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining < 500) throw new PlanError('timeout', 'Gemini did not answer in time');
    const plan = validatePlan(parseJson(await callOnce(ai, modelName, prompt, remaining)), { ids });
    if (plan) return plan;
  }
  throw new PlanError('bad_output', 'Gemini returned an invalid plan');
}
