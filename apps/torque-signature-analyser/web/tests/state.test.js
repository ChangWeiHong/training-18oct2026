import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, selectionReducer, selectedRundown, curveLength } from '../src/state.js';

const rd = (id, n) => ({ id, curve: { angle: Array.from({ length: n }, (_, k) => k), torque: Array(n).fill(1) } });
const result = { rundowns: [rd('A01-1', 5), rd('A02-3', 8)] };

test('LOAD_RESULT resets playing, cursor and selection', () => {
  const dirty = { ...initialState, result: { rundowns: [rd('X', 3)] }, selectedId: 'X', cursor: 2, playing: true, speed: 2 };
  const s = selectionReducer(dirty, { type: 'LOAD_RESULT', result });
  assert.equal(s.playing, false);
  assert.equal(s.cursor, 0);
  assert.equal(s.selectedId, 'A01-1');
  assert.equal(s.result, result);
  assert.equal(s.speed, 2);
});

test('LOAD_RESULT with no rundowns leaves selectedId undefined', () => {
  const s = selectionReducer(initialState, { type: 'LOAD_RESULT', result: { rundowns: [] } });
  assert.equal(s.selectedId, undefined);
});

test('STEP clamps at both ends', () => {
  let s = selectionReducer(initialState, { type: 'LOAD_RESULT', result });
  s = selectionReducer(s, { type: 'STEP', delta: -3 });
  assert.equal(s.cursor, 0);
  s = selectionReducer(s, { type: 'STEP', delta: 100 });
  assert.equal(s.cursor, 4);
  s = selectionReducer(s, { type: 'STEP', delta: 1 });
  assert.equal(s.cursor, 4);
});

test('SET_CURSOR clamps', () => {
  let s = selectionReducer(initialState, { type: 'LOAD_RESULT', result });
  assert.equal(selectionReducer(s, { type: 'SET_CURSOR', i: -2 }).cursor, 0);
  assert.equal(selectionReducer(s, { type: 'SET_CURSOR', i: 99 }).cursor, 4);
  assert.equal(selectionReducer(s, { type: 'SET_CURSOR', i: 3 }).cursor, 3);
});

test('SELECT resets cursor to 0 and changes the clamp range', () => {
  let s = selectionReducer(initialState, { type: 'LOAD_RESULT', result });
  s = selectionReducer(s, { type: 'SET_CURSOR', i: 4 });
  s = selectionReducer(s, { type: 'SELECT', rundownId: 'A02-3' });
  assert.equal(s.cursor, 0);
  assert.equal(s.selectedId, 'A02-3');
  assert.equal(curveLength(selectedRundown(s)), 8);
  s = selectionReducer(s, { type: 'STEP', delta: 50 });
  assert.equal(s.cursor, 7);
});

test('PLAY, PAUSE, SET_SPEED', () => {
  let s = selectionReducer(initialState, { type: 'PLAY' });
  assert.equal(s.playing, true);
  s = selectionReducer(s, { type: 'SET_SPEED', x: 4 });
  assert.equal(s.speed, 4);
  s = selectionReducer(s, { type: 'PAUSE' });
  assert.equal(s.playing, false);
});

test('unknown action returns same state', () => {
  assert.equal(selectionReducer(initialState, { type: 'NOPE' }), initialState);
});

import { parseSpecInputs, sortRundowns, SAMPLE_SPEC, specToInputs } from '../src/state.js';

test('parseSpecInputs: empty, partial, full', () => {
  assert.equal(parseSpecInputs(specToInputs(null)), null);
  assert.equal(parseSpecInputs({ ...specToInputs(SAMPLE_SPEC), snug_torque_nm: '' }), 'partial');
  assert.deepEqual(parseSpecInputs(specToInputs(SAMPLE_SPEC)), SAMPLE_SPEC);
});

test('sortRundowns by signature puts investigate first, rank breaks ties', () => {
  const rows = [
    { id: 'a', rank: 3, signature: 'typical' },
    { id: 'b', rank: 2, signature: 'investigate' },
    { id: 'c', rank: 1, signature: 'investigate' },
  ];
  assert.deepEqual(sortRundowns(rows, 'signature').map((r) => r.id), ['c', 'b', 'a']);
  assert.deepEqual(sortRundowns(rows, 'signature', 'desc').map((r) => r.id), ['a', 'b', 'c']);
});

import { SPEC_ORDER as _SO } from '../src/state.js';
test('incomplete spec sorts between outside and within', () => {
  assert.ok(_SO.outside < _SO.incomplete && _SO.incomplete < _SO.within);
});
