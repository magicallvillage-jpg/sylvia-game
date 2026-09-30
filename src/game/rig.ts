import * as THREE from 'three';
import type { Expression } from '../store/gameStore';

export type AnimName =
  | 'idleBreathe' | 'idleLook' | 'idleSway' | 'idleStretch' | 'idleYawn' | 'idleWash' | 'idleSit' | 'idleHop'
  | 'walk' | 'run' | 'eat' | 'happy' | 'cheer' | 'wave' | 'cry' | 'sulk' | 'sleep' | 'petted' | 'dizzy'
  | 'bathe' | 'shake' | 'hop' | 'startle' | 'sick' | 'embarrassed' | 'hug' | 'squirm';

export const IDLE_VARIANTS: AnimName[] = [
  'idleBreathe', 'idleLook', 'idleSway', 'idleStretch', 'idleYawn', 'idleWash', 'idleSit', 'idleHop',
];
export const IDLE_DUR: Partial<Record<AnimName, number>> = {
  idleBreathe: 3.5, idleLook: 3.6, idleSway: 3.2, idleStretch: 2.6, idleYawn: 2.2, idleWash: 3.4, idleSit: 5, idleHop: 1.4,
};

/** A pose is a set of offsets applied on top of the model's rest pose. All values are damped toward the target. */
export interface Pose {
  y: number; // vertical offset, fraction of model height
  sx: number; sy: number; sz: number; // scale multipliers (volume-preserving via sq())
  rx: number; ry: number; rz: number; // whole-body rotation (rad)
  hx: number; hy: number; hz: number; // head rotation (rad)
  earL: number; earR: number; // ear flick (rad)
  tail: number; tailUp: number; // tail sway / lift (rad)
  arm: number; // arm raise 0..1
  mouth: number; // mouth open 0..1
  rate: number; // blend speed toward this pose
}

export const newPose = (): Pose => ({
  y: 0, sx: 1, sy: 1, sz: 1, rx: 0, ry: 0, rz: 0, hx: 0, hy: 0, hz: 0,
  earL: 0, earR: 0, tail: 0, tailUp: 0, arm: 0, mouth: 0, rate: 11,
});
export function resetPose(p: Pose) {
  p.y = 0; p.sx = p.sy = p.sz = 1; p.rx = p.ry = p.rz = 0; p.hx = p.hy = p.hz = 0;
  p.earL = p.earR = 0; p.tail = p.tailUp = 0; p.arm = 0; p.mouth = 0; p.rate = 11;
}

const S = Math.sin, C = Math.cos, PI = Math.PI;
/** Squash & stretch with volume preservation: a > 0 stretches tall, a < 0 squashes flat. */
const sq = (p: Pose, a: number) => {
  p.sy *= 1 + a;
  const k = 1 / Math.sqrt(1 + a);
  p.sx *= k; p.sz *= k;
};
const env = (t: number, dur: number) => S(PI * Math.min(1, Math.max(0, t / dur)));

/** Hop cycle with anticipation squash before take-off and after landing. */
function hop(p: Pose, ph: number, height: number) {
  const u = ph % 1;
  p.y = 4 * u * (1 - u) * height;
  if (u < 0.14 || u > 0.9) sq(p, -0.13);
  else sq(p, 0.07);
}

type PoseFn = (p: Pose, t: number, g: number) => void;

