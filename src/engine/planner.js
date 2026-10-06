function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

export function buildExamPlan(topics, examDate, hoursPerDay, now = new Date()) {
  const dailyMinutes = Math.max(30, Math.round((Number(hoursPerDay) || 1) * 60));
  const remaining = (topics || []).filter(topic => !topic.completed && topic.status !== 'COMPLETE');
  const totalMinutes = remaining.reduce((sum, topic) => sum + (topic.estimatedMinutes || 0), 0);
  const days = daysBetween(now, examDate);
  const plan = [];
  let topicIndex = 0;
  let remainingForDay = dailyMinutes;

  for (let dayIndex = 0; dayIndex < days && topicIndex < remaining.length; dayIndex += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayIndex);
    const topicsForDay = [];
    remainingForDay = dailyMinutes;
    while (topicIndex < remaining.length && (remainingForDay >= remaining[topicIndex].estimatedMinutes || topicsForDay.length === 0)) {
      const topic = remaining[topicIndex];
      topicsForDay.push(topic.id || topic.topicId || topic.title);
      remainingForDay -= topic.estimatedMinutes || 0;
      topicIndex += 1;
      if (remainingForDay <= 0) break;
    }
    plan.push({ date: dateKey(date), topics: topicsForDay, minutes: dailyMinutes - Math.max(0, remainingForDay) });
  }

  return {
    examDate: dateKey(examDate),
    hoursPerDay: Number(hoursPerDay) || 1,
    totalMinutes,
    daysAvailable: days,
    dailyMinutes,
    days: plan,
    adjusted: false,
  };
}

export function rebalanceExamPlan(plan, topics, now = new Date()) {
  const today = dateKey(now);
  const futureDays = (plan?.days || []).filter(day => day.date >= today);
  const remainingTopics = (topics || []).filter(topic => !topic.completed && topic.status !== 'COMPLETE');
  const rebuilt = buildExamPlan(remainingTopics, plan?.examDate || today, plan?.hoursPerDay || 1, now);
  return { ...rebuilt, adjusted: futureDays.length !== (plan?.days || []).length };
}

export { dateKey };
