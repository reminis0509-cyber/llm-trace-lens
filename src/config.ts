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
  // Vercel KV
  KV_REST_API_URL: z.string().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  // Database Configuration
  DATABASE_TYPE: z.enum(['kv', 'postgres', 'sqlite']).default('postgres'),
  DATABASE_URL: z.string().optional(),
  // Storage limits (for KV)
  MAX_TRACES: z.string().default('5000').transform(Number),
  MAX_AGE_DAYS: z.string().default('30').transform(Number),
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
  kvRestApiUrl: parsed.data.KV_REST_API_URL,
  kvRestApiToken: parsed.data.KV_REST_API_TOKEN,
  // Database Configuration
  databaseType: parsed.data.DATABASE_TYPE,
  databaseUrl: parsed.data.DATABASE_URL,
  // Storage limits (for KV)
  maxTraces: parsed.data.MAX_TRACES,
  maxAgeDays: parsed.data.MAX_AGE_DAYS,
} as const;

export type Config = typeof config;
