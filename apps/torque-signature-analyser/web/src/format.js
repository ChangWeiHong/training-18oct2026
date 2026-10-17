// Pure copy helpers for the evidence panel.
export const fmt = (v) => String(Math.round(v * 10) / 10);
export const withUnit = (v, unit) => (unit === '°' ? `${fmt(v)}°` : `${fmt(v)} ${unit}`);

/** "Label: value unit. Reference range: lo–hi unit." (no space before °) */
export function evidenceLine(ev) {
  const range = `${fmt(ev.ref_lo)}–${withUnit(ev.ref_hi, ev.unit)}`;
  return `${ev.label}: ${withUnit(ev.value, ev.unit)}. Reference range: ${range}.`;
}

export const IF_ONLY_TEXT = 'Isolation Forest flagged an unusual combination of features. No single feature passed the z-score limit.';
export const AREA_ONLY_TEXT = 'The curve sits further from the reference median than 99 % of reference rundowns.';

export const CANT_ASSESS_FALLBACK = 'Not enough of the curve to compare.';
export const cantAssessText = (r) => r.cant_assess_reason || CANT_ASSESS_FALLBACK;
