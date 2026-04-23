import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenvConfig();

// デフォルト値の定数定義
const DEFAULT_PORT = '3000';                    // HTTPサーバーのデフォルトポート
const DEFAULT_MAX_RETRIES = '3';                // API呼び出しの最大リトライ回数
const DEFAULT_TIMEOUT_MS = '30000';             // API呼び出しのタイムアウト（30秒）
const DEFAULT_MAX_TRACES = '5000';              // KVに保存する最大トレース数
const DEFAULT_MAX_AGE_DAYS = '30';              // トレースの保存期間（30日）
const DEFAULT_EVALUATION_TIMEOUT_MS = '5000';   // LLM評価のタイムアウト（5秒）
const DEFAULT_API_KEY_CACHE_TTL = '300';        // APIキーキャッシュの有効期限（5分）
const DEFAULT_API_KEY_EXPIRY_DAYS = '90';       // APIキーの有効期限（90日）

const envSchema = z.object({
  PORT: z.string().default(DEFAULT_PORT).transform(Number),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // API keys are now optional - can be configured via /setup UI and stored in KV
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  MAX_RETRIES: z.string().default(DEFAULT_MAX_RETRIES).transform(Number),
  TIMEOUT_MS: z.string().default(DEFAULT_TIMEOUT_MS).transform(Number),
  // Authentication
  ENABLE_AUTH: z.string().optional(),
  API_KEYS: z.string().optional(),
  ADMIN_API_KEY: z.string().optional(),
  // Vercel KV
  KV_REST_API_URL: z.string().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  // Database Configuration
  DATABASE_TYPE: z.enum(['kv', 'postgres', 'sqlite']).default('postgres'),
  DATABASE_URL: z.string().optional(),
  // Storage limits (for KV)
  MAX_TRACES: z.string().default(DEFAULT_MAX_TRACES).transform(Number),
  MAX_AGE_DAYS: z.string().default(DEFAULT_MAX_AGE_DAYS).transform(Number),
  // LLM-as-Judge Evaluation
  ENABLE_EVALUATION: z.string().optional(),
  EVALUATION_MODEL: z.string().default('gpt-4o-mini'),
  EVALUATION_SAMPLING_RATE: z.string().default('1.0'),
  EVALUATION_TIMEOUT_MS: z.string().default(DEFAULT_EVALUATION_TIMEOUT_MS),
  // Secret Manager (encrypted API key storage)
  SECRET_ENCRYPTION_KEY: z.string().optional(), // 32-byte base64 key for AES-256-GCM
  // Base URL for endpoint responses
  BASE_URL: z.string().optional(),
  // API Key Cache
  API_KEY_CACHE_TTL: z.string().default(DEFAULT_API_KEY_CACHE_TTL).transform(Number),
  API_KEY_EXPIRY_DAYS: z.string().default(DEFAULT_API_KEY_EXPIRY_DAYS).transform(Number),
  ENABLE_API_KEY_CACHE: z.string().optional(),
  // LINE Messaging API (FujiTrace Official Account integration)
  // Absent values disable the LINE webhook route without affecting other features.
  LINE_CHANNEL_SECRET: z.string().optional(),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional(),
  LINE_LIFF_ID: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parsed.data.PORT,
  logLevel: parsed.data.LOG_LEVEL,
  openaiApiKey: parsed.data.OPENAI_API_KEY,
  anthropicApiKey: parsed.data.ANTHROPIC_API_KEY,
  googleApiKey: parsed.data.GOOGLE_API_KEY,
  maxRetries: parsed.data.MAX_RETRIES,
  timeoutMs: parsed.data.TIMEOUT_MS,
  enableAuth: parsed.data.ENABLE_AUTH,
  apiKeys: parsed.data.API_KEYS,
  adminApiKey: parsed.data.ADMIN_API_KEY,
  kvRestApiUrl: parsed.data.KV_REST_API_URL,
  kvRestApiToken: parsed.data.KV_REST_API_TOKEN,
  // Database Configuration
  databaseType: parsed.data.DATABASE_TYPE,
  databaseUrl: parsed.data.DATABASE_URL,
  // Storage limits (for KV)
  maxTraces: parsed.data.MAX_TRACES,
  maxAgeDays: parsed.data.MAX_AGE_DAYS,
  // LLM-as-Judge Evaluation
  enableEvaluation: parsed.data.ENABLE_EVALUATION === 'true',
  evaluationModel: parsed.data.EVALUATION_MODEL,
  evaluationSamplingRate: parseFloat(parsed.data.EVALUATION_SAMPLING_RATE),
  evaluationTimeoutMs: parseInt(parsed.data.EVALUATION_TIMEOUT_MS, 10),
  // Secret Manager
  secretEncryptionKey: parsed.data.SECRET_ENCRYPTION_KEY,
  baseUrl: parsed.data.BASE_URL,
  // API Key Cache
  apiKeyCacheTtl: parsed.data.API_KEY_CACHE_TTL,
  apiKeyExpiryDays: parsed.data.API_KEY_EXPIRY_DAYS,
  enableApiKeyCache: parsed.data.ENABLE_API_KEY_CACHE !== 'false',
  // LINE Messaging API
  lineChannelSecret: parsed.data.LINE_CHANNEL_SECRET,
  lineChannelAccessToken: parsed.data.LINE_CHANNEL_ACCESS_TOKEN,
  lineLiffId: parsed.data.LINE_LIFF_ID,
} as const;

/**
 * LINE integration enablement summary.
 *
 * The LINE feature is active only when all three values are present. Missing
 * values emit a startup warning (see `src/routes/line-webhook.ts`) but do not
 * abort process startup — the rest of the application keeps working.
 */
export const lineConfig = {
  channelSecret: config.lineChannelSecret,
  channelAccessToken: config.lineChannelAccessToken,
  liffId: config.lineLiffId,
  get enabled(): boolean {
    return Boolean(
      config.lineChannelSecret &&
        config.lineChannelAccessToken &&
        config.lineLiffId,
    );
  },
} as const;

export type Config = typeof config;

// 評価機能設定（専用オブジェクト）
export const evaluationConfig = {
  enabled: config.enableEvaluation,
  model: config.evaluationModel,
  samplingRate: config.evaluationSamplingRate,
  timeoutMs: config.evaluationTimeoutMs,
} as const;
