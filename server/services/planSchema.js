import { createHash } from 'node:crypto';

// Contract between the Gemini planner and the client plan mapper.
// Everything Gemini returns is validated, grounded and corrected here before it leaves the server.

// Bump whenever prompts or validation change, so cached plans from older prompts are not reused.
export const PROMPT_VERSION = 'plan-v2';

export const TOPIC_TYPES = ['THEORY', 'DEFINITION', 'DERIVATION', 'EXAMPLE', 'PRACTICE', 'REVIEW'];
export const LEVELS = ['new', 'revising'];
export const GOALS = ['exam', 'understand', 'interview'];
export const FEEDBACK = ['too_broad', 'too_easy', 'too_hard', 'more_specific'];
export const MAX_TOPIC_LENGTH = 200;
export const MAX_EXCERPT_CHARS = 6000;
export const MAX_EXCERPTS = 30;
export const OUTLINE_MIN = 6;
export const OUTLINE_MAX = 10;

export const OUTLINE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    outline: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          why: { type: 'string', description: 'One short reason this belongs in the plan' },
        },
        required: ['title'],
      },
    },
  },
  required: ['outline'],
};

export const PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '1-2 sentence overview of the plan' },
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          estimatedMinutes: { type: 'integer', description: 'Minutes, never more than the session length' },
          type: { type: 'string', enum: TOPIC_TYPES },
          complexity: { type: 'integer', description: '1-5' },
          importance: { type: 'integer', description: '1-5' },
          prerequisites: { type: 'array', items: { type: 'integer' }, description: '0-based indexes of EARLIER topics this one depends on' },
          sourceChunkIds: { type: 'array', items: { type: 'string' }, description: 'Material mode only: ids of the sections this topic is based on' },
          nextAction: { type: 'string', description: 'One concrete micro-action: starts with a verb, 5 minutes or less, checkable result' },
        },
        required: ['title', 'estimatedMinutes', 'nextAction'],
      },
    },
  },
  required: ['topics'],
};

const clampInt = (value, min, max, fallback) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const cleanText = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const normalizeTitle = (title) => cleanText(title, 120).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Generic micro-actions that do not name anything concrete. Matched as substrings, case-insensitive.
export const GENERIC_ACTION_PHRASES = [
  'review the chapter', 'read the chapter', 'open your textbook', 'open the textbook', 'study this topic',
  'study the topic', 'study the material', 'review the topic', 'review this topic', 'review your notes',
  'go through the', 'go over the', 'look over', 'read about', 'learn about', 'revise the topic',
  'understand the concept', 'familiarize yourself', 'familiarise yourself', 'get familiar with',
];

export function isGenericAction(text) {
  const value = cleanText(text, 300).toLowerCase();
  if (value.split(' ').filter(Boolean).length < 4) return true;
  return GENERIC_ACTION_PHRASES.some(phrase => value.includes(phrase));
}

// Normalises and size-checks the request body. Returns null when invalid.
export function sanitizePlanRequest(body) {
  if (!body || typeof body !== 'object') return null;
  const mode = body.mode === 'outline' ? 'outline' : 'plan';
  const topic = cleanText(body.topic, MAX_TOPIC_LENGTH);
  const sessionMinutes = clampInt(body.sessionMinutes, 5, 120, 20);
  const examDate = /^\d{4}-\d{2}-\d{2}$/.test(body.examDate || '') ? body.examDate : '';
  const level = LEVELS.includes(body.level) ? body.level : '';
  const goal = GOALS.includes(body.goal) ? body.goal : '';
  const course = cleanText(body.course, 80);
  const feedback = FEEDBACK.includes(body.feedback) ? body.feedback : '';

  let outline = [];
  if (Array.isArray(body.outline)) {
    if (body.outline.length > 14) return null;
    outline = body.outline.map(item => cleanText(typeof item === 'string' ? item : item?.title, 120)).filter(Boolean);
  }

  // Titles of the plan being re-run with feedback (context only, not enforced like an outline).
  const previous = Array.isArray(body.previous) ? body.previous.slice(0, MAX_EXCERPTS).map(item => cleanText(item, 120)).filter(Boolean) : [];

  let excerpts = [];
  if (Array.isArray(body.excerpts)) {
    if (body.excerpts.length > MAX_EXCERPTS) return null;
    excerpts = body.excerpts.map(item => ({
      id: cleanText(item?.id, 40),
      title: cleanText(item?.title, 120),
      excerpt: cleanText(item?.excerpt, MAX_EXCERPT_CHARS),
      localMinutes: clampInt(item?.localMinutes, 1, 240, 0) || undefined,
    })).filter(item => item.id && item.title);
    const total = excerpts.reduce((sum, item) => sum + item.title.length + item.excerpt.length, 0);
    if (total > MAX_EXCERPT_CHARS + 500) return null;
  }

  if (mode === 'outline' && !topic) return null;
  if (!topic && excerpts.length === 0) return null;
  return { mode, topic, sessionMinutes, examDate, level, goal, course, feedback, outline, previous, excerpts };
}

