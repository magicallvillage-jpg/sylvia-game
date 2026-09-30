import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { classifyRegion, modelConfig as cfg, type Region } from '../config/modelConfig';
import { rig } from './rig';
import { fx } from './fx';
import { audio, haptic } from '../audio/AudioManager';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { scrub, towel, hugHer } from './activities';

const H = cfg.targetHeight;
const _p = new THREE.Vector3();

/** Pointer-gesture state machine (all Pointer Events: tap, double-tap, long-press, stroke). */
const G = {
  down: false, pid: -1, t0: 0, lx: 0, ly: 0, moved: 0,
  region: 'body' as Region, hugged: false, lp: 0,
  lastTapT: 0, lastTapX: 0, lastTapY: 0, x0: 0, y0: 0,
  strokeAcc: 0, lastHeart: 0, strokeXp: 0,
  purrUntil: 0, purrTimer: 0,
  pokes: [] as number[],
  hitPoint: new THREE.Vector3(),
};

function purrFor(seconds: number) {
  G.purrUntil = Math.max(G.purrUntil, rig.now() + seconds);
  audio.purrStart();
  if (!G.purrTimer) {
    G.purrTimer = window.setInterval(() => {
      if (rig.now() > G.purrUntil) {
        audio.purrStop();
        window.clearInterval(G.purrTimer);
        G.purrTimer = 0;
      }
    }, 250);
  }
}

export function pointerDown(e: ThreeEvent<PointerEvent>, body: THREE.Object3D) {
  audio.unlock();
  const ui = useUIStore.getState(), gs = useGameStore.getState();
  G.down = true;
  G.pid = e.pointerId;
  G.t0 = performance.now();
  G.x0 = G.lx = e.nativeEvent.clientX;
  G.y0 = G.ly = e.nativeEvent.clientY;
  G.moved = 0;
  G.hugged = false;
  G.hitPoint.copy(e.point);
  body.worldToLocal(_p.copy(e.point));
  G.region = classifyRegion(_p.x / H, _p.y / H, _p.z / H);
  window.clearTimeout(G.lp);
  if (ui.bathMode || gs.sleeping) return;
  G.lp = window.setTimeout(() => {
    if (G.down && G.moved < 12) { G.hugged = true; hugHer(); }
  }, 550);
}

export function pointerMove(e: ThreeEvent<PointerEvent>) {
  if (!G.down || e.pointerId !== G.pid) return;
  const nx = e.nativeEvent.clientX, ny = e.nativeEvent.clientY;
  const d = Math.hypot(nx - G.lx, ny - G.ly);
  G.lx = nx;
  G.ly = ny;
  G.moved += d;
  G.hitPoint.copy(e.point);
  const ui = useUIStore.getState(), gs = useGameStore.getState();
  if (ui.bathMode) {
    if (ui.bathTool === 'sponge') scrub(d, G.hitPoint);
    else if (ui.bathTool === 'towel') towel(d, G.hitPoint);
    return;
  }
  if (gs.sleeping) return;
  if (G.moved > 24) {
    window.clearTimeout(G.lp);
    stroke(d);
  }
}

function stroke(px: number) {
  const gs = useGameStore.getState();
  const t = rig.now();
  rig.play('petted', 0.5);
  rig.express('happy', 0.9);
  purrFor(0.9);
  if (t - G.lastHeart > 0.45) {
    G.lastHeart = t;
    fx.emit('heart', rig.faceWorld, 1);
    if (G.region === 'ear') fx.emit('sparkle', rig.faceWorld, 2);
    haptic(5);
  }
  G.strokeAcc += px;
  if (G.strokeAcc > 120) {
    G.strokeAcc = 0;
    gs.bump('affection', 3);
    gs.bump('happiness', 1.5);
    gs.nudge('sweet', 0.4);
    gs.nudge('shy', -0.1);
    gs.stat('pets');
    if (++G.strokeXp % 4 === 0) gs.addXp(1);
  }
}

function tap() {
  const gs = useGameStore.getState();
  const t = rig.now();
  const near = Math.hypot(G.x0 - G.lastTapX, G.y0 - G.lastTapY) < 50;
  if (t - G.lastTapT < 0.32 && near) {
    G.lastTapT = 0;
    rig.play('hop', 0.75);
    rig.express('happy', 1);
    audio.chirp();
    fx.emit('sparkle', rig.faceWorld, 6);
    gs.addXp(1);
    return;
  }
  G.lastTapT = t;
  G.lastTapX = G.x0;
  G.lastTapY = G.y0;

  switch (G.region) {
    case 'ear':
      rig.play('petted', 0.8); rig.express('happy', 1); audio.meow(1.3); fx.emit('sparkle', rig.faceWorld, 3); gs.bump('affection', 0.5); break;
    case 'tail':
      rig.play('startle', 0.6); rig.express('surprised', 0.8); audio.boop(); gs.nudge('sassy', 0.2); break;
    case 'head':
    case 'cheek':
      rig.play('startle', 0.5);
      if (gs.personality.shy > gs.personality.playful) { rig.express('embarrassed', 1.2); fx.emit('drop', rig.faceWorld, 1); }
      else { rig.express('happy', 1); fx.emit('heart', rig.faceWorld, 1); }
      audio.chirp();
      break;
    default:
      rig.play('startle', 0.5); rig.express('surprised', 0.7); audio.boop();
  }
  haptic(8);

  // too many pokes in a row -> comedic grumpiness (forgiven after a hug)
  G.pokes = G.pokes.filter((p) => t - p < 3);
  G.pokes.push(t);
  if (G.pokes.length >= 5) {
    G.pokes = [];
    rig.express('angry', 2.4);
    rig.play('sulk', 2.4);
    audio.hmph();
    fx.emit('anger', { x: rig.faceWorld.x + 0.2, y: rig.faceWorld.y + 0.4, z: rig.faceWorld.z }, 1);
    gs.nudge('sassy', 0.8);
    gs.nudge('playful', 0.3);
  }
}

function end() {
  if (!G.down) return;
  G.down = false;
  window.clearTimeout(G.lp);
  const ui = useUIStore.getState(), gs = useGameStore.getState();
  if (ui.bathMode || gs.sleeping) return;
  if (!G.hugged && G.moved < 12 && performance.now() - G.t0 < 450) tap();
  G.hugged = false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  window.addEventListener('blur', () => { G.down = false; audio.purrStop(); });
}
