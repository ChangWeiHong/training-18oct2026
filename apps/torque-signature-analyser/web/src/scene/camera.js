import * as THREE from 'three';
import { slotAngle, slotPosition } from './flangeLayout.js';

export const FOV = 32;
// Joint-section stack, local y: bolt tip -0.7 up to ~30% of the (shortened) socket, with a 10% margin.
export const STACK = { bottom: -0.7, top: 5.6, width: 3.6 };

export function presetPose(preset, focus, aspect = 1.5) {
  if (preset === 'section' && focus != null) {
    const a = slotAngle(focus);
    const P = slotPosition(focus);
    const R = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const T = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const h = (STACK.top - STACK.bottom) * 1.1;
    const half = Math.tan((FOV * Math.PI) / 360);
    const dist = Math.max(h / (2 * half), (STACK.width * 1.2) / (2 * half * aspect)) * 1.06;
    // Cut side towards the viewer, a little elevation and a slight side turn for a 3/4 read.
    const dir = T.clone().addScaledVector(R, 0.25).setY(0.85).normalize();
    const target = P.clone().setY((STACK.top + STACK.bottom) / 2);
    return { target, position: target.clone().addScaledVector(dir, dist) };
  }
  if (focus != null) {
    // View from the cut side, aimed between the hub and the selected bolt so it sits inside the frame.
    const a = slotAngle(focus);
    const R = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const T = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const target = R.clone().multiplyScalar(2.4).setY(1.8);
    return { target, position: target.clone().addScaledVector(T, 17).addScaledVector(R, -4).setY(17) };
  }
  return { target: new THREE.Vector3(0, 1.5, 0), position: new THREE.Vector3(0, 20, 18) };
}

