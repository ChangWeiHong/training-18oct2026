import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import Bolt, { Washer, WASHER } from './Bolt.jsx';
import Flange, { FLANGE, slotAngle, slotPosition } from './Flange.jsx';
import CameraRig from './CameraRig.jsx';
import Overlay from './Overlay.jsx';
import { createMaterials, tokenColor } from './materials.js';
import { boltSlots, jointPose, statusKind, travelAt } from './kinematics.js';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Clipping planes for the half-section: one plane through the bolt axis, plus a window slab for the plates. */
function cutPlanes(slot) {
  if (slot == null) return { single: [], box: [] };
  const a = slotAngle(slot);
  const P = slotPosition(slot);
  const R = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  const T = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
  const A = new THREE.Plane(T.clone().negate(), T.dot(P));
  const B1 = new THREE.Plane(R.clone().negate(), R.dot(P) - FLANGE.window);
  const B2 = new THREE.Plane(R.clone(), -R.dot(P) - FLANGE.window);
  return { single: [A], box: [A, B1, B2] };
}

function Scene({ focus, siblings, selected, pose, snugAngle, preset, detail, lit, reducedMotion, onSelect }) {
  const { invalidate, gl } = useThree();
  const materials = useMemo(() => createMaterials(cutPlanes(focus)), [focus]);
  const bg = useMemo(() => tokenColor('--color-paper', '#15191c'), []);
  useEffect(() => () => materials.dispose(), [materials]);
  useEffect(() => { gl.localClippingEnabled = true; invalidate(); }, [gl, invalidate]);
  useEffect(() => {
    materials.socket.emissive.copy(lit ? materials.motion : new THREE.Color(0, 0, 0));
    materials.socket.emissiveIntensity = lit ? 0.35 : 0;
    invalidate();
  }, [lit, materials, invalidate]);

  const compression = pose.compression;
  const topY = FLANGE.baseT + FLANGE.topT - compression;
  const gapUnits = snugAngle == null ? 0 : (travelAt(snugAngle, snugAngle) - pose.travel) / 10;
  const pick = (id) => (e) => {
    e.stopPropagation();
    if (e.delta < 4) onSelect(id);
  };
  const hover = (on) => (e) => { e.stopPropagation(); document.body.style.cursor = on ? 'pointer' : ''; };

  return (
    <>
      <color attach="background" args={[bg]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-6, 12, 8]} intensity={1.6} color="#fff2df" />
      <directionalLight position={[8, 5, -4]} intensity={0.5} color="#aec7df" />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#0b0d0e']} />
        <Lightformer form="rect" intensity={9} position={[-5, 4.2, 4.8]} scale={[5.2, 3.9]} color="#fff4e2" />
        <Lightformer form="rect" intensity={3} position={[6, 1.6, 2]} scale={[3, 5.4]} color="#b4d0ee" />
        <Lightformer form="rect" intensity={4} position={[2.5, 2.2, -5.5]} scale={[2, 4.6]} color="#ffe2b8" />
        <Lightformer form="rect" intensity={3} position={[0, 6, 0]} scale={[7.5, 2.2]} color="#e4ecf4" />
      </Environment>

      <Flange materials={materials} squash={compression} focus={focus} />

      {siblings.map(({ slot, rundown, kind }) => {
        const last = (rundown.curve?.angle?.[rundown.curve.angle.length - 1] ?? 0) * (Math.PI / 180);
        return (
          <group key={rundown.id} position={slotPosition(slot).setY(topY + WASHER.thickness)} rotation={[0, -slotAngle(slot), 0]}>
            <group position={[0, -WASHER.thickness, 0]}><Washer materials={materials} cut={false} detail="simple" /></group>
            <Bolt materials={materials} status={kind} rotation={-last} detail="simple" onClick={pick(rundown.id)} onPointerOver={hover(true)} onPointerOut={hover(false)} />
          </group>
        );
      })}

      {focus != null && selected && (
        <group position={slotPosition(focus).setY(topY)} rotation={[0, -slotAngle(focus), 0]}>
          <Washer materials={materials} cut detail={detail} />
          <group position={[0, WASHER.thickness + gapUnits, 0]}>
            <Bolt materials={materials} status={statusKind(selected)} rotation={-pose.rotationRad} cut detail={detail} showSocket lit={lit} />
          </group>
        </group>
      )}

      <CameraRig preset={focus == null ? 'flange' : preset} focus={focus} reducedMotion={reducedMotion} />
    </>
  );
}

function JointView({ result, selected, cursor, onSelect }) {
  const box = useRef(null);
  const [compact, setCompact] = useState(false);
  const [preset, setPreset] = useState('section');
  const [lit, setLit] = useState(false);
  const reducedMotion = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sea-glass accent only while the cursor is advancing.
  const prev = useRef(cursor);
  useEffect(() => {
    if (prev.current === cursor) return undefined;
    prev.current = cursor;
    setLit(true);
    const t = setTimeout(() => setLit(false), 220);
    return () => clearTimeout(t);
  }, [cursor]);

  const rundowns = result?.rundowns ?? [];
  const { slots, overflow, focus } = useMemo(() => {
    const mates = selected ? rundowns.filter((r) => r.assembly_id === selected.assembly_id) : [];
    const s = boltSlots(mates);
    const withKind = s.slots.map((x) => ({ ...x, kind: statusKind(x.rundown) }));
    return { slots: withKind, overflow: s.overflow, focus: withKind.find((x) => x.rundown.id === selected?.id)?.slot };
  }, [rundowns, selected]);

  const spec = result?.spec ?? null;
  const torqueMax = spec?.torque_max_nm ?? Math.max(1, ...rundowns.map((r) => r.features?.final_torque ?? 0));
  const snug = selected?.features?.snug_angle ?? null;
  const pose = useMemo(
    () => jointPose(selected?.curve, cursor, snug, { torqueMax, maxCompression: 0.04 * FLANGE.topT }),
    [selected, cursor, snug, torqueMax],
  );
  const detail = !compact && preset === 'section' && focus != null ? 'full' : 'simple';
  const note = selected && focus == null ? `${selected.id} is not drawn: it repeats a bolt position or the assembly has more than six bolts. Use the ledger.` : null;

  return (
    <div className="joint" ref={box}>
      <Canvas
        dpr={[1, 2]}
        frameloop="demand"
        camera={{ fov: 32, near: 0.5, far: 120, position: [0, 20, 18] }}
        gl={{ antialias: true }}
        aria-label="3D bolted joint, half section"
      >
        <Scene
          focus={focus}
          siblings={slots.filter((s) => s.slot !== focus)}
          selected={selected}
          pose={pose}
          snugAngle={snug}
          preset={preset}
          detail={detail}
          lit={lit}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
        />
      </Canvas>
      <Overlay
        selected={selected}
        pose={pose}
        torqueMax={torqueMax}
        spec={spec}
        preset={focus == null ? 'flange' : preset}
        onPreset={setPreset}
        slots={slots}
        selectedId={selected?.id}
        onSelect={onSelect}
        note={note ?? (overflow.length ? `${overflow.length} extra bolt(s) in this assembly are not drawn. Use the ledger.` : null)}
      />
    </div>
  );
}

export default function JointScene(props) {
  const ok = useMemo(hasWebGL, []);
  if (!ok) {
    return <div className="joint-fallback" role="note">3D view needs WebGL. The graph, evidence and ledger still work.</div>;
  }
  return <JointView {...props} />;
}
