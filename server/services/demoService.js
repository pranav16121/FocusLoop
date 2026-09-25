// Demo/fallback AI service - works without API keys

const DEMO_BREAKDOWNS = {
  default: [
    { title: 'Review the main concepts', description: 'Go through the key ideas', estimatedMinutes: 10 },
    { title: 'Work through a basic example', description: 'Apply what you reviewed', estimatedMinutes: 10 },
    { title: 'Try a slightly harder problem', description: 'Challenge yourself a bit', estimatedMinutes: 10 },
    { title: 'Review and summarize', description: 'Write down what you learned', estimatedMinutes: 5 },
  ],
  network: [
    { title: 'Review KCL', description: 'Review Kirchhoff\'s Current Law fundamentals', estimatedMinutes: 5 },
    { title: 'Solve KCL Example 1', description: 'Basic nodal analysis circuit', estimatedMinutes: 8 },
    { title: 'Solve KCL Example 2', description: 'Multi-node circuit with dependent sources', estimatedMinutes: 10 },
    { title: 'Review KVL', description: 'Review Kirchhoff\'s Voltage Law and loop equations', estimatedMinutes: 5 },
    { title: 'Solve one KVL problem', description: 'Apply mesh analysis to a two-loop circuit', estimatedMinutes: 10 },
  ],
  study: [
    { title: 'Review KCL', description: 'Review key formulas and core definitions', estimatedMinutes: 8 },
    { title: 'Solve KCL Example 1', description: 'Pick a simple problem and apply the formula', estimatedMinutes: 10 },
    { title: 'Solve KCL Example 2', description: 'Try a slightly harder example', estimatedMinutes: 12 },
    { title: 'Review KVL', description: 'Review the next concept and formulas', estimatedMinutes: 8 },
    { title: 'Solve one KVL problem', description: 'Apply the concept to a complete problem', estimatedMinutes: 10 },
  ],
  write: [
    { title: 'Brainstorm key points', description: 'List 3-5 main ideas to cover', estimatedMinutes: 5 },
    { title: 'Create a rough outline', description: 'Organize your points into sections', estimatedMinutes: 8 },
    { title: 'Write the first section', description: 'Get the first part drafted', estimatedMinutes: 15 },
    { title: 'Write the next section', description: 'Continue with the second part', estimatedMinutes: 15 },
    { title: 'Review and edit', description: 'Read through and fix issues', estimatedMinutes: 10 },
  ],
  code: [
    { title: 'Understand the requirements', description: 'Read through what needs to be built', estimatedMinutes: 5 },
    { title: 'Set up the basic structure', description: 'Create the files and boilerplate', estimatedMinutes: 8 },
    { title: 'Implement the core logic', description: 'Build the main functionality', estimatedMinutes: 15 },
    { title: 'Test with a simple case', description: 'Verify it works for a basic input', estimatedMinutes: 8 },
    { title: 'Handle edge cases', description: 'Think about what could go wrong', estimatedMinutes: 10 },
  ],
  read: [
    { title: 'Skim the material', description: 'Get a quick overview of the content', estimatedMinutes: 5 },
    { title: 'Read the first section carefully', description: 'Take your time with the beginning', estimatedMinutes: 12 },
    { title: 'Take brief notes', description: 'Jot down key takeaways so far', estimatedMinutes: 5 },
    { title: 'Continue reading the next section', description: 'Keep going through the material', estimatedMinutes: 12 },
    { title: 'Summarize what you read', description: 'Write a few sentences about what you learned', estimatedMinutes: 5 },
  ]
};

function detectCategory(task) {
  const lower = task.toLowerCase();
  if (lower.includes('network') || lower.includes('circuit') || lower.includes('kcl') || lower.includes('kvl') || lower.includes('kirchhoff')) return 'network';
  if (lower.includes('study') || lower.includes('exam') || lower.includes('review') || lower.includes('learn')) return 'network';
  if (lower.includes('write') || lower.includes('essay') || lower.includes('paper') || lower.includes('report')) return 'write';
  if (lower.includes('code') || lower.includes('program') || lower.includes('build') || lower.includes('implement') || lower.includes('debug')) return 'code';
  if (lower.includes('read') || lower.includes('chapter') || lower.includes('book') || lower.includes('article')) return 'read';
  return 'default';
}

