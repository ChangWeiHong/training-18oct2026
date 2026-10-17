import test from 'node:test';
import assert from 'node:assert/strict';
import { jointPose, boltSlots, statusKind } from '../src/scene/kinematics.js';

const curve = { angle: [0, 100, 200, 300, 400], torque: [2, 10, 30, 80, 110] };
const opts = { torqueMax: 120, maxCompression: 0.08 };

test('rotation equals the measured angle in radians', () => {
  const p = jointPose(curve, 3, 200, opts);
  assert.ok(Math.abs(p.rotationRad - (300 * Math.PI) / 180) < 1e-12);
});

test('travel is pitch x turns x exaggeration and stops growing after snug', () => {
  const at = (i) => jointPose(curve, i, 200, opts).travel;
  assert.ok(Math.abs(at(1) - (100 / 360) * 1.75 * 6) < 1e-9);
  assert.ok(Math.abs(at(2) - (200 / 360) * 1.75 * 6) < 1e-9);
  assert.equal(at(3), at(2));
  assert.equal(at(4), at(2));
});

test('compression is 0 before snug and bounded after', () => {
  assert.equal(jointPose(curve, 1, 200, opts).compression, 0);
  assert.equal(jointPose(curve, 2, 200, opts).compression, 0);
  const c = jointPose(curve, 3, 200, opts).compression;
  assert.ok(Math.abs(c - (80 / 120) * 0.08) < 1e-12);
  const over = jointPose({ angle: [0, 300], torque: [0, 999] }, 1, 100, opts).compression;
  assert.equal(over, 0.08);
});

test('null snug: rotation only, no travel or compression', () => {
  const p = jointPose(curve, 4, null, opts);
  assert.equal(p.travel, 0);
  assert.equal(p.compression, 0);
  assert.ok(p.rotationRad > 0);
});

test('cursor beyond the curve is clamped', () => {
  assert.equal(jointPose(curve, 99, 200, opts).rotationRad, jointPose(curve, 4, 200, opts).rotationRad);
});

const rd = (id, pos) => ({ id, bolt_position: pos });

test('boltSlots honours valid positions', () => {
  const s = boltSlots([rd('a', 3), rd('b', 1)]);
  assert.deepEqual(s.slots.map((x) => [x.slot, x.rundown.id]), [[0, 'b'], [2, 'a']]);
  assert.equal(s.overflow.length, 0);
});

test('boltSlots fills missing positions by order, avoiding taken slots', () => {
  const s = boltSlots([rd('a', 1), rd('b', null), rd('c', 9), rd('d', 3)]);
  const by = Object.fromEntries(s.slots.map((x) => [x.rundown.id, x.slot]));
  assert.deepEqual(by, { a: 0, d: 2, b: 1, c: 3 });
});

test('boltSlots drops the 7th and duplicates into overflow', () => {
  const six = [1, 2, 3, 4, 5, 6].map((p) => rd('p' + p, p));
  const s = boltSlots([...six, rd('extra', null), rd('dup', 2)]);
  assert.equal(s.slots.length, 6);
  assert.deepEqual(s.overflow.map((r) => r.id).sort(), ['dup', 'extra']);
});

test('statusKind priority: outside, investigate, cant_assess, typical', () => {
  assert.equal(statusKind({ spec_result: 'outside', signature: 'investigate' }), 'outside');
  assert.equal(statusKind({ spec_result: 'within', signature: 'investigate' }), 'investigate');
  assert.equal(statusKind({ spec_result: 'within', signature: 'cant_assess' }), 'cant_assess');
  assert.equal(statusKind({ spec_result: 'not_supplied', signature: 'typical' }), 'typical');
});