export function planCacheKey(input, version = PROMPT_VERSION) {
  const parts = [version, input.mode, input.topic.toLowerCase(), input.sessionMinutes, input.examDate,
    input.level, input.goal, input.course.toLowerCase(), input.feedback, input.outline, input.previous, input.excerpts];
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export function normalizeOutline(raw) {
  if (!raw || !Array.isArray(raw.outline)) return null;
  const seen = new Set();
  const outline = [];
  for (const item of raw.outline) {
    const title = cleanText(typeof item === 'string' ? item : item?.title, 120);
    const key = normalizeTitle(title);
    if (!title || seen.has(key)) continue;
    seen.add(key);
    outline.push({ title, why: cleanText(item?.why, 160) });
  }
  return outline.slice(0, OUTLINE_MAX);
}

export function checkOutline(outline) {
  if (!outline) return ['Output was not valid outline JSON.'];
  if (outline.length < OUTLINE_MIN) return [`Return between ${OUTLINE_MIN} and ${OUTLINE_MAX} distinct outline items (got ${outline.length}).`];
  return [];
}

// Cleans topics. In material mode (`ids` given) only known chunk ids are kept and topics
// with no valid id are dropped (ungrounded); the client keeps local topics for those chunks.
export function validatePlan(raw, { ids } = {}) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.topics)) return null;
  const known = ids ? new Set(ids) : null;
  const topics = [];
  let ungrounded = 0;
  for (const item of raw.topics.slice(0, MAX_EXCERPTS)) {
    if (!item || typeof item !== 'object') continue;
    const title = cleanText(item.title, 120);
    const nextAction = cleanText(item.nextAction, 200);
    if (!title || !nextAction) continue;
    let sourceChunkIds;
    if (known) {
      sourceChunkIds = [...new Set((Array.isArray(item.sourceChunkIds) ? item.sourceChunkIds : []).map(id => cleanText(id, 40)).filter(id => known.has(id)))];
      if (sourceChunkIds.length === 0) { ungrounded += 1; continue; }
    }
    topics.push({
      title,
      description: cleanText(item.description, 300),
      estimatedMinutes: clampInt(item.estimatedMinutes, 1, 240, 15),
      type: TOPIC_TYPES.includes(item.type) ? item.type : 'THEORY',
      complexity: clampInt(item.complexity, 1, 5, 3),
      importance: clampInt(item.importance, 1, 5, 3),
      prerequisites: (Array.isArray(item.prerequisites) ? item.prerequisites : []).map(Number).filter(Number.isInteger),
      ...(known ? { sourceChunkIds } : {}),
      nextAction,
    });
  }
  if (topics.length === 0) return null;
  return { summary: cleanText(raw.summary, 400), topics, ungrounded };
}

// Problems that trigger the single repair retry. `fatal` problems also cause the final fallback;
// material coverage gaps are not fatal because the client fills them from the local plan.
export function checkPlan(plan, { ids, outline = [] } = {}) {
  if (!plan) return [{ fatal: true, message: 'Output was not valid plan JSON or had no usable topics.' }];
  const problems = [];
  const seen = new Map();
  plan.topics.forEach((topic, index) => {
    const key = normalizeTitle(topic.title);
    if (seen.has(key)) problems.push({ fatal: true, message: `Topics ${seen.get(key) + 1} and ${index + 1} are duplicates ("${topic.title}"). Merge or rename them.` });
    else seen.set(key, index);
    if (isGenericAction(topic.nextAction)) problems.push({ fatal: true, message: `Topic ${index + 1} ("${topic.title}") has a generic micro-action: "${topic.nextAction}". Name something concrete with a checkable result.` });
    const late = topic.prerequisites.filter(p => p >= index);
    if (late.length) problems.push({ fatal: true, message: `Topic ${index + 1} ("${topic.title}") depends on later topics (${late.map(p => p + 1).join(', ')}). Put prerequisites first.` });
  });
  if (ids?.length) {
    const covered = new Set(plan.topics.flatMap(topic => topic.sourceChunkIds || []));
    const missing = ids.filter(id => !covered.has(id));
    if (missing.length) problems.push({ fatal: false, message: `These sections are not covered by any topic: ${missing.join(', ')}.` });
    if (plan.ungrounded) problems.push({ fatal: false, message: `${plan.ungrounded} topic(s) had no valid sourceChunkIds and were dropped.` });
  }
  if (outline.length) {
    const titles = plan.topics.map(topic => normalizeTitle(topic.title));
    const missing = outline.filter(item => {
      const key = normalizeTitle(item);
      return !titles.some(title => title.includes(key) || key.includes(title));
    });
    if (missing.length) problems.push({ fatal: true, message: `These confirmed outline items are missing (keep their titles): ${missing.join('; ')}.` });
  }
  return problems;
}

// Never trust model arithmetic: clamp minutes around the local estimate and to the session length.
export function correctMinutes(plan, { sessionMinutes, excerpts = [] }) {
  const localById = new Map(excerpts.map(item => [item.id, item.localMinutes || 0]));
  const topics = plan.topics.map(topic => {
    const local = (topic.sourceChunkIds || []).reduce((sum, id) => sum + (localById.get(id) || 0), 0);
    const low = local ? Math.max(3, Math.round(local * 0.5)) : 5;
    const high = Math.min(sessionMinutes, local ? Math.max(low, Math.round(local * 1.5)) : sessionMinutes);
    return { ...topic, estimatedMinutes: Math.min(high, Math.max(Math.min(low, high), topic.estimatedMinutes)) };
  });
  return { ...plan, topics };
}
