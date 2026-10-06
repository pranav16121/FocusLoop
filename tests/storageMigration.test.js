import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

async function loadStorage(seed, suffix) {
  globalThis.localStorage = new MemoryStorage(seed);
  return import(`../src/services/storageService.js?fixture=${suffix}`);
}

test('migrates v1 settings and session data to v2 with a backup', async () => {
  const storage = await loadStorage({
    focusloop_version: '1',
    focusloop_settings: JSON.stringify({ focusDuration: 25 }),
    focusloop_current_session: JSON.stringify({ state: 'focus', duration: 25 }),
    focusloop_current_task: JSON.stringify({ task: 'Study', steps: [] }),
  }, 'v1');

  assert.equal(storage.getSettings().focusDuration, 25);
  assert.equal(storage.getSettings().mode, 'local');
  assert.deepEqual(storage.getSessionDefaults(storage.getCurrentSession()).recallCards, []);
  assert.equal(storage.getCurrentTask().studyPlan, null);
  assert.ok(localStorage.getItem('focusloop_backup_v1'));
  assert.equal(JSON.parse(localStorage.getItem('focusloop_version')), 3);
});

test('corrupted JSON falls back safely and preserves a backup', async () => {
  const storage = await loadStorage({
    focusloop_version: '1',
    focusloop_settings: '{broken-json',
  }, 'corrupt');

  assert.equal(storage.getSettings().mode, 'local');
  assert.deepEqual(storage.getCurrentTask(), null);
  assert.ok(localStorage.getItem('focusloop_backup_v1'));
});
