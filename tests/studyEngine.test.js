import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudyPlan, getLocalNextAction, packSessions, topicToStep } from '../src/algorithms/studyEngine.js';

test('buildStudyPlan detects headings, types, scores, and actions', () => {
  const plan = buildStudyPlan(`# Circuit Laws\nKirchhoff's current law is defined as the sum of currents.\n\n## Worked Example\nSolve the first nodal example.`, { sessionMinutes: 20 });

  assert.equal(plan.topics.length, 2);
  assert.equal(plan.topics[0].title, 'Circuit Laws');
  assert.equal(plan.topics[0].type, 'DEFINITION');
  assert.equal(plan.topics[0].importance >= 1, true);
  assert.match(topicToStep(plan.topics[0]).nextAction, /explain/i);
  assert.equal(plan.topics[1].type, 'EXAMPLE');
});

test('packSessions preserves topic order and starts a new session at the limit', () => {
  const sessions = packSessions([
    { id: 'a', estimatedMinutes: 8 },
    { id: 'b', estimatedMinutes: 7 },
    { id: 'c', estimatedMinutes: 6 },
  ], 15);

  assert.deepEqual(sessions.map(session => session.topics), [['a', 'b'], ['c']]);
  assert.deepEqual(sessions.map(session => session.minutes), [15, 6]);
});

test('local next-action guidance is deterministic', () => {
  assert.match(getLocalNextAction({ type: 'DERIVATION' }), /reproduce/i);
  assert.match(getLocalNextAction({ type: 'THEORY' }), /three key ideas/i);
});
