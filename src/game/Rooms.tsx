import { useMemo, useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROOM_X, LOCKS, SHOWER, env } from './layout';
import { ROOMS, useUIStore, type Room } from '../store/uiStore';
import { useGameStore } from '../store/gameStore';
import { toggleSleep } from './activities';

// ---- shared geometry + toon materials (created once, reused by every prop) ----
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(0.5, 20, 14),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 22),
  cone: new THREE.ConeGeometry(0.5, 1, 22),
  tor: new THREE.TorusGeometry(0.5, 0.08, 8, 24),
};
const GRADIENT = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 175, 230, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const MATS = new Map<string, THREE.MeshToonMaterial>();
const M = (c: string) => {
  let m = MATS.get(c);
  if (!m) { m = new THREE.MeshToonMaterial({ color: c, gradientMap: GRADIENT }); MATS.set(c, m); }
  return m;
};

type V3 = [number, number, number];
interface PropProps { p: V3; s: V3; c: string; g?: keyof typeof GEO; r?: V3; cast?: boolean }
function B({ p, s, c, g = 'box', r, cast = true }: PropProps) {
  return <mesh geometry={GEO[g]} material={M(c)} position={p} scale={s} rotation={r} castShadow={cast} receiveShadow dispose={null} />;
}

function Shell({ wall, floor, trim = '#fbf6ea' }: { wall: string; floor: string; trim?: string }) {
  return (
    <>
      <B p={[0, -0.15, 0]} s={[9.6, 0.3, 6]} c={floor} cast={false} />
      <B p={[0, 2.1, -2.4]} s={[9.6, 4.2, 0.3]} c={wall} cast={false} />
      <B p={[0, 0.12, -2.2]} s={[9.6, 0.24, 0.12]} c={trim} cast={false} />
      <B p={[-4.9, 2.1, 0]} s={[0.3, 4.2, 6]} c={wall} cast={false} />
      <B p={[4.9, 2.1, 0]} s={[0.3, 4.2, 6]} c={wall} cast={false} />
    </>
  );
}

