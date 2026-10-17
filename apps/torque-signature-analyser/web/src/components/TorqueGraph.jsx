import { useEffect, useMemo, useRef, useState } from 'react';
import { makeScales, nearestSampleIndex, decimateExtrema, bandRuns, lineRuns, niceTicks, splitAtCursor, enteredIntervals, pulseTargets } from '../graph.js';

const NO_SNUG_NOTE = 'No snug point: shown in absolute view only';
const MARGIN = { l: 46, r: 12, t: 10, b: 34 };
const STRIP_H = 14;
const MAX_FAINT = 5;
const MAX_ALL_POINTS = 150;

const fmt = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);

function useWidth(ref) {
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function bandPath(runs, sx, sy) {
  return runs
    .filter((r) => r.length > 1)
    .map((r) => {
      const top = r.map((p, k) => `${k ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.hi).toFixed(1)}`).join('');
      const bot = [...r].reverse().map((p) => `L${sx(p.x).toFixed(1)} ${sy(p.lo).toFixed(1)}`).join('');
      return `${top}${bot}Z`;
    })
    .join('');
}

function linePath(runs, sx, sy) {
  return runs.filter((r) => r.length > 1).map((r) => r.map((p, k) => `${k ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join('')).join('');
}

function curvePath(curve, idx, shift, sx, sy) {
  return idx.map((i, k) => `${k ? 'L' : 'M'}${sx(curve.angle[i] - shift).toFixed(1)} ${sy(curve.torque[i]).toFixed(1)}`).join('');
}

export default function TorqueGraph({ result, selected, cursor, mode, onMode, onCursor, onInteract, playing = false }) {
  const wrap = useRef(null);
  const svgRef = useRef(null);
  const dragging = useRef(false);
  const width = useWidth(wrap);
  const [showAll, setShowAll] = useState(false);
  const [hover, setHover] = useState(null);
  const [hits, setHits] = useState({});
  const prevAngle = useRef(null);
  const hitFor = useRef(null);
  const hitResult = useRef(null);
  const pulsed = useRef(new Set());

  const aligned = mode === 'aligned';
  const snug = selected?.features?.snug_angle ?? null;
  const spec = result?.spec ?? null;
  const height = Math.round(Math.min(400, Math.max(250, width * 0.58)));

  const curveRef = selected?.curve;
  const drawIdx = useMemo(() => (curveRef ? decimateExtrema(curveRef.torque, 2000) : []), [curveRef]);

  const model = useMemo(() => {
    if (!result || !selected) return null;
    if (aligned && snug == null) return { noSnug: true };
    const shift = aligned ? snug : 0; // x = angle - shift
    const env = result.envelope;
    const pre = result.envelope_pre;
    const bands = [];
    const medians = [];
    if (aligned) {
      bands.push({ kind: 'post', runs: bandRuns(env.grid, env.p05, env.p95, 0) });
      medians.push(lineRuns(env.grid, env.p50, 0));
    } else {
      // Before snug the reference is plotted by absolute angle, after snug by angle from this rundown's snug.
      // Each band covers only its own side so the two populations never overlap.
      bands.push({ kind: 'pre', runs: bandRuns(pre.grid, pre.p05, pre.p95, 0, snug != null ? { max: snug } : null) });
      medians.push(lineRuns(pre.grid, pre.p50, 0, snug != null ? { max: snug } : null));
      if (snug != null) {
        bands.push({ kind: 'post', runs: bandRuns(env.grid, env.p05, env.p95, snug, { min: snug }) });
        medians.push(lineRuns(env.grid, env.p50, snug, { min: snug }));
      }
    }
    const c = selected.curve;
    let x0 = Infinity, x1 = -Infinity, y1 = 0;
    for (let i = 0; i < c.angle.length; i++) {
      x0 = Math.min(x0, c.angle[i] - shift);
      x1 = Math.max(x1, c.angle[i] - shift);
      y1 = Math.max(y1, c.torque[i]);
    }
    for (const run of bands.flatMap((b) => b.runs)) for (const p of run) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.hi); }
    const angleLines = [];
    if (spec) {
      y1 = Math.max(y1, spec.torque_max_nm);
      if (snug != null) {
        angleLines.push({ key: 'amin', label: `Angle min ${spec.angle_min_deg}° after snug`, x: (aligned ? 0 : snug) + spec.angle_min_deg, row: 0 });
        angleLines.push({ key: 'amax', label: `Angle max ${spec.angle_max_deg}° after snug`, x: (aligned ? 0 : snug) + spec.angle_max_deg, row: 1 });
        for (const l of angleLines) { x0 = Math.min(x0, l.x); x1 = Math.max(x1, l.x); }
      }
    }
    if (!Number.isFinite(x0)) { x0 = 0; x1 = 1; }
    const pad = (x1 - x0) * 0.02;
    const domain = { x0: x0 - pad, x1: x1 + pad, y0: 0, y1: y1 * 1.1 || 1 };

    const others = (result.rundowns ?? []).filter((r) => r.id !== selected.id
      && (showAll || r.assembly_id === selected.assembly_id)
      && (!aligned || r.features?.snug_angle != null));
    const faint = (showAll ? others : others.slice(0, MAX_FAINT)).map((r) => {
      const cc = r.curve;
      const sh = aligned ? r.features.snug_angle : 0;
      const idx = decimateExtrema(cc.torque, showAll ? MAX_ALL_POINTS : 600);
      return { id: r.id, curve: cc, idx, shift: sh };
    });
    return { shift, bands, medians, domain, angleLines, faint };
  }, [result, selected, aligned, snug, spec, showAll]);

  // Each evidence strip lights once as the cursor moves into its interval. A counter in the key restarts the CSS animation.
  useEffect(() => {
    const c = selected?.curve;
    if (!c) { prevAngle.current = null; return; }
    const i = Math.min(Math.max(cursor, 0), c.angle.length - 1);
    const angle = c.angle[i];
    if (hitFor.current !== selected.id || hitResult.current !== result) { hitFor.current = selected.id; hitResult.current = result; prevAngle.current = null; pulsed.current = new Set(); setHits({}); }
    const ivs = (selected.evidence ?? []).filter((ev) => ev.interval);
    const entered = enteredIntervals(prevAngle.current, angle, ivs.map((ev) => ev.interval));
    prevAngle.current = angle;
    // Once per selection: a loop restart walks back into the same intervals without lighting them again.
    const fresh = pulseTargets(pulsed.current, entered.map((k) => ivs[k].feature));
    if (fresh.length) setHits((h) => { const nx = { ...h }; for (const f of fresh) nx[f] = (nx[f] ?? 0) + 1; return nx; });
  }, [cursor, selected, result]);

  if (!selected || !result) {
    return <div className="graph" ref={wrap}><p className="slot-empty">Load a pack to see its curves.</p></div>;
  }

  const controls = (
    <div className="graph-controls">
      <div className="btn-group" role="group" aria-label="Graph x axis">
        <button type="button" className="btn btn-small" aria-pressed={!aligned} onClick={() => { onInteract?.(); onMode('absolute'); }}>Absolute angle</button>
        <button type="button" className="btn btn-small" aria-pressed={aligned} onClick={() => { onInteract?.(); onMode('aligned'); }}>Aligned at snug</button>
      </div>
      <button type="button" className="btn btn-small" aria-pressed={showAll} onClick={() => { onInteract?.(); setShowAll((v) => !v); }}>Show all rundowns</button>
    </div>
  );

  if (model?.noSnug) {
    return (
      <div className="graph" ref={wrap}>
        {controls}
        <p className="graph-note">{NO_SNUG_NOTE}</p>
      </div>
    );
  }

  const { shift, bands, medians, domain, angleLines, faint } = model;
  const intervals = (selected.evidence ?? []).filter((ev) => ev.interval);
  const margin = { ...MARGIN, t: MARGIN.t + intervals.length * STRIP_H };
  const sc = makeScales(domain, { width, height, margin });
  const { plot } = sc;
  const curve = selected.curve;
  const n = curve.angle.length;
  const ci = Math.min(Math.max(cursor, 0), n - 1);
  const split = splitAtCursor(drawIdx, ci);
  const sigClass = selected.spec_result === 'outside' ? 'curve-outside' : `curve-${selected.signature}`;
  const xTicks = niceTicks(domain.x0, domain.x1, Math.max(3, Math.floor(width / 90)));
  const yTicks = niceTicks(domain.y0, domain.y1, 5);

  const indexFromEvent = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    return nearestSampleIndex(curve, sc.invertX(px) + shift);
  };
  const onDown = (e) => {
    onInteract?.();
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const i = indexFromEvent(e);
    onCursor(i);
    setHover(i);
  };
  const onMove = (e) => {
    const i = indexFromEvent(e);
    setHover(i);
    if (dragging.current) onCursor(i);
  };
  const onUp = (e) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const onKey = (e) => {
    if (e.key.startsWith('Arrow')) onInteract?.();
    const d = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onCursor(Math.min(n - 1, ci + d)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onCursor(Math.max(0, ci - d)); }
  };

  const cx = sc.x(curve.angle[ci] - shift);
  const cy = sc.y(curve.torque[ci]);
  const hi = hover != null && hover < n ? hover : null;
  const hx = hi != null ? sc.x(curve.angle[hi] - shift) : 0;
  const hy = hi != null ? sc.y(curve.torque[hi]) : 0;
  const tipText = hi != null ? `Sample ${hi} · ${fmt(curve.angle[hi])}° · ${fmt(curve.torque[hi])} Nm` : '';
  const tipW = tipText.length * 6.6 + 12;
  const tipX = Math.min(Math.max(hx + 10, plot.left), plot.right - tipW);
  const tipY = hy - 34 < plot.top ? hy + 12 : hy - 34;

  return (
    <div className="graph" ref={wrap}>
      {controls}
      <p className="graph-readout" aria-live="off">
        Sample <b>{ci}</b> · angle <b>{fmt(curve.angle[ci])}°</b> · torque <b>{fmt(curve.torque[ci])} Nm</b>
      </p>
      <div className="graph-wrap">
        <svg
          ref={svgRef}
          className="graph-svg"
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="slider"
          aria-label={`Sample cursor on the torque-angle graph for ${selected.id}`}
          aria-valuemin={0}
          aria-valuemax={n - 1}
          aria-valuenow={ci}
          aria-valuetext={`Sample ${ci}, angle ${fmt(curve.angle[ci])}°, torque ${fmt(curve.torque[ci])} Nm`}
          tabIndex={0}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={() => { if (!dragging.current) setHover(null); }}
          onKeyDown={onKey}
        >
          <defs>
            <pattern id="pre-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" className="pre-hatch-line" />
            </pattern>
            <clipPath id="plot-clip"><rect x={plot.left} y={plot.top} width={plot.right - plot.left} height={plot.bottom - plot.top} /></clipPath>
          </defs>

          {xTicks.map((t) => (
            <g key={`x${t}`}>
              <line className="g-grid" x1={sc.x(t)} x2={sc.x(t)} y1={plot.top} y2={plot.bottom} />
              <text className="g-tick" x={sc.x(t)} y={plot.bottom + 16} textAnchor="middle">{t}</text>
            </g>
          ))}
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line className="g-grid" x1={plot.left} x2={plot.right} y1={sc.y(t)} y2={sc.y(t)} />
              <text className="g-tick" x={plot.left - 6} y={sc.y(t) + 4} textAnchor="end">{t}</text>
            </g>
          ))}
          <text className="g-axis" x={(plot.left + plot.right) / 2} y={height - 4} textAnchor="middle">
            {aligned ? 'Angle after snug (°)' : 'Angle (°)'}
          </text>
          <text className="g-axis" transform={`translate(11 ${(plot.top + plot.bottom) / 2}) rotate(-90)`} textAnchor="middle">Torque (Nm)</text>

          <g clipPath="url(#plot-clip)">
            {intervals.map((ev) => {
              const x0 = Math.max(plot.left, sc.x(ev.interval[0] - shift));
              const x1 = Math.min(plot.right, sc.x(ev.interval[1] - shift));
              return <rect key={`f${ev.feature}`} className="g-interval-fill" x={x0} y={plot.top} width={Math.max(2, x1 - x0)} height={plot.bottom - plot.top} />;
            })}
            {bands.map((b) => <path key={`b${b.kind}`} className={`g-band g-band-${b.kind}`} d={bandPath(b.runs, sc.x, sc.y)} />)}
            {medians.map((runs, k) => <path key={`m${k}`} className="g-median" d={linePath(runs, sc.x, sc.y)} />)}

            {faint.map((f) => <path key={f.id} className="g-faint" d={curvePath(f.curve, f.idx, f.shift, sc.x, sc.y)} />)}
            <path className="g-curve-future" d={curvePath(curve, split.future, shift, sc.x, sc.y)} />
            <path className={`g-curve ${sigClass}`} d={curvePath(curve, split.past, shift, sc.x, sc.y)} />
          </g>

          {spec && [
            { key: 'tmax', v: spec.torque_max_nm, label: `Torque max ${spec.torque_max_nm} Nm`, below: false },
            { key: 'tmin', v: spec.torque_min_nm, label: `Torque min ${spec.torque_min_nm} Nm`, below: true },
          ].map((l) => (
            <g key={l.key}>
              <line className="g-limit" x1={plot.left} x2={plot.right} y1={sc.y(l.v)} y2={sc.y(l.v)} />
              <text className="g-limit-label" x={plot.left + 4} y={sc.y(l.v) + (l.below ? 12 : -4)} textAnchor="start">{l.label}</text>
            </g>
          ))}
          {angleLines.map((l) => {
            const x = sc.x(l.x);
            const flip = x > plot.right - 150;
            return (
              <g key={l.key}>
                <line className="g-limit" x1={x} x2={x} y1={plot.top} y2={plot.bottom} />
                <text className="g-limit-label" x={flip ? x - 4 : x + 4} y={plot.bottom - 6 - l.row * 14} textAnchor={flip ? 'end' : 'start'}>{l.label}</text>
              </g>
            );
          })}

          {intervals.map((ev, k) => {
            const x0 = Math.max(plot.left, sc.x(ev.interval[0] - shift));
            const x1 = Math.min(plot.right, sc.x(ev.interval[1] - shift));
            const y = MARGIN.t + k * STRIP_H;
            return (
              <g key={`s${ev.feature}`}>
                <rect key={hits[ev.feature] ?? 0} className={hits[ev.feature] ? 'g-interval is-hit' : 'g-interval'} x={x0} y={y} width={Math.max(2, x1 - x0)} height={STRIP_H - 3} />
                <text className="g-interval-label" x={x0 + 4} y={y + 9}>{ev.label}</text>
              </g>
            );
          })}

          <line className="g-cursor" x1={cx} x2={cx} y1={plot.top} y2={plot.bottom} />
          {playing && <circle className="g-cursor-halo" cx={cx} cy={cy} r="11" />}
          <circle className={playing ? 'g-cursor-dot is-playing' : 'g-cursor-dot'} cx={cx} cy={cy} r="4" />
          <rect className="g-plot-frame" x={plot.left} y={plot.top} width={plot.right - plot.left} height={plot.bottom - plot.top} />

          {hi != null && (
            <g className="g-tip" pointerEvents="none">
              <circle className="g-hover-dot" cx={hx} cy={hy} r="3.5" />
              <rect x={tipX} y={tipY} width={tipW} height="22" rx="3" />
              <text x={tipX + 6} y={tipY + 15}>{tipText}</text>
            </g>
          )}
        </svg>
      </div>
      <ul className="graph-legend">
        <li><span className={`key key-curve ${sigClass}`} />{selected.id}</li>
        {aligned ? (
          <li><span className="key key-band" />Reference band (5th to 95th percentile), median dashed</li>
        ) : (
          <>
            {bands.some((b) => b.kind === 'pre') && <li><span className="key key-band key-band-pre" />Reference before snug (5th to 95th percentile), median dashed</li>}
            {bands.some((b) => b.kind === 'post') && <li><span className="key key-band key-band-post" />Reference after snug (aligned at this rundown's snug), median dashed</li>}
          </>
        )}
        {intervals.length > 0 && <li><span className="key key-interval" />Evidence interval</li>}
        {faint.length > 0 && <li><span className="key key-faint" />{showAll ? 'All rundowns' : `Same assembly (${faint.length})`}</li>}
      </ul>
    </div>
  );
}
