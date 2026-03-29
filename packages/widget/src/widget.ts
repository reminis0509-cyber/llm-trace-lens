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
const ICON_CLOSE = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
const ICON_SEND = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;

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
      };
    }

    this.setAttribute('data-position', this.config.widget_position);
    this.applyThemeColor(this.config.widget_color);
    this.render();
    this.bindEvents();
  }

  private applyThemeColor(color: string): void {
    this.style.setProperty('--ft-primary-color', color);
    // Compute a darker hover shade
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

  private getTemplate(config: WidgetConfig): string {
    const logoHtml = config.widget_logo_url
      ? `<img class="ft-header-logo" src="${this.escapeHtml(config.widget_logo_url)}" alt="${this.escapeHtml(config.name)}" />`
      : `<div class="ft-header-logo"></div>`;

    return `
      <button class="ft-bubble" data-open="false" aria-label="チャットを開く">
        <span class="ft-icon-chat">${ICON_CHAT}</span>
        <span class="ft-icon-close">${ICON_CLOSE}</span>
      </button>
      <div class="ft-window" role="dialog" aria-label="${this.escapeHtml(config.name)}">
        <div class="ft-header">
          ${logoHtml}
          <span class="ft-header-title">${this.escapeHtml(config.name)}</span>
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
