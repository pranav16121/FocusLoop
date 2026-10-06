const TYPE_RULES = [
  { type: 'DEFINITION', pattern: /\b(is defined as|defined as|means|refers to|is known as)\b/i },
  { type: 'DERIVATION', pattern: /\b(derive|derivation|proof|prove|therefore)\b/i },
  { type: 'EXAMPLE', pattern: /\b(example|illustration|worked example)\b/i },
  { type: 'PROBLEM', pattern: /\b(solve|calculate|find|determine|exercise|problem)\b/i },
  { type: 'FORMULA', pattern: /(?:=|\+|-|\/|\^|\u2211|\u222b).*(?:=|[A-Za-z])|\b(formula|equation)\b/i },
];

export function classifyChunk(title, text) {
  const combined = `${title} ${text}`;
  const match = TYPE_RULES.find(rule => rule.pattern.test(combined));
  return match?.type || 'THEORY';
}

export { TYPE_RULES };
