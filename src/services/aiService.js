// AI Service - abstraction layer for all AI operations
// The UI interacts with AI through this module, with seamless server API and offline fallbacks

const API_BASE = '/api/ai';

async function fetchAPI(endpoint, data) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch {
    // Graceful fallback to client deterministic responses
    return null;
  }
}

// Client-side fallback when backend is unavailable
function clientFallbackBreakdown(task) {
  const lower = task.toLowerCase();
  let steps;
  
  if (lower.includes('network') || lower.includes('circuit') || lower.includes('kcl') || lower.includes('kvl') || lower.includes('kirchhoff') || lower.includes('study') || lower.includes('exam')) {
    steps = [
      { title: 'Review KCL', description: 'Review Kirchhoff\'s Current Law fundamentals', estimatedMinutes: 5 },
      { title: 'Solve KCL Example 1', description: 'Basic nodal analysis circuit', estimatedMinutes: 8 },
      { title: 'Solve KCL Example 2', description: 'Multi-node circuit with dependent sources', estimatedMinutes: 10 },
      { title: 'Review KVL', description: 'Review Kirchhoff\'s Voltage Law and loop equations', estimatedMinutes: 5 },
      { title: 'Solve one KVL problem', description: 'Apply mesh analysis to a two-loop circuit', estimatedMinutes: 10 },
    ];
  } else if (lower.includes('write') || lower.includes('essay') || lower.includes('paper')) {
    steps = [
      { title: 'Brainstorm key points', description: 'List 3-5 main ideas', estimatedMinutes: 5 },
      { title: 'Create an outline', description: 'Organize your ideas into sections', estimatedMinutes: 8 },
      { title: 'Write the first section', description: 'Get the first draft moving', estimatedMinutes: 15 },
      { title: 'Write the next section', description: 'Keep building momentum', estimatedMinutes: 15 },
      { title: 'Review and edit', description: 'Polish and fix flow', estimatedMinutes: 10 },
    ];
  } else if (lower.includes('code') || lower.includes('build') || lower.includes('implement') || lower.includes('program')) {
    steps = [
      { title: 'Understand the requirements', description: 'Clarify input, output, and constraints', estimatedMinutes: 5 },
      { title: 'Set up project structure', description: 'Create modules and basic signatures', estimatedMinutes: 8 },
      { title: 'Implement core logic', description: 'Build the primary happy path', estimatedMinutes: 15 },
      { title: 'Test with a sample input', description: 'Verify behavior matches expectation', estimatedMinutes: 8 },
      { title: 'Handle edge cases', description: 'Add bounds checking and safety guards', estimatedMinutes: 10 },
    ];
  } else {
    steps = [
      { title: 'Gather your materials', description: 'Organize what you need for this step', estimatedMinutes: 5 },
      { title: 'Focus on the first small part', description: 'Start the simplest subtask', estimatedMinutes: 10 },
      { title: 'Continue with the main action', description: 'Build on the initial progress', estimatedMinutes: 15 },
      { title: 'Review and summarize', description: 'Capture what was completed', estimatedMinutes: 5 },
    ];
  }
  
  return { steps, mode: 'demo' };
}

export async function generateTaskBreakdown(task, options = {}) {
  const result = await fetchAPI('/breakdown', { task, options });
  if (result && result.steps && result.steps.length > 0) return result;
  return clientFallbackBreakdown(task);
}

export async function generateNextAction(task, steps, currentStepIndex) {
  const result = await fetchAPI('/next-action', { task, steps, currentStepIndex });
  if (result && result.nextAction) return result;
  
  const currentStep = steps?.[currentStepIndex];
  if (!currentStep) return { nextAction: 'Start with the first tiny step.' };
  
  const title = (currentStep.title || '').toLowerCase();
  if (title.includes('kcl example 1') || title.includes('example 1')) {
    return { nextAction: 'Write the KCL equation for the first node.' };
  }
  if (title.includes('review kcl')) {
    return { nextAction: 'Recall the core rule: sum of currents entering a node equals sum leaving.' };
  }
  if (title.includes('kcl example 2') || title.includes('example 2')) {
    return { nextAction: 'Select reference ground and identify unknown node voltages.' };
  }
  if (title.includes('review kvl')) {
    return { nextAction: 'Sum voltage drops around loop 1: equate to supplied voltage.' };
  }
  if (title.includes('kvl problem')) {
    return { nextAction: 'Trace the first clockwise loop and write node potentials.' };
  }
  
  return { nextAction: `Focus on: ${currentStep.title}` };
}

