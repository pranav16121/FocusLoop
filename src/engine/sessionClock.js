// Session clock.
// Elapsed time is derived from the start timestamp, so time spent away from the focus
// screen (drift card, "Where was I?", other tabs, a page refresh) still counts as elapsed.
// Only an explicit user pause stops the clock: pausing freezes `pausedElapsed`, and
// resuming rebases `startTime` so the paused gap is excluded.
// Continuing after an interruption is just resume(): a no-op for a running clock.

const toMs = (value) => (typeof value === 'number' ? value : new Date(value).getTime());

export function startClock(now = Date.now()) {
  return { startTime: new Date(now).toISOString(), pausedElapsed: null };
}

export function clockElapsed(clock, now = Date.now()) {
  if (!clock) return 0;
  if (clock.pausedElapsed !== null && clock.pausedElapsed !== undefined) return Math.max(0, clock.pausedElapsed);
  if (!clock.startTime) return 0;
  const start = toMs(clock.startTime);
  return Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 1000)) : 0;
}

export function pauseClock(clock, now = Date.now()) {
  if (clock?.pausedElapsed !== null && clock?.pausedElapsed !== undefined) return clock;
  return { ...clock, pausedElapsed: clockElapsed(clock, now) };
}

export function resumeClock(clock, now = Date.now()) {
  if (!clock || clock.pausedElapsed === null || clock.pausedElapsed === undefined) return clock;
  return { startTime: new Date(now - clock.pausedElapsed * 1000).toISOString(), pausedElapsed: null };
}

export function clockRemaining(clock, durationSeconds, now = Date.now()) {
  return Math.max(0, durationSeconds - clockElapsed(clock, now));
}
