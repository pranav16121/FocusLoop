// Shared contract between the Gemini planner and the client plan mapper.
// Everything Gemini returns is validated and clamped here before it leaves the server.

export const TOPIC_TYPES = ['THEORY', 'DEFINITION', 'DERIVATION', 'EXAMPLE', 'PRACTICE', 'REVIEW'];
export const MAX_TOPIC_LENGTH = 200;
export const MAX_EXCERPT_CHARS = 6000;
export const MAX_EXCERPTS = 30;

export const PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '1-2 sentence overview of the plan' },
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Echo the section id when one was provided' },
          title: { type: 'string' },
          description: { type: 'string' },
          estimatedMinutes: { type: 'integer', description: 'Minutes, 3-90' },
          type: { type: 'string', enum: TOPIC_TYPES },
          complexity: { type: 'integer', description: '1-5' },
          importance: { type: 'integer', description: '1-5' },
          nextAction: { type: 'string', description: 'One concrete micro-action that starts with a verb' },
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

// Returns a cleaned plan or null when the output is unusable.
// When `ids` is given (material mode) only topics that echo a known id are kept.
export function validatePlan(raw, { ids } = {}) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.topics)) return null;
  const known = ids ? new Set(ids) : null;
  const seen = new Set();
  const topics = [];
  for (const item of raw.topics.slice(0, MAX_EXCERPTS)) {
    if (!item || typeof item !== 'object') continue;
    const title = cleanText(item.title, 120);
    const nextAction = cleanText(item.nextAction, 200);
    if (!title || !nextAction) continue;
    const id = cleanText(item.id, 40);
    if (known && (!known.has(id) || seen.has(id))) continue;
    seen.add(id);
    topics.push({
      ...(known ? { id } : {}),
      title,
      description: cleanText(item.description, 300),
      estimatedMinutes: clampInt(item.estimatedMinutes, 3, 90, 15),
      type: TOPIC_TYPES.includes(item.type) ? item.type : 'THEORY',
      complexity: clampInt(item.complexity, 1, 5, 3),
      importance: clampInt(item.importance, 1, 5, 3),
      nextAction,
    });
  }
  if (topics.length === 0) return null;
  return { summary: cleanText(raw.summary, 400), topics };
}

// Normalises and size-checks the request body. Returns null when invalid.
export function sanitizePlanRequest(body) {
  if (!body || typeof body !== 'object') return null;
  const topic = cleanText(body.topic, MAX_TOPIC_LENGTH);
  const sessionMinutes = clampInt(body.sessionMinutes, 5, 120, 20);
  const examDate = /^\d{4}-\d{2}-\d{2}$/.test(body.examDate || '') ? body.examDate : '';
  let excerpts = [];
  if (Array.isArray(body.excerpts)) {
    if (body.excerpts.length > MAX_EXCERPTS) return null;
    excerpts = body.excerpts.map(item => ({
      id: cleanText(item?.id, 40),
      title: cleanText(item?.title, 120),
      excerpt: cleanText(item?.excerpt, MAX_EXCERPT_CHARS),
    })).filter(item => item.id && item.title);
    const total = excerpts.reduce((sum, item) => sum + item.title.length + item.excerpt.length, 0);
    if (total > MAX_EXCERPT_CHARS + 500) return null;
  }
  if (!topic && excerpts.length === 0) return null;
  return { topic, sessionMinutes, examDate, excerpts };
}
