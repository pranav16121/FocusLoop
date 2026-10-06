const INTERVALS = [1, 3, 7, 14];

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function scheduleNextReview(card, rating, reviewedAt = new Date()) {
  const level = rating === 'got-it'
    ? Math.min(INTERVALS.length, (card.level || 0) + 1)
    : rating === 'almost'
      ? Math.max(1, Math.min(INTERVALS.length, card.level || 1))
      : 1;
  const nextDue = startOfDay(reviewedAt);
  nextDue.setDate(nextDue.getDate() + INTERVALS[level - 1]);
  return {
    ...card,
    level,
    rating,
    lastReviewedAt: new Date(reviewedAt).toISOString(),
    nextDueAt: nextDue.toISOString(),
  };
}

export function getDueReviews(schedule, now = new Date()) {
  const today = startOfDay(now).getTime();
  return (schedule || []).filter(card => card.nextDueAt && startOfDay(card.nextDueAt).getTime() <= today);
}

export function createRevisionSchedule(cards, now = new Date()) {
  return (cards || []).map(card => scheduleNextReview({ ...card, level: 0 }, 'missed', now));
}

export { INTERVALS };
