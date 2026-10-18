import { createHash } from 'node:crypto';
import { Router } from 'express';
import { generatePlan } from '../services/geminiService.js';
import { sanitizePlanRequest } from '../services/planSchema.js';

// POST /api/ai/plan — the only route that sends data to Gemini.
const router = Router();

const MAX_BODY_BYTES = 10 * 1024;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 8;

const cache = new Map();
const hits = new Map();

const STATUS_BY_CODE = { no_key: 503, no_model: 503, ai_off: 503, rate_limited: 429, timeout: 504, bad_output: 502, upstream: 502 };
const MESSAGE_BY_CODE = {
  no_key: 'AI is not set up on the server.',
  no_model: 'AI is not set up on the server.',
  ai_off: 'AI planning is turned off on the server.',
  rate_limited: 'AI is busy right now.',
  timeout: 'AI took too long to answer.',
  bad_output: 'AI returned an unusable plan.',
  upstream: 'AI is unavailable right now.',
};

const sendError = (res, code) => res.status(STATUS_BY_CODE[code] || 502).json({ error: code, message: MESSAGE_BY_CODE[code] || MESSAGE_BY_CODE.upstream });

function cacheKey(input) {
  // Topic + length (+ exam date and excerpts, so different material never shares a plan).
  return createHash('sha256').update(JSON.stringify([input.topic.toLowerCase(), input.sessionMinutes, input.examDate, input.excerpts])).digest('hex');
}

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.plan;
}

function writeCache(key, plan) {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { plan, at: Date.now() });
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(time => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_REQUESTS) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

router.post('/plan', async (req, res) => {
  if ((process.env.AI_PROVIDER || 'gemini').toLowerCase() !== 'gemini') return sendError(res, 'ai_off');
  if (Buffer.byteLength(JSON.stringify(req.body || {})) > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'too_large', message: 'Request is too large.' });
  }
  const input = sanitizePlanRequest(req.body);
  if (!input) return res.status(400).json({ error: 'invalid', message: 'A topic or material excerpts are required.' });

  const key = cacheKey(input);
  const cached = readCache(key);
  if (cached) return res.json({ plan: cached, cached: true });

  if (isRateLimited(req.ip || 'unknown')) return sendError(res, 'rate_limited');

  try {
    const plan = await generatePlan(input);
    writeCache(key, plan);
    res.json({ plan, cached: false });
  } catch (error) {
    console.error(`Gemini plan failed: ${error.code || 'upstream'} ${error.message}`);
    sendError(res, error.code);
  }
});

export default router;
