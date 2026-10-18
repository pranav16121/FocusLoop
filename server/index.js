import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import aiRoutes from './routes/ai.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  const provider = process.env.GEMINI_API_KEY ? 'Gemini' : process.env.ANTHROPIC_API_KEY ? 'Anthropic' : null;
  res.json({
    status: 'ok',
    aiAvailable: Boolean(provider),
    provider,
    mode: provider ? 'ai' : 'demo'
  });
});

// AI routes
app.use('/api/ai', aiRoutes);

app.listen(PORT, () => {
  console.log(`FocusLoop server running on port ${PORT}`);
  console.log(`AI mode: ${process.env.GEMINI_API_KEY ? 'Gemini API' : process.env.ANTHROPIC_API_KEY ? 'Anthropic API' : 'Demo/Fallback'}`);
});
