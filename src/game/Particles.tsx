import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { fx, type FxKind, type FxSpawn } from './fx';
import { useGameStore } from '../store/gameStore';

const BASE_CAP: Record<FxKind, number> = {
  heart: 24, sparkle: 64, star: 24, bubble: 48, drop: 24, zzz: 8, crumb: 48,
  confetti: 120, anger: 4, note: 16, smell: 16, foam: 64, water: 120,
};
const KINDS = Object.keys(BASE_CAP) as FxKind[];

function drawIcon(kind: FxKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.translate(64, 64);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  switch (kind) {
    case 'heart': {
      g.fillStyle = '#ff6f9c'; g.strokeStyle = '#fff'; g.lineWidth = 8;
      g.beginPath(); g.moveTo(0, 40);
      g.bezierCurveTo(-64, -4, -34, -54, 0, -20);
      g.bezierCurveTo(34, -54, 64, -4, 0, 40);
      g.closePath(); g.stroke(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-22, -20, 9, 6, -0.6, 0, 7); g.fill();
      break;
    }
    case 'sparkle': {
      const gr = g.createRadialGradient(0, 0, 2, 0, 0, 60);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#fff3b0'); gr.addColorStop(1, 'rgba(255,240,150,0)');
      g.fillStyle = gr;
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, r = i % 2 ? 14 : 60;
        g.lineTo(Math.cos(a - Math.PI / 2) * r, Math.sin(a - Math.PI / 2) * r);
      }
      g.closePath(); g.fill();
      break;
    }
    case 'star': {
      g.fillStyle = '#ffd54a'; g.strokeStyle = '#fff'; g.lineWidth = 7;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 24 : 56;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath(); g.stroke(); g.fill();
      break;
    }
    case 'bubble': {
      const gr = g.createRadialGradient(-14, -14, 4, 0, 0, 54);
      gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.6, 'rgba(190,235,255,.25)'); gr.addColorStop(1, 'rgba(150,215,245,.65)');
      g.fillStyle = gr; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 5;
      g.beginPath(); g.arc(0, 0, 52, 0, 7); g.fill(); g.stroke();
      break;
    }
    case 'drop': {
      g.fillStyle = '#6ec6ff'; g.strokeStyle = '#fff'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(0, -54); g.bezierCurveTo(48, 6, 40, 52, 0, 52); g.bezierCurveTo(-40, 52, -48, 6, 0, -54);
      g.closePath(); g.stroke(); g.fill();
      break;
    }
    case 'zzz': {
      g.fillStyle = '#9a8cd8'; g.strokeStyle = '#fff'; g.lineWidth = 8;
      g.font = 'bold 96px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.strokeText('Z', 0, 6); g.fillText('Z', 0, 6);
      break;
    }
    case 'crumb': { g.fillStyle = '#b5814f'; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill(); break; }
    case 'confetti': { g.fillStyle = '#fff'; g.fillRect(-30, -18, 60, 36); break; }
    case 'anger': {
      g.strokeStyle = '#e53935'; g.lineWidth = 12;
      for (let i = 0; i < 4; i++) {
        g.save(); g.rotate((i * Math.PI) / 2 + Math.PI / 4);
        g.beginPath(); g.arc(28, 0, 26, Math.PI * 0.72, Math.PI * 1.28, false); g.stroke();
        g.restore();
      }
      break;
    }
    case 'note': {
      g.fillStyle = '#7aa23a'; g.strokeStyle = '#fff'; g.lineWidth = 6;
      g.font = 'bold 100px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.strokeText('\u266A', 0, 4); g.fillText('\u266A', 0, 4);
      break;
    }
    case 'smell': {
      g.strokeStyle = 'rgba(120,170,60,.85)'; g.lineWidth = 12;
      g.beginPath(); g.moveTo(-6, 56);
      g.bezierCurveTo(-40, 28, 30, 4, -6, -22); g.bezierCurveTo(-26, -40, 6, -50, -6, -58);
      g.stroke();
      break;
    }
    case 'foam': {
      const gr = g.createRadialGradient(-10, -10, 4, 0, 0, 52);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.75, '#f3fbff'); gr.addColorStop(1, 'rgba(210,240,255,.9)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 50, 0, 7); g.fill();
      break;
    }
    case 'water': {
      g.fillStyle = 'rgba(140,205,255,.95)';
      g.beginPath(); g.moveTo(0, -56); g.quadraticCurveTo(30, 0, 0, 40); g.quadraticCurveTo(-30, 0, 0, -56); g.fill();
      break;
    }
  }
  return c;
}

interface Pool {
  kind: FxKind;
  mesh: THREE.InstancedMesh;
  cap: number;
  n: number;
  px: Float32Array; py: Float32Array; pz: Float32Array;
  vx: Float32Array; vy: Float32Array; vz: Float32Array;
  age: Float32Array; life: Float32Array; size: Float32Array; spin: Float32Array; grav: Float32Array;
  color: Int32Array; // -1 = white
}

