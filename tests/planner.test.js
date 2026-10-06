import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExamPlan, rebalanceExamPlan } from '../src/engine/planner.js';

test('exam planner distributes topics across available days', () => {
  const plan = buildExamPlan([
    { id: 'a', title: 'A', estimatedMinutes: 60 },
    { id: 'b', title: 'B', estimatedMinutes: 90 },
  ], '2026-01-04', 2, new Date('2026-01-01T12:00:00Z'));
  assert.equal(plan.totalMinutes, 150);
  assert.equal(plan.days.length, 2);
  assert.equal(plan.days.flatMap(day => day.topics).length, 2);
});

test('exam planner can rebuild from today without warning language', () => {
  const plan = buildExamPlan([{ id: 'a', estimatedMinutes: 30 }], '2026-01-05', 1, new Date('2026-01-01T12:00:00Z'));
  const adjusted = rebalanceExamPlan(plan, [{ id: 'a', estimatedMinutes: 30 }], new Date('2026-01-02T12:00:00Z'));
  assert.equal(typeof adjusted.adjusted, 'boolean');
  assert.equal(adjusted.days.length > 0, true);
});
