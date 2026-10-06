// Compatibility facade for the extracted deterministic study engine.
export {
  MAX_SOURCE_LENGTH,
  buildStudyPlan,
  classifyChunk,
  createTopics,
  estimateComplexity,
  estimateMinutes,
  extractSections,
  getLocalNextAction,
  normalizeText,
  packSessions,
  scoreImportance,
  topicToStep,
} from '../engine/index.js';
