import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { foodById, type Food } from '../data/foods';
import { useUIStore } from './uiStore';

export const SAVE_VERSION = 1;

export type NeedKey = 'hunger' | 'hygiene' | 'bladder' | 'energy' | 'happiness' | 'affection';
export const NEED_KEYS: NeedKey[] = ['hunger', 'hygiene', 'bladder', 'energy', 'happiness', 'affection'];
export type Needs = Record<NeedKey, number>; // 100 = perfectly fine, 0 = terrible
export type Stage = 'baby' | 'kid' | 'teen' | 'adult';
export type Expression =
  | 'normal' | 'happy' | 'angry' | 'sleepy' | 'sad' | 'eating'
  | 'surprised' | 'dizzy' | 'embarrassed' | 'sick' | 'laughing';
export type Quality = 'low' | 'medium' | 'high';
export type Lang = 'en' | 'fa';
export type Want = 'food' | 'toilet' | 'bed' | 'bath' | 'heart' | null;

export interface Settings {
  lang: Lang;
  quality: Quality;
  music: number;
  sfx: number;
  voice: number;
  muteMusic: boolean;
  muteSfx: boolean;
  muteVoice: boolean;
  vibration: boolean;
  textScale: number;
  colorBlind: boolean;
  reduceMotion: boolean;
}
export interface Personality { playful: number; shy: number; sweet: number; sassy: number }

export interface SaveData {
  name: string;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  needs: Needs;
  fullness: number;
  sleeping: boolean;
  personality: Personality;
  stats: Record<string, number>;
  settings: Settings;
  onboarded: boolean;
  lastPlayed: number;
  createdAt: number;
}

export interface FeedResult {
  ok: boolean;
  reaction?: 'love' | 'ok' | 'dislike' | 'full';
  food?: Food;
}

// ---------------------------------------------------------------- helpers
const clamp = (v: number, a = 0, b = 100) => Math.min(b, Math.max(a, v));
export const xpNeeded = (level: number) => 40 + level * 25;
export const stageForLevel = (l: number): Stage => (l >= 30 ? 'adult' : l >= 15 ? 'teen' : l >= 5 ? 'kid' : 'baby');

const RATE_PER_HOUR: Record<NeedKey, number> = { hunger: 12, hygiene: 8, bladder: 14, energy: 7, happiness: 6, affection: 5 };

/** Real-time decay. Energy recovers while sleeping. Needs never fall below `floor` (she never dies). */
export function decay(n: Needs, sec: number, sleeping: boolean, fullness: number, floor = 5, factor = 1): Needs {
  const h = sec / 3600;
  const out = { ...n };
  for (const k of NEED_KEYS) {
    let r = RATE_PER_HOUR[k] * factor;
    if (k === 'bladder') r += fullness * 0.12 * factor;
    if (k === 'energy' && sleeping) r = -30;
    else if (sleeping) r *= 0.4;
    const v = n[k] - r * h;
    out[k] = r > 0 ? Math.max(v, Math.min(n[k], floor)) : Math.min(100, v);
  }
  return out;
}

export function computeMood(n: Needs, sleeping: boolean) {
  const avg = NEED_KEYS.reduce((a, k) => a + n[k], 0) / NEED_KEYS.length;
  let lowK: NeedKey = NEED_KEYS[0];
  for (const k of NEED_KEYS) if (n[k] < n[lowK]) lowK = k;
  const wantMap: Record<NeedKey, Want> = {
    hunger: 'food', hygiene: 'bath', bladder: 'toilet', energy: 'bed', happiness: 'heart', affection: 'heart',
  };
  const sick = avg < 28 && n[lowK] < 12;
  const want: Want = n[lowK] < 40 ? wantMap[lowK] : null;
  let expression: Expression = 'normal';
  if (sleeping) expression = 'sleepy';
  else if (sick) expression = 'sick';
  else if (n.energy < 20) expression = 'sleepy';
  else if (avg < 38 || n.happiness < 20) expression = 'sad';
  else if (avg > 72) expression = 'happy';
  return { expression, want, sick, avg };
}

