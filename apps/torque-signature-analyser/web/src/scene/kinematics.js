// Pure joint maths. Rotation is measured; the gap and compression are illustrative.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Pose of the bolt at a cursor sample.
 * opts: { torqueMax, maxCompression }. Compression is in the unit of maxCompression.
 */
export function jointPose(curve, cursor, snugAngle, opts = {}) {
  const { torqueMax = 0, maxCompression = 0 } = opts;
  const last = Math.max(0, (curve?.angle?.length ?? 0) - 1);
  const i = clamp(Math.round(cursor), 0, last);
  const angle = curve?.angle?.[i] ?? 0;
  const torque = curve?.torque?.[i] ?? 0;
  const rotationRad = (angle * Math.PI) / 180;
  if (snugAngle == null) return { rotationRad, gap: 0, compression: 0, angle, torque };
  // R15: visual gap fraction, 1 at angle 0 shrinking linearly with angle to 0 at snug. The scene scales it.
  const gap = snugAngle > 0 ? 1 - clamp(angle, 0, snugAngle) / snugAngle : 0;
  const compression = angle > snugAngle && torqueMax > 0 ? clamp(torque / torqueMax, 0, 1) * maxCompression : 0;
  return { rotationRad, gap, compression, angle, torque };
}

/**
 * Map one assembly's rundowns onto the flange holes (decision 5). `count` is the joint's bolt count (1 to 6).
 * Valid unique positions keep their hole. Missing, out-of-range or duplicate positions
 * fill the free holes by order; duplicates and anything past `count` go to overflow.
 */
export function boltSlots(rundowns, count = 6) {
  const slots = [];
  const taken = new Set();
  const rest = [];
  const overflow = [];
  for (const r of rundowns) {
    const p = r.bolt_position;
    if (Number.isInteger(p) && p >= 1 && p <= count) {
      if (taken.has(p - 1)) overflow.push(r);
      else { taken.add(p - 1); slots.push({ slot: p - 1, rundown: r }); }
    } else rest.push(r);
  }
  for (const r of rest) {
    let k = 0;
    while (k < count && taken.has(k)) k += 1;
    if (k >= count) overflow.push(r);
    else { taken.add(k); slots.push({ slot: k, rundown: r }); }
  }
  slots.sort((a, b) => a.slot - b.slot);
  return { slots, overflow };
}

/** Head-ring status. Outside spec wins, then investigate, then can't assess, else typical. */
export function statusKind(r) {
  if (r.spec_result === 'outside') return 'outside';
  if (r.signature === 'investigate') return 'investigate';
  if (r.signature === 'cant_assess') return 'cant_assess';
  return 'typical';
}
