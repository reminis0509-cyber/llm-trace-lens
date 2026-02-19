import axios, { AxiosError } from 'axios';

/**
 * SSRF Protection: Validate webhook URLs to prevent Server-Side Request Forgery
 * Blocks requests to:
 * - Private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
 * - Loopback addresses (127.x.x.x, localhost)
 * - Link-local addresses (169.254.x.x)
 * - Internal cloud metadata endpoints (169.254.169.254)
 */
function isUrlSafe(urlString: string): { safe: boolean; reason?: string } {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS in production
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      return { safe: false, reason: 'Only HTTPS URLs are allowed in production' };
    }

    // Block non-HTTP(S) protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { safe: false, reason: 'Only HTTP/HTTPS protocols are allowed' };
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost variations
    const localhostPatterns = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
    if (localhostPatterns.some(p => hostname === p || hostname.endsWith('.' + p))) {
      return { safe: false, reason: 'Localhost URLs are not allowed' };
    }

    // Block IP addresses that are private/internal
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);
    if (ipMatch) {
      const [, a, b, c, d] = ipMatch.map(Number);

      // 10.0.0.0/8 (Private)
      if (a === 10) {
        return { safe: false, reason: 'Private IP addresses (10.x.x.x) are not allowed' };
      }

      // 172.16.0.0/12 (Private)
      if (a === 172 && b >= 16 && b <= 31) {
        return { safe: false, reason: 'Private IP addresses (172.16-31.x.x) are not allowed' };
      }

      // 192.168.0.0/16 (Private)
      if (a === 192 && b === 168) {
        return { safe: false, reason: 'Private IP addresses (192.168.x.x) are not allowed' };
      }

      // 127.0.0.0/8 (Loopback)
      if (a === 127) {
        return { safe: false, reason: 'Loopback addresses are not allowed' };
      }

      // 169.254.0.0/16 (Link-local, includes cloud metadata)
      if (a === 169 && b === 254) {
        return { safe: false, reason: 'Link-local addresses (including cloud metadata endpoints) are not allowed' };
      }

      // 0.0.0.0/8 (Current network)
      if (a === 0) {
        return { safe: false, reason: 'Invalid IP address' };
      }
    }

    // Block common internal hostnames
    const blockedHostnames = [
      'metadata.google.internal',
      'metadata.google.com',
      'instance-data',
      'kubernetes.default',
      'kubernetes.default.svc',
    ];
    if (blockedHostnames.some(blocked => hostname === blocked || hostname.endsWith('.' + blocked))) {
      return { safe: false, reason: 'Internal hostnames are not allowed' };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

export interface WebhookEvent {
  event: 'BLOCK' | 'WARN' | 'COST_ALERT';
  timestamp: string;
  traceId: string;
  provider: string;
  model: string;
  risk?: string;
  costInfo?: {
    current: number;
    budget: number;
    percentage: number;
  };
  details: unknown;
}

export interface WebhookConfig {
  url: string;
  events: ('BLOCK' | 'WARN' | 'COST_ALERT')[];
  retries?: number;
  timeout?: number;
}

// Legacy payload interface for backwards compatibility
export interface WebhookPayload {
  event: 'BLOCK' | 'FAIL';
  trace_id: string;
  timestamp: string;
  model: string;
  rule_result: string;
  violations: unknown;
  request_summary?: string;
}

export class WebhookSender {
  private enabled: boolean;
  private url: string;
  private timeout: number;
  private maxRetries: number;
  private events: ('BLOCK' | 'WARN' | 'COST_ALERT')[];

  constructor(config?: WebhookConfig) {
    if (config) {
      // Validate URL for SSRF protection
      const urlCheck = isUrlSafe(config.url);
      if (!urlCheck.safe) {
        console.error(`[Webhook] Unsafe URL rejected: ${urlCheck.reason}`);
        this.enabled = false;
        this.url = '';
        this.timeout = 5000;
        this.maxRetries = 3;
        this.events = [];
        return;
      }

      this.enabled = true;
      this.url = config.url;
      this.timeout = config.timeout || 5000;
      this.maxRetries = config.retries || 3;
      this.events = config.events;
    } else {
      // Fallback to environment variables
      const envUrl = process.env.WEBHOOK_URL || '';
      const urlCheck = isUrlSafe(envUrl);

      if (envUrl && !urlCheck.safe) {
        console.error(`[Webhook] Unsafe WEBHOOK_URL rejected: ${urlCheck.reason}`);
        this.enabled = false;
        this.url = '';
      } else {
        this.enabled = process.env.WEBHOOK_ENABLED === 'true';
        this.url = envUrl;
      }

      this.timeout = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '5000');
      this.maxRetries = parseInt(process.env.WEBHOOK_MAX_RETRIES || '3');
      this.events = (process.env.WEBHOOK_EVENTS || 'BLOCK,WARN').split(',') as ('BLOCK' | 'WARN' | 'COST_ALERT')[];
    }
  }

  async send(event: WebhookEvent): Promise<void> {
    if (!this.enabled || !this.url) {
      return;
    }

    // Event filtering
    if (!this.events.includes(event.event)) {
      return;
    }

    const payload = this.formatPayload(event);

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await axios.post(this.url, payload, {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'LLM-Trace-Lens/0.3.0',
          },
        });
        console.log(`[Webhook] Event ${event.event} sent successfully (traceId: ${event.traceId})`);
        return;
      } catch (error) {
        const axiosError = error as AxiosError;
        console.error(`[Webhook] Attempt ${attempt + 1} failed:`, axiosError.message);

        if (attempt === this.maxRetries) {
          console.error(`[Webhook] All retries exhausted for event ${event.event}`);
          throw error;
        }

        // Exponential backoff
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  private formatPayload(event: WebhookEvent): unknown {
    // Slack format
    if (this.url.includes('hooks.slack.com')) {
      return this.formatSlackPayload(event);
    }

    // Microsoft Teams format
    if (this.url.includes('webhook.office.com')) {
      return this.formatTeamsPayload(event);
    }

    // Generic JSON
    return event;
  }

  private formatSlackPayload(event: WebhookEvent): unknown {
    const emoji = event.event === 'BLOCK' ? '🚫' : event.event === 'WARN' ? '⚠️' : '💰';
    const color = event.event === 'BLOCK' ? 'danger' : event.event === 'WARN' ? 'warning' : '#FFA500';

    const fields = [
      { title: 'Event', value: event.event, short: true },
      { title: 'Provider', value: `${event.provider}/${event.model}`, short: true },
      { title: 'Trace ID', value: event.traceId, short: false },
    ];

    if (event.risk) {
      fields.push({ title: 'Risk', value: event.risk, short: false });
    }

    if (event.costInfo) {
      fields.push({
        title: 'Cost Alert',
        value: `${event.costInfo.current.toFixed(2)}/${event.costInfo.budget.toFixed(2)} USD (${event.costInfo.percentage.toFixed(1)}%)`,
        short: false,
      });
    }

    return {
      text: `${emoji} LLM Trace Alert: ${event.event}`,
      attachments: [{
        color,
        fields,
        footer: 'LLM Trace Lens',
        ts: Math.floor(new Date(event.timestamp).getTime() / 1000),
      }],
    };
  }

  private formatTeamsPayload(event: WebhookEvent): unknown {
    const emoji = event.event === 'BLOCK' ? '🚫' : event.event === 'WARN' ? '⚠️' : '💰';

    const facts = [
      { name: 'Event', value: event.event },
      { name: 'Provider', value: `${event.provider}/${event.model}` },
      { name: 'Trace ID', value: event.traceId },
    ];

    if (event.risk) {
      facts.push({ name: 'Risk', value: event.risk });
    }

    if (event.costInfo) {
      facts.push({
        name: 'Cost Alert',
        value: `${event.costInfo.current.toFixed(2)}/${event.costInfo.budget.toFixed(2)} USD (${event.costInfo.percentage.toFixed(1)}%)`,
      });
    }

    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: `${emoji} LLM Trace Alert: ${event.event}`,
      themeColor: event.event === 'BLOCK' ? 'FF0000' : event.event === 'WARN' ? 'FFA500' : 'FFA500',
      title: `${emoji} LLM Trace Alert`,
      sections: [{
        facts,
      }],
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Legacy methods for backwards compatibility
  async sendLegacy(payload: WebhookPayload): Promise<void> {
    if (!this.enabled || !this.url) {
      return;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await axios.post(this.url, payload, {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'LLM-Trace-Lens/0.3.0',
          },
        });

        console.log(`[Webhook] Successfully sent ${payload.event} event for trace ${payload.trace_id}`);
        return;
      } catch (error) {
        lastError = error as Error;

        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          console.error(`[Webhook] Attempt ${attempt}/${this.maxRetries} failed:`, {
            status: axiosError.response?.status,
            message: axiosError.message,
          });
        } else {
          console.error(`[Webhook] Attempt ${attempt}/${this.maxRetries} failed:`, error);
        }

        if (attempt < this.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s...
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`[Webhook] Failed to send after ${this.maxRetries} attempts for trace ${payload.trace_id}:`, lastError);
  }

  async sendBlockEvent(traceId: string, model: string, violations: unknown, requestSummary?: string): Promise<void> {
    // Use new event format
    await this.send({
      event: 'BLOCK',
      timestamp: new Date().toISOString(),
      traceId,
      provider: 'unknown',
      model,
      risk: typeof violations === 'object' ? JSON.stringify(violations) : String(violations),
      details: { violations, request_summary: requestSummary },
    });
  }

  async sendFailEvent(traceId: string, model: string, violations: unknown, requestSummary?: string): Promise<void> {
    await this.sendLegacy({
      event: 'FAIL',
      trace_id: traceId,
      timestamp: new Date().toISOString(),
      model,
      rule_result: 'FAIL',
      violations,
      request_summary: requestSummary,
    });
  }

  async sendWarnEvent(traceId: string, provider: string, model: string, risk: string, details: unknown): Promise<void> {
    await this.send({
      event: 'WARN',
      timestamp: new Date().toISOString(),
      traceId,
      provider,
      model,
      risk,
      details,
    });
  }

  async sendCostAlert(
    traceId: string,
    provider: string,
    model: string,
    current: number,
    budget: number,
    percentage: number
  ): Promise<void> {
    await this.send({
      event: 'COST_ALERT',
      timestamp: new Date().toISOString(),
      traceId,
      provider,
      model,
      costInfo: { current, budget, percentage },
      details: { message: `Cost alert: ${percentage.toFixed(1)}% of budget used` },
    });
  }
}

// Singleton webhook manager
class WebhookManager {
  private senders: Map<string, WebhookSender> = new Map();

  register(id: string, config: WebhookConfig): void {
    this.senders.set(id, new WebhookSender(config));
  }

  async sendAll(event: WebhookEvent): Promise<void> {
    const promises = Array.from(this.senders.values()).map(sender =>
      sender.send(event).catch(err => console.error('[WebhookManager] Send failed:', err))
    );
    await Promise.allSettled(promises);
  }

  clear(): void {
    this.senders.clear();
  }

  hasSenders(): boolean {
    return this.senders.size > 0;
  }
}

export const webhookManager = new WebhookManager();
