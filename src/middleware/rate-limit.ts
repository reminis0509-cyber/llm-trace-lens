import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export async function setupRateLimit(app: FastifyInstance): Promise<void> {
  // Rate limiting is enabled by default for security
  // Set RATE_LIMIT_ENABLED=false to explicitly disable
  const enabled = process.env.RATE_LIMIT_ENABLED !== 'false';

  if (!enabled) {
    console.log('[RateLimit] Explicitly disabled via RATE_LIMIT_ENABLED=false');
    return;
  }

  const max = parseInt(process.env.RATE_LIMIT_MAX || '100');
  const timeWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'); // 1 minute default

  await app.register(rateLimit, {
    max,
    timeWindow,
    cache: 10000, // Cache size
    allowList: [], // Whitelist IPs if needed
    keyGenerator: (request) => {
      // If API key authentication is enabled, use API key as identifier
      const apiKey = request.headers['x-api-key'] as string;
      if (apiKey) {
        return `apikey:${apiKey}`;
      }

      // Otherwise use IP address
      return request.ip;
    },
    errorResponseBuilder: (_request, context) => {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Max ${context.max} requests per ${context.after}.`,
        retryAfter: context.ttl
      };
    }
  });

  console.log(`[RateLimit] Enabled: ${max} requests per ${timeWindow}ms`);
}
