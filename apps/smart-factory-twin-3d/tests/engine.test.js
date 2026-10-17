import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LineSim, calendar } from '../src/sim/engine.js';
import { buildConfig, DEFAULT_STATIONS } from '../src/sim/config.js';
import { analyticCapacity } from '../src/sim/analysis.js';

const run = (scenario, hours, opts = {}, patch) => {
  const { stations, line } = buildConfig(scenario);
  if (patch) patch(stations, line);
  const sim = new LineSim(stations, line, { seed: 7, warmup: 1800, ...opts });
  sim.step(hours * 3600);
  return sim;
};
const quiet = (stations) => stations.forEach(s => { s.mtbf = 0; s.fpy = 100; s.cv = 0; s.changeover = 0; });

test('same seed gives identical results', () => {
  const a = run('baseline', 4).snapshot().line, b = run('baseline', 4).snapshot().line;
  assert.equal(a.shipped, b.shipped);
  assert.equal(a.scrapped, b.scrapped);
});

test('units are conserved: released = shipped + scrapped + in system', () => {
  const sim = run('paint-quality', 6);
  const l = sim.snapshot().line;
  const queued = sim.st.reduce((a, s) => a + s.inQ.length + s.reworkQ.length + s.machines.reduce((b, m) => b + (s.role === 'main' ? m.units.length : 0), 0), 0);
  assert.equal(sim.inSystem, queued);
  assert.ok(l.wip >= 0);
});

test('buffers never exceed their capacity', () => {
  const sim = run('surge', 8);
  for (const s of sim.st) {
    const len = s.role === 'feeder' ? s.kit.length : s.inQ.length;
    assert.ok(len <= s.cfg.buffer, `${s.id} holds ${len} of ${s.cfg.buffer}`);
    assert.ok(s.stats.maxBuf <= s.cfg.buffer);
  }
});

test('CONWIP cap bounds work in process', () => {
  const sim = run('baseline', 8, {}, (st, ln) => { ln.wipCap = 10; ln.demand = 0; });
  assert.ok(sim.snapshot().line.wip <= 10);
});

test('failure-free deterministic line meets the analytic bottleneck rate', () => {
  const sim = run('baseline', 10, {}, (st, ln) => { quiet(st); ln.demand = 0; ln.wipCap = 60; ln.campaign = 1; ln.shifts = 3; });
  const { stations, line } = buildConfig('baseline'); quiet(stations); line.demand = 0; line.shifts = 3;
  const est = analyticCapacity(stations, line).uph;
  const got = sim.snapshot().line.uph;
  assert.ok(Math.abs(got - est) / est < 0.12, `sim ${got.toFixed(1)} vs analytic ${est.toFixed(1)}`);
});

test('an unreliable press lowers output and shows downtime', () => {
  const base = run('baseline', 12, {}, (st, ln) => { ln.demand = 0; }).snapshot();
  const bad = run('press-fail', 12, {}, (st, ln) => { ln.demand = 0; }).snapshot();
  assert.ok(bad.line.uph < base.line.uph);
  assert.ok(bad.stations.find(s => s.id === 'stamp').share.down > base.stations.find(s => s.id === 'stamp').share.down);
});

test('paint defects create rework visits and scrap', () => {
  const s = run('paint-quality', 12).snapshot().stations.find(x => x.id === 'paint');
  assert.ok(s.defects > 0);
  assert.ok(s.reworkIn > 0);
  assert.ok(s.fpy < 90);
});

test('join station starves without powertrain kits', () => {
  const sim = run('baseline', 6, {}, (st) => { st.find(s => s.id === 'powertrain').cycle = 4000; });
  const m = sim.snapshot().stations.find(s => s.id === 'marriage');
  assert.ok(m.kitWaitPct > 30, `kit wait ${m.kitWaitPct.toFixed(1)}%`);
});

test('manual stations stop on breaks, automated ones do not', () => {
  assert.equal(calendar(7300, 2).onBreak, true);
  assert.equal(calendar(100, 2).onBreak, false);
  const sim = run('baseline', 8);
  const trim = sim.st.find(s => s.id === 'trim').stats.time.off;
  const weld = sim.st.find(s => s.id === 'weld').stats.time.off;
  assert.ok(trim > 0);
  assert.equal(weld, 0);
});

test('nothing moves outside planned shifts', () => {
  const { stations, line } = buildConfig('one-shift');
  const sim = new LineSim(stations, line, { seed: 3 });
  sim.step(8 * 3600);
  const shipped = sim.shipped;
  sim.step(10 * 3600);
  assert.equal(sim.shipped, shipped);
  assert.equal(calendar(9 * 3600, 1).planned, false);
});

test('injected breakdown stops a machine and recovers', () => {
  const sim = run('baseline', 1);
  sim.inject({ type: 'breakdown', station: 'weld', minutes: 10 });
  sim.step(30);
  assert.ok(sim.st.find(s => s.id === 'weld').machines.some(m => m.tag === 'down'));
  sim.step(11 * 60);
  assert.ok(sim.st.find(s => s.id === 'weld').machines.every(m => m.tag !== 'down'));
});

test('adding a parallel machine at run time changes capacity', () => {
  const sim = run('baseline', 1);
  const n = sim.st.find(s => s.id === 'weld').machines.length;
  sim.setStation('weld', { machines: n + 1 });
  assert.equal(sim.st.find(s => s.id === 'weld').machines.length, n + 1);
  sim.setStation('weld', { machines: 1 });
  sim.step(600);
  assert.equal(sim.st.find(s => s.id === 'weld').machines.length, 1);
});

test('default plant has the expected stations and one feeder', () => {
  assert.equal(DEFAULT_STATIONS.filter(s => !s.feeds).length, 9);
  assert.equal(DEFAULT_STATIONS.filter(s => s.feeds).length, 1);
});
