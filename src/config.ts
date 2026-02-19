import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenvConfig();

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // API keys are now optional - can be configured via /setup UI and stored in KV
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  MAX_RETRIES: z.string().default('3').transform(Number),
  TIMEOUT_MS: z.string().default('30000').transform(Number),
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
  MAX_TRACES: z.string().default('5000').transform(Number),
  MAX_AGE_DAYS: z.string().default('30').transform(Number),
  // LLM-as-Judge Evaluation
  ENABLE_EVALUATION: z.string().optional(),
  EVALUATION_MODEL: z.string().default('gpt-4o-mini'),
  // Secret Manager (encrypted API key storage)
  SECRET_ENCRYPTION_KEY: z.string().optional(), // 32-byte base64 key for AES-256-GCM
  // Base URL for endpoint responses
  BASE_URL: z.string().optional(),
  // API Key Cache
  API_KEY_CACHE_TTL: z.string().default('300').transform(Number), // キャッシュ有効期限（秒）
  API_KEY_EXPIRY_DAYS: z.string().default('90').transform(Number), // APIキー有効期限（日）
  ENABLE_API_KEY_CACHE: z.string().optional(),
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
  deepseekApiKey: parsed.data.DEEPSEEK_API_KEY,
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
  // Secret Manager
  secretEncryptionKey: parsed.data.SECRET_ENCRYPTION_KEY,
  baseUrl: parsed.data.BASE_URL,
  // API Key Cache
  apiKeyCacheTtl: parsed.data.API_KEY_CACHE_TTL,
  apiKeyExpiryDays: parsed.data.API_KEY_EXPIRY_DAYS,
  enableApiKeyCache: parsed.data.ENABLE_API_KEY_CACHE !== 'false',
} as const;

export type Config = typeof config;
