/* ------------------------------------------------------------------ */
/*  onboardingState — localStorage helpers for onboarding tutorial     */
/*                                                                     */
/*  Strategy: docs/戦略_2026.md Section 13.2 — Benesse-style 2-stage   */
/*  preview tutorial. Keys are kept stable because they double as the  */
/*  source of truth for whether a user has seen the 90-second flow.    */
/* ------------------------------------------------------------------ */

export const ONBOARDING_COMPLETED_KEY = 'fujitrace_onboarding_completed';
export const ONBOARDING_SKIPPED_KEY = 'fujitrace_onboarding_skipped';
export const ONBOARDING_FORCE_KEY = 'fujitrace_onboarding_force';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface OnboardingEligibilityInput {
  userCreatedAt: string | null | undefined;
}

/**
 * Decide whether to auto-show the onboarding overlay.
 *
 * Conditions:
 *  1. The user has never completed the tutorial (completion flag absent).
 *  2. The user has not skipped in this session (skipped flag absent).
 *  3. The user's Supabase account was created within the last 7 days.
 *
 * A manual replay (triggered from the header menu) sets
 * `ONBOARDING_FORCE_KEY` which bypasses all conditions.
 */
export function shouldShowOnboarding(input: OnboardingEligibilityInput): boolean {
  if (typeof window === 'undefined') return false;

  // Manual replay always wins.
  if (window.localStorage.getItem(ONBOARDING_FORCE_KEY) === 'true') {
    return true;
  }

  if (window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true') {
    return false;
  }
  if (window.localStorage.getItem(ONBOARDING_SKIPPED_KEY) === 'true') {
    return false;
  }

  const { userCreatedAt } = input;
  if (!userCreatedAt) return false;

  const createdAt = Date.parse(userCreatedAt);
  if (Number.isNaN(createdAt)) return false;

  const ageMs = Date.now() - createdAt;
  if (ageMs < 0) return false;
  if (ageMs > SEVEN_DAYS_MS) return false;

  return true;
}

export function markOnboardingCompleted(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  window.localStorage.removeItem(ONBOARDING_SKIPPED_KEY);
  window.localStorage.removeItem(ONBOARDING_FORCE_KEY);
}

export function markOnboardingSkipped(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ONBOARDING_SKIPPED_KEY, 'true');
  window.localStorage.removeItem(ONBOARDING_FORCE_KEY);
  // Note: completion flag intentionally NOT set.
}

export function requestOnboardingReplay(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ONBOARDING_FORCE_KEY, 'true');
  window.localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
  window.localStorage.removeItem(ONBOARDING_SKIPPED_KEY);
}
