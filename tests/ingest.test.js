import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestSource } from '../src/engine/ingest.js';

test('ingestSource accepts pasted text without browser or network dependencies', async () => {
  const result = await ingestSource('Chapter 1\n\nLocal study notes.');
  assert.equal(result, 'Chapter 1\n\nLocal study notes.');
});
