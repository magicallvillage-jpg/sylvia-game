import * as THREE from 'three';
import { rig } from './rig';
import { fx } from './fx';
import { audio, haptic } from '../audio/AudioManager';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { foodById, type Food } from '../data/foods';
import { tr } from '../i18n';
import { ROOM_X, LOCKS, SHOWER } from './layout';

// ---------------------------------------------------------------- timers (cancellable)
const timers = new Set<number>();
const later = (fn: () => void, ms: number) => {
  const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
};

const busy = { eating: false, toilet: false, bath: false, playAt: 0, hugAt: 0 };

// ---------------------------------------------------------------- food flight (emoji sprite flying to the mouth)
export interface Flight { emoji: string; tex: THREE.Texture; t: number; from: THREE.Vector3; done: () => void }
export const flights: Flight[] = [];
const emojiCache = new Map<string, THREE.CanvasTexture>();
export function emojiTexture(e: string): THREE.CanvasTexture {
  let t = emojiCache.get(e);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(e, 64, 72);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    emojiCache.set(e, t);
  }
  return t;
}

// ---------------------------------------------------------------- feeding
export function serveFood(id: string) {
  const gs = useGameStore.getState(), ui = useUIStore.getState();
  const food = foodById(id);
  if (!food) return;
  if (gs.sleeping) { ui.showToast(tr('toast.sleeping')); return; }
  if (gs.level < food.unlock) { ui.showToast(tr('toast.locked', { n: food.unlock })); return; }
  if (busy.eating) return;
  busy.eating = true;
  ui.setFoodOpen(false);
  audio.unlock();
  audio.click();
  haptic(10);
  const from = rig.mouthWorld.clone().add(new THREE.Vector3(0, -1.5, 1.8));
  flights.push({
    emoji: food.emoji, tex: emojiTexture(food.emoji), t: 0, from,
    done: () => {
      rig.stop();
      rig.play('eat', 1.9);
      rig.express('eating', 1.9);
      for (let i = 0; i < 4; i++) {
        later(() => {
          if (food.drink) audio.pop(); else { audio.chew(); fx.emit('crumb', rig.mouthWorld, 3); }
        }, 200 + i * 400);
      }
      later(() => finishEat(food), 1900);
    },
  });
}

function finishEat(food: Food) {
  const ui = useUIStore.getState();
  const r = useGameStore.getState().feed(food.id);
  busy.eating = false;
  const face = rig.faceWorld;
  switch (r.reaction) {
    case 'love':
      rig.express('laughing', 2); rig.play('cheer', 1.6); audio.giggle(); haptic([10, 30, 10]);
      fx.emit('heart', face, 4); ui.showToast(tr('toast.love')); break;
    case 'dislike':
      rig.express('sad', 1.8); rig.play('cry', 1.4); audio.bleh(); fx.emit('drop', face, 3); ui.showToast(tr('toast.yuck')); break;
    case 'full':
      rig.express('embarrassed', 2.4); rig.play('embarrassed', 2.4); later(() => { audio.burp(); fx.emit('sparkle', rig.mouthWorld, 5); }, 500);
      fx.emit('drop', face, 2); ui.showToast(tr('toast.full')); break;
    default:
      rig.express('happy', 1.6); rig.play('happy', 1.3); audio.yum(); fx.emit('heart', face, 1); ui.showToast(tr('toast.yum'));
  }
  if (useGameStore.getState().needs.hunger > 96 && r.reaction !== 'full') later(() => { audio.burp(); fx.emit('sparkle', rig.mouthWorld, 4); }, 700);
}

