import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPacks, showUploadControls, defaultPackId, packBolts } from '../src/packs.js';

const p = (id, joint, extra = {}) => ({ id, joint, joint_name: `${joint} name`, bolts: 3, name: id, ...extra });
const list = [p('clean', 'wheel-hub', { bolts: 6 }), p('mixed', 'wheel-hub', { bolts: 6 }), p('caliper-mixed', 'caliper', { bolts: 2 }), p('mount-mixed', 'mount')];

test('groupPacks groups by joint in first-seen order', () => {
  const g = groupPacks(list);
  assert.deepEqual(g.map((x) => x.joint), ['wheel-hub', 'caliper', 'mount']);
  assert.deepEqual(g[0].packs.map((x) => x.id), ['clean', 'mixed']);
  assert.equal(g[1].label, 'caliper name');
});

test('groupPacks tolerates packs without a joint', () => {
  const g = groupPacks([{ id: 'x', name: 'X' }]);
  assert.equal(g.length, 1);
  assert.equal(g[0].packs[0].id, 'x');
});

test('upload controls show only for ?upload=1', () => {
  assert.equal(showUploadControls(''), false);
  assert.equal(showUploadControls('?upload=0'), false);
  assert.equal(showUploadControls('?upload=true'), false);
  assert.equal(showUploadControls('?upload=1'), true);
  assert.equal(showUploadControls('?x=2&upload=1'), true);
});

test('default pack is the wheel hub mixed shift', () => {
  assert.equal(defaultPackId(list), 'mixed');
  assert.equal(defaultPackId([p('caliper-mixed', 'caliper')]), 'caliper-mixed');
  assert.equal(defaultPackId([]), null);
});

test('packBolts reads the pack, defaulting to six', () => {
  assert.equal(packBolts(list[2]), 2);
  assert.equal(packBolts(undefined), 6);
  assert.equal(packBolts({ bolts: 9 }), 6);
  assert.equal(packBolts({ bolts: 0 }), 6);
});

import { packOptionLabel } from '../src/packs.js';
test('option text names the joint and the pack', () => {
  assert.equal(packOptionLabel({ joint_name: 'Brake caliper', name: 'Mixed shift' }), 'Brake caliper · Mixed shift');
  assert.equal(packOptionLabel({ name: 'Mixed shift' }), 'Mixed shift');
});
