/* ------------------------------------------------------------------ */
/*  Step completion sound effects using Web Audio API                   */
/*  No external audio files needed — pure synthesis                    */
/* ------------------------------------------------------------------ */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * Play a short, clean "ping" when a step completes.
 * Sine wave A5 -> A6, 150ms fade-out.
 */
export function playStepCompleteSound(): void {
  try {
    const ctx = getAudioContext();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
    oscillator.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.05);

    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio not available — silently ignore
  }
}

/**
 * Play a two-tone "ding-ding" when all steps complete.
 * C6 then E6, each 200ms.
 */
export function playCompletionSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const notes: Array<{ delay: number; freq: number }> = [
      { delay: 0, freq: 1047 },    // C6
      { delay: 0.12, freq: 1319 }, // E6
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.delay);
      gain.gain.setValueAtTime(0.12, now + note.delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.delay + 0.2);
      osc.start(now + note.delay);
      osc.stop(now + note.delay + 0.2);
    }
  } catch {
    // silently ignore
  }
}
