import { memo, useEffect, useRef } from 'react';
import { useGameStore, NEED_KEYS, xpNeeded, computeMood, stageForLevel, type NeedKey } from '../store/gameStore';
import { useUIStore, ROOMS, type Room } from '../store/uiStore';
import { useT } from '../i18n';
import { rig } from '../game/rig';
import { audio, haptic } from '../audio/AudioManager';
import { enterBath, startToilet, toggleSleep, playWith, hugHer } from '../game/activities';

const NEED_ICON: Record<NeedKey, string> = { hunger: '🍗', hygiene: '🫧', bladder: '🚽', energy: '💤', happiness: '😊', affection: '💗' };
const NEED_COLOR: Record<NeedKey, string> = {
  hunger: '#e8641a', hygiene: '#4fb3d9', bladder: '#b39ddb', energy: '#5c6b2a', happiness: '#f2b632', affection: '#ff6f9c',
};
const ROOM_ICON: Record<Room, string> = { living: '🛋️', kitchen: '🍳', bathroom: '🛁', bedroom: '🛏️' };

const NeedBar = memo(function NeedBar({ k }: { k: NeedKey }) {
  const v = useGameStore((s) => s.needs[k]);
  const cb = useGameStore((s) => s.settings.colorBlind);
  const t = useT();
  const pct = Math.round(v);
  return (
    <div className={'need' + (v < 25 ? ' low' : '')} role="img" aria-label={`${t('need.' + k)} ${pct}%`}>
      <span className="ico">{NEED_ICON[k]}</span>
      <div className="bar"><i className={cb ? 'stripes' : ''} style={{ width: pct + '%', background: NEED_COLOR[k] }} /></div>
      {cb && <b className="pct">{pct}</b>}
      {v < 25 && <span className="warn" aria-hidden>!</span>}
    </div>
  );
});

export function TopHud() {
  const t = useT();
  const level = useGameStore((s) => s.level);
  const xp = useGameStore((s) => s.xp);
  const coins = useGameStore((s) => s.coins);
  const gems = useGameStore((s) => s.gems);
  const name = useGameStore((s) => s.name);
  const stage = useGameStore((s) => stageForLevel(s.level));
  const setPanel = useUIStore((s) => s.setPanel);
  return (
    <div className="hud-top">
      <div className="hud-row">
        <div className="chip lvl">
          <div className="lvl-badge" aria-label={`Level ${level}`}>{level}</div>
          <div className="lvl-main">
            <div className="lvl-name">{name} · {t('stage.' + stage)}</div>
            <div className="xp"><i style={{ width: Math.min(100, (xp / xpNeeded(level)) * 100) + '%' }} /></div>
          </div>
        </div>
        <div className="chip" aria-label="coins">🪙 {coins}</div>
        <div className="chip" aria-label="gems">💎 {gems}</div>
        <button className="round" aria-label={t('settings.title')} onClick={() => { audio.unlock(); audio.click(); setPanel('settings'); }}>⚙️</button>
      </div>
      <div className="needs">
        {NEED_KEYS.map((k) => <NeedBar key={k} k={k} />)}
      </div>
    </div>
  );
}

/** Thought bubble above her head; position is written straight to the DOM every frame (no React re-render). */
export function ThoughtBubble() {
  const t = useT();
  const want = useGameStore((s) => computeMood(s.needs, s.sleeping).want);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = ref.current;
      if (el) {
        const { x, y } = rig.screen.head;
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.style.display = rig.screen.on ? 'block' : 'none';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!want) return null;
  const icon = ({ food: '🍗', toilet: '🚽', bed: '🛏️', bath: '🫧', heart: '💗' } as Record<string, string>)[want];
  return (
    <div className="thought" ref={ref} aria-live="polite">
      <div>{icon} {t('want.' + want)}</div>
    </div>
  );
}

export function BottomBar() {
  const t = useT();
  const room = useUIStore((s) => s.room);
  const setRoom = useUIStore((s) => s.setRoom);
  const setFoodOpen = useUIStore((s) => s.setFoodOpen);
  const bathMode = useUIStore((s) => s.bathMode);
  const sleeping = useGameStore((s) => s.sleeping);

  if (sleeping) {
    return (
      <div className="bottom">
        <button className="btn olive" onClick={() => { audio.unlock(); toggleSleep(); }}><span className="e">☀️</span>{t('act.wake')}</button>
      </div>
    );
  }
  if (bathMode) return null; // BathTools takes over the bottom area
  return (
    <div className="bottom">
      <div className="actions">
        {room === 'living' && (
          <>
            <button className="btn" onClick={() => { audio.unlock(); hugHer(); }}><span className="e">🤗</span>{t('act.hug')}</button>
            <button className="btn olive" onClick={() => { audio.unlock(); playWith(); }}><span className="e">🧶</span>{t('act.play')}</button>
          </>
        )}
        {room === 'kitchen' && (
          <button className="btn" onClick={() => { audio.unlock(); audio.click(); setFoodOpen(true); }}><span className="e">🍽️</span>{t('act.fridge')}</button>
        )}
        {room === 'bathroom' && (
          <>
            <button className="btn" onClick={() => { audio.unlock(); enterBath(); }}><span className="e">🧼</span>{t('act.bath')}</button>
            <button className="btn olive" onClick={() => { audio.unlock(); startToilet(); }}><span className="e">🚽</span>{t('act.toilet')}</button>
          </>
        )}
        {room === 'bedroom' && (
          <button className="btn olive" onClick={() => { audio.unlock(); toggleSleep(); }}><span className="e">🌙</span>{t('act.sleep')}</button>
        )}
      </div>
      <nav className="roomnav" aria-label="rooms">
        {ROOMS.map((r) => (
          <button key={r} aria-current={room === r} onClick={() => { audio.unlock(); if (r !== room) { audio.click(); haptic(8); setRoom(r); } }}>
            <span className="e">{ROOM_ICON[r]}</span>{t('room.' + r)}
          </button>
        ))}
      </nav>
    </div>
  );
}
