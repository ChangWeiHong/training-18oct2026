import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { presetPose } from './camera.js';

/** Bounded orbit (no pan, no auto-rotate) with preset moves. Orbiting never touches the cursor. */
export default function CameraRig({ preset, focus, reducedMotion }) {
  const { camera, invalidate, size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const lastAspect = useRef(aspect);
  const controls = useRef();
  const anim = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    const to = presetPose(preset, focus, aspect);
    const resized = lastAspect.current !== aspect;
    lastAspect.current = aspect;
    const c = controls.current;
    if (!c) return;
    if (first.current || reducedMotion || resized) {
      first.current = false;
      anim.current = null;
      camera.position.copy(to.position);
      c.target.copy(to.target);
      c.update();
      invalidate();
      return;
    }
    anim.current = { t: 0, fromPos: camera.position.clone(), fromTarget: c.target.clone(), to };
    invalidate();
  }, [preset, focus, aspect, reducedMotion, camera, invalidate]);

  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    window.__tsaCam = () => ({
      pos: camera.position.toArray(), target: controls.current?.target.toArray(), aspect, size: [size.width, size.height],
      anim: Boolean(anim.current), expected: Object.fromEntries(Object.entries(presetPose(preset, focus, aspect)).map(([k, v]) => [k, v.toArray()])),
    });
  }

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
    invalidate(); // keep rendering every frame until the tween has landed, then one final frame
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
