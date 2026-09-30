import type { Room } from '../store/uiStore';

/** Rooms sit side by side on the X axis; the camera slides between them. */
export const ROOM_X: Record<Room, number> = { living: 0, kitchen: 10, bathroom: 20, bedroom: 30 };

/** Positions (relative to the room's x) where Sylvia stands for an activity. */
export const LOCKS = {
  bed: { x: -1.1, z: -0.9, y: 0.6, yaw: 0 },
  tub: { x: -1.9, z: -0.2, y: 0, yaw: 0 },
  toilet: { x: 2.6, z: -0.3, y: 0, yaw: 0 },
  table: { x: -1.6, z: 0.3, y: 0, yaw: 0.3 },
};

export const SHOWER = { x: -1.9, y: 2.7, z: -0.6 };

/** Mutable environment values shared by lights, windows and rooms (never React state). */
export const env = { day: 1, sleepDim: 0 };
