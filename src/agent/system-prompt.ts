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
 * Format tool schemas into a human-readable list for the system prompt.
 */
function formatToolsList(schemas: ToolSchema[]): string {
  return schemas
    .map(
      (s) =>
        `- **${s.name}**: ${s.description}\n  - HTTP: ${s.method} ${s.path}\n  - 責任レベル: ${s.responsibilityLevel}`,
    )
    .join('\n');
}

/**
 * Build the full system prompt for the AI 事務員 agent.
 *
 * @param schemas - All registered ToolSchema entries from `allToolSchemas`
 * @returns The complete system prompt string with available tools injected
 */
export function buildSystemPrompt(schemas: ToolSchema[]): string {
  const template = loadAgentPromptTemplate('system.md');
  const toolsList = formatToolsList(schemas);
  return template.split('{available_tools}').join(toolsList);
}
