import { GoogleGenAI } from '@google/genai';
import { packSessions } from '../../src/engine/packer.js';
import {
  OUTLINE_JSON_SCHEMA, PLAN_JSON_SCHEMA, OUTLINE_MIN, OUTLINE_MAX,
  validatePlan, checkPlan, correctMinutes, normalizeOutline, checkOutline,
} from './planSchema.js';

// Server-only Gemini planner. The API key is read from env and never sent to the browser.
export const TIMEOUT_MS = 15000;
export const MAX_OUTPUT_TOKENS = 2048;

export class PlanError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

export const SYSTEM_INSTRUCTION = `You are the study planner inside FocusLoop, a calm focus app for students.

Rules:
- Plan only what fits the learner's level, goal and course or board. Skip content outside that scope.
- Order topics so prerequisites come first. "prerequisites" lists 0-based indexes of EARLIER topics only.
- Each topic must be small enough to finish in one focus session.
- Every nextAction is ONE micro-action that starts with a verb, takes 5 minutes or less, names something concrete from that topic (a formula, term, diagram, example or question), and has a checkable result.
- Never use generic actions such as "review the chapter", "open your textbook", "study this topic", "read about", "go through the notes".
- When material is supplied, use only that material. Never invent formulas, facts or examples that are not in it. Every topic lists the sourceChunkIds it is based on.
- Respond only with JSON matching the provided schema.

Examples of good topics:
1. Engineering / maths - "Kirchhoff's Current Law at a single node" (12 min, prerequisites [0])
   nextAction: "Write KCL for node B of a 3-branch circuit and check the currents sum to zero."
2. Theory-heavy - "Causes of the French Revolution: fiscal crisis" (15 min)
   nextAction: "List three fiscal causes from your notes and rank them by impact in one line each."
3. Aptitude - "Time and work: combined rate problems" (10 min)
   nextAction: "Solve: A finishes in 6 days, B in 3 - how long together? Check against the answer 2 days."

Bad (never do this): "Review the chapter on circuits", "Open your textbook to KCL", "Study this topic carefully".`;

const GOAL_TEXT = { exam: 'pass an exam', understand: 'understand the subject deeply', interview: 'prepare for job interviews' };
const LEVEL_TEXT = { new: 'learning this for the first time', revising: 'revising material they have seen before' };
const FEEDBACK_TEXT = {
  too_broad: 'The learner said the previous plan was TOO BROAD. Split topics into narrower, more specific ones.',
  too_easy: 'The learner said the previous plan was TOO EASY. Raise the difficulty: fewer basics, more application and harder practice.',
  too_hard: 'The learner said the previous plan was TOO HARD. Add gentler steps and foundations before harder topics.',
  more_specific: 'The learner wants MORE SPECIFIC micro-actions. Name exact formulas, terms, questions or diagrams in every nextAction.',
};

function contextLines({ level, goal, course, examDate, sessionMinutes }) {
  const today = new Date().toISOString().slice(0, 10);
  return [
    level && `Learner level: ${LEVEL_TEXT[level]}.`,
    goal && `Goal: ${GOAL_TEXT[goal]}.`,
    course && `Course or board: ${course}.`,
    examDate && `Exam date: ${examDate} (today is ${today}). Prioritise high-yield topics.`,
    `Focus sessions are ${sessionMinutes} minutes; no topic may exceed ${sessionMinutes} minutes.`,
  ].filter(Boolean).join('\n');
}

export function buildOutlinePrompt(request) {
  return `Draft an outline for studying: "${request.topic}".
Return ${OUTLINE_MIN}-${OUTLINE_MAX} distinct items in learning order (prerequisites first), each a short topic title.
${contextLines(request)}`;
}

