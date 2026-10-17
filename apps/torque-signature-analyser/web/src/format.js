// Pure copy helpers for the evidence panel.
export const fmt = (v) => String(Math.round(v * 10) / 10);
export const withUnit = (v, unit) => (unit === '°' ? `${fmt(v)}°` : `${fmt(v)} ${unit}`);

/** "Label: value unit. Reference range: lo–hi unit." (no space before °) */
export function evidenceLine(ev) {
  if (ev.feature === 'rotation_past_reference') return `${ev.label}: ${withUnit(ev.value, ev.unit)}.`;
  const range = `${fmt(ev.ref_lo)}–${withUnit(ev.ref_hi, ev.unit)}`;
  return `${ev.label}: ${withUnit(ev.value, ev.unit)}. Reference range: ${range}.`;
}

export const IF_ONLY_TEXT = 'Isolation Forest flagged an unusual combination of features. No single feature passed the z-score limit.';
export const AREA_ONLY_TEXT = 'The curve sits further from the reference median than 99 % of reference rundowns.';

export const CANT_ASSESS_FALLBACK = 'Not enough of the curve to compare.';
export const cantAssessText = (r) => r.cant_assess_reason || CANT_ASSESS_FALLBACK;

export const IF_ONLY_SHORT = 'Isolation Forest flagged an unusual combination of features.';

/** One-line evidence summary for a ledger row. */
export function firstEvidenceLine(r) {
  const e = r.evidence?.[0];
  if (e) return evidenceLine(e);
  if (r.pattern_hint) return r.pattern_hint;
  if (r.signature === 'investigate') return r.iforest_only ? IF_ONLY_SHORT : AREA_ONLY_TEXT;
  if (r.signature === 'cant_assess') return 'Not enough data to compare';
  return '';
}

/** Badge text for the result on screen: sample packs are synthetic, uploads are the visitor's own. */
export function provenance(source) {
  return source === 'upload'
    ? { text: 'Your upload', upload: true }
    : { text: 'Synthetic demo data', upload: false };
}
