import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Boxes, CheckCircle2, Clock3, Factory, Gauge, Layers, ListChecks, Pause, Play, RotateCcw,
  ShieldCheck, SlidersHorizontal, Timer, TriangleAlert, Workflow, Zap, Sparkles, TableProperties, BarChart3
} from 'lucide-react';
import FactoryScene from './FactoryScene.jsx';
import FlowDiagram from './components/FlowDiagram.jsx';
import Inspector from './components/Inspector.jsx';
import LineControls from './components/LineControls.jsx';
import EventPanel from './components/EventPanel.jsx';
import Advisor from './components/Advisor.jsx';
import StationTable from './components/StationTable.jsx';
import { ThroughputChart, StateChart, BufferChart } from './components/Charts.jsx';
import { Panel, Segmented, STATUS_TEXT, fmt } from './components/ui.jsx';
import { LineSim } from './sim/engine.js';
import { analyticCapacity } from './sim/analysis.js';
import { buildConfig, SCENARIOS } from './sim/config.js';

const SPEEDS = [
  { value: 60, label: '1 min/s' }, { value: 300, label: '5 min/s' },
  { value: 900, label: '15 min/s' }, { value: 3600, label: '1 h/s' },
];
const TICK_MS = 50;
const makeSim = (cfg, seed) => new LineSim(cfg.stations, cfg.line, { seed, warmup: 2400 });

function Kpi({ label, value, unit, foot, icon: Icon, tone }) {
  return <div className={`kpi ${tone || ''}`}>
    <div className="kpi-top"><span>{label}</span><Icon size={15} strokeWidth={1.75} /></div>
    <div className="kpi-main"><strong>{value}</strong>{unit && <span>{unit}</span>}</div>
    <div className="kpi-foot">{foot}</div>
  </div>;
}

