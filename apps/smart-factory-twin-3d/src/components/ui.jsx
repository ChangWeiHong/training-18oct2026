import React from 'react';

export const STATUS_COLOR = { running: '#739da8', degraded: '#d9a35f', down: '#d9776a', blocked: '#b9a96c', starved: '#6f8fa8', setup: '#a79ad0', off: '#4f5f65' };
export const STATUS_TEXT = { running: 'Running', degraded: 'Degraded', down: 'Down', blocked: 'Blocked', starved: 'Starved', setup: 'Changeover', off: 'Idle' };
export const STATE_COLOR = { busy: '#4fb7a9', setup: '#a79ad0', blocked: '#b9a96c', starved: '#6f8fa8', down: '#d9776a' };
export const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '0');

// Labelled slider. `display` formats the live value, `hint` states what the value does.
export function Field({ label, value, min, max, step = 1, unit = '', onChange, display, hint, disabled, tone = 'teal' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return <label className={`fld ${disabled ? 'is-disabled' : ''}`}>
    <span className="fld-top"><span className="fld-label">{label}</span><b>{display ? display(value) : value}{unit && <i>{unit}</i>}</b></span>
    <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={e => onChange(Number(e.target.value))} aria-label={label}
      style={{ '--pct': `${Math.min(100, Math.max(0, pct))}%`, '--slider-color': tone === 'amber' ? '#e2a468' : '#5bbfb3' }} />
    {hint && <span className="fld-hint">{hint}</span>}
  </label>;
}

export function Segmented({ options, value, onChange, label }) {
  return <div className="seg" role="group" aria-label={label}>
    {options.map(o => <button key={String(o.value)} type="button" className={value === o.value ? 'on' : ''} aria-pressed={value === o.value}
      onClick={() => onChange(o.value)} title={o.title}>{o.label}</button>)}
  </div>;
}

export function Panel({ icon: Icon, title, kicker, right, children, className = '' }) {
  return <section className={`panel sf-panel ${className}`}>
    <div className="panel-header">
      <div className="panel-title">{Icon && <span className="panel-icon"><Icon size={16} /></span>}<div><h2>{title}</h2>{kicker && <p>{kicker}</p>}</div></div>
      {right && <div className="panel-header-right">{right}</div>}
    </div>
    {children}
  </section>;
}
