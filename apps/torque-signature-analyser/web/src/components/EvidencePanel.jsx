import StatusMark from './StatusMark.jsx';
import { evidenceLine, IF_ONLY_TEXT, AREA_ONLY_TEXT } from '../format.js';

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

      {spec === 'incomplete' && (
        <p className="evidence-note">Spec partly checked: a limit could not be assessed because the curve has no post-snug rotation.</p>
      )}
      {signature === 'cant_assess' && (
        <p className="evidence-note">Not enough of the curve to compare: no snug point or slope.</p>
      )}
      {evidence.length > 0 && (
        <ul className="evidence-list">
          {evidence.map((ev) => <li key={ev.feature}>{evidenceLine(ev)}</li>)}
        </ul>
      )}
      {hint && <p className="evidence-hint">Looks like: {hint}</p>}
      {ifOnly && <p className="evidence-note">{IF_ONLY_TEXT}</p>}
      {shape && <p className="evidence-note">{AREA_ONLY_TEXT}</p>}
      {flagged && <p className="evidence-flag">Worth investigating, not a confirmed fault.</p>}
    </div>
  );
}
