// Explicit steady-state model. No buffer, defects, parallel lanes or queue physics.
// Synthetic data; downtime is modeled as loss of station availability.
export const INITIAL = [
  { id: 'stamp', name: 'Stamping', short: 'Stamp', cycle: 42, downtime: 0, accent: '#8db2b1' },
  { id: 'weld', name: 'Welding', short: 'Weld', cycle: 55, downtime: 0, accent: '#ee9e56' },
  { id: 'paint', name: 'Painting', short: 'Paint', cycle: 38, downtime: 0, accent: '#9cb7af' },
  { id: 'assembly', name: 'Assembly', short: 'Assemble', cycle: 48, downtime: 0, accent: '#8aadb4' },
  { id: 'quality', name: 'Quality Inspection', short: 'QA', cycle: 36, downtime: 0, accent: '#88bba4' },
];
export const BASELINE_RATE = 3600 / 55;
export const SHIFT_HOURS = 8;
export function compute(stations) {
  if (!stations.length) throw new Error('At least one station is required');
  if (stations.some(s => !Number.isFinite(s.cycle) || s.cycle <= 0 || s.downtime < 0 || s.downtime >= 100)) {
    throw new RangeError('Invalid cycle time or downtime percentage');
  }
  const effective = stations.map(s => s.cycle / (1 - s.downtime / 100));
  const maxCycle = Math.max(...effective);
  const bottleneckIndex = effective.indexOf(maxCycle);
  const throughput = 3600 / maxCycle;
  const utilisation = effective.map(e => 100 * e / maxCycle);
  const lineUtilisation = utilisation.reduce((a,b)=>a+b,0)/stations.length;
  const balanceEfficiency = 100 * stations.reduce((sum,s)=>sum+s.cycle,0) / (stations.length * maxCycle);
  return { effective, bottleneckIndex, throughput, utilisation, lineUtilisation, balanceEfficiency, output: Math.floor(throughput*SHIFT_HOURS) };
}
