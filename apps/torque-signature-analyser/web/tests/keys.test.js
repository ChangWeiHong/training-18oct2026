import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldStep } from '../src/usePlayback.js';

const ev = (over = {}, inside = null) => ({
  key: 'ArrowRight', defaultPrevented: false,
  target: { closest: (sel) => (inside && sel.includes(inside) ? {} : null) },
  ...over,
});

test('arrow keys step from the page body', () => assert.equal(shouldStep(ev()), true));
test('other keys do not step', () => assert.equal(shouldStep(ev({ key: 'a' })), false));
test('handled events are ignored', () => assert.equal(shouldStep(ev({ defaultPrevented: true })), false));
test('inputs, the 3D panel, the graph and the ledger keep their own arrows', () => {
  for (const sel of ['input', '[data-slot="3d"]', '.graph-svg', '.ledger', 'dialog[open]']) {
    assert.equal(shouldStep(ev({}, sel)), false, sel);
  }
});
test('modifier chords are ignored', () => assert.equal(shouldStep(ev({ ctrlKey: true })), false));
