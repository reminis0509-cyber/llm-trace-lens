import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { slackIntegration } from '../integrations/slack.js';
import { teamsIntegration } from '../integrations/teams.js';
import { getWorkspaceFromApiKey } from '../kv/client.js';

/**
 * Integration routes for Slack and Teams webhook management
 */
export async function integrationsRoutes(fastify: FastifyInstance): Promise<void> {
  // Workspace authentication hook
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === 'OPTIONS') {
      return;
    }

    const apiKey = request.headers['x-api-key'] as string | undefined;
    if (!apiKey) {
      return reply.code(401).send({ error: 'Missing x-api-key header' });
    }

    const workspaceId = await getWorkspaceFromApiKey(apiKey);
    if (!workspaceId) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }

    (request as any).workspaceId = workspaceId;
  });

  /**
   * POST /integrations/test
   * Test a webhook connection
   */
  fastify.post('/integrations/test', async (
    request: FastifyRequest<{
      Body: {
        url: string;
        platform: 'Slack' | 'Teams' | 'generic';
      };
    }>,
    reply: FastifyReply
  ) => {
    const { url, platform } = request.body;

    if (!url) {
      return reply.code(400).send({ error: 'Missing webhook URL' });
    }

    try {
      let success = false;

      switch (platform) {
        case 'Slack':
          success = await slackIntegration.sendTestNotification(url);
          break;
        case 'Teams':
          success = await teamsIntegration.sendTestNotification(url);
          break;
        default:
          // Generic webhook test
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'test',
              message: 'LLM Trace Lens connection test',
              timestamp: new Date().toISOString(),
            }),
          });
          success = response.ok;
      }

      if (success) {
        return reply.send({
          success: true,
          message: `${platform} connection test successful`,
        });
      } else {
        return reply.code(400).send({
          success: false,
          error: `${platform} connection test failed`,
        });
      }
    } catch (error) {
      console.error('Webhook test failed:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /integrations/send-sample
   * Send a sample notification to test the webhook
   */
  fastify.post('/integrations/send-sample', async (
    request: FastifyRequest<{
      Body: {
        url: string;
        platform: 'Slack' | 'Teams';
        riskLevel?: 'low' | 'medium' | 'high';
      };
    }>,
    reply: FastifyReply
  ) => {
    const { url, platform, riskLevel = 'high' } = request.body;

    if (!url || !platform) {
      return reply.code(400).send({ error: 'Missing url or platform' });
    }

    const mockTrace = {
      id: 'sample-trace-123',
      validationResults: {
        riskScore: riskLevel === 'high' ? 85 : riskLevel === 'medium' ? 55 : 20,
        riskLevel,
        explanation: 'This is a sample notification to test your integration.',
        overall: riskLevel === 'high' ? 'BLOCK' : riskLevel === 'medium' ? 'WARN' : 'PASS',
      },
      provider: 'openai',
      model: 'gpt-4',
      timestamp: new Date().toISOString(),
    };

    try {
      if (platform === 'Slack') {
        await slackIntegration.sendBlockNotification(url, mockTrace, riskLevel);
      } else if (platform === 'Teams') {
        await teamsIntegration.sendAdaptiveCard(url, mockTrace, riskLevel);
      }

      return reply.send({
        success: true,
        message: `Sample ${riskLevel} risk notification sent to ${platform}`,
      });
    } catch (error) {
      console.error('Sample notification failed:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /integrations/supported
   * Get list of supported integrations
   */
  fastify.get('/integrations/supported', async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    return reply.send({
      integrations: [
        {
          id: 'slack',
          name: 'Slack',
          description: 'Send notifications to Slack channels via webhooks',
          urlPattern: 'https://hooks.slack.com/services/*',
          features: ['block_kit', 'actions', 'rich_formatting'],
        },
        {
          id: 'teams',
          name: 'Microsoft Teams',
          description: 'Send notifications to Teams channels via webhooks',
          urlPattern: 'https://*.webhook.office.com/*',
          features: ['adaptive_cards', 'rich_formatting'],
        },
        {
          id: 'generic',
          name: 'Generic Webhook',
          description: 'Send JSON notifications to any HTTP endpoint',
          urlPattern: 'https://*',
          features: ['json_payload'],
        },
      ],
    });
  });
}

export default integrationsRoutes;
