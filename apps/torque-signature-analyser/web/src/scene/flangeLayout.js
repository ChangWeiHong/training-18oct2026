import * as THREE from 'three';

// Units: 1 = 10 mm. Shared by the flange meshes, the clipping planes and the camera presets.
export const FLANGE = { baseT: 1.8, topT: 1.4, baseR: 7.2, topR: 6.6, circle: 5.6, holeTop: 0.66, holeBase: 0.58, window: 1.4 };
export const slotAngle = (slot) => (slot * Math.PI) / 3;
export const slotPosition = (slot) => new THREE.Vector3(Math.cos(slotAngle(slot)) * FLANGE.circle, 0, Math.sin(slotAngle(slot)) * FLANGE.circle);
