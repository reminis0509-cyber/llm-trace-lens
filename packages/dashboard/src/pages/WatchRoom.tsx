/**
 * WatchRoom — Fullscreen "residence" route at /dashboard/watch.
 *
 * All watch logic lives in `components/watch/WatchPane.tsx` (shared with the
 * dashboard's embedded watch tab). This file is intentionally a thin wrapper
 * so that bug fixes and feature work happen in a single location.
 *
 * Strategy: docs/戦略_2026.md Section 11 (Watch Room Phase W0)
 */

import { WatchPane } from '../components/watch/WatchPane';

export function WatchRoom() {
  return <WatchPane fullscreen />;
}
