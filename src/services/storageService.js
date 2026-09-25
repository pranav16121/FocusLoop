// Storage Service - localStorage persistence with versioning

const STORAGE_VERSION = 1;
const KEYS = {
  VERSION: 'focusloop_version',
  SETTINGS: 'focusloop_settings',
  CURRENT_SESSION: 'focusloop_current_session',
  SESSION_HISTORY: 'focusloop_session_history',
  CURRENT_TASK: 'focusloop_current_task',
};

function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function safeGet(key, defaultValue = null) {
  if (!isStorageAvailable()) return defaultValue;
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item);
  } catch {
    return defaultValue;
  }
}

function safeSet(key, value) {
  if (!isStorageAvailable()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function checkVersion() {
  const stored = safeGet(KEYS.VERSION, 0);
  if (stored < STORAGE_VERSION) {
    // Migration could happen here in future versions
    safeSet(KEYS.VERSION, STORAGE_VERSION);
  }
}

// Initialize
checkVersion();

// Settings
const DEFAULT_SETTINGS = {
  focusDuration: 20,
  shortBreakDuration: 5,
  inactivityThreshold: 180, // seconds
  tabAwayThreshold: 10, // seconds before showing return prompt
  soundEnabled: true,
  theme: 'system', // 'light', 'dark', 'system'
  gentleInterventions: true,
  showStreak: true,
};

export function getSettings() {
  const stored = safeGet(KEYS.SETTINGS, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(settings) {
  return safeSet(KEYS.SETTINGS, settings);
}

// Current Task & Session
export function getCurrentTask() {
  return safeGet(KEYS.CURRENT_TASK, null);
}

export function saveCurrentTask(task) {
  return safeSet(KEYS.CURRENT_TASK, task);
}

export function clearCurrentTask() {
  if (!isStorageAvailable()) return;
  try { localStorage.removeItem(KEYS.CURRENT_TASK); } catch {}
}

export function getCurrentSession() {
  return safeGet(KEYS.CURRENT_SESSION, null);
}

export function saveCurrentSession(session) {
  return safeSet(KEYS.CURRENT_SESSION, session);
}

export function clearCurrentSession() {
  if (!isStorageAvailable()) return;
  try { localStorage.removeItem(KEYS.CURRENT_SESSION); } catch {}
}

// Session History
export function getSessionHistory() {
  return safeGet(KEYS.SESSION_HISTORY, []);
}

export function addSessionToHistory(session) {
  const history = getSessionHistory();
  history.push({
    ...session,
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    savedAt: new Date().toISOString(),
  });
  // Keep last 100 sessions
  if (history.length > 100) history.splice(0, history.length - 100);
  return safeSet(KEYS.SESSION_HISTORY, history);
}

export function clearAllData() {
  if (!isStorageAvailable()) return;
  Object.values(KEYS).forEach(key => {
    try { localStorage.removeItem(key); } catch {}
  });
}
