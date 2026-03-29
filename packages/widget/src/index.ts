import { WidgetAPI } from './api';
import { FujiTraceChatWidget } from './widget';

(function () {
  // Find the current script tag to read data-key and derive base URL
  const currentScript = document.currentScript as HTMLScriptElement | null;

  if (!currentScript) {
    console.error('[FujiTrace] Could not find script element. Ensure the script is loaded with a <script> tag.');
    return;
  }

  const publishKey = currentScript.getAttribute('data-key');

  if (!publishKey) {
    console.error('[FujiTrace] Missing data-key attribute on script tag.');
    return;
  }

  // Derive base URL from script src
  const scriptSrc = currentScript.src;
  let baseUrl: string;

  try {
    const url = new URL(scriptSrc);
    baseUrl = url.origin;
  } catch {
    console.error('[FujiTrace] Could not parse script src URL.');
    return;
  }

  // Register the custom element
  if (!customElements.get('fujitrace-chat')) {
    customElements.define('fujitrace-chat', FujiTraceChatWidget);
  }

  // Wait for DOM ready, then initialize
  function init(): void {
    const widget = document.createElement('fujitrace-chat') as FujiTraceChatWidget;
    document.body.appendChild(widget);

    const api = new WidgetAPI(baseUrl, publishKey as string);
    widget.initialize(api);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
