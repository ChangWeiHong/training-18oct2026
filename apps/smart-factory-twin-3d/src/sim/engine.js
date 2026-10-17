// Time-stepped discrete-event model of a serial automotive line. One tick = one simulated second.
// Machines carry units through setup, work, failure and blocked states. Buffers are finite.
// Seeded RNG: the same config and seed always produce the same run. All inputs are synthetic.
import { VARIANTS } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const SHIFT_S = 8 * 3600;
const BREAKS = [[7200, 8100], [14400, 16200], [21600, 22500]]; // offsets inside a shift: 15, 30, 15 min
const DAY_START_H = 6;
const EMA_ALPHA = 1 / 1800;
export const STATE_KEYS = ['busy', 'setup', 'down', 'blocked', 'starved', 'off'];

export function clockLabel(t) {
  const day = Math.floor(t / 86400) + 1;
  const s = Math.floor(t + DAY_START_H * 3600) % 86400;
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  return { day, label: `${hh}:${mm}`, full: `Day ${day} ${hh}:${mm}` };
}

export function calendar(t, shifts) {
  const intoDay = t % 86400;
  const planned = shifts >= 3 || intoDay < shifts * SHIFT_S;
  if (!planned) return { planned: false, onBreak: false, shift: 0 };
  const off = intoDay % SHIFT_S;
  const onBreak = BREAKS.some(([a, b]) => off >= a && off < b);
  return { planned: true, onBreak, shift: Math.floor(intoDay / SHIFT_S) + 1 };
}

function makeStats() {
  return {
    time: { busy: 0, setup: 0, down: 0, blocked: 0, starved: 0, off: 0, kit: 0 },
    units: 0, good: 0, defects: 0, scrap: 0, reworkOut: 0, reworkIn: 0, passed: 0, failures: 0, repairSec: 0,
    bufInt: 0, bufTicks: 0, maxBuf: 0, machSec: 0, emaActive: 0, tickActive: 0,
  };
}

export class LineSim {
  constructor(stations, line, opts = {}) {
    this.stationsCfg = stations.map(s => ({ ...s }));
    this.line = { ...line, mix: { ...line.mix } };
    this.seed = opts.seed ?? line.seed ?? 1;
    this.rand = mulberry32(this.seed);
    this.t = 0;
    this.nextId = 1;
    this.log = [];
    this.events = [];
    this.eventId = 1;
    this.tokens = 0;
    this.inSystem = 0;
    this.runLeft = 0;
    this.runV = 'S';
    this.mod = { staff: 0, fpy: {}, material: false, surge: 0 };

    this.st = this.stationsCfg.map((cfg, idx) => ({
      cfg, idx, id: cfg.id, role: cfg.feeds ? 'feeder' : 'main',
      machines: [], inQ: [], reworkQ: [], kit: [], next: null, feedsTo: null, stats: makeStats(),
    }));
    this.byId = Object.fromEntries(this.st.map(s => [s.id, s]));
    this.main = this.st.filter(s => s.role === 'main');
    this.feeders = this.st.filter(s => s.role === 'feeder');
    this.main.forEach((s, i) => { s.lineIndex = i; s.next = this.main[i + 1] || null; });
    this.feeders.forEach(f => { f.feedsTo = this.byId[f.cfg.feeds]; f.feedsTo.kitFrom = f; });
    for (const s of this.st) this.syncMachines(s);

    this.resetStats();
    if (opts.warmup) this.step(opts.warmup, true);
    if (opts.warmup) this.resetStats();
  }

  resetStats() {
    this.startT = this.t;
    this.released = 0; this.shipped = 0; this.scrapped = 0; this.plannedSec = 0;
    this.wipInt = 0; this.leadSum = 0; this.leadN = 0; this.leads = [];
    this.minShips = 0; this.shipWindow = []; this.history = [];
    for (const s of this.st) { const m = makeStats(); m.emaActive = s.stats.emaActive; s.stats = m; }
  }

