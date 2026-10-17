import { useRef } from 'react';
import { Upload, RotateCw, Download, Info, FlaskConical } from 'lucide-react';
import { SPEC_FIELDS } from '../state.js';
import { TEMPLATE_URL } from '../api.js';
import { groupPacks } from '../packs.js';

export const DEMO_BADGE_TIP = 'Generated curves for training. Not from a real line.';

export default function Toolbar({
  samples, sampleId, onPickSample,
  readingsFile, referenceFile, onReadings, onReference,
  specInputs, onSpecChange, onUseSampleSpec,
  onRerun, canRerun, busy, error, specNote, referenceNote, onAbout, showUpload = false,
}) {
  const readingsRef = useRef(null);
  const referenceRef = useRef(null);

  const pick = (handler) => (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) handler(f);
  };

  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <div className="brand">
          <span className="brand-name">Torque Signature</span>
          <span className="brand-sub">Analyser</span>
          <span className="demo-badge" role="note" tabIndex={0} title={DEMO_BADGE_TIP} aria-label={`Synthetic demo data. ${DEMO_BADGE_TIP}`}>
            <FlaskConical size={12} aria-hidden="true" />
            <span>Synthetic demo data</span>
          </span>
        </div>

        <label className="field">
          <span className="field-label">Sample pack</span>
          <select
            className="control"
            value={sampleId ?? ''}
            onChange={(e) => onPickSample(e.target.value)}
            disabled={!samples.length}
            title={samples.find((s) => s.id === sampleId)?.description}
          >
            {sampleId == null && <option value="">Upload in use</option>}
            {groupPacks(samples).map((g) => (
              <optgroup key={g.joint} label={`${g.label} (illustrative spec)`}>
                {g.packs.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="btn-group">
          {showUpload && (
            <>
              <input ref={readingsRef} type="file" accept=".csv,text/csv" hidden onChange={pick(onReadings)} aria-label="Readings CSV file" />
              <input ref={referenceRef} type="file" accept=".csv,text/csv" hidden onChange={pick(onReference)} aria-label="Reference CSV file" />
              <button type="button" className="btn" onClick={() => readingsRef.current?.click()}>
                <Upload size={14} aria-hidden="true" />
                <span>Upload readings</span>
              </button>
              <button type="button" className="btn" onClick={() => referenceRef.current?.click()}>
                <Upload size={14} aria-hidden="true" />
                <span>Upload reference</span>
              </button>
              <a className="btn btn-link" href={TEMPLATE_URL} download="torque-template.csv">
                <Download size={14} aria-hidden="true" />
                <span>Template</span>
              </a>
            </>
          )}
          <button type="button" className="btn" onClick={onAbout}>
            <Info size={14} aria-hidden="true" />
            <span>About</span>
          </button>
        </div>
      </div>

      {(readingsFile || referenceFile) && (
        <p className="file-line">
          {readingsFile && <span>Readings: <b>{readingsFile.name}</b></span>}
          {referenceFile && <span>Reference: <b>{referenceFile.name}</b></span>}
        </p>
      )}

      <div className="toolbar-row spec-row" role="group" aria-label="Specification">
        <span className="field-label spec-title">Spec</span>
        {SPEC_FIELDS.map((f) => (
          <label key={f.key} className="chip">
            <span className="chip-label">{f.label}</span>
            <input
              className="chip-input"
              type="text"
              inputMode="decimal"
              value={specInputs[f.key]}
              placeholder="none"
              onChange={(e) => onSpecChange(f.key, e.target.value)}
            />
            <span className="chip-unit">{f.unit}</span>
          </label>
        ))}
        <button type="button" className="btn" onClick={onUseSampleSpec}>Use sample spec</button>
        <button type="button" className="btn btn-primary" onClick={onRerun} disabled={!canRerun || busy}>
          <RotateCw size={14} aria-hidden="true" />
          <span>Re-run</span>
        </button>
        <span className="busy" role="status" aria-live="polite">{busy ? 'Analysing' : ''}</span>
      </div>

      {specNote && <p className="note-line">{specNote}</p>}
      {referenceNote && <p className="note-line">{referenceNote}</p>}

      {error && (
        <div className="error" role="alert">
          <p className="error-text">
            {error.error}
            {error.row != null || error.column ? (
              <>
                {' '}
                <span className="error-where">
                  {[error.row != null ? `Row ${error.row}` : null, error.column ? `column ${error.column}` : null]
                    .filter(Boolean).join(', ').replace(/^./, (c) => c.toUpperCase())}.
                </span>
              </>
            ) : null}
          </p>
          {error.fix && <p className="error-fix">{error.fix}</p>}
        </div>
      )}
    </header>
  );
}
