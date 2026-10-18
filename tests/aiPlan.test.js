import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildStudyPlan } from '../src/engine/index.js';
import { buildAiPlanRequest, planFromAi, aiTopicToStep, AI_EXCERPT_BUDGET } from '../src/engine/aiPlan.js';
import { generatePlan, PlanError } from '../server/services/geminiService.js';
import { validatePlan, sanitizePlanRequest } from '../server/services/planSchema.js';

class MemoryStorage {
  constructor(settings) { this.values = new Map([['focusloop_version', '3'], ['focusloop_settings', JSON.stringify(settings)]]); }
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const fakeClient = (...responses) => {
  let calls = 0;
  return {
    get calls() { return calls; },
    models: {
      generateContent: async () => {
        const next = responses[Math.min(calls, responses.length - 1)];
        calls += 1;
        if (next instanceof Error) throw next;
        if (typeof next === 'function') return next();
        return { text: next };
      },
    },
  };
};

const VALID_TOPIC_PLAN = JSON.stringify({
  summary: 'Kirchhoff basics',
  topics: [
    { title: 'KCL at a node', description: 'Currents in equal currents out', estimatedMinutes: 10, type: 'THEORY', complexity: 2, importance: 5, nextAction: 'Write KCL for one node' },
    { title: 'KVL around a loop', estimatedMinutes: 12, type: 'PRACTICE', nextAction: 'Label every voltage drop in a loop' },
  ],
});

test('valid Gemini JSON maps into the existing plan structure', async () => {
  const plan = await generatePlan({ topic: "Kirchhoff's laws", sessionMinutes: 20 }, { client: fakeClient(VALID_TOPIC_PLAN), model: 'test-model' });
  const mapped = planFromAi(plan, { sessionMinutes: 20 });
  assert.equal(mapped.topics.length, 2);
  assert.deepEqual(Object.keys(mapped).sort(), ['generatedBy', 'sessionMinutes', 'sessions', 'sourceWordCount', 'summary', 'topics']);
  for (const topic of mapped.topics) {
    for (const key of ['id', 'title', 'text', 'type', 'estimatedMinutes', 'complexity', 'importance', 'status']) assert.ok(key in topic, key);
  }
  assert.equal(mapped.sessions.flatMap(session => session.topics).length, 2);
  assert.equal(aiTopicToStep(mapped.topics[0]).nextAction, 'Write KCL for one node');
});

test('material mode sends only titles and short excerpts and keeps local topic data', async () => {
  const material = Array.from({ length: 12 }, (_, i) => `# Section ${i + 1}\n${'Ohm law relates voltage and current. '.repeat(80)}`).join('\n\n');
  const localPlan = buildStudyPlan(material, { sessionMinutes: 25 });
  const request = buildAiPlanRequest({ topic: 'Circuits', sessionMinutes: 25, localPlan });
  const size = request.excerpts.reduce((sum, item) => sum + item.title.length + item.excerpt.length, 0);
  assert.ok(size <= AI_EXCERPT_BUDGET, `excerpt chars ${size}`);
  assert.ok(sanitizePlanRequest(request), 'server accepts the client request');

  const aiPlan = { topics: [{ id: localPlan.topics[0].id, title: 'Better title', estimatedMinutes: 7, nextAction: 'Sketch one circuit' }] };
  const mapped = planFromAi(aiPlan, { sessionMinutes: 25, localPlan });
  assert.equal(mapped.topics.length, localPlan.topics.length);
  assert.equal(mapped.topics[0].title, 'Better title');
  assert.equal(mapped.topics[0].text, localPlan.topics[0].text);
  assert.equal(mapped.topics[1].title, localPlan.topics[1].title);
});

test('malformed JSON is retried once, then falls back', async () => {
  const client = fakeClient('not json', '{"topics": "nope"}', VALID_TOPIC_PLAN);
  await assert.rejects(generatePlan({ topic: 'x', sessionMinutes: 20 }, { client, model: 'm' }), error => error instanceof PlanError && error.code === 'bad_output');
  assert.equal(client.calls, 2);
  assert.equal(validatePlan({ topics: [{ title: 'No action' }] }), null);
  assert.equal(planFromAi(null), null);
});

test('429 is not retried and falls back', async () => {
  const error = Object.assign(new Error('quota'), { status: 429 });
  const client = fakeClient(error, VALID_TOPIC_PLAN);
  await assert.rejects(generatePlan({ topic: 'x', sessionMinutes: 20 }, { client, model: 'm' }), e => e.code === 'rate_limited');
  assert.equal(client.calls, 1);
});

test('timeout falls back without retrying', async () => {
  const client = fakeClient(() => new Promise(resolve => setTimeout(() => resolve({ text: VALID_TOPIC_PLAN }), 3000)));
  await assert.rejects(generatePlan({ topic: 'x', sessionMinutes: 20 }, { client, model: 'm', timeoutMs: 800 }), e => e.code === 'timeout');
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
