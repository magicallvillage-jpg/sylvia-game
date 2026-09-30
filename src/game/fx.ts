export type FxKind =
  | 'heart' | 'sparkle' | 'star' | 'bubble' | 'drop' | 'zzz' | 'crumb'
  | 'confetti' | 'anger' | 'note' | 'smell' | 'foam' | 'water';

export interface FxSpawn {
  kind: FxKind;
  x: number; y: number; z: number;
  n: number;
  spread: number; // random start offset radius
  speed: number; // initial speed
  life: number;
  gravity: number; // + falls, - rises
  size: number;
  color?: number;
}

const DEFAULTS: Record<FxKind, Omit<FxSpawn, 'kind' | 'x' | 'y' | 'z' | 'n'>> = {
  heart: { spread: 0.2, speed: 0.5, life: 1.7, gravity: -0.9, size: 0.26 },
  sparkle: { spread: 0.4, speed: 1.1, life: 0.9, gravity: 0, size: 0.18 },
  star: { spread: 0.25, speed: 1.6, life: 1.1, gravity: 1.2, size: 0.22 },
  bubble: { spread: 0.35, speed: 0.5, life: 1.9, gravity: -0.5, size: 0.16 },
  drop: { spread: 0.1, speed: 0.4, life: 0.9, gravity: 3.5, size: 0.12 },
  zzz: { spread: 0.05, speed: 0.3, life: 2.1, gravity: -0.15, size: 0.3 },
  crumb: { spread: 0.05, speed: 1.3, life: 0.8, gravity: 6, size: 0.06 },
  confetti: { spread: 0.3, speed: 4.2, life: 2.3, gravity: 4.5, size: 0.12 },
  anger: { spread: 0.02, speed: 0.15, life: 1.1, gravity: 0, size: 0.3 },
  note: { spread: 0.2, speed: 0.6, life: 1.4, gravity: -0.6, size: 0.22 },
  smell: { spread: 0.25, speed: 0.35, life: 1.7, gravity: -0.3, size: 0.24 },
  foam: { spread: 0.3, speed: 0.6, life: 1.3, gravity: 0.3, size: 0.13 },
  water: { spread: 0.12, speed: 0.4, life: 0.9, gravity: 7, size: 0.06 },
};

const queue: FxSpawn[] = [];

export const fx = {
  /** Multiplier from the graphics quality setting (particle budget). */
  scale: 1,
  emit(
    kind: FxKind,
    p: { x: number; y: number; z: number },
    n = 1,
    o: Partial<Omit<FxSpawn, 'kind' | 'x' | 'y' | 'z' | 'n'>> = {}
  ) {
    if (queue.length > 120) return;
    const count = Math.max(1, Math.round(n * fx.scale));
    queue.push({ ...DEFAULTS[kind], ...o, kind, x: p.x, y: p.y, z: p.z, n: count });
  },
  drain(): FxSpawn[] {
    return queue.length ? queue.splice(0, queue.length) : [];
  },
};
