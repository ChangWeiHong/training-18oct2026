import test from 'node:test';
import assert from 'node:assert/strict';
import { makeScales, alignAtSnug, nearestSampleIndex, decimateIndexes, bandRuns, niceTicks } from '../src/graph.js';

test('nearestSampleIndex returns the first index on repeated angles', () => {
  const c = { angle: [0, 5, 10, 10, 10, 15] };
  assert.equal(nearestSampleIndex(c, 10), 2);
  assert.equal(nearestSampleIndex(c, 7), 2);
  assert.equal(nearestSampleIndex(c, -3), 0);
  assert.equal(nearestSampleIndex(c, 99), 5);
});

test('alignAtSnug shifts so the snug angle is 0 and keeps other fields', () => {
  const c = { i: [0, 1, 2], angle: [10, 20, 30], torque: [1, 2, 3] };
  const a = alignAtSnug(c, 20);
  assert.deepEqual(a.angle, [-10, 0, 10]);
  assert.deepEqual(a.torque, [1, 2, 3]);
  assert.deepEqual(c.angle, [10, 20, 30]);
});

test('makeScales invertX round-trips and y grows upward', () => {
  const s = makeScales({ x0: -30, x1: 90, y0: 0, y1: 120 }, { width: 600, height: 300, margin: { l: 50, r: 10, t: 10, b: 30 } });
  for (const v of [-30, 0, 33.3, 90]) assert.ok(Math.abs(s.invertX(s.x(v)) - v) < 1e-9);
  assert.ok(s.y(100) < s.y(10));
  assert.equal(s.x(-30), 50);
  assert.equal(s.y(0), 270);
});

test('decimateIndexes caps count and keeps ends', () => {
  const d = decimateIndexes(1000, 150);
  assert.equal(d.length, 150);
  assert.equal(d[0], 0);
  assert.equal(d.at(-1), 999);
  assert.deepEqual(decimateIndexes(3, 150), [0, 1, 2]);
});

test('bandRuns splits at nulls and applies the shift', () => {
  const runs = bandRuns([0, 1, 2, 3, 4], [1, 1, null, 1, 1], [2, 2, null, 2, 2], 10);
  assert.equal(runs.length, 2);
  assert.equal(runs[0][0].x, 10);
  assert.equal(runs[1][0].x, 13);
});

test('niceTicks gives round steps inside the range', () => {
  assert.deepEqual(niceTicks(0, 120, 6), [0, 20, 40, 60, 80, 100, 120]);
});
