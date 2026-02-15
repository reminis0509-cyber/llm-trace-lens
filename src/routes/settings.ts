import type { FastifyInstance } from 'fastify';
import { getConfig, saveConfig, type LLMProviderKeys } from '../kv/client.js';

export async function settingsRoutes(fastify: FastifyInstance) {
  // Get current configuration (masks API keys)
  fastify.get('/api/settings', async (request, reply) => {
    try {
      const config = await getConfig();

      if (!config) {
        return reply.code(404).send({
          error: 'Configuration not found',
          message: 'Please complete setup',
        });
      }

      // Mask API keys - only show if they are set
      const maskedProviders: Record<string, string | undefined> = {};
      if (config.providers) {
        for (const [key, value] of Object.entries(config.providers)) {
          maskedProviders[key] = value ? '***' : undefined;
        }
      }

      return {
        validation: config.validation,
        setupCompleted: config.setupCompleted,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        providers: maskedProviders,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to retrieve configuration',
      });
    }
  });

  // Save configuration
  fastify.post('/api/settings', async (request, reply) => {
    try {
      const body = request.body as {
        providers?: LLMProviderKeys;
        validation?: {
          requireHighConfidence?: boolean;
          blockInsufficientEvidence?: boolean;
          blockPII?: boolean;
          customRules?: string[];
        };
        setupCompleted?: boolean;
      };

      // Validate that at least one provider key is set when completing setup
      if (body.setupCompleted && body.providers) {
        const hasAtLeastOneKey = Object.values(body.providers).some(
          key => key && key.trim() !== '' && key !== '***'
        );

        if (!hasAtLeastOneKey) {
          return reply.code(400).send({
            error: 'Validation error',
            message: 'At least one API key is required',
          });
        }
      }

      // Filter out masked values (don't overwrite with '***')
      const cleanProviders: LLMProviderKeys = {};
      if (body.providers) {
        for (const [key, value] of Object.entries(body.providers)) {
          if (value && value !== '***' && value.trim() !== '') {
            cleanProviders[key as keyof LLMProviderKeys] = value;
          }
        }
      }

      // Build validation rules with defaults
      const validationRules = body.validation ? {
        requireHighConfidence: body.validation.requireHighConfidence ?? true,
        blockInsufficientEvidence: body.validation.blockInsufficientEvidence ?? true,
        blockPII: body.validation.blockPII ?? true,
        customRules: body.validation.customRules,
      } : undefined;

      await saveConfig({
        providers: Object.keys(cleanProviders).length > 0 ? cleanProviders : undefined,
        validation: validationRules,
        setupCompleted: body.setupCompleted,
      });

      return {
        success: true,
        message: 'Configuration saved successfully',
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to save configuration',
      });
    }
  });

  // Check if setup is completed (lightweight endpoint for routing)
  fastify.get('/api/setup-status', async () => {
    try {
      const config = await getConfig();
      return {
        setupCompleted: config?.setupCompleted ?? false,
      };
    } catch {
      return {
        setupCompleted: false,
      };
    }
  });
}
