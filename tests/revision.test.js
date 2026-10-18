import test from 'node:test';
import assert from 'node:assert/strict';
import { createReminder, markReviewed, snoozeReminder, upsertReminder, getDueReviews } from '../src/engine/revision.js';

const NOW = new Date('2026-01-01T10:00:00');
const dayOf = (iso) => new Date(iso).getDate();

test('"Revisit this topic" reminders follow 1/3/7/14 days and finish after 14', () => {
  let entry = createReminder({ topicId: 'topic-1', title: 'KCL', task: 'Circuits' }, NOW);
  assert.equal(dayOf(entry.nextDueAt), 2);
  entry = markReviewed(entry, NOW);
  assert.equal(dayOf(entry.nextDueAt), 4);
  entry = markReviewed(entry, NOW);
  assert.equal(dayOf(entry.nextDueAt), 8);
  entry = markReviewed(entry, NOW);
  assert.equal(dayOf(entry.nextDueAt), 15);
  assert.equal(markReviewed(entry, NOW), null);
});

test('"Later" snoozes one day without changing the interval', () => {
  const entry = markReviewed(createReminder({ topicId: 't', title: 'T' }, NOW), NOW);
  const snoozed = snoozeReminder(entry, NOW);
  assert.equal(snoozed.level, entry.level);
  assert.equal(dayOf(snoozed.nextDueAt), 2);
});

test('reminders are not duplicated and due ones are found', () => {
  const entry = createReminder({ topicId: 'topic-1', title: 'KCL' }, NOW);
  assert.equal(upsertReminder(upsertReminder([], entry), entry).length, 1);
  assert.equal(getDueReviews([{ ...entry, nextDueAt: '2025-12-31T00:00:00Z' }], NOW).length, 1);
  assert.equal(getDueReviews([entry], NOW).length, 0);
});
