import React from 'react';
import ReactDOM from 'react-dom/client';
import liff from '@line/liff';
import App from './App';
import './index.css';

// ---------------------------------------------------------------------------
// LIFF SDK initialization
// ---------------------------------------------------------------------------
//
// Fires once at app boot. Success is required for liff.isInClient() and
// liff.closeWindow() to behave correctly inside the LINE in-app browser.
//
// Failure modes (all non-fatal):
//   - VITE_LINE_LIFF_ID not set (regular LP access)
//   - Page not opened via a LIFF URL
//   - Network / SDK load error
//
// In every failure case we swallow the error and continue booting the app,
// so the regular LP experience stays unaffected.
const liffId: string | undefined = import.meta.env.VITE_LINE_LIFF_ID;

async function initLiff(): Promise<void> {
  if (!liffId) {
    return;
  }
  try {
    await liff.init({ liffId });
  } catch (err) {
    // Logged to the browser console for diagnosis but never surfaced to the
    // user — LIFF is an opt-in entry point, not a hard dependency.
    // eslint-disable-next-line no-console
    console.warn('[liff] init failed', err);
  }
}

function bootstrap(): void {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void initLiff();
bootstrap();
