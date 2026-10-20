import test from 'node:test';
import assert from 'node:assert/strict';
import { startClock, pauseClock, resumeClock, clockElapsed, clockRemaining } from '../src/engine/sessionClock.js';

const MIN = 60 * 1000;
const T0 = Date.parse('2026-10-18T10:00:00Z');
const SESSION = 20 * 60;

test('Continue after a drift keeps the start timestamp and elapsed time', () => {
  const clock = startClock(T0);
  // 3 minutes of focus, then a drift; the user is away for 30 seconds.
  const afterContinue = resumeClock(clock, T0 + 3 * MIN + 30 * 1000);
  assert.equal(afterContinue.startTime, clock.startTime);
  assert.equal(clockElapsed(afterContinue, T0 + 3 * MIN + 30 * 1000), 210, 'away time counts as elapsed');
  assert.notEqual(clockElapsed(afterContinue, T0 + 3 * MIN + 30 * 1000), 0);
});

test('Reset starts a fresh clock at zero', () => {
  const reset = startClock(T0 + 3 * MIN);
  assert.equal(clockElapsed(reset, T0 + 3 * MIN), 0);
  assert.equal(clockRemaining(reset, SESSION, T0 + 3 * MIN), SESSION);
});

test('Refresh after Continue restores the timer from the persisted clock', () => {
  const continued = resumeClock(startClock(T0), T0 + 3 * MIN);
  const restored = JSON.parse(JSON.stringify(continued));
  assert.equal(clockRemaining(restored, SESSION, T0 + 4 * MIN), SESSION - 240);
});

test('a user pause excludes the paused gap; Continue resumes it', () => {
  const paused = pauseClock(startClock(T0), T0 + 3 * MIN);
  assert.equal(clockElapsed(paused, T0 + 10 * MIN), 180, 'paused clock is frozen');
  const resumed = resumeClock(paused, T0 + 10 * MIN);
  assert.equal(clockElapsed(resumed, T0 + 10 * MIN), 180);
  assert.equal(clockElapsed(resumed, T0 + 11 * MIN), 240);
});
