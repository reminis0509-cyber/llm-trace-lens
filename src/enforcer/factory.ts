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
 * - Direct API key from request (highest priority)
 * - Environment variables (development)
 * - KV store (legacy)
 * - Encrypted Secret Manager (recommended for production)
 */
export async function createEnforcer(
  provider: Provider,
  model?: string,
  workspaceId?: string,
  requestApiKey?: string
): Promise<OpenAIEnforcer | AnthropicEnforcer | GeminiEnforcer | DeepSeekEnforcer> {
  let apiKey: string;

  // If API key is provided directly in the request, use it
  if (requestApiKey) {
    apiKey = requestApiKey;
  } else {
    // Fall back to stored keys
    switch (provider) {
      case 'openai':
        apiKey = await getApiKey('openai', workspaceId);
        break;
      case 'anthropic':
        apiKey = await getApiKey('anthropic', workspaceId);
        break;
      case 'gemini':
        apiKey = await getApiKey('gemini', workspaceId);
        break;
      case 'deepseek':
        apiKey = await getApiKey('deepseek', workspaceId);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  switch (provider) {
    case 'openai':
      return new OpenAIEnforcer(apiKey);

    case 'anthropic':
      return new AnthropicEnforcer(apiKey);

    case 'gemini':
      return new GeminiEnforcer(apiKey, model);

    case 'deepseek':
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
