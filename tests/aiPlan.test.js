import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildStudyPlan } from '../src/engine/index.js';
import { packSessions } from '../src/engine/packer.js';
import { buildAiPlanRequest, planFromAi, aiTopicToStep, describePlanChange, AI_EXCERPT_BUDGET } from '../src/engine/aiPlan.js';
import { generatePlan, generateOutline, PlanError } from '../server/services/geminiService.js';
import { validatePlan, sanitizePlanRequest, isGenericAction, correctMinutes, planCacheKey, PROMPT_VERSION } from '../server/services/planSchema.js';

class MemoryStorage {
  constructor(settings) { this.values = new Map([['focusloop_version', '4'], ['focusloop_settings', JSON.stringify(settings)]]); }
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

// Fake Gemini client: returns queued responses in order and records every prompt.
const fakeClient = (...responses) => {
  const prompts = [];
  return {
    prompts,
    get calls() { return prompts.length; },
    models: {
      generateContent: async ({ contents }) => {
        const next = responses[Math.min(prompts.length, responses.length - 1)];
        prompts.push(contents);
        if (next instanceof Error) throw next;
        if (typeof next === 'function') return next();
        return { text: typeof next === 'string' ? next : JSON.stringify(next) };
      },
    },
  };
};

const GOOD_TOPICS = {
  summary: 'Kirchhoff basics',
  topics: [
    { title: 'KCL at a node', description: 'Currents in equal currents out', estimatedMinutes: 10, type: 'THEORY', complexity: 2, importance: 5, nextAction: 'Write KCL for node B and check the currents sum to zero' },
    { title: 'KVL around a loop', estimatedMinutes: 12, type: 'PRACTICE', prerequisites: [0], nextAction: 'Label every voltage drop in loop 1 and add them to zero' },
  ],
};
const GENERIC_TOPICS = { topics: [{ title: 'Kirchhoff', estimatedMinutes: 10, nextAction: 'Review the chapter on Kirchhoff carefully' }] };
const request = (extra = {}) => sanitizePlanRequest({ topic: "Kirchhoff's laws", sessionMinutes: 20, ...extra });

test('valid Gemini JSON maps into the existing plan structure', async () => {
  const plan = await generatePlan(request(), { client: fakeClient(GOOD_TOPICS), model: 'm' });
  const mapped = planFromAi(plan, { sessionMinutes: 20 });
  assert.equal(mapped.topics.length, 2);
  for (const topic of mapped.topics) {
    for (const key of ['id', 'title', 'text', 'type', 'estimatedMinutes', 'complexity', 'importance', 'status']) assert.ok(key in topic, key);
  }
  assert.equal(mapped.sessions.flatMap(session => session.topics).length, 2);
  assert.match(aiTopicToStep(mapped.topics[0]).nextAction, /^Write KCL/);
});

test('grounding: topics without valid sourceChunkIds are dropped and local topics fill the gaps', () => {
  const material = ['# Ohm', 'V equals I times R.', '# Series', 'Series resistors add.', '# Power', 'P equals V times I.'].join('\n');
  const localPlan = buildStudyPlan(material, { sessionMinutes: 20 });
  const ids = localPlan.topics.map(topic => topic.id);
  const raw = { topics: [
    { title: 'Ohm and series', estimatedMinutes: 8, sourceChunkIds: [ids[0], ids[1]], nextAction: 'Compute the current through two 10 ohm series resistors at 5 V' },
    { title: 'Invented topic', estimatedMinutes: 8, sourceChunkIds: ['topic-99'], nextAction: 'Derive Maxwell equations from the given sections now' },
    { title: 'No ids', estimatedMinutes: 8, nextAction: 'Write the power formula P equals V times I' },
  ] };
  const validated = validatePlan(raw, { ids });
  assert.equal(validated.topics.length, 1);
  assert.equal(validated.ungrounded, 2);
  const mapped = planFromAi(validated, { sessionMinutes: 20, localPlan });
  assert.deepEqual(mapped.topics.map(topic => topic.title), ['Ohm and series', localPlan.topics[2].title]);
  assert.deepEqual(mapped.topics[0].sourceChunkIds, [ids[0], ids[1]]);
});

test('material mode sends only titles, short excerpts and local minutes', () => {
  const material = Array.from({ length: 12 }, (_, i) => `# Section ${i + 1}\n${'Ohm law relates voltage and current. '.repeat(80)}`).join('\n\n');
  const localPlan = buildStudyPlan(material, { sessionMinutes: 25 });
  const body = buildAiPlanRequest({ topic: 'Circuits', sessionMinutes: 25, localPlan, level: 'new', goal: 'exam', course: 'VTU' });
  const size = body.excerpts.reduce((sum, item) => sum + item.title.length + item.excerpt.length, 0);
  assert.ok(size <= AI_EXCERPT_BUDGET, `excerpt chars ${size}`);
  assert.ok(body.excerpts.every(item => item.localMinutes > 0));
  assert.equal(sanitizePlanRequest(body).course, 'VTU');
});

test('clamp and repack never exceed the session length', () => {
  const plan = { topics: [
    { title: 'A', estimatedMinutes: 90, sourceChunkIds: ['c1'] },
    { title: 'B', estimatedMinutes: 1, sourceChunkIds: ['c2'] },
    { title: 'C', estimatedMinutes: 55 },
  ] };
  const corrected = correctMinutes(plan, { sessionMinutes: 20, excerpts: [{ id: 'c1', localMinutes: 10 }, { id: 'c2', localMinutes: 12 }] });
  assert.deepEqual(corrected.topics.map(topic => topic.estimatedMinutes), [15, 6, 20]);
  const topics = corrected.topics.map((topic, index) => ({ ...topic, id: `t${index}` }));
  for (const session of packSessions(topics, 20)) assert.ok(session.minutes <= 20, `session ${session.minutes} min`);
  const mapped = planFromAi({ topics: [{ title: 'Huge', estimatedMinutes: 120, nextAction: 'Write the three Maxwell equations from memory' }] }, { sessionMinutes: 25 });
  assert.ok(mapped.sessions.every(session => session.minutes <= 25));
});

test('generic micro-action detector', () => {
  for (const text of ['Review the chapter on circuits', 'Open your textbook to page 4', 'Study this topic carefully today', 'Go over it']) assert.equal(isGenericAction(text), true, text);
  for (const text of ['Write KCL for node B and check the sum is zero', 'Solve: A in 6 days, B in 3 - time together?']) assert.equal(isGenericAction(text), false, text);
});

test('repair retry fires exactly once and lists the specific failure', async () => {
  const fixed = fakeClient(GENERIC_TOPICS, GOOD_TOPICS);
  const plan = await generatePlan(request(), { client: fixed, model: 'm' });
  assert.equal(fixed.calls, 2);
  assert.match(fixed.prompts[1], /generic micro-action/);
  assert.equal(plan.topics.length, 2);

  const stillBad = fakeClient(GENERIC_TOPICS, GENERIC_TOPICS, GOOD_TOPICS);
  await assert.rejects(generatePlan(request(), { client: stillBad, model: 'm' }), error => error instanceof PlanError && error.code === 'bad_output');
  assert.equal(stillBad.calls, 2);
});

test('prerequisite order and outline coverage are validated', async () => {
  const lateDependency = { topics: [{ ...GOOD_TOPICS.topics[0], prerequisites: [1] }, GOOD_TOPICS.topics[1]] };
  const client = fakeClient(lateDependency, GOOD_TOPICS);
  await generatePlan(request(), { client, model: 'm' });
  assert.match(client.prompts[1], /depends on later topics/);

  const missingOutline = fakeClient(GOOD_TOPICS, GOOD_TOPICS);
  await assert.rejects(generatePlan(request({ outline: ['KCL at a node', 'KVL around a loop', 'Nodal analysis'] }), { client: missingOutline, model: 'm' }), e => e.code === 'bad_output');
  assert.match(missingOutline.prompts[1], /Nodal analysis/);
});

test('outline mode returns 6-10 items and repairs a short outline once', async () => {
  const items = n => ({ outline: Array.from({ length: n }, (_, i) => ({ title: `Topic ${i + 1}` })) });
  const client = fakeClient(items(3), items(8));
  const result = await generateOutline(request({ mode: 'outline' }), { client, model: 'm' });
  assert.equal(result.outline.length, 8);
  assert.equal(client.calls, 2);
});

test('cache key changes with PROMPT_VERSION and every context field', () => {
  const base = request({ level: 'new', goal: 'exam', course: 'VTU' });
  const key = planCacheKey(base);
  assert.notEqual(planCacheKey(base, `${PROMPT_VERSION}-next`), key);
  for (const change of [{ level: 'revising' }, { goal: 'interview' }, { course: 'CBSE' }, { feedback: 'too_easy' }, { mode: 'outline' }]) {
    assert.notEqual(planCacheKey({ ...base, ...change }), key, JSON.stringify(change));
  }
  assert.equal(planCacheKey(request({ level: 'new', goal: 'exam', course: 'VTU' })), key);
});

test('feedback note describes what changed', () => {
  const before = { topics: [{ title: 'A', estimatedMinutes: 20 }] };
  const after = { topics: [{ title: 'A1', estimatedMinutes: 10 }, { title: 'A2', estimatedMinutes: 10 }] };
  assert.equal(describePlanChange(before, after, 'too_broad'), 'Too broad: 1 → 2 topics, about 20 → 10 min each, 2 new or reworded.');
});

test('429 is not retried and falls back', async () => {
  const client = fakeClient(Object.assign(new Error('quota'), { status: 429 }), GOOD_TOPICS);
  await assert.rejects(generatePlan(request(), { client, model: 'm' }), e => e.code === 'rate_limited');
  assert.equal(client.calls, 1);
});

test('timeout falls back without retrying', async () => {
  const client = fakeClient(() => new Promise(resolve => setTimeout(() => resolve({ text: JSON.stringify(GOOD_TOPICS) }), 3000)));
  await assert.rejects(generatePlan(request(), { client, model: 'm', timeoutMs: 800 }), e => e.code === 'timeout');
  assert.equal(client.calls, 1);
});

test('client: 429 / network errors return the calm offline-planner message', async () => {
  globalThis.localStorage = new MemoryStorage({ aiEnabled: true, mode: 'ai-assisted' });
  const { planWithAI, AI_FALLBACK_MESSAGE } = await import('../src/services/aiService.js?ai-plan-fallback');
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 });
  assert.deepEqual(await planWithAI({ topic: 'x' }), { ok: false, reason: 'rate_limited', message: AI_FALLBACK_MESSAGE });
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal((await planWithAI({ topic: 'x' })).message, AI_FALLBACK_MESSAGE);
});

test('Local mode: Plan with AI makes zero network calls', async () => {
  globalThis.localStorage = new MemoryStorage({ aiEnabled: false, mode: 'local' });
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('network'); };
  const { planWithAI } = await import('../src/services/aiService.js?ai-plan-local');
  const result = await planWithAI({ topic: 'Kirchhoff' });
  assert.equal(result.reason, 'local');
  assert.equal(calls, 0);
});

test('the Gemini key never appears in the client bundle', (t) => {
  const envFile = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
  const key = (process.env.GEMINI_API_KEY || envFile.match(/^GEMINI_API_KEY=(.+)$/m)?.[1] || '').trim();
  if (!existsSync('dist')) return t.skip('run `npm run build` first');
  const files = [];
  const walk = dir => readdirSync(dir, { withFileTypes: true }).forEach(entry => (entry.isDirectory() ? walk(join(dir, entry.name)) : files.push(join(dir, entry.name))));
  walk('dist');
  const bundle = files.filter(file => /\.(js|html|css|json|webmanifest)$/.test(file)).map(file => readFileSync(file, 'utf8')).join('\n');
  if (key) assert.ok(!bundle.includes(key), 'API key leaked into dist/');
});
