import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MODEL_URL, modelConfig as cfg } from '../config/modelConfig';
import { buildFallbackSylvia } from './buildFallback';
import { FaceTexture, FACE_ASPECT } from './faceTexture';
import { rig, POSES, newPose, resetPose, IDLE_VARIANTS, IDLE_DUR, type AnimName } from './rig';
import { useGameStore, computeMood, stageForLevel, type Expression, type Quality } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { useDebugStore, type DebugInfo } from '../store/debugStore';
import { fx } from './fx';
import { pointerDown, pointerMove } from './interactions';
import { bath } from './activities';
import { audio } from '../audio/AudioManager';
import { ROOM_X } from './layout';

const H = cfg.targetHeight;
const noRaycast = () => {};

// ------------------------------------------------------------------ small helpers
class Spring {
  x = 0;
  v = 0;
  step(target: number, k: number, c: number, dt: number) {
    const n = dt > 1 / 45 ? 2 : 1;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (k * (target - this.x) - c * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;
function dampAngle(a: number, b: number, lambda: number, dt: number) {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * (1 - Math.exp(-lambda * dt));
}

function findNodes(root: THREE.Object3D, tokens: string[], bonesOnly: boolean, max = 1): THREE.Object3D[] {
  const toks = tokens.map(norm);
  const found: { o: THREE.Object3D; n: string }[] = [];
  root.traverse((o) => {
    if (o === root || !o.name) return;
    if (bonesOnly && !(o as THREE.Bone).isBone) return;
    const n = norm(o.name);
    if (n.endsWith('end') || n.includes('outline')) return;
    if (toks.some((t) => n === t || n.includes(t))) found.push({ o, n });
  });
  found.sort((a, b) => a.n.length - b.n.length);
  return found.slice(0, max).map((f) => f.o);
}

interface NodeRef {
  obj: THREE.Object3D;
  bind: THREE.Quaternion;
  axes: THREE.Vector3;
  gain: number;
  baseScale: THREE.Vector3;
}
interface Source { scene: THREE.Object3D; clips: THREE.AnimationClip[]; fallback: boolean }

// Foam clumps (bath): [x, y, z, size] as fractions of model height.
const FOAM_SPOTS: [number, number, number, number][] = [
  [0, 0.98, 0.05, 0.11], [-0.14, 0.92, 0.1, 0.08], [0.14, 0.92, 0.1, 0.08], [0, 1.02, -0.06, 0.09],
  [-0.12, 0.5, 0.14, 0.11], [0.12, 0.5, 0.14, 0.11], [0, 0.42, 0.16, 0.12], [0, 0.6, 0.12, 0.1],
  [-0.16, 0.3, 0.1, 0.09], [0.16, 0.3, 0.1, 0.09], [0, 0.2, 0.1, 0.09], [-0.1, 0.75, 0.12, 0.08],
  [0.1, 0.75, 0.12, 0.08], [0, 0.3, -0.2, 0.1],
];

interface Prepared {
  model: THREE.Object3D;
  holder: THREE.Group;
  inner: THREE.Group;
  meshes: THREE.Mesh[];
  skinned: THREE.SkinnedMesh[];
  toonMats: THREE.MeshToonMaterial[];
  skeleton: boolean;
  head?: NodeRef; neck?: NodeRef; earL?: NodeRef; earR?: NodeRef; tail?: NodeRef; armL?: NodeRef; armR?: NodeRef;
  hair: NodeRef[];
  morphs: Record<string, { mesh: THREE.Mesh; idx: number }[]>;
  faceMethod: 'morph' | 'overlay' | 'effects';
  overlay: THREE.Mesh | null;
  faceTex: FaceTexture | null;
  faceBaseM: THREE.Matrix4;
  headBindInv: THREE.Matrix4 | null;
  faceCenter: THREE.Vector3;
  mouthLocal: THREE.Vector3;
  foam: THREE.Mesh[];
  info: DebugInfo;
  dispose: () => void;
}

// ------------------------------------------------------------------ model preparation
function makeGradient() {
  const t = new THREE.DataTexture(new Uint8Array([95, 165, 225, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

function makeOutlineMat(thick: number) {
  const m = new THREE.MeshBasicMaterial({ color: cfg.outline.color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uThick = { value: thick };
    sh.vertexShader =
      'uniform float uThick;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * uThick;');
  };
  m.customProgramCacheKey = () => 'sylvia-outline-' + thick.toFixed(5);
  return m;
}

function prepare(source: Source, quality: Quality): Prepared {
  const disposables: { dispose(): void }[] = [];
  const model = source.scene;
  const holder = new THREE.Group();
  holder.name = 'holder';
  holder.add(model);
  const inner = new THREE.Group();
  inner.name = 'inner';
  inner.add(holder);
  inner.updateMatrixWorld(true);

  const meshes: THREE.Mesh[] = [];
  const bones: THREE.Bone[] = [];
  const skinned: THREE.SkinnedMesh[] = [];
  model.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh);
  });

  // A) centre, normalise scale, pivot at the feet
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = size.y > 1e-6 ? H / size.y : 1;
  holder.scale.setScalar(s);
  holder.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  inner.updateMatrixWorld(true);

  // toon materials + inverted-hull outline (original textures preserved)
  const grad = makeGradient();
  disposables.push(grad);
  const toonMats: THREE.MeshToonMaterial[] = [];
  const outlineMat = quality === 'low' ? null : makeOutlineMat(cfg.outline.thickness / s);
  if (outlineMat) disposables.push(outlineMat);
  for (const mesh of meshes) {
    const old = mesh.material;
    const arr = Array.isArray(old) ? old : [old];
    const conv = arr.map((o) => {
      const m = o as THREE.MeshStandardMaterial;
      const t = new THREE.MeshToonMaterial({
        map: m.map ?? null,
        color: m.color ? m.color.clone() : new THREE.Color('#ffffff'),
        gradientMap: grad,
        vertexColors: !!m.vertexColors,
        transparent: m.transparent,
        opacity: m.opacity,
        alphaTest: m.alphaTest,
        side: m.side,
      });
      t.userData.base = t.color.clone();
      toonMats.push(t);
      disposables.push(t);
      return t;
    });
    mesh.material = Array.isArray(old) ? conv : conv[0];
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    if (outlineMat) {
      const isSk = (mesh as THREE.SkinnedMesh).isSkinnedMesh;
      const ol = isSk ? new THREE.SkinnedMesh(mesh.geometry, outlineMat) : new THREE.Mesh(mesh.geometry, outlineMat);
      if (isSk) {
        const sm = mesh as THREE.SkinnedMesh;
        (ol as THREE.SkinnedMesh).bind(sm.skeleton, sm.bindMatrix);
      }
      ol.position.copy(mesh.position);
      ol.quaternion.copy(mesh.quaternion);
      ol.scale.copy(mesh.scale);
      ol.frustumCulled = false;
      ol.raycast = noRaycast;
      ol.name = mesh.name + '_outline';
      mesh.parent?.add(ol);
    }
  }

  // B) nodes: bones when a skeleton exists, otherwise any named part (Head, Ear, Tail ...)
  const skeleton = skinned.length > 0 && bones.length > 0;
  const mk = (kind: 'head' | 'neck' | 'ear' | 'tail' | 'arm' | 'hair', tokens: string[], exclude?: Set<THREE.Object3D>) => {
    const o = findNodes(model, tokens, skeleton, exclude ? 12 : 1).find((x) => !exclude?.has(x));
    if (!o) return undefined;
    return {
      obj: o, bind: o.quaternion.clone(), baseScale: o.scale.clone(),
      axes: new THREE.Vector3(...(cfg.nodeAxes[kind] ?? [1, 1, 1])), gain: cfg.nodeGain[kind] ?? 1,
    } as NodeRef;
  };
  const head = mk('head', cfg.boneMap.head);
  const neck = mk('neck', cfg.boneMap.neck);
  const earL = mk('ear', cfg.boneMap.earL);
  const earR = mk('ear', cfg.boneMap.earR);
  const tail = mk('tail', cfg.boneMap.tail);
  const armL = mk('arm', cfg.boneMap.armL);
  const armR = mk('arm', cfg.boneMap.armR);
  const used = new Set<THREE.Object3D>();
  for (const n of [head, neck, earL, earR, tail, armL, armR]) if (n) used.add(n.obj);
  let hairObjs = findNodes(model, cfg.boneMap.hair, skeleton, 14).filter((o) => !used.has(o));
  // skip nodes whose ancestor is already animated (avoids double-driving nested parts)
  hairObjs = hairObjs.filter((o) => {
    let p = o.parent;
    while (p) { if (hairObjs.includes(p) || used.has(p)) return false; p = p.parent; }
    return true;
  }).slice(0, 8);
  const hair: NodeRef[] = hairObjs.map((o) => ({
    obj: o, bind: o.quaternion.clone(), baseScale: o.scale.clone(),
    axes: new THREE.Vector3(...cfg.nodeAxes.hair), gain: cfg.nodeGain.hair,
  }));

  // C) facial expression method (morph -> overlay -> effects)
  const morphs: Prepared['morphs'] = {};
  const morphNames: string[] = [];
  for (const mesh of meshes) {
    const dict = mesh.morphTargetDictionary;
    if (!dict) continue;
    for (const name of Object.keys(dict)) {
      morphNames.push(name);
      for (const [key, toks] of Object.entries(cfg.morphMap)) {
        if (toks.some((t) => norm(name).includes(norm(t)))) (morphs[key] ??= []).push({ mesh, idx: dict[name] });
      }
    }
  }
  const exprMorphs = ['happy', 'angry', 'sleepy', 'sad', 'blink'].filter((k) => morphs[k]);
  const faceMethod: Prepared['faceMethod'] = exprMorphs.length >= 2 ? 'morph' : cfg.face.enabled ? 'overlay' : 'effects';

  const faceBaseM = new THREE.Matrix4();
  const faceCenter = new THREE.Vector3(0, H * 0.78, H * 0.2);
  const mouthLocal = new THREE.Vector3();
  let overlay: THREE.Mesh | null = null;
  let faceTex: FaceTexture | null = null;
  let headBindInv: THREE.Matrix4 | null = null;
  const faceW = cfg.face.widthRatio * H;

  if (faceMethod === 'overlay') {
    faceTex = new FaceTexture();
    disposables.push(faceTex);
    const mat = new THREE.MeshBasicMaterial({
      map: faceTex.texture, transparent: true, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const geo = new THREE.PlaneGeometry(1, FACE_ASPECT);
    disposables.push(mat, geo);
    overlay = new THREE.Mesh(geo, mat);
    overlay.name = 'FaceOverlay';
    overlay.raycast = noRaycast;
    overlay.renderOrder = 5;
    overlay.visible = false;
    overlay.frustumCulled = false;
    inner.add(overlay);

    // snap the plane to the head surface by ray-casting from the front
    const nb = new THREE.Box3().setFromObject(holder); // model only (overlay not included)
    const yFace = nb.min.y + cfg.face.yRatio * (nb.max.y - nb.min.y);
    const cx = (nb.min.x + nb.max.x) / 2;
    const rc = new THREE.Raycaster(new THREE.Vector3(cx, yFace, nb.max.z + 1), new THREE.Vector3(0, 0, -1), 0, 20);
    const hit = rc.intersectObjects(meshes, false)[0];
    const normal = new THREE.Vector3(0, 0, 1);
    const pos = new THREE.Vector3(cx, yFace, nb.max.z * 0.7);
    if (hit && hit.face) {
      normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize();
      if (normal.z < 0) normal.negate();
      pos.copy(hit.point).addScaledVector(normal, cfg.face.push * H);
    }
    const look = new THREE.Matrix4().lookAt(normal, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
    const quat = new THREE.Quaternion().setFromRotationMatrix(look);
    faceBaseM.compose(pos, quat, new THREE.Vector3(faceW, faceW, 1));
    faceCenter.copy(pos);
    mouthLocal.copy(pos).add(new THREE.Vector3(0, -0.2 * faceW * FACE_ASPECT, 0));
    if (head) {
      inner.updateMatrixWorld(true);
      const headInInner = new THREE.Matrix4().copy(inner.matrixWorld).invert().multiply(head.obj.matrixWorld);
      headBindInv = headInInner.invert();
    }
  } else {
    faceCenter.set(0, H * 0.78, H * 0.18);
    mouthLocal.set(0, H * 0.72, H * 0.2);
  }

  // bath foam clumps
  const foamGeo = new THREE.SphereGeometry(1, 12, 10);
  const foamMat = new THREE.MeshBasicMaterial({ color: '#f4fbff' });
  disposables.push(foamGeo, foamMat);
  const foam = FOAM_SPOTS.map(([x, y, z]) => {
    const m = new THREE.Mesh(foamGeo, foamMat);
    m.position.set(x * H, y * H, z * H);
    m.scale.setScalar(0.0001);
    m.visible = false;
    m.raycast = noRaycast;
    inner.add(m);
    return m;
  });

  inner.updateMatrixWorld(true);

  const mapped: Record<string, string> = {};
  const named: [string, NodeRef | undefined][] = [['head', head], ['neck', neck], ['earL', earL], ['earR', earR], ['tail', tail], ['armL', armL], ['armR', armR]];
  for (const [k, n] of named) if (n) mapped[k] = n.obj.name;
  hair.forEach((h, i) => (mapped['hair' + i] = h.obj.name));
  const info: DebugInfo = {
    source: source.fallback ? 'procedural fallback (sylvia.glb missing or failed to load)' : 'sylvia.glb',
    layers: '',
    faceMethod,
    height: H,
    bones: bones.map((b) => b.name),
    meshes: meshes.map((m) => m.name || '(unnamed)'),
    morphs: morphNames,
    clips: source.clips.map((c) => c.name),
    mapped,
  };

  return {
    model, holder, inner, meshes, skinned, toonMats, skeleton, head, neck, earL, earR, tail, armL, armR, hair,
    morphs, faceMethod, overlay, faceTex, faceBaseM, headBindInv, faceCenter, mouthLocal, foam, info,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

// ------------------------------------------------------------------ component tree
class CharacterBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) {
    console.warn('[Sylvia] /models/sylvia.glb could not be loaded - using the procedural fallback.', err);
  }
  render() { return this.state.failed ? <FallbackCharacter /> : this.props.children; }
}

function GlbCharacter() {
  const gltf = useGLTF(MODEL_URL);
  const source = useMemo<Source>(
    () => ({ scene: cloneSkinned(gltf.scene), clips: gltf.animations, fallback: false }),
    [gltf]
  );
  return <CharacterBody source={source} />;
}

function FallbackCharacter() {
  const source = useMemo<Source>(() => ({ scene: buildFallbackSylvia(), clips: [], fallback: true }), []);
  return <CharacterBody source={source} />;
}

export function SylviaCharacter() {
  return (
    <CharacterBoundary>
      <Suspense fallback={null}>
        <GlbCharacter />
      </Suspense>
    </CharacterBoundary>
  );
}

// Preload only if the file really exists (in dev an SPA server answers 200 with HTML for missing files).
if (typeof window !== 'undefined') {
  fetch(MODEL_URL, { method: 'HEAD' })
    .then((r) => {
      if (r.ok && !(r.headers.get('content-type') || '').includes('text/html')) useGLTF.preload(MODEL_URL);
    })
    .catch(() => {});
}

// ------------------------------------------------------------------ character body
const DIRT = new THREE.Color('#8b6b4a');
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _qz = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _v = new THREE.Vector3();

function applyNode(n: NodeRef | undefined, ex: number, ey: number, ez: number) {
  if (!n) return;
  _e.set(ex * n.axes.x, ey * n.axes.y, ez * n.axes.z);
  _q.setFromEuler(_e);
  n.obj.quaternion.copy(n.bind).multiply(_q);
}

function pickIdle(pool: AnimName[], p: { playful: number; shy: number; sweet: number; sassy: number }): AnimName {
  const w = pool.map((a) => {
    switch (a) {
      case 'idleHop': return 0.6 + p.playful / 40;
      case 'idleLook': return 0.8 + p.shy / 50;
      case 'idleSway': return 0.8 + p.sweet / 60;
      case 'idleSit': return 0.7 + p.sassy / 70;
      default: return 1;
    }
  });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[0];
}

function clipKeyFor(a: AnimName): string | null {
  switch (a) {
    case 'walk': return 'walk';
    case 'run': return 'run';
    case 'eat': return 'eat';
    case 'sleep': return 'sleep';
    case 'cry': return 'cry';
    case 'wave': return 'wave';
    case 'happy': case 'cheer': return 'happy';
    case 'hop': return 'jump';
    case 'idleSit': return 'sit';
    case 'idleBreathe': case 'idleLook': case 'idleSway': return 'idle';
    default: return null;
  }
}

function makeState() {
  const room = useUIStore.getState().room;
  return {
    cur: newPose(), tgt: newPose(),
    x: ROOM_X[room], z: 0.3, y: 0, yaw: 0, tx: ROOM_X[room], tz: 0.3, running: false, room: '' as string, wanderT: 4,
    anim: 'idleBreathe' as AnimName, animT0: 0, idle: 'idleBreathe' as AnimName, idleUntil: 0,
    prevX: ROOM_X[room], prevPy: 0, stageS: 0.66, lastStage: '' as string,
    action: null as THREE.AnimationAction | null, clipTail: 0, hadClip: false,
    blinkUntil: 0, nextBlink: 2, lookX: 0, lookY: 0,
    emoteT: 1, smellT: 0, mood: computeMood(useGameStore.getState().needs, false), moodT: 0,
    springs: new Map<THREE.Object3D, [Spring, Spring]>(),
    wobX: new Spring(), wobZ: new Spring(), tintKey: -1, headScaleKey: -1,
  };
}

function CharacterBody({ source }: { source: Source }) {
  const quality = useGameStore((s) => s.settings.quality);
  const prep = useMemo(() => prepare(source, quality), [source, quality]);
  const mixer = useMemo(() => new THREE.AnimationMixer(prep.model), [prep]);
  const actions = useMemo(() => {
    const out: Record<string, THREE.AnimationAction> = {};
    for (const [key, toks] of Object.entries(cfg.clipMap)) {
      const clip = source.clips.find((c) => toks.some((t) => norm(c.name).includes(norm(t))));
      if (clip) out[key] = mixer.clipAction(clip);
    }
    return out;
  }, [source, mixer]);
  const S = useMemo(makeState, []);

  const rootRef = useRef<THREE.Group>(null!);
  const bodyRef = useRef<THREE.Group>(null!);
  const shadowRef = useRef<THREE.Mesh>(null!);

  const shadowTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(40,30,60,.5)');
    gr.addColorStop(1, 'rgba(40,30,60,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => shadowTex.dispose(), [shadowTex]);

  useEffect(() => {
    const layer1 = Object.keys(actions).length;
    prep.info.layers = `L1 clips mapped: ${layer1} | L2 skeleton: ${prep.skeleton ? 'yes' : 'no'} (${Object.keys(prep.info.mapped).length} nodes) | L3 whole-body: always`;
    useDebugStore.getState().set({ info: prep.info });
    if (import.meta.env.DEV) {
      console.groupCollapsed('[Sylvia] model report');
      console.log(prep.info);
      console.groupEnd();
    }
    const t = window.setTimeout(() => useUIStore.getState().setSceneReady(true), 350);
    return () => window.clearTimeout(t);
  }, [prep, actions]);

  useEffect(() => () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(prep.model);
    prep.dispose();
  }, [prep, mixer]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    if (dt <= 0) return;
    const g = state.clock.elapsedTime;
    const nowS = rig.now();
    const gs = useGameStore.getState();
    const ui = useUIStore.getState();
    const dbg = useDebugStore.getState();
    const root = rootRef.current, body = bodyRef.current, inner = prep.inner;
    const { cur, tgt } = S;

    // debug tweaks (live)
    inner.scale.setScalar(dbg.scaleMul);
    inner.position.set(dbg.ox, dbg.oy, dbg.oz);
    inner.rotation.y = cfg.yawOffset + dbg.yaw;

    // mood (4 Hz)
    S.moodT -= dt;
    if (S.moodT <= 0) { S.moodT = 0.25; S.mood = computeMood(gs.needs, gs.sleeping); }
    const mood = S.mood;

    // growth stage
    const stage = stageForLevel(gs.level);
    if (S.lastStage && S.lastStage !== stage) {
      fx.emit('sparkle', rig.faceWorld, 30, { speed: 2.2 });
      fx.emit('star', rig.faceWorld, 10);
      rig.play('cheer', 2.5);
      audio.levelUp();
    }
    S.lastStage = stage;
    S.stageS = damp(S.stageS, cfg.stageScale[stage], 3, dt);
    const stageS = S.stageS;
    const cheat = 1 - stageS; // baby: bigger head, rounder body
    if (prep.head) {
      const key = Math.round(cheat * 1000);
      if (key !== S.headScaleKey) {
        S.headScaleKey = key;
        prep.head.obj.scale.copy(prep.head.baseScale).multiplyScalar(1 + cheat * 0.35);
      }
    }

    // ------------------------------------------------------------ movement
    const lock = rig.lock;
    const free = !lock && !rig.base && !(rig.override && rig.override.until > nowS);
    if (!lock) {
      const home = ROOM_X[ui.room];
      if (S.room !== ui.room) {
        S.room = ui.room;
        S.running = true;
        S.tx = home + (Math.random() - 0.5) * 0.8;
        S.tz = 0.3;
        S.wanderT = 3;
      }
    }
    let tx = S.tx, tz = S.tz, ty = 0;
    if (lock) { tx = lock.x; tz = lock.z; ty = lock.y; }
    let dx = tx - S.x, dz = tz - S.z;
    let dist = Math.hypot(dx, dz);
    if (!lock && free && dist < 0.06) {
      S.wanderT -= dt;
      if (S.wanderT <= 0) {
        const half = Math.max(0.6, Math.min(1.8, rig.viewHalfW - 0.7));
        S.tx = ROOM_X[ui.room] + (Math.random() * 2 - 1) * half;
        S.tz = -0.3 + Math.random() * 1.2;
        S.wanderT = 5 + Math.random() * 6;
        S.running = false;
        dx = S.tx - S.x; dz = S.tz - S.z; dist = Math.hypot(dx, dz);
        tx = S.tx; tz = S.tz;
      }
    }
    const moving = dist > 0.06;
    const runNow = dist > 2.5 || S.running;
    if (moving) {
      // long trips (changing room) are fast so she arrives with the camera
      const sp = runNow ? (dist > 6 ? Math.max(4.6, dist * 1.3) : 4.6) : lock ? 2 : 0.95;
      const step = Math.min(dist, sp * dt);
      S.x += (dx / dist) * step;
      S.z += (dz / dist) * step;
      S.yaw = dampAngle(S.yaw, Math.atan2(dx, dz), 10, dt);
    } else {
      S.running = false;
      S.yaw = dampAngle(S.yaw, lock ? lock.yaw : 0, 6, dt);
    }
    S.y = damp(S.y, ty, 8, dt);
    const vx = (S.x - S.prevX) / dt;
    S.prevX = S.x;
    root.position.set(S.x, S.y, S.z);
    root.rotation.y = S.yaw;

    // ------------------------------------------------------------ animation state
    let anim: AnimName;
    const ov = rig.override && rig.override.until > nowS ? rig.override : null;
    if (!ov) rig.override = null;
    if (ov) anim = ov.anim;
    else if (moving) anim = runNow ? 'run' : 'walk';
    else if (rig.base) anim = rig.base;
    else {
      if (nowS > S.idleUntil) {
        const pool: AnimName[] = mood.sick ? ['sick']
          : mood.expression === 'sad' ? ['cry', 'idleSit', 'idleBreathe']
          : mood.expression === 'sleepy' ? ['idleYawn', 'idleSit', 'idleBreathe']
          : IDLE_VARIANTS;
        S.idle = pickIdle(pool, gs.personality);
        S.idleUntil = nowS + (IDLE_DUR[S.idle] ?? 3.5);
        S.anim = '' as AnimName; // force restart of the variant timer
        if (S.idle === 'idleYawn') { rig.express('sleepy', 1.8); audio.yawn(); }
      }
      anim = S.idle;
    }
    if (anim !== S.anim) { S.anim = anim; S.animT0 = g; }

    // Layer 1: clips (only when the model has a clip for this state)
    const key = clipKeyFor(anim);
    const want = key ? actions[key] : undefined;
    if (want !== (S.action ?? undefined)) {
      if (want) { want.reset().fadeIn(0.25).play(); S.hadClip = true; }
      if (S.action) S.action.fadeOut(0.25);
      S.action = want ?? null;
      if (!want) S.clipTail = g + 0.3;
    }
    const clipMode = !!S.action;
    if (S.action || g < S.clipTail) mixer.update(dt);
    else if (S.hadClip) {
      mixer.stopAllAction();
      for (const sm of prep.skinned) sm.skeleton.pose();
      S.hadClip = false;
    }

    // Layer 2/3: procedural pose
    resetPose(tgt);
    if (!clipMode) POSES[anim](tgt, g - S.animT0, g);
    const k = 1 - Math.exp(-tgt.rate * dt);
    for (const f of ['y', 'sx', 'sy', 'sz', 'rx', 'ry', 'rz', 'hx', 'hy', 'hz', 'earL', 'earR', 'tail', 'tailUp', 'arm', 'mouth'] as const) {
      cur[f] += (tgt[f] - cur[f]) * k;
    }
    // breathing (always on, deeper while asleep)
    const breath = Math.sin(g * (gs.sleeping ? 1.3 : 2.3)) * (gs.sleeping ? 0.02 : 0.01);
    const bodyVy = (cur.y * H - S.prevPy) / dt;
    S.prevPy = cur.y * H;

    // whole-body wobble spring (follow-through when starting/stopping/landing)
    const wobZ = S.wobZ.step(-vx * 0.03, 70, 6, dt);
    const wobX = S.wobX.step(-bodyVy * 0.015, 70, 6, dt);

    const propX = 1 + cheat * 0.16, propY = 1 - cheat * 0.06;
    const headFallback = prep.head ? 0 : 0.3;
    body.position.y = cur.y * H;
    body.scale.set(stageS * cur.sx * (prep.head ? 1 : propX), stageS * cur.sy * (prep.head ? 1 : propY) * (1 + breath), stageS * cur.sz);
    body.rotation.set(
      cur.rx + wobX + cur.hx * headFallback,
      cur.ry + cur.hy * headFallback,
      cur.rz + wobZ + cur.hz * headFallback,
      'YXZ'
    );

    // bones / parts (skipped while a clip drives the skeleton)
    if (!clipMode && g >= S.clipTail) {
      const gain = cfg.nodeGain;
      applyNode(prep.head, cur.hx * gain.head, cur.hy * gain.head, cur.hz * gain.head);
      applyNode(prep.neck, cur.hx * gain.neck, cur.hy * gain.neck, cur.hz * gain.neck);
      const spr = (o: THREE.Object3D) => {
        let s = S.springs.get(o);
        if (!s) { s = [new Spring(), new Spring()]; S.springs.set(o, s); }
        return s;
      };
      const drag = -vx * 0.06;
      if (prep.earL) {
        const [a, b] = spr(prep.earL.obj);
        applyNode(prep.earL, 0, 0, a.step(cur.earL + drag * 0.5, 110, 7, dt) * prep.earL.gain + b.step(-bodyVy * 0.03, 90, 6, dt) * 0.5);
      }
      if (prep.earR) {
        const [a, b] = spr(prep.earR.obj);
        applyNode(prep.earR, 0, 0, -(a.step(cur.earR - drag * 0.5, 110, 7, dt) * prep.earR.gain + b.step(-bodyVy * 0.03, 90, 6, dt) * 0.5));
      }
      if (prep.tail) {
        const [a, b] = spr(prep.tail.obj);
        applyNode(prep.tail, 0, a.step(cur.tail + drag, 60, 4.5, dt) * prep.tail.gain, b.step(cur.tailUp - bodyVy * 0.02, 60, 5, dt) * prep.tail.gain);
      }
      if (prep.armL) applyNode(prep.armL, 0, 0, cur.arm * gain.arm);
      if (prep.armR) applyNode(prep.armR, 0, 0, -cur.arm * gain.arm);
      prep.hair.forEach((h, i) => {
        const [a, b] = spr(h.obj);
        const kk = 1 + i * 0.1;
        const side = a.step(drag + cur.hz * 0.5, 55 * kk, 5, dt);
        const vert = b.step(-bodyVy * 0.03, 50 * kk, 5, dt);
        applyNode(h, vert * h.gain, 0, side * h.gain);
      });
    }

    // ------------------------------------------------------------ expression
    let expr: Expression;
    if (dbg.forceExpr !== 'auto') expr = dbg.forceExpr as Expression;
    else if (rig.expr && rig.expr.until > nowS) expr = rig.expr.expr;
    else expr = mood.expression;
    if (g > S.nextBlink) { S.blinkUntil = g + 0.13; S.nextBlink = g + 2 + Math.random() * 3.5; }
    const blinking = g < S.blinkUntil;
    const mouth = Math.max(cur.mouth, rig.mouthOpen);

    if (prep.faceMethod === 'overlay' && prep.overlay && prep.faceTex) {
      const ov = prep.overlay;
      inner.updateWorldMatrix(true, false);
      if (prep.head && prep.headBindInv) {
        prep.head.obj.updateWorldMatrix(true, false);
        _inv.copy(inner.matrixWorld).invert();
        _m.multiplyMatrices(_inv, prep.head.obj.matrixWorld).multiply(prep.headBindInv).multiply(prep.faceBaseM);
      } else _m.copy(prep.faceBaseM);
      _m.decompose(ov.position, ov.quaternion, ov.scale);
      ov.position.x += dbg.fx * H; ov.position.y += dbg.fy * H; ov.position.z += dbg.fz * H;
      ov.scale.multiplyScalar(dbg.fscale);
      ov.quaternion.multiply(_qz.setFromAxisAngle(_zAxis, dbg.frot));

      const showOnNormal = dbg.showOnNormal ?? cfg.face.showOnNormal;
      const mask = dbg.mask ?? cfg.face.mask;
      const show = showOnNormal || expr !== 'normal';
      ov.visible = show;
      if (show) {
        // pointer-following eyes, quantised so the canvas only redraws when it matters
        S.lookX = damp(S.lookX, clamp(state.pointer.x * 1.5, -1, 1), 6, dt);
        S.lookY = damp(S.lookY, clamp(state.pointer.y * 1.5, -1, 1), 6, dt);
        prep.faceTex.update({
          expr, blink: blinking, mouth: Math.round(mouth * 3) / 3, mask,
          lookX: Math.round(S.lookX * 2) / 2, lookY: Math.round(S.lookY * 2) / 2,
          spin: Math.floor(g * 8) % 16,
        });
      }
    } else if (prep.faceMethod === 'morph') {
      const exprKey = expr === 'happy' || expr === 'laughing' || expr === 'eating' ? 'happy'
        : expr === 'angry' ? 'angry' : expr === 'sleepy' ? 'sleepy' : expr === 'sad' ? 'sad' : null;
      for (const kk of ['happy', 'angry', 'sleepy', 'sad', 'blink', 'mouth']) {
        const list = prep.morphs[kk];
        if (!list) continue;
        const target = kk === 'blink' ? (blinking ? 1 : 0) : kk === 'mouth' ? mouth : kk === exprKey ? 1 : 0;
        for (const { mesh, idx } of list) {
          const inf = mesh.morphTargetInfluences;
          if (inf) inf[idx] += (target - inf[idx]) * Math.min(1, dt * 14);
        }
      }
    }

    // ------------------------------------------------------------ world anchors (for VFX + UI)
    _v.copy(prep.faceCenter);
    inner.localToWorld(_v);
    rig.faceWorld.copy(_v);
    _v.copy(prep.mouthLocal);
    inner.localToWorld(_v);
    rig.mouthWorld.copy(_v);
    const w = state.size.width, h = state.size.height;
    _v.copy(rig.mouthWorld).project(state.camera);
    rig.screen.mouth.x = (_v.x * 0.5 + 0.5) * w;
    rig.screen.mouth.y = (-_v.y * 0.5 + 0.5) * h;
    _v.copy(rig.faceWorld).y += 0.5 * H * stageS;
    _v.project(state.camera);
    rig.screen.head.x = (_v.x * 0.5 + 0.5) * w;
    rig.screen.head.y = (-_v.y * 0.5 + 0.5) * h;
    rig.screen.on = _v.z < 1;

    // ------------------------------------------------------------ emotes (sprites above the head)
    S.emoteT -= dt;
    if (S.emoteT <= 0) {
      const top = _v.copy(rig.faceWorld);
      top.y += 0.42 * H * stageS;
      const effectsOnly = prep.faceMethod === 'effects';
      switch (expr) {
        case 'happy': case 'laughing': fx.emit('heart', top, 1); S.emoteT = effectsOnly ? 0.9 : 2.4; break;
        case 'angry': fx.emit('anger', { x: top.x + 0.2, y: top.y, z: top.z + 0.1 }, 1); S.emoteT = 1.2; break;
        case 'sad': fx.emit('drop', rig.faceWorld, 1); S.emoteT = 0.9; break;
        case 'sleepy': if (gs.sleeping || effectsOnly) fx.emit('zzz', { x: top.x + 0.15, y: top.y, z: top.z }, 1); S.emoteT = 1.4; break;
        case 'dizzy': fx.emit('star', top, 1); S.emoteT = 0.35; break;
        case 'embarrassed': fx.emit('drop', top, 1); S.emoteT = 1.1; break;
        default: S.emoteT = 0.4;
      }
    }
    S.smellT -= dt;
    if (S.smellT <= 0) {
      S.smellT = 0.9;
      if (gs.needs.hygiene < 25 && !gs.sleeping) fx.emit('smell', { x: root.position.x + 0.25, y: 0.6 * H * stageS, z: root.position.z + 0.1 }, 1);
    }

    // ------------------------------------------------------------ dirt / wetness tint + bath foam
    const dirt = 1 - gs.needs.hygiene / 100;
    const tintKey = Math.round(dirt * 20) * 100 + Math.round(bath.wet * 20);
    if (tintKey !== S.tintKey) {
      S.tintKey = tintKey;
      for (const m of prep.toonMats) {
        m.color.copy(m.userData.base as THREE.Color).lerp(DIRT, dirt * 0.5).multiplyScalar(1 - 0.18 * bath.wet);
      }
    }
    const foamOn = bath.foam > 0.02;
    for (let i = 0; i < prep.foam.length; i++) {
      const f = prep.foam[i];
      f.visible = foamOn;
      if (foamOn) f.scale.setScalar(bath.foam * FOAM_SPOTS[i][3] * H * (0.7 + 0.3 * Math.sin(g * 2 + i)));
    }

    // ------------------------------------------------------------ blob shadow
    const sh = shadowRef.current;
    const sc = 0.62 * stageS * H * (1 - Math.min(0.45, cur.y * 1.2)) * (anim === 'sleep' ? 1.5 : 1);
    sh.scale.set(sc * (anim === 'sleep' ? 1.6 : 1), sc, 1);
  });

  return (
    <group
      ref={rootRef}
      onPointerDown={(e) => { e.stopPropagation(); pointerDown(e, bodyRef.current); }}
      onPointerMove={(e) => pointerMove(e)}
    >
      <mesh ref={shadowRef} rotation-x={-Math.PI / 2} position-y={0.012} raycast={noRaycast} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={bodyRef}>
        <primitive object={prep.inner} />
      </group>
    </group>
  );
}