// ---------------------------------------------------------------- toilet (stylised, non-explicit: a privacy screen slides in)
export function startToilet() {
  const gs = useGameStore.getState(), ui = useUIStore.getState();
  if (gs.sleeping) { ui.showToast(tr('toast.sleeping')); return; }
  if (busy.toilet || busy.bath) return;
  if (gs.needs.bladder > 70) {
    ui.showToast(tr('toast.notNeeded'));
    rig.play('startle', 0.6);
    return;
  }
  busy.toilet = true;
  ui.setToiletBusy(true);
  audio.click();
  const x = ROOM_X.bathroom + LOCKS.toilet.x;
  rig.lockAt(x, LOCKS.toilet.z, 0, LOCKS.toilet.yaw);
  rig.setBase('squirm');
  later(() => {
    audio.flush();
    fx.emit('bubble', { x, y: 0.5, z: LOCKS.toilet.z - 0.4 }, 6);
  }, 2000);
  later(() => {
    const g = useGameStore.getState();
    g.bump('bladder', 100);
    g.bump('happiness', 4);
    g.addXp(12);
    g.addCoins(5);
    g.stat('toilet');
    rig.setBase(null);
    rig.unlock();
    ui.setToiletBusy(false);
    rig.play('happy', 1.4);
    rig.express('happy', 1.8);
    audio.chirp();
    audio.coin();
    fx.emit('sparkle', rig.faceWorld, 12);
    ui.showToast(tr('toast.toiletDone'));
    busy.toilet = false;
  }, 3400);
}

// ---------------------------------------------------------------- bath
export const bath = { foam: 0, wet: 0, everFoam: false, showering: false, lastSqueak: 0, waterT: 0, splashT: 0 };

function resetBath() { bath.foam = 0; bath.wet = 0; bath.everFoam = false; bath.showering = false; }

export function enterBath() {
  const gs = useGameStore.getState(), ui = useUIStore.getState();
  if (gs.sleeping) { ui.showToast(tr('toast.sleeping')); return; }
  if (busy.toilet || busy.bath) { ui.showToast(tr('toast.busy')); return; }
  resetBath();
  ui.setBath(true, 'sponge');
  rig.lockAt(ROOM_X.bathroom + LOCKS.tub.x, LOCKS.tub.z, 0, LOCKS.tub.yaw);
  rig.setBase('bathe');
  audio.click();
}

export function exitBath() {
  useUIStore.getState().setBath(false);
  resetBath();
  rig.setBase(null);
  rig.unlock();
}

export function setBathTool(t: 'sponge' | 'shower' | 'towel') {
  useUIStore.getState().setBathTool(t);
  bath.showering = t === 'shower';
  audio.click();
  if (t === 'shower') rig.express('surprised', 0.8);
}

/** Dragging the soap over her body. */
export function scrub(px: number, at?: THREE.Vector3) {
  bath.foam = Math.min(1, bath.foam + px * 0.0018);
  if (bath.foam > 0.35) bath.everFoam = true;
  const gs = useGameStore.getState();
  if (gs.needs.hygiene < 80) gs.bump('hygiene', px * 0.012);
  const t = rig.now();
  if (t - bath.lastSqueak > 0.22) {
    bath.lastSqueak = t;
    audio.squeak();
    fx.emit('foam', at ?? rig.faceWorld, 2);
    rig.express('happy', 0.6);
    haptic(6);
  }
}

/** Dragging the towel. */
export function towel(px: number, at?: THREE.Vector3) {
  if (bath.foam > 0.05) return; // rinse first
  bath.wet = Math.max(0, bath.wet - px * 0.004);
  if (Math.random() < 0.1) fx.emit('sparkle', at ?? rig.faceWorld, 1);
  checkBathDone();
}

/** Called every frame while in bath mode (from the scene). */
export function bathTick(dt: number) {
  if (!bath.showering) return;
  bath.foam = Math.max(0, bath.foam - 0.3 * dt);
  bath.wet = Math.min(1, bath.wet + 0.45 * dt);
  bath.waterT -= dt;
  if (bath.waterT <= 0) {
    bath.waterT = 0.05;
    fx.emit('water', { x: ROOM_X.bathroom + SHOWER.x + (Math.random() - 0.5) * 0.5, y: SHOWER.y, z: SHOWER.z + Math.random() * 0.5 }, 3);
  }
  bath.splashT -= dt;
  if (bath.splashT <= 0) { bath.splashT = 0.5; audio.splash(); }
  checkBathDone();
}

function checkBathDone() {
  if (bath.everFoam && bath.foam < 0.04 && bath.wet < 0.04) finishBath();
}

