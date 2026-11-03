/* CYBERSLIDE - audio: 90s drum & bass with R&B harmony, plus sfx, generated with WebAudio */

import { ND } from './nd';

// set up together in audio.init(); everything below only runs once ctx exists
let ctx: AudioContext | null = null;
let master!: GainNode,
  musicBus!: GainNode,
  sfxBus!: GainNode,
  fxBus!: GainNode,
  noiseBuf!: AudioBuffer;
let carveGain!: GainNode,
  carveFilt!: BiquadFilterNode,
  grindGain!: GainNode,
  grindOsc!: OscillatorNode;
/** the live context; only called from code that runs after init() */
const ac = (): AudioContext => ctx as AudioContext;
let muted = false,
  vMusic = 1,
  vSfx = 1,
  musicOn = false,
  step = 0,
  nextT = 0;
let timer: ReturnType<typeof setInterval> | null = null;
export const BPM = 174,
  S16 = 60 / BPM / 4;
/** MIDI note number to Hz */
export const mtof = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

// 90s drum & bass with R&B harmony, G minor, two bars per chord: Gm9  Ebmaj9  Cm9  D7(b9)
interface Chord {
  root: number;
  iv: number[];
  bass: number;
}
const CH: Chord[] = [
  { root: 55, iv: [0, 3, 7, 10, 14], bass: 43 },
  { root: 51, iv: [0, 4, 7, 11, 14], bass: 39 },
  { root: 48, iv: [0, 3, 7, 10, 14], bass: 36 },
  { root: 50, iv: [0, 4, 7, 10, 13], bass: 38 },
];
// kick patterns, rotating every bar (classic two-step with pushes)
const KICKS: number[][] = [
  [0, 10],
  [0, 10],
  [0, 7, 10],
  [0, 10, 13],
];
// rolling bass: [step, semitones above the root, length in steps]
const BASS: [number, number, number][][] = [
  [
    [0, 0, 6],
    [6, 0, 2],
    [10, 0, 3],
    [14, 7, 2],
  ],
  [
    [0, 0, 5],
    [6, 12, 1],
    [8, 0, 2],
    [10, 7, 3],
    [14, 5, 2],
  ],
];
// R&B vocal-style hook, per chord: [step, semitones above the chord root + 1 octave, length in steps]
const LEAD: [number, number, number][][] = [
  [
    [0, 7, 3],
    [3, 10, 2],
    [6, 12, 5],
    [12, 10, 2],
    [14, 7, 2],
  ],
  [
    [0, 7, 3],
    [3, 11, 2],
    [6, 14, 5],
    [12, 11, 2],
    [14, 7, 2],
  ],
  [
    [0, 10, 3],
    [3, 12, 2],
    [6, 15, 5],
    [12, 12, 2],
    [14, 10, 2],
  ],
  [
    [0, 10, 2],
    [2, 13, 2],
    [4, 16, 4],
    [10, 13, 2],
    [12, 10, 3],
    [15, 7, 1],
  ],
];

