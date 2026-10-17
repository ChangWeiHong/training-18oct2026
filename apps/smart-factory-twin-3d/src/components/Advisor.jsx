import React, { useRef, useState } from 'react';
import { Sparkles, ArrowUpRight } from 'lucide-react';
import { advise } from '../sim/analysis.js';
import { fmt } from './ui.jsx';

export default function Advisor({ config, onApply }) {
  const [state, setState] = useState({ phase: 'idle', progress: 0, out: null });
  const abort = useRef(null);
  const run = async () => {
    abort.current?.abort();
    const ctl = new AbortController(); abort.current = ctl;
    setState({ phase: 'running', progress: 0, out: null });
    const out = await advise(config.stations, config.line, { signal: ctl.signal, onProgress: p => setState(s => (s.phase === 'running' ? { ...s, progress: p } : s)) });
    if (out) setState({ phase: 'done', progress: 1, out });
  };
  const top = state.out?.results.slice(0, 8) || [];
  return <div className="advisor">
    <div className="advisor-bar">
      <p>Tries each change on its own against the current setup. 4 random seeds, 12 hours each, demand lifted to maximum so the run measures capacity.</p>
      <button className="btn btn-primary" onClick={run} disabled={state.phase === 'running'}><Sparkles size={15} />{state.phase === 'running' ? `Running ${Math.round(state.progress * 100)}%` : 'Find best improvements'}</button>
    </div>
    {state.phase === 'running' && <div className="adv-progress"><span style={{ width: `${state.progress * 100}%` }} /></div>}
    {state.out && <>
      <div className="adv-base">Baseline capacity <b>{fmt(state.out.base.uph)}</b> units/h · average WIP <b>{fmt(state.out.base.wip, 0)}</b> · lead time <b>{fmt(state.out.base.leadMin, 0)}</b> min</div>
      <table className="adv-table">
        <thead><tr><th>#</th><th>Change</th><th>Capacity</th><th>Gain</th><th>Lead time</th><th /></tr></thead>
        <tbody>{top.map((r, i) => <tr key={r.key}>
          <td className="mono">{i + 1}</td><td>{r.label}</td><td className="mono">{fmt(r.uph)}</td>
          <td className={`mono ${r.deltaPct >= 0 ? 'pos' : 'neg'}`}>{r.deltaPct >= 0 ? '+' : ''}{fmt(r.deltaPct)}%</td>
          <td className="mono">{fmt(r.leadMin, 0)} min</td>
          <td><button className="btn btn-outline" onClick={() => onApply(r)}>Apply<ArrowUpRight size={13} /></button></td>
        </tr>)}</tbody>
      </table>
      <p className="adv-note">Differences under about 3% fall inside run-to-run noise. Treat the ranking as a shortlist.</p>
    </>}
  </div>;
}
