// Manual-only eval for "Plan with AI" (not part of npm test; uses live Gemini quota).
// Usage: node tests/eval/run-eval.mjs [count=5]
// Topic items run outline -> plan (the generated outline is used as the confirmed outline);
// material items run the grounded material plan. Calls are spaced out for free-tier rate limits.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { buildStudyPlan } from '../../src/engine/index.js';
import { buildAiPlanRequest } from '../../src/engine/aiPlan.js';
import { packSessions } from '../../src/engine/packer.js';
import { generateOutline, generatePlan } from '../../server/services/geminiService.js';
import { sanitizePlanRequest, isGenericAction, PROMPT_VERSION } from '../../server/services/planSchema.js';

const GAP_MS = 25000;
const count = Number(process.argv[2]) || 5;
const items = JSON.parse(readFileSync(new URL('./topics.json', import.meta.url), 'utf8')).slice(0, count);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const rows = [];

for (const [index, item] of items.entries()) {
  if (index > 0) await sleep(GAP_MS);
  const base = { topic: item.topic, sessionMinutes: item.sessionMinutes, level: item.level || '', goal: item.goal || '', course: item.course || '' };
  try {
    let plan;
    if (item.material) {
      const localPlan = buildStudyPlan(item.material, { sessionMinutes: item.sessionMinutes });
      plan = await generatePlan(sanitizePlanRequest(buildAiPlanRequest({ ...base, localPlan })));
    } else {
      const { outline } = await generateOutline(sanitizePlanRequest({ ...base, mode: 'outline' }));
      await sleep(GAP_MS);
      plan = await generatePlan(sanitizePlanRequest({ ...base, outline: outline.map(entry => entry.title) }));
    }
    const ordered = plan.topics.every((topic, i) => topic.prerequisites.every(p => p < i));
    const withinLimit = plan.topics.every(topic => topic.estimatedMinutes <= item.sessionMinutes)
      && packSessions(plan.topics, item.sessionMinutes).every(session => session.minutes <= item.sessionMinutes);
    const generic = plan.topics.filter(topic => isGenericAction(topic.nextAction)).length;
    rows.push({ topic: item.topic, mode: item.material ? 'material' : 'topic', topics: plan.topics.length, order: ordered ? 'yes' : 'NO', minutes: withinLimit ? 'yes' : 'NO', generic, ungrounded: item.material ? plan.ungrounded : 'n/a', sample: plan.topics[0]?.nextAction });
  } catch (error) {
    rows.push({ topic: item.topic, mode: item.material ? 'material' : 'topic', topics: 0, order: '-', minutes: '-', generic: '-', ungrounded: '-', sample: `fallback (${error.code || error.message})` });
  }
  console.error(`done ${index + 1}/${items.length}: ${item.topic}`);
}

console.log(`\nPrompt ${PROMPT_VERSION}, model ${process.env.GEMINI_MODEL}\n`);
console.log('| Topic | Mode | Topics | Sensible order | Minutes within limit | Generic actions | Ungrounded | First micro-action |');
console.log('|---|---|---|---|---|---|---|---|');
for (const row of rows) console.log(`| ${row.topic} | ${row.mode} | ${row.topics} | ${row.order} | ${row.minutes} | ${row.generic} | ${row.ungrounded} | ${row.sample} |`);
