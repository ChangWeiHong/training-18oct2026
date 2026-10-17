import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import StatusMark from './StatusMark.jsx';
import { sortRundowns } from '../state.js';

const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

export function firstEvidenceLine(r) {
  const e = r.evidence?.[0];
  if (e) {
    const range = e.ref_lo != null && e.ref_hi != null ? `, reference ${fmt(e.ref_lo)} to ${fmt(e.ref_hi)} ${e.unit}` : '';
    return `${e.label} ${fmt(e.value)} ${e.unit}${range}`;
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

  const onKey = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
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
              <th>First evidence</th>
              {showKey && <th>Seeded pattern</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const selected = r.id === selectedId;
              return (
                <tr
                  key={r.id}
                  className={selected ? 'is-selected' : undefined}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelect(r.id)}
                  onKeyDown={(e) => onKey(e, r.id)}
                >
                  <td className="num">{r.rank}</td>
                  <td className="mono">{r.assembly_id}</td>
                  <td className="num">{r.bolt_position ?? '-'}</td>
                  <td><StatusMark kind={r.spec_result === 'within' ? 'within' : r.spec_result === 'outside' ? 'outside' : 'not_supplied'} /></td>
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
