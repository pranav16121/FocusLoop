const MAX_SOURCE_LENGTH = 100000;
const MIN_SECTION_WORDS = 12;

const TYPE_RULES = [
  { type: 'DEFINITION', pattern: /\b(is defined as|defined as|means|refers to|is known as)\b/i },
  { type: 'DERIVATION', pattern: /\b(derive|derivation|proof|prove|therefore)\b/i },
  { type: 'EXAMPLE', pattern: /\b(example|illustration|worked example)\b/i },
  { type: 'PROBLEM', pattern: /\b(solve|calculate|find|determine|exercise|problem)\b/i },
  { type: 'FORMULA', pattern: /(?:=|\+|-|\/|\^|\u2211|\u222b).*(?:=|[A-Za-z])|\b(formula|equation)\b/i },
];

const ACTIONS = {
  DEFINITION: 'Read it, close the notes, and explain it in your own words.',
  DERIVATION: 'Hide the derivation and reproduce the steps from memory.',
  EXAMPLE: 'Attempt the example before looking at the solution.',
  PROBLEM: 'Attempt the first step before checking the solution.',
  FORMULA: 'Write the formula from memory and explain each variable.',
  THEORY: 'Close the notes and write down three key ideas.',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isHeading(line) {
  const value = line.trim();
  if (!value || value.length > 120) return false;
  return /^(#{1,6})\s+/.test(value)
    || /^(chapter|unit|module|section|lesson|part)\s+[\w.-]+/i.test(value)
    || /^\d+(?:\.\d+)*[.)]?\s+\S+/.test(value)
    || (value.length <= 80 && value === value.toUpperCase() && /[A-Z]/.test(value));
}

function cleanHeading(line) {
  return line.trim().replace(/^#{1,6}\s+/, '').replace(/^\d+(?:\.\d+)*[.)]?\s+/, '').trim();
}

function headingDepth(line) {
  const value = line.trim();
  const markdown = value.match(/^(#+)\s+/);
  if (markdown) return markdown[1].length;
  const numbered = value.match(/^(\d+(?:\.\d+)*)/);
  if (numbered) return numbered[1].split('.').length;
  return 1;
}

function classifyChunk(title, text) {
  const combined = `${title} ${text}`;
  const match = TYPE_RULES.find(rule => rule.pattern.test(combined));
  return match?.type || 'THEORY';
}

function estimateComplexity(text, type, depth) {
  const words = wordCount(text);
  const sentences = Math.max(1, (text.match(/[.!?]+/g) || []).length);
  const longWords = (text.match(/\b[A-Za-z]{10,}\b/g) || []).length;
  const symbols = (text.match(/[=+\-*/^\u2211\u222b]/g) || []).length;
  const typeWeight = type === 'DERIVATION' || type === 'PROBLEM' ? 1 : type === 'FORMULA' ? 0.5 : 0;
  const score = 1 + (words / 180) + (longWords / 35) + (symbols / 15) + (sentences > 0 ? words / sentences / 35 : 0) + typeWeight + Math.max(0, depth - 1) * 0.25;
  return clamp(Math.round(score), 1, 5);
}

function estimateMinutes(text, complexity) {
  return clamp(Math.round(wordCount(text) / 55 + complexity * 2), 5, 45);
}

function extractSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = null;
  let looseParagraphs = [];

  const flushLoose = () => {
    const body = looseParagraphs.join(' ').trim();
    if (body && wordCount(body) >= MIN_SECTION_WORDS) {
      sections.push({ title: `Section ${sections.length + 1}`, text: body, depth: 1 });
    }
    looseParagraphs = [];
  };

  const flushCurrent = () => {
    if (!current) return;
    const body = current.text.join(' ').replace(/\s+/g, ' ').trim();
    if (body) sections.push({ ...current, text: body });
    current = null;
  };

  lines.forEach(line => {
    const value = line.trim();
    if (isHeading(value)) {
      flushCurrent();
      flushLoose();
      current = { title: cleanHeading(value), text: [], depth: headingDepth(value) };
      return;
    }

    if (!value) {
      if (current) flushCurrent();
      return;
    }

    if (current) current.text.push(value);
    else looseParagraphs.push(value);
  });

  flushCurrent();
  flushLoose();

  if (sections.length === 0 && text.trim()) {
    sections.push({ title: 'Imported material', text: text.trim(), depth: 1 });
  }

  return sections;
}

function scoreImportance(section, allText) {
  const titleWords = section.title.toLowerCase().split(/\W+/).filter(word => word.length > 3);
  const repeatedTitleWords = titleWords.filter(word => allText.toLowerCase().split(word).length > 2).length;
  const structuralWeight = section.depth === 1 ? 2 : 1;
  return clamp(structuralWeight + repeatedTitleWords, 1, 5);
}

function createTopics(text) {
  const normalized = normalizeText(text);
  const sections = extractSections(normalized);
  const allText = sections.map(section => `${section.title} ${section.text}`).join(' ');

  return sections.map((section, index) => {
    const type = classifyChunk(section.title, section.text);
    const complexity = estimateComplexity(section.text, type, section.depth);
    return {
      id: `topic-${index + 1}`,
      title: section.title,
      text: section.text,
      type,
      depth: section.depth,
      estimatedMinutes: estimateMinutes(section.text, complexity),
      complexity,
      importance: scoreImportance(section, allText),
      confidence: section.title === `Section ${index + 1}` ? 0.55 : 0.8,
      status: 'UNSEEN',
    };
  });
}

export function packSessions(topics, sessionMinutes) {
  const sessions = [];
  let current = null;

  topics.forEach(topic => {
    if (!current || current.minutes + topic.estimatedMinutes > sessionMinutes) {
      current = { id: `session-${sessions.length + 1}`, minutes: 0, topics: [] };
      sessions.push(current);
    }
    current.topics.push(topic.id);
    current.minutes += topic.estimatedMinutes;
  });

  return sessions;
}

export function buildStudyPlan(sourceText, options = {}) {
  const normalized = normalizeText(sourceText);
  if (!normalized) return { topics: [], sessions: [], sourceWordCount: 0 };

  const sessionMinutes = clamp(Number(options.sessionMinutes) || 20, 5, 120);
  const topics = createTopics(normalized);
  return {
    sourceWordCount: wordCount(normalized),
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
    nextAction: ACTIONS[topic.type] || ACTIONS.THEORY,
    completed: false,
  };
}

export function getLocalNextAction(step) {
  return ACTIONS[step?.type] || ACTIONS.THEORY;
}

export { MAX_SOURCE_LENGTH };
