import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, selectionReducer, selectedRundown, curveLength, SPEC_ORDER } from '../src/state.js';

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

test('incomplete spec sorts between outside and within', () => {
  assert.ok(SPEC_ORDER.outside < SPEC_ORDER.incomplete && SPEC_ORDER.incomplete < SPEC_ORDER.within);
});

test('LOAD_RESULT selects the lowest rank, not the first row', () => {
  const rows = [{ ...rd('B', 4), rank: 3 }, { ...rd('A', 4), rank: 1 }, { ...rd('C', 4), rank: 2 }];
  const s = selectionReducer(initialState, { type: 'LOAD_RESULT', result: { rundowns: rows } });
  assert.equal(s.selectedId, 'A');
});

test('PLAY on the last sample restarts from the first', () => {
  let s = selectionReducer(initialState, { type: 'LOAD_RESULT', result });
  s = selectionReducer(s, { type: 'SET_CURSOR', i: 4 });
  s = selectionReducer(s, { type: 'PLAY' });
  assert.equal(s.cursor, 0);
  assert.equal(s.playing, true);
  s = selectionReducer(s, { type: 'SET_CURSOR', i: 2 });
  s = selectionReducer(selectionReducer(s, { type: 'PAUSE' }), { type: 'PLAY' });
  assert.equal(s.cursor, 2);
});

import { nextTourId, isFlagged, DEFAULT_SPEED } from '../src/state.js';

const row = (id, rank, over = {}) => ({ id, rank, spec_result: 'within', signature: 'typical', curve: { angle: [0, 1, 2, 3], torque: [1, 1, 1, 1] }, ...over });
const flagged = { signature: 'investigate' };
const pack = {
  rundowns: [
    row('t1', 5), row('f2', 2, flagged), row('o1', 1, { spec_result: 'outside' }),
    row('t2', 6), row('f4', 4, flagged), row('c1', 3, { signature: 'cant_assess' }),
  ],
};

test('initial state loops, has no tour, and plays slowly enough to read', () => {
  assert.equal(initialState.loop, true);
  assert.equal(initialState.tour, false);
  assert.equal(initialState.playing, false);
  assert.equal(initialState.speed, DEFAULT_SPEED);
});

test('isFlagged is outside spec or worth investigating', () => {
  assert.equal(isFlagged(row('a', 1)), false);
  assert.equal(isFlagged(row('a', 1, flagged)), true);
  assert.equal(isFlagged(row('a', 1, { spec_result: 'outside' })), true);
  assert.equal(isFlagged(row('a', 1, { signature: 'cant_assess' })), false);
});

test('nextTourId walks flagged rundowns by rank and wraps', () => {
  assert.equal(nextTourId(pack.rundowns, 'o1'), 'f2');
  assert.equal(nextTourId(pack.rundowns, 'f2'), 'f4');
  assert.equal(nextTourId(pack.rundowns, 'f4'), 'o1');
});

test('nextTourId from an unflagged rundown goes to the next flagged rank, else wraps', () => {
  assert.equal(nextTourId(pack.rundowns, 'c1'), 'f4');
  assert.equal(nextTourId(pack.rundowns, 't2'), 'o1');
  assert.equal(nextTourId(pack.rundowns, 'missing'), 'o1');
});

test('nextTourId is null with nothing flagged', () => {
  assert.equal(nextTourId([row('a', 1), row('b', 2)], 'a'), null);
  assert.equal(nextTourId([], undefined), null);
});

const loaded = (extra = {}) => ({ ...selectionReducer(initialState, { type: 'LOAD_RESULT', result: pack, autoplay: true }), ...extra });

test('LOAD_RESULT autoplays unless told not to, and turns the tour off', () => {
  assert.equal(loaded().playing, true);
  assert.equal(loaded().selectedId, 'o1');
  const s = selectionReducer({ ...initialState, tour: true }, { type: 'LOAD_RESULT', result: pack, autoplay: false });
  assert.equal(s.playing, false);
  assert.equal(s.tour, false);
});

