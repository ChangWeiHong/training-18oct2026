import React from 'react';
import { OP_TYPES } from '../sim/config.js';
import { STATUS_COLOR, STATUS_TEXT, fmt } from './ui.jsx';

export default function StationTable({ metrics, bottleneckId, selectedId, onSelect }) {
  return <div className="tbl-scroll"><table className="stn-table">
    <thead><tr>
      <th>Station</th><th>Type</th><th>Status</th><th>Busy</th><th>Blocked</th><th>Starved</th><th>Down</th>
      <th>Buffer avg</th><th>Units</th><th>Yield</th><th>Rework</th><th>Scrap</th><th>Failures</th><th>Avail.</th><th>Perf.</th><th>OEE</th>
    </tr></thead>
    <tbody>{metrics.map(m => <tr key={m.id} className={`${selectedId === m.id ? 'sel' : ''} ${bottleneckId === m.id ? 'lim' : ''}`} onClick={() => onSelect(m.id)}>
      <td><b>{m.name}</b>{bottleneckId === m.id && <em>LIMIT</em>}</td>
      <td>{OP_TYPES[m.type].label}</td>
      <td><span className="dot" style={{ background: STATUS_COLOR[m.status] }} />{STATUS_TEXT[m.status]}</td>
      <td className="mono">{fmt(m.share.busy, 0)}%</td><td className="mono">{fmt(m.share.blocked, 0)}%</td>
      <td className="mono">{fmt(m.share.starved, 0)}%</td><td className="mono">{fmt(m.share.down, 1)}%</td>
      <td className="mono">{fmt(m.avgBuffer, 1)}/{m.bufferCap}</td><td className="mono">{m.units}</td>
      <td className="mono">{fmt(m.fpy, 1)}%</td><td className="mono">{m.reworkOut}</td><td className="mono">{m.scrap}</td>
      <td className="mono">{m.failures}</td>
      <td className="mono">{fmt(m.oee.a, 0)}%</td><td className="mono">{fmt(m.oee.p, 0)}%</td><td className="mono"><b>{fmt(m.oee.oee, 0)}%</b></td>
    </tr>)}</tbody>
  </table></div>;
}
