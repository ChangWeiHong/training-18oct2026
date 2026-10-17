import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import Bolt, { Washer, WASHER } from './Bolt.jsx';
import Flange, { FLANGE, slotAngle, slotPosition } from './Flange.jsx';
import CameraRig from './CameraRig.jsx';
import SceneFallback from './SceneFallback.jsx';
import Overlay, { JointHeader, JointStrip } from './Overlay.jsx';
import { createMaterials, tokenColor } from './materials.js';
import { keyAction } from './camera.js';
import { hasWebGL2 } from './webgl.js';
import { useReducedMotion } from '../motion.js';
import { boltSlots, jointPose, statusKind } from './kinematics.js';

// R15: starting head-to-washer gap is 30% of the head height; compression cap is 10% of the top plate.
const GAP_MAX = 0.3 * 0.95;
const MAX_COMPRESSION = 0.1 * FLANGE.topT;
// Lifted exposure so plates, washer and bolt read against the graphite background.
const EXPOSURE = 1.3;

/** Clipping planes for the half-section: one plane through the bolt axis, plus a window slab for the plates. */
function cutPlanes(slot, count) {
  if (slot == null) return { single: [], box: [] };
  const a = slotAngle(slot, count);
  const P = slotPosition(slot, count);
  const R = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  const T = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
  const A = new THREE.Plane(T.clone().negate(), T.dot(P));
  const B1 = new THREE.Plane(R.clone().negate(), R.dot(P) - FLANGE.window);
  const B2 = new THREE.Plane(R.clone(), -R.dot(P) - FLANGE.window);
  return { single: [A], box: [A, B1, B2] };
}

function Scene({ rigApi, count, focus, siblings, selected, pose, preset, detail, lit, reducedMotion, onSelect }) {
  const { invalidate, gl } = useThree();
  const materials = useMemo(() => createMaterials(cutPlanes(focus, count)), [focus, count]);
  const bg = useMemo(() => tokenColor('--color-paper', '#15191c'), []);
  useEffect(() => () => materials.dispose(), [materials]);
  useEffect(() => { gl.localClippingEnabled = true; invalidate(); }, [gl, invalidate]);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);
  useEffect(() => {
    materials.socket.emissive.copy(lit ? materials.motion : new THREE.Color(0, 0, 0));
    materials.socket.emissiveIntensity = lit ? 0.35 : 0;
    invalidate();
  }, [lit, materials, invalidate]);

  const compression = pose.compression;
  const topY = FLANGE.baseT + FLANGE.topT - compression;
  const gapUnits = pose.gap * GAP_MAX;
  const pick = (id) => (e) => {
    e.stopPropagation();
    if (e.delta < 4) onSelect(id);
  };
  const hover = (on) => (e) => { e.stopPropagation(); document.body.style.cursor = on ? 'pointer' : ''; };

  return (
    <>
      <color attach="background" args={[bg]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[-6, 12, 8]} intensity={1.6} color="#fff2df" />
      <directionalLight position={[8, 5, -4]} intensity={0.9} color="#aec7df" />
      <directionalLight position={[3, 6, 12]} intensity={1.2} color="#fff6ea" />
      <Environment resolution={256} frames={1} environmentIntensity={1.25}>
        <color attach="background" args={['#2a3036']} />
        <Lightformer form="rect" intensity={14} position={[-5, 4.2, 4.8]} scale={[5.2, 3.9]} color="#fff4e2" />
        <Lightformer form="rect" intensity={5} position={[6, 1.6, 2]} scale={[3, 5.4]} color="#b4d0ee" />
        <Lightformer form="rect" intensity={7} position={[2.5, 2.2, -5.5]} scale={[2, 4.6]} color="#ffe2b8" />
        <Lightformer form="rect" intensity={5} position={[0, 6, 0]} scale={[7.5, 2.2]} color="#e4ecf4" />
      </Environment>

      <Flange materials={materials} squash={compression} focus={focus} count={count} />

      {(preset === 'flange' || focus == null) && siblings.map(({ slot, rundown, kind }) => {
        const last = (rundown.curve?.angle?.[rundown.curve.angle.length - 1] ?? 0) * (Math.PI / 180);
        return (
          <group key={rundown.id} position={slotPosition(slot, count).setY(topY + WASHER.thickness)} rotation={[0, -slotAngle(slot, count), 0]}>
            <group position={[0, -WASHER.thickness, 0]}><Washer materials={materials} cut={false} detail="simple" /></group>
            <Bolt materials={materials} status={kind} rotation={-last} detail="simple" onClick={pick(rundown.id)} onPointerOver={hover(true)} onPointerOut={hover(false)} />
          </group>
        );
      })}

      {focus != null && selected && (
        <group position={slotPosition(focus, count).setY(topY)} rotation={[0, -slotAngle(focus, count), 0]}>
          <Washer materials={materials} cut detail={detail} />
          {gapUnits > 0.01 && (
            <mesh material={materials.gapMat} position={[0, WASHER.thickness + gapUnits / 2, 0]}>
              <cylinderGeometry args={[1.3, 1.3, gapUnits, 40, 1, true]} />
            </mesh>
          )}
          <group position={[0, WASHER.thickness + gapUnits, 0]}>
            <Bolt materials={materials} status={statusKind(selected)} rotation={-pose.rotationRad} cut detail={detail} showSocket lit={lit} />
          </group>
        </group>
      )}

      <CameraRig apiRef={rigApi} preset={focus == null ? 'flange' : preset} focus={focus} count={count} reducedMotion={reducedMotion} />
    </>
  );
}

