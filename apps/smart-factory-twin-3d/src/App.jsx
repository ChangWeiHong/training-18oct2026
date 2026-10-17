import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, CheckCircle2, ChevronDown,
  Clock3, Factory, Gauge, Info, Pause, Play, RotateCcw, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, TrendingUp, TriangleAlert, Zap
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import FactoryScene from './FactoryScene.jsx';
import { INITIAL, BASELINE_RATE, SHIFT_HOURS, compute } from './simulation.js';

const fmt = (value, decimals = 1) => Number.isFinite(value) ? value.toFixed(decimals) : '0.0';

function initialTrend(rate) {
  return Array.from({ length: 28 }, (_, i) => ({
    time: `${String(i).padStart(2, '0')}`,
    value: Math.max(0, +(rate * (0.967 + .025 * Math.sin(i * .71) + .012 * Math.cos(i * 1.69))).toFixed(1))
  }));
}
function MetricCard({ label, value, unit, detail, icon: Icon, intent = 'cyan', pulse, trend }) {
  return <div className={`metric-card ${intent}`}>
    <div className="metric-top"><span>{label}</span><Icon size={16} strokeWidth={1.75} /></div>
    <div className="metric-primary"><strong>{value}</strong>{unit && <span>{unit}</span>}</div>
    <div className="metric-foot"><span className="metric-line" />{detail}{trend != null && <span className={`metric-change ${trend >= 0 ? 'up' : 'down'}`}>{trend >= 0 ? '+' : ''}{fmt(trend)}%</span>}</div>
    {pulse && <div className="metric-pulse" />}
  </div>;
}
function MicroPill({ children, dot, color }) { return <span className="micro-pill">{dot && <i style={{ backgroundColor: color || '#39dfbe' }} />}{children}</span>; }

const tooltipStyle = {
  contentStyle: { background: '#0b1b29', border: '1px solid #234558', borderRadius: 8, color: '#d9eff6', fontSize: 11, boxShadow: '0 12px 30px #0008' },
  labelStyle: { color: '#7ea5b7', marginBottom: 5 },
};

