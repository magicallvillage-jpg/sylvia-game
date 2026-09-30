import { create } from 'zustand';

export interface DebugInfo {
  source: string;
  layers: string;
  faceMethod: string;
  height: number;
  bones: string[];
  meshes: string[];
  morphs: string[];
  clips: string[];
  mapped: Record<string, string>;
}

export interface DebugState {
  info: DebugInfo | null;
  forceExpr: string; // 'auto' or an Expression
  scaleMul: number;
  yaw: number;
  ox: number;
  oy: number;
  oz: number;
  fx: number;
  fy: number;
  fz: number;
  fscale: number;
  frot: number;
  showOnNormal: boolean | null;
  mask: boolean | null;
  set: (p: Partial<Omit<DebugState, 'set'>>) => void;
}

export const useDebugStore = create<DebugState>((set) => ({
  info: null,
  forceExpr: 'auto',
  scaleMul: 1,
  yaw: 0,
  ox: 0,
  oy: 0,
  oz: 0,
  fx: 0,
  fy: 0,
  fz: 0,
  fscale: 1,
  frot: 0,
  showOnNormal: null,
  mask: null,
  set: (p) => set(p),
}));
