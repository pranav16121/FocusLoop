import test from 'node:test';
import assert from 'node:assert/strict';
import { getDueReviews, scheduleNextReview } from '../src/engine/revision.js';

test('revision scheduler uses 1/3/7/14 day progression', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  const card = { id: 'card-1', level: 0, prompt: 'Prompt', answer: 'Answer' };
  const gotIt = scheduleNextReview(card, 'got-it', now);
  assert.equal(new Date(gotIt.nextDueAt).getDate(), 2);
  const advanced = scheduleNextReview({ ...gotIt, level: 1 }, 'got-it', now);
  assert.equal(new Date(advanced.nextDueAt).getDate(), 4);
  assert.equal(getDueReviews([{ ...card, nextDueAt: '2025-12-31T00:00:00Z' }], now).length, 1);
});