export default function App() {
  const [stations, setStations] = useState(() => INITIAL.map(s => ({ ...s })));
  const [selectedIndex, setSelectedIndex] = useState(1);
  const [downtimeTarget, setDowntimeTarget] = useState(1);
  const [running, setRunning] = useState(true);
  const [ticks, setTicks] = useState(0);
  const [history, setHistory] = useState(() => initialTrend(BASELINE_RATE));
  const [notice, setNotice] = useState('');
  const noticeTimeout = useRef(null);
  const { effective, bottleneckIndex, throughput, utilisation, lineUtilisation, balanceEfficiency, output } = useMemo(() => compute(stations), [stations]);
  const bottleneck = stations[bottleneckIndex];
  const selected = stations[selectedIndex];
  const baselineDelta = ((throughput / BASELINE_RATE) - 1) * 100;
  const onCycle = useCallback((index, cycle) => setStations(prev => prev.map((s, i) => i === index ? { ...s, cycle: Number(cycle) } : s)), []);
  const onDowntime = useCallback((index, downtime) => setStations(prev => prev.map((s, i) => i === index ? { ...s, downtime: Number(downtime) } : s)), []);
  const flash = useCallback((message) => {
    clearTimeout(noticeTimeout.current);
    setNotice(message);
    noticeTimeout.current = setTimeout(() => setNotice(''), 5500);
  }, []);

  const improve = () => {
    const target = stations[bottleneckIndex];
    if (target.cycle <= 15) { flash('This station has reached the 15-second minimum cycle time. Adjust other stations or reset to continue.'); return; }
    const next = stations.map((s, i) => i === bottleneckIndex ? { ...s, cycle: Math.max(15, Math.round(s.cycle * .8 * 10) / 10) } : s);
    const newSim = compute(next);
    setStations(next);
    setSelectedIndex(bottleneckIndex);
    setRunning(true);
    const changed = newSim.bottleneckIndex !== bottleneckIndex;
    const appliedReduction = (1 - next[bottleneckIndex].cycle / target.cycle) * 100;
    flash(`${target.name} optimized by ${fmt(appliedReduction, 0)}% (${fmt(target.cycle)}s → ${fmt(next[bottleneckIndex].cycle)}s). ${changed ? `Constraint moved to ${next[newSim.bottleneckIndex].name}.` : 'It remains the constraint.'}`);
  };
  const reset = () => {
    setStations(INITIAL.map(s => ({ ...s })));
    setSelectedIndex(1);
    setDowntimeTarget(1);
    setHistory(initialTrend(BASELINE_RATE));
    setTicks(0);
    setRunning(true);
    flash('Factory model reset to baseline scenario.');
  };

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setTicks(v => v + 1), 1800);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    const jitter = .98 + .013 * Math.sin(ticks * .83) + .008 * Math.cos(ticks * 1.7);
    setHistory(prev => [...prev.slice(-27), { time: `${String(ticks % 100).padStart(2, '0')}`, value: +(throughput * jitter).toFixed(1) }]);
  }, [ticks, throughput]);
  useEffect(() => () => clearTimeout(noticeTimeout.current), []);

  const maxCapacity = Math.max(100, Math.ceil(throughput / 10) * 10 + 10);
  return <div className="app-shell">
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark"><Factory size={19} strokeWidth={2.5} /></div>
        <div className="brand-word"><strong>FORGE<span>.</span></strong><small>INDUSTRIAL INTELLIGENCE</small></div>
        <div className="brand-divider" /><div className="brand-module">DIGITAL TWIN <span>/</span> PRODUCTION SYSTEMS</div>
      </div>
      <div className="header-right"><span className="header-id">FACILITY <b>AX-01</b></span><span className="header-separator" />
        <div className="live-badge"><span className={`live-dot ${running ? '' : 'paused'}`} />{running ? 'SIMULATION RUNNING' : 'SIMULATION PAUSED'}</div>
        <div className="avatar-square">AX</div>
      </div>
    </header>

    <main className="page-content">
      <div className="page-heading">
        <div><div className="eyebrow"><span className="eyebrow-line" /> PRODUCTION ENGINEERING / WHAT-IF LAB <span className="eyebrow-dash">/</span> 01</div>
          <h1>Smart Factory <span>Digital Twin</span></h1>
          <p>Five automotive production stages <span className="heading-dot">·</span> Interactive capacity and downtime model</p>
        </div>
        <div className="heading-actions">
          <button className="btn btn-secondary" onClick={() => setRunning(v => !v)}>{running ? <Pause size={15} /> : <Play size={15} />}{running ? 'Pause' : 'Resume'}</button>
          <button className="btn btn-outline" onClick={reset}><RotateCcw size={15} />Reset Simulation</button>
          <button className="btn btn-primary" onClick={improve}><Zap size={16} fill="currentColor" />Simulate Improvement<ArrowRight size={15}/></button>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard label="ESTIMATED THROUGHPUT" value={fmt(throughput)} unit="units/hr" detail="Steady-state line capacity" icon={Activity} pulse trend={baselineDelta} />
        <MetricCard label="CURRENT BOTTLENECK" value={bottleneck.name} detail={`${fmt(effective[bottleneckIndex])}s effective cycle`} icon={TriangleAlert} intent="amber" />
        <MetricCard label="EST. LINE UTILISATION" value={fmt(lineUtilisation, 0)} unit="%" detail="Mean available-capacity load" icon={Gauge} intent="teal" />
        <MetricCard label="ESTIMATED SHIFT OUTPUT" value={output.toLocaleString()} unit="units" detail={`${SHIFT_HOURS}-hour production shift`} icon={Boxes} intent="blue" />
      </div>

      <div className="work-grid">
        <section className="panel factory-panel">
          <div className="panel-header factory-panel-header">
            <div className="panel-title"><span className="panel-icon"><Factory size={16}/></span><div><h2>Production Floor <span className="heading-suffix">/ ISOMETRIC VIEW</span></h2><p>5 PROCESS STAGES · MULTI-EQUIPMENT MODEL</p></div></div>
            <div className="panel-header-right"><MicroPill dot>5 stages simulated</MicroPill><span className="balance-inline">BALANCE EFFICIENCY <b>{fmt(balanceEfficiency, 1)}%</b></span><div className="view-pill">VIEW <b>01</b> <ChevronDown size={12}/></div></div>
          </div>
          <FactoryScene stations={stations} bottleneckIndex={bottleneckIndex} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} running={running} throughput={throughput} />
          <div className="factory-toolbar">
            <div className="factory-legend"><span><i className="legend-dot normal" />Operational</span><span><i className="legend-dot warning" />Bottleneck</span><span><i className="legend-flow" />Material flow</span></div>
            <div className="factory-hint">CLICK A STATION TO INSPECT <ArrowUpRight size={14}/></div>
          </div>
          <div className="station-detail">
            <div className="detail-heading"><span className="detail-number">{String(selectedIndex + 1).padStart(2, '0')}</span><div><small>SELECTED ASSET</small><strong>{selected.name}</strong></div></div>
            <div className="detail-stats"><div><small>CYCLE TIME</small><strong>{fmt(selected.cycle)} <span>s</span></strong></div><div><small>EFFECTIVE CYCLE</small><strong>{fmt(effective[selectedIndex])} <span>s</span></strong></div><div><small>UTILISATION</small><strong>{fmt(utilisation[selectedIndex], 0)} <span>%</span></strong></div><div><small>CAPACITY</small><strong>{fmt(3600/effective[selectedIndex])} <span>/hr</span></strong></div></div>
            <div className={`detail-status ${selectedIndex === bottleneckIndex ? 'critical' : ''}`}><span className="status-dot" />{selectedIndex === bottleneckIndex ? 'LINE CONSTRAINT' : 'NOMINAL'}</div>
          </div>
        </section>

        <aside className="panel controls-panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-icon"><SlidersHorizontal size={16}/></span><div><h2>Station Controls</h2><p>ADJUST LINE PARAMETERS</p></div></div><span className="control-active-label">EDIT MODE</span></div>
          <div className="controls-inner">
            <div className="setting-note"><Info size={13} />Adjust cycle times to stress-test the line</div>
            <div className="station-controls">
              {stations.map((station, i) => <div key={station.id} className={`station-setting ${selectedIndex === i ? 'active' : ''} ${bottleneckIndex === i ? 'constrained' : ''}`} onClick={() => setSelectedIndex(i)}>
                <div className="setting-main"><div className="station-identifier"><span className="station-index">0{i+1}</span><span className="station-name">{station.name}</span>{bottleneckIndex === i && <span className="limit-tag">LIMIT</span>}</div><div className="cycle-reading"><b>{fmt(station.cycle, station.cycle % 1 ? 1 : 0)}</b><span>s</span></div></div>
                <input type="range" min="15" max="100" step="1" value={station.cycle} onClick={e => e.stopPropagation()} onChange={e => onCycle(i, e.target.value)} aria-label={`${station.name} cycle time in seconds`} style={{ '--pct': `${(station.cycle - 15) / 85 * 100}%`, '--slider-color': bottleneckIndex === i ? '#ffa458' : '#41c8dd' }} />
                <div className="setting-foot"><span>15s</span><span>{station.downtime ? `${station.downtime}% downtime` : `${fmt(3600/effective[i], 0)} units/hr capacity`}</span><span>100s</span></div>
              </div>)}
            </div>
            <div className="downtime-panel">
              <div className="downtime-heading"><div className="downtime-label"><Clock3 size={14} /><strong>Downtime Injector</strong></div><span>WHAT-IF</span></div>
              <div className="downtime-select-wrap"><select value={downtimeTarget} onChange={e => {const index=Number(e.target.value); setDowntimeTarget(index); setSelectedIndex(index);}} aria-label="Choose station for downtime injection">{stations.map((s,i)=><option key={s.id} value={i}>{String(i + 1).padStart(2, '0')} / {s.name}</option>)}</select><ChevronDown size={14}/></div>
              <div className="downtime-rate"><span>Unplanned downtime</span><strong>{stations[downtimeTarget].downtime}%</strong></div>
              <input className="downtime-slider" type="range" min="0" max="60" step="5" value={stations[downtimeTarget].downtime} style={{ '--pct': `${stations[downtimeTarget].downtime / 60 * 100}%`, '--slider-color': '#ffa458' }} onChange={e => onDowntime(downtimeTarget, e.target.value)} aria-label="Unplanned downtime percentage" />
              <div className="downtime-bottom"><span>0% <span className="slider-muted">—</span> 60%</span><button onClick={() => onDowntime(downtimeTarget, 0)} disabled={!stations[downtimeTarget].downtime}>Clear downtime <RotateCcw size={12}/></button></div>
            </div>
          </div>
        </aside>
      </div>

      <div className="analytics-grid">
        <section className="panel chart-panel"><div className="chart-heading"><div><div className="section-kicker"><span className="tiny-dash" /> PERFORMANCE TREND</div><h2>Estimated Throughput <span className="light-title">/ units per hour</span></h2></div><span className="mini-live"><i/> MODEL OUTPUT</span></div>
          <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history} margin={{ top: 12, right: 8, left: -23, bottom: -5 }}>
            <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2ad5df" stopOpacity=".22"/><stop offset="100%" stopColor="#2ad5df" stopOpacity="0"/></linearGradient></defs>
            <CartesianGrid stroke="#233844" strokeDasharray="3 6" vertical={false} opacity=".7"/>
            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#648397', fontSize: 10 }} interval={5} tickFormatter={v=>`${v}m`}/>
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#648397', fontSize: 10 }} domain={[0, maxCapacity]} tickCount={4}/>
            <Tooltip {...tooltipStyle} formatter={v=>[`${fmt(v)} units/hr`, 'Sim. throughput']} labelFormatter={v=>`Sample ${v}`} />
            <Area dataKey="value" type="monotone" stroke="#36d5e3" strokeWidth={2.3} fill="url(#chartFill)" isAnimationActive animationDuration={450} dot={false} activeDot={{r:4,stroke:'#122737',strokeWidth:2,fill:'#8efafe'}} />
          </AreaChart></ResponsiveContainer></div>
          <div className="chart-footer"><span><i className="chart-key cyan" />Estimated rate</span><span>REFRESH · EVERY 1.8 SEC <span className="foot-sep">|</span> 28 SAMPLES</span></div>
        </section>
        <section className="panel chart-panel"><div className="chart-heading"><div><div className="section-kicker"><span className="tiny-dash" /> CAPACITY ANALYSIS</div><h2>Station Utilisation <span className="light-title">/ estimated %</span></h2></div><span className="utilisation-caption">MAX 100%</span></div>
          <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={stations.map((s,i)=>({name:s.short,value:+utilisation[i].toFixed(1),full:s.name,bottleneck:i===bottleneckIndex}))} margin={{ top: 4, right: 19, left: 9, bottom: -5 }}>
            <CartesianGrid stroke="#223847" strokeDasharray="3 6" horizontal={false} opacity=".65" />
            <XAxis type="number" domain={[0,100]} tickCount={5} axisLine={false} tickLine={false} tick={{fill:'#648397',fontSize:10}} tickFormatter={v=>`${v}%`}/>
            <YAxis dataKey="name" type="category" width={62} axisLine={false} tickLine={false} tick={{fill:'#97b7c8',fontSize:11}}/>
            <Tooltip {...tooltipStyle} formatter={v=>[`${fmt(v)}%`, 'Estimated utilization']} />
            <Bar dataKey="value" barSize={11} radius={[0,4,4,0]} isAnimationActive animationDuration={400}>{stations.map((s,i)=><Cell key={s.id} fill={i===bottleneckIndex ? '#ffae65' : i===selectedIndex ? '#45e5dc' : '#287c92'} />)}</Bar>
          </BarChart></ResponsiveContainer></div>
          <div className="chart-footer"><span><i className="chart-key amber" />100% = constraining station</span><span>STEADY-STATE ASSUMPTION</span></div>
        </section>
      </div>

      <div className="insight-strip">
        <div className="insight-alert-icon"><TriangleAlert size={19}/></div>
        <div className="insight-copy"><strong>BOTTLENECK DETECTED <span>/ {bottleneck.name.toUpperCase()}</span></strong>
          <p><b>{bottleneck.name}</b> has the longest effective cycle ({fmt(effective[bottleneckIndex])}s/unit), limiting estimated line throughput to <b>{fmt(throughput)} units/hr</b>. {bottleneck.downtime ? `${bottleneck.downtime}% injected downtime is reducing available capacity.` : 'Reduce its cycle time or inject downtime to explore new constraints.'}</p>
        </div>
        <div className="insight-opportunity"><small>VS. BASELINE</small><strong className={baselineDelta >= 0 ? 'positive' : 'negative'}>{baselineDelta >= 0 ? <ArrowUpRight size={18}/> : <ArrowDownRight size={18}/>} {baselineDelta > 0 ? '+' : ''}{fmt(baselineDelta)}%</strong></div>
      </div>

      <footer className="app-footer"><span><ShieldCheck size={13}/> DEMO / SYNTHETIC INPUTS <span className="footer-divider">•</span> NO PLC OR LIVE FACTORY CONNECTION</span>
        <span>MODEL: 3600 / MAX EFFECTIVE CYCLE <span className="footer-divider">•</span> 8H SHIFT <span className="footer-divider">•</span> IDEAL SERIAL FLOW, NO BUFFER PHYSICS</span></footer>
    </main>
    {notice && <div className="toast-notice" role="status"><span className="toast-symbol"><CheckCircle2 size={19}/></span><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}
  </div>;
}
