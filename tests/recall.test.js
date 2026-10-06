import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRecallCards, rateRecallCard } from '../src/engine/recall.js';

test('recall generator creates local cloze and state cards', () => {
  const cards = generateRecallCards({
    id: 'law-1',
    title: 'Current Law',
    type: 'DEFINITION',
    text: 'Current is defined as the flow of charge through a conductor.',
  });
  assert.ok(cards.some(card => card.kind === 'cloze'));
  assert.ok(cards.some(card => card.kind === 'state'));
  assert.equal(rateRecallCard(cards[0], 'got-it').status, 'got-it');
});
