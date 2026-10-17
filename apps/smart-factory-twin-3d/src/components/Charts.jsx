import React from 'react';
import { ComposedChart, Area, Line, BarChart, Bar, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceLine } from 'recharts';
import { STATE_COLOR, fmt } from './ui.jsx';

const tip = {
  contentStyle: { background: '#0f1d23', border: '1px solid #3a5357', borderRadius: 4, color: '#d9e6e2', fontSize: 11 },
  labelStyle: { color: '#8fa9aa', marginBottom: 4 },
};
const tick = { fill: '#8aa3a4', fontSize: 10 };

export function ThroughputChart({ history, demand }) {
  const maxY = Math.max(60, Math.ceil(Math.max(demand, ...history.map(h => h.uph), 1) / 10) * 10 + 10);
  return <ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={history} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
      <defs><linearGradient id="uphFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5bbfb3" stopOpacity=".28" /><stop offset="100%" stopColor="#5bbfb3" stopOpacity="0" /></linearGradient></defs>
      <CartesianGrid stroke="#2b4046" strokeDasharray="3 6" vertical={false} />
      <XAxis dataKey="clock" axisLine={false} tickLine={false} tick={tick} minTickGap={40} />
      <YAxis axisLine={false} tickLine={false} tick={tick} domain={[0, maxY]} />
      <Tooltip {...tip} formatter={(v, n) => [`${fmt(v)}${n === 'WIP' ? ' units' : ' /h'}`, n]} />
      <Area dataKey="uph" name="Output (15 min)" type="monotone" stroke="#5bbfb3" strokeWidth={2} fill="url(#uphFill)" dot={false} isAnimationActive={false} />
      <Line dataKey="demand" name="Demand target" type="stepAfter" stroke="#e2a468" strokeWidth={1.4} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
      <Line dataKey="wip" name="WIP" type="monotone" stroke="#8aa3a4" strokeWidth={1} dot={false} isAnimationActive={false} />
      <Legend iconType="plainline" wrapperStyle={{ fontSize: 10, color: '#8aa3a4' }} />
    </ComposedChart>
  </ResponsiveContainer>;
}

export function StateChart({ stations }) {
  const data = stations.map(s => ({ name: s.short, busy: +s.share.busy.toFixed(1), setup: +s.share.setup.toFixed(1), blocked: +s.share.blocked.toFixed(1), starved: +s.share.starved.toFixed(1), down: +s.share.down.toFixed(1) }));
  return <ResponsiveContainer width="100%" height="100%">
    <BarChart layout="vertical" data={data} margin={{ top: 0, right: 12, left: 6, bottom: 0 }} barCategoryGap={4}>
      <CartesianGrid stroke="#2b4046" strokeDasharray="3 6" horizontal={false} />
      <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} allowDataOverflow tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} tick={tick} />
      <YAxis dataKey="name" type="category" width={70} axisLine={false} tickLine={false} tick={{ ...tick, fill: '#b7c9c6' }} />
      <Tooltip {...tip} formatter={(v, n) => [`${fmt(v)}%`, n]} cursor={{ fill: '#ffffff08' }} />
      {['busy', 'setup', 'blocked', 'starved', 'down'].map(k => <Bar key={k} dataKey={k} stackId="a" fill={STATE_COLOR[k]} isAnimationActive={false} />)}
    </BarChart>
  </ResponsiveContainer>;
}

export function BufferChart({ stations }) {
  const data = stations.map(s => ({ name: s.short, now: +(100 * s.buffer / s.bufferCap).toFixed(0), avg: +(100 * s.avgBuffer / s.bufferCap).toFixed(0) }));
  return <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
      <CartesianGrid stroke="#2b4046" strokeDasharray="3 6" vertical={false} />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} interval={0} />
      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={tick} tickFormatter={v => `${v}%`} />
      <Tooltip {...tip} formatter={(v, n) => [`${v}% of capacity`, n]} cursor={{ fill: '#ffffff08' }} />
      <ReferenceLine y={100} stroke="#d9a35f" strokeDasharray="4 4" />
      <Bar dataKey="avg" name="Average" fill="#35666a" isAnimationActive={false} barSize={9} />
      <Bar dataKey="now" name="Now" isAnimationActive={false} barSize={9}>{data.map((d, i) => <Cell key={i} fill={d.now >= 100 ? '#d9a35f' : '#5bbfb3'} />)}</Bar>
      <Legend iconType="square" wrapperStyle={{ fontSize: 10, color: '#8aa3a4' }} />
    </BarChart>
  </ResponsiveContainer>;
}
