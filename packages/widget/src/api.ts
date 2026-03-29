export interface WidgetConfig {
  name: string;
  welcome_message: string;
  widget_color: string;
  widget_position: 'bottom-right' | 'bottom-left';
  widget_logo_url: string | null;
}

export interface ChatResponse {
  answer: string;
  session_id: string;
}

export interface ChatMetadata {
  page_url: string;
  referrer: string;
  [key: string]: string;
}

export class WidgetAPI {
  private baseUrl: string;
  private publishKey: string;

  constructor(baseUrl: string, publishKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.publishKey = publishKey;
  }

  async getConfig(): Promise<WidgetConfig> {
    const res = await fetch(
      `${this.baseUrl}/api/widget/${this.publishKey}/config`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch widget config: ${res.status}`);
    }

    return res.json();
  }

  async sendMessage(
    message: string,
    visitorId: string,
    metadata?: ChatMetadata
  ): Promise<ChatResponse> {
    const res = await fetch(
      `${this.baseUrl}/api/widget/${this.publishKey}/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          visitor_id: visitorId,
          metadata: metadata ?? {
            page_url: window.location.href,
            referrer: document.referrer,
          },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to send message: ${res.status}`);
    }

    return res.json();
  }
}
