// Synthetic plant definition. Every number is an assumption, not measured data.
// Cycle times are seconds per machine cycle. A cycle moves `batch` units at once.

export const OP_TYPES = {
  press:     { label: 'Press',            blurb: 'Stroke-based forming. Die changes cost time.' },
  robot:     { label: 'Robotic cell',     blurb: 'Automated joining with parallel cells.' },
  oven:      { label: 'Batch process',    blurb: 'Units move through in groups. Partial batches waste time.' },
  manual:    { label: 'Manual line',      blurb: 'Paced by operators. Breaks and staffing change speed.' },
  join:      { label: 'Join / marriage',  blurb: 'Needs a body and a powertrain kit at the same time.' },
  feeder:    { label: 'Feeder cell',      blurb: 'Builds sub-assemblies into a kit buffer.' },
  test:      { label: 'Automated test',   blurb: 'Pass/fail test. Failures return for rework.' },
  inspect:   { label: 'Inspection',       blurb: 'Manual audit. Failures return for rework.' },
  logistics: { label: 'Dispatch',         blurb: 'Loads vehicles onto trucks in groups.' },
};

export const VARIANTS = [
  { id: 'S', name: 'Sedan', mult: 1.0,  pt: 1.0 },
  { id: 'U', name: 'SUV',   mult: 1.1,  pt: 1.15 },
  { id: 'E', name: 'EV',    mult: 1.06, pt: 1.35 },
];

const base = {
  cv: 0.08, machines: 1, batch: 1, buffer: 6, mtbf: 0, mttr: 0, fpy: 100, scrapShare: 0,
  reworkTo: null, changeover: 0, staffing: 100, speedPct: 100, manned: false, variantSens: 1, feeds: null,
};
const S = (o) => ({ ...base, ...o });

// Order matters: the main line runs top to bottom, feeders sit after it.
export const DEFAULT_STATIONS = [
  S({ id: 'stamp', name: 'Stamping', short: 'Stamp', type: 'press', accent: '#8db2b1', tag: 'Transfer press',
      cycle: 42, cv: 0.06, buffer: 10, mtbf: 180, mttr: 12, changeover: 20, variantSens: 0.3 }),
  S({ id: 'weld', name: 'Body Welding', short: 'Weld', type: 'robot', accent: '#ee9e56', tag: 'Two robot cells',
      cycle: 105, cv: 0.07, machines: 2, buffer: 6, mtbf: 90, mttr: 8, fpy: 97, scrapShare: 10, reworkTo: 'weld' }),
  S({ id: 'paint', name: 'Paint Shop', short: 'Paint', type: 'oven', accent: '#9cb7af', tag: 'Booth and cure oven',
      cycle: 190, cv: 0.05, batch: 4, buffer: 12, mtbf: 300, mttr: 20, fpy: 93, scrapShare: 10, reworkTo: 'paint',
      changeover: 14, variantSens: 0.6 }),
  S({ id: 'trim', name: 'Interior Trim', short: 'Trim', type: 'manual', accent: '#8aadb4', tag: 'Manual line',
      cycle: 56, cv: 0.12, buffer: 14, manned: true, staffing: 100, fpy: 98, scrapShare: 0, reworkTo: 'trim', variantSens: 1.2 }),
  S({ id: 'marriage', name: 'Chassis Marriage', short: 'Marriage', type: 'join', accent: '#88bba4', tag: 'AGV lift and join',
      cycle: 52, cv: 0.08, buffer: 4, mtbf: 150, mttr: 10 }),
  S({ id: 'final', name: 'Final Assembly', short: 'Final', type: 'manual', accent: '#a3b58c', tag: 'Manual line',
      cycle: 50, cv: 0.12, buffer: 4, manned: true, fpy: 96, reworkTo: 'final', variantSens: 1.2 }),
  S({ id: 'eol', name: 'End-of-Line Test', short: 'EOL', type: 'test', accent: '#7fb4c4', tag: 'Dyno and alignment',
      cycle: 46, cv: 0.05, buffer: 4, mtbf: 300, mttr: 20, fpy: 95, scrapShare: 0, reworkTo: 'final', variantSens: 0.5 }),
  S({ id: 'audit', name: 'Quality Audit', short: 'Audit', type: 'inspect', accent: '#92bba0', tag: 'Inspection gate',
      cycle: 38, cv: 0.10, buffer: 6, manned: true, fpy: 95, scrapShare: 0, reworkTo: 'final', variantSens: 0.4 }),
  S({ id: 'dispatch', name: 'Dispatch', short: 'Ship', type: 'logistics', accent: '#b0b99a', tag: 'Truck loading',
      cycle: 190, cv: 0.10, batch: 6, buffer: 12, variantSens: 0, manned: true }),
  S({ id: 'powertrain', name: 'Powertrain Cell', short: 'Powertrain', type: 'feeder', accent: '#c1ab7c', tag: 'Engine / battery kits',
      cycle: 68, cv: 0.10, machines: 2, buffer: 6, mtbf: 120, mttr: 15, feeds: 'marriage', fpy: 99.5, scrapShare: 100 }),
];

