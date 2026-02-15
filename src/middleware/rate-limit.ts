import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

// レートリミットのデフォルト設定
/** デフォルトの最大リクエスト数（時間枠あたり） */
const DEFAULT_MAX_REQUESTS = 100;

/** デフォルトの時間枠: 1分（60000ミリ秒） */
const DEFAULT_WINDOW_MS = 60000;

/** レートリミットキャッシュサイズ（IPアドレスまたはAPIキーの数） */
const RATE_LIMIT_CACHE_SIZE = 10000;

export async function setupRateLimit(app: FastifyInstance): Promise<void> {
  // Rate limiting is enabled by default for security
  // Set RATE_LIMIT_ENABLED=false to explicitly disable
  const enabled = process.env.RATE_LIMIT_ENABLED !== 'false';

  if (!enabled) {
    console.log('[RateLimit] Explicitly disabled via RATE_LIMIT_ENABLED=false');
    return;
  }

  const max = parseInt(process.env.RATE_LIMIT_MAX || String(DEFAULT_MAX_REQUESTS));
  const timeWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(DEFAULT_WINDOW_MS));

  await app.register(rateLimit, {
    max,
    timeWindow,
    cache: RATE_LIMIT_CACHE_SIZE,
    allowList: [], // Whitelist IPs if needed
    keyGenerator: (request) => {
      // ワークスペース単位でレートリミット（auth middleware で設定済み）
      const workspaceId = request.workspace?.workspaceId;
      if (workspaceId && workspaceId !== 'default') {
        return `workspace:${workspaceId}`;
      }

      // Bearer トークンがあればプレフィックスのみ使用（平文ログ防止）
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        return `bearer:${token.slice(0, 8)}`;
      }

      // フォールバック: IPアドレス
      return request.ip;
    },
    errorResponseBuilder: (_request, context) => {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `レート制限を超過しました。最大 ${context.max} リクエスト / ${context.after}`,
        retryAfter: context.ttl
      };
    }
  });

  console.log(`[RateLimit] Enabled: ${max} requests per ${timeWindow}ms`);
}
