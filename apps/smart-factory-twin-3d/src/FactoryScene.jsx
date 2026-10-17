import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, OrthographicCamera } from '@react-three/drei';
import { Quaternion, Vector3 } from 'three';
import { RotateCcw, ScanLine, Move3d } from 'lucide-react';

/* A procedural 3D manufacturing environment. All meshes, materials, machines and
   layout are authored locally; no models, textures or telemetry are downloaded. */
const MAIN_IDS = ['stamp','weld','paint','trim','marriage','final','eol','audit','dispatch'];
const SPACING = 10.6;
const LENGTH = 100;
const HALF = LENGTH / 2;
const LAYOUT = Object.fromEntries(MAIN_IDS.map((id,i)=>[id,[(i-4)*SPACING,0]]));
LAYOUT.powertrain = [0,-16.5];
const BELT = 92;
const STATUS_COLOR = { running:'#739da8', degraded:'#d9a35f', down:'#d9776a', blocked:'#b9a96c', starved:'#6f8fa8', setup:'#a79ad0', off:'#4f5f65' };
const palette = {
  floor: '#26333b', concrete: '#1b292f', frame: '#70848b', steel: '#536b76',
  steelLight: '#a0b5b8', steelDark: '#374b55', glass: '#90c5c4', conveyor: '#222b2e',
  orange: '#ee9e56', aqua: '#6ac9c0', electric: '#91e2d1', road: '#303a3f',
};

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

