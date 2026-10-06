const STOP_WORDS = new Set(['about', 'after', 'again', 'because', 'before', 'being', 'could', 'first', 'from', 'have', 'into', 'more', 'other', 'should', 'that', 'their', 'there', 'these', 'they', 'this', 'those', 'through', 'using', 'what', 'when', 'which', 'with', 'would']);

function topTerms(text, limit = 3) {
  const counts = new Map();
  (text.toLowerCase().match(/[a-z][a-z-]{4,}/g) || []).forEach(word => {
    if (!STOP_WORDS.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([word]) => word);
}

function definitionSentence(text) {
  return text.split(/(?<=[.!?])\s+/).find(sentence => /\b(is defined as|defined as|means|refers to|is known as)\b/i.test(sentence)) || null;
}

export function generateRecallCards(topic) {
  if (!topic) return [];
  const cards = [];
  const source = `${topic.title}. ${topic.text || topic.description || ''}`;
  const definition = definitionSentence(source);
  const terms = topTerms(source);
  if (definition && terms[0]) {
    const term = terms[0];
    cards.push({
      id: `${topic.topicId || topic.id || 'topic'}-cloze`,
      topicId: topic.topicId || topic.id,
      kind: 'cloze',
      prompt: definition.replace(new RegExp(`\\b${term}\\b`, 'i'), '_____'),
      answer: term,
      status: 'new',
    });
  }
  if (/\b(law|theorem|principle)\b/i.test(topic.title) || topic.type === 'DEFINITION') {
    cards.push({
      id: `${topic.topicId || topic.id || 'topic'}-state`,
      topicId: topic.topicId || topic.id,
      kind: 'state',
      prompt: `State the law or theorem in "${topic.title}" in your own words.`,
      answer: topic.text || topic.description || topic.title,
      status: 'new',
    });
  }
  if (topic.type === 'DERIVATION' || topic.type === 'THEORY' || cards.length === 0) {
    cards.push({
      id: `${topic.topicId || topic.id || 'topic'}-why`,
      topicId: topic.topicId || topic.id,
      kind: 'explain',
      prompt: `Explain why "${topic.title}" works, and name one consequence.`,
      answer: topic.text || topic.description || 'Review the topic and explain its main idea.',
      status: 'new',
    });
  }
  return cards;
}

export function rateRecallCard(card, rating) {
  return { ...card, status: rating, lastReviewedAt: new Date().toISOString() };
}