test('SELECT starts playback from the start and turns the tour off', () => {
  const s = selectionReducer(loaded({ playing: false, tour: true, cursor: 2 }), { type: 'SELECT', rundownId: 't1', autoplay: true });
  assert.equal(s.selectedId, 't1');
  assert.equal(s.cursor, 0);
  assert.equal(s.playing, true);
  assert.equal(s.tour, false);
});

test('SELECT without autoplay (reduced motion) leaves playing as it was', () => {
  assert.equal(selectionReducer(loaded({ playing: false }), { type: 'SELECT', rundownId: 't1', autoplay: false }).playing, false);
  assert.equal(selectionReducer(loaded({ playing: true }), { type: 'SELECT', rundownId: 't1', autoplay: false }).playing, true);
});

test('user actions turn the tour off: pause, graph drag, keys and step buttons', () => {
  const on = loaded({ tour: true });
  assert.equal(selectionReducer(on, { type: 'PAUSE' }).tour, false);
  assert.equal(selectionReducer(on, { type: 'SET_CURSOR', i: 2 }).tour, false);
  assert.equal(selectionReducer(on, { type: 'STEP', delta: 1 }).tour, false);
});

test('playback ticks and speed changes keep the tour on', () => {
  const on = loaded({ tour: true });
  const t = selectionReducer(on, { type: 'TICK', i: 2 });
  assert.equal(t.cursor, 2);
  assert.equal(t.tour, true);
  assert.equal(selectionReducer(on, { type: 'SET_SPEED', x: 2 }).tour, true);
  assert.equal(selectionReducer(t, { type: 'TICK', i: 99 }).cursor, 3);
});

test('LOOP_END with loop on restarts the same rundown', () => {
  const s = selectionReducer(loaded({ cursor: 3 }), { type: 'LOOP_END' });
  assert.equal(s.cursor, 0);
  assert.equal(s.playing, true);
  assert.equal(s.selectedId, 'o1');
});

test('LOOP_END with loop off stops on the last pose', () => {
  const s = selectionReducer(loaded({ cursor: 3, loop: false }), { type: 'LOOP_END' });
  assert.equal(s.playing, false);
  assert.equal(s.cursor, 3);
});

test('LOOP_END with the tour on selects the next flagged rundown and keeps touring', () => {
  let s = loaded({ cursor: 3, tour: true });
  s = selectionReducer(s, { type: 'LOOP_END' });
  assert.equal(s.selectedId, 'f2');
  assert.equal(s.cursor, 0);
  assert.equal(s.playing, true);
  assert.equal(s.tour, true);
  s = selectionReducer(selectionReducer(s, { type: 'LOOP_END' }), { type: 'LOOP_END' });
  assert.equal(s.selectedId, 'o1');
});

test('LOOP_END with the tour on but nothing flagged just loops', () => {
  const calm = selectionReducer(initialState, { type: 'LOAD_RESULT', result: { rundowns: [row('a', 1), row('b', 2)] }, autoplay: true });
  const s = selectionReducer({ ...calm, tour: true, cursor: 3 }, { type: 'LOOP_END' });
  assert.equal(s.selectedId, 'a');
  assert.equal(s.cursor, 0);
});

test('SET_LOOP and SET_TOUR toggle; turning the tour on starts playback', () => {
  assert.equal(selectionReducer(loaded(), { type: 'SET_LOOP', on: false }).loop, false);
  const s = selectionReducer(loaded({ playing: false, cursor: 3 }), { type: 'SET_TOUR', on: true });
  assert.equal(s.tour, true);
  assert.equal(s.playing, true);
  assert.equal(s.cursor, 0);
  assert.equal(selectionReducer(s, { type: 'SET_TOUR', on: false }).tour, false);
});

test('STOP pauses without touching the tour', () => {
  const s = selectionReducer(loaded({ tour: true }), { type: 'STOP' });
  assert.equal(s.playing, false);
  assert.equal(s.tour, true);
});
