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
