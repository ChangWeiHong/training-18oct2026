import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL, compute } from '../src/simulation.js';
const clone=()=>INITIAL.map(s=>({...s}));
test('baseline: welding limits line throughput and output',()=>{
 const m=compute(clone());
 assert.equal(m.bottleneckIndex,1);
 assert.equal(m.output,523);
 assert.ok(Math.abs(m.throughput-3600/55)<1e-9);
 assert.equal(m.utilisation[1],100);
});
test('improving welding 20 percent moves bottleneck to assembly',()=>{
 const stations=clone();stations[1].cycle=44;
 const m=compute(stations);
 assert.equal(m.bottleneckIndex,3);
 assert.equal(m.throughput,75);
 assert.equal(m.output,600);
});
test('downtime lowers effective capacity',()=>{
 const stations=clone();stations[2].downtime=60;
 const m=compute(stations);
 assert.equal(m.bottleneckIndex,2);
 assert.equal(m.effective[2],95);
 assert.ok(Math.abs(m.throughput-3600/95)<1e-9);
});
test('balance efficiency does not exceed 100 percent',()=>{
 const m=compute(clone());
 assert.ok(m.balanceEfficiency>0 && m.balanceEfficiency<=100);
});
test('invalid inputs fail fast',()=>{
 const stations=clone();stations[0].downtime=100;
 assert.throws(()=>compute(stations),RangeError);
});
