import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudyPlan, normalizeText, packSessions } from '../src/algorithms/studyEngine.js';

const syllabus = `
UNIT 1: CIRCUIT FUNDAMENTALS
Kirchhoff's current law is defined as the algebraic sum of currents at a node.

1.1 Nodal Analysis
Derive the nodal equations for a resistive network and solve the first example.

UNIT 2: SIGNALS
Fourier series represents a periodic signal using harmonically related sinusoids.

2.1 Transform Exercise
Solve the Fourier transform exercise and compare the frequency response.
`;

test('golden engineering syllabus produces stable topics and scores', () => {
  const plan = buildStudyPlan(syllabus, { sessionMinutes: 15, syllabusText: 'Kirchhoff Fourier exam' });
  assert.deepEqual(plan.topics.map(topic => topic.title), ['UNIT 1: CIRCUIT FUNDAMENTALS', 'Nodal Analysis', 'UNIT 2: SIGNALS', 'Transform Exercise']);
  assert.deepEqual(plan.topics.map(topic => topic.type), ['DEFINITION', 'DERIVATION', 'THEORY', 'PROBLEM']);
  assert.equal(plan.topics.every(topic => topic.complexity >= 1 && topic.complexity <= 5), true);
  assert.equal(plan.topics.every(topic => topic.importance >= 1 && topic.importance <= 5), true);
});

test('normalization removes ligatures, odd minus signs, line-wrap hyphens, and repeated headers', () => {
  const normalized = normalizeText('Page 1\nPage 1\nPage 1\nThe co\n-efficient uses ﬀ and − signs.');
  assert.match(normalized, /coefficient/);
  assert.match(normalized, /ff/);
  assert.match(normalized, /- signs/);
  assert.equal(normalized.includes('Page 1'), false);
});

test('packer never exceeds the chosen length unless one topic is itself larger', () => {
  const topics = [{ id: 'a', estimatedMinutes: 5 }, { id: 'b', estimatedMinutes: 10 }, { id: 'c', estimatedMinutes: 20 }];
  const sessions = packSessions(topics, 15);
  assert.equal(sessions[0].minutes <= 15, true);
  assert.equal(sessions[1].minutes, 20);
});