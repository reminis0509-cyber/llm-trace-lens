import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getValidationConfig,
  saveValidationConfig,
  getAllValidationConfigs,
  deleteValidationConfig,
  listWorkspaces,
} from '../kv/client.js';
import type { ValidationConfig, ValidationConfigData } from '../storage/models.js';

/**
 * Admin routes for validation configuration management
 * These endpoints are protected by ADMIN_API_KEY
 * Used for threshold blackboxing - allows admins to configure scoring weights
 */
export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // Admin authentication middleware
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for preflight requests
    if (request.method === 'OPTIONS') {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized: Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const adminToken = process.env.ADMIN_API_KEY;

    if (!adminToken) {
      return reply.code(500).send({ error: 'Server configuration error: ADMIN_API_KEY not set' });
    }

    if (token !== adminToken) {
      return reply.code(403).send({ error: 'Forbidden: Invalid admin token' });
    }
  });

  /**
   * GET /admin/thresholds
   * Get all validation configs across all workspaces
   */
  fastify.get('/admin/thresholds', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const workspaces = await listWorkspaces();
      const allConfigs: Array<{ workspaceId: string; configs: ValidationConfig[] }> = [];

      for (const workspaceId of workspaces) {
        const configs = await getAllValidationConfigs(workspaceId);
        if (configs.length > 0) {
          allConfigs.push({ workspaceId, configs });
        }
      }

      return reply.send({
        success: true,
        data: allConfigs,
        totalWorkspaces: workspaces.length,
      });
    } catch (error) {
      console.error('Failed to get thresholds:', error);
      return reply.code(500).send({
        error: 'Failed to retrieve threshold configurations',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /admin/thresholds/:workspaceId
   * Get validation configs for a specific workspace
   */
  fastify.get('/admin/thresholds/:workspaceId', async (
    request: FastifyRequest<{ Params: { workspaceId: string } }>,
    reply: FastifyReply
  ) => {
    const { workspaceId } = request.params;

    try {
      const configs = await getAllValidationConfigs(workspaceId);
      return reply.send({
        success: true,
        workspaceId,
        configs,
      });
    } catch (error) {
      console.error('Failed to get workspace thresholds:', error);
      return reply.code(500).send({
        error: 'Failed to retrieve workspace threshold configurations',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * PUT /admin/thresholds/:workspaceId
   * Update validation config for a specific workspace
   */
  fastify.put('/admin/thresholds/:workspaceId', async (
    request: FastifyRequest<{
      Params: { workspaceId: string };
      Body: {
        configType: 'threshold' | 'scoring_weights' | 'risk_levels';
        configData: ValidationConfigData;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { workspaceId } = request.params;
    const { configType, configData } = request.body;

    if (!configType || !configData) {
      return reply.code(400).send({
        error: 'Missing required fields: configType and configData',
      });
    }

    // Validate configType
    const validConfigTypes = ['threshold', 'scoring_weights', 'risk_levels'];
    if (!validConfigTypes.includes(configType)) {
      return reply.code(400).send({
        error: `Invalid configType. Must be one of: ${validConfigTypes.join(', ')}`,
      });
    }

    // Validate configData based on type
    const validationError = validateConfigData(configType, configData);
    if (validationError) {
      return reply.code(400).send({ error: validationError });
    }

    try {
      const config: ValidationConfig = {
        id: `${workspaceId}_${configType}_${Date.now()}`,
        workspaceId,
        configType,
        configData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await saveValidationConfig(config);

      return reply.send({
        success: true,
        message: 'Validation config updated successfully',
        config,
      });
    } catch (error) {
      console.error('Failed to save validation config:', error);
      return reply.code(500).send({
        error: 'Failed to save validation configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * DELETE /admin/thresholds/:workspaceId/:configType
   * Delete a specific validation config for a workspace
   */
  fastify.delete('/admin/thresholds/:workspaceId/:configType', async (
    request: FastifyRequest<{
      Params: {
        workspaceId: string;
        configType: 'threshold' | 'scoring_weights' | 'risk_levels';
      };
    }>,
    reply: FastifyReply
  ) => {
    const { workspaceId, configType } = request.params;

    const validConfigTypes = ['threshold', 'scoring_weights', 'risk_levels'];
    if (!validConfigTypes.includes(configType)) {
      return reply.code(400).send({
        error: `Invalid configType. Must be one of: ${validConfigTypes.join(', ')}`,
      });
    }

    try {
      await deleteValidationConfig(workspaceId, configType);

      return reply.send({
        success: true,
        message: `Validation config '${configType}' deleted for workspace '${workspaceId}'`,
      });
    } catch (error) {
      console.error('Failed to delete validation config:', error);
      return reply.code(500).send({
        error: 'Failed to delete validation configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /admin/thresholds/reset/:workspaceId
   * Reset all validation configs for a workspace to defaults
   */
  fastify.post('/admin/thresholds/reset/:workspaceId', async (
    request: FastifyRequest<{ Params: { workspaceId: string } }>,
    reply: FastifyReply
  ) => {
    const { workspaceId } = request.params;

    try {
      // Delete all configs
      const configTypes: Array<'threshold' | 'scoring_weights' | 'risk_levels'> = [
        'threshold',
        'scoring_weights',
        'risk_levels',
      ];

      for (const configType of configTypes) {
        try {
          await deleteValidationConfig(workspaceId, configType);
        } catch {
          // Ignore if config doesn't exist
        }
      }

      return reply.send({
        success: true,
        message: `All validation configs reset to defaults for workspace '${workspaceId}'`,
      });
    } catch (error) {
      console.error('Failed to reset validation configs:', error);
      return reply.code(500).send({
        error: 'Failed to reset validation configurations',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

/**
 * Validate config data based on config type
 */
function validateConfigData(
  configType: string,
  configData: ValidationConfigData
): string | null {
  switch (configType) {
    case 'threshold':
      if (configData.confidenceMin !== undefined) {
        if (typeof configData.confidenceMin !== 'number' || configData.confidenceMin < 0 || configData.confidenceMin > 100) {
          return 'confidenceMin must be a number between 0 and 100';
        }
      }
      if (configData.evidenceMax !== undefined) {
        if (typeof configData.evidenceMax !== 'number' || configData.evidenceMax < 0) {
          return 'evidenceMax must be a non-negative number';
        }
      }
      break;

    case 'scoring_weights':
      const weightFields = ['confidenceWeight', 'evidenceWeight', 'piiWeight', 'historicalWeight'];
      let totalWeight = 0;

      for (const field of weightFields) {
        const value = configData[field as keyof ValidationConfigData] as number | undefined;
        if (value !== undefined) {
          if (typeof value !== 'number' || value < 0 || value > 1) {
            return `${field} must be a number between 0 and 1`;
          }
          totalWeight += value;
        }
      }

      if (totalWeight > 0 && Math.abs(totalWeight - 1) > 0.001) {
        return `Scoring weights should sum to 1.0 (current sum: ${totalWeight.toFixed(3)})`;
      }
      break;

    case 'risk_levels':
      if (configData.highRiskMin !== undefined) {
        if (typeof configData.highRiskMin !== 'number' || configData.highRiskMin < 0 || configData.highRiskMin > 100) {
          return 'highRiskMin must be a number between 0 and 100';
        }
      }
      if (configData.mediumRiskMin !== undefined) {
        if (typeof configData.mediumRiskMin !== 'number' || configData.mediumRiskMin < 0 || configData.mediumRiskMin > 100) {
          return 'mediumRiskMin must be a number between 0 and 100';
        }
      }
      if (configData.lowRiskMax !== undefined) {
        if (typeof configData.lowRiskMax !== 'number' || configData.lowRiskMax < 0 || configData.lowRiskMax > 100) {
          return 'lowRiskMax must be a number between 0 and 100';
        }
      }
      // Validate ordering
      const high = configData.highRiskMin ?? 70;
      const medium = configData.mediumRiskMin ?? 40;
      if (medium >= high) {
        return 'mediumRiskMin must be less than highRiskMin';
      }
      break;
  }

  return null;
}

export default adminRoutes;
