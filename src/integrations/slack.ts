import axios from 'axios';

/**
 * Slack Block Kit message format
 */
export interface SlackBlockKitMessage {
  text: string;
  blocks: SlackBlock[];
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: SlackElement[];
}

interface SlackElement {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  style?: string;
  value?: string;
  action_id?: string;
  url?: string;
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
 * Slack Integration for sending rich notifications
 */
export class SlackIntegration {
  /**
   * Send a Block Kit formatted notification to Slack
   */
  async sendBlockNotification(
    webhookUrl: string,
    trace: TraceInfo,
    riskLevel: string
  ): Promise<void> {
    const color = this.getRiskColor(riskLevel);
    const emoji = this.getRiskEmoji(riskLevel);
    const timestamp = trace.timestamp ? new Date(trace.timestamp).toLocaleString() : 'N/A';

    const message: SlackBlockKitMessage = {
      text: `${emoji} [LLM Trace Lens] ${riskLevel.toUpperCase()} Risk Detected`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${riskLevel.toUpperCase()} Risk Detected`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Trace ID:*\n\`${trace.id}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Risk Score:*\n${trace.validationResults?.riskScore ?? 'N/A'}/100`,
            },
            {
              type: 'mrkdwn',
              text: `*Provider/Model:*\n${trace.provider || 'unknown'}/${trace.model || 'unknown'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Timestamp:*\n${timestamp}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Explanation:*\n${trace.validationResults?.explanation || 'No explanation available'}`,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Details',
                emoji: true,
              },
              value: `view_${trace.id}`,
              action_id: 'view_trace',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Mark as False Positive',
                emoji: true,
              },
              style: 'danger',
              value: `fp_${trace.id}`,
              action_id: 'mark_false_positive',
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Sent by LLM Trace Lens v0.4.0`,
            },
          ] as any,
        },
      ],
    };

    try {
      await axios.post(webhookUrl, message, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      console.log(`[SlackIntegration] Notification sent for trace ${trace.id}`);
    } catch (error) {
      console.error('[SlackIntegration] Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Send a simple text notification to Slack
   */
  async sendSimpleNotification(
    webhookUrl: string,
    message: string
  ): Promise<void> {
    try {
      await axios.post(webhookUrl, { text: message }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
    } catch (error) {
      console.error('[SlackIntegration] Failed to send simple notification:', error);
      throw error;
    }
  }

  /**
   * Send a test notification to verify webhook configuration
   */
  async sendTestNotification(webhookUrl: string): Promise<boolean> {
    const testMessage: SlackBlockKitMessage = {
      text: 'LLM Trace Lens - Test Notification',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'LLM Trace Lens Connection Test',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'This is a test notification from LLM Trace Lens. If you see this message, your Slack integration is working correctly!',
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Sent at ${new Date().toISOString()}`,
            },
          ] as any,
        },
      ],
    };

    try {
      await axios.post(webhookUrl, testMessage, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      return true;
    } catch (error) {
      console.error('[SlackIntegration] Test notification failed:', error);
      return false;
    }
  }

  private getRiskColor(level: string): string {
    switch (level.toLowerCase()) {
      case 'high':
        return '#dc2626'; // red
      case 'medium':
        return '#f59e0b'; // amber
      case 'low':
        return '#10b981'; // green
      default:
        return '#6b7280'; // gray
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

export const slackIntegration = new SlackIntegration();
