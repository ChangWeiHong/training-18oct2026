import { useMemo } from 'react';
import * as THREE from 'three';

// Units: 1 = 10 mm. M12 hex-flange bolt. Local origin = underside of the head, +y up.
export const BOLT = { shankR: 0.52, length: 4.0, flangeR: 1.3, flangeT: 0.25, hexApothem: 0.9, hexR: 1.0, hexH: 0.7, pitch: 0.175, threadLen: 2.8 };
export const WASHER = { inner: 0.66, outer: 1.38, thickness: 0.2 };

const cache = {};
const once = (key, make) => (cache[key] ??= make());

function hexShape(R) {
  const s = new THREE.Shape();
  for (let k = 0; k < 6; k += 1) {
    const a = (k * Math.PI) / 3;
    const x = Math.cos(a) * R, y = Math.sin(a) * R;
    if (k === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function headGeometry(seg) {
  return once(`head${seg}`, () => {
    const prof = [[0, 0], [1.15, 0], [1.27, 0.03], [1.3, 0.08], [1.3, 0.17], [1.24, 0.23], [1.17, BOLT.flangeT], [0, BOLT.flangeT]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(prof, seg);
  });
}
function hexGeometry(detail) {
  return once(`hex${detail}`, () => {
    const g = new THREE.ExtrudeGeometry(hexShape(BOLT.hexR), {
      depth: BOLT.hexH - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: detail === 'full' ? 3 : 1, curveSegments: 1,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, BOLT.flangeT + 0.04, 0);
    return g;
  });
}
function shankGeometry(seg) {
  return once(`shank${seg}`, () => {
    const L = BOLT.length, r = BOLT.shankR;
    const prof = [[0, -L], [r - 0.12, -L], [r, -L + 0.12], [r, 0.02]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(prof, seg);
  });
}
function threadGeometry() {
  return once('thread', () => {
    const y0 = -BOLT.length + 0.3, len = BOLT.threadLen - 0.3, turns = len / BOLT.pitch, r = BOLT.shankR + 0.015;
    class Helix extends THREE.Curve {
      getPoint(t, out = new THREE.Vector3()) {
        const a = t * turns * Math.PI * 2;
        return out.set(Math.cos(a) * r, y0 + t * len, Math.sin(a) * r);
      }
    }
    return new THREE.TubeGeometry(new Helix(), Math.round(turns * 14), 0.07, 5, false);
  });
}
function socketGeometry(detail) {
  return once(`socket${detail}`, () => {
    const outer = hexShape(1.27);
    const hole = new THREE.Path();
    const R = 1.075;
    for (let k = 0; k < 6; k += 1) {
      const a = (k * Math.PI) / 3;
      if (k === 0) hole.moveTo(Math.cos(a) * R, Math.sin(a) * R); else hole.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    hole.closePath();
    outer.holes.push(hole);
    const ring = new THREE.ExtrudeGeometry(outer, { depth: 1.05, bevelEnabled: false });
    ring.rotateX(-Math.PI / 2);
    ring.translate(0, BOLT.flangeT + 0.04, 0);
    const seg = detail === 'full' ? 32 : 14;
    const drive = new THREE.CylinderGeometry(0.85, 0.95, 1.2, seg, 1, true);
    drive.translate(0, BOLT.flangeT + 0.04 + 1.05 + 0.6, 0);
    const lid = new THREE.CircleGeometry(0.95, seg);
    lid.rotateX(-Math.PI / 2);
    lid.translate(0, BOLT.flangeT + 0.04 + 1.05, 0);
    return { ring, drive, lid };
  });
}
function washerGeometry(seg) {
  return once(`washer${seg}`, () => {
    const { inner, outer, thickness: t } = WASHER;
    const prof = [[inner, 0], [outer - 0.04, 0], [outer, 0.04], [outer, t - 0.04], [outer - 0.04, t], [inner, t], [inner, 0]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(prof, seg);
  });
}
const ringGeo = () => once('ringGeo', () => new THREE.TorusGeometry(1.14, 0.055, 8, 48));
const edgeGeo = () => once('edgeGeo', () => new THREE.TorusGeometry(1.3, 0.03, 6, 64));
const planeGeo = () => once('plane', () => new THREE.PlaneGeometry(1, 1));

/** Half-width of the regular hex head along the world cut line, for a bolt turned by `rot` radians about y. */
export function hexHalfWidth(rot) {
  const dir = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), -rot);
  const alpha = Math.atan2(-dir.z, dir.x);
  const sixty = Math.PI / 3;
  const d = ((((alpha - Math.PI / 6) % sixty) + sixty + Math.PI / 6) % sixty) - Math.PI / 6;
  return BOLT.hexApothem / Math.cos(d) + 0.04;
}

export function Washer({ materials, cut, detail }) {
  const geo = washerGeometry(detail === 'full' ? 48 : 20);
  const plane = planeGeo();
  return (
    <group>
      <mesh geometry={geo} material={cut ? materials.washer : materials.washerFree} />
      {cut && [-1, 1].map((s) => (
        <mesh key={s} geometry={plane} material={materials.capBolt} position={[(s * (WASHER.inner + WASHER.outer)) / 2, WASHER.thickness / 2, 0.004]} scale={[WASHER.outer - WASHER.inner, WASHER.thickness, 1]} />
      ))}
    </group>
  );
}

/**
 * Bolt, optional socket and head ring. `rotation` in rad. `cut` adds the half-section caps,
 * `detail` is 'full' (helical thread) or 'simple' (smooth shank). `lit` = sea-glass accent while the cursor moves.
 */
export default function Bolt({ materials, status, rotation = 0, cut = false, detail = 'simple', showSocket = false, lit = false, onClick, onPointerOver, onPointerOut }) {
  const full = detail === 'full';
  const head = headGeometry(full ? 64 : 28);
  const hex = hexGeometry(detail);
  const shank = shankGeometry(full ? 48 : 18);
  const thread = useMemo(() => (full ? threadGeometry() : null), [full]);
  const sock = showSocket ? socketGeometry(detail) : null;
  const zinc = cut ? materials.zinc : materials.zincFree;
  const ring = (cut ? materials.ringCut : materials.ring)[status];
  const hw = cut ? hexHalfWidth(rotation) : 0;
  const L = BOLT.length;
  const plane = planeGeo();
  // Only the rotating parts spin about the bolt axis, so the section caps stay planar.
  return (
    <group onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <group rotation={[0, rotation, 0]}>
        <mesh geometry={head} material={zinc} />
        <mesh geometry={hex} material={zinc} />
        <mesh geometry={shank} material={zinc} />
        {thread && <mesh geometry={thread} material={zinc} />}
        {cut && (
          <group rotation={[0, Math.PI / 4, 0]}>
            {/* Index marks: bright stripe over the hex top and down the vertex edge, on a dark underlay, so turning reads in 3/4 view. */}
            <mesh geometry={plane} material={materials.markBack} position={[0.5, BOLT.flangeT + BOLT.hexH + 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.0, 0.3, 1]} />
            <mesh geometry={plane} material={materials.mark} position={[0.5, BOLT.flangeT + BOLT.hexH + 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.96, 0.17, 1]} />
            <mesh geometry={plane} material={materials.markBack} position={[0.795, BOLT.flangeT + BOLT.hexH / 2 + 0.04, -0.459]} rotation={[0, (2 * Math.PI) / 3, 0]} scale={[0.36, BOLT.hexH, 1]} />
            <mesh geometry={plane} material={materials.mark} position={[0.799, BOLT.flangeT + BOLT.hexH / 2 + 0.04, -0.461]} rotation={[0, (2 * Math.PI) / 3, 0]} scale={[0.2, BOLT.hexH, 1]} />
            <mesh geometry={plane} material={materials.mark} position={[1.17, BOLT.flangeT + 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.2, 0.1, 1]} />
          </group>
        )}
      </group>
      <mesh geometry={ringGeo()} material={ring} position={[0, BOLT.flangeT + 0.012, 0]} rotation={[Math.PI / 2, 0, 0]} />
      {lit && <mesh geometry={edgeGeo()} material={materials.edge} position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} />}
      {cut && (
        <>
          <mesh geometry={plane} material={materials.capBolt} position={[0, BOLT.flangeT / 2, 0.004]} scale={[2 * BOLT.flangeR - 0.1, BOLT.flangeT, 1]} />
          <mesh geometry={plane} material={materials.capBolt} position={[0, BOLT.flangeT + BOLT.hexH / 2, 0.004]} scale={[2 * hw, BOLT.hexH, 1]} />
          <mesh geometry={plane} material={materials.capBolt} position={[0, -L / 2, 0.004]} scale={[2 * BOLT.shankR, L, 1]} />
        </>
      )}
    </group>
  );
}