export async function generateContextSummary(task, steps, currentStepIndex, interruptionDuration) {
  const result = await fetchAPI('/context', { task, steps, currentStepIndex, interruptionDuration });
  if (result && result.summary) return result;
  
  const currentStep = steps?.[currentStepIndex];
  const completedSteps = (steps || []).slice(0, currentStepIndex).map(s => s.title);
  const minutes = Math.round((interruptionDuration || 0) / 60);
  
  const completedText = completedSteps.length > 0 
    ? `You completed ${completedSteps.join(', ')}.` 
    : 'You were getting started on your first step.';
    
  let nextAction = 'Pick up right where you left off.';
  if (currentStep) {
    const title = (currentStep.title || '').toLowerCase();
    if (title.includes('kcl example 1')) {
      nextAction = 'Write the KCL equation for the first node.';
    } else {
      nextAction = `Continue with: ${currentStep.title}`;
    }
  }

  const timeNote = minutes > 0 ? ` You stepped away for about ${minutes} minute${minutes === 1 ? '' : 's'}.` : '';

  return {
    summary: `You were working on "${task}". ${completedText}${timeNote}`,
    nextAction
  };
}

export async function generateSessionReflection(task, steps, completedSteps, duration, interruptions) {
  const result = await fetchAPI('/reflection', { task, steps, completedSteps, duration, interruptions });
  if (result && result.reflection) return result;

  const stepsText = completedSteps === 1 ? 'step' : 'steps';
  let reflection = `You worked for ${duration} minutes and completed ${completedSteps} ${stepsText}. `;
  
  if (interruptions === 0) {
    reflection += 'You stayed engaged throughout the entire session without interruption — wonderful momentum.';
  } else if (interruptions === 1) {
    reflection += 'You stayed engaged for most of this session and only had one brief interruption before recovering.';
  } else {
    reflection += `You had ${interruptions} interruptions, but you kept coming back. Recovery is the real skill.`;
  }
  
  const suggestion = 'Your next step is relatively small, so a 20-minute session may work well again.';

  return { reflection, suggestion };
}

export async function generateAdaptivePlan(sessionHistory) {
  const result = await fetchAPI('/adaptive', { sessionHistory });
  if (result && result.recommendedDuration) return result;

  if (!sessionHistory || sessionHistory.length === 0) {
    return { 
      recommendedDuration: 20, 
      reason: 'A 20-minute session is a proven sweet spot to build momentum.' 
    };
  }

  const recent = sessionHistory.slice(-5);
  const avgDuration = recent.reduce((sum, s) => sum + (s.duration || 0), 0) / recent.length;
  const avgInterruptions = recent.reduce((sum, s) => sum + (s.interruptions || 0), 0) / recent.length;

  if (avgInterruptions >= 3) {
    return {
      recommendedDuration: Math.max(10, Math.round(avgDuration * 0.75)),
      reason: 'Your recent sessions had multiple distractions. A shorter session helps protect task continuity without fatigue.'
    };
  } else if (avgDuration < 15) {
    return {
      recommendedDuration: Math.min(25, Math.round(avgDuration + 5)),
      reason: 'You are consistently completing steps! A slight step-up in duration will deepen your focus.'
    };
  }

  return {
    recommendedDuration: 20,
    reason: 'You stayed engaged for most of your session. A 20-minute session will work well again for your next step.'
  };
}

export async function checkAIHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return { status: 'offline', aiAvailable: false, mode: 'demo' };
    return await response.json();
  } catch {
    return { status: 'offline', aiAvailable: false, mode: 'demo' };
  }
}
