"use client";

/**
 * Daira robot — actual perspective-correct 3D geometry.
 * Each armor plate, optical lens, fastener and cable is a Three mesh;
 * the former photographic plate is only a WebGL-unsupported fallback.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group, MeshStandardMaterial } from "three";
import * as THREE from "three";
import Image from "next/image";

const white = "#edf5ff";
const pearl = "#ffffff";
const chrome = "#9fb9d5";
const metal = "#455e7b";
const shadow = "#142744";
const blue = "#3479ff";

type Vector = [number, number, number];

function Wire({ points, radius = .014, color = "#6ebcff", luminous = false }: {
  points: Vector[]; radius?: number; color?: string; luminous?: boolean;
}) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curve, 30, radius, 7, false);
  }, [points, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} metalness={luminous ? .25 : .82}
        roughness={luminous ? .19 : .28} emissive={luminous ? color : "#000000"}
        emissiveIntensity={luminous ? 1.55 : 0} toneMapped={!luminous}/>
    </mesh>
  );
}

function Screw({ position, size = .026, rotation = [0,0,0] }: {
  position: Vector; size?: number; rotation?: Vector;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh><cylinderGeometry args={[size, size, .008, 12]}/>
        <meshStandardMaterial color="#5a7693" metalness={.91} roughness={.19}/>
      </mesh>
      <mesh rotation={[Math.PI/2,0,0]} position={[0,.006,0]}>
        <boxGeometry args={[size*1.05,.004,.005]}/>
        <meshStandardMaterial color="#deebfd" metalness={.78} roughness={.22}/>
      </mesh>
    </group>
  );
}

function Eye({ side, material }: { side: -1 | 1; material: MeshStandardMaterial }) {
  const x = side * .465;
  return (
    <group position={[x,.405,1.055]} rotation={[0,side * -.105,0]}>
      <mesh position={[0,0,.025]}>
        <cylinderGeometry args={[.317,.317,.075,64]}/>
        <meshStandardMaterial color="#0b1a2e" metalness={.62} roughness={.17}/>
      </mesh>
      <mesh position={[0,0,.113]}>
        <torusGeometry args={[.272,.027,10,84]}/>
        <meshStandardMaterial color="#405c8d" metalness={.95} roughness={.16}/>
      </mesh>
      <mesh position={[0,0,.12]} material={material}>
        <torusGeometry args={[.227,.046,14,84]}/>
      </mesh>
      <mesh position={[0,0,.117]} rotation={[0,0,side*.24]}>
        <torusGeometry args={[.185,.009,10,64]}/>
        <meshStandardMaterial color="#91efff" emissive="#34c5ff" emissiveIntensity={.72} toneMapped={false}/>
      </mesh>
      <mesh position={[0,0,.115]}>
        <circleGeometry args={[.158,64]}/>
        <meshPhysicalMaterial color="#062048" roughness={.13} metalness={.8} clearcoat={1}/>
      </mesh>
      <mesh position={[0,0,.129]}>
        <torusGeometry args={[.11,.013,8,64]}/>
        <meshStandardMaterial color="#51c9ff" emissive="#0e80f8" emissiveIntensity={1.1}/>
      </mesh>
      <mesh position={[0,0,.131]}>
        <sphereGeometry args={[.076,24,16]}/>
        <meshPhysicalMaterial color="#041021" metalness={.77} roughness={.07} clearcoat={1}/>
      </mesh>
      <mesh position={[-.033,.052,.204]} scale={[.026,.032,.008]}>
        <sphereGeometry args={[1,20,12]}/>
        <meshBasicMaterial color="#efffff" toneMapped={false}/>
      </mesh>
      {Array.from({length:32},(_,i)=>{
        const a=(i/32)*Math.PI*2;
        return <mesh key={i} position={[Math.sin(a)*.295,Math.cos(a)*.295,.119]}>
          <sphereGeometry args={[.006,7,7]}/>
          <meshBasicMaterial color="#64c6fb" toneMapped={false}/>
        </mesh>;
      })}
    </group>
  );
}

function SideModule({ side }: { side:-1|1 }) {
  return (
    <group position={[side*1.17,.37,-.035]} rotation={[0,side*Math.PI/2,0]}>
      <mesh position={[0,0,.075]} rotation={[Math.PI/2,0,0]}>
        <cylinderGeometry args={[.435,.45,.25,56]}/>
        <meshStandardMaterial color={shadow} roughness={.25} metalness={.8}/>
      </mesh>
      <mesh position={[0,0,.21]}>
        <torusGeometry args={[.394,.06,14,64]}/>
        <meshStandardMaterial color={pearl} metalness={.3} roughness={.22}/>
      </mesh>
      <mesh position={[0,0,.235]}>
        <torusGeometry args={[.337,.024,14,64]}/>
        <meshStandardMaterial color="#29b9fc" emissive="#168eff" emissiveIntensity={1.6} toneMapped={false}/>
      </mesh>
      <mesh position={[0,0,.22]}>
        <torusGeometry args={[.277,.038,12,64]}/>
        <meshStandardMaterial color="#5b7292" metalness={.87} roughness={.21}/>
      </mesh>
      <mesh position={[0,0,.24]}>
        <circleGeometry args={[.25,64]}/>
        <meshPhysicalMaterial color="#a5b3c9" metalness={.92} roughness={.19} clearcoat={.65}/>
      </mesh>
      <mesh position={[0,0,.249]}>
        <torusGeometry args={[.16,.012,12,64]}/>
        <meshStandardMaterial color="#394e68" metalness={.9} roughness={.17}/>
      </mesh>
      <mesh position={[0,0,.253]}>
        <circleGeometry args={[.135,64]}/>
        <meshStandardMaterial color="#607a99" metalness={1} roughness={.2}/>
      </mesh>
      {Array.from({length:12},(_,i)=>{
        const a=i*Math.PI/6;
        return (
          <group key={i} position={[Math.sin(a)*.285,Math.cos(a)*.285,.25]}>
            <mesh rotation={[0,0,a]}><boxGeometry args={[.017,.08,.018]}/>
              <meshStandardMaterial color={i%3===0?"#8de8ff":"#344e6d"} metalness={.75} roughness={.23}
                emissive={i%3===0?"#35b8ff":"#000"} emissiveIntensity={i%3===0?.7:0}/>
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function RobotSculpture({ reduceMotion }: { reduceMotion:boolean }) {
  const root=useRef<Group>(null);
  const cyan=useMemo(()=>new THREE.MeshStandardMaterial({
    color:"#b5efff",metalness:.25,roughness:.13,emissive:new THREE.Color("#278eff"),emissiveIntensity:2.1,
    toneMapped:false
  }),[]);
  const eyeLeft=useMemo(()=>cyan.clone(),[cyan]);
  const eyeRight=useMemo(()=>cyan.clone(),[cyan]);
  useEffect(()=>()=>{cyan.dispose();eyeLeft.dispose();eyeRight.dispose();},[cyan,eyeLeft,eyeRight]);
  const elapsed=useRef(0);

  useFrame(({clock,pointer},delta)=>{
    if (!root.current) return;
    const t=clock.elapsedTime;
    const targetX=reduceMotion?0:-.085+pointer.y*.085;
    const targetY=reduceMotion?.09:.13+pointer.x*.23;
    root.current.rotation.x=THREE.MathUtils.damp(root.current.rotation.x,targetX,2.4,delta);
    root.current.rotation.y=THREE.MathUtils.damp(root.current.rotation.y,targetY,2.4,delta);
    root.current.position.y=reduceMotion?0:Math.sin(t*.72)*.038;
    if (!reduceMotion) elapsed.current+=Math.min(delta,.1);
    // Off -> two/three short optical flashes -> fully luminous -> pause -> repeat.
    const phase=(elapsed.current % 5.6);
    const intensity=(p:number)=>{
      if(reduceMotion) return 2.2;
      if(p<.15) return .03;
      if(p<.24) return 2.8;
      if(p<.36) return .06;
      if(p<.46) return 1.6;
      if(p<.56) return .04;
      if(p<.68) return 2.5;
      if(p<.76) return .11;
      return 2.0 + .12*Math.sin(p*2.2);
    };
    eyeLeft.emissiveIntensity=intensity(phase);
    eyeRight.emissiveIntensity=intensity((phase+.045)%5.6);
  });

  return (
    <group ref={root} position={[0,0,0]} scale={.96}>
      {/* Back of skull and inset frame give a real side and rear silhouette. */}
      <mesh position={[0,.35,-.14]} scale={[1.19,1.3,.93]}>
        <sphereGeometry args={[1,64,48]}/>
        <meshPhysicalMaterial color="#8ca5c1" metalness={.7} roughness={.29} clearcoat={.52}/>
      </mesh>
      <mesh position={[0,.37,-.18]} scale={[1.24,1.34,.94]}>
        <sphereGeometry args={[1,64,48]}/>
        <meshPhysicalMaterial color={white} metalness={.14} roughness={.21} clearcoat={1} clearcoatRoughness={.16}/>
      </mesh>
      {/* Rear articulated crown with separate panel seams. */}
      <mesh position={[0,1.26,-.18]} scale={[.93,.38,.78]}>
        <sphereGeometry args={[1,48,32]}/>
        <meshPhysicalMaterial color={pearl} metalness={.12} roughness={.15} clearcoat={1}/>
      </mesh>
      <mesh position={[0,1.25,.35]} scale={[.69,.31,.64]} rotation={[-.13,0,0]}>
        <sphereGeometry args={[1,44,32]}/>
        <meshPhysicalMaterial color="#edf4fe" metalness={.18} roughness={.2} clearcoat={1}/>
      </mesh>
      <mesh position={[0,1.48,.31]} scale={[.2,.075,.28]}>
        <sphereGeometry args={[1,24,16]}/>
        <meshStandardMaterial color="#527aa7" metalness={.75} roughness={.2}/>
      </mesh>
      <mesh position={[0,1.5,.58]} scale={[.074,.12,.032]}>
        <capsuleGeometry args={[.075,.1,7,14]}/>
        <meshStandardMaterial color="#82eaff" emissive="#178aff" emissiveIntensity={2.3} toneMapped={false}/>
      </mesh>

      {/* The curved dark visor is a physical convex object, not a flat image texture. */}
      <mesh position={[0,.37,.72]} scale={[1.075,.72,.58]}>
        <sphereGeometry args={[1,64,48]}/>
        <meshPhysicalMaterial color="#8daecd" metalness={.78} roughness={.18}/>
      </mesh>
      <mesh position={[0,.39,.765]} scale={[1.018,.655,.585]}>
        <sphereGeometry args={[1,64,48]}/>
        <meshPhysicalMaterial color="#06152c" metalness={.38} roughness={.075}
          clearcoat={1} clearcoatRoughness={.06} transparent opacity={.98}/>
      </mesh>
      <mesh position={[0,.41,.75]} scale={[1.038,.669,.586]}>
        <sphereGeometry args={[1,56,40]}/>
        <meshBasicMaterial color="#143455" wireframe transparent opacity={.017} depthWrite={false}/>
      </mesh>
      {/* A sculpted light-catching ceramic brow and lower jaw. */}
      <mesh position={[0,.99,.58]} scale={[1.1,.23,.55]} rotation={[.03,0,0]}>
        <sphereGeometry args={[1,52,32]}/>
        <meshPhysicalMaterial color={pearl} metalness={.08} roughness={.17} clearcoat={1}/>
      </mesh>
      <mesh position={[0,-.35,.57]} scale={[.99,.58,.69]} rotation={[-.07,0,0]}>
        <sphereGeometry args={[1,56,40]}/>
        <meshPhysicalMaterial color={white} metalness={.1} roughness={.18} clearcoat={1}/>
      </mesh>
      <mesh position={[0,-.65,1.062]} scale={[.49,.2,.075]}>
        <sphereGeometry args={[1,32,16]}/>
        <meshPhysicalMaterial color="#e8f1fc" metalness={.12} roughness={.2} clearcoat={1}/>
      </mesh>
      <Wire points={[[-.24,-.43,1.16],[-.13,-.47,1.195],[0,-.485,1.205],[.13,-.47,1.195],[.24,-.43,1.16]]} radius={.015} color="#142c47"/>
      <Wire points={[[-.27,.92,1.03],[0,.949,1.14],[.27,.92,1.03]]} radius={.012} color="#90d8ff" luminous/>
      <Wire points={[[-.77,-.18,1.004],[-.72,-.35,1.02],[-.62,-.48,1.0]]} radius={.014} color="#2088ff" luminous/>
      <Wire points={[[.77,-.18,1.004],[.72,-.35,1.02],[.62,-.48,1.0]]} radius={.014} color="#2088ff" luminous/>

      {/* True separated optical housings, two concentric apertures each. */}
      <Eye side={-1} material={eyeLeft}/>
      <Eye side={1} material={eyeRight}/>

      {/* Segmented side armor and brushed metal ear drums. */}
      {([-1,1] as const).map((side)=>(
        <group key={side}>
          <mesh position={[side*1.06,.8,.39]} rotation={[0,side*.28,side*-.13]} scale={[.23,.44,.53]}>
            <sphereGeometry args={[1,32,24]}/>
            <meshPhysicalMaterial color={white} metalness={.14} roughness={.22} clearcoat={1}/>
          </mesh>
          <mesh position={[side*1.07,-.31,.32]} rotation={[0,side*-.32,side*.2]} scale={[.22,.52,.6]}>
            <sphereGeometry args={[1,32,24]}/>
            <meshPhysicalMaterial color="#e9f1fc" metalness={.27} roughness={.22} clearcoat={.85}/>
          </mesh>
          <mesh position={[side*1.015,-.64,.39]} rotation={[0,side*.3,side*.3]} scale={[.2,.22,.34]}>
            <sphereGeometry args={[1,26,20]}/>
            <meshStandardMaterial color="#9fb6d0" metalness={.65} roughness={.25}/>
          </mesh>
          <SideModule side={side}/>
          {Array.from({length:6},(_,i)=>(
            <Screw key={i} position={[side*(1.06 + .045*Math.sin(i)),1.01-i*.29,.38+(i%3)*.07]}
              rotation={[Math.PI/2,0,side*.12]} size={.016}/>
          ))}
          {Array.from({length:5},(_,i)=>(
            <mesh key={i} position={[side*.92,-.10-i*.092,.76-i*.06]} rotation={[0,side*.26,side*-.1]}>
              <boxGeometry args={[.18,.025,.028]}/>
              <meshStandardMaterial color={i===2?"#3b8dcb":"#4d6480"} metalness={.8} roughness={.3}
                emissive={i===2?"#1370ff":"#000"} emissiveIntensity={i===2?.6:0}/>
            </mesh>
          ))}
          <Wire points={[[side*.98,-.65,.32],[side*1.01,-.87,.42],[side*.77,-1.11,.39]]}
            color="#1976ff" luminous radius={.021}/>
        </group>
      ))}

      {/* Neck: exposed piston rods, braided tubes, shells and ringed collar. */}
      <mesh position={[0,-1.11,-.04]} rotation={[Math.PI/2,0,0]}>
        <cylinderGeometry args={[.43,.44,.42,48]}/>
        <meshStandardMaterial color={shadow} metalness={.75} roughness={.27}/>
      </mesh>
      <mesh position={[0,-1.37,0]}>
        <cylinderGeometry args={[.52,.58,.36,48]}/>
        <meshStandardMaterial color="#6884a1" metalness={.9} roughness={.23}/>
      </mesh>
      <mesh position={[0,-1.56,.03]}>
        <cylinderGeometry args={[.75,.65,.19,64]}/>
        <meshPhysicalMaterial color="#e8f3ff" metalness={.45} roughness={.22} clearcoat={1}/>
      </mesh>
      <mesh position={[0,-1.66,.03]}>
        <cylinderGeometry args={[.8,.8,.09,64]}/>
        <meshStandardMaterial color="#849cb7" metalness={.93} roughness={.2}/>
      </mesh>
      {Array.from({length:7},(_,i)=>{
        const x=(i-3)*.145;
        return (
          <group key={i}>
            <Wire points={[[x*.85,-.88,-.03],[x*1.2,-1.07,.20],[x*.95,-1.33,.13],[x,-1.56,.05]]}
              radius={i%2===0?.04:.03} color={i%3===0?"#3a85f9":"#263e56"} luminous={i%3===0}/>
            <mesh position={[x,-1.39,.36]} rotation={[0,0,x*.35]}>
              <cylinderGeometry args={[.035,.035,.4,12]}/>
              <meshStandardMaterial color="#a2bad8" metalness={.91} roughness={.2}/>
            </mesh>
          </group>
        );
      })}
      {Array.from({length:3},(_,i)=>(
        <mesh key={i} position={[0,-1.13-i*.13,.34]} rotation={[Math.PI/2,0,0]}>
          <torusGeometry args={[.36+i*.05,.018,10,52]}/>
          <meshStandardMaterial color={i===1?"#56c2ff":"#a2b4ce"}
            metalness={.75} roughness={.22} emissive={i===1?"#167cff":"#000"} emissiveIntensity={i===1?.8:0}/>
        </mesh>
      ))}
      {/* Decorative top connector docks for the surrounding 11 service cables. */}
      {[-.82,-.42,0,.42,.82].map((x,i)=>(
        <group key={i} position={[x,1.27-i*.055,.02]} rotation={[0,0,x*.35]}>
          <mesh><cylinderGeometry args={[.072,.085,.09,20]}/>
            <meshStandardMaterial color="#607e9d" metalness={.88} roughness={.19}/>
          </mesh>
          <mesh position={[0,.048,0]}>
            <torusGeometry args={[.054,.008,8,24]}/>
            <meshStandardMaterial color="#8cdeff" emissive="#167fff" emissiveIntensity={1.1}/>
          </mesh>
        </group>
      ))}
      {/* Tiny floating shell fasteners, with geometry visible on side rotations. */}
      {Array.from({length:12},(_,i)=>{
        const a=(i/12)*2*Math.PI;
        return <mesh key={i} position={[Math.sin(a)*.94,1.10+Math.cos(a)*.08,.67]}>
          <sphereGeometry args={[.016,10,8]}/>
          <meshStandardMaterial color={i%3===0?blue:metal} metalness={.9} roughness={.17}/>
        </mesh>;
      })}
    </group>
  );
}

