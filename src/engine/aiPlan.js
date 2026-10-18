import { packSessions } from './packer.js';

// Bridges the local planner and the server-side Gemini planner.
// Output always uses the same plan shape as buildStudyPlan, so editing, drag/drop,
// recall and revision work the same for AI and offline plans.

export const AI_EXCERPT_BUDGET = 6000;
const MAX_AI_TOPICS = 30;
const TYPES = ['THEORY', 'DEFINITION', 'DERIVATION', 'EXAMPLE', 'PRACTICE', 'REVIEW'];

const clamp = (value, min, max, fallback) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

// Builds the request body. With material, only titles and short excerpts are sent (≈6,000 chars total).
export function buildAiPlanRequest({ topic = '', sessionMinutes = 20, examDate = '', localPlan = null }) {
  const request = { topic: topic.trim().slice(0, 200), sessionMinutes, examDate: examDate || '' };
  const topics = localPlan?.topics?.slice(0, MAX_AI_TOPICS) || [];
  if (topics.length === 0) return request;

  const titleChars = topics.reduce((sum, item) => sum + Math.min(item.title.length, 120), 0);
  const perTopic = Math.max(0, Math.min(600, Math.floor((AI_EXCERPT_BUDGET - titleChars) / topics.length)));
  request.excerpts = topics.map(item => ({
    id: item.id,
    title: item.title.slice(0, 120),
    excerpt: String(item.text || '').replace(/\s+/g, ' ').trim().slice(0, perTopic),
  }));
  return request;
}

function finishPlan(topics, { sessionMinutes, localPlan, summary }) {
  return {
    sourceWordCount: localPlan?.sourceWordCount || 0,
    topics,
    sessions: packSessions(topics, sessionMinutes),
    sessionMinutes,
    summary: summary || localPlan?.summary || '',
    generatedBy: 'gemini',
  };
}

// Maps a validated server response into the plan structure. Returns null if nothing usable came back.
export function planFromAi(aiPlan, { sessionMinutes = 20, localPlan = null } = {}) {
  if (!aiPlan || !Array.isArray(aiPlan.topics) || aiPlan.topics.length === 0) return null;

  if (localPlan?.topics?.length) {
    // Material mode: keep local chunks (text, scoring, ids) and only improve title/minutes/action.
    const byId = new Map(aiPlan.topics.filter(item => item?.id).map(item => [item.id, item]));
    if (byId.size === 0) return null;
    const topics = localPlan.topics.map(local => {
      const ai = byId.get(local.id);
      if (!ai) return local;
      return {
        ...local,
        title: String(ai.title || local.title).slice(0, 120),
        estimatedMinutes: clamp(ai.estimatedMinutes, 3, 90, local.estimatedMinutes),
        nextAction: String(ai.nextAction || '').slice(0, 200) || local.nextAction,
        description: ai.description || local.description,
      };
    });
    return finishPlan(topics, { sessionMinutes, localPlan, summary: aiPlan.summary });
  }

  // Topic-only mode: Gemini supplies the whole plan.
  const topics = aiPlan.topics
    .filter(item => item?.title && item?.nextAction)
    .slice(0, MAX_AI_TOPICS)
    .map((item, index) => ({
      id: `topic-${index + 1}`,
      title: String(item.title).slice(0, 120),
      text: item.description || '',
      description: item.description || '',
      type: TYPES.includes(item.type) ? item.type : 'THEORY',
      depth: 1,
      estimatedMinutes: clamp(item.estimatedMinutes, 3, 90, 15),
      complexity: clamp(item.complexity, 1, 5, 3),
      importance: clamp(item.importance, 1, 5, 3),
      confidence: 0.7,
      status: 'UNSEEN',
      nextAction: String(item.nextAction).slice(0, 200),
    }));
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
