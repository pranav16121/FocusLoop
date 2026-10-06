import { getActionTemplate, getLocalNextAction } from './actions.js';
import { createTopics, extractSections, normalizeText } from './chunker.js';
import { classifyChunk } from './classify.js';
import { estimateMinutes } from './estimate.js';
import { estimateComplexity, scoreImportance } from './score.js';
import { packSessions } from './packer.js';

const MAX_SOURCE_LENGTH = 100000;

export function buildStudyPlan(sourceText, options = {}) {
  const normalized = normalizeText(sourceText);
  if (!normalized) return { topics: [], sessions: [], sourceWordCount: 0 };

  const sessionMinutes = Math.min(120, Math.max(5, Number(options.sessionMinutes) || 20));
  const topics = createTopics(normalized, options);
  return {
    sourceWordCount: normalized.trim().split(/\s+/).length,
    topics,
    sessions: packSessions(topics, sessionMinutes),
    sessionMinutes,
  };
}

export function topicToStep(topic) {
  return {
    title: topic.title,
    description: `${topic.type.toLowerCase()} · Estimated complexity ${topic.complexity}/5`,
    estimatedMinutes: topic.estimatedMinutes,
    topicId: topic.id,
    type: topic.type,
    importance: topic.importance,
    nextAction: getActionTemplate(topic.type),
    completed: false,
  };
}

export {
  MAX_SOURCE_LENGTH,
  classifyChunk,
  createTopics,
  estimateComplexity,
  estimateMinutes,
  extractSections,
  getLocalNextAction,
  normalizeText,
  packSessions,
  scoreImportance,
};
