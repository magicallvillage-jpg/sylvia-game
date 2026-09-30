import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SylviaCharacter } from './SylviaCharacter';
import { Particles } from './Particles';
import { useGameStore, type Quality } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { ROOM_X, env } from './layout';
import { rig } from './rig';
import { flights, bathTick } from './activities';

// Rooms are a separate chunk (lazy) so the first paint is fast.
const Rooms = lazy(() => import('./Rooms'));

const QUALITY: Record<Quality, { dpr: number; shadows: boolean; aa: boolean; shadowMap: number }> = {
  low: { dpr: 1, shadows: false, aa: false, shadowMap: 512 },
  medium: { dpr: 1.5, shadows: true, aa: true, shadowMap: 1024 },
  high: { dpr: 2, shadows: true, aa: true, shadowMap: 2048 },
};

const NIGHT_BG = new THREE.Color('#1b2440');
const DAY_BG = new THREE.Color('#bfe8ee');
const NIGHT_SUN = new THREE.Color('#8fa3ff');
const DAY_SUN = new THREE.Color('#fff4e0');

/** Day/night follows the device clock; sleeping dims the whole room. */
function DayNight({ shadowMap, shadows }: { shadowMap: number; shadows: boolean }) {
  const amb = useRef<THREE.AmbientLight>(null!);
  const sun = useRef<THREE.DirectionalLight>(null!);
  const bg = useMemo(() => new THREE.Color(), []);
  const target = useMemo(() => new THREE.Object3D(), []);
  const { scene } = useThree();
  useEffect(() => { sun.current.target = target; }, [target]);
  useEffect(() => {
    scene.background = bg;
    return () => { scene.background = null; };
  }, [scene, bg]);

  const clockT = useRef(0);
  useFrame((state, dt) => {
    clockT.current -= dt;
    if (clockT.current <= 0) {
      clockT.current = 1;
      const d = new Date();
      const h = d.getHours() + d.getMinutes() / 60;
      env.day = THREE.MathUtils.clamp(Math.sin(((h - 6) / 12) * Math.PI) * 1.5 + 0.25, 0, 1);
    }
    const sleepTarget = useGameStore.getState().sleeping ? 1 : 0;
    env.sleepDim += (sleepTarget - env.sleepDim) * Math.min(1, dt * 2);
    const dim = 1 - 0.6 * env.sleepDim;
    amb.current.intensity = (0.55 + 0.4 * env.day) * dim;
    sun.current.intensity = (0.4 + 0.9 * env.day) * (1 - 0.7 * env.sleepDim);
    sun.current.color.copy(NIGHT_SUN).lerp(DAY_SUN, env.day);
    bg.copy(NIGHT_BG).lerp(DAY_BG, env.day).multiplyScalar(1 - 0.5 * env.sleepDim);
    const cx = state.camera.position.x;
    sun.current.position.set(cx + 3, 6, 5);
    target.position.set(cx, 0, 0);
    target.updateMatrixWorld();
  });

  return (
    <>
      <ambientLight ref={amb} intensity={0.9} />
      <directionalLight
        ref={sun}
        intensity={1}
        castShadow={shadows}
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-bias={-0.0004}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={5}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={20}
      />
      <primitive object={target} />
    </>
  );
}

/** Keeps Sylvia fully visible in any aspect ratio and slides between rooms. */
function CameraRig() {
  const st = useMemo(() => ({ x: ROOM_X.living, init: false }), []);
  useFrame((state, dt) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const aspect = state.size.width / state.size.height;
    const vfov = THREE.MathUtils.degToRad(cam.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const needH = 3.1; // world height that must stay visible around the character
    const needW = 3.0; // world width
    const dist = Math.max((needH / 2) / Math.tan(vfov / 2), (needW / 2) / Math.tan(hfov / 2), 5);
    rig.viewHalfW = dist * Math.tan(hfov / 2);
    const target = ROOM_X[useUIStore.getState().room];
    if (!st.init) { st.x = target; st.init = true; }
    st.x = THREE.MathUtils.damp(st.x, target, 3.2, dt);
    cam.position.set(st.x, 1.55, dist);
    cam.lookAt(st.x, 0.4, 0); // aim low so she sits above the bottom action bar
    cam.updateProjectionMatrix();
  });
  return null;
}

/** Emoji food sprites flying to the mouth + shower/bath per-frame logic. */
function ActivityFX() {
  const sprites = useMemo(
    () => Array.from({ length: 3 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      s.visible = false;
      s.renderOrder = 40;
      s.raycast = () => {};
      return s;
    }),
    []
  );
  useEffect(() => () => sprites.forEach((s) => s.material.dispose()), [sprites]);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    if (useUIStore.getState().bathMode) bathTick(Math.min(dt, 0.05));
    for (let i = 0; i < sprites.length; i++) {
      const f = flights[i];
      const s = sprites[i];
      if (!f) { s.visible = false; continue; }
      f.t += dt / 0.55;
      const k = Math.min(1, f.t);
      const e = k * k * (3 - 2 * k);
      tmp.copy(f.from).lerp(rig.mouthWorld, e);
      tmp.y += Math.sin(Math.PI * e) * 0.5;
      s.position.copy(tmp);
      s.scale.setScalar(0.55 * (1 - 0.45 * e));
      if (s.material.map !== f.tex) { s.material.map = f.tex; s.material.needsUpdate = true; }
      s.visible = true;
    }
    while (flights.length && flights[0].t >= 1) {
      const f = flights.shift()!;
      f.done();
    }
  });
  return <>{sprites.map((s, i) => <primitive key={i} object={s} />)}</>;
}

export default function GameCanvas() {
  const quality = useGameStore((s) => s.settings.quality);
  const visible = useUIStore((s) => s.visible);
  const q = QUALITY[quality];
  return (
    <Canvas
      key={quality}
      dpr={[1, q.dpr]}
      shadows={q.shadows}
      frameloop={visible ? 'always' : 'never'}
      gl={{ antialias: q.aa, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 38, position: [0, 1.55, 8], near: 0.1, far: 80 }}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      onCreated={({ gl }) => {
        gl.domElement.style.touchAction = 'none';
        gl.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
      }}
    >
      <DayNight shadowMap={q.shadowMap} shadows={q.shadows} />
      <CameraRig />
      <Suspense fallback={null}>
        <Rooms />
      </Suspense>
      <SylviaCharacter />
      <ActivityFX />
      <Particles />
    </Canvas>
  );
}