export const POSES: Record<AnimName, PoseFn> = {
  idleBreathe: (p, t, g) => {
    sq(p, S(g * 2.2) * 0.012);
    p.tail = S(g * 1.3) * 0.25; p.earL = S(g * 0.9) * 0.05; p.earR = S(g * 0.9 + 1) * 0.05;
    p.hz = S(g * 0.7) * 0.03;
  },
  idleLook: (p, t) => {
    p.hy = S(t * 1.1) * 0.55; p.hz = S(t * 0.8) * 0.08; p.ry = S(t * 1.1) * 0.12;
    p.earL = Math.max(0, S(t * 6)) * 0.3; p.earR = Math.max(0, S(t * 5 + 1)) * 0.25; p.tail = S(t * 2) * 0.3;
  },
  idleSway: (p, t) => {
    p.rz = S(t * 2) * 0.05; p.y = Math.abs(S(t * 2)) * 0.01; p.tail = S(t * 3) * 0.55;
    p.hz = S(t * 2 + 1) * 0.1; p.earL = S(t * 4) * 0.12; p.earR = -S(t * 4) * 0.12;
  },
  idleStretch: (p, t) => {
    const e = env(t, 2.4);
    sq(p, 0.1 * e - (t < 0.4 ? 0.05 * (1 - t / 0.4) : 0));
    p.hx = -0.3 * e; p.arm = e; p.tailUp = 0.5 * e; p.earL = p.earR = -0.2 * e;
  },
  idleYawn: (p, t) => {
    const e = env(t, 2);
    p.hx = -0.25 * e; p.mouth = e; p.earL = p.earR = -0.3 * e; sq(p, 0.03 * e);
  },
  idleWash: (p, t) => {
    const e = env(t, 3.2);
    p.arm = e; p.hx = 0.25 * e; p.hz = S(t * 9) * 0.12 * e; p.ry = S(t * 4.5) * 0.05 * e;
    sq(p, -0.04 * e); p.tail = S(t * 2) * 0.3;
  },
  idleSit: (p, t, g) => {
    p.sy = 0.86; p.sx = p.sz = 1.05; p.y = -0.01;
    p.tail = S(g * 1.6) * 0.5; p.hz = S(g * 0.8) * 0.08; p.hy = S(g * 0.5) * 0.2;
    p.earL = Math.max(0, S(g * 3)) * 0.2;
  },
  idleHop: (p, t) => {
    hop(p, t * 2.6, 0.2);
    p.earL = p.earR = 0.3; p.arm = 0.4; p.tail = S(t * 12) * 0.5; p.rate = 18;
  },

  walk: (p, t, g) => {
    p.y = Math.abs(S(g * 9)) * 0.035; p.rz = S(g * 9) * 0.06; p.rx = 0.05;
    p.tail = S(g * 9) * 0.5; p.earL = S(g * 9 + 1) * 0.15; p.earR = S(g * 9 + 2) * 0.15;
    p.hz = S(g * 9) * 0.05; p.arm = 0.25 + S(g * 9) * 0.2; p.rate = 14;
  },
  run: (p, t, g) => {
    p.y = Math.abs(S(g * 14)) * 0.08; p.rz = S(g * 14) * 0.08; p.rx = 0.16;
    p.tail = S(g * 14) * 0.7; p.tailUp = 0.4; p.earL = p.earR = -0.35; p.arm = 0.5 + S(g * 14) * 0.3;
    sq(p, S(g * 28) * 0.02); p.rate = 16;
  },
  eat: (p, t, g) => {
    const ch = S(g * 14);
    sq(p, ch * 0.025); p.hx = 0.15 + ch * 0.08; p.mouth = 0.5 + 0.5 * ch;
    p.earL = S(g * 7) * 0.12; p.earR = S(g * 7 + 1) * 0.12; p.tail = S(g * 3) * 0.4; p.rate = 16;
  },
  happy: (p, t, g) => {
    p.y = Math.abs(S(g * 6)) * 0.08; p.rz = S(g * 6) * 0.06; p.earL = p.earR = 0.3;
    p.tail = S(g * 12) * 0.7; p.hz = S(g * 6) * 0.1; p.arm = 0.4; p.rate = 14;
  },
  cheer: (p, t, g) => {
    hop(p, g * 2.1, 0.22); p.arm = 1; p.earL = p.earR = 0.4; p.tail = S(g * 14) * 0.7; p.tailUp = 0.6; p.rate = 18;
  },
  wave: (p, t, g) => {
    p.arm = 1; p.hz = S(g * 8) * 0.1; p.earL = p.earR = 0.2; p.tail = S(g * 4) * 0.5; sq(p, 0.02);
  },
  cry: (p, t, g) => {
    p.hx = 0.35; p.hz = S(g * 3) * 0.05; p.earL = p.earR = -0.45; p.tail = -0.3;
    p.rz = S(g * 18) * 0.012; sq(p, S(g * 20) * 0.01 - 0.03);
  },
  sulk: (p, t, g) => {
    p.sy = 0.85; p.sx = p.sz = 1.05; p.ry = 2.5; p.earL = p.earR = -0.3; p.tail = S(g * 3) * 0.4; p.hx = 0.15;
  },
  sleep: (p, t, g) => {
    p.rz = 1.38; p.y = 0.09; sq(p, S(g * 1.3) * 0.02); p.tail = 0.5 + S(g * 0.8) * 0.1;
    p.earL = p.earR = -0.2; p.hx = 0.1; p.rate = 5;
  },
  petted: (p, t, g) => {
    sq(p, S(g * 10) * 0.02 - 0.02); p.hz = S(g * 3) * 0.15; p.earL = S(g * 12) * 0.25; p.earR = S(g * 12 + 2) * 0.25;
    p.tail = S(g * 8) * 0.6; p.hx = 0.05; p.rz = S(g * 3) * 0.03; p.rate = 14;
  },
  dizzy: (p, t, g) => {
    p.rx = S(g * 3) * 0.12; p.rz = C(g * 3) * 0.12; p.hz = S(g * 5) * 0.3; p.earL = S(g * 5) * 0.3; p.earR = -S(g * 5) * 0.3;
  },
  bathe: (p, t, g) => {
    p.hz = S(g * 4) * 0.1; sq(p, S(g * 2) * 0.01 - 0.03); p.arm = 0.3 + S(g * 3) * 0.1; p.earL = p.earR = -0.1;
  },
  shake: (p, t, g) => {
    const e = Math.max(0, 1 - t / 1.2);
    p.ry = S(g * 40) * 0.5 * e; p.earL = S(g * 40) * 0.6 * e; p.earR = -S(g * 40) * 0.6 * e; p.tail = S(g * 40) * 0.9 * e;
    p.sx = p.sz = 1 + 0.14 * e; p.rate = 40;
  },
  hop: (p, t) => {
    const u = Math.min(1, t / 0.7);
    p.y = 4 * u * (1 - u) * 0.5;
    if (u < 0.15 || u > 0.92) sq(p, -0.14); else sq(p, 0.1);
    p.earL = p.earR = 0.4; p.arm = 0.8; p.rate = 20;
  },
  startle: (p, t) => {
    const e = Math.max(0, 1 - t / 0.5);
    sq(p, 0.12 * e); p.y = 0.06 * e; p.hx = -0.2 * e; p.earL = p.earR = 0.5 * e; p.tail = 0.8 * e; p.rate = 22;
  },
  sick: (p, t, g) => {
    p.rx = 0.08; p.hx = 0.3; sq(p, S(g * 3) * 0.01 - 0.06); p.hz = S(g * 1.5) * 0.08; p.tail = -0.4; p.earL = p.earR = -0.35;
  },
  embarrassed: (p, t, g) => {
    p.rz = S(g * 10) * 0.03; p.hz = 0.25; p.hx = 0.25; p.earL = p.earR = -0.35; sq(p, -0.04); p.tail = S(g * 6) * 0.3;
  },
  hug: (p, t, g) => {
    p.sx = p.sz = 1.07; p.arm = 1; p.hz = S(g * 2) * 0.12; sq(p, S(g * 2.6) * 0.02 - 0.03);
    p.earL = p.earR = 0.1; p.tail = S(g * 7) * 0.6;
  },
  squirm: (p, t, g) => {
    p.rz = S(g * 18) * 0.06; sq(p, S(g * 22) * 0.02); p.y = Math.abs(S(g * 11)) * 0.03; p.tail = S(g * 16) * 0.5; p.rate = 20;
  },
};

