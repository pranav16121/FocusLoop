import { clamp, wordCount } from './score.js';

export function estimateMinutes(text, complexity, readingSpeed = 55) {
  return clamp(Math.round(wordCount(text) / readingSpeed + complexity * 2), 5, 45);
}
