/**
 * Research Agent module exports.
 *
 * Usage:
 *   import { runResearchAgent } from './agent';
 *   import type { ResearchInput, ResearchReport, AgentStep } from './agent';
 */

export { runResearchAgent } from './react-agent';
export { webSearch } from './web-search';
export type {
  ResearchInput,
  ResearchReport,
  AgentStep,
  OnStepUpdate,
  ChatCompletionResponse,
  AgentTraceMetadata,
} from './types';
export type { SearchResult } from './web-search';
