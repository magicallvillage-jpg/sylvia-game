import { useEffect, useState } from 'react';
import { useUIStore, type BathTool } from '../store/uiStore';
import { useGameStore } from '../store/gameStore';
import { useT } from '../i18n';
import { bath, exitBath, setBathTool } from '../game/activities';

const TOOLS: { id: BathTool; emoji: string }[] = [
  { id: 'sponge', emoji: '🧼' }, { id: 'shower', emoji: '🚿' }, { id: 'towel', emoji: '🧺' },
];

export function BathTools() {
  const t = useT();
  const on = useUIStore((s) => s.bathMode);
  const tool = useUIStore((s) => s.bathTool);
  const name = useGameStore((s) => s.name);
  const [prog, setProg] = useState({ foam: 0, wet: 0 });

  // meters are read from the mutable bath object ~7x/second (not per frame)
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setProg({ foam: bath.foam, wet: bath.wet }), 140);
    return () => window.clearInterval(id);
  }, [on]);

  if (!on) return null;
  const shown = tool === 'sponge' ? prog.foam : tool === 'shower' ? 1 - prog.foam : 1 - prog.wet;
  return (
    <div className="bottom">
      <div className="bubble-hint">{t('bath.hint.' + tool, { name })}</div>
      <div className="meter" aria-hidden><i style={{ width: Math.round(shown * 100) + '%' }} /></div>
      <div className="tools" role="group">
        {TOOLS.map((x) => (
          <button key={x.id} className="tool" aria-pressed={tool === x.id} onClick={() => setBathTool(x.id)}>
            <span className="e">{x.emoji}</span>{t('bath.' + x.id)}
          </button>
        ))}
      </div>
      <button className="btn ghost" onClick={exitBath}>{t('act.back')}</button>
    </div>
  );
}
