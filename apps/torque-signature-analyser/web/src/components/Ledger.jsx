import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import StatusMark from './StatusMark.jsx';
import { sortRundowns } from '../state.js';
import { fmt, withUnit } from '../format.js';

export function firstEvidenceLine(r) {
  const e = r.evidence?.[0];
  if (e) {
    const range = e.ref_lo != null && e.ref_hi != null ? `, reference ${fmt(e.ref_lo)} to ${withUnit(e.ref_hi, e.unit)}` : '';
    return `${e.label} ${withUnit(e.value, e.unit)}${range}`;
  }
  if (r.pattern_hint) return r.pattern_hint;
  if (r.signature === 'investigate') return 'Combined pattern, no single feature stands out';
  if (r.signature === 'cant_assess') return 'Not enough data to compare';
  return '';
}

const COLUMNS = [
  { key: 'assembly', label: 'Assembly' },
  { key: 'position', label: 'Position' },
  { key: 'spec', label: 'Spec' },
  { key: 'signature', label: 'Signature' },
];

export default function Ledger({ rundowns, selectedId, onSelect }) {
  const [sort, setSort] = useState({ key: 'rank', dir: 'asc' });
  const [showKey, setShowKey] = useState(false);
  const hasKey = rundowns.some((r) => r.seeded_pattern != null);
  const rows = useMemo(() => sortRundowns(rundowns, sort.key, sort.dir), [rundowns, sort]);

  const toggle = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const ariaSort = (key) => (sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');

  // Roving tabindex: the selected row is the one tab stop. Arrows move the selection.
  const rowRefs = useRef(new Map());
  const tabId = rows.some((r) => r.id === selectedId) ? selectedId : rows[0]?.id;

  const onKey = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
      return;
    }
    const at = rows.findIndex((r) => r.id === id);
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: rows.length - 1 }[e.key];
    if (to == null) return;
    e.preventDefault();
    const next = rows[Math.min(rows.length - 1, Math.max(0, to))];
    if (!next) return;
    onSelect(next.id);
    rowRefs.current.get(next.id)?.focus();
  };

  return (
    <section className="ledger" aria-label="Rundown ledger">
      <div className="ledger-head">
        <h2>Ledger</h2>
        <span className="ledger-hint">Sorted by importance by default. Select a row to inspect it.</span>
        {hasKey && (
          <button type="button" className="btn btn-small" aria-pressed={showKey} onClick={() => setShowKey((v) => !v)}>
            Answer key
          </button>
        )}
      </div>
      <div className="ledger-scroll">
        <table role="grid" className="ledger-table">
          <thead>
            <tr>
              <th aria-sort={ariaSort('rank')}>
                <SortButton label="Rank" active={sort.key === 'rank'} dir={sort.dir} onClick={() => toggle('rank')} />
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} aria-sort={ariaSort(c.key)}>
                  <SortButton label={c.label} active={sort.key === c.key} dir={sort.dir} onClick={() => toggle(c.key)} />
                </th>
              ))}
              <th className="th-pad">First evidence</th>
              {showKey && <th className="th-pad">Seeded pattern</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const selected = r.id === selectedId;
              return (
                <tr
                  key={r.id}
                  className={selected ? 'is-selected' : undefined}
                  ref={(el) => { if (el) rowRefs.current.set(r.id, el); else rowRefs.current.delete(r.id); }}
                  tabIndex={r.id === tabId ? 0 : -1}
                  aria-selected={selected}
                  onClick={() => onSelect(r.id)}
                  onKeyDown={(e) => onKey(e, r.id)}
                >
                  <td className="num">{r.rank}</td>
                  <td className="mono">{r.assembly_id}</td>
                  <td className="num">{r.bolt_position ?? '-'}</td>
                  <td><StatusMark kind={['within', 'outside', 'incomplete'].includes(r.spec_result) ? r.spec_result : 'not_supplied'} /></td>
                  <td><StatusMark kind={r.signature} /></td>
                  <td className="evidence-cell">{firstEvidenceLine(r) || <span className="dim">None</span>}</td>
                  {showKey && <td className="mono">{r.seeded_pattern ?? '-'}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SortButton({ label, active, dir, onClick }) {
  return (
    <button type="button" className={`sort-btn${active ? ' is-active' : ''}`} onClick={onClick}>
      <span>{label}</span>
      {active ? (dir === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />) : <span className="sort-spacer" aria-hidden="true" />}
    </button>
  );
}
