import { useDebugStore } from '../store/debugStore';
import { useUIStore } from '../store/uiStore';
import { useGameStore } from '../store/gameStore';
import { modelConfig as cfg } from '../config/modelConfig';

const EXPRS = ['auto', 'normal', 'happy', 'angry', 'sleepy', 'sad', 'eating', 'surprised', 'dizzy', 'embarrassed', 'sick', 'laughing'];

function Slider({ label, k, min, max, step = 0.01 }: { label: string; k: 'scaleMul' | 'yaw' | 'ox' | 'oy' | 'oz' | 'fx' | 'fy' | 'fz' | 'fscale' | 'frot'; min: number; max: number; step?: number }) {
  const v = useDebugStore((s) => s[k]);
  const set = useDebugStore((s) => s.set);
  return (
    <label>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set({ [k]: Number(e.target.value) })} />
      <code>{v.toFixed(2)}</code>
    </label>
  );
}

/** Dev-only model inspector (toggle with F2). */
export function DebugPanel() {
  const open = useUIStore((s) => s.debugOpen);
  const info = useDebugStore((s) => s.info);
  const d = useDebugStore();
  if (!import.meta.env.DEV || !open) return null;
  const copy = () => {
    const json = JSON.stringify({
      scaleMul: d.scaleMul, yaw: d.yaw, offset: [d.ox, d.oy, d.oz],
      face: { dx: d.fx, dy: d.fy, dz: d.fz, scale: d.fscale, rotZ: d.frot, showOnNormal: d.showOnNormal ?? cfg.face.showOnNormal, mask: d.mask ?? cfg.face.mask },
    }, null, 2);
    void navigator.clipboard?.writeText(json);
    console.log(json);
  };
  const list = (a: string[]) => (a.length ? a.join(', ') : '(none)');
  return (
    <div className="debug">
      <b>Sylvia debug (F2)</b>
      {info && (
        <>
          <h4>Model</h4>
          <div>{info.source}</div>
          <div>{info.layers}</div>
          <div>face method: <code>{info.faceMethod}</code></div>
          <h4>Mapped nodes</h4>
          <code>{Object.entries(info.mapped).map(([k, v]) => `${k}=${v}`).join('  ') || '(none – whole-body animation only)'}</code>
          <h4>Bones ({info.bones.length})</h4><code>{list(info.bones.slice(0, 60))}</code>
          <h4>Meshes ({info.meshes.length})</h4><code>{list(info.meshes)}</code>
          <h4>Morph targets</h4><code>{list(info.morphs)}</code>
          <h4>Clips</h4><code>{list(info.clips)}</code>
        </>
      )}
      <h4>Expression</h4>
      <select value={d.forceExpr} onChange={(e) => d.set({ forceExpr: e.target.value })}>{EXPRS.map((x) => <option key={x}>{x}</option>)}</select>
      <h4>Model</h4>
      <Slider label="scale ×" k="scaleMul" min={0.5} max={1.5} />
      <Slider label="yaw" k="yaw" min={-3.15} max={3.15} />
      <Slider label="offset x" k="ox" min={-0.5} max={0.5} />
      <Slider label="offset y" k="oy" min={-0.5} max={0.5} />
      <Slider label="offset z" k="oz" min={-0.5} max={0.5} />
      <h4>Face overlay</h4>
      <Slider label="x" k="fx" min={-0.2} max={0.2} step={0.002} />
      <Slider label="y" k="fy" min={-0.2} max={0.2} step={0.002} />
      <Slider label="z" k="fz" min={-0.1} max={0.1} step={0.001} />
      <Slider label="scale" k="fscale" min={0.5} max={1.6} />
      <Slider label="rotate" k="frot" min={-0.6} max={0.6} />
      <label><span>show always</span><input type="checkbox" checked={d.showOnNormal ?? cfg.face.showOnNormal} onChange={(e) => d.set({ showOnNormal: e.target.checked })} /></label>
      <label><span>skin mask</span><input type="checkbox" checked={d.mask ?? cfg.face.mask} onChange={(e) => d.set({ mask: e.target.checked })} /></label>
      <h4>Cheats</h4>
      <button onClick={() => useGameStore.setState((s) => ({ needs: { hunger: 20, hygiene: 20, bladder: 20, energy: 20, happiness: 30, affection: 30 }, sleeping: s.sleeping }))}>needs → 20</button>
      <button onClick={() => useGameStore.getState().addXp(200)}>+200 xp</button>
      <button onClick={copy}>Copy config JSON</button>
    </div>
  );
}