// ---------------------------------------------------------------- storage (never throws)
const memoryStore = new Map<string, string>();
const safeStorage: StateStorage = {
  getItem: (k) => {
    try { return localStorage.getItem(k); } catch { return memoryStore.get(k) ?? null; }
  },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v); } catch { memoryStore.set(k, v); }
  },
  removeItem: (k) => {
    try { localStorage.removeItem(k); } catch { memoryStore.delete(k); }
  },
};

// ---------------------------------------------------------------- defaults & migration
function defaultSettings(): Settings {
  let lang: Lang = 'en';
  let quality: Quality = 'medium';
  try {
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fa')) lang = 'fa';
    if (typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches) quality = 'high';
  } catch { /* ignore */ }
  return {
    lang, quality, music: 0.5, sfx: 0.8, voice: 0.8,
    muteMusic: false, muteSfx: false, muteVoice: false,
    vibration: true, textScale: 1, colorBlind: false, reduceMotion: false,
  };
}

function initialData(settings?: Settings): SaveData {
  return {
    name: 'Sylvia', level: 1, xp: 0, coins: 50, gems: 0,
    needs: { hunger: 80, hygiene: 85, bladder: 85, energy: 90, happiness: 75, affection: 70 },
    fullness: 0, sleeping: false,
    personality: { playful: 50, shy: 40, sweet: 50, sassy: 30 },
    stats: {}, settings: settings ?? defaultSettings(),
    onboarded: false, lastPlayed: Date.now(), createdAt: Date.now(),
  };
}

