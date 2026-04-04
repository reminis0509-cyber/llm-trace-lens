/**
 * Google Ads conversion tracking utility.
 *
 * The conversion label is read from the VITE_GOOGLE_ADS_CONVERSION_LABEL
 * environment variable at build time. When the label is empty or the gtag
 * script has not loaded, calling trackDashboardConversion is a safe no-op.
 */

const GOOGLE_ADS_CONVERSION_ID = 'AW-18038080177';
const GOOGLE_ADS_CONVERSION_LABEL =
  import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL || '';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Track a Google Ads conversion event.
 * Call this when a user clicks a CTA link to /dashboard.
 */
export function trackDashboardConversion(): void {
  if (!window.gtag || !GOOGLE_ADS_CONVERSION_LABEL) return;

  window.gtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_CONVERSION_ID}/${GOOGLE_ADS_CONVERSION_LABEL}`,
  });
}
