export function getStyles(): string {
  return /* css */ `
    :host {
      --ft-primary-color: #2563eb;
      --ft-primary-hover: #1d4ed8;
      --ft-secondary-color: #f3f4f6;
      --ft-bg-color: #ffffff;
      --ft-text-color: #1a1a2e;
      --ft-text-secondary: #6b7280;
      --ft-border-color: #e5e7eb;
      --ft-input-bg: #f9fafb;
      --ft-user-msg-bg: var(--ft-primary-color);
      --ft-user-msg-color: #ffffff;
      --ft-assistant-msg-bg: var(--ft-secondary-color);
      --ft-assistant-msg-color: #1a1a2e;
      --ft-shadow: 0 2px 12px rgba(0, 0, 0, 0.10);
      --ft-bubble-size: 56px;
      --ft-font-family: system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', 'Segoe UI', sans-serif;
      --ft-radius: 16px;
      --ft-radius-sm: 12px;
      --ft-window-width: 380px;
      --ft-window-height: 520px;

      position: fixed;
      z-index: 2147483647;
      font-family: var(--ft-font-family);
      font-size: 14px;
      line-height: 1.7;
      color: var(--ft-text-color);
      box-sizing: border-box;
    }

    :host([data-position="bottom-right"]) {
      bottom: 20px;
      right: 20px;
    }

    :host([data-position="bottom-left"]) {
      bottom: 20px;
      left: 20px;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* ---- Bubble Button ---- */
    .ft-bubble {
      width: var(--ft-bubble-size);
      height: var(--ft-bubble-size);
      border-radius: 50%;
      background: var(--ft-primary-color);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
    }

    .ft-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
    }

    .ft-bubble:active {
      transform: scale(0.96);
    }

    .ft-bubble svg {
      width: 26px;
      height: 26px;
      fill: #ffffff;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .ft-bubble .ft-icon-close {
      position: absolute;
    }

    .ft-bubble[data-open="true"] .ft-icon-chat {
      opacity: 0;
      transform: rotate(90deg) scale(0.5);
    }

    .ft-bubble[data-open="true"] .ft-icon-close {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

    .ft-bubble[data-open="false"] .ft-icon-chat {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

    .ft-bubble[data-open="false"] .ft-icon-close {
      opacity: 0;
      transform: rotate(-90deg) scale(0.5);
    }

    /* ---- Chat Window ---- */
    .ft-window {
      position: absolute;
      width: var(--ft-window-width);
      height: var(--ft-window-height);
      background: var(--ft-bg-color);
      border-radius: var(--ft-radius);
      box-shadow: var(--ft-shadow);
      border: 1px solid var(--ft-border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: scale(0.9) translateY(10px);
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
    }

    :host([data-position="bottom-right"]) .ft-window {
      bottom: calc(var(--ft-bubble-size) + 16px);
      right: 0;
    }

    :host([data-position="bottom-left"]) .ft-window {
      bottom: calc(var(--ft-bubble-size) + 16px);
      left: 0;
    }

    .ft-window.ft-open {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }

    /* ---- Header ---- */
    .ft-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: var(--ft-primary-color);
      color: #ffffff;
      flex-shrink: 0;
    }

    .ft-header-logo {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      background: rgba(255, 255, 255, 0.2);
      flex-shrink: 0;
    }

    .ft-header-title {
      font-size: 15px;
      font-weight: 600;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ft-header-close {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: background 0.15s ease;
    }

    .ft-header-close:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .ft-header-close svg {
      width: 18px;
      height: 18px;
      fill: #ffffff;
    }

    /* ---- Messages ---- */
    .ft-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }

    .ft-messages::-webkit-scrollbar {
      width: 4px;
    }

    .ft-messages::-webkit-scrollbar-track {
      background: transparent;
    }

    .ft-messages::-webkit-scrollbar-thumb {
      background: var(--ft-border-color);
      border-radius: 4px;
    }

    .ft-msg {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: var(--ft-radius-sm);
      font-size: 14px;
      line-height: 1.7;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    .ft-msg-user {
      align-self: flex-end;
      background: var(--ft-user-msg-bg);
      color: var(--ft-user-msg-color);
      border-bottom-right-radius: 4px;
    }

    .ft-msg-assistant {
      align-self: flex-start;
      background: var(--ft-assistant-msg-bg);
      color: var(--ft-assistant-msg-color);
      border-bottom-left-radius: 4px;
    }

    .ft-msg-error {
      align-self: center;
      background: #fef2f2;
      color: #991b1b;
      font-size: 13px;
      text-align: center;
      border-radius: 8px;
    }

    /* ---- Typing Indicator ---- */
    .ft-typing {
      align-self: flex-start;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 12px 16px;
      background: var(--ft-assistant-msg-bg);
      border-radius: var(--ft-radius-sm);
      border-bottom-left-radius: 4px;
    }

    .ft-typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--ft-text-secondary);
      animation: ft-bounce 1.4s ease-in-out infinite;
    }

    .ft-typing-dot:nth-child(2) {
      animation-delay: 0.16s;
    }

    .ft-typing-dot:nth-child(3) {
      animation-delay: 0.32s;
    }

    @keyframes ft-bounce {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.4;
      }
      30% {
        transform: translateY(-4px);
        opacity: 1;
      }
    }

    /* ---- Input Area ---- */
    .ft-input-area {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--ft-border-color);
      background: var(--ft-bg-color);
      flex-shrink: 0;
    }

    .ft-input {
      flex: 1;
      resize: none;
      border: 1px solid var(--ft-border-color);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 14px;
      font-family: var(--ft-font-family);
      line-height: 1.5;
      background: var(--ft-input-bg);
      color: var(--ft-text-color);
      outline: none;
      transition: border-color 0.15s ease;
      max-height: 100px;
      overflow-y: auto;
    }

    .ft-input:focus {
      border-color: var(--ft-primary-color);
    }

    .ft-input::placeholder {
      color: var(--ft-text-secondary);
    }

    .ft-send {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--ft-primary-color);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s ease, opacity 0.15s ease;
    }

    .ft-send:hover {
      background: var(--ft-primary-hover);
    }

    .ft-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ft-send svg {
      width: 18px;
      height: 18px;
      fill: #ffffff;
    }

    /* ---- Powered By ---- */
    .ft-powered {
      text-align: center;
      padding: 4px 16px 8px;
      font-size: 10px;
      color: var(--ft-text-secondary);
      background: var(--ft-bg-color);
      flex-shrink: 0;
      opacity: 0.7;
    }

    .ft-powered a {
      color: var(--ft-text-secondary);
      text-decoration: none;
      font-weight: 500;
    }

    .ft-powered a:hover {
      color: var(--ft-primary-color);
      text-decoration: underline;
    }

    /* ---- Mobile ---- */
    @media (max-width: 480px) {
      :host([data-position="bottom-right"]),
      :host([data-position="bottom-left"]) {
        bottom: 16px;
        right: 16px;
        left: auto;
      }

      .ft-window {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        border-radius: 0;
        max-width: none;
        max-height: none;
      }

      :host([data-position="bottom-right"]) .ft-window,
      :host([data-position="bottom-left"]) .ft-window {
        bottom: 0;
        right: 0;
        left: 0;
      }
    }
  `;
}
