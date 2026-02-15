const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '';

export interface LLMProviderKeys {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  deepseek?: string;
}

export interface ValidationRules {
  requireHighConfidence: boolean;
  blockInsufficientEvidence: boolean;
  blockPII: boolean;
  customRules?: string[];
}

export type StorageType = 'postgres' | 'kv';

export interface AppConfig {
  providers: LLMProviderKeys;
  validation: ValidationRules;
  storageType?: StorageType;
  setupCompleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchConfig(): Promise<AppConfig | null> {
  try {
    const response = await fetch(`${API_BASE}/api/settings`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch configuration');
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching config:', error);
    return null;
  }
}

export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
  const response = await fetch(`${API_BASE}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to save configuration' }));
    throw new Error(error.message || 'Failed to save configuration');
  }
}

export async function checkSetupStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/setup-status`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.setupCompleted ?? false;
  } catch {
    return false;
  }
}
