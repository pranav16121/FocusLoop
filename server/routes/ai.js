import { Router } from 'express';
import { generateBreakdown, generateNextAction, generateContext, generateReflection, generateAdaptivePlan } from '../services/anthropicService.js';
import { demoBreakdown, demoNextAction, demoContext, demoReflection, demoAdaptivePlan } from '../services/demoService.js';

const router = Router();

const isAIAvailable = () => !!process.env.ANTHROPIC_API_KEY;

router.post('/breakdown', async (req, res) => {
  try {
    const { task, options } = req.body;
    if (!task) return res.status(400).json({ error: 'Task is required' });
    
    let result;
    if (isAIAvailable()) {
      try {
        result = await generateBreakdown(task, options);
      } catch (err) {
        console.error('AI breakdown failed, using demo:', err.message);
        result = demoBreakdown(task, options);
        result.mode = 'demo';
      }
    } else {
      result = demoBreakdown(task, options);
      result.mode = 'demo';
    }
    res.json(result);
  } catch (err) {
    console.error('Breakdown error:', err);
    res.status(500).json({ error: 'Failed to generate breakdown', fallback: true });
  }
});

router.post('/next-action', async (req, res) => {
  try {
    const { task, steps, currentStepIndex } = req.body;
    let result;
    if (isAIAvailable()) {
      try {
        result = await generateNextAction(task, steps, currentStepIndex);
      } catch (err) {
        console.error('AI next-action failed, using demo:', err.message);
        result = demoNextAction(task, steps, currentStepIndex);
      }
    } else {
      result = demoNextAction(task, steps, currentStepIndex);
    }
    res.json(result);
  } catch (err) {
    console.error('Next-action error:', err);
    res.status(500).json({ error: 'Failed to generate next action' });
  }
});

router.post('/context', async (req, res) => {
  try {
    const { task, steps, currentStepIndex, interruptionDuration } = req.body;
    let result;
    if (isAIAvailable()) {
      try {
        result = await generateContext(task, steps, currentStepIndex, interruptionDuration);
      } catch (err) {
        console.error('AI context failed, using demo:', err.message);
        result = demoContext(task, steps, currentStepIndex, interruptionDuration);
      }
    } else {
      result = demoContext(task, steps, currentStepIndex, interruptionDuration);
    }
    res.json(result);
  } catch (err) {
    console.error('Context error:', err);
    res.status(500).json({ error: 'Failed to generate context' });
  }
});

router.post('/reflection', async (req, res) => {
  try {
    const { task, steps, completedSteps, duration, interruptions } = req.body;
    let result;
    if (isAIAvailable()) {
      try {
        result = await generateReflection(task, steps, completedSteps, duration, interruptions);
      } catch (err) {
        console.error('AI reflection failed, using demo:', err.message);
        result = demoReflection(task, steps, completedSteps, duration, interruptions);
      }
    } else {
      result = demoReflection(task, steps, completedSteps, duration, interruptions);
    }
    res.json(result);
  } catch (err) {
    console.error('Reflection error:', err);
    res.status(500).json({ error: 'Failed to generate reflection' });
  }
});

router.post('/adaptive', async (req, res) => {
  try {
    const { sessionHistory } = req.body;
    let result;
    if (isAIAvailable()) {
      try {
        result = await generateAdaptivePlan(sessionHistory);
      } catch (err) {
        console.error('AI adaptive failed, using demo:', err.message);
        result = demoAdaptivePlan(sessionHistory);
      }
    } else {
      result = demoAdaptivePlan(sessionHistory);
    }
    res.json(result);
  } catch (err) {
    console.error('Adaptive error:', err);
    res.status(500).json({ error: 'Failed to generate adaptive plan' });
  }
});

export default router;