function finishBath() {
  if (busy.bath) return;
  busy.bath = true;
  resetBath();
  const gs = useGameStore.getState(), ui = useUIStore.getState();
  gs.bump('hygiene', 100);
  gs.bump('happiness', 8);
  gs.stat('baths');
  gs.addXp(20);
  gs.addCoins(5);
  ui.setBath(false);
  rig.setBase(null);
  rig.play('shake', 1.4);
  rig.express('laughing', 2.2);
  audio.giggle();
  audio.coin();
  fx.emit('sparkle', rig.faceWorld, 24, { speed: 2 });
  fx.emit('bubble', rig.faceWorld, 10);
  ui.showToast(tr('toast.clean'));
  later(() => { rig.unlock(); busy.bath = false; }, 1500);
}

// ---------------------------------------------------------------- sleep
function applyBedLock() {
  rig.lockAt(ROOM_X.bedroom + LOCKS.bed.x, LOCKS.bed.z, LOCKS.bed.y, LOCKS.bed.yaw);
  rig.setBase('sleep');
}

export function sleep() {
  const gs = useGameStore.getState(), ui = useUIStore.getState();
  if (gs.sleeping) return;
  if (busy.toilet || busy.bath) { ui.showToast(tr('toast.busy')); return; }
  ui.setFoodOpen(false);
  ui.setBath(false);
  resetBath();
  ui.setRoom('bedroom');
  gs.setSleeping(true);
  applyBedLock();
  audio.click();
  audio.yawn();
}

export function wake(auto = false) {
  const gs = useGameStore.getState(), ui = useUIStore.getState();
  const grumpy = !auto && gs.needs.energy < 45;
  gs.setSleeping(false);
  gs.stat('sleeps');
  rig.setBase(null);
  rig.unlock();
  if (grumpy) {
    rig.express('angry', 2.4);
    rig.play('sulk', 2.4);
    audio.hmph();
    fx.emit('anger', { x: rig.faceWorld.x + 0.2, y: rig.faceWorld.y + 0.4, z: rig.faceWorld.z }, 1);
    gs.nudge('sassy', 0.6);
    ui.showToast(tr('toast.grumpy'));
  } else {
    rig.play('idleStretch', 2.4);
    rig.express('happy', 2.4);
    audio.chirp();
    ui.showToast(tr('toast.rested'));
  }
}

export const toggleSleep = () => (useGameStore.getState().sleeping ? wake() : sleep());

/** After a reload while she was asleep: put her back in bed. */
export function resumeSleepIfNeeded() {
  if (useGameStore.getState().sleeping) {
    useUIStore.getState().setRoom('bedroom');
    applyBedLock();
  }
}

// ---------------------------------------------------------------- play + hug
export function playWith() {
  const gs = useGameStore.getState(), ui = useUIStore.getState();
  if (gs.sleeping) { ui.showToast(tr('toast.sleeping')); return; }
  if (gs.needs.energy < 15) { ui.showToast(tr('toast.tooTired')); rig.express('sleepy', 1.6); return; }
  const t = rig.now();
  if (t - busy.playAt < 5) { rig.play('happy', 0.8); return; }
  busy.playAt = t;
  rig.play('cheer', 1.8);
  rig.express('laughing', 1.8);
  audio.giggle();
  haptic([10, 30, 10]);
  fx.emit('star', rig.faceWorld, 6);
  fx.emit('note', rig.faceWorld, 3);
  gs.bump('happiness', 8);
  gs.bump('energy', -3);
  gs.bump('affection', 2);
  gs.addXp(3);
  gs.addCoins(1);
  gs.nudge('playful', 0.5);
  gs.stat('plays');
  ui.showToast(tr('toast.playDone'));
}

export function hugHer() {
  const gs = useGameStore.getState();
  if (gs.sleeping) { useUIStore.getState().showToast(tr('toast.sleeping')); return; }
  const t = rig.now();
  rig.play('hug', 2);
  rig.express('happy', 2.4);
  audio.chirp();
  haptic([12, 40, 12]);
  fx.emit('heart', rig.faceWorld, 4);
  if (t - busy.hugAt > 6) {
    busy.hugAt = t;
    gs.bump('affection', 10);
    gs.bump('happiness', 5);
    gs.nudge('sweet', 0.6);
    gs.nudge('shy', -0.2);
    gs.addXp(3);
    gs.stat('hugs');
  }
}

export function cancelActivities() { timers.forEach((id) => window.clearTimeout(id)); timers.clear(); }
