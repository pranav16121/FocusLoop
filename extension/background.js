const HOST = 'com.focusloop.companion';
const state = { active: false, paused: false, referenceMode: false, sessionId: null, activeTabId: null, awayAt: null, faceAwayAt: null, headAwayAt: null, trustedSites: [], camera: 'stopped', companion: 'disconnected', port: null };
const valid = m => m && typeof m === 'object' && ['FOCUSLOOP_HELLO', 'FOCUSLOOP_SESSION', 'FOCUSLOOP_STATUS'].includes(m.type) && (!m.payload || typeof m.payload === 'object');
async function ensureOffscreen() { if (!(await chrome.offscreen.hasDocument())) await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['USER_MEDIA'], justification: 'Run an explicitly enabled, local-only camera pipeline while the FocusLoop tab is backgrounded.' }); }
async function broadcast(payload) { const tabs = await chrome.tabs.query({ url: ['http://localhost:5173/*', 'http://127.0.0.1:5173/*'] }); tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'FOCUSLOOP_SIGNAL', payload }).catch(() => {})); }
function signal(extra = {}) { broadcast({ ...extra, sessionId: state.sessionId, tabAwayMs: state.awayAt ? Date.now() - state.awayAt : 0, faceMissingMs: state.faceAwayAt ? Date.now() - state.faceAwayAt : 0, headAwayMs: state.headAwayAt ? Date.now() - state.headAwayAt : 0, camera: state.camera, companion: state.companion }); }
function hostMessage(message) { try { state.port?.postMessage(message); } catch { disconnectHost(); } }
function disconnectHost() { state.port = null; state.companion = 'disconnected'; signal(); }
function connectHost() {
  if (state.port || !state.active) return;
  try {
    const port = chrome.runtime.connectNative(HOST); state.port = port; state.companion = 'connecting'; signal();
    port.onMessage.addListener(message => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'status') { state.companion = message.status || 'connected'; signal(); }
      if (message.type === 'foreground-app' && typeof message.application === 'string') signal({ app: message.application, appAwayMs: message.awayMs || 0 });
    });
    port.onDisconnect.addListener(() => disconnectHost());
    hostMessage({ type: 'start', sessionId: state.sessionId });
  } catch { disconnectHost(); }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!valid(message) || (sender.id && sender.id !== chrome.runtime.id)) { respond({ ok: false }); return; }
  if (message.type === 'FOCUSLOOP_SESSION') {
    Object.assign(state, message.payload || {}); state.activeTabId = sender.tab?.id ?? state.activeTabId; state.trustedSites = message.payload?.settings?.trustedSites || state.trustedSites;
    (async () => { if (state.active && !state.paused) { await ensureOffscreen(); chrome.runtime.sendMessage({ type: 'CAMERA_START', settings: message.payload?.settings || {} }); connectHost(); hostMessage({ type: 'resume', sessionId: state.sessionId }); } else { chrome.runtime.sendMessage({ type: 'CAMERA_STOP' }); hostMessage({ type: state.active ? 'pause' : 'stop', sessionId: state.sessionId }); } respond({ ok: true, camera: state.camera, companion: state.companion }); })(); return true;
  }
  respond({ ok: true });
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => { const tab = await chrome.tabs.get(tabId); const trusted = state.trustedSites.includes(new URL(tab.url || 'https://invalid').hostname); if (state.active && !trusted) state.awayAt = tabId === state.activeTabId ? null : (state.awayAt || Date.now()); signal({ tabId, trusted }); });
chrome.tabs.onUpdated.addListener((tabId, _, tab) => { if (tab.active) state.activeTabId = tabId; });
chrome.windows.onFocusChanged.addListener(id => { if (state.active) { state.awayAt = id === chrome.windows.WINDOW_ID_NONE ? (state.awayAt || Date.now()) : null; signal({ browserFocused: id !== chrome.windows.WINDOW_ID_NONE }); } });
chrome.runtime.onMessage.addListener((m, sender) => { if (sender.url?.endsWith('offscreen.html') && m?.type === 'CAMERA_SIGNAL') { state.camera = m.payload?.camera || state.camera; state.faceAwayAt = m.payload?.faceMissingMs ? (state.faceAwayAt || Date.now()) : null; state.headAwayAt = m.payload?.headAwayMs ? (state.headAwayAt || Date.now()) : null; signal(m.payload); } });
chrome.runtime.onStartup.addListener(() => { state.camera = 'stopped'; state.companion = 'disconnected'; });
