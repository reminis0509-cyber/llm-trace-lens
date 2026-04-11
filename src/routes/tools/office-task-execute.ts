/**
 * POST /api/tools/office-task/execute
 *
 * Archetype-aware endpoint for all office tasks registered in the catalog.
 * Each task is identified by its `task_id` field and routed through its
 * archetype's structured schema, prompt template, and validation logic.
 *
 * Forbidden tasks (士業独占業務) return a structured refusal without calling
 * the LLM.
 *
 * Request body:
 *   { task_id: string, instruction: string, context?: string, ...archetype_fields }
 *
 * Response (success):
 *   { success: true, data: { task_id, task_name, result, structured_result, caution_note?, trace_id } }
 *
 * Response (forbidden):
 *   { success: false, error: string, forbidden: true, law: string }
 *
 * Response (validation error):
 *   { success: false, error: string, validation_issues: ValidationIssue[] }
 *
 * Response (error):
 *   { success: false, error: string }
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { officeTaskCatalog } from '../../tools/office-tasks/catalog.js';
import { getArchetype } from '../../tools/office-tasks/archetypes.js';
import { validateInput, validateOutput } from '../../tools/office-tasks/validator.js';
import {
  resolveWorkspaceId,
  callLlmViaProxy,
  recordUsage,
  loadPromptTemplate,
  renderTemplate,
  enforceFreeQuota,
} from './_shared.js';

/**
 * Flexible request schema: task_id and instruction are always required,
 * additional fields are passed through for archetype validation.
 */
const requestSchema = z.object({
  task_id: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'task_id must contain only alphanumeric characters, dots, hyphens, and underscores',
    ),
  instruction: z.string().min(1).max(5000),
  context: z.string().max(10000).optional(),
}).passthrough(); // Allow archetype-specific fields to pass through

export default async function officeTaskExecuteRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/tools/office-task/execute', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 hour',
        keyGenerator: async (request: FastifyRequest) => {
          const workspaceId = await resolveWorkspaceId(request);
          return workspaceId ? `office-task:ws:${workspaceId}` : `office-task:ip:${request.ip}`;
        },
      },
    },
  }, async (request, reply) => {
    // 1. Auth
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) {
      return reply.code(401).send({ success: false, error: '認証が必要です' });
    }

    // 2. Basic input validation (Zod)
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map(i => i.message).join('; '),
      });
    }

    const { task_id, instruction, context, ...extraFields } = parsed.data;

    // 3. Find task in catalog
    const task = officeTaskCatalog.find(t => t.id === task_id);
    if (!task) {
      return reply.code(404).send({
        success: false,
        error: `タスク「${task_id}」が見つかりません`,
      });
    }

    // 4. Forbidden check
    if (task.forbidden) {
      return reply.code(200).send({
        success: false,
        error: `この作業は士業独占業務（${task.forbiddenLaw ?? '関連法令'}）のため、FujiTraceでは対応できません。専門家にご相談ください。`,
        forbidden: true,
        law: task.forbiddenLaw ?? '',
      });
    }

    // 5. Free quota check (internal calls from AI agent bypass via INTERNAL_SECRET)
    const quota = await enforceFreeQuota(workspaceId, request);
    if (!quota.allowed) {
      return reply.code(429).send({ success: false, error: quota.error });
    }

    // 6. Archetype-aware processing
    try {
      const archetype = getArchetype(task.archetype);

      // 6a. Validate input against archetype + task-specific rules
      const allRules = [
        ...archetype.validationRules,
        ...(task.taskSpecificValidation ?? []),
      ];

      const inputData = extraFields as Record<string, unknown>;

      // Auto-fill title from task name if not provided (common when called from AI agent)
      if (!inputData['title'] && archetype.inputFields.some(f => f.name === 'title')) {
        inputData['title'] = task.name;
      }

      const issues = validateInput(inputData, allRules);

      const errors = issues.filter(i => i.severity === 'error');
      if (errors.length > 0) {
        return reply.code(400).send({
          success: false,
          error: errors.map(e => e.message).join('; '),
          validation_issues: issues,
        });
      }

      // 6b. Load archetype-specific prompt template
      let systemPrompt: string;
      if (archetype.promptTemplate) {
        const template = loadPromptTemplate(`office-task/${archetype.promptTemplate}`);
        const cautionText = task.cautionNote
          ? `\n## 注意事項\n${task.cautionNote}\n結果には必ず「最終判断は専門家にご確認ください」の注意文を含めてください。`
          : '';
        const domainText = task.domainKnowledge
          ? `\n## 専門知識\n${task.domainKnowledge}`
          : '';

        systemPrompt = renderTemplate(template, {
          task_name: task.name,
          task_description: task.description,
          caution_note: cautionText,
          domain_knowledge: domainText,
        });
      } else {
        // Fallback to generic prompt (should not happen for non-forbidden tasks)
        const template = loadPromptTemplate('office-task/system.md');
        const cautionText = task.cautionNote
          ? `\n## 注意事項\n${task.cautionNote}\n結果には必ず「最終判断は専門家にご確認ください」の注意文を含めてください。`
          : '';

        systemPrompt = renderTemplate(template, {
          task_name: task.name,
          task_description: task.description,
          responsibility_level: task.responsibilityLevel,
          caution_note: cautionText,
        });
      }

      // 6c. Build user message with structured fields
      const structuredParts: string[] = [];

      // Include archetype field values in the user message
      for (const field of archetype.inputFields) {
        const value = inputData[field.name];
        if (value !== undefined && value !== null && value !== '') {
          const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
          structuredParts.push(`【${field.label}】\n${displayValue}`);
        }
      }

      // Include task-specific field values
      if (task.taskSpecificFields) {
        for (const field of task.taskSpecificFields) {
          const value = inputData[field.name];
          if (value !== undefined && value !== null && value !== '') {
            const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
            structuredParts.push(`【${field.label}】\n${displayValue}`);
          }
        }
      }

      let userContent = instruction;
      if (structuredParts.length > 0) {
        userContent = `${instruction}\n\n--- 入力データ ---\n${structuredParts.join('\n\n')}`;
      }
      if (context) {
        userContent += `\n\n--- 参考情報 ---\n${context}`;
      }

      // 6d. Call LLM
      const llmResult = await callLlmViaProxy(fastify, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ], {
        model: process.env.AI_TOOLS_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 4096,
      });

      // 6e. Validate and structure LLM output
      let structuredResult: Record<string, unknown> | undefined;
      try {
        structuredResult = validateOutput(llmResult.content, archetype);
      } catch (parseError: unknown) {
        // If output parsing fails, still return the raw result
        request.log.warn(
          { err: parseError instanceof Error ? parseError.message : String(parseError) },
          'Failed to parse structured LLM output, returning raw text',
        );
      }

      // 7. Record usage
      await recordUsage(workspaceId, task.id, 'execute', llmResult.traceId);

      // 8. Include validation warnings (non-blocking) in the response
      const warnings = issues.filter(i => i.severity === 'warning');

      return reply.code(200).send({
        success: true,
        data: {
          task_id: task.id,
          task_name: task.name,
          archetype: task.archetype,
          result: llmResult.content,
          structured_result: structuredResult ?? null,
          validation_warnings: warnings.length > 0 ? warnings : undefined,
          caution_note: task.cautionNote ?? undefined,
          trace_id: llmResult.traceId,
        },
      });
    } catch (error: unknown) {
      request.log.error(error, 'Office task execution error');
      return reply.code(500).send({
        success: false,
        error: '作業の実行中にエラーが発生しました',
      });
    }
  });
}
