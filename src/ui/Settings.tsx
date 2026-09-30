import { useRef } from 'react';
import { useGameStore, type Quality, type Settings as S } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { useT, tr } from '../i18n';
import { audio } from '../audio/AudioManager';
import { cancelActivities } from '../game/activities';
import { rig } from '../game/rig';

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => { audio.click(); onChange(!on); }} />;
}

function VolumeRow({ label, vol, mute, onVol, onMute }: { label: string; vol: number; mute: boolean; onVol: (v: number) => void; onMute: (m: boolean) => void }) {
  const t = useT();
  return (
    <div className="row">
      <label>{label}</label>
      <input type="range" min={0} max={1} step={0.05} value={vol} aria-label={label} onChange={(e) => onVol(Number(e.target.value))} />
      <button className="round" aria-pressed={mute} aria-label={`${t('settings.mute')} ${label}`} onClick={() => onMute(!mute)}>{mute ? '🔇' : '🔊'}</button>
    </div>
  );
}

export function SettingsPanel() {
  const t = useT();
  const panel = useUIStore((s) => s.panel);
  const setPanel = useUIStore((s) => s.setPanel);
  const st = useGameStore((s) => s.settings);
  const set = useGameStore((s) => s.setSettings);
  const file = useRef<HTMLInputElement>(null);
  if (panel === 'none') return null;
  const up = (p: Partial<S>) => set(p);
  const close = () => { audio.click(); setPanel('none'); };

  if (panel === 'about') {
    return (
      <div className="back" onClick={close}>
        <div className="modal" role="dialog" aria-label={t('about.title')} onClick={(e) => e.stopPropagation()}>
          <div className="big">🐾</div>
          <h2>{t('about.title')}</h2>
          <p>{t('about.body')}</p>
          <button className="btn olive" onClick={() => setPanel('settings')}>{t('settings.close')}</button>
        </div>
      </div>
    );
  }
  if (panel === 'reset') {
    return (
      <div className="back">
        <div className="modal" role="alertdialog" aria-label={t('reset.title')}>
          <div className="big">⚠️</div>
          <h2>{t('reset.title')}</h2>
          <p>{t('reset.body')}</p>
          <button className="btn olive" onClick={() => setPanel('settings')}>{t('reset.cancel')}</button>
          <button
            className="btn ghost"
            onClick={() => {
              cancelActivities();
              rig.unlock(); rig.setBase(null); rig.stop();
              useUIStore.getState().setBath(false);
              useGameStore.getState().resetProgress();
              useUIStore.getState().setRoom('living');
              setPanel('none');
            }}
          >{t('reset.confirm')}</button>
        </div>
      </div>
    );
  }

  const exportSave = () => {
    const blob = new Blob([useGameStore.getState().exportSave()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sylvia-save.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importSave = async (f: File | undefined) => {
    if (!f) return;
    const ok = useGameStore.getState().importSave(await f.text());
    useUIStore.getState().showToast(tr(ok ? 'toast.imported' : 'toast.importFail'));
    if (ok) setPanel('none');
  };

  return (
    <div className="back" onClick={close}>
      <div className="modal" role="dialog" aria-label={t('settings.title')} onClick={(e) => e.stopPropagation()}>
        <h2>{t('settings.title')}</h2>
        <div className="stack">
          <div className="row">
            <label>{t('settings.language')}</label>
            <div className="seg">
              <button aria-pressed={st.lang === 'en'} onClick={() => up({ lang: 'en' })}>English</button>
              <button aria-pressed={st.lang === 'fa'} onClick={() => up({ lang: 'fa' })}>فارسی</button>
            </div>
          </div>
          <div className="row">
            <label>{t('settings.quality')}</label>
            <div className="seg">
              {(['low', 'medium', 'high'] as Quality[]).map((q) => (
                <button key={q} aria-pressed={st.quality === q} onClick={() => up({ quality: q })}>{t('settings.' + q)}</button>
              ))}
            </div>
          </div>
          <VolumeRow label={t('settings.music')} vol={st.music} mute={st.muteMusic} onVol={(v) => up({ music: v })} onMute={(m) => up({ muteMusic: m })} />
          <VolumeRow label={t('settings.sfx')} vol={st.sfx} mute={st.muteSfx} onVol={(v) => { up({ sfx: v }); audio.unlock(); }} onMute={(m) => up({ muteSfx: m })} />
          <VolumeRow label={t('settings.voice')} vol={st.voice} mute={st.muteVoice} onVol={(v) => up({ voice: v })} onMute={(m) => up({ muteVoice: m })} />
          <div className="row"><label>{t('settings.vibration')}</label><Switch on={st.vibration} onChange={(v) => up({ vibration: v })} label={t('settings.vibration')} /></div>
          <div className="row">
            <label>{t('settings.textSize')}</label>
            <input type="range" min={0.9} max={1.35} step={0.05} value={st.textScale} aria-label={t('settings.textSize')} onChange={(e) => up({ textScale: Number(e.target.value) })} />
          </div>
          <div className="row"><label>{t('settings.colorBlind')}</label><Switch on={st.colorBlind} onChange={(v) => up({ colorBlind: v })} label={t('settings.colorBlind')} /></div>
          <div className="row"><label>{t('settings.reduceMotion')}</label><Switch on={st.reduceMotion} onChange={(v) => up({ reduceMotion: v })} label={t('settings.reduceMotion')} /></div>
          <div className="actions">
            <button className="btn ghost" onClick={exportSave}>💾 {t('settings.export')}</button>
            <button className="btn ghost" onClick={() => file.current?.click()}>📂 {t('settings.import')}</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void importSave(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          <div className="actions">
            <button className="btn ghost" onClick={() => setPanel('about')}>ℹ️ {t('settings.about')}</button>
            <button className="btn ghost" onClick={() => setPanel('reset')}>🗑️ {t('settings.reset')}</button>
          </div>
        </div>
        <button className="btn olive" onClick={close}>{t('settings.close')}</button>
      </div>
    </div>
  );
}
