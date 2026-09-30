import * as THREE from 'three';
import type { Expression } from '../store/gameStore';

export interface FaceState {
  expr: Expression;
  blink: boolean;
  mouth: number; // 0..1 (bucketed by the caller)
  lookX: number; // -1..1
  lookY: number; // -1..1
  mask: boolean;
  spin: number; // animation frame for spirals
}

export const FACE_W = 640;
export const FACE_H = 384;
export const FACE_ASPECT = FACE_H / FACE_W;

const EYE_A = '#E8641A';
const EYE_B = '#C93A0E';
const INK = '#3a2430';

/** Canvas2D-drawn anime face. Redraws only when the (quantised) state changes. */
export class FaceTexture {
  canvas = document.createElement('canvas');
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  private key = '';

  constructor() {
    this.canvas.width = FACE_W;
    this.canvas.height = FACE_H;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  update(s: FaceState): boolean {
    const key = `${s.expr}|${s.blink ? 1 : 0}|${s.mouth.toFixed(2)}|${s.lookX}|${s.lookY}|${s.mask ? 1 : 0}|${s.expr === 'dizzy' ? s.spin : 0}`;
    if (key === this.key) return false;
    this.key = key;
    this.draw(s);
    this.texture.needsUpdate = true;
    return true;
  }

  dispose() { this.texture.dispose(); }

  private draw(s: FaceState) {
    const g = this.ctx;
    const W = FACE_W, H = FACE_H;
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    if (s.mask) {
      const grd = g.createRadialGradient(W / 2, H / 2, W * 0.12, W / 2, H / 2, W * 0.5);
      grd.addColorStop(0, 'rgba(246,241,234,1)');
      grd.addColorStop(0.72, 'rgba(246,241,234,1)');
      grd.addColorStop(1, 'rgba(246,241,234,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(W / 2, H / 2, W * 0.5, H * 0.5, 0, 0, Math.PI * 2);
      g.fill();
    }

    const lx = W * 0.3, rx = W * 0.7, ey = H * 0.46;
    const erx = W * 0.085, ery = H * 0.2;
    const mx = W / 2, my = H * 0.7;
    const blush = (strong = false) => {
      g.fillStyle = `rgba(255,120,150,${strong ? 0.75 : 0.5})`;
      for (const x of [W * 0.14, W * 0.86]) {
        g.beginPath();
        g.ellipse(x, H * 0.7, W * 0.06, H * 0.055, 0, 0, Math.PI * 2);
        g.fill();
      }
    };
    const whiskers = () => {
      g.strokeStyle = 'rgba(120,100,110,.35)';
      g.lineWidth = 3;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          const x0 = W / 2 + side * W * 0.4, y0 = H * (0.66 + i * 0.05);
          g.moveTo(x0, y0);
          g.lineTo(x0 + side * W * 0.1, y0 + (i - 1) * H * 0.03);
          g.stroke();
        }
      }
    };

    const eyeOpen = (cx: number, sx = 1, sy = 1, pupil = 0.42) => {
      const rx = erx * sx, ry = ery * sy;
      g.fillStyle = INK;
      g.beginPath(); g.ellipse(cx, ey, rx * 1.1, ry * 1.08, 0, 0, Math.PI * 2); g.fill();
      const gr = g.createLinearGradient(0, ey - ry, 0, ey + ry);
      gr.addColorStop(0, EYE_A); gr.addColorStop(1, EYE_B);
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(cx, ey, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a0f08';
      g.beginPath(); g.ellipse(cx + s.lookX * rx * 0.2, ey + s.lookY * ry * 0.18 + ry * 0.05, rx * pupil, ry * 0.55, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.95)';
      g.beginPath(); g.ellipse(cx - rx * 0.3, ey - ry * 0.35, rx * 0.28, ry * 0.24, -0.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(cx + rx * 0.35, ey + ry * 0.4, rx * 0.12, ry * 0.1, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 9;
      g.beginPath(); g.ellipse(cx, ey, rx * 1.05, ry * 1.03, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    };
    const arcEye = (cx: number, up: boolean, w = 1) => { // "^" happy or "u" closed
      g.strokeStyle = INK; g.lineWidth = 11;
      g.beginPath();
      if (up) g.arc(cx, ey + ery * 0.35, erx * 0.9 * w, Math.PI * 1.1, Math.PI * 1.9);
      else g.arc(cx, ey - ery * 0.3, erx * 0.9 * w, Math.PI * 0.1, Math.PI * 0.9);
      g.stroke();
    };
    const wMouth = (open: number, size = 1, frown = false) => {
      const sz = W * 0.045 * size;
      if (open > 0.08) {
        g.fillStyle = '#7a2436';
        g.beginPath(); g.ellipse(mx, my + sz * 0.5, sz * (0.9 + open * 0.3), sz * (0.4 + open * 1.1), 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ff8a9a';
        g.beginPath(); g.ellipse(mx, my + sz * (0.9 + open * 0.8), sz * 0.55, sz * 0.32 * (0.5 + open), 0, 0, Math.PI * 2); g.fill();
        return;
      }
      g.strokeStyle = INK; g.lineWidth = 7;
      g.beginPath();
      const k = frown ? -0.9 : 0.9;
      g.moveTo(mx - sz, my + (frown ? sz * 0.6 : 0));
      g.quadraticCurveTo(mx - sz / 2, my + sz * k * (frown ? 1 : 1) + (frown ? sz * 0.6 : 0), mx, my + (frown ? sz * 0.6 : 0));
      g.quadraticCurveTo(mx + sz / 2, my + sz * k + (frown ? sz * 0.6 : 0), mx + sz, my + (frown ? sz * 0.6 : 0));
      g.stroke();
    };
    const tear = (cx: number, big = false) => {
      g.fillStyle = 'rgba(120,200,255,.9)'; g.strokeStyle = '#fff'; g.lineWidth = 3;
      const y0 = ey + ery * 0.9, h = H * (big ? 0.22 : 0.14);
      g.beginPath(); g.moveTo(cx, y0);
      g.bezierCurveTo(cx + 22, y0 + h * 0.5, cx + 16, y0 + h, cx, y0 + h);
      g.bezierCurveTo(cx - 16, y0 + h, cx - 22, y0 + h * 0.5, cx, y0); g.fill(); g.stroke();
    };
    const sweat = () => {
      g.fillStyle = 'rgba(140,210,255,.95)'; g.strokeStyle = '#fff'; g.lineWidth = 3;
      const x = W * 0.9, y = H * 0.14;
      g.beginPath(); g.moveTo(x, y);
      g.bezierCurveTo(x + 26, y + 40, x + 20, y + 70, x, y + 70);
      g.bezierCurveTo(x - 20, y + 70, x - 26, y + 40, x, y); g.fill(); g.stroke();
    };
    const brow = (cx: number, tiltIn: number) => {
      g.strokeStyle = INK; g.lineWidth = 12;
      g.beginPath();
      g.moveTo(cx - erx, ey - ery * 1.15 + tiltIn * (cx < W / 2 ? -1 : 1) * -18);
      g.lineTo(cx + erx, ey - ery * 1.15 + tiltIn * (cx < W / 2 ? -1 : 1) * 18);
      g.stroke();
    };
    const spiral = (cx: number) => {
      g.strokeStyle = INK; g.lineWidth = 7;
      g.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.2) {
        const r = a * 4.6, aa = a + s.spin * 0.45;
        const x = cx + Math.cos(aa) * r, y = ey + Math.sin(aa) * r * 0.9;
        if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    };
    const chevrons = () => {
      g.strokeStyle = INK; g.lineWidth = 11;
      g.beginPath();
      g.moveTo(lx - erx * 0.8, ey - ery * 0.5); g.lineTo(lx + erx * 0.7, ey); g.lineTo(lx - erx * 0.8, ey + ery * 0.5);
      g.moveTo(rx + erx * 0.8, ey - ery * 0.5); g.lineTo(rx - erx * 0.7, ey); g.lineTo(rx + erx * 0.8, ey + ery * 0.5);
      g.stroke();
    };

    const closed = s.blink && (s.expr === 'normal' || s.expr === 'happy');
    switch (s.expr) {
      case 'normal':
        if (closed) { arcEye(lx, false); arcEye(rx, false); } else { eyeOpen(lx); eyeOpen(rx); }
        blush(); wMouth(s.mouth); whiskers(); break;
      case 'happy':
        if (closed) { arcEye(lx, false); arcEye(rx, false); } else { arcEye(lx, true); arcEye(rx, true); }
        blush(true); wMouth(Math.max(s.mouth, 0.35), 1.1); whiskers(); break;
      case 'laughing':
        arcEye(lx, true, 1.1); arcEye(rx, true, 1.1); tear(lx - 10); tear(rx + 10);
        blush(true); wMouth(0.9, 1.3); break;
      case 'eating':
        arcEye(lx, true); arcEye(rx, true); blush(true); wMouth(Math.max(0.15, s.mouth), 1.1); break;
      case 'angry':
        eyeOpen(lx, 1, 0.68); eyeOpen(rx, 1, 0.68); brow(lx, 1); brow(rx, 1);
        g.strokeStyle = '#e53935'; g.lineWidth = 8;
        for (const [dx, dy] of [[0, 0], [22, 22]]) {
          g.beginPath(); g.moveTo(W * 0.84 + dx - 18, H * 0.1 + dy); g.lineTo(W * 0.84 + dx + 18, H * 0.1 + dy);
          g.moveTo(W * 0.84 + dx, H * 0.1 + dy - 18); g.lineTo(W * 0.84 + dx, H * 0.1 + dy + 18); g.stroke();
        }
        wMouth(0, 0.9, true); blush(); break;
      case 'sad':
        eyeOpen(lx, 1.05, 1.05, 0.35); eyeOpen(rx, 1.05, 1.05, 0.35); brow(lx, -1); brow(rx, -1);
        tear(lx - 6); tear(rx + 6); wMouth(0, 0.9, true); break;
      case 'sleepy':
        g.strokeStyle = INK; g.lineWidth = 11;
        for (const cx of [lx, rx]) { g.beginPath(); g.arc(cx, ey - ery * 0.1, erx * 0.9, Math.PI * 0.12, Math.PI * 0.88); g.stroke(); }
        wMouth(0, 0.8); blush(); break;
      case 'surprised':
        eyeOpen(lx, 1.15, 1.12, 0.22); eyeOpen(rx, 1.15, 1.12, 0.22); wMouth(0.8, 0.8); blush(); break;
      case 'dizzy':
        spiral(lx); spiral(rx); wMouth(0, 1); break;
      case 'embarrassed':
        chevrons(); blush(true);
        g.strokeStyle = 'rgba(255,90,120,.7)'; g.lineWidth = 5;
        for (const x of [W * 0.1, W * 0.9]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 14 + i * 14, H * 0.6); g.lineTo(x - 4 + i * 14, H * 0.78); g.stroke(); }
        sweat(); wMouth(0, 1); break;
      case 'sick':
        g.fillStyle = 'rgba(150,200,120,.28)'; g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.46, H * 0.46, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = INK; g.lineWidth = 10;
        for (const cx of [lx, rx]) { g.beginPath(); g.arc(cx, ey - ery * 0.1, erx * 0.85, Math.PI * 0.1, Math.PI * 0.9); g.stroke(); }
        g.beginPath(); g.moveTo(mx - 40, my + 8); g.bezierCurveTo(mx - 20, my - 10, mx - 10, my + 22, mx, my + 6); g.bezierCurveTo(mx + 10, my - 10, mx + 20, my + 22, mx + 40, my + 8); g.stroke();
        sweat(); break;
    }
  }
}
