import React, { Suspense, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, OrthographicCamera } from '@react-three/drei';
import { AdditiveBlending, Color, Object3D, Quaternion, Vector3 } from 'three';
import { RotateCcw, ScanLine, Move3d, Activity } from 'lucide-react';

/* A procedural 3D manufacturing environment. All meshes, materials, machines and
   layout are authored locally; no models, textures or telemetry are downloaded. */
const MAIN_IDS = ['stamp','weld','paint','trim','marriage','final','eol','audit','dispatch'];
// U-shaped loop, 80 x 80 m. Flow runs west to east along the north edge, north to south along the
// east edge and east to west along the south edge. The west side is the material and shipping yard.
const R = 27, P = 12, PI = Math.PI;
const LAYOUT = {
  stamp:{x:-P,z:-R,rot:PI}, weld:{x:0,z:-R,rot:PI}, paint:{x:P,z:-R,rot:PI},
  trim:{x:R,z:-P,rot:PI/2}, marriage:{x:R,z:0,rot:PI/2}, final:{x:R,z:P,rot:PI/2},
  eol:{x:P,z:R,rot:0}, audit:{x:0,z:R,rot:0}, dispatch:{x:-P,z:R,rot:0},
  powertrain:{x:7,z:0,rot:PI/2},
};
// Each station's open front (fences, buffer row, operators) faces away from the courtyard.
const inward = (L,k=1)=>[Math.sin(L.rot)*k,Math.cos(L.rot)*k];
const PATH = [[-R,-R],[R,-R],[R,R],[-R,R]];
const SEG = 2*R;
const STATUS_COLOR = { running:'#739da8', degraded:'#d9a35f', down:'#d9776a', blocked:'#b9a96c', starved:'#6f8fa8', setup:'#a79ad0', off:'#4f5f65' };
const palette = {
  floor: '#26333b', concrete: '#1b292f', frame: '#70848b', steel: '#536b76',
  steelLight: '#a0b5b8', steelDark: '#374b55', glass: '#90c5c4', conveyor: '#222b2e',
  orange: '#ee9e56', aqua: '#6ac9c0', electric: '#91e2d1', road: '#303a3f',
};
// Motion highlight: one sea-glass accent on every part that moves, so motion reads at a glance.
// Orange stays reserved for the bottleneck. The pulse holds steady under prefers-reduced-motion.
const MOTION = { color: '#3df5d2', tint: .45, low: .45, high: 1.25, spark: '#e9fffa' };
const MOTION_COLOR = new Color(MOTION.color);
const MotionCtx = createContext({ on: true, calm: false });
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
function useReducedMotion() {
  const [calm, setCalm] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(REDUCED_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(REDUCED_QUERY); if (!mq) return;
    const on = () => setCalm(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return calm;
}
const pulse = (t, phase, calm) => calm ? (MOTION.low + MOTION.high) / 2 : MOTION.low + (MOTION.high - MOTION.low) * (Math.sin(t * 3.2 + phase) * .5 + .5);

// Wraps a moving assembly. While live, its meshes take the accent as emissive and pulse; when the
// station stops (down, blocked, starved, paused) or highlighting is off, the original look returns.
function MotionPart({ running, phase = 0, children, ...props }) {
  const g = useRef();
  const mats = useRef([]);
  const { on, calm } = useContext(MotionCtx);
  const live = on && running;
  useEffect(() => {
    const found = new Set();
    g.current?.traverse(o => {
      const m = o.isMesh && o.material;
      if (!m?.emissive) return;
      found.add(m);
      if (!m.userData.base) m.userData.base = { c: m.color.clone(), e: m.emissive.clone(), i: m.emissiveIntensity };
      const b = m.userData.base;
      if (live) { m.color.copy(b.c).lerp(MOTION_COLOR, MOTION.tint); m.emissive.copy(MOTION_COLOR); }
      else { m.color.copy(b.c); m.emissive.copy(b.e); m.emissiveIntensity = b.i; }
    });
    mats.current = [...found];
  }, [live]);
  useFrame(({ clock }) => {
    if (!live) return;
    const k = pulse(clock.getElapsedTime(), phase, calm);
    for (const m of mats.current) m.emissiveIntensity = k;
  });
  return <group ref={g} {...props}>{children}</group>;
}
// Flickering weld arc at a tool tip.
function Spark({ position, running, phase = 0 }) {
  const m = useRef();
  const { on, calm } = useContext(MotionCtx);
  useFrame(({ clock }) => {
    if (!m.current) return;
    const t = clock.getElapsedTime() * 9 + phase;
    const s = calm ? .8 : (Math.sin(t) * Math.sin(t * 2.7) > .1 ? .6 + Math.random() * .6 : .15);
    m.current.scale.setScalar(s);
  });
  if (!(on && running)) return null;
  return <mesh ref={m} position={position}><sphereGeometry args={[.17, 10, 8]} />
    <meshBasicMaterial color={MOTION.spark} transparent opacity={.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>;
}

function Cuboid({ position = [0, 0, 0], size = [1, 1, 1], color = palette.steel, roughness = .64, metalness = .48, emissive, emissiveIntensity = .3, transparent = false, opacity = 1, ...rest }) {
  return <mesh castShadow receiveShadow position={position} {...rest}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} transparent={transparent} opacity={opacity}
      emissive={emissive || '#000000'} emissiveIntensity={emissive ? emissiveIntensity : 0} depthWrite={!transparent} />
  </mesh>;
}
function Cylinder({ position = [0,0,0], args = [.5,.5,1,12], color = palette.steel, rotation, ...props }) {
  return <mesh castShadow receiveShadow position={position} rotation={rotation} {...props}>
    <cylinderGeometry args={args} />
    <meshStandardMaterial color={color} metalness={.45} roughness={.56} />
  </mesh>;
}
function Rod({ from, to, radius=.085, color=palette.steelLight, segments=8 }) {
  const start=useMemo(()=>new Vector3(...from),[...from]);
  const end=useMemo(()=>new Vector3(...to),[...to]);
  const [mid, quaternion, length]=useMemo(()=> {
    const delta=end.clone().sub(start);
    return [start.clone().add(end).multiplyScalar(.5),new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.clone().normalize()),delta.length()];
  },[start,end]);
  return <mesh position={mid} quaternion={quaternion} castShadow><cylinderGeometry args={[radius,radius,length,segments]}/><meshStandardMaterial color={color} metalness={.62} roughness={.36}/></mesh>;
}

// Vertical light curtain under the inspection gantry; travels with the scanner.
function ScanBeam({ running }) {
  const m = useRef();
  const { on, calm } = useContext(MotionCtx);
  useFrame(({ clock }) => { if (m.current) m.current.opacity = .08 + .14 * (pulse(clock.getElapsedTime(), 0, calm) - MOTION.low) / (MOTION.high - MOTION.low); });
  if (!(on && running)) return null;
  return <mesh position={[0, 2.75, 0]} rotation={[0, PI / 2, 0]}><planeGeometry args={[4.3, 3.5]} />
    <meshBasicMaterial ref={m} color={MOTION.color} transparent opacity={.15} blending={AdditiveBlending} depthWrite={false} side={2} toneMapped={false} /></mesh>;
}
// Chevrons riding the main conveyor at the same speed as the bodies, pointing downstream.
const CHEVRONS = 54;
function FlowChevrons({ running, flow }) {
  const inst = useRef();
  const offset = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);
  const placed = useRef(false);
  const { on, calm } = useContext(MotionCtx);
  const live = on && running;
  useEffect(() => { placed.current = false; }, [live]);
  useFrame((_, delta) => {
    const g = inst.current; if (!g) return;
    // Under reduced motion the arrows hold still and only show direction.
    if (calm && placed.current) return;
    if (!calm) offset.current = (offset.current + Math.min(delta, .08) * flow.current * .0027) % 1;
    for (let i = 0; i < CHEVRONS; i++) {
      const d = ((i / CHEVRONS + offset.current) % 1) * 3 * SEG, k = Math.min(2, Math.floor(d / SEG)), f = d - k * SEG;
      const [ax, az] = PATH[k], [bx, bz] = PATH[k + 1];
      dummy.position.set(ax + (bx - ax) * f / SEG, 1.02, az + (bz - az) * f / SEG);
      dummy.rotation.set(0, [0, -PI / 2, PI][k], -PI / 2);
      dummy.scale.set(.22, 1, 1);
      dummy.updateMatrix();
      g.setMatrixAt(i, dummy.matrix);
    }
    g.instanceMatrix.needsUpdate = true;
    placed.current = true;
  });
  if (!live) return null;
  return <instancedMesh ref={inst} args={[null, null, CHEVRONS]} frustumCulled={false}>
    <coneGeometry args={[.7, 1.4, 3]} />
    <meshBasicMaterial color={MOTION.color} transparent opacity={.8} depthWrite={false} toneMapped={false} />
  </instancedMesh>;
}

