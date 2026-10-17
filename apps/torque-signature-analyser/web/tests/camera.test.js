import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { presetPose, FOV, STACK } from '../src/scene/camera.js';
import { slotAngle, slotPosition } from '../src/scene/flangeLayout.js';

function project(cam, v) {
  return v.clone().project(cam);
}

for (const aspect of [0.6, 0.9, 1.3, 1.8, 2.4]) {
  for (const slot of [0, 2, 5]) {
    test(`section preset fits the stack at aspect ${aspect}, slot ${slot}`, () => {
      const pose = presetPose('section', slot, aspect);
      const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.5, 120);
      cam.position.copy(pose.position);
      cam.lookAt(pose.target);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();
      const P = slotPosition(slot);
      const R = new THREE.Vector3(Math.cos(slotAngle(slot)), 0, Math.sin(slotAngle(slot)));
      const top = project(cam, P.clone().setY(STACK.top));
      const bottom = project(cam, P.clone().setY(STACK.bottom));
      const axis = project(cam, P.clone().setY((STACK.top + STACK.bottom) / 2));
      assert.ok(top.y <= 0.9 && top.y >= -0.9, `top y ${top.y}`);
      assert.ok(bottom.y <= 0.9 && bottom.y >= -0.9, `bottom y ${bottom.y}`);
      assert.ok(Math.abs(axis.x) <= 0.1, `axis x ${axis.x}`);
      for (const s of [-1, 1]) {
        const side = project(cam, P.clone().addScaledVector(R, (s * STACK.width) / 2).setY(1));
        assert.ok(Math.abs(side.x) <= 1, `side x ${side.x}`);
      }
    });
  }
}

import { flangeBoundPoints, orbitStep, keyAction, ORBIT } from '../src/scene/camera.js';
import { hasWebGL2 } from '../src/scene/webgl.js';

for (const aspect of [0.6, 0.9, 1.3, 1.8, 2.4]) {
  for (const [preset, focus] of [['section', 2], ['flange', 2], ['flange', null]]) {
    test(`${preset} preset (focus ${focus}) bounds inside NDC at aspect ${aspect}`, () => {
      const pose = presetPose(preset, focus, aspect);
      const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.5, 120);
      cam.position.copy(pose.position);
      cam.lookAt(pose.target);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();
      const pts = preset === 'flange' ? flangeBoundPoints() : [-1, 1].flatMap((s) => [STACK.top, STACK.bottom].map((y) => {
        const P = slotPosition(focus);
        const R = new THREE.Vector3(Math.cos(slotAngle(focus)), 0, Math.sin(slotAngle(focus)));
        return P.clone().addScaledVector(R, (s * STACK.width) / 2).setY(y);
      }));
      for (const p of pts) {
        const q = project(cam, p);
        assert.ok(Math.abs(q.x) <= 0.92 + 1e-6 && Math.abs(q.y) <= 0.92 + 1e-6, `(${q.x.toFixed(3)}, ${q.y.toFixed(3)})`);
      }
      const d = pose.position.distanceTo(pose.target);
      assert.ok(d >= ORBIT.minDistance && d <= ORBIT.maxDistance, `distance ${d}`);
    });
  }
}

test('orbitStep rotates about the target within the polar and distance bounds', () => {
  const target = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3(0, 10, 10);
  const r0 = pos.distanceTo(target);
  const a = orbitStep(pos, target, { dTheta: 0.3 });
  assert.ok(Math.abs(a.distanceTo(target) - r0) < 1e-9);
  assert.ok(Math.abs(a.y - pos.y) < 1e-9);
  assert.ok(a.x !== pos.x);
  const far = orbitStep(pos, target, { scale: 100 });
  assert.ok(Math.abs(far.distanceTo(target) - ORBIT.maxDistance) < 1e-9);
  const near = orbitStep(pos, target, { scale: 0.001 });
  assert.ok(Math.abs(near.distanceTo(target) - ORBIT.minDistance) < 1e-9);
  const top = orbitStep(new THREE.Vector3(0, 30, 0.01), target, { dPhi: -1 });
  const polar = new THREE.Spherical().setFromVector3(top.clone().sub(target)).phi;
  assert.ok(polar >= ORBIT.minPolar - 1e-9);
});

test('keyAction maps panel keys and ignores arrows and modified keys', () => {
  assert.equal(keyAction({ key: 'q' }), 'rotateLeft');
  assert.equal(keyAction({ key: 'E' }), 'rotateRight');
  assert.equal(keyAction({ key: '+' }), 'zoomIn');
  assert.equal(keyAction({ key: '=' }), 'zoomIn');
  assert.equal(keyAction({ key: '-' }), 'zoomOut');
  assert.equal(keyAction({ key: 'w' }), 'tiltUp');
  assert.equal(keyAction({ key: 'S' }), 'tiltDown');
  assert.equal(keyAction({ key: 'w', ctrlKey: true }), null);
  assert.equal(keyAction({ key: '0' }), 'reset');
  assert.equal(keyAction({ key: 'ArrowLeft' }), null);
  assert.equal(keyAction({ key: ' ' }), null);
  assert.equal(keyAction({ key: 'q', ctrlKey: true }), null);
  assert.equal(keyAction({ key: '0', metaKey: true }), null);
});

test('hasWebGL2 requires a webgl2 context only', () => {
  const doc = (fn) => ({ createElement: () => ({ getContext: fn }) });
  assert.equal(hasWebGL2(doc((t) => (t === 'webgl2' ? {} : null))), true);
  assert.equal(hasWebGL2(doc((t) => (t === 'webgl' ? {} : null))), false);
  assert.equal(hasWebGL2(doc(() => { throw new Error('x'); })), false);
});

test('tilt steps stay inside the polar limits', () => {
  const target = new THREE.Vector3(0, 1.5, 0);
  const phi = (p) => new THREE.Spherical().setFromVector3(p.clone().sub(target)).phi;
  let p = new THREE.Vector3(0, 10, 10);
  for (let i = 0; i < 40; i += 1) p = orbitStep(p, target, { dPhi: -0.12 });
  assert.ok(Math.abs(phi(p) - ORBIT.minPolar) < 1e-9);
  for (let i = 0; i < 80; i += 1) p = orbitStep(p, target, { dPhi: 0.12 });
  assert.ok(Math.abs(phi(p) - ORBIT.maxPolar) < 1e-9);
});

test('bolt holes sit evenly around the circle for any bolt count', () => {
  for (const n of [1, 2, 3, 4, 6]) {
    for (let s = 0; s < n; s += 1) {
      assert.ok(Math.abs(slotAngle(s, n) - (s * 2 * Math.PI) / n) < 1e-12);
      const p = slotPosition(s, n);
      assert.ok(Math.abs(Math.hypot(p.x, p.z) - 5.6) < 1e-9);
    }
  }
  assert.equal(slotAngle(1), Math.PI / 3);
});

test('presets fit for 1 to 6 bolts', () => {
  for (const n of [1, 2, 3, 4, 6]) {
    for (const aspect of [0.6, 1.3, 2.4]) {
      const pose = presetPose('flange', n - 1, aspect, n);
      assert.ok(Number.isFinite(pose.position.x) && pose.position.length() > 0);
      const pts = flangeBoundPoints(n);
      assert.equal(pts.length, 48 + 10 * n);
    }
  }
});
