import { create } from 'zustand';
import type { Needs } from './gameStore';

export type Room = 'living' | 'kitchen' | 'bathroom' | 'bedroom';
export const ROOMS: Room[] = ['living', 'kitchen', 'bathroom', 'bedroom'];
export type BathTool = 'sponge' | 'shower' | 'towel';

export interface WelcomeInfo {
  elapsed: number; // seconds actually away
  before: Needs;
  after: Needs;
  wasSleeping: boolean;
}

interface UIState {
  room: Room;
  setRoom: (r: Room) => void;
  foodOpen: boolean;
  setFoodOpen: (v: boolean) => void;
  panel: 'none' | 'settings' | 'about' | 'reset';
  setPanel: (p: UIState['panel']) => void;
  bathMode: boolean;
  bathTool: BathTool;
  setBath: (on: boolean, tool?: BathTool) => void;
  setBathTool: (t: BathTool) => void;
  toiletBusy: boolean;
  setToiletBusy: (v: boolean) => void;
  toast: { id: number; text: string } | null;
  showToast: (text: string) => void;
  levelUp: number | null;
  setLevelUp: (l: number | null) => void;
  welcome: WelcomeInfo | null;
  setWelcome: (w: WelcomeInfo | null) => void;
  debugOpen: boolean;
  toggleDebug: () => void;
  visible: boolean;
  setVisible: (v: boolean) => void;
  sceneReady: boolean;
  setSceneReady: (v: boolean) => void;
}

let toastSeq = 0;
let toastTimer = 0;

export const useUIStore = create<UIState>((set) => ({
  room: 'living',
  setRoom: (room) => set({ room }),
  foodOpen: false,
  setFoodOpen: (foodOpen) => set({ foodOpen }),
  panel: 'none',
  setPanel: (panel) => set({ panel }),
  bathMode: false,
  bathTool: 'sponge',
  setBath: (bathMode, tool) => set((s) => ({ bathMode, bathTool: tool ?? (bathMode ? s.bathTool : 'sponge') })),
  setBathTool: (bathTool) => set({ bathTool }),
  toiletBusy: false,
  setToiletBusy: (toiletBusy) => set({ toiletBusy }),
  toast: null,
  showToast: (text) => {
    const id = ++toastSeq;
    set({ toast: { id, text } });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), 2400);
  },
  levelUp: null,
  setLevelUp: (levelUp) => set({ levelUp }),
  welcome: null,
  setWelcome: (welcome) => set({ welcome }),
  debugOpen: false,
  toggleDebug: () => set((s) => ({ debugOpen: !s.debugOpen })),
  visible: true,
  setVisible: (visible) => set({ visible }),
  sceneReady: false,
  setSceneReady: (sceneReady) => set({ sceneReady }),
}));
