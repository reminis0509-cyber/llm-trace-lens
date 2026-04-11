/**
 * FujiTrace AI 事務員 — System prompt builder.
 *
 * Loads the template from src/prompts/agent/system.md and injects the
 * available tools list so the LLM knows which tools it can dispatch to.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolSchema } from '../tools/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load a prompt template from the agent prompts directory.
 */
function loadAgentPromptTemplate(relativePath: string): string {
  // From src/agent/system-prompt.ts -> src/prompts/agent/<relativePath>
  const promptsDir = path.resolve(__dirname, '..', 'prompts', 'agent');
  const fullPath = path.join(promptsDir, relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Format tool schemas into a compact list for the system prompt.
 * Dedicated tools (estimate.*) get full detail; office tasks get a compact ID list.
 */
function formatToolsList(schemas: ToolSchema[]): string {
  const dedicated = schemas.filter((s) => s.name.startsWith('estimate.'));
  const officeTasks = schemas.filter((s) => !s.name.startsWith('estimate.') && !s.description.startsWith('[対応不可'));

  const dedicatedList = dedicated
    .map((s) => `- **${s.name}**: ${s.description}`)
    .join('\n');

  const officeTaskList = officeTasks
    .map((s) => `- ${s.name}: ${s.description.slice(0, 60)}`)
    .join('\n');

  return `### 専用ツール（function callingで直接呼び出し可能）\n${dedicatedList}\n\n### 汎用オフィスタスク（office_task_execute で task_id を指定）\n${officeTaskList}`;
}

/**
 * Build the full system prompt for the AI 事務員 agent.
 * Result is cached after first call (schemas are static at runtime).
 *
 * @param schemas - All registered ToolSchema entries from `allToolSchemas`
 * @returns The complete system prompt string with available tools injected
 */
let cachedSystemPrompt: string | null = null;

export function buildSystemPrompt(schemas: ToolSchema[]): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const template = loadAgentPromptTemplate('system.md');
  const toolsList = formatToolsList(schemas);
  cachedSystemPrompt = template.split('{available_tools}').join(toolsList);
  return cachedSystemPrompt;
}