/** Schema migration. Add a new `if (version < N)` block whenever SAVE_VERSION is bumped. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateSave(persisted: any, version: number): any {
  const s = persisted && typeof persisted === 'object' ? persisted : {};
  if (version < 1) {
    s.needs = { ...initialData().needs, ...(s.needs ?? {}) };
    s.settings = { ...defaultSettings(), ...(s.settings ?? {}) };
    s.stats = s.stats ?? {};
  }
  return s;
}

const DATA_KEYS: (keyof SaveData)[] = [
  'name', 'level', 'xp', 'coins', 'gems', 'needs', 'fullness', 'sleeping',
  'personality', 'stats', 'settings', 'onboarded', 'lastPlayed', 'createdAt',
];

// ---------------------------------------------------------------- store
interface Actions {
  tick: (dtSec: number) => void;
  bump: (k: NeedKey, delta: number) => void;
  addXp: (n: number) => void;
  addCoins: (coins: number, gems?: number) => void;
  feed: (foodId: string) => FeedResult;
  setSleeping: (v: boolean) => void;
  setName: (n: string) => void;
  setSettings: (p: Partial<Settings>) => void;
  nudge: (k: keyof Personality, d: number) => void;
  stat: (k: string, n?: number) => void;
  touchTime: () => void;
  applyOffline: () => { elapsed: number; before: Needs; after: Needs; wasSleeping: boolean } | null;
  resetProgress: () => void;
  exportSave: () => string;
  importSave: (json: string) => boolean;
}
export type GameState = SaveData & Actions;

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      tick: (dt) =>
        set((s) => {
          const needs = decay(s.needs, dt, s.sleeping, s.fullness);
          const fullness = Math.max(0, s.fullness - (25 * dt) / 3600);
          const sleeping = s.sleeping && needs.energy < 100;
          return { needs, fullness, sleeping, lastPlayed: Date.now() };
        }),

      bump: (k, d) => set((s) => ({ needs: { ...s.needs, [k]: clamp(s.needs[k] + d) } })),

      addXp: (n) => {
        const s = get();
        let xp = s.xp + n, level = s.level, coins = s.coins, leveled = 0;
        while (level < 99 && xp >= xpNeeded(level)) {
          xp -= xpNeeded(level);
          level++;
          coins += level * 10;
          leveled = level;
        }
        if (level >= 99) xp = 0;
        set({ xp, level, coins });
        if (leveled) useUIStore.getState().setLevelUp(leveled);
      },

      addCoins: (coins, gems = 0) => set((s) => ({ coins: s.coins + coins, gems: s.gems + gems })),

      feed: (id) => {
        const food = foodById(id);
        if (!food) return { ok: false };
        const s = get();
        const overfull = s.needs.hunger >= 92;
        const mult = food.taste === 'love' ? 1.4 : food.taste === 'dislike' ? 0.5 : 1;
        set({
          needs: {
            ...s.needs,
            hunger: clamp(s.needs.hunger + food.hunger * mult),
            happiness: clamp(s.needs.happiness + food.happy * (food.happy > 0 ? mult : 1)),
            energy: overfull ? clamp(s.needs.energy - 6) : s.needs.energy,
            bladder: overfull ? clamp(s.needs.bladder - 8) : s.needs.bladder,
          },
          fullness: clamp(s.fullness + food.hunger * 0.8),
        });
        get().stat('fed');
        get().addXp(food.xp);
        get().nudge(food.taste === 'love' ? 'sweet' : 'playful', 0.3);
        return { ok: true, food, reaction: overfull ? 'full' : food.taste };
      },

      setSleeping: (sleeping) => set({ sleeping }),
      setName: (name) => set({ name: name.trim().slice(0, 16) || 'Sylvia', onboarded: true }),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      nudge: (k, d) => set((s) => ({ personality: { ...s.personality, [k]: clamp(s.personality[k] + d) } })),
      stat: (k, n = 1) => set((s) => ({ stats: { ...s.stats, [k]: (s.stats[k] ?? 0) + n } })),
      touchTime: () => set({ lastPlayed: Date.now() }),

      applyOffline: () => {
        const s = get();
        const elapsed = (Date.now() - s.lastPlayed) / 1000;
        if (!s.onboarded || !(elapsed > 120)) {
          if (elapsed < 0 || elapsed > 120) set({ lastPlayed: Date.now() });
          return null;
        }
        const capped = Math.min(elapsed, 6 * 3600);
        const needs = decay(s.needs, capped, s.sleeping, s.fullness, 12, 0.6);
        const sleeping = s.sleeping && needs.energy < 100;
        set({
          needs,
          sleeping,
          fullness: Math.max(0, s.fullness - (25 * capped) / 3600),
          lastPlayed: Date.now(),
        });
        return { elapsed, before: s.needs, after: needs, wasSleeping: s.sleeping };
      },

      resetProgress: () => set({ ...initialData(get().settings) }),

      exportSave: () => {
        const s = get();
        const data: Partial<SaveData> = {};
        for (const k of DATA_KEYS) (data as Record<string, unknown>)[k] = s[k];
        return JSON.stringify({ app: 'sylvia', version: SAVE_VERSION, data }, null, 2);
      },

      importSave: (json) => {
        try {
          const parsed = JSON.parse(json);
          const version = typeof parsed?.version === 'number' ? parsed.version : 0;
          const raw = parsed?.data ?? parsed;
          if (!raw || typeof raw.name !== 'string' || typeof raw.level !== 'number') return false;
          const data = migrateSave(raw, version);
          const base = initialData();
          set({
            ...base,
            ...data,
            needs: { ...base.needs, ...data.needs },
            settings: { ...base.settings, ...data.settings },
            personality: { ...base.personality, ...data.personality },
            onboarded: true,
            lastPlayed: Date.now(),
          });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'sylvia-save',
      version: SAVE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => {
        const out: Record<string, unknown> = {};
        for (const k of DATA_KEYS) out[k] = s[k];
        return out as unknown as GameState;
      },
      migrate: (persisted, version) => migrateSave(persisted, version) as GameState,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      merge: (persisted: any, current) => {
        const p = persisted ?? {};
        return {
          ...current,
          ...p,
          needs: { ...current.needs, ...p.needs },
          settings: { ...current.settings, ...p.settings },
          personality: { ...current.personality, ...p.personality },
          stats: { ...current.stats, ...p.stats },
        };
      },
    }
  )
);