function env(g: GainNode, t: number, a: number, d: number, peak: number): void {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(
  type: OscillatorType,
  f: number,
  t: number,
  dur: number,
  vol: number,
  bus?: AudioNode,
  cutoff?: number,
): void {
  const ctx = ac(),
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.frequency.value = f;
  let out: AudioNode = o;
  if (cutoff) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    o.connect(lp);
    out = lp;
  }
  out.connect(g);
  g.connect(bus || musicBus);
  env(g, t, 0.01, dur, vol);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function noise(
  t: number,
  dur: number,
  vol: number,
  hp: number,
  bus?: AudioNode,
  lpf?: number,
): void {
  const ctx = ac(),
    s = ctx.createBufferSource(),
    g = ctx.createGain(),
    f = ctx.createBiquadFilter();
  s.buffer = noiseBuf;
  f.type = 'highpass';
  f.frequency.value = hp;
  s.connect(f);
  let out: AudioNode = f;
  if (lpf) {
    const l = ctx.createBiquadFilter();
    l.type = 'lowpass';
    l.frequency.value = lpf;
    f.connect(l);
    out = l;
  }
  out.connect(g);
  g.connect(bus || musicBus);
  env(g, t, 0.002, dur, vol);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

/* ---- drums ---- */
function kick(t: number, v: number): void {
  const ctx = ac(),
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.07);
  o.connect(g);
  g.connect(musicBus);
  env(g, t, 0.002, 0.2, 1.0 * v);
  o.start(t);
  o.stop(t + 0.3);
  noise(t, 0.012, 0.25 * v, 3000, musicBus); // beater click
}
function snare(t: number, v: number): void {
  // hard, cracking break snare
  noise(t, 0.15, 0.55 * v, 1500, musicBus, 10000);
  tone('triangle', 230, t, 0.09, 0.4 * v, musicBus);
  tone('sine', 160, t, 0.07, 0.3 * v, musicBus);
  noise(t, 0.3, 0.07 * v, 2200, fxBus);
}
const hat = (t: number, v: number, open: boolean) => noise(t, open ? 0.13 : 0.028, v, 7800);

/* ---- melodic voices ---- */
function keys(f: number, t: number, dur: number, vol: number): void {
  // electric piano
  const ctx = ac(),
    lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3400;
  lp.connect(fxBus);
  const parts = [
    [1, 1, dur],
    [2, 0.3, dur * 0.5],
    [7.1, 0.07, 0.06],
  ];
  for (const [m, a, d] of parts) {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * m;
    o.connect(g);
    g.connect(lp);
    env(g, t, 0.004, d, vol * a);
    o.start(t);
    o.stop(t + d + 0.05);
  }
}
function pad(notes: number[], t: number, dur: number, vol: number): void {
  const ctx = ac(),
    lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1100;
  lp.connect(fxBus);
  for (const n of notes)
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = mtof(n);
      o.detune.value = det;
      o.connect(g);
      g.connect(lp);
      env(g, t, dur * 0.35, dur * 0.65, vol);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
}
function voice(f: number, t: number, dur: number, vol: number): void {
  // vocal-like "ah" lead with a slide in and vibrato
  const ctx = ac(),
    o = ctx.createOscillator(),
    g = ctx.createGain(),
    lfo = ctx.createOscillator(),
    lg = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f * 0.93, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  lfo.frequency.value = 5.8;
  lg.gain.value = f * 0.008;
  lfo.connect(lg);
  lg.connect(o.frequency);
  g.connect(fxBus);
  for (const [fc, q, a] of [
    [820, 5, 1],
    [1250, 6, 0.6],
    [2700, 4, 0.25],
  ]) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = fc;
    bp.Q.value = q;
    const bg = ctx.createGain();
    bg.gain.value = a;
    o.connect(bp);
    bp.connect(bg);
    bg.connect(g);
  }
  env(g, t, 0.03, dur, vol);
  o.start(t);
  lfo.start(t);
  o.stop(t + dur + 0.1);
  lfo.stop(t + dur + 0.1);
}
function bass(note: number, t: number, dur: number, vol: number): void {
  // sub + a growling reese layer
  const f = mtof(note);
  tone('sine', f / 2, t, dur, vol, musicBus);
  const ctx = ac(),
    lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 4;
  lp.frequency.setValueAtTime(1500, t);
  lp.frequency.exponentialRampToValueAtTime(380, t + Math.min(0.25, dur));
  const g = ctx.createGain();
  lp.connect(g);
  g.connect(musicBus);
  for (const det of [-14, 14]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = det;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  env(g, t, 0.006, dur, vol * 0.45);
}

function schedule(i: number, t: number): void {
  const bar = Math.floor(i / 16) % 8,
    st = i % 16,
    ci = Math.floor(bar / 2),
    ch = CH[ci],
    alt = bar % 2;

  // drums: two-step kick, hard snare on 2 and 4, ghost snares and rolling hats
  if (KICKS[bar % 4].includes(st)) kick(t, st === 0 ? 1 : 0.85);
  if (st === 4 || st === 12) snare(t, 1);
  if (st === 7 || st === 15) snare(t, bar % 4 === 3 ? 0.3 : 0.16);
  if (st === 9 && alt) snare(t, 0.14);
  if (bar === 7 && st >= 12) snare(t, 0.35 + (st - 12) * 0.14); // roll into the loop
  hat(t, st % 4 === 2 ? 0.085 : st % 2 === 0 ? 0.055 : 0.03, false);
  if (st === 14 && alt) hat(t, 0.08, true);

  // rolling bass
  for (const [bs, semi, len] of BASS[alt])
    if (bs === st) bass(ch.bass + semi, t, S16 * len * 0.95, 0.55);

  // electric piano comping, pad underneath
  const comp = alt ? [0, 3, 10, 14] : [0, 6, 10];
  if (comp.includes(st))
    ch.iv.forEach((x, k) =>
      keys(
        mtof(ch.root + x),
        t + k * 0.005,
        st === 0 ? S16 * 5 : S16 * 2.5,
        st === 0 ? 0.07 : 0.055,
      ),
    );
  if (st === 0 && alt === 0)
    pad(
      ch.iv.slice(0, 4).map((x) => ch.root + x - 12),
      t,
      S16 * 30,
      0.012,
    );

  // R&B hook from bar 3 on, an octave up on the second bar of each chord
  if (bar >= 2)
    for (const [ls, semi, len] of LEAD[ci])
      if (ls === st)
        voice(mtof(ch.root + 12 + semi + (alt && ls >= 10 ? 12 : 0)), t, S16 * len * 1.2, 0.07);
}
function tick(): void {
  while (nextT < ac().currentTime + 0.25) {
    schedule(step, nextT);
    nextT += S16;
    step++;
  }
}

function buildReverb(): ConvolverNode {
  const ctx = ac(),
    len = Math.floor(ctx.sampleRate * 2.4),
    buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const cv = ctx.createConvolver();
  cv.buffer = buf;
  return cv;
}

export type SfxName =
  | 'jump'
  | 'land'
  | 'trick'
  | 'bank'
  | 'crash'
  | 'start'
  | 'end'
  | 'boost'
  | 'perfect'
  | 'flip'
  | 'special'
  | 'ready'
  | 'arm'
  | 'early'
  | 'scrape'
  | 'nav'
  | 'sel'
  | 'ui'
  | 'step'
  | 'tick'
  | 'fanfare'
  | 'warn'
  | 'warn2';

export const audio = {
  init(): void {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 5;
    comp.attack.value = 0.01;
    comp.release.value = 0.2;
    comp.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = vMusic;
    musicBus.connect(comp);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9 * vSfx;
    sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // melodic bus: dry + dotted-eighth echo + big hall reverb
    fxBus = ctx.createGain();
    fxBus.gain.value = 1;
    fxBus.connect(musicBus);
    const dl = ctx.createDelay(1);
    dl.delayTime.value = S16 * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 2400;
    const dsend = ctx.createGain();
    dsend.gain.value = 0.45;
    fxBus.connect(dsend);
    dsend.connect(dl);
    dl.connect(dlp);
    dlp.connect(fb);
    fb.connect(dl);
    dlp.connect(musicBus);
    const rv = buildReverb(),
      rsend = ctx.createGain(),
      rret = ctx.createGain();
    rsend.gain.value = 0.55;
    rret.gain.value = 0.7;
    fxBus.connect(rsend);
    dlp.connect(rsend);
    rsend.connect(rv);
    rv.connect(rret);
    rret.connect(musicBus);
    // continuous carve hiss
    const cs = ctx.createBufferSource();
    cs.buffer = noiseBuf;
    cs.loop = true;
    carveFilt = ctx.createBiquadFilter();
    carveFilt.type = 'bandpass';
    carveFilt.frequency.value = 1200;
    carveFilt.Q.value = 0.7;
    carveGain = ctx.createGain();
    carveGain.gain.value = 0;
    cs.connect(carveFilt);
    carveFilt.connect(carveGain);
    carveGain.connect(sfxBus);
    cs.start();
    // grind screech
    grindOsc = ctx.createOscillator();
    grindOsc.type = 'sawtooth';
    grindOsc.frequency.value = 340;
    const gf = ctx.createBiquadFilter();
    gf.type = 'bandpass';
    gf.frequency.value = 1800;
    gf.Q.value = 2;
    grindGain = ctx.createGain();
    grindGain.gain.value = 0;
    grindOsc.connect(gf);
    gf.connect(grindGain);
    grindGain.connect(sfxBus);
    grindOsc.start();
  },
  startMusic(): void {
    if (!ctx || musicOn) return;
    musicOn = true;
    step = 0;
    nextT = ctx.currentTime + 0.1;
    timer = setInterval(tick, 50);
  },
  stopMusic(): void {
    musicOn = false;
    if (timer) clearInterval(timer);
    timer = null;
  },
  toggleMute(): boolean {
    return this.setMuted(!muted);
  },
  setMuted(v: boolean): boolean {
    muted = !!v;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  },
  isMuted(): boolean {
    return muted;
  },
  setVolumes(music: number, sfx: number): void {
    // 0..1 each, safe to call before the audio context exists
    vMusic = music;
    vSfx = sfx;
    if (musicBus) musicBus.gain.value = vMusic;
    if (sfxBus) sfxBus.gain.value = 0.9 * vSfx;
  },
  carve(speed: number, onGround: boolean, steerAmt: number): void {
    if (!ctx) return;
    const v = onGround ? Math.min(1, speed / 40) : 0.05;
    carveGain.gain.setTargetAtTime(v * (0.1 + 0.12 * steerAmt), ctx.currentTime, 0.05);
    carveFilt.frequency.setTargetAtTime(500 + speed * 38, ctx.currentTime, 0.1);
  },
  grind(on: boolean, speed: number): void {
    if (!ctx) return;
    grindGain.gain.setTargetAtTime(on ? 0.1 : 0, ctx.currentTime, 0.02);
    if (on) grindOsc.frequency.setTargetAtTime(260 + speed * 4, ctx.currentTime, 0.1);
  },
  sfx(name: SfxName): void {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (name === 'jump') {
      noise(t, 0.18, 0.18, 900, sfxBus);
      tone('sine', 220, t, 0.15, 0.12, sfxBus);
    } else if (name === 'land') {
      noise(t, 0.12, 0.3, 200, sfxBus);
      tone('sine', 80, t, 0.18, 0.35, sfxBus);
    } else if (name === 'trick') {
      tone('square', 660, t, 0.08, 0.1, sfxBus);
      tone('square', 990, t + 0.07, 0.12, 0.1, sfxBus);
    } else if (name === 'bank') {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone('triangle', f, t + i * 0.07, 0.25, 0.16, sfxBus),
      );
    } else if (name === 'crash') {
      noise(t, 0.5, 0.6, 120, sfxBus);
      tone('sawtooth', 110, t, 0.4, 0.3, sfxBus, 400);
    } else if (name === 'start') {
      [392, 523, 659, 784].forEach((f, i) =>
        tone('square', f, t + i * 0.09, 0.2, 0.1, sfxBus, 3000),
      );
    } else if (name === 'end') {
      [784, 659, 523, 392].forEach((f, i) =>
        tone('square', f, t + i * 0.12, 0.3, 0.1, sfxBus, 2500),
      );
    } else if (name === 'boost') {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.35);
      o.connect(g);
      g.connect(sfxBus);
      env(g, t, 0.02, 0.4, 0.12);
      o.start(t);
      o.stop(t + 0.5);
      noise(t, 0.35, 0.2, 1500, sfxBus);
    } else if (name === 'perfect') {
      [1047, 1319, 1568, 2093].forEach((f, i) => {
        tone('sine', f, t + i * 0.055, 0.5, 0.15, sfxBus);
        tone('triangle', f * 2, t + i * 0.055, 0.25, 0.05, sfxBus);
      });
      noise(t, 0.5, 0.12, 5000, sfxBus);
      tone('sine', 98, t, 0.3, 0.4, sfxBus);
    } else if (name === 'flip') {
      noise(t, 0.12, 0.12, 2500, sfxBus);
      tone('sine', 500, t, 0.1, 0.06, sfxBus);
    } else if (name === 'special') {
      [392, 523, 659, 784, 1047].forEach((f, i) =>
        tone('square', f, t + i * 0.05, 0.22, 0.09, sfxBus, 3200),
      );
      noise(t, 0.4, 0.1, 3000, sfxBus);
    } else if (name === 'ready') {
      [659, 988].forEach((f, i) => tone('triangle', f, t + i * 0.09, 0.3, 0.15, sfxBus));
    } else if (name === 'arm') {
      tone('sine', 1760, t, 0.06, 0.1, sfxBus);
    } else if (name === 'early') {
      tone('square', 150, t, 0.1, 0.07, sfxBus, 800);
    } else if (name === 'scrape') {
      noise(t, 0.2, 0.3, 1100, sfxBus);
      tone('sawtooth', 130, t, 0.16, 0.1, sfxBus, 500);
    } else if (name === 'nav') {
      tone('square', 1320, t, 0.035, 0.06, sfxBus, 3500);
    } else if (name === 'sel') {
      tone('square', 660, t, 0.06, 0.09, sfxBus, 3200);
      tone('square', 990, t + 0.05, 0.09, 0.09, sfxBus, 3200);
    } else if (name === 'ui') {
      tone('square', 880, t, 0.06, 0.08, sfxBus);
    } else if (name === 'step') {
      [784, 988, 1319].forEach((f, i) => {
        tone('triangle', f, t + i * 0.07, 0.3, 0.14, sfxBus);
        tone('sine', f * 2, t + i * 0.07, 0.2, 0.05, sfxBus);
      });
    } else if (name === 'tick') {
      tone('triangle', 1175, t, 0.12, 0.1, sfxBus);
    } else if (name === 'fanfare') {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
        tone('square', f, t + i * 0.08, 0.34, 0.09, sfxBus, 3200);
        tone('triangle', f, t + i * 0.08, 0.5, 0.12, sfxBus);
      });
      noise(t + 0.4, 0.6, 0.1, 5000, sfxBus);
    } else if (name === 'warn') {
      tone('square', 988, t, 0.07, 0.09, sfxBus, 3000);
    } else if (name === 'warn2') {
      tone('square', 1319, t, 0.09, 0.12, sfxBus, 3500);
      tone('square', 659, t, 0.12, 0.08, sfxBus, 2500);
    }
  },
};

ND.audio = audio;