function Indicator({position,color='#67c9b9'}) {
  return <group position={position}><Cylinder args={[.16,.16,.13,12]} color="#17282f"/>
    <mesh position={[0,.10,0]}><sphereGeometry args={[.145,10,8]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4}/></mesh>
  </group>;
}
function Floor() {
  const grid = useMemo(()=>Array.from({length:21},(_,i)=>-40+i*4),[]);
  return <group>
    <Cuboid position={[0,-.55,0]} size={[80,1.1,80]} color="#26343a" metalness={.12} roughness={.91}/>
    {/* production corridor around the U */}
    <Cuboid position={[0,.02,-R]} size={[2*R+18,.04,19]} color="#2f3d43" metalness={.08}/>
    <Cuboid position={[R,.02,0]} size={[19,.04,2*R+18]} color="#2f3d43" metalness={.08}/>
    <Cuboid position={[0,.02,R]} size={[2*R+18,.04,19]} color="#2f3d43" metalness={.08}/>
    {/* west yard */}
    <Cuboid position={[-32,.025,0]} size={[16,.05,72]} color="#222c31" metalness={.04}/>
    {[-24,-12,12,24].map(z=><Cuboid key={z} position={[-32,.06,z]} size={[10,.03,.12]} color="#c9b57c" metalness={0}/>)}
    {grid.map(v=><group key={v}>
      <Cuboid position={[v,.035,0]} size={[.022,.03,80]} color="#4b5d64" metalness={0}/>
      <Cuboid position={[0,.035,v]} size={[80,.03,.022]} color="#4b5d64" metalness={0}/>
    </group>)}
    {/* safety edge lines on the inside of the corridor */}
    {[[0,-R+9.5,2*R+18,.1],[R-9.5,0,.1,2*R+18],[0,R-9.5,2*R+18,.1]].map(([x,z,w,d],i)=><Cuboid key={i} position={[x,.07,z]} size={[w,.04,d]} color="#d8a44e" metalness={0}/>)}
    {[[0,-40,80,.4],[0,40,80,.4],[-40,0,.4,80],[40,0,.4,80]].map(([x,z,w,d],i)=><Cuboid key={i} position={[x,.2,z]} size={[w,.34,d]} color="#4f636b"/>)}
  </group>;
}
function HallStructure() {
  const edge = useMemo(()=>Array.from({length:7},(_,i)=>-36+i*12),[]);
  const cols = useMemo(()=>[...edge.map(v=>[v,-38]),...edge.map(v=>[v,38]),...edge.slice(1,-1).map(v=>[-38,v]),...edge.slice(1,-1).map(v=>[38,v])],[edge]);
  return <group>
    {cols.map(([x,z],i)=><group key={i}>
      <Cuboid position={[x,4.45,z]} size={[.34,8.9,.34]} color="#6a8087"/>
      <Cuboid position={[x,8.8,z]} size={[.8,.24,.8]} color="#8ca3a8"/>
      {i%5===0&&<Indicator position={[x,6.2,z]} color="#6aabb6"/>}
    </group>)}
    {[[0,-38,78,.3],[0,38,78,.3]].map(([x,z,w,d],i)=><Cuboid key={i} position={[x,8.8,z]} size={[w,.26,d]} color="#8ba1a7"/>)}
    {[[-38,0,.3,78],[38,0,.3,78]].map(([x,z,w,d],i)=><Cuboid key={i} position={[x,8.8,z]} size={[w,.26,d]} color="#8ba1a7"/>)}
    <Cuboid position={[0,4.6,-38.2]} size={[78,6.4,.2]} color="#384b50" transparent opacity={.4}/>
    <Cuboid position={[-38.2,4.6,0]} size={[.2,6.4,78]} color="#384b50" transparent opacity={.4}/>
    {[-R,0,R].map(v=><Cuboid key={v} position={[v,8.5,0]} size={[.22,.22,76]} color="#7e9399"/>)}
  </group>;
}
function BeltSeg({cx,cz,len,rot=0}){
  const n=Math.max(2,Math.floor(len/.89));
  return <group position={[cx,0,cz]} rotation={[0,rot,0]}>
    <Cuboid position={[0,.50,.10]} size={[len,.42,2.8]} color="#3e565e"/>
    <Cuboid position={[0,.76,.10]} size={[len-.5,.12,2.25]} color="#182831" metalness={.43}/>
    {[-1.25,1.45].map(z=><group key={z}>
      <Cuboid position={[0,.98,z]} size={[len,.30,.16]} color="#8eabae"/>
      <Cuboid position={[0,.69,z]} size={[len,.12,.12]} color="#aec2c2"/>
    </group>)}
    {Array.from({length:n},(_,i)=>-len/2+.5+i*((len-1)/(n-1))).map((x,i)=>
      <Cylinder key={i} position={[x,.84,.10]} args={[.12,.12,2.5,8]} rotation={[PI/2,0,0]} color={i%2?'#6c848b':'#9db0b1'}/>)}
    {Array.from({length:Math.floor(len/3)},(_,i)=>-len/2+1.5+i*3).map(x=><Cuboid key={x} position={[x,.20,.12]} size={[.17,.43,2.55]} color="#61767d"/>)}
  </group>;
}
function RailConveyor(){
  return <group>
    <BeltSeg cx={-R-4.5} cz={-R} len={9}/>
    <BeltSeg cx={0} cz={-R} len={2*R}/>
    <BeltSeg cx={R} cz={0} len={2*R} rot={-PI/2}/>
    <BeltSeg cx={0} cz={R} len={2*R} rot={PI}/>
    <BeltSeg cx={-R-4.5} cz={R} len={9} rot={PI}/>
    {[[-R,-R],[R,-R],[R,R]].map(([x,z],i)=><Cuboid key={i} position={[x,.62,z]} size={[3,.5,3]} color="#4b6068"/>)}
    {/* kit belt: powertrain cell to chassis marriage */}
    <BeltSeg cx={(7+5.5+R-5)/2} cz={0} len={R-5-7-5.5} rot={0}/>
  </group>;
}
function Zone({id,w=9.8,d=16.7,x,z=0,selected,bottleneck,status,onClick}){
 const color=bottleneck?'#eb9c54':status==='down'?STATUS_COLOR.down:selected?'#9bddd6':(STATUS_COLOR[status]||'#739da8');
 const hot=bottleneck||status==='down';
 const hw=w/2-.1, hd=d/2-.2;
 return <group position={[x,0,z]} onClick={(e)=>{e.stopPropagation();onClick(id);}}>
   <mesh position={[0,.083,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[w,d]}/>
     <meshBasicMaterial color={color} transparent opacity={hot ? 0.115 : selected ? 0.07 : 0.024} depthWrite={false}/></mesh>
   {[[-hw,-hd],[hw,-hd],[-hw,hd],[hw,hd]].map(([a,b],i)=><group key={i} position={[a,.2,b]}>
      <Cuboid position={[0,.09,0]} size={[.92,.14,.12]} color={color} emissive={hot?color:undefined} emissiveIntensity={.4}/>
      <Cuboid position={[0,.1,0]} size={[.12,.16,.87]} color={color} />
      {(hot||selected)&&<Cuboid position={[0,.5,0]} size={[.075,.8,.075]} color={color} transparent opacity={.6}/>}
   </group>)}
   {[-hw,hw].map(a=><Cuboid key={a} position={[a,.11,0]} size={[.055,.09,d-.95]} color={color} transparent opacity={hot ? 0.9 : 0.40}/>)}
   {[-hd,hd].map(b=><Cuboid key={b} position={[0,.11,b]} size={[w-.4,.09,.055]} color={color} transparent opacity={hot ? 0.9 : 0.40}/>)}
 </group>;
}
// Input buffer drawn as a row of slots on the aisle side. Filled slots show queue length.
function BufferRow({x,z=3.7,cap,fill,color='#6ac9c0'}){
  const n=Math.min(cap,14), w=.55;
  return <group position={[x-(n*w)/2+w/2,.28,z]}>
    {Array.from({length:n},(_,i)=><group key={i} position={[i*w,0,0]}>
      <Cuboid position={[0,0,0]} size={[.46,.1,.9]} color="#2d4046" metalness={.2}/>
      {i<Math.min(fill,n)&&<Cuboid position={[0,.2,0]} size={[.4,.3,.74]} color={color} emissive={color} emissiveIntensity={.25}/>}
    </group>)}
  </group>;
}
function CarBody({ paint='#82b9c1', ghost=false }) {
 return <group>
  <Cuboid position={[0,0,0]} size={[2.72,.46,1.36]} color={ghost?'#69838b':paint} roughness={.22} metalness={.67} transparent={ghost} opacity={ghost ? 0.6 : 1}/>
  <Cuboid position={[-.05,.40,0]} size={[1.42,.55,1.22]} color={ghost?'#7897a2':'#42616c'} transparent={ghost} opacity={ghost ? 0.55 : 1}/>
  <Cuboid position={[-.05,.57,-.616]} size={[1.22,.26,.04]} color="#aad1d6" transparent opacity={.54}/>
  <Cuboid position={[-.05,.57,.616]} size={[1.22,.26,.04]} color="#aad1d6" transparent opacity={.54}/>
  <Cuboid position={[-1.2,.04,0]} size={[.16,.21,1.26]} color="#ccd2c5"/>
  <Cuboid position={[1.2,.04,0]} size={[.16,.21,1.26]} color="#ccd2c5"/>
  {[-.89,.89].map(x=>[-.75,.75].map(z=><group key={`${x}-${z}`}>
    <Cylinder position={[x,-.20,z]} args={[.31,.31,.18,14]} rotation={[Math.PI/2,0,0]} color="#131f22"/>
    <Cylinder position={[x,-.20,z+Math.sign(z)*.12]} args={[.12,.12,.03,10]} rotation={[Math.PI/2,0,0]} color="#a4b1ae"/>
  </group>))}
  <Cuboid position={[1.35,.01,0]} size={[.07,.10,.55]} color="#f1d19a" emissive="#f9c879" emissiveIntensity={.4}/>
 </group>;
}
function TravelingCar({index,count,running,flow}) {
 const group=useRef();
 const progress=useRef(index/count);
 const place=(t)=>{
   const d=t*3*SEG, k=Math.min(2,Math.floor(d/SEG)), f=d-k*SEG;
   const [ax,az]=PATH[k],[bx,bz]=PATH[k+1];
   const g=group.current; if(!g)return;
   g.position.set(ax+(bx-ax)*f/SEG,1.26,az+(bz-az)*f/SEG);
   g.rotation.y=[0,-PI/2,PI][k];
 };
 useFrame((_,delta)=>{
    if(running) progress.current=(progress.current+Math.min(delta,.08)*flow.current*.0027)%1;
    place(progress.current);
 });
 useEffect(()=>{place(progress.current);});
 return <group ref={group}>
   <MotionPart running={running} phase={index}>
     <CarBody paint={['#84b8bf','#9fb1b1','#bdc3b8','#77b4b4','#c3bb9f','#7796a2','#b6c4c2'][index%7]} ghost={index===0}/>
   </MotionPart>
 </group>;
}
function SafetyFence({at=[0,0,0],length=6,rotation=0}) {
 return <group position={at} rotation={[0,rotation,0]}>
  {Array.from({length:Math.round(length/1.5)+1},(_,i)=><group key={i} position={[-length/2+i*(length/Math.round(length/1.5)),0,0]}>
    <Cuboid position={[0,1,0]} size={[.10,2,.12]} color="#a6a99d"/>
    <Cuboid position={[0,2.03,0]} size={[.25,.10,.25]} color="#e2b053"/>
  </group>)}
  {[.23,1,1.80].map(y=><Cuboid key={y} position={[0,y,0]} size={[length,.075,.065]} color={y===1?'#d6ab64':'#7f9295'}/>)}
  <Cuboid position={[0,1.05,0]} size={[length-.1,1.6,.018]} color="#adbec0" transparent opacity={.085}/>
 </group>;
}
function DashboardCabinet({position=[0,0,0],screen=true,rotate=0,tall=2.25}) {
 return <group position={position} rotation={[0,rotate,0]}>
  <Cuboid position={[0,tall/2,0]} size={[.92,tall,.66]} color="#6d878b"/>
  <Cuboid position={[0,tall*.75,.345]} size={[.71,.56,.08]} color={screen?'#183944':'#b0bcb3'} emissive={screen?'#286b75':undefined} emissiveIntensity={.4}/>
  {screen&&<><Cuboid position={[0,tall*.80,.391]} size={[.48,.04,.012]} color="#a8e6dc" emissive="#68cbbf" emissiveIntensity={.6}/>
  <Cuboid position={[-.13,tall*.68,.40]} size={[.20,.07,.014]} color="#eac878"/></>}
  <Indicator position={[.25,tall+.13,0]} />
 </group>;
}
function StorageRack({position=[0,0,0],levels=3,width=4.2}) {
 return <group position={position}>
   {[-width/2,width/2].map(x=>[-.6,.6].map(z=><Cuboid key={`${x}-${z}`} position={[x,1.7,z]} size={[.14,3.4,.14]} color="#a4aaa1"/>))}
   {Array.from({length:levels},(_,i)=><group key={i}>
     <Cuboid position={[0,.55+i*1.05,0]} size={[width+.25,.14,1.45]} color="#687d7e"/>
     {[-width*.26,width*.26].map(x=><group key={x} position={[x,.72+i*1.05,0]}>
       <Cuboid position={[0,.22,0]} size={[width*.36,.44,.98]} color={i===1?'#97a5a3':'#a08d74'}/>
       <Cuboid position={[0,.46,0]} size={[width*.36,.035,.98]} color="#c1aa88"/>
     </group>)}
   </group>)}
 </group>;
}
function PalletStack({position=[0,0,0],count=3}) {
 return <group position={position}>
  <Cuboid position={[0,.16,0]} size={[1.8,.22,1.25]} color="#a7926d" />
  {Array.from({length:count},(_,i)=><group key={i}>
    <Cuboid position={[0,.58+i*.52,0]} size={[1.62,.44,1.14]} color={i%2?'#7a99a0':'#b5a592'} />
    <Cuboid position={[0,.61+i*.52,.585]} size={[1.5,.065,.04]} color="#596f77"/>
  </group>)}
 </group>;
}
function RobotArm({position=[0,0,0],color='#d1aa67',phase=0,size=1,mirror=false,running=true,weld=false}) {
 const arm=useRef();
 const wrist=useRef();
 useFrame(({clock})=>{
  if(!running)return;
  const t=clock.getElapsedTime()*.72+phase;
  if(arm.current)arm.current.rotation.y=Math.sin(t)*.37*(mirror?-1:1);
  if(wrist.current)wrist.current.rotation.z=-.22+Math.cos(t*1.28)*.24;
 });
 return <group position={position} scale={size}>
   <Cylinder position={[0,.27,0]} args={[.62,.72,.55,12]} color="#3e565d"/>
   <Cylinder position={[0,.6,0]} args={[.42,.48,.23,12]} color={color}/>
   <group ref={arm} position={[0,.62,0]}><MotionPart running={running} phase={phase}>
     <Rod from={[0,0,0]} to={[mirror?-.55:.55,1.65,-.10]} radius={.22} color={color}/>
     <mesh position={[mirror?-.55:.55,1.65,-.10]}><sphereGeometry args={[.30,12,10]}/><meshStandardMaterial color="#324951" metalness={.65}/></mesh>
     <group ref={wrist} position={[mirror?-.55:.55,1.65,-.10]}>
       <Rod from={[0,0,0]} to={[mirror?-.91:.91,.92,.36]} radius={.16} color={color}/>
       <Cylinder position={[mirror?-.91:.91,.92,.36]} args={[.23,.23,.30,12]} rotation={[0,0,Math.PI/2]} color="#829b9e" />
       <Rod from={[mirror?-.91:.91,.92,.36]} to={[mirror?-1.06:1.06,.65,.50]} radius={.07} color="#bfd0c8"/>
       <Cuboid position={[mirror?-1.06:1.06,.57,.5]} size={[.15,.16,.48]} color="#b9ccc7"/>
       {weld&&<Spark position={[mirror?-1.06:1.06,.42,.74]} running={running} phase={phase}/>}
     </group>
   </MotionPart></group>
 </group>;
}
function StampingMachine({x,running}) {
 const ram=useRef();
 useFrame(({clock})=>{if(ram.current&&running)ram.current.position.y=2.55+Math.sin(clock.getElapsedTime()*2.4)*.42;});
 return <group position={[x,0,-.05]}>
  <Cuboid position={[0,.35,0]} size={[6.45,.7,5.8]} color="#4c6871"/>
  {[-2.7,2.7].map(a=>[-2.18,2.18].map(b=><Cuboid key={`${a}/${b}`} position={[a,3.42,b]} size={[.49,5.6,.49]} color="#7f9da5"/>))}
  <Cuboid position={[0,6.23,0]} size={[6.5,1.13,5.9]} color="#6f8991"/>
  <Cuboid position={[0,6.82,0]} size={[6.9,.26,6.1]} color="#9db2b3" />
  <Cuboid position={[0,5.62,0]} size={[2.6,.60,4.05]} color="#364b55"/>
  <group ref={ram} position={[0,2.55,0]}><MotionPart running={running}>
    <Cuboid position={[0,0,0]} size={[3.85,.56,3.25]} color="#b4c0b7" />
    <Cuboid position={[0,-.46,0]} size={[3.4,.29,2.8]} color="#9a8e70" />
  </MotionPart></group>
  <Cuboid position={[0,1.18,0]} size={[3.7,.49,3.1]} color="#526d72" />
  <DashboardCabinet position={[3.62,0,-2.2]} />
  <PalletStack position={[-3.66,0,-4.5]} count={3} />
  <PalletStack position={[-.9,0,-5.7]} count={2}/>
  <Cuboid position={[-3.3,3.8,0]} size={[.22,4.1,.25]} color="#c0ac7a" />
  <Indicator position={[2.75,5.2,2.19]} color="#8ce2c9" />
  <SafetyFence at={[0,0,-4.3]} length={7.8} />
 </group>;
}
function WeldingMachine({x,running}) {
 return <group position={[x,0,0]}>
  <Cuboid position={[0,.32,0]} size={[7.5,.64,6.1]} color="#485e65" />
  <Cuboid position={[0,.65,0]} size={[5.9,.14,4.5]} color="#263f46"/>
  <RobotArm position={[-2.9,.68,-2.55]} color="#d6a362" size={1.13} running={running} phase={0} weld/>
  <RobotArm position={[2.8,.68,-2.48]} color="#cfa25c" mirror size={1.11} running={running} phase={1.8} weld/>
  <RobotArm position={[-3,.68,2.65]} color="#7cb6b1" size={.86} running={running} phase={3.2} weld/>
  <RobotArm position={[3.05,.68,2.4]} color="#7cb6b1" mirror size={.90} running={running} phase={4.5} weld/>
  <Cuboid position={[0,5.0,-2.9]} size={[7.7,.32,.32]} color="#8da4a4"/>
  {[-3.4,3.4].map(a=><Cuboid key={a} position={[a,2.9,-2.9]} size={[.19,4.45,.19]} color="#8ca9a8" />)}
  <Indicator position={[3.4,5.25,-2.9]} color="#fac47c" />
  <SafetyFence at={[0,0,4.5]} length={8.5}/>
  <DashboardCabinet position={[4.0,0,-5.3]} rotate={Math.PI/7}/>
  <PalletStack position={[-3.5,0,-5.8]} count={2}/>
 </group>;
}
function PaintingMachine({x,running}) {
 return <group position={[x,0,0]}>
  <Cuboid position={[0,.3,0]} size={[8.3,.6,6.6]} color="#53666a" />
  {[-3.9,3.9].map(a=>[-3.05,3.05].map(b=><Cuboid key={`${a}/${b}`} position={[a,3.12,b]} size={[.22,5.55,.24]} color="#97b8b6"/>))}
  <Cuboid position={[0,6,0]} size={[8.6,.49,6.75]} color="#718b8b" />
  {[-3.1,3.1].map(z=><Cuboid key={z} position={[0,3.2,z]} size={[7.8,5.1,.08]} color="#90c6c4" transparent opacity={.15}/>) }
  {[-3.9,3.9].map(a=><Cuboid key={a} position={[a,3.2,0]} size={[.09,5.1,6.0]} color="#8abbba" transparent opacity={.10}/>) }
  <Cuboid position={[0,4.6,-3.15]} size={[6.7,.07,.07]} color="#c2e2d8" emissive="#73bdac" emissiveIntensity={.3}/>
  <RobotArm position={[-2,.74,-2.1]} color="#81bfc0" size={.82} running={running} phase={.6}/>
  <RobotArm position={[2,.74,2.1]} color="#b8c6ad" mirror size={.78} running={running} phase={3}/>
  {[-2.2,2.2].map(a=><group key={a}>
   <Cylinder position={[a,7.25,0]} args={[.70,.70,2.2,16]} color="#6e888b"/>
   <Cylinder position={[a,8.47,0]} args={[.88,.72,.22,16]} color="#abc4be"/>
   <Cuboid position={[a,6.0,-.5]} size={[.15,.6,1]} color="#819c99"/>
  </group>)}
  <DashboardCabinet position={[4.6,0,-5.4]} />
  <SafetyFence at={[0,0,4.7]} length={7.8}/>
  <Indicator position={[3.85,5.7,2.95]}/>
 </group>;
}
function AssemblyMachine({x,running}) {
 const hoist=useRef();
 useFrame(({clock})=>{if(hoist.current && running) hoist.current.position.x=Math.sin(clock.getElapsedTime()*.5)*1.25;});
 return <group position={[x,0,0]}>
  {[-3.3,3.3].map(a=>[-3.5,3.5].map(b=><Cuboid key={`${a}/${b}`} position={[a,3.85,b]} size={[.31,7.1,.34]} color="#8b9da0"/>))}
  {[-3.5,3.5].map(z=><Cuboid key={z} position={[0,7.25,z]} size={[7.7,.42,.39]} color="#b2b7a7"/>)}
  <Cuboid position={[0,7.45,0]} size={[7.3,.3,7.2]} color="#a8b6ae" />
  <group ref={hoist}><MotionPart running={running}>
    <Cuboid position={[0,6.94,0]} size={[1.4,.6,1.0]} color="#d6b36c" />
    <Rod from={[-.36,6.6,0]} to={[-.36,4.45,0]} radius={.055} color="#d2d2bd"/>
    <Rod from={[.36,6.6,0]} to={[.36,4.45,0]} radius={.055} color="#d2d2bd"/>
    <Cuboid position={[0,4.32,0]} size={[2.45,.42,1.28]} color="#566b72" />
  </MotionPart></group>
  <RobotArm position={[-3.25,.7,-2.50]} color="#ddaa61" size={.95} running={running} phase={1.4}/>
  <RobotArm position={[3.2,.7,2.85]} color="#9bc1b7" mirror size={.90} running={running} phase={2.4}/>
  <DashboardCabinet position={[4.4,0,-4.9]} />
  <PalletStack position={[-4.0,0,-5.9]} count={2}/>
  <Indicator position={[3.2,7.6,3.5]} />
  <SafetyFence at={[0,0,-4.55]} length={7.8}/>
 </group>;
}
function QualityMachine({x,running}) {
 const scanner=useRef();
 useFrame(({clock})=>{if(scanner.current && running)scanner.current.position.x=Math.sin(clock.getElapsedTime()*1.35)*1.35;});
 return <group position={[x,0,0]}>
  {[-3.12,3.12].map(a=>[-2.38,2.38].map(b=><Cuboid key={`${a}/${b}`} position={[a,3.0,b]} size={[.28,5.3,.3]} color="#8eaaaa"/>))}
  <Cuboid position={[0,5.65,0]} size={[7,.58,5.1]} color="#8ca3a2" />
  <Cuboid position={[0,5.1,0]} size={[4,.14,4.6]} color="#425a60"/>
  <group ref={scanner} position={[0,0,0]}><MotionPart running={running}>
    <Cuboid position={[0,4.86,0]} size={[.3,.35,4.3]} color="#c7c2a4"/>
    {[-1.9,0,1.9].map(z=><Cuboid key={z} position={[0,4.52,z]} size={[.28,.26,.65]} color="#82d4cd" emissive="#6fd1c6" emissiveIntensity={.6}/>)}
  </MotionPart><ScanBeam running={running}/></group>
  {[-2.4,2.4].map(z=><group key={z}>
    <Cuboid position={[-3,2.5,z]} size={[.17,3.7,.17]} color="#8a9c9e"/>
    <Cuboid position={[-2.9,3.1,z]} size={[.09,1.05,.21]} color="#8fdfd0" emissive="#59c9bd" emissiveIntensity={.95}/>
  </group>)}
  <DashboardCabinet position={[4.7,0,-4.8]} tall={2.7} />
  <DashboardCabinet position={[4.7,0,-3.0]} tall={2.7} />
  <SafetyFence at={[0,0,4.55]} length={8.6}/>
  <Indicator position={[3.15,5.7,2.4]} />
  <Cuboid position={[-3,1.05,-4.5]} size={[1.5,2.1,.8]} color="#7d9ca0" />
 </group>;
}
function Operator({position=[0,0,0],phase=0,running=true,color='#d1aa67'}) {
 const g=useRef();
 useFrame(({clock})=>{if(g.current&&running)g.current.position.y=Math.abs(Math.sin(clock.getElapsedTime()*1.6+phase))*.05;});
 return <group position={position}><group ref={g}><MotionPart running={running} phase={phase}>
  <Cylinder position={[0,.55,0]} args={[.2,.24,1.1,10]} color="#47626b"/>
  <Cylinder position={[0,1.35,0]} args={[.26,.22,.55,10]} color={color}/>
  <mesh position={[0,1.85,0]}><sphereGeometry args={[.19,10,8]}/><meshStandardMaterial color="#d8d3c3" roughness={.6}/></mesh>
  <Cuboid position={[0,2.0,0]} size={[.44,.1,.44]} color="#e3b455"/>
 </MotionPart></group></group>;
}
function TrimMachine({x,running}) {
 return <group position={[x,0,0]}>
  <Cuboid position={[0,.2,0]} size={[8.8,.4,6.4]} color="#4a6068"/>
  <Cuboid position={[0,.42,-.1]} size={[8.4,.08,3.5]} color="#c8b27a"/>
  {[-4.1,4.1].map(a=>[-2.9,2.9].map(b=><Cuboid key={`${a}/${b}`} position={[a,3.2,b]} size={[.24,6.4,.26]} color="#8da4a6"/>))}
  <Cuboid position={[0,6.4,-2.9]} size={[8.6,.3,.3]} color="#8da4a6"/>
  <Cuboid position={[0,6.4,2.9]} size={[8.6,.3,.3]} color="#8da4a6"/>
  {[-2.7,0,2.7].map(a=><group key={a}>
    <Rod from={[a,6.3,2.9]} to={[a,3.7,2.1]} radius={.045} color="#d2d2bd"/>
    <Cuboid position={[a,3.55,2.0]} size={[.8,.28,.5]} color="#d6b36c"/>
  </group>)}
  {[[-3,-2.0],[-1,-2.0],[1.4,-2.0],[3,-2.0],[-2,2.2],[2,2.2]].map(([a,b],i)=><Operator key={i} position={[a,0,b]} phase={i*1.1} running={running} color={i%2?'#7cb6b1':'#d1aa67'}/>)}
  {[-3.2,0,3.2].map(a=><group key={a} position={[a,0,-4.2]}>
    <Cuboid position={[0,.9,0]} size={[1.9,1.8,.9]} color="#6f8280"/>
    {[.3,.9,1.5].map(y=><Cuboid key={y} position={[0,y,.47]} size={[1.7,.12,.04]} color="#b39a6c"/>)}
  </group>)}
  <DashboardCabinet position={[4.3,0,-4.4]} rotate={Math.PI/9}/>
  <Indicator position={[-4.1,6.7,2.9]}/>
  <SafetyFence at={[0,0,4.6]} length={8.4}/>
 </group>;
}
function MarriageMachine({x,running}) {
 const lift=useRef();
 useFrame(({clock})=>{if(lift.current&&running)lift.current.position.y=.9+(Math.sin(clock.getElapsedTime()*.9)*.5+.5)*1.1;});
 return <group position={[x,0,0]}>
  <Cuboid position={[0,.25,0]} size={[7.6,.5,6]} color="#485e65"/>
  <Cuboid position={[0,.25,-4.1]} size={[3.2,.5,5.4]} color="#3f565d"/>
  {[-3.2,3.2].map(a=>[-2.6,2.6].map(b=><Cuboid key={`${a}/${b}`} position={[a,2.8,b]} size={[.3,5.1,.3]} color="#8b9da0"/>))}
  <Cuboid position={[0,5.4,-2.6]} size={[6.7,.32,.32]} color="#b2b7a7"/>
  <Cuboid position={[0,5.4,2.6]} size={[6.7,.32,.32]} color="#b2b7a7"/>
  <group ref={lift} position={[0,.9,0]}><MotionPart running={running}>
    <Cuboid position={[0,0,0]} size={[3.4,.22,1.9]} color="#566b72"/>
    <Cuboid position={[0,.3,0]} size={[1.9,.55,1.3]} color="#9a8e70"/>
    {[-1.3,1.3].map(a=><Cylinder key={a} position={[a,-.3,0]} args={[.14,.14,.8,8]} color="#bfd0c8"/>)}
  </MotionPart></group>
  <group position={[0,.55,-4.1]}>
    <Cuboid position={[0,.35,0]} size={[1.8,.7,1.4]} color="#c1ab7c"/>
    <Cuboid position={[0,.78,0]} size={[1.5,.16,1.1]} color="#8a7a58"/>
  </group>
  <RobotArm position={[-3,.5,-2.4]} color="#9bc1b7" size={.82} running={running} phase={1.1}/>
  <RobotArm position={[3,.5,2.5]} color="#ddaa61" mirror size={.82} running={running} phase={2.6}/>
  <Cuboid position={[0,.7,.1]} size={[3.1,.25,1.5]} color="#6d8a90"/>
  <DashboardCabinet position={[-4.1,0,-4.8]} rotate={-Math.PI/10}/>
  <Indicator position={[3.2,5.7,2.6]}/>
  <SafetyFence at={[0,0,4.6]} length={8}/>
 </group>;
}
function EolMachine({x,running}) {
 const wheels=useRef([]);
 useFrame((_,d)=>{if(running)wheels.current.forEach(w=>{if(w)w.rotation.z+=d*7;});});
 return <group position={[x,0,0]}>
  <Cuboid position={[0,.12,0]} size={[8.4,.24,6.2]} color="#46595f"/>
  <Cuboid position={[0,.26,0]} size={[5.6,.05,3.3]} color="#202c31"/>
  {[-1.35,1.35].map((a,i)=>[-.75,.75].map((b,j)=><group key={`${a}/${b}`}>
    <Cylinder position={[a,.34,b]} args={[.42,.42,.9,16]} rotation={[Math.PI/2,0,0]} color="#8fa4a4"/>
    <MotionPart running={running} phase={i+j}><mesh ref={el=>{wheels.current[i*2+j]=el;}} position={[a,.34,b]} rotation={[Math.PI/2,0,0]}><boxGeometry args={[.16,.04,.96]}/><meshStandardMaterial color="#e1c27a"/></mesh></MotionPart>
  </group>))}
  {[-3.7,3.7].map(a=>[-2.7,2.7].map(b=><Cuboid key={`${a}/${b}`} position={[a,2.4,b]} size={[.26,4.6,.28]} color="#8eaaaa"/>))}
  <Cuboid position={[0,4.8,0]} size={[8,.5,6]} color="#8ca3a2"/>
  <Cuboid position={[-3.85,2.4,0]} size={[.1,4.2,5.2]} color="#90c6c4" transparent opacity={.14}/>
  <Cuboid position={[3.85,2.4,0]} size={[.1,4.2,5.2]} color="#90c6c4" transparent opacity={.14}/>
  <Cylinder position={[0,3.4,-2.4]} args={[.28,.28,2.4,10]} rotation={[0,0,Math.PI/2]} color="#a79e88"/>
  <Rod from={[2.2,3.4,-2.4]} to={[3.6,5.3,-2.4]} radius={.22} color="#b4b4a4"/>
  <DashboardCabinet position={[4.6,0,-3.4]} tall={2.6}/>
  <DashboardCabinet position={[4.6,0,-1.9]} tall={2.6}/>
  <Indicator position={[3.7,5.2,2.7]}/>
  <SafetyFence at={[0,0,4.5]} length={8.2}/>
 </group>;
}
function DispatchMachine({x,running}) {
 const truck=useRef();
 useFrame(({clock})=>{if(truck.current&&running)truck.current.position.x=Math.sin(clock.getElapsedTime()*.08)*.5;});
 return <group position={[x,0,0]}>
  <Cuboid position={[0,.16,0]} size={[9,.32,6.4]} color="#4a6068"/>
  <Cuboid position={[0,.25,5.3]} size={[9,.5,3]} color="#3a4a4f"/>
  <group ref={truck} position={[0,0,6.4]}><MotionPart running={running}>
    <Cuboid position={[0,2.2,0]} size={[8.2,3.2,2.4]} color="#b7c0b8" metalness={.3}/>
    <Cuboid position={[0,.7,0]} size={[8.4,.4,2.5]} color="#4b5d62"/>
    <Cuboid position={[4.8,1.6,0]} size={[1.7,2.2,2.3]} color="#7a97a0"/>
    <Cuboid position={[5.6,2.0,0]} size={[.12,1,2]} color="#a7d1d6" transparent opacity={.55}/>
    {[-3,-1.5,3.5,5].map(a=>[-1.1,1.1].map(b=><Cylinder key={`${a}/${b}`} position={[a,.4,b]} args={[.42,.42,.3,14]} rotation={[Math.PI/2,0,0]} color="#161f22"/>))}
  </MotionPart></group>
  {[-3.6,3.6].map(a=><Cuboid key={a} position={[a,3.3,-2.2]} size={[.25,6.2,.26]} color="#8da4a6"/>)}
  <Cuboid position={[0,6.4,-2.2]} size={[8.1,.4,.4]} color="#bba96a"/>
  <PalletStack position={[-2.8,0,-3.2]} count={2}/>
  <PalletStack position={[2.8,0,-3.4]} count={3}/>
  <MobileRobot position={[0,0,-.2]} phase={1.2} running={running}/>
  <DashboardCabinet position={[-4.1,0,-4.5]}/>
  <Indicator position={[3.6,6.7,-2.2]}/>
 </group>;
}
function PowertrainMachine({x,z,running}) {
 return <group position={[x,0,z]}>
  <Cuboid position={[0,.2,0]} size={[13,.4,8]} color="#4a6068"/>
  {[-3.4,3.4].map((a,i)=><group key={a}>
    <Cuboid position={[a,.9,0]} size={[2.8,1,2]} color="#3d535a"/>
    <Cuboid position={[a,1.5,0]} size={[1.9,.6,1.4]} color={i?'#7f9aa3':'#b79e6b'}/>
    <RobotArm position={[a+(i?1.9:-1.9),.4,-1.9]} color={i?'#9bc1b7':'#d1aa67'} mirror={!!i} size={.85} running={running} phase={i*2.1}/>
    <RobotArm position={[a+(i?-1.9:1.9),.4,2.0]} color="#81bfc0" mirror={!i} size={.78} running={running} phase={1.2+i}/>
  </group>)}
  <Cuboid position={[0,.55,0]} size={[1.9,.3,5.6]} color="#2b3e45"/>
  {[-5.6,5.6].map(a=><StorageRack key={a} position={[a,0,-3.2]} levels={2} width={3.2}/>)}
  {[-5.8,5.8].map(a=>[-3.4,3.4].map(b=><Cuboid key={`${a}/${b}`} position={[a,2.5,b]} size={[.2,4.6,.22]} color="#8ba3a5"/>))}
  <Cuboid position={[0,4.9,-3.4]} size={[11.8,.28,.28]} color="#8ba3a5"/>
  <DashboardCabinet position={[0,0,-3.6]} rotate={Math.PI}/>
  <Indicator position={[5.8,5.2,3.4]}/>
  <SafetyFence at={[0,0,4.1]} length={12}/>
 </group>;
}
function Forklift({position=[0,0,0],rotation=0}) {
 return <group position={position} rotation={[0,rotation,0]}>
  <Cuboid position={[0,.42,0]} size={[2.65,.76,1.55]} color="#b89a58" />
  <Cuboid position={[-.48,1.33,0]} size={[1.2,1.22,1.47]} color="#d7b766"/>
  <Cuboid position={[.40,1.5,-.60]} size={[.08,1.78,.10]} color="#313e43"/>
  <Cuboid position={[.40,1.5,.60]} size={[.08,1.78,.10]} color="#313e43"/>
  <Cuboid position={[-.37,2.35,0]} size={[1.44,.15,1.56]} color="#45585d" />
  <Cuboid position={[1.40,1.25,0]} size={[.17,2.4,1.48]} color="#6b7e80"/>
  <Cuboid position={[1.3,2.4,0]} size={[.28,.24,1.62]} color="#bac3b5"/>
  {[-.40,.40].map(z=><Cuboid key={z} position={[2.35,.24,z]} size={[2.3,.12,.18]} color="#b0b8ae"/>)}
  {[-.90,.88].map(x=>[-.86,.86].map(z=><Cylinder key={`${x}/${z}`} position={[x,.31,z]} args={[.38,.38,.2,14]} rotation={[Math.PI/2,0,0]} color="#1c292c"/>))}
  <Indicator position={[-.88,2.55,-.5]} color="#eac57c" />
 </group>;
}
function ToolCart({position=[0,0,0],color='#63888a'}) {
 return <group position={position}>
  <Cuboid position={[0,.67,0]} size={[1.65,.15,.95]} color="#a1aca4" />
  <Cuboid position={[0,1.28,0]} size={[1.6,.15,.95]} color={color} />
  <Cuboid position={[0,.93,0]} size={[1.48,.50,.80]} color="#31494c" />
  {[-.7,.7].map(x=>[-.35,.35].map(z=><Cylinder key={`${x}/${z}`} position={[x,.20,z]} args={[.17,.17,.18,10]} rotation={[Math.PI/2,0,0]} color="#131e21"/>))}
  {[-.7,.7].map(x=>[-.38,.38].map(z=><Cuboid key={`${x}/${z}`} position={[x,.93,z]} size={[.07,1.6,.07]} color="#a0b4ae"/>))}
 </group>;
}
function TyrePallet({position=[0,0,0]}) {
 return <group position={position}>
  <Cuboid position={[0,.13,0]} size={[2.1,.26,1.6]} color="#ae9975"/>
  {[-.43,.43].map(x=>[-.4,.4].map(z=><group key={`${x}/${z}`}>
    {Array.from({length:3},(_,i)=><Cylinder key={i} position={[x,.4+i*.30,z]} args={[.35,.35,.24,16]} color="#1f2b30"/>)}
    <Cylinder position={[x,1.18,z]} args={[.14,.14,.02,12]} color="#59676b"/>
  </group>))}
 </group>;
}
function MobileRobot({position=[0,0,0],phase=0,running=true}) {
 const g=useRef();
 useFrame(({clock})=>{if(g.current&&running){g.current.position.z=Math.sin(clock.getElapsedTime()*.17+phase)*1.1;}});
 return <group ref={g} position={position}><MotionPart running={running} phase={phase}>
  <Cuboid position={[0,.29,0]} size={[1.8,.45,1.2]} color="#718b8d" />
  <Cuboid position={[0,.57,0]} size={[1.58,.13,1.08]} color="#879d97" />
  {[-.7,.7].map(x=>[-.43,.43].map(z=><Cylinder key={`${x}/${z}`} position={[x,.16,z]} args={[.15,.15,.22,10]} rotation={[Math.PI/2,0,0]} color="#202d2c"/>))}
  <Indicator position={[.7,.71,.38]} color="#e4b37a"/>
 </MotionPart></group>;
}
function Ancillaries({running}) {
  return <group>
   {/* coil store feeding the press line */}
   {[-27,-22,-17].map(z=><StorageRack key={z} position={[-36,0,z-8]} levels={3} width={4}/>)}
   <PalletStack position={[-31,0,-33]} count={3}/><PalletStack position={[-31,0,-20]} count={2}/>
   <Forklift position={[-33,0,-30]} rotation={PI/2}/>
   <Forklift position={[-33,0,18]} rotation={-PI/2}/>
   {/* finished-vehicle yard */}
   {[-31,-23].map((z,i)=><group key={z} position={[-33,0,z+4+i*0]}>
     <group scale={.9} rotation={[0,PI/2,0]}><CarBody paint={['#9fb1b1','#bdc3b8'][i]}/></group>
   </group>)}
   {[8,16,24].map((z,i)=><group key={z} position={[-31,.65,z]} rotation={[0,PI/2,0]} scale={.9}><CarBody paint={['#84b8bf','#c3bb9f','#77b4b4'][i]}/></group>)}
   {/* interior floor equipment, west half of the courtyard */}
   <ToolCart position={[-12,0,-10]} color="#96b1ad"/><ToolCart position={[-6,0,12]} color="#b4a779"/>
   <TyrePallet position={[-14,0,4]}/><TyrePallet position={[-9,0,-4]}/>
   <MobileRobot position={[-4,0,-12]} phase={0} running={running}/>
   <MobileRobot position={[-12,0,8]} phase={2} running={running}/>
   <StorageRack position={[-6,0,0]} levels={2} width={4.5}/>
   <PalletStack position={[-16,0,-12]} count={2}/><PalletStack position={[-3,0,8]} count={2}/>
   {/* control cabinets along the courtyard edge */}
   {[-14,-2,10].map((x,i)=><DashboardCabinet key={x} position={[x,0,-17]} rotate={PI}/>)}
   {[-6,8].map(z=><DashboardCabinet key={z} position={[16,0,z]} rotate={-PI/2}/>)}
   {[-14,-2,10].map(x=><DashboardCabinet key={x} position={[x,0,17]}/>)}
  </group>;
}
const STATUS_TEXT = { running:'Running', degraded:'Degraded', down:'Down', blocked:'Blocked', starved:'Starved', setup:'Changeover', off:'Idle' };
function MarkerLabel({id,index,cfg,metric,selected,bottleneck,onSelect}) {
 const L=LAYOUT[id];
 const status=metric?.status||'off';
 const feeder=id==='powertrain';
 const [ix,iz]=inward(L,feeder?0:3);
 return <Html transform center position={[L.x+ix,feeder?7.2:8.9,L.z+iz]} distanceFactor={30} zIndexRange={[12,0]} occlude={false}>
   <button className={`asset-tag ${bottleneck?'alert':''} ${selected?'selected':''}`} data-status={status} onClick={(e)=>{e.stopPropagation();onSelect(id);}} aria-label={`Select ${cfg.name}`}>
     <span className="tag-no">{feeder?'PT':String(index+1).padStart(2,'0')}</span>
     <span className="tag-meta"><strong>{cfg.name}</strong><small>{STATUS_TEXT[status]}{metric?` · ${metric.utilisation.toFixed(0)}% busy`:''}</small></span>
     <span className="tag-led" style={{background:STATUS_COLOR[status],boxShadow:`0 0 8px ${STATUS_COLOR[status]}88`}}/>
   </button>
 </Html>;
}
const VIEWS={iso:{p:[64,70,76],z:11.5},top:{p:[0,150,3],z:8.2},front:{p:[0,26,150],z:9}};
function CameraRig({view,command}) {
 const {camera}=useThree();
 const ctrl=useRef();
 const animating=useRef(true);
 const desired=useRef(new Vector3(...VIEWS.iso.p));
 const zoomTo=useRef(VIEWS.iso.z);
 const target=useRef(new Vector3(0,0,0));
 useEffect(()=>{
   const v=VIEWS[view]||VIEWS.iso; desired.current.set(...v.p); zoomTo.current=v.z;
   target.current.set(0,view==='iso'?1:0,0);
   animating.current=true;
 },[view,command]);
 useFrame((_,delta)=>{
   if(!ctrl.current||!animating.current)return;
   const k=1-Math.exp(-Math.min(delta,.07)*4);
   if(camera.position.distanceTo(desired.current)>.09||Math.abs(camera.zoom-zoomTo.current)>.02){
     camera.position.lerp(desired.current,k);
     camera.zoom+=(zoomTo.current-camera.zoom)*k; camera.updateProjectionMatrix();
     ctrl.current.target.lerp(target.current,k);
     ctrl.current.update();
   } else { animating.current=false; }
 });
 return <OrbitControls ref={ctrl} enableDamping dampingFactor={.08} minZoom={5} maxZoom={40}
   minPolarAngle={.02} maxPolarAngle={Math.PI*.46} enablePan enableRotate screenSpacePanning target={[0,1,0]} />;
}
function FactoryWorld({stations,metrics,bottleneckId,selectedId,setSelectedId,running,uph,view,command,highlight}) {
 const flow=useRef(1);
 flow.current=Math.max(.15,uph/45);
 const live=(id)=>running&&['running','degraded','setup'].includes(metrics[id]?.status||'running');
 const machines={
   stamp:<StampingMachine x={0} running={live('stamp')}/>, weld:<WeldingMachine x={0} running={live('weld')}/>,
   paint:<PaintingMachine x={0} running={live('paint')}/>, trim:<TrimMachine x={0} running={live('trim')}/>,
   marriage:<MarriageMachine x={0} running={live('marriage')}/>, final:<AssemblyMachine x={0} running={live('final')}/>,
   eol:<EolMachine x={0} running={live('eol')}/>, audit:<QualityMachine x={0} running={live('audit')}/>,
   dispatch:<DispatchMachine x={0} running={live('dispatch')}/>, powertrain:<PowertrainMachine x={0} z={0} running={live('powertrain')}/>,
 };
 const ids=[...MAIN_IDS,'powertrain'];
 const calm=useReducedMotion();
 const motion=useMemo(()=>({on:highlight,calm}),[highlight,calm]);
 return <MotionCtx.Provider value={motion}>
   <color attach="background" args={['#111d24']}/>
   <fog attach="fog" args={['#111d24',150,330]} />
   <ambientLight intensity={1.22} color="#cce0dc" />
   <hemisphereLight intensity={1.7} color="#d6ece9" groundColor="#344249" />
   <directionalLight castShadow position={[-34,60,40]} intensity={2.8} color="#f6f1dc" shadow-mapSize-width={2048} shadow-mapSize-height={2048}
     shadow-camera-left={-58} shadow-camera-right={58} shadow-camera-top={58} shadow-camera-bottom={-58} shadow-camera-near={1} shadow-camera-far={190} shadow-bias={-.001} />
   <directionalLight position={[30,24,-40]} intensity={1.35} color="#79b4c0"/>
   {[[-14,-14],[14,-14],[-14,14],[14,14]].map(([x,z])=><pointLight key={`${x}${z}`} position={[x,9,z]} intensity={26} distance={34} color={x<0?'#b1dacd':'#ffd6a1'} />)}
   <Floor/><HallStructure/><RailConveyor/><FlowChevrons running={running} flow={flow}/>
   {ids.map(id=>{
     const L=LAYOUT[id], m=metrics[id], feeder=id==='powertrain';
     return <group key={id} position={[L.x,0,L.z]} rotation={[0,L.rot,0]} onClick={(e)=>{e.stopPropagation();setSelectedId(id);}}>
       <Zone id={id} w={feeder?14:10} d={feeder?9.4:17} x={0} z={0} selected={selectedId===id} bottleneck={bottleneckId===id} status={m?.status} onClick={setSelectedId}/>
       {machines[id]}
       {m&&<BufferRow x={feeder?0:-5.3} z={feeder?4.9:3.7} cap={m.bufferCap} fill={m.buffer} color={m.buffer>=m.bufferCap?'#d9a35f':'#6ac9c0'}/>}
     </group>;
   })}
   <Ancillaries running={running}/>
   {Array.from({length:12},(_,i)=><TravelingCar key={i} index={i} count={12} running={running} flow={flow}/>)}
   {ids.map((id,i)=><MarkerLabel key={id} id={id} index={i} cfg={stations.find(s=>s.id===id)} metric={metrics[id]} selected={selectedId===id} bottleneck={bottleneckId===id} onSelect={setSelectedId}/>)}
   <OrthographicCamera makeDefault position={VIEWS.iso.p} zoom={11.5} near={.1} far={520}/>
   <CameraRig view={view} command={command} />
 </MotionCtx.Provider>;
}

export default function FactoryScene({stations,metrics,bottleneckId,selectedId,setSelectedId,running,uph}){
 const [view,setView]=useState('iso');
 const [command,setCommand]=useState(0);
 const [highlight,setHighlight]=useState(true);
 const order=[...MAIN_IDS,'powertrain'];
 return <div className="scene-3d-shell show-grid">
   <div className="scene-chrome scene-chrome-left"><span className="scene-status-dot"/> DIGITAL TWIN / V3.1 <span className="scene-chrome-sep">·</span> AX-01 / SIMULATED</div>
   <div className="scene-chrome scene-chrome-right"><ScanLine size={14}/> PROCEDURAL 3D <span className="scene-chrome-sep">/</span> NO EXTERNAL ASSETS</div>
   <div className="camera-rail" aria-label="Factory camera controls">
     <span>CAMERA</span>
     {['iso','top','front'].map(v=><button key={v} onClick={()=>{setView(v);setCommand(c=>c+1);}} className={view===v?'active':''}>{v==='iso'?'3D ISO':v==='top'?'TOP':'FRONT'}</button>)}
     <button title="Highlight moving parts" aria-pressed={highlight} className={highlight?'active':''} onClick={()=>setHighlight(h=>!h)}><Activity size={13}/>&nbsp;MOTION</button>
     <button title="Reset camera" aria-label="Reset 3D camera" onClick={()=>{setView('iso');setCommand(c=>c+1);}}><RotateCcw size={14}/></button>
   </div>
   <ol className="scene-rail" aria-label="Station status">
     {order.map((id,i)=>{const m=metrics[id],c=stations.find(s=>s.id===id); if(!m||!c)return null;
       return <li key={id}><button className={`${selectedId===id?'on':''} ${bottleneckId===id?'lim':''}`} onClick={()=>setSelectedId(id)}>
         <i style={{background:STATUS_COLOR[m.status]}}/><span className="rn">{id==='powertrain'?'PT':String(i+1).padStart(2,'0')}</span>
         <span className="rl">{c.name}</span><span className="rv">{m.utilisation.toFixed(0)}%</span><span className="rb">{m.buffer}/{m.bufferCap}</span></button></li>;})}
     <li className="rail-key">BUSY · BUFFER</li>
   </ol>
   <div className="scene-canvas">
     <Canvas shadows gl={{antialias:true,powerPreference:'high-performance'}} dpr={[1,1.6]} frameloop="always" aria-label="Interactive 3D factory laid out as a U-shaped loop with nine production stations and a powertrain feeder cell">
       <Suspense fallback={null}>
         <FactoryWorld stations={stations} metrics={metrics} bottleneckId={bottleneckId} selectedId={selectedId}
           setSelectedId={setSelectedId} running={running} uph={uph} view={view} command={command} highlight={highlight}/>
       </Suspense>
     </Canvas>
   </div>
   <div className="scene-guide"><Move3d size={13}/><span>DRAG TO ORBIT</span><span className="guide-separator"/> SCROLL TO ZOOM <span className="guide-separator"/> CLICK A STATION</div>
   <div className="scene-scale">U-SHAPED LOOP: 80 × 80m <span>/</span> FLOW RUNS CLOCKWISE FROM THE NORTH-WEST <span>/</span> VEHICLE MOTION IS ILLUSTRATIVE</div>
 </div>;
}