export function demoBreakdown(task, _options = {}) {
  const category = detectCategory(task);
  const steps = DEMO_BREAKDOWNS[category].map(step => ({ ...step }));
  return { steps, mode: 'demo' };
}

export function demoNextAction(task, steps, currentStepIndex) {
  const currentStep = steps?.[currentStepIndex];
  if (!currentStep) {
    return { nextAction: 'Start with the first step of your task.' };
  }
  
  const title = (currentStep.title || '').toLowerCase();
  if (title.includes('kcl example 1') || title.includes('example 1')) {
    return { nextAction: 'Write the KCL equation for the first node.' };
  }
  if (title.includes('review kcl')) {
    return { nextAction: 'Recall the core rule: current entering a node equals current leaving.' };
  }
  if (title.includes('kcl example 2') || title.includes('example 2')) {
    return { nextAction: 'Select the reference node and label each unknown node voltage.' };
  }
  if (title.includes('review kvl')) {
    return { nextAction: 'Review loop equations: directed sum of voltage drops around any closed loop is zero.' };
  }
  if (title.includes('kvl problem') || title.includes('kvl example')) {
    return { nextAction: 'Trace the first clockwise loop and equate the sum of voltage drops to source voltages.' };
  }
  
  const actions = [
    `Focus on just the first tiny part of: ${currentStep.title}`,
    `Write down the first step or line for: ${currentStep.title}`,
    `Spend 2 calm minutes starting: ${currentStep.title}`,
  ];
  
  return { nextAction: actions[currentStepIndex % actions.length] };
}

export function demoContext(task, steps, currentStepIndex, interruptionDuration) {
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

export function demoReflection(task, steps, completedSteps, duration, interruptions) {
  const stepsText = completedSteps === 1 ? 'step' : 'steps';
  let reflection = `You worked for ${duration} minutes and completed ${completedSteps} ${stepsText}. `;
  
  if (interruptions === 0) {
    reflection += 'You stayed engaged throughout the entire session without interruption — wonderful momentum.';
  } else if (interruptions === 1) {
    reflection += 'You stayed engaged for most of this session and only had one brief interruption before recovering.';
  } else {
    reflection += `You navigated ${interruptions} interruptions and kept returning to your next step. Recovery is the real skill.`;
  }
  
  let suggestion = '';
  if (duration < 15) {
    suggestion = 'Your next step is relatively small, so a 15–20 minute session may work well again.';
  } else if (duration >= 15 && duration <= 30) {
    suggestion = 'This 20-minute rhythm looks comfortable. Ready to keep the same duration for your next step?';
  } else {
    suggestion = 'Longer sessions require more recovery energy. Consider breaking your next chunk into 15–20 minutes.';
  }
  
  return { reflection, suggestion };
}

export function demoAdaptivePlan(sessionHistory) {
  if (!sessionHistory || sessionHistory.length === 0) {
    return { recommendedDuration: 20, reason: 'Starting with 20 minutes is a proven sweet spot. We can adjust after your session.' };
  }
  
  const recent = sessionHistory.slice(-5);
  const avgDuration = recent.reduce((sum, s) => sum + (s.duration || 0), 0) / recent.length;
  const avgInterruptions = recent.reduce((sum, s) => sum + (s.interruptions || 0), 0) / recent.length;
  
  let recommended;
  let reason;
  
  if (avgInterruptions >= 3) {
    recommended = Math.max(10, Math.round(avgDuration * 0.75));
    reason = 'Recent sessions had several attention drifts. Shorter sessions make it much easier to sustain continuity without fatigue.';
  } else if (avgDuration < 15) {
    recommended = Math.min(25, Math.round(avgDuration + 5));
    reason = 'You are consistently finishing your steps. Adding 5 minutes will help you stay immersed a bit longer.';
  } else {
    recommended = 20;
    reason = 'You stayed engaged and recovered smoothly. A 20-minute session will work well for your next small step.';
  }
  
  return { recommendedDuration: Math.min(45, Math.max(10, recommended)), reason };
}
