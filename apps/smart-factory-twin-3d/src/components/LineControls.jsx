import React from 'react';
import { Field, Segmented } from './ui.jsx';
import { VARIANTS } from '../sim/config.js';

export default function LineControls({ line, onChange, onReseed }) {
  const total = VARIANTS.reduce((a, v) => a + (line.mix[v.id] || 0), 0) || 1;
  return <div className="linectl">
    <Field label="Demand target" value={line.demand} min={0} max={90} unit=" /h" display={v => (v === 0 ? 'Max' : v)}
      onChange={v => onChange({ demand: v })} hint="Release rate at the first station. Max = release whenever there is room." />
    <div className="fld"><span className="fld-top"><span className="fld-label">Release policy</span></span>
      <Segmented label="Release policy" value={line.release} onChange={v => onChange({ release: v })}
        options={[{ value: 'conwip', label: 'CONWIP', title: 'Release only while work in process is under the cap' }, { value: 'push', label: 'Push', title: 'Release at the demand rate regardless of work in process' }]} />
      <span className="fld-hint">{line.release === 'conwip' ? 'A new unit starts only when one leaves, up to the cap.' : 'Units enter at the target rate. Buffers absorb or block.'}</span>
    </div>
    <Field label="WIP cap" value={line.wipCap} min={10} max={100} unit=" units" disabled={line.release !== 'conwip'} onChange={v => onChange({ wipCap: v })}
      hint="Maximum vehicles in the system" />
    <div className="fld"><span className="fld-top"><span className="fld-label">Shifts per day</span></span>
      <Segmented label="Shifts per day" value={line.shifts} onChange={v => onChange({ shifts: v })}
        options={[{ value: 1, label: '1 × 8h' }, { value: 2, label: '2 × 8h' }, { value: 3, label: '3 × 8h' }]} />
      <span className="fld-hint">Starts 06:00. Manual stations stop for 15, 30 and 15 minute breaks.</span>
    </div>
    <div className="fld"><span className="fld-top"><span className="fld-label">Model mix</span><b>{VARIANTS.map(v => `${Math.round(100 * (line.mix[v.id] || 0) / total)}`).join(' / ')}<i>%</i></b></span>
      <div className="mixrows">
        {VARIANTS.map(v => <label key={v.id} className="mixrow"><span>{v.name}</span>
          <input type="range" min={0} max={100} step={5} value={line.mix[v.id] || 0} aria-label={`${v.name} share`}
            onChange={e => onChange({ mix: { [v.id]: Number(e.target.value) } })}
            style={{ '--pct': `${line.mix[v.id] || 0}%`, '--slider-color': '#5bbfb3' }} /></label>)}
      </div>
      <span className="fld-hint">EVs need a slower powertrain cell. SUVs take longer on manual stations.</span>
    </div>
    <div className="fld"><span className="fld-top"><span className="fld-label">Sequencing</span></span>
      <Segmented label="Sequencing" value={line.campaign} onChange={v => onChange({ campaign: v })}
        options={[{ value: 1, label: 'Random' }, { value: 3, label: 'Runs of 3' }, { value: 6, label: 'Runs of 6' }, { value: 12, label: 'Runs of 12' }]} />
      <span className="fld-hint">Longer runs of one model cut changeovers but raise lead time.</span>
    </div>
    <button className="btn btn-outline linectl-seed" onClick={onReseed} title="Restart with a new random seed">New random seed</button>
  </div>;
}
