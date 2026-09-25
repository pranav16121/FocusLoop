export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function formatRelativeTime(seconds) {
  if (seconds < 60) return 'less than a minute';
  if (seconds < 120) return 'about a minute';
  if (seconds < 3600) return `about ${Math.round(seconds / 60)} minutes`;
  if (seconds < 7200) return 'about an hour';
  return `about ${Math.round(seconds / 3600)} hours`;
}

export function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 86400000 && date.getDate() === now.getDate()) {
    return 'Today';
  }
  if (diff < 172800000) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