/** Window whose sky follows the real clock (day / dusk / night with stars). */
function Win({ p }: { p: V3 }) {
  const sky = useRef<THREE.MeshBasicMaterial>(null!);
  const stars = useRef<THREE.Group>(null!);
  const day = useMemo(() => new THREE.Color('#9fdcf0'), []);
  const night = useMemo(() => new THREE.Color('#15204a'), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const starPos = useMemo<V3[]>(() => [[-0.5, 0.5, 0], [0.2, 0.7, 0], [0.55, 0.15, 0], [-0.2, -0.1, 0], [-0.55, -0.5, 0], [0.4, -0.55, 0]], []);
  useFrame(() => {
    tmp.copy(night).lerp(day, env.day);
    sky.current.color.copy(tmp).multiplyScalar(1 - 0.35 * env.sleepDim);
    stars.current.visible = env.day < 0.45;
  });
  return (
    <group position={p}>
      <B p={[0, 0, -0.05]} s={[2.0, 1.7, 0.1]} c="#fbf6ea" cast={false} />
      <mesh position={[0, 0, 0.01]} raycast={() => {}}>
        <planeGeometry args={[1.75, 1.45]} />
        <meshBasicMaterial ref={sky} color="#9fdcf0" toneMapped={false} />
      </mesh>
      <group ref={stars} position={[0, 0, 0.03]}>
        {starPos.map((sp, i) => (
          <mesh key={i} position={sp} scale={0.07} geometry={GEO.sph} raycast={() => {}} dispose={null}>
            <meshBasicMaterial color="#fff3b0" toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0.55, 0.42, 0]} scale={0.3} geometry={GEO.sph} raycast={() => {}} dispose={null}>
          <meshBasicMaterial color="#fffbe0" toneMapped={false} />
        </mesh>
      </group>
      <B p={[0, 0, 0.05]} s={[0.06, 1.5, 0.05]} c="#fbf6ea" cast={false} />
      <B p={[0, 0, 0.05]} s={[1.8, 0.06, 0.05]} c="#fbf6ea" cast={false} />
    </group>
  );
}

function Plant({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <B p={[0, 0.25, 0]} s={[0.5, 0.5, 0.5]} c="#c98a5a" g="cyl" />
      <B p={[0, 0.75, 0]} s={[0.6, 0.6, 0.6]} c="#5c8a3a" g="sph" />
      <B p={[-0.18, 0.95, 0.05]} s={[0.4, 0.4, 0.4]} c="#6fa04a" g="sph" />
      <B p={[0.18, 0.9, -0.05]} s={[0.36, 0.36, 0.36]} c="#4f7a30" g="sph" />
    </group>
  );
}

function Living() {
  return (
    <>
      <Shell wall="#cfeaea" floor="#e9d7b5" />
      <Win p={[-2.2, 2.5, -2.2]} />
      <B p={[0.4, 0.02, 0.6]} s={[3.6, 0.04, 2.6]} c="#d7e3b2" g="cyl" cast={false} />
      {/* sofa */}
      <B p={[2.4, 0.3, -1.4]} s={[2.6, 0.6, 1.0]} c="#efe6d2" />
      <B p={[2.4, 0.85, -1.85]} s={[2.6, 0.8, 0.25]} c="#efe6d2" />
      <B p={[1.2, 0.55, -1.75]} s={[0.4, 0.8, 0.9]} c="#e6dbc0" />
      <B p={[3.6, 0.55, -1.75]} s={[0.4, 0.8, 0.9]} c="#e6dbc0" />
      <B p={[1.8, 0.75, -1.3]} s={[0.5, 0.5, 0.2]} c="#5c6b2a" r={[0.2, 0, 0.3]} />
      <B p={[3.0, 0.75, -1.3]} s={[0.5, 0.5, 0.2]} c="#e8641a" r={[0.2, 0, -0.25]} />
      {/* shelf + picture */}
      <B p={[0.3, 2.6, -2.2]} s={[1.3, 0.9, 0.08]} c="#8a9a4a" />
      <B p={[0.3, 2.6, -2.15]} s={[1.1, 0.7, 0.05]} c="#f6f1ea" />
      <B p={[0.3, 2.55, -2.1]} s={[0.4, 0.3, 0.05]} c="#e8641a" g="sph" />
      <Plant p={[-4.0, 0, -1.6]} s={1.1} />
      <Plant p={[4.2, 0, 1.2]} s={0.8} />
      {/* yarn ball */}
      <B p={[-0.6, 0.22, 1.5]} s={[0.44, 0.44, 0.44]} c="#e8641a" g="sph" />
      <B p={[-0.6, 0.22, 1.5]} s={[0.46, 0.46, 0.1]} c="#f3a06a" g="tor" r={[0.5, 0.3, 0]} />
    </>
  );
}

function Kitchen() {
  return (
    <>
      <Shell wall="#d8f0f2" floor="#ead9c0" />
      <Win p={[-0.4, 2.6, -2.2]} />
      <B p={[-2.6, 0.5, -1.8]} s={[3.4, 1.0, 0.9]} c="#f3ead6" />
      <B p={[-2.6, 1.02, -1.8]} s={[3.5, 0.08, 1.0]} c="#c9b48a" />
      <B p={[-2.6, 3.0, -2.0]} s={[3.4, 0.9, 0.5]} c="#8a9a4a" />
      <B p={[3.7, 1.15, -1.8]} s={[1.3, 2.3, 1.0]} c="#f6f9f9" />
      <B p={[3.7, 1.35, -1.28]} s={[1.3, 0.04, 0.05]} c="#b9c4c4" />
      <B p={[3.2, 1.2, -1.25]} s={[0.06, 0.7, 0.08]} c="#8a9494" />
      {/* table + fish bowl */}
      <B p={[-1.6, 0.62, 0.3]} s={[1.5, 0.1, 1.5]} c="#e6c89a" g="cyl" />
      <B p={[-1.6, 0.3, 0.3]} s={[0.2, 0.6, 0.2]} c="#c9a070" g="cyl" />
      <B p={[-1.6, 0.78, 0.3]} s={[0.5, 0.25, 0.5]} c="#e8641a" g="sph" />
      <B p={[-1.6, 0.9, 0.3]} s={[0.36, 0.06, 0.36]} c="#fbf6ea" g="cyl" />
      <Plant p={[1.6, 0, -1.7]} s={0.7} />
    </>
  );
}

function Bathroom() {
  const screen = useRef<THREE.Mesh>(null!);
  const duck = useRef<THREE.Group>(null!);
  useFrame((state) => {
    const busy = useUIStore.getState().toiletBusy;
    const tx = busy ? LOCKS.toilet.x : LOCKS.toilet.x + 2.6;
    screen.current.position.x += (tx - screen.current.position.x) * 0.12;
    screen.current.visible = screen.current.position.x < LOCKS.toilet.x + 2.4;
    duck.current.position.y = 0.88 + Math.sin(state.clock.elapsedTime * 2) * 0.03;
    duck.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.4) * 0.08;
  });
  return (
    <>
      <Shell wall="#c9e8f4" floor="#f2efe6" />
      <Win p={[0.6, 2.6, -2.2]} />
      {/* tub */}
      <B p={[LOCKS.tub.x, 0.4, -1.3]} s={[2.4, 0.8, 1.2]} c="#f8fbfb" />
      <B p={[LOCKS.tub.x, 0.82, -1.3]} s={[2.1, 0.06, 0.9]} c="#8fd3dd" />
      <B p={[LOCKS.tub.x - 1.0, 0.04, -0.85]} s={[0.2, 0.12, 0.2]} c="#c9b48a" g="cyl" />
      <B p={[LOCKS.tub.x + 1.0, 0.04, -0.85]} s={[0.2, 0.12, 0.2]} c="#c9b48a" g="cyl" />
      {/* shower pipe + head */}
      <B p={[SHOWER.x, 1.75, -2.05]} s={[0.08, 3.0, 0.08]} c="#b9c4c4" g="cyl" />
      <B p={[SHOWER.x, 3.2, -1.8]} s={[0.08, 0.08, 0.6]} c="#b9c4c4" g="cyl" r={[Math.PI / 2, 0, 0]} />
      <B p={[SHOWER.x, SHOWER.y + 0.05, SHOWER.z - 0.55]} s={[0.5, 0.18, 0.5]} c="#dbe4e4" g="cyl" />
      <group ref={duck} position={[LOCKS.tub.x + 0.6, 0.88, -1.3]}>
        <B p={[0, 0, 0]} s={[0.36, 0.28, 0.4]} c="#ffd54a" g="sph" />
        <B p={[0, 0.22, 0.12]} s={[0.24, 0.24, 0.24]} c="#ffd54a" g="sph" />
        <B p={[0, 0.2, 0.28]} s={[0.1, 0.08, 0.14]} c="#e8641a" />
      </group>
      {/* toilet + privacy screen */}
      <B p={[LOCKS.toilet.x, 0.28, -1.5]} s={[0.7, 0.56, 0.8]} c="#f8fbfb" g="cyl" />
      <B p={[LOCKS.toilet.x, 0.85, -2.0]} s={[0.8, 0.9, 0.3]} c="#f8fbfb" />
      <B p={[LOCKS.toilet.x, 0.6, -1.5]} s={[0.76, 0.06, 0.86]} c="#8fd3dd" g="cyl" />
      <mesh ref={screen} geometry={GEO.box} material={M('#8a9a4a')} position={[LOCKS.toilet.x + 2.6, 1.0, 0.4]} scale={[1.8, 2.0, 0.1]} castShadow dispose={null} />
      <Plant p={[-4.1, 0, 1.3]} s={0.7} />
    </>
  );
}

function Bedroom() {
  const shade = useRef<THREE.MeshBasicMaterial>(null!);
  const warm = useMemo(() => new THREE.Color('#ffe7a8'), []);
  const dark = useMemo(() => new THREE.Color('#5b5040'), []);
  useFrame(() => {
    const asleep = useGameStore.getState().sleeping;
    shade.current.color.lerp(asleep ? dark : warm, 0.08);
  });
  return (
    <>
      <Shell wall="#d9e3f4" floor="#d8c7a6" />
      <Win p={[2.4, 2.6, -2.2]} />
      {/* bed */}
      <B p={[-2.2, 0.2, -1.0]} s={[3.1, 0.4, 2.1]} c="#8a9a4a" />
      <B p={[-2.2, 0.5, -1.0]} s={[2.9, 0.24, 1.95]} c="#f6f1ea" />
      <B p={[-3.4, 0.72, -1.0]} s={[0.8, 0.22, 1.2]} c="#ffffff" />
      <B p={[-1.5, 0.66, -1.0]} s={[1.5, 0.14, 1.98]} c="#5c6b2a" />
      <B p={[-3.85, 0.9, -1.0]} s={[0.16, 1.1, 2.15]} c="#6f7f38" />
      {/* nightstand + lamp (tap the lamp to sleep / wake) */}
      <B p={[0.4, 0.35, -1.7]} s={[0.8, 0.7, 0.6]} c="#c9a070" />
      <group
        position={[0.4, 0.7, -1.7]}
        onPointerDown={(e) => { e.stopPropagation(); toggleSleep(); }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}
      >
        <B p={[0, 0.06, 0]} s={[0.3, 0.12, 0.3]} c="#8a9a4a" g="cyl" />
        <B p={[0, 0.3, 0]} s={[0.06, 0.4, 0.06]} c="#8a9a4a" g="cyl" />
        <mesh position={[0, 0.62, 0]} scale={[0.55, 0.4, 0.55]} geometry={GEO.cone} dispose={null}>
          <meshBasicMaterial ref={shade} color="#ffe7a8" toneMapped={false} />
        </mesh>
        {/* generous invisible hit area for fingers */}
        <mesh position={[0, 0.4, 0]} scale={[0.9, 1.1, 0.9]} geometry={GEO.box} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      <B p={[2.0, 0.02, 0.8]} s={[2.6, 0.04, 1.8]} c="#e7c9c9" g="cyl" cast={false} />
      <B p={[3.6, 0.3, 1.0]} s={[0.6, 0.6, 0.6]} c="#f3c9a0" g="sph" />
      <B p={[3.6, 0.72, 1.0]} s={[0.42, 0.42, 0.42]} c="#f3c9a0" g="sph" />
      <Plant p={[4.1, 0, -1.6]} s={0.9} />
    </>
  );
}

const BODIES: Record<Room, () => ReactElement> = {
  living: Living, kitchen: Kitchen, bathroom: Bathroom, bedroom: Bedroom,
};

export default function Rooms() {
  const refs = useRef<Record<string, THREE.Group | null>>({});
  useFrame((state) => {
    const cx = state.camera.position.x;
    for (const r of ROOMS) {
      const g = refs.current[r];
      if (g) g.visible = Math.abs(cx - ROOM_X[r]) < 9;
    }
  });
  return (
    <>
      {ROOMS.map((r) => {
        const Body = BODIES[r];
        return (
          <group key={r} ref={(g) => { refs.current[r] = g; }} position={[ROOM_X[r], 0, 0]}>
            <Body />
          </group>
        );
      })}
    </>
  );
}
