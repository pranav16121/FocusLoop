// Isolated-world bridge: the page never gets privileged Chrome APIs.
window.addEventListener('message', event => {
  if (event.source !== window || event.data?.channel !== 'focusloop-page') return;
  chrome.runtime.sendMessage(event.data.message, response => window.postMessage({ channel: 'focusloop-extension', message: response || { ok: false } }, window.location.origin));
});
chrome.runtime.onMessage.addListener(message => window.postMessage({ channel: 'focusloop-extension', message }, window.location.origin));
