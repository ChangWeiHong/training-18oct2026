const KINDS = {
  typical: { label: 'typical', glyph: <circle cx="6" cy="6" r="3.2" /> },
  investigate: { label: 'worth investigating', glyph: <path d="M6 1.6 11 10.4H1Z" /> },
  cant_assess: { label: "can't assess", glyph: <path d="M2 2h8v8H2Z M2 6 6 2 M2 10 10 2 M6 10 10 6" fill="none" /> },
  within: { label: 'within spec', glyph: <path d="M2 6.4 4.8 9 10 3" fill="none" /> },
  outside: { label: 'outside spec', glyph: <path d="M2.4 2.4 9.6 9.6 M9.6 2.4 2.4 9.6" fill="none" /> },
  incomplete: { label: 'spec partly checked', glyph: <path d="M2 6.4 4.8 9 10 3" fill="none" strokeDasharray="2.2 1.6" /> },
  not_supplied: { label: 'not supplied', glyph: <path d="M2 6h8" fill="none" /> },
};

export const STATUS_LABELS = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.label]));

export default function StatusMark({ kind }) {
  const k = KINDS[kind];
  if (!k) return null;
  return (
    <span className={`status status-${kind}`}>
      <svg className="status-glyph" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
        {k.glyph}
      </svg>
      <span className="status-label">{k.label}</span>
    </span>
  );
}