  // ---- configuration at run time ----
  setStation(id, patch) {
    const s = this.byId[id]; if (!s) return;
    Object.assign(s.cfg, patch);
    if ('machines' in patch) this.syncMachines(s);
    if ('mtbf' in patch) for (const m of s.machines) m.failIn = this.drawFail(s.cfg);
  }
  setLine(patch) {
    const { mix, ...rest } = patch;
    Object.assign(this.line, rest);
    if (mix) this.line.mix = { ...this.line.mix, ...mix };
  }
  syncMachines(s) {
    const want = clamp(Math.round(s.cfg.machines), 1, 6);
    for (const m of s.machines) m.retire = false;
    while (s.machines.length < want) {
      s.machines.push({ phase: 'idle', units: [], rem: 0, work: 0, repair: 0, failIn: this.drawFail(s.cfg), lastV: null, tag: 'starved', retire: false });
    }
    let extra = s.machines.length - want;
    for (let i = s.machines.length - 1; i >= 0 && extra > 0; i--) {
      const m = s.machines[i];
      if (m.phase === 'idle' && m.repair <= 0) { s.machines.splice(i, 1); extra--; }
      else { m.retire = true; extra--; }
    }
  }
  inject(evt) {
    const mins = Math.max(1, evt.minutes || 20);
    const label = evt.station ? this.byId[evt.station]?.cfg.name : 'Plant';
    if (evt.type === 'breakdown') {
      const s = this.byId[evt.station]; if (!s) return;
      const m = s.machines.find(x => x.repair <= 0) || s.machines[0];
      m.repair = mins * 60; s.stats.failures++; s.stats.repairSec += mins * 60;
      this.note('crit', `${label}: machine stopped by injected breakdown, ${mins} min repair.`);
      return;
    }
    this.events.push({ id: this.eventId++, type: evt.type, station: evt.station || null, drop: evt.drop || 0, until: this.t + mins * 60, mins });
    const text = {
      quality: `${label}: yield cut by ${evt.drop} points for ${mins} min.`,
      staff: `${label === 'Plant' ? 'All manual stations' : label}: staffing cut by ${evt.drop}% for ${mins} min.`,
      material: `Plant: raw material and powertrain supply stopped for ${mins} min.`,
      surge: `Plant: demand target raised ${evt.drop}% for ${mins} min.`,
    }[evt.type];
    if (text) this.note('warn', text);
  }
  note(level, text) {
    this.log.push({ t: this.t, level, text, clock: clockLabel(this.t).full });
    if (this.log.length > 80) this.log.shift();
  }

