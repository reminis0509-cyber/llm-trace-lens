import { OpenAIEnforcer } from './openai.js';
import { AnthropicEnforcer } from './anthropic.js';
import { GeminiEnforcer } from './gemini.js';
import { DeepSeekEnforcer } from './deepseek.js';
import { getApiKey } from '../kv/client.js';
import type { Provider } from '../types/index.js';

/**
 * Create enforcer for MVP handlers
 * Returns an enforcer with the LLMRequest-based interface
 * Now supports:
 * - Environment variables (development)
 * - KV store (legacy)
 * - Encrypted Secret Manager (recommended for production)
 */
export async function createEnforcer(
  provider: Provider,
  model?: string,
  workspaceId?: string
): Promise<OpenAIEnforcer | AnthropicEnforcer | GeminiEnforcer | DeepSeekEnforcer> {
  let apiKey: string;

  switch (provider) {
    case 'openai':
      apiKey = await getApiKey('openai', workspaceId);
      return new OpenAIEnforcer(apiKey);

    case 'anthropic':
      apiKey = await getApiKey('anthropic', workspaceId);
      return new AnthropicEnforcer(apiKey);

    case 'gemini':
      apiKey = await getApiKey('gemini', workspaceId);
      return new GeminiEnforcer(apiKey, model);

    case 'deepseek':
      apiKey = await getApiKey('deepseek', workspaceId);
      return new DeepSeekEnforcer(apiKey);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Synchronous version for backward compatibility (uses env vars only)
 */
export function createEnforcerSync(
  provider: Provider,
  model?: string
): OpenAIEnforcer | AnthropicEnforcer | GeminiEnforcer | DeepSeekEnforcer {
  let apiKey: string | undefined;

  switch (provider) {
    case 'openai':
      apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required for OpenAI provider');
      }
      return new OpenAIEnforcer(apiKey);

    case 'anthropic':
      apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required for Anthropic provider');
      }
      return new AnthropicEnforcer(apiKey);

    case 'gemini':
      apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('GOOGLE_API_KEY environment variable is required for Gemini provider');
      }
      return new GeminiEnforcer(apiKey, model);

    case 'deepseek':
      apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY environment variable is required for DeepSeek provider');
      }
      return new DeepSeekEnforcer(apiKey);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
