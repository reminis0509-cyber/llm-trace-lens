export interface ModelPricing {
  inputPer1M: number;  // USD per 1M input tokens
  outputPer1M: number; // USD per 1M output tokens
}

// Model pricing as of 2025 (update as needed)
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4': { inputPer1M: 30.0, outputPer1M: 60.0 },
  'gpt-4-turbo': { inputPer1M: 10.0, outputPer1M: 30.0 },
  'gpt-4-turbo-preview': { inputPer1M: 10.0, outputPer1M: 30.0 },
  'gpt-4o': { inputPer1M: 5.0, outputPer1M: 15.0 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gpt-3.5-turbo': { inputPer1M: 0.50, outputPer1M: 1.50 },
  'o1': { inputPer1M: 15.0, outputPer1M: 60.0 },
  'o1-mini': { inputPer1M: 3.0, outputPer1M: 12.0 },
  'o1-preview': { inputPer1M: 15.0, outputPer1M: 60.0 },

  // Anthropic
  'claude-opus-4': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-opus-4-5': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-sonnet-4': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-5-sonnet': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3.5-sonnet': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-sonnet-3.5': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-haiku-3.5': { inputPer1M: 1.0, outputPer1M: 5.0 },
  'claude-3-haiku': { inputPer1M: 0.25, outputPer1M: 1.25 },
  'claude-3-opus': { inputPer1M: 15.0, outputPer1M: 75.0 },

  // Google
  'gemini-1.5-pro': { inputPer1M: 3.5, outputPer1M: 10.5 },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
  'gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gemini-2.0-flash-exp': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gemini-pro': { inputPer1M: 0.50, outputPer1M: 1.50 },

  // DeepSeek
  'deepseek-chat': { inputPer1M: 0.27, outputPer1M: 1.10 },
  'deepseek-reasoner': { inputPer1M: 0.55, outputPer1M: 2.19 },
  'deepseek-coder': { inputPer1M: 0.14, outputPer1M: 0.28 },
};

// Fallback pricing for unknown models
const DEFAULT_PRICING: ModelPricing = {
  inputPer1M: 1.0,
  outputPer1M: 3.0,
};

/**
 * Normalize model name for pricing lookup
 */
function normalizeModelName(model: string): string {
  // Remove date suffixes (e.g., -2024-10-22, -20241022)
  let normalized = model.toLowerCase()
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-\d{8}$/, '');

  // Common aliases
  const aliases: Record<string, string> = {
    'gpt-4-0613': 'gpt-4',
    'gpt-4-1106-preview': 'gpt-4-turbo',
    'gpt-4-0125-preview': 'gpt-4-turbo',
    'gpt-3.5-turbo-0125': 'gpt-3.5-turbo',
    'gpt-3.5-turbo-1106': 'gpt-3.5-turbo',
  };

  return aliases[normalized] || normalized;
}

/**
 * Calculate cost for a request
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const normalizedModel = normalizeModelName(model);

  // Find exact match or partial match
  let pricing = MODEL_PRICING[normalizedModel];

  if (!pricing) {
    // Try partial matching
    for (const [key, value] of Object.entries(MODEL_PRICING)) {
      if (normalizedModel.includes(key) || key.includes(normalizedModel)) {
        pricing = value;
        break;
      }
    }
  }

  if (!pricing) {
    console.warn(`[Cost] Unknown model "${model}", using default pricing`);
    pricing = DEFAULT_PRICING;
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;

  return inputCost + outputCost;
}

/**
 * Get pricing for a specific model
 */
export function getModelPricing(model: string): ModelPricing {
  const normalizedModel = normalizeModelName(model);
  return MODEL_PRICING[normalizedModel] || DEFAULT_PRICING;
}

/**
 * List all supported models
 */
export function listSupportedModels(): string[] {
  return Object.keys(MODEL_PRICING);
}
