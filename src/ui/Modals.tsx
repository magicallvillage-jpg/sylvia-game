import { useEffect, useState } from 'react';
import { useGameStore, NEED_KEYS, type NeedKey } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { FOODS } from '../data/foods';
import { useT, formatDuration } from '../i18n';
import { audio, haptic } from '../audio/AudioManager';
import { fx } from '../game/fx';
import { rig } from '../game/rig';

const NEED_ICON: Record<NeedKey, string> = { hunger: '🍗', hygiene: '🫧', bladder: '🚽', energy: '💤', happiness: '😊', affection: '💗' };

export function NameModal() {
  const t = useT();
  const onboarded = useGameStore((s) => s.onboarded);
  const setName = useGameStore((s) => s.setName);
  const ready = useUIStore((s) => s.sceneReady);
  const [val, setVal] = useState('');
  if (onboarded || !ready) return null;
  const go = () => { audio.unlock(); audio.chirp(); haptic(15); setName(val || t('name.placeholder')); };
  return (
    <div className="back">
      <div className="modal" role="dialog" aria-label={t('name.title')}>
        <div className="big">🥚</div>
        <h2>{t('name.title')}</h2>
        <p>{t('name.body')}</p>
        <input
          type="text" value={val} maxLength={16} placeholder={t('name.placeholder')} aria-label={t('name.title')}
          onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()}
        />
        <button className="btn" onClick={go}>{t('name.start')}</button>
        <div className="paws" aria-hidden>🐾 🐾 🐾</div>
      </div>
    </div>
  );
}

export function WelcomeBack() {
  const t = useT();
  const w = useUIStore((s) => s.welcome);
  const setWelcome = useUIStore((s) => s.setWelcome);
  const name = useGameStore((s) => s.name);
  const lang = useGameStore((s) => s.settings.lang);
  if (!w) return null;
  const changed = NEED_KEYS.filter((k) => Math.round(w.before[k]) !== Math.round(w.after[k]));
  return (
    <div className="back">
      <div className="modal" role="dialog" aria-label={t('welcome.title')}>
        <div className="big">🐱</div>
        <h2>{t('welcome.title')}</h2>
        <p>{t('welcome.body', { name, time: formatDuration(lang, w.elapsed) })}</p>
        {changed.length > 0 && (
          <>
            <p><b>{t('welcome.changes')}</b></p>
            <div className="changes">
              {changed.map((k) => {
                const d = Math.round(w.after[k] - w.before[k]);
                return <span key={k}>{NEED_ICON[k]} {d > 0 ? '+' : ''}{d}</span>;
              })}
            </div>
          </>
        )}
        <button className="btn olive" onClick={() => { audio.unlock(); audio.chirp(); setWelcome(null); }}>{t('welcome.continue')}</button>
      </div>
    </div>
  );
}

export function LevelUp() {
  const t = useT();
  const level = useUIStore((s) => s.levelUp);
  const setLevelUp = useUIStore((s) => s.setLevelUp);
  const name = useGameStore((s) => s.name);

  // celebration: confetti + jingle + happy dance
  useEffect(() => {
    if (level == null) return;
    audio.levelUp();
    haptic([20, 40, 20, 40, 60]);
    rig.play('cheer', 2.6);
    rig.express('laughing', 2.6);
    const p = rig.faceWorld;
    for (let i = 0; i < 4; i++) window.setTimeout(() => fx.emit('confetti', { x: p.x, y: p.y + 0.6, z: p.z + 0.3 }, 18), i * 220);
    fx.emit('star', p, 8);
  }, [level]);

  if (level == null) return null;
  const unlocked = FOODS.filter((f) => f.unlock === level);
  return (
    <div className="back" onClick={() => setLevelUp(null)}>
      <div className="modal" role="dialog" aria-label={t('levelup.title', { n: level })} onClick={(e) => e.stopPropagation()}>
        <div className="big">🎉</div>
        <h2>{t('levelup.title', { n: level })}</h2>
        <p>{t('levelup.body', { name, coins: level * 10 })}</p>
        {unlocked.length > 0 && (
          <>
            <p><b>{t('levelup.unlocks')}</b></p>
            <div className="changes">{unlocked.map((f) => <span key={f.id}>{f.emoji} {t('food.' + f.id)}</span>)}</div>
          </>
        )}
        <button className="btn" onClick={() => { audio.coin(); setLevelUp(null); }}>OK</button>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useUIStore((s) => s.toast);
  if (!toast) return null;
  return <div key={toast.id} className="toast" role="status">{toast.text}</div>;
}

export function Loading() {
  const t = useT();
  const ready = useUIStore((s) => s.sceneReady);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => setGone(true), 600);
    return () => window.clearTimeout(id);
  }, [ready]);
  if (gone) return null;
  return (
    <div className={'loading' + (ready ? ' done' : '')} role="progressbar" aria-label={t('loading')}>
      <div className="mascot">🐱</div>
      <div className="loadbar"><i /></div>
      <div>{t('loading')}</div>
      <div className="paws" aria-hidden>🐾 🍃 🐾</div>
    </div>
  );
}