export default function App() {
  const [scenarioId, setScenarioId] = useState('baseline');
  const [config, setConfig] = useState(() => buildConfig('baseline'));
  const seedRef = useRef(7);
  const simRef = useRef(null);
  if (!simRef.current) simRef.current = makeSim(config, seedRef.current);
  const [snap, setSnap] = useState(() => simRef.current.snapshot());
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(300);
  const [selectedId, setSelectedId] = useState('final');
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(null);

  const refresh = useCallback(() => setSnap(simRef.current.snapshot()), []);
  const flash = useCallback((m) => {
    clearTimeout(noticeTimer.current); setNotice(m);
    noticeTimer.current = setTimeout(() => setNotice(''), 6000);
  }, []);

  // advance the simulation clock
  useEffect(() => {
    if (!running) return undefined;
    let carry = 0;
    const id = setInterval(() => {
      carry += speed * TICK_MS / 1000;
      const n = Math.floor(carry);
      if (n > 0) { carry -= n; simRef.current.step(n); }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, speed]);
  useEffect(() => {
    const id = setInterval(() => { if (running) refresh(); }, 250);
    return () => clearInterval(id);
  }, [running, refresh]);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const load = (cfg, seed, msg) => {
    seedRef.current = seed;
    simRef.current = makeSim(cfg, seed);
    setConfig(cfg); refresh();
    if (msg) flash(msg);
  };
  const changeScenario = (id) => {
    setScenarioId(id);
    const sc = SCENARIOS.find(s => s.id === id);
    load(buildConfig(id), seedRef.current, `Scenario loaded: ${sc.label}. ${sc.note}`);
  };
  const reset = () => load(buildConfig(scenarioId), seedRef.current, 'Run restarted with the scenario settings.');
  const reseed = () => load(config, Math.floor(Math.random() * 9000) + 11, 'Restarted with a new random seed. Your station and line edits are kept.');

  const patchStation = useCallback((id, patch) => {
    setConfig(c => ({ ...c, stations: c.stations.map(s => (s.id === id ? { ...s, ...patch } : s)) }));
    simRef.current.setStation(id, patch);
    refresh();
  }, [refresh]);
  const patchLine = useCallback((patch) => {
    setConfig(c => ({ ...c, line: { ...c.line, ...patch, mix: { ...c.line.mix, ...(patch.mix || {}) } } }));
    simRef.current.setLine(patch);
    refresh();
  }, [refresh]);
  const inject = (evt) => { simRef.current.inject(evt); refresh(); };
  const applyAdvice = (r) => {
    if (r.station) patchStation(r.station, r.patch); else patchLine(r.linePatch);
    flash(`Applied: ${r.label}. The live run continues with the new setting.`);
  };

  const metrics = useMemo(() => Object.fromEntries(snap.stations.map(s => [s.id, s])), [snap]);
  const est = useMemo(() => analyticCapacity(config.stations, config.line), [config]);
  const nameOf = (id) => config.stations.find(s => s.id === id)?.name;
  const L = snap.line;
  const bn = snap.bottleneck ? metrics[snap.bottleneck] : null;
  const selCfg = config.stations.find(s => s.id === selectedId);
  const calText = !snap.cal.planned ? 'Off shift' : snap.cal.onBreak ? `Shift ${snap.cal.shift} · break` : `Shift ${snap.cal.shift}`;
  const attain = L.attainment;

  return <div className="app-shell">
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark"><Factory size={19} strokeWidth={2.5} /></div>
        <div className="brand-word"><strong>FORGE<span>.</span></strong><small>INDUSTRIAL INTELLIGENCE</small></div>
        <div className="brand-divider" /><div className="brand-module">DIGITAL TWIN <span>/</span> PRODUCTION SYSTEMS</div>
      </div>
      <div className="header-right"><span className="header-id">FACILITY <b>AX-01</b></span><span className="header-separator" />
        <div className="live-badge"><span className={`live-dot ${running ? '' : 'paused'}`} />{running ? 'SIMULATION RUNNING' : 'SIMULATION PAUSED'}</div>
      </div>
    </header>

    <main className="page-content wide">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> PRODUCTION ENGINEERING / WHAT-IF LAB</div>
          <h1>Smart Factory <span>Digital Twin</span></h1>
          <p>Nine stations and a powertrain feeder. Discrete-event model with finite buffers, failures, rework, shifts and model mix.</p>
        </div>
        <div className="sim-clock" aria-live="off">
          <small>SIMULATED CLOCK</small>
          <strong>{snap.clock.full}</strong>
          <span className={snap.cal.planned && !snap.cal.onBreak ? 'on' : ''}>{calText}</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-group">
          <button className="btn btn-primary" onClick={() => setRunning(v => !v)}>{running ? <Pause size={15} /> : <Play size={15} />}{running ? 'Pause' : 'Run'}</button>
          <button className="btn btn-outline" onClick={reset}><RotateCcw size={15} />Restart</button>
        </div>
        <div className="toolbar-group">
          <span className="tb-label">SPEED</span>
          <Segmented label="Simulation speed" value={speed} onChange={setSpeed} options={SPEEDS} />
        </div>
        <label className="toolbar-group tb-scn">
          <span className="tb-label">SCENARIO</span>
          <select value={scenarioId} onChange={e => changeScenario(e.target.value)} aria-label="Scenario">
            {SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <p className="tb-note">{SCENARIOS.find(s => s.id === scenarioId).note}</p>
      </div>

      <div className="kpi-grid">
        <Kpi label="OUTPUT" icon={Activity} tone="lead" value={fmt(L.uph)} unit="units/h"
          foot={<>{L.demand ? `${fmt(attain, 0)}% of ${fmt(L.demand, 0)}/h target` : 'No target set'} · last 15 min {fmt(L.uphNow, 0)}/h</>} />
        <Kpi label="SHIPPED" icon={Boxes} value={L.shipped.toLocaleString()} unit="units" foot={<>{L.scrapped} scrapped · {fmt(L.hours, 1)} planned h</>} />
        <Kpi label="WORK IN PROCESS" icon={Layers} value={L.wip} unit="units" foot={<>avg {fmt(L.avgWip, 0)} · {config.line.release === 'conwip' ? `cap ${config.line.wipCap}` : 'push release'}</>} />
        <Kpi label="LEAD TIME" icon={Timer} value={fmt(L.leadMin, 0)} unit="min" foot={<>90th percentile {fmt(L.leadP90Min, 0)} min</>} />
        <Kpi label="ROLLED YIELD" icon={ShieldCheck} value={fmt(L.rty, 1)} unit="%" foot="Share passing every station first time" />
        <Kpi label="CURRENT CONSTRAINT" icon={TriangleAlert} tone="amber" value={bn ? bn.name : 'None yet'}
          foot={bn ? <>{fmt(bn.active, 0)}% active · model estimate {fmt(est.uph, 0)}/h at {nameOf(est.bottleneck)}</> : 'Run longer to detect'} />
      </div>

      <Panel icon={Factory} title="Production Floor" kicker="9 STATIONS · POWERTRAIN FEEDER · FINITE BUFFERS"
        right={<><span className="balance-inline">STATION COLOR <b>= LIVE STATE</b></span></>}>
        <FactoryScene stations={config.stations} metrics={metrics} bottleneckId={snap.bottleneck} selectedId={selectedId}
          setSelectedId={setSelectedId} running={running && snap.cal.planned} uph={L.uphNow || L.uph} />
        <div className="factory-toolbar">
          <div className="factory-legend">
            {['running', 'blocked', 'starved', 'down', 'setup'].map(k => <span key={k}><i className="legend-dot" style={{ background: { running: '#739da8', blocked: '#b9a96c', starved: '#6f8fa8', down: '#d9776a', setup: '#a79ad0' }[k] }} />{STATUS_TEXT[k]}</span>)}
            <span><i className="legend-dot warning" />Constraint</span>
          </div>
          <div className="factory-hint">Rows of blocks on the floor show each station's input buffer</div>
        </div>
      </Panel>

      <Panel icon={Workflow} title="Process Flow" kicker="BUFFERS · REWORK LOOPS · FEEDER JOIN" className="mt">
        <FlowDiagram stations={config.stations} metrics={metrics} bottleneckId={snap.bottleneck} selectedId={selectedId} onSelect={setSelectedId} />
      </Panel>

      <div className="ctl-grid mt">
        <Panel icon={SlidersHorizontal} title="Station Controls" kicker="EDIT THE SELECTED STATION"
          right={<select className="stn-pick" value={selectedId} onChange={e => setSelectedId(e.target.value)} aria-label="Select station">
            {config.stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}>
          <Inspector cfg={selCfg} metric={metrics[selectedId]} stations={config.stations} onChange={patchStation} isBottleneck={snap.bottleneck === selectedId} />
        </Panel>
        <Panel icon={Clock3} title="Line Controls" kicker="DEMAND · RELEASE · CALENDAR · MIX">
          <LineControls line={config.line} onChange={patchLine} onReseed={reseed} />
        </Panel>
        <Panel icon={Zap} title="Disruptions" kicker="INJECT AN EVENT INTO THE LIVE RUN">
          <EventPanel stations={config.stations} selectedId={selectedId} events={snap.events} log={snap.log} onInject={inject} />
        </Panel>
      </div>

      <div className="chart-grid mt">
        <Panel icon={Gauge} title="Output vs Target" kicker="15-MINUTE ROLLING UNITS/HOUR"><div className="chart-box"><ThroughputChart history={snap.history} demand={L.demand} /></div></Panel>
        <Panel icon={BarChart3} title="Where Time Goes" kicker="SHARE OF PLANNED STATION TIME"><div className="chart-box"><StateChart stations={snap.stations} /></div></Panel>
        <Panel icon={Layers} title="Buffer Fill" kicker="QUEUE BEFORE EACH STATION"><div className="chart-box"><BufferChart stations={snap.stations} /></div></Panel>
      </div>

      <Panel icon={TableProperties} title="Station Ledger" kicker="TIME STATES · QUALITY · OEE SINCE LAST RESTART" className="mt">
        <StationTable metrics={snap.stations} bottleneckId={snap.bottleneck} selectedId={selectedId} onSelect={setSelectedId} />
        <p className="ledger-note">OEE here counts only time the machine could have run: availability excludes planned breaks, performance excludes starved and blocked time. Starved and blocked time is a line effect, not an equipment loss.</p>
      </Panel>

      <Panel icon={Sparkles} title="Improvement Advisor" kicker="WHAT-IF RUNS ON THE SAME MODEL" className="mt">
        <Advisor config={config} onApply={applyAdvice} />
      </Panel>

      {bn && <div className="insight-strip">
        <div className="insight-alert-icon"><TriangleAlert size={19} /></div>
        <div className="insight-copy"><strong>CONSTRAINT <span>/ {bn.name.toUpperCase()}</span></strong>
          <p><b>{bn.name}</b> is active {fmt(bn.active, 0)}% of the time over the last 30 simulated minutes (busy, changeover or down). It was down {fmt(bn.share.down, 1)}% and in changeover {fmt(bn.share.setup, 1)}% of planned time{bn.reworkIn ? `, and handled ${bn.reworkIn} rework units` : ''}. The closed-form estimate puts line capacity at <b>{fmt(est.uph, 1)} units/h</b> limited by <b>{nameOf(est.bottleneck)}</b>. The run delivers {fmt(L.uph, 1)}. The gap comes from buffers, variability and breaks.</p>
        </div>
      </div>}

      <footer className="app-footer"><span><ListChecks size={13} /> SYNTHETIC INPUTS <span className="footer-divider">•</span> NO PLC OR LIVE FACTORY CONNECTION</span>
        <span>MODEL: 1-SECOND DISCRETE-EVENT STEPS <span className="footer-divider">•</span> SEEDED RANDOM FAILURES AND CYCLE TIMES <span className="footer-divider">•</span> SEED {seedRef.current}</span></footer>
    </main>
    {notice && <div className="toast-notice" role="status"><span className="toast-symbol"><CheckCircle2 size={19} /></span><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}
  </div>;
}
