import { useState, useEffect, useRef } from 'react';

/**
 * Animates a numeric value from its previous value to the target value.
 * Returns the current animated value and a flag indicating whether
 * the value recently changed (for highlight effects).
 *
 * Respects prefers-reduced-motion by skipping the animation entirely.
 */
export function useAnimatedValue(
  target: number,
  durationMs: number = 600,
): { displayValue: number; hasChanged: boolean } {
  const [displayValue, setDisplayValue] = useState(target);
  const [hasChanged, setHasChanged] = useState(false);
  const prevTargetRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const changeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const previous = prevTargetRef.current;
    prevTargetRef.current = target;

    if (previous === target) return;

    // Signal that value changed (for highlight effect)
    setHasChanged(true);
    if (changeTimeoutRef.current) clearTimeout(changeTimeoutRef.current);
    changeTimeoutRef.current = setTimeout(() => {
      setHasChanged(false);
    }, 1200);

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReducedMotion) {
      setDisplayValue(target);
      return;
    }

    const startValue = previous;
    const delta = target - startValue;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + delta * eased);
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, durationMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (changeTimeoutRef.current) clearTimeout(changeTimeoutRef.current);
    };
  }, []);

  return { displayValue, hasChanged };
}
