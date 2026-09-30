// ---------------------------------------------------------------------------
// Everything you might need to tune for YOUR sylvia.glb lives in this file.
// Most values can also be tweaked live in the debug panel (press F2 in dev),
// which has a "Copy config JSON" button to paste values back in here.
// ---------------------------------------------------------------------------

export const MODEL_URL = `${import.meta.env.BASE_URL}models/sylvia.glb`;

export type Vec3 = [number, number, number];
export type Region = 'ear' | 'head' | 'cheek' | 'body' | 'belly' | 'hand' | 'tail' | 'feet';

export const modelConfig = {
  /** Normalised model height in world units (feet at y = 0). */
  targetHeight: 1.6,
  /** Extra yaw (radians) if your model does not face +Z toward the camera. */
  yawOffset: 0,
  /** Growth: whole-model scale per life stage. */
  stageScale: { baby: 0.66, kid: 0.8, teen: 0.92, adult: 1 } as Record<'baby' | 'kid' | 'teen' | 'adult', number>,

  outline: { color: '#3a3350', thickness: 0.012 },

  /** Layer 1 – animation clips. Key = internal state, value = substrings matched against clip names. */
  clipMap: {
    idle: ['idle', 'stand', 'breath', 'wait'],
    walk: ['walk'],
    run: ['run'],
    jump: ['jump', 'hop'],
    sit: ['sit'],
    sleep: ['sleep', 'lie'],
    eat: ['eat', 'chew'],
    dance: ['dance'],
    wave: ['wave', 'hello'],
    cry: ['cry', 'sad'],
    happy: ['happy', 'cheer', 'joy'],
  } as Record<string, string[]>,

  /** Layer 2 – bone / node name search tokens (case + punctuation insensitive substring match). */
  boneMap: {
    head: ['head'],
    neck: ['neck'],
    spine: ['spine', 'chest'],
    earL: ['earl', 'leftear', 'earleft', 'lear'],
    earR: ['earr', 'rightear', 'earright', 'rear'],
    tail: ['tail'],
    armL: ['armleft', 'leftarm', 'arml', 'shoulderl', 'leftshoulder'],
    armR: ['armright', 'rightarm', 'armr', 'shoulderr', 'rightshoulder'],
    hair: ['hair', 'bang', 'ahoge', 'poncho', 'fringe', 'earring', 'sidelock'],
  } as Record<string, string[]>,

  /** Which local axes each kind of node is allowed to rotate around (flip a sign / zero an axis if a rig looks wrong). */
  nodeAxes: {
    head: [1, 1, 1],
    neck: [1, 1, 1],
    ear: [0, 0, 1],
    tail: [0, 1, 1],
    arm: [0, 0, 1],
    hair: [1, 0, 1],
  } as Record<string, Vec3>,
  nodeGain: { head: 1, neck: 0.5, ear: 1, tail: 1, arm: 0.5, hair: 0.7 } as Record<string, number>,

  /** Morph-target search tokens for facial expressions. */
  morphMap: {
    happy: ['happy', 'smile', 'joy'],
    angry: ['angry', 'anger', 'mad'],
    sleepy: ['sleepy', 'sleep', 'tired'],
    sad: ['sad', 'cry'],
    blink: ['blink', 'eyesclosed', 'eyeclose'],
    mouth: ['mouthopen', 'jawopen', 'aa'],
  } as Record<string, string[]>,

  /** Face overlay (used when the GLB has no expression morph targets). */
  face: {
    enabled: true,
    /** false: the painted face from the texture stays visible for "normal"; the overlay only appears for other expressions. */
    showOnNormal: false,
    /** Draw a soft skin-coloured patch behind the drawn features so the painted face is hidden. */
    mask: true,
    /** Vertical position of the face centre as a fraction of model height (used to auto-find the head surface). */
    yRatio: 0.76,
    /** Overlay width as a fraction of model height. */
    widthRatio: 0.3,
    /** Push the plane off the surface (fraction of height) to avoid z-fighting. */
    push: 0.006,
  },

  /** Touch regions, as fractions of model height (x = left/right, y = up, z = front/back). */
  regions: {
    earY: 0.86,
    earX: 0.09,
    headY: 0.6,
    cheekX: 0.1,
    cheekMaxY: 0.72,
    feetY: 0.12,
    handX: 0.16,
    bellyY: 0.38,
    tailZ: -0.12,
    tailMaxY: 0.55,
  },

  /** Accessory anchors as bbox ratios (used by the wardrobe in a later part). */
  anchors: {
    headTop: { x: 0, y: 1.0, z: 0 },
    earL: { x: -0.1, y: 0.93, z: 0 },
    earR: { x: 0.1, y: 0.93, z: 0 },
    neck: { x: 0, y: 0.58, z: 0.02 },
    tail: { x: 0, y: 0.25, z: -0.2 },
  },
};

export function classifyRegion(x: number, y: number, z: number): Region {
  const r = modelConfig.regions;
  if (z < r.tailZ && y < r.tailMaxY) return 'tail';
  if (y > r.earY && Math.abs(x) > r.earX) return 'ear';
  if (y > r.headY) return Math.abs(x) > r.cheekX && y < r.cheekMaxY ? 'cheek' : 'head';
  if (y < r.feetY) return 'feet';
  if (Math.abs(x) > r.handX) return 'hand';
  return y < r.bellyY ? 'belly' : 'body';
}
