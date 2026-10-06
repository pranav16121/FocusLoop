function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function estimateComplexity(text, type, depth) {
  const words = wordCount(text);
  const sentences = Math.max(1, (text.match(/[.!?]+/g) || []).length);
  const longWords = (text.match(/\b[A-Za-z]{10,}\b/g) || []).length;
  const symbols = (text.match(/[=+\-*/^\u2211\u222b]/g) || []).length;
  const typeWeight = type === 'DERIVATION' || type === 'PROBLEM' ? 1 : type === 'FORMULA' ? 0.5 : 0;
  const score = 1 + (words / 180) + (longWords / 35) + (symbols / 15) + (sentences > 0 ? words / sentences / 35 : 0) + typeWeight + Math.max(0, depth - 1) * 0.25;
  return clamp(Math.round(score), 1, 5);
}

export function scoreImportance(section, allText) {
  const titleWords = section.title.toLowerCase().split(/\W+/).filter(word => word.length > 3);
  const repeatedTitleWords = titleWords.filter(word => allText.toLowerCase().split(word).length > 2).length;
  const structuralWeight = section.depth === 1 ? 2 : 1;
  return clamp(structuralWeight + repeatedTitleWords, 1, 5);
}

export { clamp, wordCount };
