import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { FOODS, FOOD_CATS, type Food, type FoodCat } from '../data/foods';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { useT } from '../i18n';
import { rig } from '../game/rig';
import { serveFood } from '../game/activities';
import { audio } from '../audio/AudioManager';

/** Fridge: tap a food to serve it, or drag it to her mouth (Pointer Events). */
export function FoodMenu() {
  const t = useT();
  const open = useUIStore((s) => s.foodOpen);
  const setOpen = useUIStore((s) => s.setFoodOpen);
  const level = useGameStore((s) => s.level);
  const name = useGameStore((s) => s.name);
  const [cat, setCat] = useState<FoodCat>('fruits');
  const ghost = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; emoji: string; sx: number; sy: number; moved: boolean } | null>(null);

  if (!open) return null;

  const down = (f: Food, e: RPointerEvent) => {
    if (level < f.unlock) return;
    audio.unlock();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: f.id, emoji: f.emoji, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current;
    const g = ghost.current;
    if (!d || !g) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 10) {
      d.moved = true;
      g.textContent = d.emoji;
      g.style.display = 'block';
    }
    if (d.moved) g.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
  };
  const up = (e: RPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (ghost.current) ghost.current.style.display = 'none';
    if (!d) return;
    if (!d.moved) { serveFood(d.id); return; }
    const m = rig.screen.mouth;
    const reach = Math.max(90, Math.min(window.innerWidth, window.innerHeight) * 0.18);
    if (Math.hypot(e.clientX - m.x, e.clientY - m.y) < reach) serveFood(d.id);
  };

  const list = FOODS.filter((f) => f.cat === cat);
  return (
    <>
      <div className="sheet" role="dialog" aria-label={t('act.fridge')}>
        <div className="sheet-head">
          <h3>{t('food.title', { name })}</h3>
          <button className="round" aria-label={t('settings.close')} onClick={() => { audio.click(); setOpen(false); }}>✖️</button>
        </div>
        <p className="hint">{t('food.hint')}</p>
        <div className="tabs" role="tablist">
          {FOOD_CATS.map((c) => (
            <button key={c.id} className="tab" role="tab" aria-selected={cat === c.id} onClick={() => { audio.click(); setCat(c.id); }}>
              <span>{c.emoji}</span>{t('cat.' + c.id)}
            </button>
          ))}
        </div>
        <div className="foodgrid">
          {list.map((f) => {
            const locked = level < f.unlock;
            return (
              <button
                key={f.id}
                className={'food' + (locked ? ' locked' : '')}
                onPointerDown={(e) => down(f, e)}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={() => { drag.current = null; if (ghost.current) ghost.current.style.display = 'none'; }}
                aria-label={t('food.' + f.id)}
              >
                <span className="e">{f.emoji}</span>
                {t('food.' + f.id)}
                {locked && <span className="lock">🔒 {t('food.locked', { n: f.unlock })}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="ghost-food" ref={ghost} aria-hidden />
    </>
  );
}
