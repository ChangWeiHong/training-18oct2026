import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceLine, IF_ONLY_TEXT, AREA_ONLY_TEXT, cantAssessText, firstEvidenceLine, IF_ONLY_SHORT } from '../src/format.js';

test('Nm line', () => {
  const ev = { label: 'Final torque', value: 74.3, unit: 'Nm', ref_lo: 106.526, ref_hi: 114.977 };
  assert.equal(evidenceLine(ev), 'Final torque: 74.3 Nm. Reference range: 106.5–115 Nm.');
});
test('degree line has no space before the unit', () => {
  const ev = { label: 'Post-snug rotation', value: 21.5, unit: '°', ref_lo: 33.475, ref_hi: 42.025 };
  assert.equal(evidenceLine(ev), 'Post-snug rotation: 21.5°. Reference range: 33.5–42°.');
});
test('Nm/° line', () => {
  const ev = { label: 'Slope after snug', value: 0.8, unit: 'Nm/°', ref_lo: 2, ref_hi: 2.4 };
  assert.equal(evidenceLine(ev), 'Slope after snug: 0.8 Nm/°. Reference range: 2–2.4 Nm/°.');
});

test('detector-only copy names the detector and drops the range claim', () => {
  assert.equal(IF_ONLY_TEXT, 'Isolation Forest flagged an unusual combination of features. No single feature passed the z-score limit.');
  assert.equal(AREA_ONLY_TEXT, 'The curve sits further from the reference median than 99 % of reference rundowns.');
  assert.ok(!/outside the reference range/.test(IF_ONLY_TEXT + AREA_ONLY_TEXT));
});

test('cant-assess text uses the reason from the API', () => {
  assert.equal(cantAssessText({ cant_assess_reason: 'Reference too small to compare.' }), 'Reference too small to compare.');
  assert.equal(cantAssessText({}), 'Not enough of the curve to compare.');
});

test('past-reference evidence has no reference range', () => {
  assert.equal(evidenceLine({ feature: 'rotation_past_reference', label: 'Rotation past the reference curve', value: 40, unit: '°', ref_lo: 0, ref_hi: 0 }),
    'Rotation past the reference curve: 40°.');
});

test('firstEvidenceLine: past-reference rotation has no reference range', () => {
  const r = { signature: 'investigate', evidence: [{ feature: 'rotation_past_reference', label: 'Rotation past the reference curve', value: 40, unit: '°', ref_lo: 0, ref_hi: 0 }] };
  assert.equal(firstEvidenceLine(r), 'Rotation past the reference curve: 40°.');
});

test('firstEvidenceLine: investigate rows without evidence', () => {
  assert.equal(firstEvidenceLine({ signature: 'investigate', evidence: [], iforest_only: true }), IF_ONLY_SHORT);
  assert.equal(firstEvidenceLine({ signature: 'investigate', evidence: [], iforest_only: false }), AREA_ONLY_TEXT);
});

import { provenance } from '../src/format.js';
test('provenance follows the source of the displayed result', () => {
  assert.deepEqual(provenance('sample'), { text: 'Synthetic demo data', upload: false });
  assert.deepEqual(provenance('upload'), { text: 'Your upload', upload: true });
  assert.equal(provenance(undefined).text, 'Synthetic demo data');
});
