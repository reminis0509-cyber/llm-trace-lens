/**
 * ToolSchema generation for all office tasks in the catalog.
 *
 * Each OfficeTaskEntry becomes a single ToolSchema entry with a unique name,
 * enabling GPT-4o exact matching when the AI clerk dispatches user requests.
 *
 * Schemas are now archetype-aware: the inputSchema includes fields from the
 * task's archetype definition plus any task-specific fields. The `instruction`
 * field is always present regardless of archetype so users can add context.
 *
 * All tasks share the same generic endpoint: POST /api/tools/office-task/execute
 * Forbidden tasks include a refusal prefix in their description so the agent
 * can surface the limitation before even calling the endpoint.
 */
import type { ToolSchema } from '../types.js';
import type { ArchetypeField } from './archetypes.js';
import { getArchetype } from './archetypes.js';
import { officeTaskCatalog } from './catalog.js';

/**
 * Convert an ArchetypeField to a JSON Schema property definition.
 */
function fieldToJsonSchema(field: ArchetypeField): Record<string, unknown> {
  const base: Record<string, unknown> = { description: field.label };

  switch (field.type) {
    case 'string':
      base.type = 'string';
      break;
    case 'text':
      base.type = 'string';
      break;
    case 'number':
      base.type = 'number';
      break;
    case 'boolean':
      base.type = 'boolean';
      break;
    case 'array':
      base.type = 'array';
      base.items = { type: 'object' };
      break;
  }

  if (field.placeholder) {
    base.examples = [field.placeholder];
  }
  if (field.description) {
    base.description = `${field.label} - ${field.description}`;
  }

  return base;
}

function generateInputSchema(task: (typeof officeTaskCatalog)[number]): Record<string, unknown> {
  const archetype = getArchetype(task.archetype);

  const properties: Record<string, Record<string, unknown>> = {
    task_id: { type: 'string', const: task.id, description: 'タスクID' },
    instruction: { type: 'string', description: '作業の詳細指示（何をしてほしいか）' },
    context: { type: 'string', description: '参考情報やデータ（任意）' },
  };

  // Add archetype fields
  for (const field of archetype.inputFields) {
    properties[field.name] = fieldToJsonSchema(field);
  }

  // Add task-specific fields
  if (task.taskSpecificFields) {
    for (const field of task.taskSpecificFields) {
      properties[field.name] = fieldToJsonSchema(field);
    }
  }

  // Build required list: task_id + instruction + archetype required fields
  const required: string[] = ['task_id', 'instruction'];
  for (const field of archetype.inputFields) {
    if (field.required && !required.includes(field.name)) {
      required.push(field.name);
    }
  }
  if (task.taskSpecificFields) {
    for (const field of task.taskSpecificFields) {
      if (field.required && !required.includes(field.name)) {
        required.push(field.name);
      }
    }
  }

  return {
    type: 'object',
    properties,
    required,
  };
}

function generateOutputSchema(task: (typeof officeTaskCatalog)[number]): Record<string, unknown> {
  const archetype = getArchetype(task.archetype);

  if (archetype.outputFields.length === 0) {
    // Forbidden archetype — generic output
    return {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
        forbidden: { type: 'boolean' },
        law: { type: 'string' },
      },
      required: ['success', 'error'],
    };
  }

  const properties: Record<string, Record<string, unknown>> = {
    task_id: { type: 'string' },
    task_name: { type: 'string' },
    trace_id: { type: 'string', nullable: true },
    caution_note: { type: 'string' },
  };

  // Add archetype output fields as a nested structured_result
  const resultProperties: Record<string, Record<string, unknown>> = {};
  const resultRequired: string[] = [];

  for (const field of archetype.outputFields) {
    resultProperties[field.name] = fieldToJsonSchema(field);
    if (field.required) {
      resultRequired.push(field.name);
    }
  }

  properties['structured_result'] = {
    type: 'object',
    properties: resultProperties,
    required: resultRequired,
  };

  // Also keep raw result for backward compatibility
  properties['result'] = { type: 'string' };

  return {
    type: 'object',
    properties,
    required: ['task_id', 'task_name'],
  };
}

export const officeTaskSchemas: ToolSchema[] = officeTaskCatalog.map((task) => ({
  name: task.id,
  description: task.forbidden
    ? `[対応不可: 士業独占業務] ${task.name} -- ${task.forbiddenLaw ?? '関連法令'}`
    : task.description,
  version: '2.0.0',
  method: 'POST' as const,
  path: '/api/tools/office-task/execute',
  inputSchema: generateInputSchema(task),
  outputSchema: generateOutputSchema(task),
  responsibilityLevel: task.responsibilityLevel,
}));
