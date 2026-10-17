// Pure playback maths. Position is a fractional sample index.

export const SPEEDS = [0.25, 0.5, 1, 2, 4];
export const UNIFORM_RATE = 60; // samples per second at 1x when there is no time_ms

/** True when the curve carries usable, non-decreasing time stamps. */
export function hasTime(curve) {
  const t = curve?.t;
  if (!t || t.length < 2 || t.some((v) => v == null || !Number.isFinite(v))) return false;
  for (let i = 1; i < t.length; i++) if (t[i] < t[i - 1]) return false;
  return t[t.length - 1] > t[0];
}

function timeAt(t, pos) {
  const i = Math.min(t.length - 1, Math.max(0, Math.floor(pos)));
  const j = Math.min(t.length - 1, i + 1);
  return t[i] + (t[j] - t[i]) * (pos - i);
}

function posAtTime(t, time) {
  const last = t.length - 1;
  if (time >= t[last]) return last;
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= time) lo = mid; else hi = mid;
  }
  const span = t[hi] - t[lo];
  return span > 0 ? lo + (time - t[lo]) / span : hi;
}

/** Advance `pos` by dtMs of wall time at `speed`. Returns the new fractional position, capped at the last sample. */
export function nextPosition(curve, pos, dtMs, speed) {
  const n = curve?.angle?.length ?? 0;
  if (n < 2) return 0;
  if (hasTime(curve)) return posAtTime(curve.t, timeAt(curve.t, pos) + dtMs * speed);
  return Math.min(n - 1, pos + (UNIFORM_RATE * speed * dtMs) / 1000);
}
