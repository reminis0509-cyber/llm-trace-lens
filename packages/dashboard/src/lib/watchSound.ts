/**
 * Watch Room — Web Audio synthesizer for notification tones.
 *
 * Phase W0: No external audio assets. All sounds are synthesized on the fly
 * via Web Audio API so the prototype runs without shipping binary files.
 * Phase W1 will replace this with professionally designed samples.
 *
 * Design:
 * - PASS: soft high chime — pleasant, falls into background
 * - WARN: mid-range tone — noticeable but not alarming
 * - FAIL: lower attention tone — draws the eye without being shrill
 * - MILESTONE: two-note fanfare (reserved for Phase W1)
 *
 * Throttling: repeated calls within THROTTLE_MS are dropped so high-traffic
 * workspaces don't turn into cacophony.
 */

import type { ValidationLevel } from '../types';

export type WatchSoundKind = 'pass' | 'warn' | 'fail' | 'block';

const THROTTLE_MS = 450;

type LevelKey = Lowercase<ValidationLevel>;

const LEVEL_TO_KIND: Record<ValidationLevel, WatchSoundKind> = {
  PASS: 'pass',
  WARN: 'warn',
  FAIL: 'fail',
  BLOCK: 'block',
};

/** Tone recipe per sound kind */
interface ToneSpec {
  freq: number;
  type: OscillatorType;
  duration: number; // seconds
  attack: number;
  release: number;
  peak: number; // 0..1 relative
  overtoneFreq?: number;
  overtoneGain?: number;
}

const TONES: Record<WatchSoundKind, ToneSpec> = {
  pass: {
    freq: 880,
    type: 'sine',
    duration: 0.35,
    attack: 0.005,
    release: 0.3,
    peak: 0.25,
    overtoneFreq: 1320,
    overtoneGain: 0.08,
  },
  warn: {
    freq: 520,
    type: 'triangle',
    duration: 0.45,
    attack: 0.01,
    release: 0.35,
    peak: 0.3,
    overtoneFreq: 780,
    overtoneGain: 0.12,
  },
  fail: {
    freq: 320,
    type: 'sawtooth',
    duration: 0.55,
    attack: 0.005,
    release: 0.4,
    peak: 0.32,
    overtoneFreq: 160,
    overtoneGain: 0.18,
  },
  block: {
    freq: 240,
    type: 'square',
    duration: 0.6,
    attack: 0.005,
    release: 0.45,
    peak: 0.28,
    overtoneFreq: 180,
    overtoneGain: 0.15,
  },
};

class WatchSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lastPlayedAt = 0;
  private lastPlayedByKind: Record<WatchSoundKind, number> = {
    pass: 0,
    warn: 0,
    fail: 0,
    block: 0,
  };
  private enabled = true;
  private volume = 0.6;

  /** Lazy-init the AudioContext on first user gesture (browser autoplay policy). */
  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;

    const AC: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;

    try {
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      return this.ctx;
    } catch (err) {
      console.warn('[WatchSound] Failed to init AudioContext:', err);
      return null;
    }
  }

  /** Resume a suspended context (called after the first click/keypress). */
  resume(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  getVolume(): number {
    return this.volume;
  }

  /** Play a tone for a given validation level. No-op if disabled or throttled. */
  playForLevel(level: ValidationLevel): void {
    this.play(LEVEL_TO_KIND[level] ?? 'pass');
  }

  play(kind: WatchSoundKind): void {
    if (!this.enabled) return;

    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - this.lastPlayedAt < THROTTLE_MS) return;
    // Per-kind throttle: don't spam the same tone faster than 1.2s
    if (now - this.lastPlayedByKind[kind] < 1200) return;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    // Browsers suspend audio contexts until a user gesture — try to resume.
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const spec = TONES[kind];
    const start = ctx.currentTime;
    const peakAt = start + spec.attack;
    const end = start + spec.duration;

    // Primary oscillator
    const osc = ctx.createOscillator();
    osc.type = spec.type;
    osc.frequency.value = spec.freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(spec.peak, peakAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(start);
    osc.stop(end + 0.02);

    // Overtone for richer bell-like timbre
    if (spec.overtoneFreq && spec.overtoneGain) {
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = spec.overtoneFreq;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, start);
      g2.gain.linearRampToValueAtTime(spec.overtoneGain, peakAt);
      g2.gain.exponentialRampToValueAtTime(0.0001, end);
      o2.connect(g2);
      g2.connect(this.masterGain);
      o2.start(start);
      o2.stop(end + 0.02);
    }

    this.lastPlayedAt = now;
    this.lastPlayedByKind[kind] = now;
  }
}

/** Singleton engine shared across the Watch Room page. */
export const watchSound = new WatchSoundEngine();

export type { LevelKey };
