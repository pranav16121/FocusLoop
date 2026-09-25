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
  res.json({
    status: 'ok',
    aiAvailable: !!process.env.ANTHROPIC_API_KEY,
    mode: process.env.ANTHROPIC_API_KEY ? 'ai' : 'demo'
  });
});

// AI routes
app.use('/api/ai', aiRoutes);

app.listen(PORT, () => {
  console.log(`FocusLoop server running on port ${PORT}`);
  console.log(`AI mode: ${process.env.ANTHROPIC_API_KEY ? 'Anthropic API' : 'Demo/Fallback'}`);
});
