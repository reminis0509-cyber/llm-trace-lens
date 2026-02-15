/**
 * Multi-tenant models for workspace isolation
 */

export interface Workspace {
  id: string;
  name: string;
  created_at: Date;
  updated_at?: Date;
}

export interface ApiKey {
  key: string;
  workspace_id: string;
  name?: string;
  created_at: Date;
  last_used_at?: Date;
  is_active: boolean;
}

export interface WorkspaceUser {
  id: string;
  workspace_id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  created_at: Date;
}

export interface WorkspaceTrace {
  id: string;
  workspace_id: string;
  request_id: string;
  timestamp: string;
  provider: string;
  model: string;
  prompt: string;
  structured_response: Record<string, unknown>;
  validation_results: {
    confidence: { status: string; issues: string[] };
    risk: { status: string; issues: string[] };
    overall: string;
  };
  latency_ms: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  estimated_cost?: number;
}

export interface WorkspaceSettings {
  workspace_id: string;
  monthly_budget?: number;
  alert_thresholds?: number[];
  notification_email?: string;
  report_enabled?: boolean;
  custom_validation_patterns?: string[];
}

export interface WorkspaceProviderKeys {
  workspace_id: string;
  openai?: string;
  anthropic?: string;
  gemini?: string;
  deepseek?: string;
}

// Helper functions for workspace-scoped key generation
export function getWorkspaceKey(workspaceId: string, key: string): string {
  return `workspace:${workspaceId}:${key}`;
}

export function getTraceKey(workspaceId: string, traceId: string): string {
  return `workspace:${workspaceId}:trace:${traceId}`;
}

export function getApiKeyToWorkspaceKey(apiKey: string): string {
  return `api_key:${apiKey}:workspace`;
}

export function getWorkspaceSettingsKey(workspaceId: string): string {
  return `workspace:${workspaceId}:settings`;
}

export function getWorkspaceProvidersKey(workspaceId: string): string {
  return `workspace:${workspaceId}:providers`;
}

export function getCustomPatternsKey(workspaceId: string): string {
  return `workspace:${workspaceId}:custom_patterns`;
}

/**
 * Validation configuration for threshold blackboxing
 */
export interface ValidationConfigData {
  // For 'threshold' type
  confidenceMin?: number;
  evidenceMax?: number;
  piiBlockEnabled?: boolean;

  // For 'scoring_weights' type
  confidenceWeight?: number;
  evidenceWeight?: number;
  piiWeight?: number;
  historicalWeight?: number;

  // For 'risk_levels' type
  highRiskMin?: number;
  mediumRiskMin?: number;
  lowRiskMax?: number;
}

export interface ValidationConfig {
  id: string;
  workspaceId: string;
  configType: 'threshold' | 'scoring_weights' | 'risk_levels';
  configData: ValidationConfigData;
  createdAt: Date;
  updatedAt: Date;
}

export function getValidationConfigKey(workspaceId: string, configType: string): string {
  return `workspace:${workspaceId}:validation_config:${configType}`;
}

/**
 * Trace feedback for false positive/negative tracking
 */
export interface TraceFeedback {
  id: string;
  traceId: string;
  workspaceId: string;
  feedbackType: 'false_positive' | 'false_negative' | 'correct';
  reason?: string;
  submittedBy?: string;
  createdAt: Date;
}

export function getFeedbackKey(feedbackId: string): string {
  return `feedback:${feedbackId}`;
}

export function getFeedbackByTraceKey(traceId: string): string {
  return `feedback_by_trace:${traceId}`;
}

export function getWorkspaceFeedbackIndexKey(workspaceId: string): string {
  return `workspace:${workspaceId}:feedback:index`;
}
