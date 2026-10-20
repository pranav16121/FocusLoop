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
  assert.equal(storage.getSessionDefaults(storage.getCurrentSession()).recallCards, undefined);
  assert.equal(storage.getCurrentTask().studyPlan, null);
  assert.ok(localStorage.getItem('focusloop_backup_v1'));
  assert.equal(JSON.parse(localStorage.getItem('focusloop_version')), 4);
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

test('migration backup is not overwritten on a second attempt', async () => {
  const storage = await loadStorage({
    focusloop_version: '1',
    focusloop_settings: JSON.stringify({ focusDuration: 25 }),
  }, 'backup-first');
  const firstBackup = localStorage.getItem('focusloop_backup_v1');
  localStorage.setItem('focusloop_version', '1');
  localStorage.setItem('focusloop_settings', JSON.stringify({ focusDuration: 45 }));
  await import('../src/services/storageService.js?fixture=backup-second');
  assert.equal(localStorage.getItem('focusloop_backup_v1'), firstBackup);
  assert.equal(storage.getSettings().focusDuration, 45);
});

test('unknown future schema versions are left untouched', async () => {
  globalThis.localStorage = new MemoryStorage({
    focusloop_version: '99',
    focusloop_settings: '{future-format}',
  });
  await import('../src/services/storageService.js?fixture=future');
  assert.equal(localStorage.getItem('focusloop_version'), '99');
  assert.equal(localStorage.getItem('focusloop_settings'), '{future-format}');
});

test('v3 to v4 drops recall decks and ratings and converts revision entries (with backup)', async () => {
  const oldCards = [
    { id: 'topic-1-state', topicId: 'topic-1', kind: 'state', prompt: 'State the law or theorem in "Kirchhoff\'s laws" in your own words.', answer: 'x', level: 2, rating: 'got-it', nextDueAt: '2026-01-05T00:00:00.000Z' },
    { id: 'topic-1-why', topicId: 'topic-1', kind: 'why', prompt: 'Why?', answer: 'y', level: 1, rating: 'missed', nextDueAt: '2026-01-02T00:00:00.000Z' },
  ];
  const storage = await loadStorage({
    focusloop_version: '3',
    focusloop_current_task: JSON.stringify({ task: 'Circuits', steps: [], recallCards: oldCards }),
    focusloop_session_history: JSON.stringify([{ task: 'Circuits', recallCards: oldCards, revisionSchedule: [] }]),
    focusloop_revision_schedule: JSON.stringify(oldCards),
  }, 'v3-to-v4');
  assert.ok(localStorage.getItem('focusloop_backup_v3'));
  assert.equal(JSON.parse(localStorage.getItem('focusloop_version')), 4);
  assert.equal(storage.getCurrentTask().recallCards, undefined);
  assert.equal(storage.getSessionHistory()[0].recallCards, undefined);
  const schedule = storage.getRevisionSchedule();
  assert.equal(schedule.length, 1, 'one reminder per topic');
  assert.equal(schedule[0].title, "Kirchhoff's laws");
  assert.equal(schedule[0].level, 2);
  assert.equal(schedule[0].rating, undefined);
});

test('old (v3) backups still import into the simplified shape', async () => {
  const storage = await loadStorage({ focusloop_version: '4' }, 'import-v3');
  storage.importData({
    schemaVersion: 3,
    sessionHistory: [{ task: 'Old', recallCards: [{ id: 'c' }] }],
    revisionSchedule: [{ id: 'topic-9-cloze', topicId: 'topic-9', prompt: 'Fill the blank', level: 1, nextDueAt: '2026-01-01T00:00:00.000Z' }],
  });
  assert.equal(storage.getSessionHistory()[0].recallCards, undefined);
  assert.deepEqual(storage.getRevisionSchedule().map(entry => entry.id), ['revisit-topic-9']);
});
