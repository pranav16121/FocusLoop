import { validateIntegrationMessage } from '../../shared/focusEngine.js';

export function extensionAvailable() { return typeof window !== 'undefined'; }
export function sendExtension(message) {
  if (!extensionAvailable() || !validateIntegrationMessage(message)) return Promise.resolve({ ok: false, reason: 'invalid-message' });
  window.postMessage({ channel: 'focusloop-page', message }, window.location.origin);
  return Promise.resolve({ ok: true });
}
export function subscribeIntegration(onSignal) {
  const listener = event => { if (event.source === window && event.origin === window.location.origin && event.data?.channel === 'focusloop-extension' && validateIntegrationMessage(event.data.message) && event.data.message.type === 'FOCUSLOOP_SIGNAL') onSignal(event.data.message.payload || {}); };
  window.addEventListener('message', listener); return () => window.removeEventListener('message', listener);
}
