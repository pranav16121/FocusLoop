// Pure, local-only attention signal combiner. It deliberately reports signals,
// never a conclusion about what somebody is thinking.
export const FOCUS_STATES = Object.freeze({ DISABLED: 'disabled', INITIALIZING: 'initializing', MONITORING: 'monitoring', POSSIBLE_SHIFT: 'possible-attention-shift', RECOVERY: 'recovery-suggested', PAUSED: 'paused', PERMISSION: 'permission-required', UNAVAILABLE: 'temporarily-unavailable' });

export const DEFAULT_FOCUS_CONFIG = Object.freeze({
  sustainedMs: 30000, recoveryMs: 60000, cooldownMs: 180000, sensitivity: 'balanced',
});

export function createFocusEngine(config = {}) {
  const options = { ...DEFAULT_FOCUS_CONFIG, ...config };
  let state = FOCUS_STATES.DISABLED, candidateAt = 0, cooldownUntil = 0, lastKey = '';
  const emit = (next, reason, now) => ({ state: next, changed: next !== state, reason, at: now });
  return {
    getState: () => state,
    reset() { state = FOCUS_STATES.DISABLED; candidateAt = 0; cooldownUntil = 0; lastKey = ''; },
    update(signal = {}, now = Date.now()) {
      if (signal.enabled === false) { state = FOCUS_STATES.DISABLED; return emit(state, 'disabled', now); }
      if (signal.paused) { state = FOCUS_STATES.PAUSED; candidateAt = 0; return emit(state, 'paused', now); }
      if (signal.availability === 'permission') { state = FOCUS_STATES.PERMISSION; return emit(state, 'camera-permission-required', now); }
      if (signal.availability === 'unavailable') { state = FOCUS_STATES.UNAVAILABLE; return emit(state, 'signal-unavailable', now); }
      if (signal.initializing) { state = FOCUS_STATES.INITIALIZING; return emit(state, 'initializing', now); }
      const concerning = !signal.referenceMode && (signal.tabAwayMs >= options.recoveryMs || signal.appAwayMs >= options.recoveryMs || signal.headAwayMs >= options.sustainedMs || signal.faceMissingMs >= options.sustainedMs);
      const key = [signal.tabAwayMs >= options.recoveryMs, signal.appAwayMs >= options.recoveryMs, signal.headAwayMs >= options.sustainedMs, signal.faceMissingMs >= options.sustainedMs].join('');
      if (!concerning || signal.referenceMode) { candidateAt = 0; lastKey = ''; state = FOCUS_STATES.MONITORING; return emit(state, signal.referenceMode ? 'reference-mode' : 'signals-normal', now); }
      if (key !== lastKey) { candidateAt = now; lastKey = key; }
      if (now < cooldownUntil) { state = FOCUS_STATES.MONITORING; return emit(state, 'cooldown', now); }
      if (now - candidateAt < options.sustainedMs) { state = FOCUS_STATES.POSSIBLE_SHIFT; return emit(state, 'sustained-signal-check', now); }
      state = FOCUS_STATES.RECOVERY; cooldownUntil = now + options.cooldownMs;
      return emit(state, 'sustained-observable-signal', now);
    },
  };
}

export function validateIntegrationMessage(value) {
  if (!value || typeof value !== 'object' || typeof value.type !== 'string') return false;
  const allowed = new Set(['FOCUSLOOP_HELLO', 'FOCUSLOOP_SESSION', 'FOCUSLOOP_SIGNAL', 'FOCUSLOOP_STATUS']);
  return allowed.has(value.type) && (!value.payload || typeof value.payload === 'object');
}
