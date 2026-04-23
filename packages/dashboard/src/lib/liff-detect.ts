/**
 * LIFF (LINE Front-end Framework) detection and helper utilities.
 *
 * The LIFF SDK is loaded once at app startup from main.tsx via liff.init().
 * These helpers:
 *   - detect whether the current page is being displayed inside the LINE
 *     in-app browser (LIFF viewer),
 *   - close the LIFF window programmatically (falls back to noop in a
 *     regular browser so UI callers never need to branch),
 *   - surface the LINE user profile when LIFF login is established.
 *
 * All functions are safe to call before liff.init() completes — they will
 * return conservative defaults (false / null / noop) rather than throwing.
 */

import liff from '@line/liff';

/**
 * Returns true when the page is running inside the LINE in-app browser
 * (LIFF viewer), or when the current URL path begins with `/liff/`.
 *
 * The path heuristic is intentional: it lets us render the immersive
 * LIFF layout during LIFF init (before liff.isInClient() settles) and
 * in regular-browser QA of the same routes.
 */
export function isInLiff(): boolean {
  try {
    if (liff.isInClient()) {
      return true;
    }
  } catch {
    // liff.init has not completed or @line/liff threw — fall through.
  }
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/liff/')) {
    return true;
  }
  return false;
}

/**
 * Close the LIFF window. Only takes effect inside the LINE in-app browser;
 * in a regular browser it is a safe noop.
 */
export function closeLiffWindow(): void {
  try {
    if (liff.isInClient()) {
      liff.closeWindow();
    }
  } catch {
    // LIFF SDK unavailable — noop.
  }
}

export interface LiffProfile {
  userId: string;
  displayName: string;
}

/**
 * Fetches the LINE profile when LIFF login is active. Returns null when
 * the SDK has not initialized, the user is not logged in, or any error
 * occurs — callers should treat null as "not available" and degrade.
 */
export async function getLiffProfile(): Promise<LiffProfile | null> {
  try {
    if (!liff.isLoggedIn()) {
      return null;
    }
    const profile = await liff.getProfile();
    return {
      userId: profile.userId,
      displayName: profile.displayName,
    };
  } catch {
    return null;
  }
}
