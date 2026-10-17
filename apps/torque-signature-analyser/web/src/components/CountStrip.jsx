import StatusMark from './StatusMark.jsx';

const WITHIN_UPLOAD = "Compared within this upload. A shift across the whole batch won't show.";

const REFERENCE_TEXT = {
  supplied: (n) => `Reference: your file, ${n} rundowns.`,
  sample: (n) => `Reference: built-in sample, ${n} rundowns.`,
};

export default function CountStrip({ result }) {
  if (!result) return null;
  const { counts } = result.summary;
  const specMissing = counts.total > 0 && counts.spec_not_supplied === counts.total;
  const src = result.reference?.source;

  return (
    <section className="counts" aria-label="Summary">
      <ul className="count-list">
        <li className="count"><b>{counts.total}</b> rundowns</li>
        {specMissing ? (
          <li className="count"><span>Spec</span><StatusMark kind="not_supplied" /></li>
        ) : (
          <li className="count"><b>{counts.outside_spec}</b><StatusMark kind="outside" /></li>
        )}
        <li className="count"><b>{counts.investigate}</b><StatusMark kind="investigate" /></li>
        <li className="count"><b>{counts.cant_assess}</b><StatusMark kind="cant_assess" /></li>
      </ul>

      <div className="count-notes">
        {src === 'within-upload' ? (
          <p className="banner" role="note">{WITHIN_UPLOAD}</p>
        ) : (
          REFERENCE_TEXT[src] && <p className="note-line">{REFERENCE_TEXT[src](result.reference.rundowns)}</p>
        )}
        {result.method === 'stats' && (
          <p className="note-line">Statistics only. The Isolation Forest check did not run.</p>
        )}
        {result.warnings?.map((w, i) => (
          <p key={i} className="note-line warn">{typeof w === 'string' ? w : w.message ?? JSON.stringify(w)}</p>
        ))}
      </div>
    </section>
  );
}
