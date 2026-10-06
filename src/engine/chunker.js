import { classifyChunk } from './classify.js';
import { estimateMinutes } from './estimate.js';
import { estimateComplexity, scoreImportance, wordCount } from './score.js';

const MIN_SECTION_WORDS = 12;

export function normalizeText(text) {
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

export function extractSections(text) {
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

export function createTopics(text, options = {}) {
  const normalized = normalizeText(text);
  const sections = extractSections(normalized);
  const allText = sections.map(section => `${section.title} ${section.text}`).join(' ');
  const readingSpeed = Number(options.readingSpeed) || 55;

  return sections.map((section, index) => {
    const type = classifyChunk(section.title, section.text);
    const complexity = estimateComplexity(section.text, type, section.depth);
    return {
      id: `topic-${index + 1}`,
      title: section.title,
      text: section.text,
      type,
      depth: section.depth,
      estimatedMinutes: estimateMinutes(section.text, complexity, readingSpeed),
      complexity,
      importance: scoreImportance(section, `${allText} ${options.syllabusText || ''}`),
      confidence: section.title === `Section ${index + 1}` ? 0.55 : 0.8,
      status: 'UNSEEN',
    };
  });
}
