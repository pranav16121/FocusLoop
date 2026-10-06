// Storage Service - localStorage persistence with versioning

const STORAGE_VERSION = 3;
const KEYS = {
  VERSION: 'focusloop_version',
  SETTINGS: 'focusloop_settings',
  CURRENT_SESSION: 'focusloop_current_session',
  SESSION_HISTORY: 'focusloop_session_history',
  CURRENT_TASK: 'focusloop_current_task',
  REVISION_SCHEDULE: 'focusloop_revision_schedule',
  EXAM_PLAN: 'focusloop_exam_plan',
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

function readRaw(key) {
  if (!isStorageAvailable()) return { exists: false, value: null };
  const raw = localStorage.getItem(key);
  if (raw === null) return { exists: false, value: null };
  try {
    return { exists: true, value: JSON.parse(raw) };
  } catch {
    return { exists: true, value: null, corrupted: true };
  }
}

function backupStorage(version) {
  if (!isStorageAvailable()) return null;
  const backup = {};
  Object.entries(KEYS).forEach(([name, key]) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) backup[name] = raw;
  });
  safeSet(`focusloop_backup_v${version}`, backup);
  return backup;
}

function restoreBackup(backup) {
  if (!backup || !isStorageAvailable()) return;
  Object.entries(backup).forEach(([name, raw]) => {
    const key = KEYS[name];
    if (!key) return;
    try {
      JSON.parse(raw);
      localStorage.setItem(key, raw);
    } catch {
      localStorage.removeItem(key);
    }
  });
}

function migrateV1ToV2() {
  const settings = safeGet(KEYS.SETTINGS, {});
  saveSettings({
    ...settings,
    mode: settings.mode || 'local',
    energy: settings.energy || 'medium',
  });

  const currentSession = safeGet(KEYS.CURRENT_SESSION, null);
  if (currentSession) {
    saveCurrentSession({
      ...currentSession,
      studyPlan: currentSession.studyPlan || null,
      recallCards: currentSession.recallCards || [],
      revisionSchedule: currentSession.revisionSchedule || [],
      examPlan: currentSession.examPlan || null,
    });
  }

  const currentTask = safeGet(KEYS.CURRENT_TASK, null);
  if (currentTask) {
    saveCurrentTask({
      ...currentTask,
      studyPlan: currentTask.studyPlan || null,
    });
  }

  const history = safeGet(KEYS.SESSION_HISTORY, []);
  if (Array.isArray(history)) {
    safeSet(KEYS.SESSION_HISTORY, history.map(record => ({
      ...record,
      studyPlan: record.studyPlan || null,
      recallCards: record.recallCards || [],
      revisionSchedule: record.revisionSchedule || [],
      examPlan: record.examPlan || null,
    })));
  }
}

function migrateV2ToV3() {
  const settings = safeGet(KEYS.SETTINGS, {});
  saveSettings({
    ...settings,
    energy: settings.energy || 'medium',
    mode: settings.mode || 'local',
  });

  const migrateRecord = (record) => record ? ({
    ...record,
    studyPlan: record.studyPlan || null,
    recallCards: record.recallCards || [],
    revisionSchedule: record.revisionSchedule || [],
    examPlan: record.examPlan || null,
  }) : record;

  const currentTask = safeGet(KEYS.CURRENT_TASK, null);
  if (currentTask) saveCurrentTask(migrateRecord(currentTask));
  const currentSession = safeGet(KEYS.CURRENT_SESSION, null);
  if (currentSession) saveCurrentSession(migrateRecord(currentSession));
  const history = safeGet(KEYS.SESSION_HISTORY, []);
  if (Array.isArray(history)) safeSet(KEYS.SESSION_HISTORY, history.map(migrateRecord));
  if (!Array.isArray(safeGet(KEYS.REVISION_SCHEDULE, null))) safeSet(KEYS.REVISION_SCHEDULE, []);
}

function migrateStorage() {
  const versionRecord = readRaw(KEYS.VERSION);
  const storedVersion = versionRecord.corrupted ? 0 : Number(versionRecord.value || 0);
  if (storedVersion >= STORAGE_VERSION) return;

  const backup = backupStorage(storedVersion);
  try {
    for (let version = storedVersion; version < STORAGE_VERSION; version += 1) {
      if (version === 0 || version === 1) migrateV1ToV2();
      if (version === 2) migrateV2ToV3();
    }
    safeSet(KEYS.VERSION, STORAGE_VERSION);
  } catch (error) {
    console.error('FocusLoop storage migration failed:', error);
    restoreBackup(backup);
    safeSet(KEYS.VERSION, STORAGE_VERSION);
  }
}

// Initialize
migrateStorage();

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
  aiEnabled: false,
  contextSnapshotInterval: 300,
  mode: 'local',
  energy: 'medium',
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

export function getSessionDefaults(session = {}) {
  return {
    referenceMode: false,
    parkingLot: [],
    snapshots: [],
    studyPlan: null,
    recallCards: [],
    revisionSchedule: [],
    examPlan: null,
    ...session,
  };
}

export function clearCurrentSession() {
  if (!isStorageAvailable()) return;
  try { localStorage.removeItem(KEYS.CURRENT_SESSION); } catch {}
}

export function getRevisionSchedule() {
  return safeGet(KEYS.REVISION_SCHEDULE, []);
}

export function saveRevisionSchedule(schedule) {
  return safeSet(KEYS.REVISION_SCHEDULE, schedule);
}

export function getExamPlan() {
  return safeGet(KEYS.EXAM_PLAN, null);
}

export function saveExamPlan(plan) {
  return safeSet(KEYS.EXAM_PLAN, plan);
}

export function exportData() {
  return {
    schemaVersion: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    currentTask: getCurrentTask(),
    currentSession: getCurrentSession(),
    sessionHistory: getSessionHistory(),
    revisionSchedule: getRevisionSchedule(),
    examPlan: getExamPlan(),
  };
}

export function importData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.sessionHistory || [])) {
    throw new Error('This backup file is not a valid FocusLoop backup.');
  }
  backupStorage(STORAGE_VERSION);
  if (data.settings && typeof data.settings === 'object') saveSettings(data.settings);
  if (data.currentTask) saveCurrentTask(data.currentTask);
  if (data.currentSession) saveCurrentSession(data.currentSession);
  safeSet(KEYS.SESSION_HISTORY, data.sessionHistory);
  saveRevisionSchedule(Array.isArray(data.revisionSchedule) ? data.revisionSchedule : []);
  saveExamPlan(data.examPlan || null);
  safeSet(KEYS.VERSION, STORAGE_VERSION);
  return true;
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
