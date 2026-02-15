import axios from 'axios';

/**
 * Microsoft Teams Adaptive Card format
 */
export interface TeamsAdaptiveCard {
  type: 'message';
  attachments: TeamsAttachment[];
}

interface TeamsAttachment {
  contentType: 'application/vnd.microsoft.card.adaptive';
  content: AdaptiveCardContent;
}

interface AdaptiveCardContent {
  type: 'AdaptiveCard';
  version: string;
  body: AdaptiveCardElement[];
  actions?: AdaptiveCardAction[];
}

interface AdaptiveCardElement {
  type: string;
  text?: string;
  size?: string;
  weight?: string;
  color?: string;
  wrap?: boolean;
  facts?: Array<{ title: string; value: string }>;
  items?: AdaptiveCardElement[];
  columns?: Array<{
    type: string;
    width: string;
    items: AdaptiveCardElement[];
  }>;
}

interface AdaptiveCardAction {
  type: string;
  title: string;
  url?: string;
  data?: Record<string, unknown>;
}

interface TraceInfo {
  id: string;
  validationResults?: {
    riskScore?: number;
    riskLevel?: string;
    explanation?: string;
    overall?: string;
  };
  provider?: string;
  model?: string;
  timestamp?: string;
}

/**
 * Microsoft Teams Integration for sending rich notifications
 */
export class TeamsIntegration {
  /**
   * Send an Adaptive Card notification to Teams
   */
  async sendAdaptiveCard(
    webhookUrl: string,
    trace: TraceInfo,
    riskLevel: string,
    dashboardUrl?: string
  ): Promise<void> {
    const color = this.getRiskColor(riskLevel);
    const emoji = this.getRiskEmoji(riskLevel);
    const timestamp = trace.timestamp ? new Date(trace.timestamp).toLocaleString() : 'N/A';

    const card: TeamsAdaptiveCard = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                size: 'Large',
                weight: 'Bolder',
                text: `${emoji} ${riskLevel.toUpperCase()} Risk Detected`,
                color: color,
              },
              {
                type: 'FactSet',
                facts: [
                  {
                    title: 'Trace ID',
                    value: trace.id,
                  },
                  {
                    title: 'Risk Score',
                    value: `${trace.validationResults?.riskScore ?? 'N/A'}/100`,
                  },
                  {
                    title: 'Provider/Model',
                    value: `${trace.provider || 'unknown'}/${trace.model || 'unknown'}`,
                  },
                  {
                    title: 'Timestamp',
                    value: timestamp,
                  },
                ],
              },
              {
                type: 'TextBlock',
                text: '**Explanation:**',
                wrap: true,
              },
              {
                type: 'TextBlock',
                text: trace.validationResults?.explanation || 'No explanation available',
                wrap: true,
              },
            ],
            actions: dashboardUrl ? [
              {
                type: 'Action.OpenUrl',
                title: 'View in Dashboard',
                url: `${dashboardUrl}/traces/${trace.id}`,
              },
            ] : [],
          },
        },
      ],
    };

    try {
      await axios.post(webhookUrl, card, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      console.log(`[TeamsIntegration] Notification sent for trace ${trace.id}`);
    } catch (error) {
      console.error('[TeamsIntegration] Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Send a simple text notification to Teams
   */
  async sendSimpleNotification(
    webhookUrl: string,
    title: string,
    message: string
  ): Promise<void> {
    const card: TeamsAdaptiveCard = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                size: 'Medium',
                weight: 'Bolder',
                text: title,
              },
              {
                type: 'TextBlock',
                text: message,
                wrap: true,
              },
            ],
          },
        },
      ],
    };

    try {
      await axios.post(webhookUrl, card, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
    } catch (error) {
      console.error('[TeamsIntegration] Failed to send simple notification:', error);
      throw error;
    }
  }

  /**
   * Send a test notification to verify webhook configuration
   */
  async sendTestNotification(webhookUrl: string): Promise<boolean> {
    const testCard: TeamsAdaptiveCard = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                size: 'Medium',
                weight: 'Bolder',
                text: '✅ LLM Trace Lens Connection Test',
              },
              {
                type: 'TextBlock',
                text: 'This is a test notification from LLM Trace Lens. If you see this message, your Microsoft Teams integration is working correctly!',
                wrap: true,
              },
              {
                type: 'TextBlock',
                text: `Sent at ${new Date().toISOString()}`,
                size: 'Small',
                color: 'Accent',
              },
            ],
          },
        },
      ],
    };

    try {
      await axios.post(webhookUrl, testCard, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      return true;
    } catch (error) {
      console.error('[TeamsIntegration] Test notification failed:', error);
      return false;
    }
  }

  private getRiskColor(level: string): string {
    switch (level.toLowerCase()) {
      case 'high':
        return 'Attention';
      case 'medium':
        return 'Warning';
      case 'low':
        return 'Good';
      default:
        return 'Default';
    }
  }

  private getRiskEmoji(level: string): string {
    switch (level.toLowerCase()) {
      case 'high':
        return '🚨';
      case 'medium':
        return '⚠️';
      case 'low':
        return '✅';
      default:
        return '📋';
    }
  }
}

export const teamsIntegration = new TeamsIntegration();
