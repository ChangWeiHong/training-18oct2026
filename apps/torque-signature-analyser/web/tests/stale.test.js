import test from 'node:test';
import assert from 'node:assert/strict';
import { inputsSnapshot, sameInputs, isStale } from '../src/stale.js';

const base = { sampleId: 'mixed', readingsFile: null, referenceFile: null, specInputs: { a: '1' } };

test('same inputs match', () => {
  assert.ok(sameInputs(inputsSnapshot(base), inputsSnapshot({ ...base, specInputs: { a: '1' } })));
});

test('editing a spec chip makes the result stale', () => {
  const computed = inputsSnapshot(base);
  const current = inputsSnapshot({ ...base, specInputs: { a: '2' } });
  assert.equal(isStale({ hasResult: true, computedFrom: computed, current, failed: false }), true);
});

test('switching pack or choosing a new file makes it stale', () => {
  const computed = inputsSnapshot(base);
  assert.equal(isStale({ hasResult: true, computedFrom: computed, current: inputsSnapshot({ ...base, sampleId: 'clean' }), failed: false }), true);
  const f = {};
  const up = inputsSnapshot({ ...base, sampleId: null, readingsFile: f });
  assert.equal(isStale({ hasResult: true, computedFrom: computed, current: up, failed: false }), true);
  assert.equal(isStale({ hasResult: true, computedFrom: up, current: inputsSnapshot({ ...base, sampleId: null, readingsFile: f }), failed: false }), false);
});

test('a reference chosen while a pack is active does not stale the pack result', () => {
  const computed = inputsSnapshot(base);
  const current = inputsSnapshot({ ...base, referenceFile: {} });
  assert.equal(isStale({ hasResult: true, computedFrom: computed, current, failed: false }), false);
});

test('a failed request marks the kept result stale; no result is never stale', () => {
  const s = inputsSnapshot(base);
  assert.equal(isStale({ hasResult: true, computedFrom: s, current: s, failed: true }), true);
  assert.equal(isStale({ hasResult: false, computedFrom: null, current: s, failed: true }), false);
});