export const DEFAULT_LINE = {
  demand: 44,          // units/hour release target. 0 = release as fast as the line accepts.
  release: 'conwip',   // 'conwip' caps total WIP. 'push' releases at demand regardless of WIP.
  wipCap: 42,
  shifts: 2,           // 8 h shifts per day, starting 06:00
  mix: { S: 50, U: 30, E: 20 },
  campaign: 1,         // units built in a run of the same variant. 1 = random sequence.
  seed: 7,
};

export const SCENARIOS = [
  { id: 'baseline', label: 'Baseline', note: 'Two shifts, mixed models, moderate WIP cap.', stations: {}, line: {} },
  { id: 'press-fail', label: 'Unreliable press', note: 'Press fails every 45 min and takes 25 min to fix.',
    stations: { stamp: { mtbf: 45, mttr: 25 } }, line: {} },
  { id: 'paint-quality', label: 'Paint defects', note: 'First-pass yield drops to 82%. Rework loads the booth.',
    stations: { paint: { fpy: 82 } }, line: {} },
  { id: 'surge', label: 'Demand surge', note: 'Target rises to 62 units/hour with a higher WIP cap.',
    stations: {}, line: { demand: 62, wipCap: 60 } },
  { id: 'staff', label: 'Staff shortage', note: 'Manual stations run at 80% staffing.',
    stations: { trim: { staffing: 80 }, final: { staffing: 80 }, audit: { staffing: 80 }, dispatch: { staffing: 80 } }, line: {} },
  { id: 'ev-heavy', label: 'EV-heavy mix', note: '60% EV with random sequencing. Many changeovers, slower powertrain cell.',
    stations: {}, line: { mix: { S: 20, U: 20, E: 60 } } },
  { id: 'lean', label: 'Lean WIP', note: 'WIP cap 24. Less inventory, less cushion against stoppages.',
    stations: { stamp: { buffer: 5 }, weld: { buffer: 3 }, paint: { buffer: 6 }, trim: { buffer: 6 } }, line: { wipCap: 24 } },
  { id: 'one-shift', label: 'Single shift', note: 'One 8-hour shift. Same line, less calendar time.',
    stations: {}, line: { shifts: 1 } },
];

export function buildConfig(scenarioId = 'baseline') {
  const sc = SCENARIOS.find(s => s.id === scenarioId) || SCENARIOS[0];
  const stations = DEFAULT_STATIONS.map(s => ({ ...s, ...(sc.stations[s.id] || {}) }));
  const line = { ...DEFAULT_LINE, ...sc.line, mix: { ...DEFAULT_LINE.mix, ...(sc.line.mix || {}) } };
  return { stations, line };
}
