// "Revisit this topic" reminders at 1 / 3 / 7 / 14 days.
// Entry shape: { id, topicId, title, task, level (1-4), nextDueAt, lastReviewedAt, createdAt }
const INTERVALS = [1, 3, 7, 14];

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dueIn(days, from) {
  const due = startOfDay(from);
  due.setDate(due.getDate() + days);
  return due.toISOString();
}

export function createReminder({ id, topicId, title, task = '' }, now = new Date()) {
  return {
    id: id || `revisit-${topicId || title}`,
    topicId: topicId || null,
    title,
    task,
    level: 1,
    nextDueAt: dueIn(INTERVALS[0], now),
    lastReviewedAt: null,
    createdAt: new Date(now).toISOString(),
  };
}

// "Reviewed": advance to the next interval. Returns null after the 14-day review (done).
export function markReviewed(entry, now = new Date()) {
  const level = (entry.level || 1) + 1;
  if (level > INTERVALS.length) return null;
  return { ...entry, level, lastReviewedAt: new Date(now).toISOString(), nextDueAt: dueIn(INTERVALS[level - 1], now) };
}

// "Later": snooze for one day without changing the interval.
export function snoozeReminder(entry, now = new Date()) {
  return { ...entry, nextDueAt: dueIn(1, now) };
}

// Adds a reminder unless one already exists for the same id.
export function upsertReminder(schedule, entry) {
  const list = Array.isArray(schedule) ? schedule : [];
  return list.some(item => item.id === entry.id) ? list : [...list, entry];
}

export function getDueReviews(schedule, now = new Date()) {
  const today = startOfDay(now).getTime();
  return (schedule || []).filter(card => card.nextDueAt && startOfDay(card.nextDueAt).getTime() <= today);
}

// Converts pre-v4 recall-card entries into reminders (one per topic, ratings dropped).
export function toReminders(entries) {
  const byId = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || typeof entry !== 'object') continue;
    const title = entry.title || entry.topicTitle || String(entry.prompt || '').match(/"([^"]+)"/)?.[1] || entry.topicId || 'Saved topic';
    const id = entry.topicId ? `revisit-${entry.topicId}` : (String(entry.id || '').startsWith('revisit-') ? entry.id : `revisit-${entry.id || title}`);
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      topicId: entry.topicId || null,
      title,
      task: entry.task || '',
      level: Math.min(INTERVALS.length, Math.max(1, Number(entry.level) || 1)),
      nextDueAt: entry.nextDueAt || dueIn(1, new Date()),
      lastReviewedAt: entry.lastReviewedAt || null,
      createdAt: entry.createdAt || entry.lastReviewedAt || new Date().toISOString(),
    });
  }
  return [...byId.values()];
}

export { INTERVALS };
