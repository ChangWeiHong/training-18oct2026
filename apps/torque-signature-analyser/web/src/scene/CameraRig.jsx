import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { slotAngle, slotPosition } from './Flange.jsx';

export function presetPose(preset, focus) {
  if (preset === 'section' && focus != null) {
    const a = slotAngle(focus);
    const P = slotPosition(focus);
    const R = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const T = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    return {
      target: P.clone().setY(3.9),
      position: P.clone().addScaledVector(T, 11.5).addScaledVector(R, 3.4).setY(6.4),
    };
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

/** Bounded orbit (no pan, no auto-rotate) with preset moves. Orbiting never touches the cursor. */
export default function CameraRig({ preset, focus, reducedMotion }) {
  const { camera, invalidate } = useThree();
  const controls = useRef();
  const anim = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    const to = presetPose(preset, focus);
    const c = controls.current;
    if (!c) return;
    if (first.current || reducedMotion) {
      first.current = false;
      camera.position.copy(to.position);
      c.target.copy(to.target);
      c.update();
      invalidate();
      return;
    }
    anim.current = { t: 0, fromPos: camera.position.clone(), fromTarget: c.target.clone(), to };
    invalidate();
  }, [preset, focus, reducedMotion, camera, invalidate]);

  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + dt / 0.5);
    const k = 1 - (1 - a.t) ** 3;
    camera.position.lerpVectors(a.fromPos, a.to.position, k);
    c.target.lerpVectors(a.fromTarget, a.to.target, k);
    c.update();
    if (a.t >= 1) anim.current = null;
    else invalidate();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping={false}
      autoRotate={false}
      minDistance={5}
      maxDistance={34}
      minPolarAngle={0.2}
      maxPolarAngle={1.42}
    />
  );
}
