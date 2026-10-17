import * as THREE from 'three';

/** Resolve a CSS token (OKLCH) to a THREE.Color through a 1px canvas, so no colour is hard coded here. */
export function tokenColor(name, fallback = '#888888') {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = fallback;
    ctx.fillStyle = raw || fallback;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
  } catch {
    return new THREE.Color(fallback);
  }
}

/** Roughness variation (MengTo metal step 4): smears, two scratch angles and fine grain. Green channel is read. */
let roughCache = null;
let hatchCache = null;
function roughnessTexture(seed = 7, size = 256) {
  if (roughCache) return roughCache;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 14; i += 1) {
    const x = rnd() * size, y = rnd() * size, r = 20 + rnd() * 50;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(220,220,220,0.35)');
    grad.addColorStop(1, 'rgba(220,220,220,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.lineWidth = 0.6;
  for (let i = 0; i < 160; i += 1) {
    const a = (i % 2 ? 0.35 : 1.2) + (rnd() - 0.5) * 0.15;
    const x = rnd() * size, y = rnd() * size, l = 12 + rnd() * 50;
    g.strokeStyle = `rgba(255,255,255,${0.15 + rnd() * 0.3})`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 22;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  roughCache = t;
  return t;
}

/** Diagonal hatch for cut faces, tinted per material. */
function hatchTexture(base, line) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = `#${base.getHexString()}`;
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = `#${line.getHexString()}`;
  g.lineWidth = 3;
  for (let k = -64; k <= 64; k += 16) {
    g.beginPath(); g.moveTo(k, 64); g.lineTo(k + 64, 0); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const F0 = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

/**
 * All scene materials. `cut` = { single: Plane[], box: Plane[] } clipping planes for the half-section
 * (single: one plane through the focus bolt axis; box: three planes removing a window around it).
 */
export function createMaterials(cut) {
  const rough = roughnessTexture();
  const steelF0 = F0(0.56, 0.57, 0.58);
  hatchCache ??= {
    top: hatchTexture(tokenColor('--color-alu', '#bbb').multiplyScalar(0.8), tokenColor('--color-surface', '#222')),
    base: hatchTexture(tokenColor('--color-steel', '#99a').multiplyScalar(0.6), tokenColor('--color-surface', '#222')),
  };
  const hatch = hatchCache.top;
  const hatchDark = hatchCache.base;
  const single = cut?.single ?? [];
  const box = cut?.box ?? [];

  const zinc = new THREE.MeshStandardMaterial({ color: F0(0.66, 0.69, 0.72), metalness: 1, roughness: 0.38, roughnessMap: rough, clippingPlanes: single });
  const zincFree = zinc.clone();
  zincFree.clippingPlanes = null;
  const washer = new THREE.MeshPhysicalMaterial({ color: steelF0, metalness: 1, roughness: 0.3, roughnessMap: rough, anisotropy: 0.8, clippingPlanes: single });
  const washerFree = washer.clone();
  washerFree.clippingPlanes = null;
  const socket = new THREE.MeshStandardMaterial({ color: F0(0.62, 0.64, 0.67), metalness: 1, roughness: 0.3, roughnessMap: rough, side: THREE.DoubleSide, clippingPlanes: single, emissive: new THREE.Color(0, 0, 0) });
  const plateTop = new THREE.MeshStandardMaterial({ color: steelF0, metalness: 1, roughness: 0.34, roughnessMap: rough, side: THREE.DoubleSide, clippingPlanes: box, clipIntersection: true });
  const plateBase = new THREE.MeshStandardMaterial({ color: F0(0.42, 0.44, 0.47), metalness: 0.9, roughness: 0.55, roughnessMap: rough, side: THREE.DoubleSide, clippingPlanes: box, clipIntersection: true });
  const hub = new THREE.MeshStandardMaterial({ color: F0(0.34, 0.35, 0.38), metalness: 0.9, roughness: 0.6, roughnessMap: rough });
  const capTop = new THREE.MeshStandardMaterial({ map: hatch, metalness: 0, roughness: 0.9 });
  const capBase = new THREE.MeshStandardMaterial({ map: hatchDark, metalness: 0, roughness: 0.9 });
  const capBolt = new THREE.MeshStandardMaterial({ color: tokenColor('--color-steel', '#aab').multiplyScalar(0.55), metalness: 0, roughness: 0.8 });
  const edge = new THREE.MeshBasicMaterial({ color: tokenColor('--color-motion', '#3df5d2'), toneMapped: false, transparent: true, opacity: 0.9, clippingPlanes: single });

  const gapMat = new THREE.MeshBasicMaterial({ color: tokenColor('--color-motion', '#3df5d2'), transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, clippingPlanes: single });
  const mark = new THREE.MeshBasicMaterial({ color: tokenColor('--color-text', '#eee'), toneMapped: false, clippingPlanes: single });
  const status = {
    typical: tokenColor('--color-steel', '#99a'),
    investigate: tokenColor('--color-amber', '#e0a030'),
    cant_assess: tokenColor('--color-hatch', '#888'),
    outside: tokenColor('--color-outside', '#e05050'),
  };
  const ring = Object.fromEntries(Object.entries(status).map(([k, col]) => [k, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.4 })]));
  const ringCut = Object.fromEntries(Object.entries(ring).map(([k, m]) => { const c = m.clone(); c.clippingPlanes = single; return [k, c]; }));
  const motion = tokenColor('--color-motion', '#3df5d2');

  const all = [zinc, zincFree, washer, washerFree, socket, plateTop, plateBase, hub, capTop, capBase, capBolt, edge, gapMat, mark, ...Object.values(ring), ...Object.values(ringCut)];
  return { zinc, zincFree, washer, washerFree, socket, plateTop, plateBase, hub, capTop, capBase, capBolt, edge, gapMat, mark, ring, ringCut, motion, dispose: () => all.forEach((m) => m.dispose()) };
}
