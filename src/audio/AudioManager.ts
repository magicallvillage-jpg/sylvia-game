import { useGameStore, type Settings } from '../store/gameStore';

type Bus = 'sfx' | 'voice' | 'music';
interface ToneOpts { type?: OscillatorType; gain?: number; to?: number; delay?: number; attack?: number }
interface NoiseOpts { freq?: number; to?: number; q?: number; gain?: number; delay?: number; type?: BiquadFilterType }

const SCALES: Record<string, { notes: number[]; beat: number; wave: OscillatorType; gain: number }> = {
  living: { notes: [261.63, 293.66, 329.63, 392, 440, 523.25], beat: 0.5, wave: 'triangle', gain: 0.07 },
  kitchen: { notes: [293.66, 329.63, 369.99, 440, 493.88, 587.33], beat: 0.4, wave: 'triangle', gain: 0.07 },
  bathroom: { notes: [392, 440, 493.88, 587.33, 659.25, 783.99], beat: 0.36, wave: 'sine', gain: 0.06 },
  bedroom: { notes: [196, 220, 246.94, 293.66, 329.63], beat: 0.7, wave: 'sine', gain: 0.06 },
  sleep: { notes: [174.61, 196, 220, 261.63, 293.66], beat: 1.1, wave: 'sine', gain: 0.055 },
};

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private buses = {} as Record<Bus, GainNode>;
  private noiseBuf: AudioBuffer | null = null;
  private purr: { src: AudioBufferSourceNode; lfo: OscillatorNode } | null = null;
  private musicTimer = 0;
  private musicName = '';
  private nextBar = 0;
  private step = 0;
  private vol: Pick<Settings, 'music' | 'sfx' | 'voice' | 'muteMusic' | 'muteSfx' | 'muteVoice'> = {
    music: 0.5, sfx: 0.8, voice: 0.8, muteMusic: false, muteSfx: false, muteVoice: false,
  };
  /** 1 = adult; babies are squeakier. */
  voicePitch = 1.25;

  /** Call from any user gesture. Creates the context on first use and resumes it if suspended. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch { return; }
      const master = this.ctx.createGain();
      master.gain.value = 0.9;
      master.connect(this.ctx.destination);
      for (const b of ['sfx', 'voice', 'music'] as Bus[]) {
        const g = this.ctx.createGain();
        g.connect(master);
        this.buses[b] = g;
      }
      this.applyVolumes();
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().then(() => this.ensureMusic());
    else this.ensureMusic();
  }

  suspend() { if (this.ctx?.state === 'running') void this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume(); }

  setVolumes(s: Settings) {
    this.vol = { music: s.music, sfx: s.sfx, voice: s.voice, muteMusic: s.muteMusic, muteSfx: s.muteSfx, muteVoice: s.muteVoice };
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.buses.music.gain.setTargetAtTime(this.vol.muteMusic ? 0 : this.vol.music, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(this.vol.muteSfx ? 0 : this.vol.sfx, t, 0.05);
    this.buses.voice.gain.setTargetAtTime(this.vol.muteVoice ? 0 : this.vol.voice, t, 0.05);
  }

  private ready(): AudioContext | null {
    return this.ctx && this.ctx.state === 'running' ? this.ctx : null;
  }

  private tone(bus: Bus, freq: number, dur: number, o: ToneOpts = {}) {
    const c = this.ready();
    if (!c) return;
    const t = c.currentTime + (o.delay ?? 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    const a = o.attack ?? 0.01;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.buses[bus]);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(bus: Bus, dur: number, o: NoiseOpts = {}) {
    const c = this.ready();
    if (!c || !this.noiseBuf) return;
    const t = c.currentTime + (o.delay ?? 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq ?? 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q ?? 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t + Math.min(0.04, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.buses[bus]);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private v(f: number) { return f * this.voicePitch; }

  // ------------------------------------------------------------- UI + effects
  click() { this.tone('sfx', 900, 0.06, { type: 'triangle', gain: 0.12, to: 1200 }); }
  pop() { this.tone('sfx', 500, 0.08, { type: 'sine', gain: 0.18, to: 1400 }); }
  coin() { this.tone('sfx', 988, 0.09, { type: 'square', gain: 0.07 }); this.tone('sfx', 1319, 0.22, { type: 'square', gain: 0.07, delay: 0.08 }); }
  levelUp() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone('sfx', f, 0.35, { type: 'triangle', gain: 0.14, delay: i * 0.11 })); }
  chew() { this.noise('sfx', 0.09, { freq: 900, q: 2, gain: 0.35 }); this.tone('sfx', 180, 0.07, { type: 'sine', gain: 0.1, to: 120 }); }
  splash() { this.noise('sfx', 0.4, { freq: 1800, to: 600, q: 0.8, gain: 0.3 }); }
  squeak() { this.tone('sfx', 1700 + Math.random() * 400, 0.08, { type: 'triangle', gain: 0.1, to: 2400 }); }
  flush() {
    this.noise('sfx', 1.5, { freq: 900, to: 250, q: 0.7, gain: 0.35 });
    this.tone('sfx', 140, 0.9, { type: 'sine', gain: 0.1, to: 70, delay: 0.5 });
  }
  boop() { this.tone('sfx', 320, 0.12, { type: 'sine', gain: 0.2, to: 200 }); }

  // ------------------------------------------------------------- voice (synthesised kitten)
  meow(p = 1) {
    const b = this.v(560 * p);
    this.tone('voice', b, 0.14, { type: 'triangle', gain: 0.16, to: b * 1.6 });
    this.tone('voice', b * 1.6, 0.3, { type: 'triangle', gain: 0.16, to: b * 0.9, delay: 0.13 });
  }
  chirp() {
    const b = this.v(700);
    this.tone('voice', b, 0.08, { type: 'sine', gain: 0.16, to: b * 1.5 });
    this.tone('voice', b * 1.3, 0.1, { type: 'sine', gain: 0.16, to: b * 1.9, delay: 0.09 });
  }
  yum() { const b = this.v(620); this.tone('voice', b, 0.12, { type: 'sine', gain: 0.15, to: b * 1.3 }); this.tone('voice', b * 1.3, 0.16, { type: 'sine', gain: 0.15, to: b * 0.95, delay: 0.1 }); }
  giggle() { for (let i = 0; i < 5; i++) this.tone('voice', this.v(780 + (i % 2) * 220), 0.07, { type: 'triangle', gain: 0.14, delay: i * 0.085 }); }
  hmph() { const b = this.v(330); this.tone('voice', b, 0.22, { type: 'sawtooth', gain: 0.07, to: b * 0.7 }); }
  bleh() { const b = this.v(420); this.tone('voice', b, 0.3, { type: 'sawtooth', gain: 0.06, to: b * 0.55 }); }
  cry() { const b = this.v(640); this.tone('voice', b, 0.35, { type: 'triangle', gain: 0.14, to: b * 0.7 }); }
  burp() { this.tone('voice', 150, 0.32, { type: 'sawtooth', gain: 0.1, to: 65 }); }
  yawn() { const b = this.v(500); this.tone('voice', b, 0.9, { type: 'sine', gain: 0.1, to: b * 0.6, attack: 0.3 }); }

  purrStart() {
    const c = this.ready();
    if (!c || this.purr || !this.noiseBuf) return;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const g = c.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.16, c.currentTime, 0.15);
    const lfo = c.createOscillator();
    lfo.frequency.value = 24;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.09;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.buses.voice);
    src.start();
    lfo.start();
    this.purr = { src, lfo };
  }
  purrStop() {
    const c = this.ctx;
    if (!c || !this.purr) return;
    const { src, lfo } = this.purr;
    this.purr = null;
    try { src.stop(c.currentTime + 0.05); lfo.stop(c.currentTime + 0.05); } catch { /* already stopped */ }
  }

  // ------------------------------------------------------------- music (soft procedural loops)
  setMusic(name: string) {
    this.musicName = name;
    this.nextBar = 0;
    this.step = 0;
    this.ensureMusic();
  }
  private ensureMusic() {
    window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
    if (!this.musicName || !this.ready()) return;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 250);
  }
  private scheduleMusic() {
    const c = this.ready();
    const sc = SCALES[this.musicName];
    if (!c || !sc) return;
    if (this.nextBar < c.currentTime) this.nextBar = c.currentTime + 0.1;
    while (this.nextBar < c.currentTime + 0.6) {
      const idx = (this.step * 2 + Math.floor(Math.random() * 3)) % sc.notes.length;
      const f = sc.notes[idx] * (this.step % 4 === 0 ? 0.5 : 1);
      const t0 = this.nextBar - c.currentTime;
      this.tone('music', f, sc.beat * 1.8, { type: sc.wave, gain: sc.gain, delay: t0, attack: 0.04 });
      if (this.step % 4 === 2) this.tone('music', f * 1.5, sc.beat * 1.2, { type: sc.wave, gain: sc.gain * 0.6, delay: t0 + sc.beat * 0.5 });
      this.nextBar += sc.beat;
      this.step++;
    }
  }
}

export const audio = new AudioManagerImpl();

/** Haptics through navigator.vibrate, respecting the user's setting. */
export function haptic(pattern: number | number[] = 12) {
  try {
    if (useGameStore.getState().settings.vibration && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch { /* unsupported */ }
}
