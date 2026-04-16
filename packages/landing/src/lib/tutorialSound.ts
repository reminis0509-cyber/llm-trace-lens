/* ------------------------------------------------------------------ */
/*  Tutorial step sound effects — Web Audio API, pure synthesis        */
/*  Lightweight version of dashboard stepSound.ts for the LP bundle    */
/* ------------------------------------------------------------------ */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * Short "pop" sound when a step completes.
 * Sine wave 800Hz, quick decay.
 */
export function playStepSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.04);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch {
    // Audio not available — silently ignore
  }
}

/**
 * Two-tone "ding-ding" when all steps complete.
 */
export function playCompleteSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const notes: Array<{ delay: number; freq: number }> = [
      { delay: 0, freq: 1047 },
      { delay: 0.12, freq: 1319 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.delay);
      gain.gain.setValueAtTime(0.10, now + note.delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.delay + 0.2);
      osc.start(now + note.delay);
      osc.stop(now + note.delay + 0.2);
    }
  } catch {
    // silently ignore
  }
}
