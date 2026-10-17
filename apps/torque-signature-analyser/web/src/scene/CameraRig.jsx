import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { presetPose, orbitStep, ORBIT } from './camera.js';

/** Bounded orbit (no pan, no auto-rotate) with preset moves. Orbiting never touches the cursor. */
const STEP = { rotate: 0.2, tilt: 0.12, zoom: 0.85 };

export default function CameraRig({ preset, focus, count = 6, reducedMotion, apiRef }) {
  const { camera, invalidate, size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const lastAspect = useRef(aspect);
  const controls = useRef();
  const anim = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    const to = presetPose(preset, focus, aspect, count);
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
  }, [preset, focus, count, aspect, reducedMotion, camera, invalidate]);

  // Keyboard / button inspection: same bounds as the mouse, never touches the cursor or pans.
  useEffect(() => {
    if (!apiRef) return undefined;
    const move = (opts) => {
      const c = controls.current;
      if (!c) return;
      anim.current = null;
      camera.position.copy(orbitStep(camera.position, c.target, opts));
      c.update();
      invalidate();
    };
    apiRef.current = {
      rotateLeft: () => move({ dTheta: -STEP.rotate }),
      rotateRight: () => move({ dTheta: STEP.rotate }),
      tiltUp: () => move({ dPhi: -STEP.tilt }),
      tiltDown: () => move({ dPhi: STEP.tilt }),
      zoomIn: () => move({ scale: STEP.zoom }),
      zoomOut: () => move({ scale: 1 / STEP.zoom }),
      reset: () => {
        const c = controls.current;
        if (!c) return;
        const to = presetPose(preset, focus, aspect, count);
        if (reducedMotion) {
          anim.current = null;
          camera.position.copy(to.position);
          c.target.copy(to.target);
          c.update();
        } else {
          anim.current = { t: 0, fromPos: camera.position.clone(), fromTarget: c.target.clone(), to };
        }
        invalidate();
      },
    };
    return () => { apiRef.current = null; };
  }, [apiRef, camera, invalidate, preset, focus, count, aspect, reducedMotion]);

  useEffect(() => {
    if (!import.meta.env?.DEV) return undefined;
    window.__tsaCam = () => ({
      pos: camera.position.toArray(), target: controls.current?.target.toArray(), aspect, size: [size.width, size.height],
      anim: Boolean(anim.current), expected: Object.fromEntries(Object.entries(presetPose(preset, focus, aspect, count)).map(([k, v]) => [k, v.toArray()])),
    });
    return () => { delete window.__tsaCam; };
  }, [camera, aspect, size.width, size.height, preset, focus, count]);

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
      minDistance={ORBIT.minDistance}
      maxDistance={ORBIT.maxDistance}
      minPolarAngle={ORBIT.minPolar}
      maxPolarAngle={ORBIT.maxPolar}
    />
  );
}