export function Particles() {
  const quality = useGameStore((s) => s.settings.quality);
  const reduce = useGameStore((s) => s.settings.reduceMotion);
  const qScale = quality === 'low' ? 0.35 : quality === 'medium' ? 0.7 : 1;

  const sys = useMemo(() => {
    const group = new THREE.Group();
    group.name = 'particles';
    const geo = new THREE.PlaneGeometry(1, 1);
    const pools: Partial<Record<FxKind, Pool>> = {};
    const textures: THREE.Texture[] = [];
    const mats: THREE.Material[] = [];
    for (const kind of KINDS) {
      const tex = new THREE.CanvasTexture(drawIcon(kind));
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
      textures.push(tex);
      mats.push(mat);
      const cap = Math.max(4, Math.round(BASE_CAP[kind] * qScale));
      const mesh = new THREE.InstancedMesh(geo, mat, cap);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = 30;
      mesh.raycast = () => {};
      mesh.setColorAt(0, new THREE.Color(1, 1, 1)); // allocates instanceColor
      group.add(mesh);
      pools[kind] = {
        kind, mesh, cap, n: 0,
        px: new Float32Array(cap), py: new Float32Array(cap), pz: new Float32Array(cap),
        vx: new Float32Array(cap), vy: new Float32Array(cap), vz: new Float32Array(cap),
        age: new Float32Array(cap), life: new Float32Array(cap), size: new Float32Array(cap),
        spin: new Float32Array(cap), grav: new Float32Array(cap), color: new Int32Array(cap).fill(-1),
      };
    }
    return {
      group, pools,
      dispose: () => {
        geo.dispose();
        textures.forEach((t) => t.dispose());
        mats.forEach((m) => m.dispose());
        for (const k of KINDS) pools[k]!.mesh.dispose();
      },
    };
  }, [qScale]);

  useEffect(() => {
    fx.scale = qScale * (reduce ? 0.5 : 1);
    return () => sys.dispose();
  }, [sys, qScale, reduce]);

  const tmp = useMemo(() => ({
    m: new THREE.Matrix4(), q: new THREE.Quaternion(), sq: new THREE.Quaternion(),
    p: new THREE.Vector3(), s: new THREE.Vector3(), z: new THREE.Vector3(0, 0, 1), c: new THREE.Color(),
  }), []);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const spawns: FxSpawn[] = fx.drain();
    for (const sp of spawns) {
      const pool = sys.pools[sp.kind];
      if (!pool) continue;
      for (let i = 0; i < sp.n && pool.n < pool.cap; i++) {
        const j = pool.n++;
        const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
        const dirx = Math.cos(a) * Math.cos(b), diry = Math.sin(b) * 0.6 + 0.45, dirz = Math.sin(a) * Math.cos(b);
        const sp0 = sp.speed * (0.5 + Math.random() * 0.7);
        pool.px[j] = sp.x + (Math.random() - 0.5) * 2 * sp.spread;
        pool.py[j] = sp.y + (Math.random() - 0.5) * sp.spread;
        pool.pz[j] = sp.z + (Math.random() - 0.5) * sp.spread;
        pool.vx[j] = dirx * sp0; pool.vy[j] = diry * sp0; pool.vz[j] = dirz * sp0;
        if (sp.kind === 'water') { pool.vx[j] *= 0.3; pool.vy[j] = -1.5; pool.vz[j] *= 0.3; }
        pool.age[j] = 0;
        pool.life[j] = sp.life * (0.8 + Math.random() * 0.4);
        pool.size[j] = sp.size * (0.8 + Math.random() * 0.4);
        pool.spin[j] = sp.kind === 'confetti' || sp.kind === 'star' ? (Math.random() - 0.5) * 8 : (Math.random() - 0.5) * 0.6;
        pool.grav[j] = sp.gravity;
        pool.color[j] = sp.color ?? (sp.kind === 'confetti' ? [0xff6f9c, 0xffd54a, 0x6ec6ff, 0xa5d66a, 0xb39ddb][Math.floor(Math.random() * 5)] : -1);
      }
    }

    for (const kind of KINDS) {
      const pool = sys.pools[kind]!;
      let i = pool.n - 1;
      for (; i >= 0; i--) {
        pool.age[i] += dt;
        if (pool.age[i] >= pool.life[i]) {
          const last = --pool.n;
          if (i !== last) {
            for (const arr of [pool.px, pool.py, pool.pz, pool.vx, pool.vy, pool.vz, pool.age, pool.life, pool.size, pool.spin, pool.grav]) arr[i] = arr[last];
            pool.color[i] = pool.color[last];
          }
        }
      }
      for (let k = 0; k < pool.n; k++) {
        pool.vy[k] -= pool.grav[k] * dt;
        pool.px[k] += pool.vx[k] * dt; pool.py[k] += pool.vy[k] * dt; pool.pz[k] += pool.vz[k] * dt;
        const t = pool.age[k] / pool.life[k];
        const pop = Math.min(1, pool.age[k] / 0.12);
        const fade = t > 0.7 ? (1 - t) / 0.3 : 1;
        let sc = pool.size[k] * pop * fade;
        if (kind === 'heart') sc *= 1 + 0.08 * Math.sin(pool.age[k] * 9);
        tmp.p.set(pool.px[k], pool.py[k], pool.pz[k]);
        tmp.sq.setFromAxisAngle(tmp.z, pool.spin[k] * pool.age[k]);
        tmp.q.copy(state.camera.quaternion).multiply(tmp.sq);
        tmp.s.set(sc, kind === 'confetti' ? sc * 0.7 : sc, 1);
        tmp.m.compose(tmp.p, tmp.q, tmp.s);
        pool.mesh.setMatrixAt(k, tmp.m);
        const col = pool.color[k];
        pool.mesh.setColorAt(k, col < 0 ? tmp.c.setRGB(1, 1, 1) : tmp.c.setHex(col));
      }
      pool.mesh.count = pool.n;
      pool.mesh.instanceMatrix.needsUpdate = true;
      if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
    }
  });

  return <primitive object={sys.group} />;
}
