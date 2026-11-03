import { afterEach, describe, expect, it, vi } from 'vitest';
import { audio, BPM, mtof, S16, type SfxName } from './audio';

/* A stand-in WebAudio context: every node accepts any call, and we record what got created and started. */
function fakeAudio() {
  const log = { created: [] as string[], started: 0 };
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = (kind: string) => {
    log.created.push(kind);
    return {
      kind,
      type: '',
      buffer: null,
      loop: false,
      gain: param(),
      frequency: param(),
      detune: param(),
      Q: param(),
      delayTime: param(),
      threshold: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      connect: vi.fn(),
      start: () => log.started++,
      stop: vi.fn(),
    };
  };
  class Ctx {
    state = 'running';
    currentTime = 1;
    sampleRate = 8000;
    destination = {};
    resume = vi.fn();
    createGain = () => node('gain');
    createOscillator = () => node('osc');
    createBiquadFilter = () => node('filter');
    createBufferSource = () => node('source');
    createDynamicsCompressor = () => node('comp');
    createDelay = () => node('delay');
    createConvolver = () => node('convolver');
    createBuffer = (ch: number, len: number) => ({
      getChannelData: () => new Float32Array(len),
      numberOfChannels: ch,
    });
  }
  return { Ctx, log };
}

afterEach(() => vi.unstubAllGlobals());

describe('music theory helpers', () => {
  it('mtof maps MIDI notes to Hz', () => {
    expect(mtof(69)).toBe(440);
    expect(mtof(81)).toBeCloseTo(880, 9);
    expect(mtof(60)).toBeCloseTo(261.626, 2);
  });
  it('runs at drum & bass tempo, in 16th-note steps', () => {
    expect(BPM).toBe(174);
    expect(S16 * 16).toBeCloseTo((60 / 174) * 4, 9);
  });
});

describe('before audio starts', () => {
  it('everything is safe to call without a context (the browser needs a user gesture first)', () => {
    vi.stubGlobal('window', {});
    expect(() => {
      audio.setVolumes(0.5, 0.8);
      audio.carve(30, true, 1);
      audio.grind(true, 20);
      audio.sfx('jump');
      audio.startMusic();
      audio.stopMusic();
      audio.init(); // no AudioContext in this "browser": stays silent
    }).not.toThrow();
  });
  it('remembers mute', () => {
    expect(audio.setMuted(true)).toBe(true);
    expect(audio.isMuted()).toBe(true);
    expect(audio.toggleMute()).toBe(false);
    expect(audio.isMuted()).toBe(false);
  });
});

describe('with an audio context', () => {
  const { Ctx, log } = fakeAudio();
  it('builds the mixer once and plays every sound effect', () => {
    vi.stubGlobal('window', { AudioContext: Ctx });
    audio.init();
    const built = log.created.length;
    expect(built).toBeGreaterThan(10);
    audio.init(); // second call only resumes
    expect(log.created.length).toBe(built);
    const names: SfxName[] = [
      'jump',
      'land',
      'trick',
      'bank',
      'crash',
      'start',
      'end',
      'boost',
      'perfect',
      'flip',
      'special',
      'ready',
      'arm',
      'early',
      'scrape',
      'nav',
      'sel',
      'ui',
      'step',
      'tick',
      'fanfare',
      'warn',
      'warn2',
      'pickup',
      'pickupSky',
      'shield',
      'count',
      'go',
    ];
    for (const n of names) {
      const before = log.started;
      audio.sfx(n);
      expect(log.started, n).toBeGreaterThan(before);
    }
  });
  it('schedules a bar of music ahead of time and stops cleanly', () => {
    vi.useFakeTimers();
    const before = log.started;
    audio.startMusic();
    vi.advanceTimersByTime(60);
    expect(log.started).toBeGreaterThan(before);
    audio.stopMusic();
    const after = log.started;
    vi.advanceTimersByTime(500);
    expect(log.started).toBe(after);
    vi.useRealTimers();
  });
});