export function buildPlanPrompt(request) {
  const parts = [];
  if (request.excerpts.length > 0) {
    const sections = request.excerpts.map(item => `[${item.id}] ${item.title}\n${item.excerpt}`).join('\n\n');
    parts.push(`The learner's material is split into the sections below${request.topic ? ` for the goal "${request.topic}"` : ''}.
Build study topics from it. Every topic MUST list the sourceChunkIds it is based on, and every section id should be covered by some topic.
You may group small related sections into one topic. Use only facts that appear in the sections.

${sections}`);
  } else if (request.outline.length > 0) {
    parts.push(`Build study sessions for "${request.topic}" from this confirmed outline, in this order. Keep each outline title; you may split an item into smaller topics if it would not fit one session.
${request.outline.map((item, index) => `${index + 1}. ${item}`).join('\n')}`);
  } else {
    parts.push(`Build a study plan for: "${request.topic}". Return 3-10 topics in learning order.`);
  }
  parts.push(contextLines(request));
  if (request.previous?.length) parts.push(`The learner's previous plan had these topics:\n${request.previous.map((item, index) => `${index + 1}. ${item}`).join('\n')}`);
  if (request.feedback) parts.push(FEEDBACK_TEXT[request.feedback]);
  return parts.join('\n\n');
}

function parseJson(text) {
  try {
    return JSON.parse(String(text || '').replace(/^```(?:json)?\s*|```\s*$/g, '').trim());
  } catch {
    return null;
  }
}

async function callOnce(ai, model, prompt, schema, timeoutMs) {
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
          responseJsonSchema: schema,
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

function setup({ client, model }) {
  const modelName = model || process.env.GEMINI_MODEL;
  if (!client && !process.env.GEMINI_API_KEY) throw new PlanError('no_key', 'GEMINI_API_KEY is not set');
  if (!modelName) throw new PlanError('no_model', 'GEMINI_MODEL is not set');
  return { ai: client || new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }), modelName };
}

// One call plus exactly ONE repair retry that lists the specific failures.
// Rate limits, timeouts and upstream errors are never retried.
async function runWithRepair({ ai, modelName, prompt, schema, timeoutMs, evaluate }) {
  const deadline = Date.now() + timeoutMs;
  let currentPrompt = prompt;
  let last = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining < 500) throw new PlanError('timeout', 'Gemini did not answer in time');
    const result = evaluate(parseJson(await callOnce(ai, modelName, currentPrompt, schema, remaining)));
    if (result.problems.length === 0) return result.value;
    last = result;
    currentPrompt = `${prompt}\n\nYour previous answer had these problems. Fix all of them:\n${result.problems.map(p => `- ${p.message ?? p}`).join('\n')}`;
  }
  if (last?.value && last.problems.every(p => p.fatal === false)) return last.value;
  throw new PlanError('bad_output', 'Gemini returned an invalid plan');
}

export async function generateOutline(request, { client, model, timeoutMs = TIMEOUT_MS } = {}) {
  const { ai, modelName } = setup({ client, model });
  return runWithRepair({
    ai, modelName, timeoutMs,
    prompt: buildOutlinePrompt(request),
    schema: OUTLINE_JSON_SCHEMA,
    evaluate: raw => {
      const outline = normalizeOutline(raw);
      return { value: outline ? { outline } : null, problems: checkOutline(outline).map(message => ({ fatal: true, message })) };
    },
  });
}

export async function generatePlan(request, { client, model, timeoutMs = TIMEOUT_MS } = {}) {
  const { ai, modelName } = setup({ client, model });
  const excerpts = request.excerpts || [];
  const ids = excerpts.length ? excerpts.map(item => item.id) : undefined;
  const outline = request.outline || [];
  return runWithRepair({
    ai, modelName, timeoutMs,
    prompt: buildPlanPrompt({ excerpts, outline, previous: [], feedback: '', level: '', goal: '', course: '', examDate: '', sessionMinutes: 20, ...request }),
    schema: PLAN_JSON_SCHEMA,
    evaluate: raw => {
      const validated = validatePlan(raw, { ids });
      const problems = checkPlan(validated, { ids, outline });
      if (!validated) return { value: null, problems };
      const corrected = correctMinutes(validated, { sessionMinutes: request.sessionMinutes || 20, excerpts });
      const withIds = corrected.topics.map((topic, index) => ({ ...topic, id: `ai-topic-${index + 1}` }));
      return { value: { ...corrected, topics: withIds, sessions: packSessions(withIds, request.sessionMinutes || 20) }, problems };
    },
  });
}
