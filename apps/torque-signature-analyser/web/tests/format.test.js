import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceLine, IF_ONLY_TEXT, AREA_ONLY_TEXT } from '../src/format.js';

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
