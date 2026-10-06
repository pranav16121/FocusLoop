import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() { this.values = new Map([['focusloop_version', '3'], ['focusloop_settings', JSON.stringify({ aiEnabled: false, mode: 'local' })]]); }
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('Local mode makes zero fetch calls across client AI wrappers', async () => {
  globalThis.localStorage = new MemoryStorage();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('Network call in Local mode'); };
  const service = await import('../src/services/aiService.js?local-network-proof');
  await service.generateTaskBreakdown('Study signals');
  await service.generateNextAction('Study signals', [], 0);
  await service.generateContextSummary('Study signals', [], 0, 30);
  await service.generateSessionReflection('Study signals', [], 0, 10, 0);
  await service.generateAdaptivePlan([]);
  assert.equal(calls, 0);
});