function Indicator({position,color='#67c9b9'}) {
  return <group position={position}><Cylinder args={[.16,.16,.13,12]} color="#17282f"/>
    <mesh position={[0,.10,0]}><sphereGeometry args={[.145,10,8]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4}/></mesh>
  </group>;
}
function Floor() {
  const lines = useMemo(()=> Array.from({length:Math.floor(LENGTH/2)+1},(_,i)=>-HALF+1+i*2),[]);
  return <group>
    <Cuboid position={[0,-.55,0]} size={[LENGTH,1.1,23]} color="#26343a" metalness={.12} roughness={.91}/>
    <Cuboid position={[0,-.55,-17.5]} size={[34,1.1,12]} color="#24323a" metalness={.12} roughness={.91}/>
    <Cuboid position={[0,.015,-9.7]} size={[LENGTH,.028,2.2]} color="#333e42" metalness={.09}/>
    <Cuboid position={[0,.015,9.7]} size={[LENGTH,.028,2.1]} color="#3e4646" metalness={.06}/>
    {lines.map((x,i)=><group key={i}>
      <Cuboid position={[x,.03,0]} size={[.026,.035,21]} color="#53646b" metalness={.1}/>
      {i<lines.length-1&&[-7.0,7.0].map((z,k)=><Cuboid key={k} position={[x+1,.03,z]} size={[1.6,.035,.04]} color="#87958f" metalness={0}/>) }
    </group>)}
    {Array.from({length:11},(_,i)=>-10+i*2).map(z=><Cuboid key={z} position={[0,.035,z]} size={[LENGTH,.03,.022]} color="#526169" metalness={0}/>)}
    {[-8.48,8.45].map(z=><group key={z}>
      <Cuboid position={[0,.055,z]} size={[LENGTH,.04,.08]} color="#d8a44e" metalness={0}/>
      {Array.from({length:Math.floor(LENGTH/2.12)-1},(_,i)=><Cuboid key={i} position={[-HALF+2+i*2.12,.06,z]} size={[.7,.05,.08]} color="#232e31" metalness={0}/>)}
    </group>)}
    {[-HALF+.25,HALF-.25].map(x=><Cuboid key={x} position={[x,.19,0]} size={[.18,.32,23]} color="#4f636b"/>)}
    {[-11.35,11.35].map(z=><Cuboid key={z} position={[0,.18,z]} size={[LENGTH,.32,.2]} color="#52656b"/>)}
    <Cuboid position={[0,.05,-12.2]} size={[3.2,.05,.9]} color="#d8a44e"/>
    <Cuboid position={[0,.2,-11.7]} size={[3,.1,.1]} color="#4f636b"/>
  </group>;
}
function HallStructure() {
  const cols = useMemo(()=>Array.from({length:9},(_,i)=>-48+i*12),[]);
  const lights = useMemo(()=>Array.from({length:14},(_,i)=>-44+i*6.8),[]);
  return <group>
    {cols.map((x,i)=><group key={x}>
      {[-10.4,10.4].map((z,j)=><group key={j}>
        <Cuboid position={[x,4.45,z]} size={[.30,8.9,.35]} color="#6a8087"/>
        <Cuboid position={[x,8.7,z]} size={[.78,.24,.75]} color="#8ca3a8"/>
        <Indicator position={[x,6.2,z]} color={i===4 && j===0?'#efb261':'#6aabb6'}/>
      </group>)}
      <Rod from={[x,8.7,-10.4]} to={[x,8.7,10.4]} radius={.11} color="#7e9399"/>
      <Cuboid position={[x,7.35,-10.4]} size={[.25,2.2,.24]} color="#839ca1"/>
    </group>)}
    <Cuboid position={[0,8.7,-10.4]} size={[LENGTH-2,.26,.32]} color="#8ba1a7"/>
    <Cuboid position={[0,8.7,10.4]} size={[LENGTH-2,.26,.32]} color="#8ba1a7"/>
    <Cuboid position={[0,4.7,-11.3]} size={[LENGTH-1,6.8,.23]} color="#384b50" transparent opacity={.57}/>
    {Array.from({length:19},(_,i)=>-45+i*5).map(x=><group key={x}>
      <Cuboid position={[x,5.4,-11.05]} size={[3.8,2.5,.065]} color="#91b5b6" transparent opacity={.16}/>
      <Cuboid position={[x,4.2,-10.98]} size={[3.83,.10,.10]} color="#7c9ba2"/>
    </group>)}
    {[-3.4,3.4].map(z=><group key={z}>
      <Cuboid position={[0,7.75,z]} size={[LENGTH-6,.18,.32]} color="#a6a99a"/>
      {lights.map(x=><group key={x}>
        <Cuboid position={[x,7.53,z]} size={[1.6,.12,.63]} color="#d5dfd4" emissive="#f4ecbb" emissiveIntensity={.8}/>
        <Cuboid position={[x,7.63,z]} size={[.14,.3,.75]} color="#7b8c90"/>
      </group>)}
    </group>)}
  </group>;
}
function RailConveyor(){
  const L=BELT, n=Math.floor(L/.89);
  return <group>
    <Cuboid position={[0,.50,.10]} size={[L,.42,2.8]} color="#3e565e" />
    <Cuboid position={[0,.76,.10]} size={[L-.5,.12,2.25]} color="#182831" metalness={.43}/>
    {[-1.25,1.45].map(z=><group key={z}>
      <Cuboid position={[0,.98,z]} size={[L,.30,.16]} color="#8eabae"/>
      <Cuboid position={[0,.69,z]} size={[L,.12,.12]} color="#aec2c2"/>
    </group>)}
    {Array.from({length:n},(_,i)=>-L/2+.5+i*.89).map((x,i)=><group key={i}>
      <Cylinder position={[x,.84,.10]} args={[.12,.12,2.5,8]} rotation={[Math.PI/2,0,0]} color={i%2?'#6c848b':'#9db0b1'}/>
      {i%3===0&&<Cuboid position={[x,.20,.12]} size={[.17,.43,2.55]} color="#61767d" />}
    </group>)}
    <Cuboid position={[0,.38,-2.0]} size={[L+1,.22,.3]} color="#6a7c80"/>
    <Cuboid position={[0,.38,2.12]} size={[L+1,.22,.3]} color="#6a7c80"/>
    {/* kit feeder belt from the powertrain bay to the marriage station */}
    <Cuboid position={[0,.5,-9.6]} size={[1.9,.34,13.6]} color="#3e565e"/>
    <Cuboid position={[0,.72,-9.6]} size={[1.5,.1,13.6]} color="#182831"/>
    {Array.from({length:15},(_,i)=>-15.6+i*.9).map(z=><Cylinder key={z} position={[0,.8,z+6]} args={[.1,.1,1.6,8]} rotation={[0,0,Math.PI/2]} color="#9db0b1"/>)}
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
 useFrame((_,delta)=>{
    if(running) progress.current=(progress.current+Math.min(delta,.08)*flow.current*.0075)%1;
    if(group.current)group.current.position.x=-BELT/2+1.5+progress.current*(BELT-3);
 });
 return <group ref={group} position={[-BELT/2+index/count*(BELT-3),1.26,.10]}>
   <CarBody paint={['#84b8bf','#9fb1b1','#bdc3b8','#77b4b4','#c3bb9f','#7796a2','#b6c4c2'][index%7]} ghost={index===0}/>
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
function RobotArm({position=[0,0,0],color='#d1aa67',phase=0,size=1,mirror=false,running=true}) {
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
   <group ref={arm} position={[0,.62,0]}>
     <Rod from={[0,0,0]} to={[mirror?-.55:.55,1.65,-.10]} radius={.22} color={color}/>
     <mesh position={[mirror?-.55:.55,1.65,-.10]}><sphereGeometry args={[.30,12,10]}/><meshStandardMaterial color="#324951" metalness={.65}/></mesh>
     <group ref={wrist} position={[mirror?-.55:.55,1.65,-.10]}>
       <Rod from={[0,0,0]} to={[mirror?-.91:.91,.92,.36]} radius={.16} color={color}/>
       <Cylinder position={[mirror?-.91:.91,.92,.36]} args={[.23,.23,.30,12]} rotation={[0,0,Math.PI/2]} color="#829b9e" />
       <Rod from={[mirror?-.91:.91,.92,.36]} to={[mirror?-1.06:1.06,.65,.50]} radius={.07} color="#bfd0c8"/>
       <Cuboid position={[mirror?-1.06:1.06,.57,.5]} size={[.15,.16,.48]} color="#b9ccc7"/>
     </group>
   </group>
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
  <group ref={ram} position={[0,2.55,0]}>
    <Cuboid position={[0,0,0]} size={[3.85,.56,3.25]} color="#b4c0b7" />
    <Cuboid position={[0,-.46,0]} size={[3.4,.29,2.8]} color="#9a8e70" />
  </group>
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
  <RobotArm position={[-2.9,.68,-2.55]} color="#d6a362" size={1.13} running={running} phase={0}/>
  <RobotArm position={[2.8,.68,-2.48]} color="#cfa25c" mirror size={1.11} running={running} phase={1.8}/>
  <RobotArm position={[-3,.68,2.65]} color="#7cb6b1" size={.86} running={running} phase={3.2}/>
  <RobotArm position={[3.05,.68,2.4]} color="#7cb6b1" mirror size={.90} running={running} phase={4.5}/>
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
  <group ref={hoist}>
    <Cuboid position={[0,6.94,0]} size={[1.4,.6,1.0]} color="#d6b36c" />
    <Rod from={[-.36,6.6,0]} to={[-.36,4.45,0]} radius={.055} color="#d2d2bd"/>
    <Rod from={[.36,6.6,0]} to={[.36,4.45,0]} radius={.055} color="#d2d2bd"/>
    <Cuboid position={[0,4.32,0]} size={[2.45,.42,1.28]} color="#566b72" />
  </group>
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
  <group ref={scanner} position={[0,0,0]}>
    <Cuboid position={[0,4.86,0]} size={[.3,.35,4.3]} color="#c7c2a4"/>
    {[-1.9,0,1.9].map(z=><Cuboid key={z} position={[0,4.52,z]} size={[.28,.26,.65]} color="#82d4cd" emissive="#6fd1c6" emissiveIntensity={.6}/>)}
  </group>
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
 return <group position={position}><group ref={g}>
  <Cylinder position={[0,.55,0]} args={[.2,.24,1.1,10]} color="#47626b"/>
  <Cylinder position={[0,1.35,0]} args={[.26,.22,.55,10]} color={color}/>
  <mesh position={[0,1.85,0]}><sphereGeometry args={[.19,10,8]}/><meshStandardMaterial color="#d8d3c3" roughness={.6}/></mesh>
  <Cuboid position={[0,2.0,0]} size={[.44,.1,.44]} color="#e3b455"/>
 </group></group>;
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
  <group ref={lift} position={[0,.9,0]}>
    <Cuboid position={[0,0,0]} size={[3.4,.22,1.9]} color="#566b72"/>
    <Cuboid position={[0,.3,0]} size={[1.9,.55,1.3]} color="#9a8e70"/>
    {[-1.3,1.3].map(a=><Cylinder key={a} position={[a,-.3,0]} args={[.14,.14,.8,8]} color="#bfd0c8"/>)}
  </group>
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
    <mesh ref={el=>{wheels.current[i*2+j]=el;}} position={[a,.34,b]} rotation={[Math.PI/2,0,0]}><boxGeometry args={[.16,.04,.96]}/><meshStandardMaterial color="#e1c27a"/></mesh>
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
  <group ref={truck} position={[0,0,6.4]}>
    <Cuboid position={[0,2.2,0]} size={[8.2,3.2,2.4]} color="#b7c0b8" metalness={.3}/>
    <Cuboid position={[0,.7,0]} size={[8.4,.4,2.5]} color="#4b5d62"/>
    <Cuboid position={[4.8,1.6,0]} size={[1.7,2.2,2.3]} color="#7a97a0"/>
    <Cuboid position={[5.6,2.0,0]} size={[.12,1,2]} color="#a7d1d6" transparent opacity={.55}/>
    {[-3,-1.5,3.5,5].map(a=>[-1.1,1.1].map(b=><Cylinder key={`${a}/${b}`} position={[a,.4,b]} args={[.42,.42,.3,14]} rotation={[Math.PI/2,0,0]} color="#161f22"/>))}
  </group>
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
 return <group ref={g} position={position}>
  <Cuboid position={[0,.29,0]} size={[1.8,.45,1.2]} color="#718b8d" />
  <Cuboid position={[0,.57,0]} size={[1.58,.13,1.08]} color="#879d97" />
  {[-.7,.7].map(x=>[-.43,.43].map(z=><Cylinder key={`${x}/${z}`} position={[x,.16,z]} args={[.15,.15,.22,10]} rotation={[Math.PI/2,0,0]} color="#202d2c"/>))}
  <Indicator position={[.7,.71,.38]} color="#e4b37a"/>
 </group>;
}
function Ancillaries({running}) {
  const racks=[[-46,-7.2,3,4.0],[-33,7.9,2,4.5],[-20,-7.3,3,3.8],[-9,7.9,2,3.5],[7,-7.3,3,4.0],[18,7.9,2,4.5],[30,-7.3,3,3.8],[41,7.9,2,3.5]];
  const lampsX=Array.from({length:12},(_,i)=>-45+i*8.2);
  return <group>
   <Forklift position={[-47,0,8.0]} rotation={Math.PI/2}/>
   <Forklift position={[36,0,-7.8]} rotation={-Math.PI/2}/>
   <ToolCart position={[-37,0,-7.9]} color="#96b1ad"/>
   <ToolCart position={[-15.5,0,7.8]} color="#b4a779"/>
   <ToolCart position={[26,0,7.7]} color="#93a9ad"/>
   <TyrePallet position={[-26,0,-7.4]}/>
   <TyrePallet position={[15,0,-7.1]}/>
   <MobileRobot position={[-26,0,9.1]} phase={0} running={running}/>
   <MobileRobot position={[12,0,9.1]} phase={2} running={running}/>
   <MobileRobot position={[-4.2,0,-6.4]} phase={3.6} running={running}/>
   {racks.map(([x,z,l,w],i)=><StorageRack key={i} position={[x,0,z]} levels={l} width={w}/>)}
   <PalletStack position={[47,0,-7.0]} count={2}/>
   <PalletStack position={[-48,0,6.1]} count={3}/>
   <PalletStack position={[-3,0,7.3]} count={2}/>
   <PalletStack position={[-16,-.0,-7.0]} count={2}/>
   {[-45,-31,-17,4,22,33].map((x,i)=><group key={x}>
     <Cuboid position={[x,1.32,8.3]} size={[1.35,2.64,.90]} color={i%2?'#6f8280':'#869593'} />
     <Cuboid position={[x,2.0,8.8]} size={[.83,.52,.06]} color="#253d43" emissive="#375d61" emissiveIntensity={.3}/>
   </group>)}
   {lampsX.map(x=><group key={x}>
     <Cylinder position={[x,6.5,-8.2]} args={[.08,.08,6,10]} rotation={[Math.PI/2,0,0]} color="#a79e88"/>
     <Cuboid position={[x,6.48,-8.2]} size={[.22,.19,6.1]} color="#9a9a91" />
     <Rod from={[x,6.48,-8.2]} to={[x,8,-8.2]} radius={.06} color="#abb2a5"/>
   </group>)}
   <Cuboid position={[0,6.5,-8.2]} size={[LENGTH-6,.32,.32]} color="#ba9e65"/>
   <Cuboid position={[0,6.9,-8.2]} size={[LENGTH-6,.16,.18]} color="#d2b879"/>
   {[-37,-26,-15,16,27,38].map(x=><group key={x}>
     <Cuboid position={[x,.15,-6.6]} size={[2,.27,1.55]} color="#52676e" />
     {[-.75,.75].map(off=><Cylinder key={off} position={[x+off,.44,-6.6]} args={[.27,.27,.13,12]} color="#b6b5a3"/>)}
   </group>)}
  </group>;
}
const STATUS_TEXT = { running:'Running', degraded:'Degraded', down:'Down', blocked:'Blocked', starved:'Starved', setup:'Changeover', off:'Idle' };
function MarkerLabel({id,index,cfg,metric,selected,bottleneck,onSelect}) {
 const [x,z]=LAYOUT[id];
 const status=metric?.status||'off';
 const warn=bottleneck;
 const feeder=id==='powertrain';
 return <Html transform center position={[x,feeder?7.2:8.9,z+(feeder?4.8:2.6)]} distanceFactor={14} zIndexRange={[12,0]} occlude={false}>
   <button className={`asset-tag ${warn?'alert':''} ${selected?'selected':''}`} data-status={status} onClick={(e)=>{e.stopPropagation();onSelect(id);}} aria-label={`Select ${cfg.name}`}>
     <span className="tag-no">{feeder?'PT':String(index+1).padStart(2,'0')}</span>
     <span className="tag-meta"><strong>{cfg.name}</strong><small>{STATUS_TEXT[status]}{metric?` · ${metric.utilisation.toFixed(0)}% busy`:''}</small></span>
     <span className="tag-led" style={{background:STATUS_COLOR[status],boxShadow:`0 0 8px ${STATUS_COLOR[status]}88`}}/>
   </button>
 </Html>;
}
function CameraRig({view,command}) {
 const {camera}=useThree();
 const ctrl=useRef();
 const animating=useRef(true);
 const desired=useRef(new Vector3(44,62,84));
 const target=useRef(new Vector3(0,2,-3));
 useEffect(()=>{
   const presets={iso:[44,62,84],top:[0,110,.01],front:[4,20,118]};
   const next=presets[view]||presets.iso;
   desired.current.set(...next);
   target.current.set(0,view==='top'?0:2,view==='top'?-3:-3);
   animating.current=true;
 },[view,command]);
 useFrame((_,delta)=>{
   if(!ctrl.current||!animating.current)return;
   const k=1-Math.exp(-Math.min(delta,.07)*4);
   if(camera.position.distanceTo(desired.current)>.09){
     camera.position.lerp(desired.current,k);
     ctrl.current.target.lerp(target.current,k);
     ctrl.current.update();
   } else { animating.current=false; }
 });
 return <OrbitControls ref={ctrl} enableDamping dampingFactor={.08} minZoom={8} maxZoom={48}
   minPolarAngle={.12} maxPolarAngle={Math.PI*.46} enablePan enableRotate screenSpacePanning
   target={[0,2,-3]} />;
}
function FactoryWorld({stations,metrics,bottleneckId,selectedId,setSelectedId,running,uph,view,command}) {
 const flow=useRef(1);
 flow.current=Math.max(.15,uph/45);
 const live=(id)=>running&&['running','degraded','setup'].includes(metrics[id]?.status||'running');
 const machines={
   stamp:<StampingMachine x={LAYOUT.stamp[0]} running={live('stamp')}/>,
   weld:<WeldingMachine x={LAYOUT.weld[0]} running={live('weld')}/>,
   paint:<PaintingMachine x={LAYOUT.paint[0]} running={live('paint')}/>,
   trim:<TrimMachine x={LAYOUT.trim[0]} running={live('trim')}/>,
   marriage:<MarriageMachine x={LAYOUT.marriage[0]} running={live('marriage')}/>,
   final:<AssemblyMachine x={LAYOUT.final[0]} running={live('final')}/>,
   eol:<EolMachine x={LAYOUT.eol[0]} running={live('eol')}/>,
   audit:<QualityMachine x={LAYOUT.audit[0]} running={live('audit')}/>,
   dispatch:<DispatchMachine x={LAYOUT.dispatch[0]} running={live('dispatch')}/>,
   powertrain:<PowertrainMachine x={LAYOUT.powertrain[0]} z={LAYOUT.powertrain[1]} running={live('powertrain')}/>,
 };
 const ids=[...MAIN_IDS,'powertrain'];
 return <>
   <color attach="background" args={['#111d24']}/>
   <fog attach="fog" args={['#111d24',90,230]} />
   <ambientLight intensity={1.22} color="#cce0dc" />
   <hemisphereLight intensity={1.7} color="#d6ece9" groundColor="#344249" />
   <directionalLight castShadow position={[-30,48,30]} intensity={2.8} color="#f6f1dc" shadow-mapSize-width={2048} shadow-mapSize-height={2048}
     shadow-camera-left={-62} shadow-camera-right={62} shadow-camera-top={36} shadow-camera-bottom={-36} shadow-camera-near={1} shadow-camera-far={140} shadow-bias={-.001} />
   <directionalLight position={[20,18,-30]} intensity={1.35} color="#79b4c0"/>
   {[-34,-12,12,34].map(x=><pointLight key={x} position={[x,8,2]} intensity={22} distance={24} color={x<0?'#b1dacd':'#ffd6a1'} />)}
   <Floor/><HallStructure/>
   {MAIN_IDS.map(id=><Zone key={id} id={id} x={LAYOUT[id][0]} selected={selectedId===id} bottleneck={bottleneckId===id} status={metrics[id]?.status} onClick={setSelectedId}/>)}
   <Zone id="powertrain" w={14} d={9.4} x={LAYOUT.powertrain[0]} z={LAYOUT.powertrain[1]} selected={selectedId==='powertrain'} bottleneck={bottleneckId==='powertrain'} status={metrics.powertrain?.status} onClick={setSelectedId}/>
   <RailConveyor/>
   {ids.map(id=><group key={id} onClick={(e)=>{e.stopPropagation();setSelectedId(id);}}>{machines[id]}</group>)}
   {ids.map(id=>{const m=metrics[id]; if(!m)return null; const [x,z]=LAYOUT[id]; const feeder=id==='powertrain';
     return <BufferRow key={id} x={x-(feeder?0:5.3)} z={feeder?z+4.9:3.7} cap={m.bufferCap} fill={m.buffer} color={m.buffer>=m.bufferCap?'#d9a35f':'#6ac9c0'}/>;})}
   <Ancillaries running={running}/>
   {Array.from({length:9},(_,i)=><TravelingCar key={i} index={i} count={9} running={running} flow={flow}/>)}
   {ids.map((id,i)=><MarkerLabel key={id} id={id} index={i} cfg={stations.find(s=>s.id===id)} metric={metrics[id]} selected={selectedId===id} bottleneck={bottleneckId===id} onSelect={setSelectedId}/>)}
   <OrthographicCamera makeDefault position={[44,62,84]} zoom={13} near={.1} far={420}/>
   <CameraRig view={view} command={command} />
 </>;
}

export default function FactoryScene({stations,metrics,bottleneckId,selectedId,setSelectedId,running,uph}){
 const [view,setView]=useState('iso');
 const [command,setCommand]=useState(0);
 const [grid,setGrid]=useState(true);
 return <div className={`scene-3d-shell ${grid?'show-grid':''}`}>
   <div className="scene-chrome scene-chrome-left"><span className="scene-status-dot"/> DIGITAL TWIN / V3.0 <span className="scene-chrome-sep">·</span> AX-01 / SIMULATED</div>
   <div className="scene-chrome scene-chrome-right"><ScanLine size={14}/> PROCEDURAL 3D <span className="scene-chrome-sep">/</span> NO EXTERNAL ASSETS</div>
   <div className="camera-rail" aria-label="Factory camera controls">
     <span>CAMERA</span>
     {['iso','top','front'].map(v=><button key={v} onClick={()=>{setView(v);setCommand(c=>c+1);}} className={view===v?'active':''}>{v==='iso'?'3D ISO':v==='top'?'TOP':'FRONT'}</button>)}
     <button title="Reset camera" aria-label="Reset 3D camera" onClick={()=>{setView('iso');setCommand(c=>c+1);}}><RotateCcw size={14}/></button>
   </div>
   <div className="scene-canvas">
     <Canvas shadows gl={{antialias:true,powerPreference:'high-performance'}} dpr={[1,1.6]} frameloop="always" aria-label="Interactive 3D factory with nine production stations and a powertrain feeder cell">
       <Suspense fallback={null}>
         <FactoryWorld stations={stations} metrics={metrics} bottleneckId={bottleneckId} selectedId={selectedId}
           setSelectedId={setSelectedId} running={running} uph={uph} view={view} command={command}/>
       </Suspense>
     </Canvas>
   </div>
   <div className="scene-guide"><Move3d size={13}/><span>DRAG TO ORBIT</span><span className="guide-separator"/> SCROLL TO ZOOM <span className="guide-separator"/> CLICK A STATION</div>
   <div className="scene-scale">CONCEPT LAYOUT: 100 × 35m <span>/</span> VEHICLE MOTION IS ILLUSTRATIVE</div>
 </div>;
}
