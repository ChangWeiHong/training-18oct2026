import React from 'react';
import { STATUS_COLOR, STATUS_TEXT, fmt } from './ui.jsx';

// Process-flow diagram of the line. Orthogonal connectors, one amber focal node (the constraint),
// rework loops routed under the row. Geometry sits on a 4px grid.
const W = 152, H = 96, GAP = 28, X0 = 40, ROW_Y = 168, FEED_Y = 28;
const nodeX = (i) => X0 + i * (W + GAP);

function Buffer({ x, y, cap, fill, w = GAP - 8 }) {
  const n = Math.min(cap, 8), bw = (w - (n - 1) * 2) / n;
  const filled = Math.round((fill / cap) * n);
  return <g>{Array.from({ length: n }, (_, i) =>
    <rect key={i} x={x + i * (bw + 2)} y={y} width={bw} height={8} rx={1}
      fill={i < filled ? (fill >= cap ? '#d9a35f' : '#5bbfb3') : 'none'} stroke="#587479" strokeWidth={1} />)}</g>;
}

export default function FlowDiagram({ stations, metrics, bottleneckId, selectedId, onSelect }) {
  const main = stations.filter(s => !s.feeds);
  const feeder = stations.find(s => s.feeds);
  const idx = Object.fromEntries(main.map((s, i) => [s.id, i]));
  const width = X0 * 2 + main.length * W + (main.length - 1) * GAP;
  const height = 468;
  const loops = main.filter(s => s.reworkTo).map(s => ({ from: s, to: main[idx[s.reworkTo]], m: metrics[s.id] }));
  const mx = feeder ? nodeX(idx[feeder.feeds]) + W / 2 : 0;
  const rowMid = ROW_Y + H / 2;

  return <div className="flow-scroll">
    <svg className="flow-svg" viewBox={`0 0 ${width} ${height}`} style={{ minWidth: width }} role="img" aria-labelledby="flow-title flow-desc">
      <title id="flow-title">Production process flow</title>
      <desc id="flow-desc">Nine stations in series with buffers between them, a powertrain feeder joining at chassis marriage, and rework loops returning to earlier stations.</desc>
      <defs>
        <marker id="fl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9 z" fill="#8aa3a4" /></marker>
        <marker id="fl-arrow-rw" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9 z" fill="#c3a07a" /></marker>
      </defs>

      {/* connectors first so nodes sit on top */}
      {main.slice(0, -1).map((s, i) => {
        const x1 = nodeX(i) + W, x2 = nodeX(i + 1), nextM = metrics[main[i + 1].id];
        return <g key={s.id}>
          <line x1={x1} y1={rowMid} x2={x2 - 2} y2={rowMid} stroke="#8aa3a4" strokeWidth={1.5} markerEnd="url(#fl-arrow)" />
          {nextM && <Buffer x={x1 + 4} y={rowMid - 22} cap={nextM.bufferCap} fill={nextM.buffer} />}
          {nextM && <text x={x1 + GAP / 2} y={rowMid - 28} textAnchor="middle" className="fl-mono fl-tiny">{nextM.buffer}/{nextM.bufferCap}</text>}
        </g>;
      })}
      {feeder && <g>
        <path d={`M${mx} ${FEED_Y + H} V${ROW_Y - 2}`} stroke="#8aa3a4" strokeWidth={1.5} fill="none" markerEnd="url(#fl-arrow)" />
        {metrics[feeder.id] && <>
          <rect x={mx + 8} y={FEED_Y + H + 12} width={60} height={16} fill="#142129" />
          <text x={mx + 12} y={FEED_Y + H + 24} className="fl-mono fl-tiny">KIT {metrics[feeder.id].buffer}/{metrics[feeder.id].bufferCap}</text>
        </>}
      </g>}
      {loops.map((l, k) => {
        const fi = idx[l.from.id], ti = idx[l.to.id];
        const rate = l.m && l.m.units ? 100 * l.m.reworkOut / l.m.units : 0;
        const scrapRate = l.m && l.m.units ? 100 * l.m.scrap / l.m.units : 0;
        const label = `RWK ${fmt(rate, 1)}%${scrapRate > 0.05 ? ` · SCRAP ${fmt(scrapRate, 1)}%` : ''}`;
        const yDrop = ROW_Y + H;
        if (fi === ti) {
          const cx = nodeX(fi) + W / 2, yb = yDrop + 36;
          return <g key={l.from.id}>
            <path d={`M${cx + 16} ${yDrop} V${yb - 8} a8 8 0 0 1 -8 8 H${cx - 8} a8 8 0 0 1 -8 -8 V${yDrop + 2}`} stroke="#c3a07a" strokeWidth={1.3} strokeDasharray="5 4" fill="none" markerEnd="url(#fl-arrow-rw)" />
            <rect x={cx - 74} y={yb + 4} width={148} height={16} fill="#142129" />
            <text x={cx} y={yb + 16} textAnchor="middle" className="fl-mono fl-tiny fl-rw">{label}</text>
          </g>;
        }
        // loops to an earlier station run at their own depth so strokes never overlap
        const back = loops.filter(o => idx[o.from.id] !== idx[o.to.id]);
        const n = back.findIndex(o => o.from.id === l.from.id);
        const depth = 84 + n * 32;
        const ax = nodeX(fi) + W / 2, bx = nodeX(ti) + W - 20 - n * 14;
        return <g key={l.from.id}>
          <path d={`M${ax} ${yDrop} V${yDrop + depth - 8} a8 8 0 0 1 -8 8 H${bx + 8} a8 8 0 0 0 -8 -8 V${yDrop + 2}`}
            stroke="#c3a07a" strokeWidth={1.3} strokeDasharray="5 4" fill="none" markerEnd="url(#fl-arrow-rw)" />
          <rect x={(ax + bx) / 2 - 76} y={yDrop + depth - 8} width={152} height={16} fill="#142129" />
          <text x={(ax + bx) / 2} y={yDrop + depth + 4} textAnchor="middle" className="fl-mono fl-tiny fl-rw">{label}</text>
        </g>;
      })}

      {/* nodes */}
      {[...main.map((s, i) => ({ s, x: nodeX(i), y: ROW_Y })), ...(feeder ? [{ s: feeder, x: mx - W / 2, y: FEED_Y }] : [])].map(({ s, x, y }) => {
        const m = metrics[s.id]; if (!m) return null;
        const status = m.status, bn = bottleneckId === s.id, sel = selectedId === s.id;
        const stroke = bn ? '#e2a468' : sel ? '#b7ddd3' : '#587479';
        return <g key={s.id} className="fl-node" onClick={() => onSelect(s.id)} tabIndex={0} role="button" aria-label={`${s.name}: ${STATUS_TEXT[status]}, ${fmt(m.utilisation, 0)}% busy`}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); } }}>
          <rect x={x} y={y} width={W} height={H} rx={4} fill={bn ? '#2f2a24' : '#1a2b32'} stroke={stroke} strokeWidth={bn || sel ? 2 : 1} />
          <rect x={x} y={y} width={5} height={H} rx={2} fill={STATUS_COLOR[status]} />
          <text x={x + 16} y={y + 22} className="fl-name">{s.name}</text>
          <text x={x + 16} y={y + 38} className="fl-mono fl-sub">{s.tag.toUpperCase()}</text>
          <text x={x + 16} y={y + 58} className="fl-mono fl-sub">{s.machines}× · {s.cycle}s{s.batch > 1 ? ` /${s.batch}` : ''} · {STATUS_TEXT[status].toUpperCase()}</text>
          <rect x={x + 16} y={y + 70} width={W - 32} height={6} rx={1} fill="#10191e" />
          <rect x={x + 16} y={y + 70} width={(W - 32) * Math.min(1, m.utilisation / 100)} height={6} rx={1} fill={bn ? '#e2a468' : '#5bbfb3'} />
          <text x={x + 16} y={y + 90} className="fl-mono fl-tiny">{fmt(m.utilisation, 0)}% BUSY · OEE {fmt(m.oee.oee, 0)}%</text>
          {bn && <g><rect x={x + W - 48} y={y - 18} width={48} height={14} rx={2} fill="#4a3524" stroke="#e2a468" /><text x={x + W - 24} y={y - 8} textAnchor="middle" className="fl-mono fl-tiny fl-amber">LIMIT</text></g>}
        </g>;
      })}

      {/* legend strip */}
      <g transform={`translate(${X0} ${height - 36})`}>
        {Object.entries({ running: 'Running', blocked: 'Blocked', starved: 'Starved', down: 'Down', setup: 'Changeover' }).map(([k, v], i) =>
          <g key={k} transform={`translate(${i * 120} 0)`}><rect width={10} height={10} rx={2} fill={STATUS_COLOR[k]} /><text x={16} y={9} className="fl-mono fl-tiny">{v.toUpperCase()}</text></g>)}
        <g transform="translate(640 0)"><rect width={18} height={8} fill="none" stroke="#587479" /><text x={26} y={8} className="fl-mono fl-tiny">BUFFER (FILLED = UNITS WAITING)</text></g>
        <g transform="translate(940 0)"><path d="M0 5 H22" stroke="#c3a07a" strokeDasharray="5 4" strokeWidth={1.3} /><text x={30} y={9} className="fl-mono fl-tiny">REWORK RETURN</text></g>
      </g>
    </svg>
  </div>;
}
