import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import aiRoutes from './routes/ai.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

// Azure App Service sits behind a proxy; this makes req.ip the real client IP for rate limiting.
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '200kb' }));

const geminiReady = () => (process.env.AI_PROVIDER || 'gemini').toLowerCase() === 'gemini' && Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL);

// Health check
app.get('/api/health', (req, res) => {
  const provider = geminiReady() ? 'Gemini' : process.env.ANTHROPIC_API_KEY ? 'Anthropic' : null;
  res.json({
    status: 'ok',
    aiAvailable: Boolean(provider),
    provider,
    mode: provider ? 'ai' : 'demo'
  });
});

// AI routes
app.use('/api/ai', aiRoutes);

// In production the same server hosts the built frontend, so the client can call relative /api paths.
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(join(DIST_DIR, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`FocusLoop server running on port ${PORT}`);
  console.log(`AI planner: ${geminiReady() ? `Gemini (${process.env.GEMINI_MODEL})` : 'off - offline planner only'}`);
});