export function RobotThreeModel() {
  const [available,setAvailable]=useState<boolean|null>(null);
  const [reduceMotion,setReduceMotion]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);
    const update=()=>setReduceMotion(media.matches);
    media.addEventListener("change",update);
    try{
      const test=document.createElement("canvas");
      setAvailable(Boolean(test.getContext("webgl2") || test.getContext("webgl")));
    }catch{setAvailable(false);}
    return ()=>media.removeEventListener("change",update);
  },[]);

  if(available===false) return (
    <div className="sh-robot-3d__fallback">
      <Image src="/landing/daira-robot-hero.webp" alt="ربات دایرا" fill sizes="(max-width:600px) 220px,420px" priority/>
    </div>
  );
  if(available===null) return <div className="sh-robot-3d__skeleton" aria-hidden="true"/>;
  return (
    <Canvas aria-label="مدل سه‌بعدی واقعی سر ربات دایرا با حرکت و چشم‌های نورانی"
      camera={{position:[0,.07,6.8],fov:37,near:.1,far:50}}
      dpr={[1,1.5]}
      gl={{alpha:true,antialias:true,powerPreference:"high-performance"}}
      onCreated={({gl})=>{
        gl.outputColorSpace=THREE.SRGBColorSpace;
        gl.toneMapping=THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure=1.24;
      }}>
      <ambientLight intensity={1.12}/>
      <hemisphereLight args={["#f9fdff","#43618a",2.2]}/>
      <directionalLight position={[-3,5,7]} color="#ffffff" intensity={3.4}/>
      <directionalLight position={[3,2,3]} color="#9dcfff" intensity={2.5}/>
      <pointLight position={[-2,-1,2]} color="#278dff" intensity={12} distance={8}/>
      <pointLight position={[2.5,-1,0]} color="#c8edff" intensity={5} distance={7}/>
      <RobotSculpture reduceMotion={reduceMotion}/>
    </Canvas>
  );
}
