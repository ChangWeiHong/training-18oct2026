import React, { useState } from 'react';
import { Zap, Wrench, ShieldAlert, Users, PackageX, TrendingUp } from 'lucide-react';
import { Segmented } from './ui.jsx';

const KINDS = [
  { id: 'breakdown', label: 'Breakdown', icon: Wrench, station: true, drop: false },
  { id: 'quality', label: 'Quality drop', icon: ShieldAlert, station: true, drop: 10 },
  { id: 'staff', label: 'Absence', icon: Users, station: 'optional', drop: 20 },
  { id: 'material', label: 'Supply stop', icon: PackageX, station: false, drop: false },
  { id: 'surge', label: 'Demand surge', icon: TrendingUp, station: false, drop: 25 },
];

export default function EventPanel({ stations, selectedId, events, log, onInject }) {
  const [kind, setKind] = useState('breakdown');
  const [mins, setMins] = useState(20);
  const k = KINDS.find(x => x.id === kind);
  const [target, setTarget] = useState('');
  const station = k.station === true ? (target || selectedId) : k.station === 'optional' ? (target || null) : null;
  const names = Object.fromEntries(stations.map(s => [s.id, s.name]));
  return <div className="evp">
    <div className="evp-kinds" role="group" aria-label="Event type">
      {KINDS.map(x => <button key={x.id} type="button" className={kind === x.id ? 'on' : ''} onClick={() => setKind(x.id)}><x.icon size={14} />{x.label}</button>)}
    </div>
    <div className="evp-row">
      {k.station && <label className="evp-sel"><span>Station</span>
        <select value={target || (k.station === true ? selectedId : '')} onChange={e => setTarget(e.target.value)}>
          {k.station === 'optional' && <option value="">All manual stations</option>}
          {stations.filter(s => k.id !== 'staff' || s.manned).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>}
      <label className="evp-sel"><span>Duration</span>
        <Segmented label="Duration" value={mins} onChange={setMins} options={[{ value: 10, label: '10m' }, { value: 20, label: '20m' }, { value: 45, label: '45m' }, { value: 90, label: '90m' }]} />
      </label>
    </div>
    <button className="btn btn-primary evp-go" onClick={() => onInject({ type: kind, station, minutes: mins, drop: k.drop || 0 })}><Zap size={15} fill="currentColor" />Inject now</button>
    {events.length > 0 && <ul className="evp-active" aria-label="Active events">
      {events.map(e => <li key={e.id}><b>{{ quality: 'Quality drop', staff: 'Absence', material: 'Supply stop', surge: 'Demand surge' }[e.type]}</b>
        <span>{e.station ? names[e.station] : 'Plant'}</span><em>{Math.ceil(e.left / 60)} min left</em></li>)}
    </ul>}
    <div className="evp-log" role="log" aria-label="Event log">
      <small>EVENT LOG</small>
      {log.length === 0 && <p className="evp-empty">No events yet.</p>}
      <ul>{[...log].reverse().slice(0, 14).map((l, i) => <li key={`${l.t}-${i}`} className={l.level}><time>{l.clock}</time><span>{l.text}</span></li>)}</ul>
    </div>
  </div>;
}
