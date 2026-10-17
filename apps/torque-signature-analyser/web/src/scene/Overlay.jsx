import StatusMark from '../components/StatusMark.jsx';

const KINDS = ['typical', 'investigate', 'outside', 'cant_assess'];
const KIND_LABEL = { typical: 'typical', investigate: 'worth investigating', outside: 'outside spec', cant_assess: "can't assess" };

function arcPath(cx, cy, r, from, to) {
  const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x1, y1] = p(from);
  const [x2, y2] = p(to);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Simple SVG arc gauge: live torque at the cursor against the spec maximum. */
function Gauge({ torque, max, spec }) {
  const start = Math.PI * 0.8, sweep = Math.PI * 1.4;
  const top = max * 1.15;
  const f = (v) => start + sweep * Math.min(1, Math.max(0, v / top));
  const tick = (v) => {
    const a = f(v);
    return <line key={v} x1={50 + 38 * Math.cos(a)} y1={50 + 38 * Math.sin(a)} x2={50 + 46 * Math.cos(a)} y2={50 + 46 * Math.sin(a)} className="gauge-tick" />;
  };
  return (
    <svg className="gauge" viewBox="0 0 100 78" role="img" aria-label={`Torque ${torque.toFixed(1)} newton metres`}>
      <path d={arcPath(50, 50, 42, start, start + sweep)} className="gauge-track" />
      {torque > 0 && <path d={arcPath(50, 50, 42, start, f(torque))} className="gauge-fill" />}
      {spec && [spec.torque_min_nm, spec.torque_max_nm].map(tick)}
      <text x="50" y="52" textAnchor="middle" className="gauge-value">{torque.toFixed(1)}</text>
      <text x="50" y="65" textAnchor="middle" className="gauge-unit">Nm</text>
    </svg>
  );
}

/** Status legend and the illustrative-motion caption. Rendered below the canvas, never over the joint. */
export function JointStrip() {
  return (
    <div className="joint-strip">
      <ul className="joint-legend" aria-label="Head ring colours">
        {KINDS.map((k) => (
          <li key={k}><StatusMark kind={k} /></li>
        ))}
      </ul>
      <p className="joint-caption">Rotation: measured. Travel and compression: illustrative.</p>
    </div>
  );
}

/** Selected bolt, preset buttons, bolt chips and notes. Rendered above the canvas, never over the joint. */
export function JointHeader({ selected, preset, onPreset, slots, selectedId, onSelect, note }) {
  return (
    <div className="joint-header">
      <div className="joint-top">
        <div className="joint-id">
          <span className="mono joint-name">{selected?.id ?? 'No rundown'}</span>
          {selected && (
            <span className="joint-marks">
              <StatusMark kind={selected.spec_result} />
              <StatusMark kind={selected.signature} />
            </span>
          )}
        </div>
        <div className="joint-presets" role="group" aria-label="Camera preset">
          {[['section', 'Joint section'], ['flange', 'Flange']].map(([k, label]) => (
            <button key={k} type="button" className="btn-mini" aria-pressed={preset === k} onClick={() => onPreset(k)}>{label}</button>
          ))}
        </div>
      </div>

      {slots.length > 0 && (
        <ul className="joint-slots" aria-label="Bolts in this assembly">
          {slots.map(({ slot, rundown, kind }) => (
            <li key={rundown.id}>
              <button type="button" className={`slot-chip slot-chip-${kind}`} aria-pressed={rundown.id === selectedId} aria-label={`Bolt ${slot + 1}, ${KIND_LABEL[kind]}`} onClick={() => onSelect(rundown.id)}>
                <span aria-hidden="true" className="chip-num">{slot + 1}</span>
                <span aria-hidden="true" className="chip-glyph"><StatusMark kind={kind} /></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="joint-note" role="status">{note}</p>}
    </div>
  );
}

/** Small gauge in the bottom-left corner of the canvas. */
export default function Overlay({ pose, torqueMax, spec }) {
  return (
    <div className="joint-overlay">
      <div className="joint-bottom">
        <div className="joint-gauge">
          <Gauge torque={pose.torque} max={torqueMax} spec={spec} />
          <p className="joint-angle mono">Angle <b>{pose.angle.toFixed(1)}°</b></p>
        </div>
      </div>
    </div>
  );
}
