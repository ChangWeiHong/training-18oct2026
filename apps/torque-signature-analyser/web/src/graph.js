// Pure maths for the torque-angle graph. No DOM, no React.

/** domain {x0,x1,y0,y1}; size {width,height,margin:{l,r,t,b}} -> linear scales. */
export function makeScales(domain, size) {
  const m = size.margin ?? { l: 0, r: 0, t: 0, b: 0 };
  const pw = size.width - m.l - m.r;
  const ph = size.height - m.t - m.b;
  const dx = domain.x1 - domain.x0 || 1;
  const dy = domain.y1 - domain.y0 || 1;
  return {
    x: (v) => m.l + ((v - domain.x0) / dx) * pw,
    y: (v) => m.t + ph - ((v - domain.y0) / dy) * ph,
    invertX: (px) => domain.x0 + ((px - m.l) / pw) * dx,
    plot: { left: m.l, right: m.l + pw, top: m.t, bottom: m.t + ph },
  };
}

/** Shift a curve so the snug angle becomes 0. Index order is untouched. */
export function alignAtSnug(curve, snugAngle) {
  return { ...curve, angle: curve.angle.map((a) => a - snugAngle) };
}

/** First sample index whose angle is at or after `angle`; last index if none. Order is kept through repeated angles. */
export function nearestSampleIndex(curve, angle) {
  const a = curve.angle;
  if (!a.length) return 0;
  for (let i = 0; i < a.length; i++) if (a[i] >= angle) return i;
  return a.length - 1;
}

/** Keep at most `max` points, always including first and last. Returns the kept sample indexes. */
export function decimateIndexes(n, max) {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const out = [];
  const step = (n - 1) / (max - 1);
  for (let k = 0; k < max; k++) out.push(Math.round(k * step));
  return out;
}

/** Split band arrays into runs of consecutive grid points where all three are non-null. */
export function bandRuns(grid, lo, hi, shift = 0) {
  const runs = [];
  let cur = [];
  for (let i = 0; i < grid.length; i++) {
    if (lo[i] == null || hi[i] == null) {
      if (cur.length) runs.push(cur);
      cur = [];
    } else {
      cur.push({ x: grid[i] + shift, lo: lo[i], hi: hi[i], mid: null, i });
    }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

/** Runs of valid (grid + shift, value) points for a single series, nulls as gaps. */
export function lineRuns(grid, vals, shift = 0) {
  const runs = [];
  let cur = [];
  for (let i = 0; i < grid.length; i++) {
    if (vals[i] == null) {
      if (cur.length) runs.push(cur);
      cur = [];
    } else cur.push({ x: grid[i] + shift, y: vals[i] });
  }
  if (cur.length) runs.push(cur);
  return runs;
}

/** Round-number ticks inside [lo, hi]. */
export function niceTicks(lo, hi, target = 6) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}