// ---------------------------------------------------------------------------
// The rig is the tiny shared "remote control" between UI / game logic and the
// character. It is plain mutable data (never React state): the character reads
// it inside useFrame.
// ---------------------------------------------------------------------------
export interface Lock { x: number; z: number; y: number; yaw: number }

const now = () => performance.now() / 1000;

export const rig = {
  override: null as null | { anim: AnimName; until: number },
  expr: null as null | { expr: Expression; until: number },
  base: null as AnimName | null,
  lock: null as Lock | null,
  /** External mouth openness (talking / lip-sync), 0..1. */
  mouthOpen: 0,
  /** Half width of the visible play area (world units), set by the camera rig. */
  viewHalfW: 2,

  faceWorld: new THREE.Vector3(0, 1.2, 0),
  mouthWorld: new THREE.Vector3(0, 1.1, 0),
  screen: { mouth: { x: -999, y: -999 }, head: { x: -999, y: -999 }, on: false },

  play(anim: AnimName, seconds: number) { rig.override = { anim, until: now() + seconds }; },
  stop() { rig.override = null; },
  express(expr: Expression, seconds: number) { rig.expr = { expr, until: now() + seconds }; },
  setBase(a: AnimName | null) { rig.base = a; },
  lockAt(x: number, z: number, y = 0, yaw = 0) { rig.lock = { x, z, y, yaw }; },
  unlock() { rig.lock = null; },
  busy() { return !!rig.override && rig.override.until > now(); },
  now,
};
