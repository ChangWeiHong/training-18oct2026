import * as THREE from 'three';
import { FLANGE, slotAngle, slotPosition } from './flangeLayout.js';

export const FOV = 32;
// Joint-section stack, local y: bolt tip -0.7 up to ~30% of the (shortened) socket, with a 10% margin.
export const STACK = { bottom: -0.7, top: 5.6, width: 3.6 };

// Orbit limits shared with OrbitControls and the keyboard / button actions.
export const ORBIT = { minDistance: 5, maxDistance: 80, minPolar: 0.2, maxPolar: 1.42 };
const FIT_NDC = 0.92; // ~8 % margin

/** Points the flange view must keep in frame: both plate rims and the bolt heads (with washer and head). */
export function flangeBoundPoints() {
  const pts = [];
  const top = FLANGE.baseT + FLANGE.topT;
  const headTop = top + 1.7;
  const ring = (r, y, cx = 0, cz = 0, n = 24) => {
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
    }
  };
  ring(FLANGE.baseR, 0);
  ring(FLANGE.topR, top);
  for (let s = 0; s < 6; s += 1) {
    const P = slotPosition(s);
    ring(1.4, headTop, P.x, P.z, 10);
  }
  return pts;
}

/** Smallest distance along `dir` from `target` at which every point projects inside NDC +-FIT_NDC. */
function fitDistance(points, target, dir, aspect, limit = FIT_NDC) {
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 500);
  const fits = (d) => {
    cam.position.copy(target).addScaledVector(dir, d);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    return points.every((p) => { const q = p.clone().project(cam); return Math.abs(q.x) <= limit && Math.abs(q.y) <= limit; });
  };
  let lo = ORBIT.minDistance, hi = 200;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid; else lo = mid;
  }
  return Math.min(hi, ORBIT.maxDistance);
}

/** Orbit about the target: dTheta (azimuth), dPhi (polar), scale (distance factor), clamped to ORBIT. Returns a new position. */
export function orbitStep(position, target, { dTheta = 0, dPhi = 0, scale = 1 } = {}) {
  const sph = new THREE.Spherical().setFromVector3(position.clone().sub(target));
  sph.theta += dTheta;
  sph.phi = Math.min(ORBIT.maxPolar, Math.max(ORBIT.minPolar, sph.phi + dPhi));
  sph.radius = Math.min(ORBIT.maxDistance, Math.max(ORBIT.minDistance, sph.radius * scale));
  return target.clone().add(new THREE.Vector3().setFromSpherical(sph));
}

/** Panel key -> action. Arrow keys are deliberately not handled (global playback owns them). */
export function keyAction(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case 'q': case 'Q': return 'rotateLeft';
    case 'e': case 'E': return 'rotateRight';
    case 'w': case 'W': return 'tiltUp';
    case 's': case 'S': return 'tiltDown';
    case '+': case '=': return 'zoomIn';
    case '-': case '_': return 'zoomOut';
    case '0': return 'reset';
    default: return null;
  }
}

export function presetPose(preset, focus, aspect = 1.5) {
  if (preset === 'section' && focus != null) {
    const a = slotAngle(focus);
    const P = slotPosition(focus);
    const R = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const T = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const h = (STACK.top - STACK.bottom) * 1.1;
    const half = Math.tan((FOV * Math.PI) / 360);
    let dist = Math.max(h / (2 * half), (STACK.width * 1.2) / (2 * half * aspect)) * 1.06;
    // Cut side towards the viewer, a little elevation and a slight side turn for a 3/4 read.
    const dir = T.clone().addScaledVector(R, 0.25).setY(0.85).normalize();
    const target = P.clone().setY((STACK.top + STACK.bottom) / 2);
    // Perspective and the 3/4 turn widen the stack on narrow screens: also fit its corners.
    const corners = [-1, 1].flatMap((s) => [STACK.top, STACK.bottom].map((y) => P.clone().addScaledVector(R, (s * STACK.width) / 2).setY(y)));
    dist = Math.max(dist, fitDistance(corners, target, dir, aspect, 0.9));
    return { target, position: target.clone().addScaledVector(dir, dist) };
  }
  if (focus != null) {
    // View from the cut side, aimed between the hub and the selected bolt so it sits inside the frame.
    const a = slotAngle(focus);
    const R = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const T = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const target = R.clone().multiplyScalar(2.4).setY(1.8);
    const dir = T.clone().multiplyScalar(17).addScaledVector(R, -4).setY(17).normalize();
    return { target, position: target.clone().addScaledVector(dir, fitDistance(flangeBoundPoints(), target, dir, aspect)) };
  }
  const target = new THREE.Vector3(0, 1.5, 0);
  const dir = new THREE.Vector3(0, 18.5, 18).normalize();
  return { target, position: target.clone().addScaledVector(dir, fitDistance(flangeBoundPoints(), target, dir, aspect)) };
}

