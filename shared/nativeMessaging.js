// Native Messaging framing reference used by tests and companion protocol docs.
export function encodeNativeMessage(message) {
  const body = new TextEncoder().encode(JSON.stringify(message));
  const frame = new Uint8Array(4 + body.length); new DataView(frame.buffer).setUint32(0, body.length, true); frame.set(body, 4); return frame;
}
export function decodeNativeMessage(frame) {
  if (!(frame instanceof Uint8Array) || frame.length < 4) throw new Error('Invalid Native Messaging frame');
  const size = new DataView(frame.buffer, frame.byteOffset, 4).getUint32(0, true);
  if (size > 1048576 || frame.length !== size + 4) throw new Error('Invalid Native Messaging length');
  return JSON.parse(new TextDecoder().decode(frame.subarray(4)));
}
export function validateCompanionEvent(event) {
  if (!event || typeof event !== 'object') return false;
  if (event.type === 'status') return ['connected', 'paused', 'stopped'].includes(event.status);
  return event.type === 'foreground-app' && typeof event.application === 'string' && Number.isFinite(event.awayMs) && event.awayMs >= 0;
}
