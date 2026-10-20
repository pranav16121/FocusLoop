import { Router } from 'express';
import { generateOutline, generatePlan } from '../services/geminiService.js';
import { sanitizePlanRequest, planCacheKey } from '../services/planSchema.js';

// POST /api/ai/plan — the only route that sends data to Gemini.
// mode "outline" drafts a 6-10 item outline; mode "plan" builds sessions (topic, outline, or material).
// Outline, build and feedback re-runs each count toward the per-IP rate limit and the daily guard.
const router = Router();

const MAX_BODY_BYTES = 12 * 1024;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 12;
const DAILY_LIMIT = Number(process.env.GEMINI_DAILY_LIMIT) || 200;

const cache = new Map();
const hits = new Map();
const daily = { day: '', count: 0 };

const STATUS_BY_CODE = { no_key: 503, no_model: 503, ai_off: 503, rate_limited: 429, daily_limit: 429, timeout: 504, bad_output: 502, upstream: 502 };
const MESSAGE_BY_CODE = {
  no_key: 'AI is not set up on the server.',
  no_model: 'AI is not set up on the server.',
  ai_off: 'AI planning is turned off on the server.',
  rate_limited: 'AI is busy right now.',
  daily_limit: 'The daily AI limit has been reached.',
  timeout: 'AI took too long to answer.',
  bad_output: 'AI returned an unusable plan.',
  upstream: 'AI is unavailable right now.',
};

const sendError = (res, code) => res.status(STATUS_BY_CODE[code] || 502).json({ error: code, message: MESSAGE_BY_CODE[code] || MESSAGE_BY_CODE.upstream });

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.value;
}

function writeCache(key, value) {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, at: Date.now() });
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(time => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_REQUESTS) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

// Server-wide cap on Gemini requests per UTC day.
function isOverDailyLimit() {
  const today = new Date().toISOString().slice(0, 10);
  if (daily.day !== today) { daily.day = today; daily.count = 0; }
  if (daily.count >= DAILY_LIMIT) return true;
  daily.count += 1;
  return false;
}

router.post('/plan', async (req, res) => {
  if ((process.env.AI_PROVIDER || 'gemini').toLowerCase() !== 'gemini') return sendError(res, 'ai_off');
  if (Buffer.byteLength(JSON.stringify(req.body || {})) > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'too_large', message: 'Request is too large.' });
  }
  const input = sanitizePlanRequest(req.body);
  if (!input) return res.status(400).json({ error: 'invalid', message: 'A topic or material excerpts are required.' });

  const key = planCacheKey(input);
  const cached = readCache(key);
  if (cached) return res.json({ ...cached, cached: true });

  if (isRateLimited(req.ip || 'unknown')) return sendError(res, 'rate_limited');
  if (isOverDailyLimit()) return sendError(res, 'daily_limit');

  try {
    const value = input.mode === 'outline' ? await generateOutline(input) : { plan: await generatePlan(input) };
    writeCache(key, value);
    res.json({ ...value, cached: false });
  } catch (error) {
    console.error(`Gemini ${input.mode} failed: ${error.code || 'upstream'} ${error.message}`);
    sendError(res, error.code);
  }
});

export default router;
