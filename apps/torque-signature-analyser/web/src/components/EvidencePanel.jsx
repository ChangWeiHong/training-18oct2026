import StatusMark from './StatusMark.jsx';

const fmt = (v) => String(Math.round(v * 10) / 10);
const withUnit = (v, unit) => (unit === '°' ? `${fmt(v)}°` : `${fmt(v)} ${unit}`);

export function evidenceLine(ev) {
  const range = `${fmt(ev.ref_lo)}–${withUnit(ev.ref_hi, ev.unit)}`;
  return `${ev.label}: ${withUnit(ev.value, ev.unit)}. Reference range: ${range}.`;
}

export default function EvidencePanel({ selected }) {
  if (!selected) return <p className="slot-empty">Select a rundown to see why it was flagged.</p>;
  const { signature, spec_result: spec, evidence = [], pattern_hint: hint, iforest_only: ifOnly } = selected;
  const flagged = signature === 'investigate' || spec === 'outside';
  const shape = signature === 'investigate' && evidence.length === 0 && !ifOnly;

  return (
    <div className="evidence">
      <p className="slot-id">{selected.id}</p>
      <p className="evidence-status"><span className="evidence-key">Signature</span> <StatusMark kind={signature} /></p>
      <p className="evidence-status"><span className="evidence-key">Spec</span> <StatusMark kind={spec} /></p>

      {signature === 'cant_assess' && (
        <p className="evidence-note">Not enough of the curve to compare: no snug point or slope.</p>
      )}
      {evidence.length > 0 && (
        <ul className="evidence-list">
          {evidence.map((ev) => <li key={ev.feature}>{evidenceLine(ev)}</li>)}
        </ul>
      )}
      {hint && <p className="evidence-hint">Looks like: {hint}</p>}
      {ifOnly && <p className="evidence-note">Unusual combination of features; no single value outside the reference range.</p>}
      {shape && <p className="evidence-note">Curve shape sits outside the reference band; no single value outside the reference range.</p>}
      {flagged && <p className="evidence-flag">Worth investigating, not a confirmed fault.</p>}
    </div>
  );
}
