import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTime, nextPosition, SPEEDS } from '../src/playback.js';

const timed = { angle: [0, 1, 2, 3, 4], t: [0, 100, 200, 300, 400] };
const uniform = { angle: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], t: null };

test('speeds are 0.25 to 4', () => assert.deepEqual(SPEEDS, [0.25, 0.5, 1, 2, 4]));

test('hasTime needs complete, non-decreasing stamps', () => {
  assert.equal(hasTime(timed), true);
  assert.equal(hasTime(uniform), false);
  assert.equal(hasTime({ angle: [0, 1, 2], t: [0, null, 2] }), false);
  assert.equal(hasTime({ angle: [0, 1, 2], t: [0, 5, 2] }), false);
  assert.equal(hasTime({ angle: [0, 1, 2], t: [5, 5, 5] }), false);
});

test('timed playback follows real time times speed', () => {
  assert.equal(nextPosition(timed, 0, 100, 1), 1);
  assert.equal(nextPosition(timed, 0, 100, 2), 2);
  assert.equal(nextPosition(timed, 1, 50, 1), 1.5);
  assert.equal(nextPosition(timed, 1, 100, 0.25), 1.25);
});

test('timed playback copes with uneven stamps', () => {
  const c = { angle: [0, 1, 2], t: [0, 10, 410] };
  assert.equal(nextPosition(c, 0, 10, 1), 1);
  assert.equal(nextPosition(c, 1, 200, 1), 1.5);
});

test('uniform playback runs at 60 samples per second', () => {
  assert.equal(nextPosition(uniform, 0, 100, 1), 6);
  assert.equal(nextPosition(uniform, 0, 100, 0.5), 3);
});

test('playback stops at the last sample', () => {
  assert.equal(nextPosition(timed, 3, 5000, 4), 4);
  assert.equal(nextPosition(uniform, 8, 1000, 1), 9);
});

import { frameStep, HOLD_MS } from '../src/playback.js';

test('frameStep advances, then holds on the last sample for one second, then ends', () => {
  let s = { pos: 0, hold: null };
  let out = frameStep(timed, s.pos, s.hold, 100, 1);
  assert.deepEqual(out, { pos: 1, hold: null, ended: false });
  out = frameStep(timed, 3.5, null, 1000, 1);
  assert.deepEqual(out, { pos: 4, hold: 0, ended: false });
  out = frameStep(timed, 4, 0, 400, 1);
  assert.deepEqual(out, { pos: 4, hold: 400, ended: false });
  out = frameStep(timed, 4, 400, 400, 1);
  assert.equal(out.ended, false);
  out = frameStep(timed, 4, 800, 250, 1);
  assert.equal(out.ended, true);
  assert.equal(HOLD_MS, 1000);
});

test('the hold is real time, whatever the playback speed', () => {
  assert.equal(frameStep(timed, 4, 900, 100, 0.25).ended, true);
  assert.equal(frameStep(timed, 4, 900, 100, 4).ended, true);
  assert.equal(frameStep(timed, 4, 0, 100, 0.25).ended, false);
});

test('frameStep on a curve with fewer than two samples ends at once', () => {
  assert.equal(frameStep({ angle: [0], t: null }, 0, null, 16, 1).ended, true);
});
