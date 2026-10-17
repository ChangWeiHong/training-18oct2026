import React from 'react';
import { Field, STATUS_COLOR, STATUS_TEXT, STATE_COLOR, fmt } from './ui.jsx';
import { OP_TYPES } from '../sim/config.js';

function StateBar({ share }) {
  const keys = ['busy', 'setup', 'blocked', 'starved', 'down'];
  return <div className="statebar" role="img" aria-label={keys.map(k => `${k} ${fmt(share[k], 0)}%`).join(', ')}>
    {keys.map(k => <span key={k} style={{ width: `${share[k]}%`, background: STATE_COLOR[k] }} title={`${k} ${fmt(share[k], 1)}%`} />)}
  </div>;
}

export default function Inspector({ cfg, metric, stations, onChange, isBottleneck }) {
  if (!cfg || !metric) return null;
  const t = cfg.type;
  const set = (k) => (v) => onChange(cfg.id, { [k]: v });
  const main = stations.filter(s => !s.feeds);
  const reworkChoices = main.slice(0, main.findIndex(s => s.id === cfg.id) + 1);
  const batchy = t === 'oven' || t === 'logistics';
  return <div className="inspector">
    <div className="insp-head">
      <div>
        <small>SELECTED STATION · {OP_TYPES[t].label.toUpperCase()}</small>
        <strong>{cfg.name}</strong>
        <p>{OP_TYPES[t].blurb}</p>
      </div>
      <div className="insp-status" style={{ borderColor: STATUS_COLOR[metric.status] }}>
        <i style={{ background: STATUS_COLOR[metric.status] }} />{STATUS_TEXT[metric.status]}{isBottleneck && <em>LIMIT</em>}
      </div>
    </div>
    <div className="insp-stats">
      <div><small>BUSY</small><b>{fmt(metric.utilisation, 0)}<i>%</i></b></div>
      <div><small>BUFFER</small><b>{metric.buffer}<i>/{metric.bufferCap}</i></b></div>
      <div><small>FIRST-PASS YIELD</small><b>{fmt(metric.fpy, 1)}<i>%</i></b></div>
      <div><small>OEE</small><b>{fmt(metric.oee.oee, 0)}<i>%</i></b></div>
      <div><small>FAILURES</small><b>{metric.failures}<i>{fmt(metric.downMin, 0)} min</i></b></div>
    </div>
    <StateBar share={metric.share} />
    <div className="statekey">{['busy', 'setup', 'blocked', 'starved', 'down'].map(k => <span key={k}><i style={{ background: STATE_COLOR[k] }} />{k} {fmt(metric.share[k], 0)}%</span>)}</div>

    <div className="insp-grid">
      <Field label="Cycle time" value={cfg.cycle} min={10} max={260} unit="s" onChange={set('cycle')}
        hint={batchy ? `Per ${cfg.batch}-unit cycle` : 'Mean time per unit on one machine'} />
      <Field label="Variability" value={Math.round(cfg.cv * 100)} min={0} max={40} unit="%" onChange={v => onChange(cfg.id, { cv: v / 100 })}
        hint="Coefficient of variation of cycle time" />
      <Field label="Parallel machines" value={cfg.machines} min={1} max={4} onChange={set('machines')} hint="Identical machines sharing the queue" />
      <Field label="Input buffer" value={cfg.buffer} min={1} max={20} unit=" units" onChange={set('buffer')}
        hint={t === 'feeder' ? 'Kit buffer ahead of marriage' : 'Space before this station'} />
      <Field label="MTBF" value={cfg.mtbf} min={0} max={600} step={10} unit=" min" onChange={set('mtbf')}
        display={v => (v === 0 ? 'No failures' : v)} hint="Operating minutes between failures" />
      <Field label="MTTR" value={cfg.mttr} min={1} max={90} unit=" min" disabled={cfg.mtbf === 0} onChange={set('mttr')} hint="Mean repair time" />
      <Field label="First-pass yield" value={cfg.fpy} min={70} max={100} step={0.5} unit="%" onChange={set('fpy')} hint="Share of units passing first time" />
      <Field label="Scrap share of defects" value={cfg.scrapShare} min={0} max={100} step={5} unit="%" disabled={cfg.fpy >= 100} onChange={set('scrapShare')}
        hint="The rest return for rework" />
      <Field label="Changeover" value={cfg.changeover} min={0} max={180} step={2} unit="s" onChange={set('changeover')} hint="Added when the model changes" />
      <Field label="Line speed" value={cfg.speedPct} min={60} max={130} step={5} unit="%" onChange={set('speedPct')} hint="Over- or under-drive against nominal" />
      {cfg.manned && <Field label="Staffing" value={cfg.staffing} min={50} max={100} step={5} unit="%" onChange={set('staffing')} hint="Operators present. Sets work pace." />}
      {batchy && <Field label="Batch size" value={cfg.batch} min={1} max={8} onChange={set('batch')} hint="Units processed per cycle" />}
    </div>
    {!cfg.feeds && cfg.fpy < 100 && <label className="fld sel">
      <span className="fld-top"><span className="fld-label">Rework returns to</span></span>
      <select value={cfg.reworkTo || ''} onChange={e => onChange(cfg.id, { reworkTo: e.target.value || null })}>
        <option value="">Nowhere (scrap every defect)</option>
        {reworkChoices.map(s => <option key={s.id} value={s.id}>{s.id === cfg.id ? `${s.name} (repeat pass)` : s.name}</option>)}
      </select>
    </label>}
  </div>;
}
