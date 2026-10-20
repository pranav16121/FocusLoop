const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

function getApiKey() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  return process.env.GEMINI_API_KEY;
}

function parseJson(text) {
  const cleaned = String(text || '').replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini returned no JSON');
  return JSON.parse(jsonMatch[0]);
}

export async function generateStudyPlan(materialText, options = {}) {
  const apiKey = getApiKey();
  const prompt = `Read the study material below and create a focused study plan. Identify the most important concepts, what the learner should understand or practice, and a sensible order. Be accurate to the material; do not invent facts. Keep the plan to 3-12 topics.

Return ONLY valid JSON in this shape:
{
  "summary": "2-4 sentence plain-language summary of what this material covers",
  "studyAdvice": "1-3 sentences about how to study it effectively",
  "topics": [
    {
      "title": "Concept or skill",
      "description": "What to learn or practice",
      "estimatedMinutes": 15,
      "type": "THEORY",
      "complexity": 3,
      "importance": 5,
      "nextAction": "One concrete first action"
    }
  ]
}

Use one of these topic types: THEORY, DEFINITION, DERIVATION, EXAMPLE, PRACTICE, REVIEW.
Available session duration: ${Number(options.duration) || 20} minutes.
${options.syllabusText ? `Additional syllabus or exam context:\n${options.syllabusText}\n` : ''}
Study material:\n${materialText}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
  });

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
  const result = parseJson(text);
  if (!Array.isArray(result.topics) || result.topics.length === 0) throw new Error('Gemini returned no study topics');
  return {
    summary: String(result.summary || '').trim(),
    studyAdvice: String(result.studyAdvice || '').trim(),
    topics: result.topics.slice(0, 12).map((topic, index) => ({
      title: String(topic.title || `Topic ${index + 1}`).trim(),
      description: String(topic.description || 'Review this concept from the imported material.').trim(),
      estimatedMinutes: Math.min(180, Math.max(1, Number(topic.estimatedMinutes) || 10)),
      type: String(topic.type || 'THEORY').toUpperCase(),
      complexity: Math.min(5, Math.max(1, Number(topic.complexity) || 3)),
      importance: Math.min(5, Math.max(1, Number(topic.importance) || 3)),
      nextAction: String(topic.nextAction || 'Write down what you remember before checking the material.').trim(),
    })),
    mode: 'gemini',
  };
}