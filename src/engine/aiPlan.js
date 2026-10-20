import { packSessions } from './packer.js';

// Bridges the local planner and the server-side Gemini planner.
// Output always uses the same plan shape as buildStudyPlan, so editing, drag/drop,
// and revision reminders work the same for AI and offline plans.

export const AI_EXCERPT_BUDGET = 6000;
const MAX_AI_TOPICS = 30;
const TYPES = ['THEORY', 'DEFINITION', 'DERIVATION', 'EXAMPLE', 'PRACTICE', 'REVIEW'];

export const FEEDBACK_OPTIONS = [
  { id: 'too_broad', label: 'Too broad' },
  { id: 'too_easy', label: 'Too easy' },
  { id: 'too_hard', label: 'Too hard' },
  { id: 'more_specific', label: 'More specific actions' },
];

const clamp = (value, min, max, fallback) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

// Builds the request body. With material, only titles and short excerpts are sent (≈6,000 chars total).
export function buildAiPlanRequest({ topic = '', sessionMinutes = 20, examDate = '', level = '', goal = '', course = '', localPlan = null, mode = 'plan', outline = [], feedback = '', previous = [] }) {
  const request = { mode, topic: topic.trim().slice(0, 200), sessionMinutes, examDate: examDate || '', level, goal, course: course.trim().slice(0, 80) };
  if (outline.length) request.outline = outline.slice(0, 14);
  if (feedback) request.feedback = feedback;
  if (previous.length) request.previous = previous.slice(0, MAX_AI_TOPICS);
  const topics = localPlan?.topics?.slice(0, MAX_AI_TOPICS) || [];
  if (topics.length === 0) return request;

  const titleChars = topics.reduce((sum, item) => sum + Math.min(item.title.length, 120), 0);
  const perTopic = Math.max(0, Math.min(600, Math.floor((AI_EXCERPT_BUDGET - titleChars) / topics.length)));
  request.excerpts = topics.map(item => ({
    id: item.id,
    title: item.title.slice(0, 120),
    excerpt: String(item.text || '').replace(/\s+/g, ' ').trim().slice(0, perTopic),
    localMinutes: item.estimatedMinutes,
  }));
  return request;
}

function finishPlan(topics, { sessionMinutes, localPlan, summary }) {
  const fitted = topics.map(topic => ({ ...topic, estimatedMinutes: Math.min(sessionMinutes, topic.estimatedMinutes) }));
  return {
    sourceWordCount: localPlan?.sourceWordCount || 0,
    topics: fitted,
    sessions: packSessions(fitted, sessionMinutes),
    sessionMinutes,
    summary: summary || localPlan?.summary || '',
    generatedBy: 'gemini',
  };
}

function aiTopic(item, index, extra = {}) {
  return {
    id: `ai-topic-${index + 1}`,
    title: String(item.title).slice(0, 120),
    text: item.description || '',
    description: item.description || '',
    type: TYPES.includes(item.type) ? item.type : 'THEORY',
    depth: 1,
    estimatedMinutes: clamp(item.estimatedMinutes, 3, 120, 15),
    complexity: clamp(item.complexity, 1, 5, 3),
    importance: clamp(item.importance, 1, 5, 3),
    confidence: 0.7,
    status: 'UNSEEN',
    nextAction: String(item.nextAction).slice(0, 200),
    ...extra,
  };
}

// Maps a validated server response into the plan structure. Returns null if nothing usable came back.
export function planFromAi(aiPlan, { sessionMinutes = 20, localPlan = null } = {}) {
  if (!aiPlan || !Array.isArray(aiPlan.topics) || aiPlan.topics.length === 0) return null;
  const usable = aiPlan.topics.filter(item => item?.title && item?.nextAction).slice(0, MAX_AI_TOPICS);

  if (localPlan?.topics?.length) {
    // Material mode: an AI topic is kept only if it cites real chunk ids. Chunks no AI topic
    // covers keep their local topic. Topics follow the material's own order.
    const localById = new Map(localPlan.topics.map(topic => [topic.id, topic]));
    const owner = new Map();
    usable.forEach((item, index) => {
      (item.sourceChunkIds || []).filter(id => localById.has(id) && !owner.has(id)).forEach(id => owner.set(id, index));
    });
    if (owner.size === 0) return null;
    const emitted = new Set();
    const topics = [];
    localPlan.topics.forEach(local => {
      if (!owner.has(local.id)) { topics.push(local); return; }
      const index = owner.get(local.id);
      if (emitted.has(index)) return;
      emitted.add(index);
      const chunkIds = [...owner.entries()].filter(([, owned]) => owned === index).map(([id]) => id);
      const chunks = chunkIds.map(id => localById.get(id));
      topics.push(aiTopic(usable[index], topics.length, {
        id: chunkIds.length === 1 ? chunkIds[0] : `ai-topic-${index + 1}`,
        text: chunks.map(chunk => chunk.text).join('\n\n'),
        type: TYPES.includes(usable[index].type) ? usable[index].type : chunks[0].type,
        sourceChunkIds: chunkIds,
      }));
    });
    return finishPlan(topics, { sessionMinutes, localPlan, summary: aiPlan.summary });
  }

  const topics = usable.map((item, index) => aiTopic(item, index));
  return topics.length ? finishPlan(topics, { sessionMinutes, summary: aiPlan.summary }) : null;
}

// Same shape as topicToStep, but keeps the AI micro-action and description.
export function aiTopicToStep(topic) {
  return {
    title: topic.title,
    description: topic.description || `${topic.type.toLowerCase()} · Estimated complexity ${topic.complexity}/5`,
    estimatedMinutes: topic.estimatedMinutes,
    topicId: topic.id,
    type: topic.type,
    importance: topic.importance,
    nextAction: topic.nextAction,
    completed: false,
  };
}

// Short "what changed" note after a feedback re-run.
export function describePlanChange(before, after, feedback) {
  const label = FEEDBACK_OPTIONS.find(option => option.id === feedback)?.label || 'Updated';
  const avg = plan => {
    const topics = plan?.topics || [];
    return topics.length ? Math.round(topics.reduce((sum, topic) => sum + topic.estimatedMinutes, 0) / topics.length) : 0;
  };
  const beforeTitles = new Set((before?.topics || []).map(topic => topic.title));
  const renamed = (after?.topics || []).filter(topic => !beforeTitles.has(topic.title)).length;
  return `${label}: ${before?.topics?.length || 0} → ${after?.topics?.length || 0} topics, about ${avg(before)} → ${avg(after)} min each, ${renamed} new or reworded.`;
}
