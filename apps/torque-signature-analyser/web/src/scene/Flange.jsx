import * as THREE from 'three';

// Units: 1 = 10 mm. Wheel-hub flange (cast) with a mating plate (steel) clamped on top. Axis = +y.
export const FLANGE = { baseT: 1.8, topT: 1.4, baseR: 7.2, topR: 6.6, circle: 5.6, holeTop: 0.66, holeBase: 0.58, window: 1.4 };
export const slotAngle = (slot) => (slot * Math.PI) / 3;
export const slotPosition = (slot) => new THREE.Vector3(Math.cos(slotAngle(slot)) * FLANGE.circle, 0, Math.sin(slotAngle(slot)) * FLANGE.circle);

const cache = {};
function plateGeometry(key, outerR, boreR, holeR, depth) {
  return (cache[key] ??= (() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, outerR, 0, Math.PI * 2, false);
    const bore = new THREE.Path();
    bore.absarc(0, 0, boreR, 0, Math.PI * 2, true);
    s.holes.push(bore);
    for (let k = 0; k < 6; k += 1) {
      const h = new THREE.Path();
      h.absarc(Math.cos(slotAngle(k)) * FLANGE.circle, -Math.sin(slotAngle(k)) * FLANGE.circle, holeR, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 40 });
    g.rotateX(-Math.PI / 2);
    return g;
  })());
}
const hubGeo = () => (cache.hub ??= new THREE.CylinderGeometry(2.5, 2.8, 1.2, 48, 1, true).translate(0, -0.6, 0));
const planeGeo = () => (cache.plane ??= new THREE.PlaneGeometry(1, 1));

/**
 * The two plates. `squash` is the visual compression (same unit as the scene); `focus` = slot index that is
 * shown in half-section (caps are drawn in a frame whose local x runs along the radius).
 */
export default function Flange({ materials, squash = 0, focus }) {
  const top = plateGeometry('top', FLANGE.topR, 2.6, FLANGE.holeTop, FLANGE.topT);
  const base = plateGeometry('base', FLANGE.baseR, 1.6, FLANGE.holeBase, FLANGE.baseT);
  const s = 1 - squash / FLANGE.topT;
  const w = FLANGE.window;
  const plane = planeGeo();
  return (
    <group>
      <mesh geometry={hubGeo()} material={materials.hub} />
      <mesh geometry={base} material={materials.plateBase} />
      <mesh geometry={top} material={materials.plateTop} position={[0, FLANGE.baseT, 0]} scale={[1, s, 1]} />
      {focus != null && (
        <group position={slotPosition(focus)} rotation={[0, -slotAngle(focus), 0]}>
          {[-1, 1].map((sg) => (
            <group key={sg}>
              <mesh geometry={plane} material={materials.capBase} position={[(sg * (FLANGE.holeBase + w)) / 2, FLANGE.baseT / 2, 0.002]} scale={[w - FLANGE.holeBase, FLANGE.baseT, 1]} />
              <mesh geometry={plane} material={materials.capTop} position={[(sg * (FLANGE.holeTop + w)) / 2, FLANGE.baseT + (FLANGE.topT * s) / 2, 0.002]} scale={[w - FLANGE.holeTop, FLANGE.topT * s, 1]} />
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
