import { Suspense, lazy, useEffect } from 'react';
import { useGameStore, stageForLevel } from './store/gameStore';
import { useUIStore, ROOMS } from './store/uiStore';
import { audio } from './audio/AudioManager';
import { rig } from './game/rig';
import { wake, resumeSleepIfNeeded, toggleSleep, cancelActivities } from './game/activities';
import { TopHud, BottomBar, ThoughtBubble } from './ui/HUD';
import { FoodMenu } from './ui/FoodMenu';
import { BathTools } from './ui/BathTools';
import { SettingsPanel } from './ui/Settings';
import { NameModal, WelcomeBack, LevelUp, Toast, Loading } from './ui/Modals';
import { DebugPanel } from './ui/DebugPanel';

// The whole 3D canvas (three + fiber + rooms) is a separate chunk, so the cute loading screen shows instantly.
const GameCanvas = lazy(() => import('./game/Scene'));

const TICK_SECONDS = 3;

function runTick() {
  const was = useGameStore.getState().sleeping;
  useGameStore.getState().tick(TICK_SECONDS);
  if (was && !useGameStore.getState().sleeping) wake(true); // fully rested: gentle wake-up
}

function showWelcome(res: ReturnType<ReturnType<typeof useGameStore.getState>['applyOffline']>) {
  if (res) useUIStore.getState().setWelcome({ elapsed: res.elapsed, before: res.before, after: res.after, wasSleeping: res.wasSleeping });
}

export default function App() {
  const settings = useGameStore((s) => s.settings);
  const level = useGameStore((s) => s.level);
  const sleeping = useGameStore((s) => s.sleeping);
  const room = useUIStore((s) => s.room);

  // language / direction / text size / reduced motion
  useEffect(() => {
    const root = document.documentElement;
    root.lang = settings.lang;
    root.dir = settings.lang === 'fa' ? 'rtl' : 'ltr';
    root.style.setProperty('--text-scale', String(settings.textScale));
    root.dataset.reduceMotion = String(settings.reduceMotion);
  }, [settings.lang, settings.textScale, settings.reduceMotion]);

  // audio volumes + voice pitch by life stage
  useEffect(() => { audio.setVolumes(settings); }, [settings]);
  useEffect(() => {
    audio.voicePitch = { baby: 1.3, kid: 1.15, teen: 1.05, adult: 1 }[stageForLevel(level)];
  }, [level]);

  // background music follows the room (lullaby while sleeping)
  useEffect(() => { audio.setMusic(sleeping ? 'sleep' : room); }, [room, sleeping]);

  // startup: offline progress + put her back to bed if she was asleep
  useEffect(() => {
    showWelcome(useGameStore.getState().applyOffline());
    resumeSleepIfNeeded();
    if (useGameStore.getState().sleeping && useGameStore.getState().needs.energy >= 100) wake(true);
  }, []);

  // audio may only start after a user gesture; keep trying until the context is running
  useEffect(() => {
    const unlock = () => audio.unlock();
    const evts = ['pointerdown', 'touchend', 'keydown'] as const;
    evts.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    return () => evts.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  // real-time needs decay
  useEffect(() => {
    const id = window.setInterval(() => { if (!document.hidden) runTick(); }, TICK_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, []);

  // tab hidden: pause rendering + audio and stamp the time. Tab visible: apply offline progress.
  useEffect(() => {
    const onVis = () => {
      const hidden = document.hidden;
      useUIStore.getState().setVisible(!hidden);
      if (hidden) {
        useGameStore.getState().touchTime(); // also forces a save
        audio.suspend();
        audio.purrStop();
      } else {
        audio.resume();
        showWelcome(useGameStore.getState().applyOffline());
      }
    };
    const onHide = () => useGameStore.getState().touchTime();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      cancelActivities();
    };
  }, []);

  // desktop shortcuts: arrows / A D = change room, Space = jump, E = interact, Esc = close, F2 = debug
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const ui = useUIStore.getState();
      const gs = useGameStore.getState();
      const step = (d: number) => {
        if (gs.sleeping || ui.bathMode) return;
        const i = ROOMS.indexOf(ui.room);
        ui.setRoom(ROOMS[(i + d + ROOMS.length) % ROOMS.length]);
      };
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': step(document.documentElement.dir === 'rtl' ? 1 : -1); break;
        case 'ArrowRight': case 'd': case 'D': step(document.documentElement.dir === 'rtl' ? -1 : 1); break;
        case ' ': e.preventDefault(); if (!gs.sleeping) { rig.play('hop', 0.75); audio.chirp(); } break;
        case 'e': case 'E':
          if (gs.sleeping) toggleSleep();
          else if (ui.room === 'kitchen') ui.setFoodOpen(!ui.foodOpen);
          else if (ui.room === 'bedroom') toggleSleep();
          break;
        case 'Escape':
          if (ui.panel !== 'none') ui.setPanel('none');
          else if (ui.foodOpen) ui.setFoodOpen(false);
          else ui.setPanel('settings');
          break;
        case 'F2': ui.toggleDebug(); break;
        default:
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app" onContextMenu={(e) => e.preventDefault()}>
      <Suspense fallback={null}>
        <GameCanvas />
      </Suspense>
      {sleeping && <div className="sleepdim" />}
      <TopHud />
      <ThoughtBubble />
      <BottomBar />
      <BathTools />
      <FoodMenu />
      <SettingsPanel />
      <NameModal />
      <WelcomeBack />
      <LevelUp />
      <Toast />
      <DebugPanel />
      <Loading />
    </div>
  );
}
