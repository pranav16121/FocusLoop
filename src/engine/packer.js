export function packSessions(topics, sessionMinutes) {
  const sessions = [];
  let current = null;

  topics.forEach(topic => {
    if (!current || current.minutes + topic.estimatedMinutes > sessionMinutes) {
      current = { id: `session-${sessions.length + 1}`, minutes: 0, topics: [] };
      sessions.push(current);
    }
    current.topics.push(topic.id);
    current.minutes += topic.estimatedMinutes;
  });

  return sessions;
}
