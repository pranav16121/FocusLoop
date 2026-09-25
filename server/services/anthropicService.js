import Anthropic from '@anthropic-ai/sdk';

const getClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
};

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

const callAI = async (systemPrompt, userMessage) => {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });
  
  const text = response.content[0].text;
  
  // Try to parse as JSON
  try {
    // Look for JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch {
    return { text };
  }
};

export async function generateBreakdown(task, options = {}) {
  const systemPrompt = `You are a supportive task breakdown assistant. Break a user's goal into small, concrete actions that can each be started immediately. Do not give motivational speeches. Do not diagnose mental health conditions. Avoid overwhelming lists. Return 3-7 steps.

Respond with ONLY valid JSON in this format:
{
  "steps": [
    { "title": "Step title", "description": "Brief description", "estimatedMinutes": 5 }
  ]
}`;
  
  let userMsg = `Break down this task into small, actionable steps: "${task}"`;
  if (options.difficulty) userMsg += `\nDifficulty level: ${options.difficulty}`;
  if (options.duration) userMsg += `\nAvailable time: ${options.duration} minutes`;
  
  const result = await callAI(systemPrompt, userMsg);
  return { steps: result.steps || [], mode: 'ai' };
}

export async function generateNextAction(task, steps, currentStepIndex) {
  const systemPrompt = `You are a supportive focus assistant. Given a task and current progress, suggest one single concrete next action the user can take right now. Be specific and actionable. Keep it to 1-2 sentences.

Respond with ONLY valid JSON: { "nextAction": "..." }`;
  
  const currentStep = steps[currentStepIndex];
  const userMsg = `Task: "${task}"\nCurrent step: "${currentStep?.title || 'Unknown'}"\nProgress: Step ${currentStepIndex + 1} of ${steps.length}\nWhat's one tiny thing they can do right now?`;
  
  const result = await callAI(systemPrompt, userMsg);
  return { nextAction: result.nextAction || 'Continue working on the current step.' };
}

export async function generateContext(task, steps, currentStepIndex, interruptionDuration) {
  const systemPrompt = `You are a supportive focus companion helping someone return after an interruption. Summarize where they are in their task and what they should do next. Be warm and brief. Never shame them for being distracted. Use language like "Welcome back" and "Ready to continue?".

Respond with ONLY valid JSON: { "summary": "...", "nextAction": "..." }`;
  
  const completedSteps = steps.slice(0, currentStepIndex).map(s => s.title);
  const currentStep = steps[currentStepIndex];
  const userMsg = `Task: "${task}"\nCompleted: ${completedSteps.join(', ') || 'Nothing yet'}\nCurrent step: "${currentStep?.title || 'Unknown'}"\nThey were away for about ${Math.round(interruptionDuration / 60)} minutes.\nHelp them pick up where they left off.`;
  
  const result = await callAI(systemPrompt, userMsg);
  return { summary: result.summary || '', nextAction: result.nextAction || '' };
}

export async function generateReflection(task, steps, completedSteps, duration, interruptions) {
  const systemPrompt = `You are a supportive focus companion. Give a brief, nonjudgmental reflection on a completed focus session. Note what went well. If there were interruptions, frame them neutrally. Never diagnose, never shame. 2-3 sentences max.

Respond with ONLY valid JSON: { "reflection": "...", "suggestion": "..." }`;
  
  const userMsg = `Task: "${task}"\nSession duration: ${duration} minutes\nSteps completed: ${completedSteps} of ${steps.length}\nInterruptions: ${interruptions}\nGive a brief reflection.`;
  
  const result = await callAI(systemPrompt, userMsg);
  return { reflection: result.reflection || '', suggestion: result.suggestion || '' };
}

export async function generateAdaptivePlan(sessionHistory) {
  const systemPrompt = `You are a supportive focus companion. Based on recent session history, recommend a reasonable next session duration and approach. Be practical, not motivational. If sessions are often cut short, suggest shorter ones. If they go well, maintain or slightly increase.

Respond with ONLY valid JSON: { "recommendedDuration": 20, "reason": "..." }`;
  
  const recent = (sessionHistory || []).slice(-5);
  const userMsg = `Recent sessions:\n${recent.map(s => `- Duration: ${s.duration}min, Completed: ${s.completedSteps}/${s.totalSteps} steps, Interruptions: ${s.interruptions}`).join('\n')}\n\nWhat duration and approach would you recommend for the next session?`;
  
  const result = await callAI(systemPrompt, userMsg);
  return { recommendedDuration: result.recommendedDuration || 20, reason: result.reason || '' };
}
