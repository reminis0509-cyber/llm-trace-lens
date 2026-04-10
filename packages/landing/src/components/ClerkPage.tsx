/* ------------------------------------------------------------------ */
/*  ClerkPage — Page wrapper for /tools/clerk                          */
/* ------------------------------------------------------------------ */

import ClerkChat from './ClerkChat';

export default function ClerkPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pt-24">
      <ClerkChat />
    </div>
  );
}
