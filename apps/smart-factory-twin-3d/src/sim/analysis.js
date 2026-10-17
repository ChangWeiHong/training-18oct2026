// Steady-state estimate, headless replications, and a what-if advisor built on the same engine.
import { LineSim } from './engine.js';
import { VARIANTS } from './config.js';

const BREAK_FACTOR = 1 - 3600 / (8 * 3600);

function mixShares(mix) {
  const total = VARIANTS.reduce((a, v) => a + (mix[v.id] || 0), 0) || 1;
  return VARIANTS.map(v => ({ v, p: (mix[v.id] || 0) / total }));
}

// Closed-form capacity estimate. Ignores starving, blocking and variability, so it overstates
// what the discrete-event run delivers. The gap between the two is the cost of those effects.
export function analyticCapacity(stations, line) {
  const shares = mixShares(line.mix);
  const sameModel = shares.reduce((a, s) => a + s.p * s.p, 0);
  const pSwitch = line.campaign > 1 ? (1 - sameModel) / line.campaign : 1 - sameModel;
  const main = stations.filter(s => !s.feeds);
  const idx = Object.fromEntries(main.map((s, i) => [s.id, i]));

  // Visits per released unit, including rework loops. Gauss-Seidel on the flow balance.
  const V = main.map(() => 0);
  for (let it = 0; it < 200; it++) {
    for (let i = 0; i < main.length; i++) {
      let v = i === 0 ? 1 : 0;
      if (i > 0) { const p = main[i - 1], d = (100 - p.fpy) / 100; v += (1 - d) * V[i - 1]; }
      for (let j = 0; j < main.length; j++) {
        const c = main[j];
        if (c.reworkTo && idx[c.reworkTo] === i) {
          const d = (100 - c.fpy) / 100;
          v += d * (1 - c.scrapShare / 100) * V[j];
        }
      }
      V[i] = v;
    }
  }
  const last = main[main.length - 1];
  const yieldPerRelease = ((100 - last.fpy) / 100 === 0 ? 1 : last.fpy / 100) * V[main.length - 1];

  const rows = stations.map(s => {
    const mixMult = shares.reduce((a, x) => a + x.p * (1 + ((s.feeds ? x.v.pt : x.v.mult) - 1) * s.variantSens), 0);
    const avail = s.mtbf > 0 ? s.mtbf / (s.mtbf + s.mttr) : 1;
    const speed = (s.speedPct / 100) * (s.manned ? s.staffing / 100 : 1);
    const cycleEff = s.cycle * mixMult + pSwitch * s.changeover;
    const cap = (s.machines * s.batch * 3600 / cycleEff) * speed * avail * (s.manned ? BREAK_FACTOR : 1);
    const visits = s.feeds ? V[idx[s.feeds]] : V[idx[s.id]];
    return { id: s.id, cap, visits, avail, perReleased: cap / visits };
  });
  const limiting = rows.reduce((a, b) => (b.perReleased < a.perReleased ? b : a));
  return { rows, bottleneck: limiting.id, releasedPerHour: limiting.perReleased, uph: limiting.perReleased * yieldPerRelease, yieldPerRelease };
}

export function runHeadless(stations, line, { hours = 8, seeds = [11, 23, 37], warmup = 2400 } = {}) {
  let uph = 0, wip = 0, lead = 0, scrap = 0, att = 0;
  const bn = {};
  for (const seed of seeds) {
    const sim = new LineSim(stations, { ...line, shifts: 3 }, { seed, warmup });
    sim.step(hours * 3600);
    const s = sim.snapshot();
    uph += s.line.uph; wip += s.line.avgWip; lead += s.line.leadMin; scrap += s.line.scrapped; att += s.line.attainment;
    if (s.bottleneck) bn[s.bottleneck] = (bn[s.bottleneck] || 0) + 1;
  }
  const n = seeds.length;
  const top = Object.entries(bn).sort((a, b) => b[1] - a[1])[0];
  return { uph: uph / n, wip: wip / n, leadMin: lead / n, scrap: scrap / n, attainment: att / n, bottleneck: top ? top[0] : null };
}

function candidates(stations, line) {
  const out = [];
  for (const s of stations) {
    if (s.machines < 4) out.push({ key: `${s.id}:m`, scope: s.name, label: `Add a parallel machine at ${s.name}`, station: s.id, patch: { machines: s.machines + 1 } });
    if (s.cycle > 20) out.push({ key: `${s.id}:c`, scope: s.name, label: `Cut ${s.name} cycle time by 10%`, station: s.id, patch: { cycle: +(s.cycle * 0.9).toFixed(1) } });
    if (s.mtbf > 0) out.push({ key: `${s.id}:r`, scope: s.name, label: `Raise ${s.name} MTBF by 50%`, station: s.id, patch: { mtbf: Math.round(s.mtbf * 1.5) } });
    if (s.fpy < 98) out.push({ key: `${s.id}:y`, scope: s.name, label: `Raise ${s.name} first-pass yield by 3 points`, station: s.id, patch: { fpy: Math.min(100, s.fpy + 3) } });
    if (!s.feeds) out.push({ key: `${s.id}:b`, scope: s.name, label: `Add 4 buffer slots before ${s.name}`, station: s.id, patch: { buffer: s.buffer + 4 } });
  }
  if (line.release === 'conwip') out.push({ key: 'line:wip', scope: 'Line', label: `Raise WIP cap to ${line.wipCap + 10}`, linePatch: { wipCap: line.wipCap + 10 } });
  if (line.campaign < 6) out.push({ key: 'line:camp', scope: 'Line', label: 'Build the same model in runs of 6', linePatch: { campaign: 6 } });
  return out;
}

// Runs each candidate on the same random seeds as the baseline, one per macrotask so the UI stays responsive.
// Demand is lifted to 0 (release as fast as the line accepts) so the run measures capacity, not the takt.
export async function advise(stations, line, { onProgress, signal } = {}) {
  const opts = { hours: 12, seeds: [11, 23, 37, 53] };
  const open = { ...line, demand: 0, mix: { ...line.mix } };
  const base = runHeadless(stations, open, opts);
  const list = candidates(stations, line);
  const results = [];
  for (let i = 0; i < list.length; i++) {
    if (signal?.aborted) return null;
    const c = list[i];
    const st = stations.map(s => (s.id === c.station ? { ...s, ...c.patch } : s));
    const ln = c.linePatch ? { ...open, ...c.linePatch } : open;
    const r = runHeadless(st, ln, opts);
    results.push({ ...c, uph: r.uph, deltaUph: r.uph - base.uph, deltaPct: 100 * (r.uph / base.uph - 1), wip: r.wip, leadMin: r.leadMin });
    onProgress?.((i + 1) / list.length);
    await new Promise(res => setTimeout(res, 0));
  }
  results.sort((a, b) => b.deltaUph - a.deltaUph);
  return { base, results };
}