function JointView({ result, selected, cursor, onSelect, bolts = 6 }) {
  const box = useRef(null);
  const [compact, setCompact] = useState(false);
  const [preset, setPreset] = useState('section');
  const [lit, setLit] = useState(false);
  const reducedMotion = useReducedMotion();
  const rigApi = useRef(null);
  const onView = (k) => rigApi.current?.[k]?.();
  // Keys only act while focus is inside this panel; they never touch the cursor, and are consumed so global playback keys stay quiet.
  const onKeyDown = (e) => {
    const a = keyAction(e);
    if (!a) return;
    e.preventDefault();
    onView(a);
  };

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sea-glass accent only while the cursor is advancing. The off-timer is restarted on each advance and is never
  // dropped by a later cursor change, so the accent always resets; it is only cleared on unmount.
  const prev = useRef(cursor);
  const litTimer = useRef(null);
  useEffect(() => () => clearTimeout(litTimer.current), []);
  useEffect(() => {
    const advanced = cursor > prev.current;
    prev.current = cursor;
    if (reducedMotion) { clearTimeout(litTimer.current); setLit(false); return; }
    if (!advanced) return;
    setLit(true);
    clearTimeout(litTimer.current);
    litTimer.current = setTimeout(() => setLit(false), 220);
  }, [cursor, reducedMotion]);

  const rundowns = result?.rundowns ?? [];
  const { slots, overflow, focus } = useMemo(() => {
    const mates = selected ? rundowns.filter((r) => r.assembly_id === selected.assembly_id) : [];
    const s = boltSlots(mates, bolts);
    const withKind = s.slots.map((x) => ({ ...x, kind: statusKind(x.rundown) }));
    return { slots: withKind, overflow: s.overflow, focus: withKind.find((x) => x.rundown.id === selected?.id)?.slot };
  }, [rundowns, selected, bolts]);

  const spec = result?.spec ?? null;
  const torqueMax = spec?.torque_max_nm ?? Math.max(1, ...rundowns.map((r) => r.features?.final_torque ?? 0));
  const snug = selected?.features?.snug_angle ?? null;
  const pose = useMemo(
    () => jointPose(selected?.curve, cursor, snug, { torqueMax, maxCompression: MAX_COMPRESSION }),
    [selected, cursor, snug, torqueMax],
  );
  const detail = !compact && preset === 'section' && focus != null ? 'full' : 'simple';
  const note = selected && focus == null ? `${selected.id} is not drawn: it repeats a bolt position or the assembly has more bolts than this joint. Use the ledger.` : null;

  return (
    <div className="joint-wrap" onKeyDown={onKeyDown}>
    <JointHeader
      selected={selected}
      preset={focus == null ? 'flange' : preset}
      onPreset={setPreset}
      slots={slots}
      selectedId={selected?.id}
      onSelect={onSelect}
      onView={onView}
      note={note ?? (overflow.length ? `${overflow.length} extra bolt(s) in this assembly are not drawn. Use the ledger.` : null)}
    />
    <div className="joint" ref={box} tabIndex={0} role="group" aria-label="3D joint view. Q and E rotate, plus and minus zoom, 0 resets.">
      <Canvas
        dpr={[1, 2]}
        frameloop="demand"
        camera={{ fov: 32, near: 0.5, far: 200, position: [0, 20, 18] }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => { gl.toneMappingExposure = EXPOSURE; }}
        aria-label="3D bolted joint, half section"
      >
        <Scene
          rigApi={rigApi}
          count={bolts}
          focus={focus}
          siblings={slots.filter((s) => s.slot !== focus)}
          selected={selected}
          pose={pose}
          preset={preset}
          detail={detail}
          lit={lit}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
        />
      </Canvas>
      <Overlay pose={pose} torqueMax={torqueMax} spec={spec} />
    </div>
    <JointStrip />
    </div>
  );
}

export default function JointScene(props) {
  const ok = useMemo(() => hasWebGL2(), []);
  if (!ok) return <SceneFallback />;
  return <JointView {...props} />;
}
