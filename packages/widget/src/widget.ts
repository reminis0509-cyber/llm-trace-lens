import { WidgetAPI } from './api';
import type { WidgetConfig } from './api';
import { getStyles } from './styles';

interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

const VISITOR_ID_KEY = 'fujitrace_visitor_id';

function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

// SVG icons as strings
const ICON_CHAT = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h10v2H7zm0-3h10v2H7z"/></svg>`;
const ICON_QUESTION = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>`;
const ICON_HEADSET = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
const ICON_SEND = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;

const BUBBLE_ICONS: Record<string, string> = {
  chat: ICON_CHAT,
  question: ICON_QUESTION,
  headset: ICON_HEADSET,
};

const BORDER_RADIUS_MAP: Record<string, { main: string; sm: string }> = {
  sharp: { main: '4px', sm: '2px' },
  rounded: { main: '16px', sm: '12px' },
  pill: { main: '24px', sm: '20px' },
};

const WINDOW_SIZE_MAP: Record<string, { width: string; height: string }> = {
  compact: { width: '320px', height: '440px' },
  standard: { width: '380px', height: '520px' },
  large: { width: '420px', height: '600px' },
};

const FONT_MAP: Record<string, string> = {
  system: "system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', 'Segoe UI', sans-serif",
  'noto-sans-jp': "'Noto Sans JP', system-ui, sans-serif",
  hiragino: "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', system-ui, sans-serif",
};

export class FujiTraceChatWidget extends HTMLElement {
  private shadow: ShadowRoot;
  private api: WidgetAPI | null = null;
  private config: WidgetConfig | null = null;
  private messages: Message[] = [];
  private isOpen = false;
  private isLoading = false;
  private visitorId: string;
  private _sessionId: string | null = null;

  // DOM references
  private bubbleEl: HTMLButtonElement | null = null;
  private windowEl: HTMLDivElement | null = null;
  private messagesEl: HTMLDivElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendEl: HTMLButtonElement | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.visitorId = getVisitorId();
  }

  static get observedAttributes(): string[] {
    return ['data-position'];
  }

  async initialize(api: WidgetAPI): Promise<void> {
    this.api = api;

    try {
      this.config = await api.getConfig();
    } catch {
      // Fallback config if API is unavailable
      this.config = {
        name: 'Chat',
        welcome_message: 'こんにちは。ご質問があればお気軽にどうぞ。',
        widget_color: '#2563eb',
        widget_position: 'bottom-right',
        widget_logo_url: null,
        widget_secondary_color: null,
        widget_border_radius: null,
        widget_header_text: null,
        widget_font: null,
        widget_bubble_icon: null,
        widget_bubble_icon_url: null,
        widget_window_size: null,
      };
    }

    this.setAttribute('data-position', this.config.widget_position);
    this.applyTheme(this.config);
    this.render();
    this.bindEvents();
  }

  private applyTheme(config: WidgetConfig): void {
    // Primary color
    this.style.setProperty('--ft-primary-color', config.widget_color);
    this.style.setProperty('--ft-primary-hover', this.darken(config.widget_color, 15));

    // Secondary color
    if (config.widget_secondary_color) {
      this.style.setProperty('--ft-secondary-color', config.widget_secondary_color);
      this.style.setProperty('--ft-assistant-msg-bg', config.widget_secondary_color);
    }

    // Border radius
    const radiusKey = config.widget_border_radius || 'rounded';
    const radius = BORDER_RADIUS_MAP[radiusKey] || BORDER_RADIUS_MAP.rounded;
    this.style.setProperty('--ft-radius', radius.main);
    this.style.setProperty('--ft-radius-sm', radius.sm);

    // Window size
    const sizeKey = config.widget_window_size || 'standard';
    const size = WINDOW_SIZE_MAP[sizeKey] || WINDOW_SIZE_MAP.standard;
    this.style.setProperty('--ft-window-width', size.width);
    this.style.setProperty('--ft-window-height', size.height);

    // Font
    const fontKey = config.widget_font || 'system';
    const fontFamily = FONT_MAP[fontKey] || FONT_MAP.system;
    this.style.setProperty('--ft-font-family', fontFamily);

    // Inject Google Fonts for Noto Sans JP
    if (fontKey === 'noto-sans-jp') {
      this.injectGoogleFont();
    }
  }

  private injectGoogleFont(): void {
    const linkId = 'ft-google-fonts';
    if (this.shadow.querySelector(`#${linkId}`)) return;
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap';
    this.shadow.prepend(link);
  }

  private applyThemeColor(color: string): void {
    this.style.setProperty('--ft-primary-color', color);
    this.style.setProperty('--ft-primary-hover', this.darken(color, 15));
  }

  private darken(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
    const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.round(2.55 * percent));
    const b = Math.max(0, (num & 0x0000ff) - Math.round(2.55 * percent));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }

  private render(): void {
    const config = this.config;
    if (!config) return;

    const styleEl = document.createElement('style');
    styleEl.textContent = getStyles();

    const container = document.createElement('div');
    container.innerHTML = this.getTemplate(config);

    this.shadow.appendChild(styleEl);
    this.shadow.appendChild(container);

    this.bubbleEl = this.shadow.querySelector('.ft-bubble');
    this.windowEl = this.shadow.querySelector('.ft-window');
    this.messagesEl = this.shadow.querySelector('.ft-messages');
    this.inputEl = this.shadow.querySelector('.ft-input');
    this.sendEl = this.shadow.querySelector('.ft-send');

    // Add welcome message
    if (config.welcome_message) {
      this.messages.push({ role: 'assistant', content: config.welcome_message });
      this.renderMessages();
    }
  }

  private getBubbleIconHtml(config: WidgetConfig): string {
    const iconType = config.widget_bubble_icon || 'chat';

    if (iconType === 'custom' && config.widget_bubble_icon_url) {
      return `<img src="${this.escapeHtml(config.widget_bubble_icon_url)}" alt="" style="width:26px;height:26px;object-fit:contain;" />`;
    }

    const svgContent = BUBBLE_ICONS[iconType] || BUBBLE_ICONS.chat;
    return svgContent;
  }

  private getTemplate(config: WidgetConfig): string {
    const logoHtml = config.widget_logo_url
      ? `<img class="ft-header-logo" src="${this.escapeHtml(config.widget_logo_url)}" alt="${this.escapeHtml(config.name)}" />`
      : `<div class="ft-header-logo"></div>`;

    const headerTitle = config.widget_header_text || config.name;
    const bubbleIconHtml = this.getBubbleIconHtml(config);

    return `
      <button class="ft-bubble" data-open="false" aria-label="チャットを開く">
        <span class="ft-icon-chat">${bubbleIconHtml}</span>
        <span class="ft-icon-close">${ICON_CLOSE}</span>
      </button>
      <div class="ft-window" role="dialog" aria-label="${this.escapeHtml(headerTitle)}">
        <div class="ft-header">
          ${logoHtml}
          <span class="ft-header-title">${this.escapeHtml(headerTitle)}</span>
          <button class="ft-header-close" aria-label="チャットを閉じる">
            ${ICON_CLOSE}
          </button>
        </div>
        <div class="ft-messages" aria-live="polite"></div>
        <div class="ft-input-area">
          <textarea
            class="ft-input"
            placeholder="メッセージを入力..."
            rows="1"
            aria-label="メッセージ入力"
          ></textarea>
          <button class="ft-send" aria-label="送信" disabled>
            ${ICON_SEND}
          </button>
        </div>
        <div class="ft-powered">
          Powered by <a href="https://fujitrace.jp" target="_blank" rel="noopener noreferrer">FujiTrace</a>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    // Bubble toggle
    this.bubbleEl?.addEventListener('click', () => this.toggle());

    // Header close
    const closeBtn = this.shadow.querySelector('.ft-header-close');
    closeBtn?.addEventListener('click', () => this.close());

    // Send button
    this.sendEl?.addEventListener('click', () => this.handleSend());

    // Input handling
    this.inputEl?.addEventListener('input', () => {
      this.autoResize();
      this.updateSendState();
    });

    this.inputEl?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        this.handleSend();
      }
    });
  }

  private toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private open(): void {
    this.isOpen = true;
    this.bubbleEl?.setAttribute('data-open', 'true');
    this.bubbleEl?.setAttribute('aria-label', 'チャットを閉じる');
    this.windowEl?.classList.add('ft-open');
    // Focus input after animation
    setTimeout(() => this.inputEl?.focus(), 300);
  }

  private close(): void {
    this.isOpen = false;
    this.bubbleEl?.setAttribute('data-open', 'false');
    this.bubbleEl?.setAttribute('aria-label', 'チャットを開く');
    this.windowEl?.classList.remove('ft-open');
  }

  private autoResize(): void {
    const el = this.inputEl;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  }

  private updateSendState(): void {
    if (!this.sendEl || !this.inputEl) return;
    const hasText = this.inputEl.value.trim().length > 0;
    this.sendEl.disabled = !hasText || this.isLoading;
  }

  private async handleSend(): Promise<void> {
    if (!this.inputEl || !this.api) return;

    const text = this.inputEl.value.trim();
    if (!text || this.isLoading) return;

    // Add user message
    this.messages.push({ role: 'user', content: text });
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto';
    this.updateSendState();
    this.renderMessages();
    this.scrollToBottom();

    // Show typing indicator
    this.isLoading = true;
    this.updateSendState();
    this.showTypingIndicator();

    try {
      const response = await this.api.sendMessage(text, this.visitorId, {
        page_url: window.location.href,
        referrer: document.referrer,
      });

      this._sessionId = response.session_id;
      this.messages.push({ role: 'assistant', content: response.answer });
    } catch {
      this.messages.push({
        role: 'error',
        content: '送信に失敗しました。しばらくしてからもう一度お試しください。',
      });
    } finally {
      this.isLoading = false;
      this.updateSendState();
      this.hideTypingIndicator();
      this.renderMessages();
      this.scrollToBottom();
    }
  }

  private renderMessages(): void {
    if (!this.messagesEl) return;

    // Preserve typing indicator if present
    const typingEl = this.messagesEl.querySelector('.ft-typing');

    this.messagesEl.innerHTML = '';

    for (const msg of this.messages) {
      const div = document.createElement('div');
      div.classList.add('ft-msg');

      if (msg.role === 'user') {
        div.classList.add('ft-msg-user');
      } else if (msg.role === 'assistant') {
        div.classList.add('ft-msg-assistant');
      } else {
        div.classList.add('ft-msg-error');
      }

      div.textContent = msg.content;
      this.messagesEl.appendChild(div);
    }

    if (typingEl) {
      this.messagesEl.appendChild(typingEl);
    }
  }

  private showTypingIndicator(): void {
    if (!this.messagesEl) return;
    const typing = document.createElement('div');
    typing.classList.add('ft-typing');
    typing.innerHTML = `
      <span class="ft-typing-dot"></span>
      <span class="ft-typing-dot"></span>
      <span class="ft-typing-dot"></span>
    `;
    this.messagesEl.appendChild(typing);
    this.scrollToBottom();
  }

  private hideTypingIndicator(): void {
    const typing = this.messagesEl?.querySelector('.ft-typing');
    typing?.remove();
  }

  private scrollToBottom(): void {
    if (!this.messagesEl) return;
    requestAnimationFrame(() => {
      if (this.messagesEl) {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      }
    });
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