  // ---- sampling ----
  exp(mean) { return -mean * Math.log(1 - this.rand()); }
  normal() {
    const u = 1 - this.rand(), v = this.rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  logn(mean, cv) {
    if (cv <= 0) return mean;
    const s2 = Math.log(1 + cv * cv);
    return clamp(Math.exp(Math.log(mean) - s2 / 2 + Math.sqrt(s2) * this.normal()), mean * 0.45, mean * 3);
  }
  drawFail(cfg) { return cfg.mtbf > 0 ? Math.max(30, this.exp(cfg.mtbf * 60)) : Infinity; }
  pickVariant() {
    if (this.line.campaign > 1 && this.runLeft > 0) { this.runLeft--; return this.runV; }
    const mix = this.line.mix;
    const total = VARIANTS.reduce((a, v) => a + (mix[v.id] || 0), 0) || 1;
    let r = this.rand() * total, pick = VARIANTS[0].id;
    for (const v of VARIANTS) { r -= (mix[v.id] || 0); if (r <= 0) { pick = v.id; break; } }
    if (this.line.campaign > 1) { this.runV = pick; this.runLeft = this.line.campaign - 1; }
    return pick;
  }

  // ---- modifiers from injected events ----
  refreshMods() {
    this.events = this.events.filter(e => e.until > this.t);
    const mod = { staff: {}, fpy: {}, material: false, surge: 0 };
    for (const e of this.events) {
      if (e.type === 'material') mod.material = true;
      else if (e.type === 'surge') mod.surge += e.drop;
      else if (e.type === 'quality') mod.fpy[e.station] = (mod.fpy[e.station] || 0) + e.drop / 100;
      else if (e.type === 'staff') {
        for (const s of this.st) if (s.cfg.manned && (!e.station || e.station === s.id)) mod.staff[s.id] = (mod.staff[s.id] || 0) + e.drop;
      }
    }
    this.mod = mod;
  }
  speedOf(s) {
    const c = s.cfg;
    const staff = c.manned ? clamp((c.staffing - (this.mod.staff[s.id] || 0)) / 100, 0.3, 1.2) : 1;
    return clamp((c.speedPct / 100) * staff, 0.2, 1.6);
  }

  // ---- unit flow ----
  newUnit() { return { id: this.nextId++, v: this.pickVariant(), born: this.t, rework: 0 }; }
  wip() { return this.inSystem; }

  release() {
    if (this.mod.material) return;
    const L = this.line, s0 = this.main[0];
    const demand = L.demand * (1 + this.mod.surge / 100);
    if (demand > 0) this.tokens = Math.min(this.tokens + demand / 3600, 3);
    const cap = L.release === 'conwip' ? L.wipCap : Infinity;
    while (this.wip() < cap && s0.inQ.length < s0.cfg.buffer && (demand <= 0 || this.tokens >= 1)) {
      s0.inQ.push(this.newUnit());
      this.released++; this.inSystem++;
      if (demand > 0) this.tokens -= 1;
    }
  }
  ship(u) {
    this.shipped++; this.minShips++; this.inSystem--;
    const lead = this.t - u.born;
    this.leadSum += lead; this.leadN++;
    this.leads.push(lead); if (this.leads.length > 400) this.leads.shift();
  }

  pushOut(s, m) {
    while (m.units.length) {
      const u = m.units[0];
      if (s.role === 'feeder') {
        if (s.feedsTo.kit.length >= s.cfg.buffer) return false;
        s.feedsTo.kit.push(u);
      } else if (s.next) {
        if (s.next.inQ.length >= s.next.cfg.buffer) return false;
        s.next.inQ.push(u);
      } else this.ship(u);
      m.units.shift(); s.stats.passed++;
    }
    return true;
  }

  pull(s, m) {
    const c = s.cfg, st = s.stats;
    m.why = null;
    if (s.role === 'feeder') {
      if (this.mod.material) return false;
      const v = this.pickVariant();
      m.units = [{ id: -1, v }];
    } else {
      const need = c.batch || 1;
      const avail = s.reworkQ.length + s.inQ.length;
      const minTake = need > 1 ? Math.max(1, Math.floor(need / 2)) : 1;
      if (avail < minTake) return false;
      if (s.kitFrom && s.kit.length < 1) { m.why = 'kit'; return false; }
      const take = Math.min(need, avail), units = [];
      while (units.length < take) units.push(s.reworkQ.length ? s.reworkQ.shift() : s.inQ.shift());
      if (s.kitFrom) s.kit.shift();
      m.units = units;
    }
    const first = m.units[0];
    const vdef = VARIANTS.find(x => x.id === first.v) || VARIANTS[0];
    const sens = c.variantSens;
    const mult = s.role === 'feeder' ? 1 + (vdef.pt - 1) * sens : 1 + (vdef.mult - 1) * sens;
    m.work = Math.max(1, Math.round(this.logn(c.cycle * mult, c.cv)));
    if (m.lastV && m.lastV !== first.v && c.changeover > 0) { m.phase = 'setup'; m.rem = c.changeover; }
    else { m.phase = 'work'; m.rem = m.work; }
    m.lastV = first.v;
    return true;
  }

  complete(s, m) {
    const c = s.cfg, st = s.stats;
    const fpy = clamp(c.fpy / 100 - (this.mod.fpy[s.id] || 0), 0, 1);
    const outs = [];
    for (const u of m.units) {
      st.units++;
      if (this.rand() < fpy) { outs.push(u); st.good++; continue; }
      st.defects++;
      const target = c.reworkTo && this.byId[c.reworkTo];
      if (!target || this.rand() < c.scrapShare / 100) { st.scrap++; this.scrapped++; this.inSystem--; }
      else { u.rework++; target.reworkQ.push(u); st.reworkOut++; target.stats.reworkIn++; }
    }
    m.units = outs;
    m.phase = outs.length ? 'out' : 'idle';
    if (outs.length && this.pushOut(s, m)) m.phase = 'idle';
  }

  tickMachine(s, m, cal, speed) {
    const c = s.cfg, st = s.stats;
    if (!cal.planned) { m.tag = 'off'; return; }
    if (c.manned && cal.onBreak) { st.time.off++; m.tag = 'off'; return; }
    let tag = 'starved';
    if (m.repair > 0) {
      m.repair--; tag = 'down';
      if (m.repair <= 0) this.note('info', `${c.name}: machine back in service.`);
    } else {
      for (let guard = 0; guard < 4; guard++) {
        if (m.phase === 'out') {
          if (this.pushOut(s, m)) { m.phase = 'idle'; continue; }
          tag = 'blocked'; break;
        }
        if (m.phase === 'idle') {
          if (m.retire) break;
          if (this.pull(s, m)) continue;
          tag = 'starved'; if (m.why === 'kit') st.time.kit++;
          break;
        }
        if (m.phase === 'setup') {
          m.rem -= 1; tag = 'setup';
          if (m.rem <= 0) { m.phase = 'work'; m.rem = m.work; }
          break;
        }
        if (m.phase === 'work') {
          if (c.mtbf > 0) {
            m.failIn -= 1;
            if (m.failIn <= 0) {
              const fix = Math.max(60, Math.round(this.exp(c.mttr * 60)));
              m.repair = fix; m.failIn = this.drawFail(c);
              st.failures++; st.repairSec += fix; tag = 'down';
              this.note('crit', `${c.name}: machine failed, about ${Math.round(fix / 60)} min to repair.`);
              break;
            }
          }
          m.rem -= speed; tag = 'busy';
          if (m.rem <= 0) this.complete(s, m);
        }
        break;
      }
    }
    m.tag = tag;
    st.time[tag]++;
    st.machSec++;
    if (tag === 'busy' || tag === 'setup' || tag === 'down') st.tickActive++;
  }

  tickStation(s, cal) {
    const speed = this.speedOf(s);
    s.stats.tickActive = 0;
    for (const m of s.machines) this.tickMachine(s, m, cal, speed);
    for (let i = s.machines.length - 1; i >= 0; i--) {
      const m = s.machines[i];
      if (m.retire && m.phase === 'idle' && m.repair <= 0) s.machines.splice(i, 1);
    }
    if (!cal.planned) return;
    const len = s.role === 'feeder' ? s.kit.length : s.inQ.length;
    const stt = s.stats;
    stt.bufInt += len; stt.bufTicks++; stt.maxBuf = Math.max(stt.maxBuf, len);
    const n = Math.max(1, s.machines.length);
    stt.emaActive += EMA_ALPHA * (stt.tickActive / n - stt.emaActive);
  }

  step(seconds, quiet = false) {
    const wasLog = this.log.length;
    for (let k = 0; k < seconds; k++) {
      const cal = calendar(this.t, this.line.shifts);
      if (this.events.length || this.mod.material || this.mod.surge) this.refreshMods();
      if (cal.planned !== this.prevPlanned || cal.shift !== this.prevShift) {
        if (this.prevPlanned !== undefined) this.note('info', cal.planned ? `Shift ${cal.shift} started.` : 'Production day ended. Line stopped.');
        this.prevPlanned = cal.planned; this.prevShift = cal.shift;
      }
      if (cal.onBreak !== this.prevBreak) {
        if (this.prevBreak !== undefined) this.note('info', cal.onBreak ? 'Break started on manual stations.' : 'Break ended.');
        this.prevBreak = cal.onBreak;
      }
      if (cal.planned) {
        for (const f of this.feeders) this.tickStation(f, cal);
        for (let i = this.main.length - 1; i >= 0; i--) this.tickStation(this.main[i], cal);
        this.release();
        this.plannedSec++;
        this.wipInt += this.wip();
        if (this.plannedSec % 60 === 0) this.recordMinute();
      }
      this.t++;
    }
    if (quiet) this.log.length = Math.min(this.log.length, wasLog);
  }

  recordMinute() {
    this.shipWindow.push(this.minShips); this.minShips = 0;
    if (this.shipWindow.length > 15) this.shipWindow.shift();
    const uph = this.shipWindow.reduce((a, b) => a + b, 0) * (60 / this.shipWindow.length);
    this.history.push({
      t: this.t, clock: clockLabel(this.t).label, uph: +uph.toFixed(1), wip: this.wip(), shipped: this.shipped,
      demand: +(this.line.demand * (1 + this.mod.surge / 100)).toFixed(1),
    });
    if (this.history.length > 240) this.history.shift();
  }

  // ---- read-out ----
  stationStatus(s) {
    const tags = s.machines.map(m => m.tag);
    const n = tags.length || 1, c = k => tags.filter(t => t === k).length;
    if (c('off') === n) return 'off';
    if (c('down') === n) return 'down';
    if (c('down') > 0) return 'degraded';
    if (c('blocked') > n / 2) return 'blocked';
    if (c('starved') > n / 2) return 'starved';
    if (c('setup') > 0 && c('busy') === 0) return 'setup';
    return 'running';
  }

  stationMetrics(s) {
    const st = s.stats, c = s.cfg, T = st.time;
    const planned = T.busy + T.setup + T.down + T.blocked + T.starved || 1;
    const pct = k => 100 * T[k] / planned;
    const idealPerUnit = c.cycle / (c.batch || 1);
    const avail = 1 - T.down / planned;
    const perf = T.busy > 0 ? clamp(st.units * idealPerUnit / T.busy, 0, 1) : 0;
    const qual = st.units > 0 ? st.good / st.units : 1;
    return {
      id: s.id, name: c.name, short: c.short, type: c.type, role: s.role, accent: c.accent,
      status: this.stationStatus(s),
      machines: s.machines.map(m => m.tag),
      buffer: s.role === 'feeder' ? s.kit.length : s.inQ.length,
      bufferCap: c.buffer, rework: s.reworkQ.length,
      avgBuffer: st.bufTicks ? st.bufInt / st.bufTicks : 0, maxBuffer: st.maxBuf,
      share: { busy: pct('busy'), setup: pct('setup'), down: pct('down'), blocked: pct('blocked'), starved: pct('starved') },
      kitWaitPct: 100 * T.kit / planned,
      utilisation: 100 * (T.busy + T.setup) / planned,
      units: st.units, good: st.good, defects: st.defects, scrap: st.scrap, reworkOut: st.reworkOut, reworkIn: st.reworkIn,
      failures: st.failures, downMin: T.down / 60,
      fpy: st.units ? 100 * st.good / st.units : 100,
      oee: { a: avail * 100, p: perf * 100, q: qual * 100, oee: avail * perf * qual * 100 },
      active: st.emaActive * 100,
    };
  }

  snapshot() {
    const sts = this.st.map(s => this.stationMetrics(s));
    let bn = -1, best = 0.55 * 100;
    sts.forEach((s, i) => { if (s.active > best) { best = s.active; bn = i; } });
    const hours = this.plannedSec / 3600;
    const leads = [...this.leads].sort((a, b) => a - b);
    const demand = this.line.demand * (1 + this.mod.surge / 100);
    const cal = calendar(this.t, this.line.shifts);
    const rolled = this.main.reduce((a, s) => a * (s.stats.units ? s.stats.good / s.stats.units : 1), 1);
    return {
      t: this.t, clock: clockLabel(this.t), cal, stations: sts, bottleneck: bn >= 0 ? sts[bn].id : null,
      line: {
        released: this.released, shipped: this.shipped, scrapped: this.scrapped, wip: this.wip(),
        uph: hours > 0.05 ? this.shipped / hours : 0,
        uphNow: this.history.length ? this.history[this.history.length - 1].uph : 0,
        demand, hours, avgWip: this.plannedSec ? this.wipInt / this.plannedSec : 0,
        leadMin: this.leadN ? this.leadSum / this.leadN / 60 : 0,
        leadP90Min: leads.length ? leads[Math.floor(leads.length * 0.9)] / 60 : 0,
        rty: rolled * 100,
        attainment: demand > 0 && hours > 0.05 ? 100 * (this.shipped / hours) / demand : 0,
      },
      history: this.history, events: this.events.map(e => ({ ...e, left: e.until - this.t })), log: this.log,
    };
  }
}
