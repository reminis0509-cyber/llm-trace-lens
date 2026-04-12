/**
 * POST /api/tools/office-task/execute
 * POST /api/tools/office-task/execute-stream  (SSE streaming variant)
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
  parseLlmJson,
} from './_shared.js';
import { checkArithmetic } from '../../tools/arithmetic-checker.js';
import type { ExtractedFinancialData } from '../../tools/arithmetic-checker.js';
import type { SkeletonStep, SkeletonTrace } from '../../types/skeleton-trace.js';
import type { LlmTokenUsage } from './_shared.js';

// GPT-4o-mini pricing (USD per 1M tokens) — used for cost estimation
const PRICING_INPUT_USD_PER_M = 0.15;
const PRICING_OUTPUT_USD_PER_M = 0.60;
const USD_TO_JPY = 150;

/**
 * Estimate cost in yen from token usage.
 */
function estimateCostYen(usage: LlmTokenUsage): number {
  const inputCost = (usage.promptTokens / 1_000_000) * PRICING_INPUT_USD_PER_M * USD_TO_JPY;
  const outputCost = (usage.completionTokens / 1_000_000) * PRICING_OUTPUT_USD_PER_M * USD_TO_JPY;
  return Math.round((inputCost + outputCost) * 10000) / 10000; // 4 decimal places
}

/**
 * Estimate token count from a string when API usage data is unavailable.
 * Rough heuristic: Japanese text ~1.5 chars/token, English ~4 chars/token.
 * Uses a blended average of ~2 chars/token for mixed content.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

/**
 * Helper to record a completed step.
 */
function recordStep(
  steps: SkeletonStep[],
  name: string,
  startMs: number,
  details?: Record<string, unknown>,
): void {
  steps.push({
    index: steps.length,
    name,
    status: 'completed',
    durationMs: Math.round(performance.now() - startMs),
    details,
  });
}

/**
 * Helper to record an errored step.
 */
function recordErrorStep(
  steps: SkeletonStep[],
  name: string,
  startMs: number,
  details?: Record<string, unknown>,
): void {
  steps.push({
    index: steps.length,
    name,
    status: 'error',
    durationMs: Math.round(performance.now() - startMs),
    details,
  });
}

/**
 * Build LLM details for a skeleton step from a call result's usage info.
 */
function llmStepDetails(
  model: string,
  temperature: number,
  usage: LlmTokenUsage | null,
  inputText: string,
  outputText: string,
): Record<string, unknown> {
  const actualUsage = usage ?? {
    promptTokens: estimateTokens(inputText),
    completionTokens: estimateTokens(outputText),
  };
  return {
    model,
    temperature,
    inputTokens: actualUsage.promptTokens,
    outputTokens: actualUsage.completionTokens,
    costYen: estimateCostYen(actualUsage),
    estimated: usage === null,
  };
}

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

/**
 * SSE step event payload sent during streaming execution.
 */
interface SseStepEvent {
  index: number;
  name: string;
  status: 'completed' | 'error';
  durationMs: number;
  details?: Record<string, unknown>;
}

export default async function officeTaskExecuteRoute(fastify: FastifyInstance): Promise<void> {

  // ── Streaming endpoint: POST /api/tools/office-task/execute-stream ──
  // Returns Server-Sent Events as each step completes.
  // Same request body as /execute, same auth/validation/quota checks.
  fastify.post('/api/tools/office-task/execute-stream', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 hour',
        keyGenerator: async (request: FastifyRequest) => {
          const workspaceId = await resolveWorkspaceId(request);
          return workspaceId ? `office-task-stream:ws:${workspaceId}` : `office-task-stream:ip:${request.ip}`;
        },
      },
    },
  }, async (request, reply) => {
    // Helper to write an SSE event to the raw response
    function sendEvent(event: string, data: unknown): void {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    // Helper to send a step event and also record it in the steps array
    function sendStepEvent(
      steps: SkeletonStep[],
      name: string,
      startMs: number,
      status: 'completed' | 'error' = 'completed',
      details?: Record<string, unknown>,
    ): void {
      const step: SkeletonStep = {
        index: steps.length,
        name,
        status,
        durationMs: Math.round(performance.now() - startMs),
        details,
      };
      steps.push(step);
      const ssePayload: SseStepEvent = {
        index: step.index,
        name: step.name,
        status: step.status,
        durationMs: step.durationMs,
        details: step.details,
      };
      sendEvent('step', ssePayload);
    }

    // 1. Auth
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) {
      reply.raw.writeHead(401, { 'Content-Type': 'application/json' });
      reply.raw.end(JSON.stringify({ success: false, error: '認証が必要です' }));
      return reply;
    }

    // 2. Basic input validation (Zod)
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.raw.writeHead(400, { 'Content-Type': 'application/json' });
      reply.raw.end(JSON.stringify({
        success: false,
        error: parsed.error.issues.map(i => i.message).join('; '),
      }));
      return reply;
    }

    const { task_id, instruction, context, ...extraFields } = parsed.data;

    // 3. Find task in catalog
    const task = officeTaskCatalog.find(t => t.id === task_id);
    if (!task) {
      reply.raw.writeHead(404, { 'Content-Type': 'application/json' });
      reply.raw.end(JSON.stringify({
        success: false,
        error: `タスク「${task_id}」が見つかりません`,
      }));
      return reply;
    }

    // 4. Forbidden check
    if (task.forbidden) {
      reply.raw.writeHead(200, { 'Content-Type': 'application/json' });
      reply.raw.end(JSON.stringify({
        success: false,
        error: `この作業は士業独占業務（${task.forbiddenLaw ?? '関連法令'}）のため、FujiTraceでは対応できません。専門家にご相談ください。`,
        forbidden: true,
        law: task.forbiddenLaw ?? '',
      }));
      return reply;
    }

    // 5. Free quota check
    const quota = await enforceFreeQuota(workspaceId, request);
    if (!quota.allowed) {
      reply.raw.writeHead(429, { 'Content-Type': 'application/json' });
      reply.raw.end(JSON.stringify({ success: false, error: quota.error }));
      return reply;
    }

    // All pre-checks passed — begin SSE stream
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    try {
      const archetype = getArchetype(task.archetype);

      // Validate input
      const allRules = [
        ...archetype.validationRules,
        ...(task.taskSpecificValidation ?? []),
      ];
      const inputData = extraFields as Record<string, unknown>;
      if (!inputData['title'] && archetype.inputFields.some(f => f.name === 'title')) {
        inputData['title'] = task.name;
      }
      const issues = validateInput(inputData, allRules);
      const errors = issues.filter(i => i.severity === 'error');
      if (errors.length > 0) {
        sendEvent('error', {
          error: errors.map(e => e.message).join('; '),
          validation_issues: issues,
        });
        reply.raw.end();
        return reply;
      }

      // Build system prompt
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

      // Build user message
      const structuredParts: string[] = [];
      for (const field of archetype.inputFields) {
        const value = inputData[field.name];
        if (value !== undefined && value !== null && value !== '') {
          const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
          structuredParts.push(`【${field.label}】\n${displayValue}`);
        }
      }
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

      const isDocumentCheck = task.archetype === 'document_check';

      if (isDocumentCheck) {
        // ── 4-step arithmetic pipeline (streamed) ──────────
        const traceStartMs = performance.now();
        const skeletonSteps: SkeletonStep[] = [];
        const llmModel = process.env.AI_TOOLS_MODEL || 'gpt-4o-mini';
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        // Step 0: Input received
        const step0Start = performance.now();
        const documentText = String(inputData['document_text'] ?? '');
        sendStepEvent(skeletonSteps, '入力データ受信', step0Start);

        // Step 1: Extract numbers
        const step1Start = performance.now();
        const extractPrompt = loadPromptTemplate('office-task/extract-numbers.md');
        const extractResult = await callLlmViaProxy(fastify, [
          { role: 'system', content: extractPrompt },
          { role: 'user', content: documentText },
        ], {
          model: llmModel,
          temperature: 0.0,
          maxTokens: 1024,
        });
        const step1Details = llmStepDetails(llmModel, 0.0, extractResult.usage, extractPrompt + documentText, extractResult.content);
        totalInputTokens += step1Details.inputTokens as number;
        totalOutputTokens += step1Details.outputTokens as number;
        sendStepEvent(skeletonSteps, '数値データ抽出', step1Start, 'completed', step1Details);

        // Step 2: Programmatic arithmetic check
        const step2Start = performance.now();
        let arithmeticCheck = { ok: true, issues: [] as Array<{ field: string; severity: 'error'; message: string }> };
        let extractedData: ExtractedFinancialData | null = null;
        try {
          extractedData = parseLlmJson<ExtractedFinancialData>(extractResult.content);
          if (extractedData.has_financial_data) {
            arithmeticCheck = checkArithmetic(extractedData);
          }
          sendStepEvent(skeletonSteps, '算術検証', step2Start, 'completed', {
            ok: arithmeticCheck.ok,
            issueCount: arithmeticCheck.issues.length,
            issues: arithmeticCheck.issues,
          });
        } catch (extractErr: unknown) {
          request.log.warn(
            { err: extractErr instanceof Error ? extractErr.message : String(extractErr) },
            'Failed to parse extracted financial data, skipping arithmetic check',
          );
          sendStepEvent(skeletonSteps, '算術検証', step2Start, 'error', {
            ok: false,
            error: extractErr instanceof Error ? extractErr.message : String(extractErr),
          });
        }

        // Step 3: LLM form/content check
        const step3Start = performance.now();
        const llmResult = await callLlmViaProxy(fastify, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ], {
          model: llmModel,
          temperature: 0.3,
          maxTokens: 4096,
        });
        const step3Details = llmStepDetails(llmModel, 0.3, llmResult.usage, systemPrompt + userContent, llmResult.content);
        totalInputTokens += step3Details.inputTokens as number;
        totalOutputTokens += step3Details.outputTokens as number;
        sendStepEvent(skeletonSteps, 'AI品質チェック', step3Start, 'completed', step3Details);

        // Step 4: Merge results
        const step4Start = performance.now();
        let structuredResult: Record<string, unknown> | undefined;
        try {
          structuredResult = validateOutput(llmResult.content, archetype);
        } catch (parseError: unknown) {
          request.log.warn(
            { err: parseError instanceof Error ? parseError.message : String(parseError) },
            'Failed to parse structured LLM output, returning raw text',
          );
        }

        // Strip LLM arithmetic claims
        if (structuredResult) {
          const ARITHMETIC_FIELD_RE = /^(subtotal|tax_amount|total|items\[\d+\]\.amount|算術|小計|消費税|合計|税額)$/;
          const ARITHMETIC_MSG_RE = /計算|掛け算|足し算|一致しません|不一致|正しくは[\d,]+円|合計.*一致|小計.*一致|消費税.*一致|税額.*一致|金額.*一致/;

          const criticalIssues = structuredResult.critical_issues as Array<{ field?: string; severity: string; message: string }> | undefined;
          if (Array.isArray(criticalIssues)) {
            structuredResult.critical_issues = criticalIssues.filter(issue => {
              const field = issue.field ?? '';
              const msg = issue.message ?? '';
              if (ARITHMETIC_FIELD_RE.test(field)) return false;
              if (ARITHMETIC_MSG_RE.test(msg)) return false;
              return true;
            });
          }
          const warnings = structuredResult.warnings as Array<{ field?: string; severity: string; message: string }> | undefined;
          if (Array.isArray(warnings)) {
            structuredResult.warnings = warnings.filter(issue => {
              const msg = issue.message ?? '';
              return !ARITHMETIC_MSG_RE.test(msg);
            });
          }
          if (!arithmeticCheck.ok) {
            const existing = (structuredResult.critical_issues as Array<Record<string, unknown>>) ?? [];
            existing.push(...arithmeticCheck.issues);
            structuredResult.critical_issues = existing;
            structuredResult.status = 'error';
          }
        }

        sendStepEvent(skeletonSteps, '結果統合', step4Start);

        const totalUsage = { promptTokens: totalInputTokens, completionTokens: totalOutputTokens };
        const skeletonTrace: SkeletonTrace = {
          taskId: task.id,
          taskName: task.name,
          steps: skeletonSteps,
          totalDurationMs: Math.round(performance.now() - traceStartMs),
          totalCostYen: estimateCostYen(totalUsage),
          model: llmModel,
          tokenUsage: { input: totalInputTokens, output: totalOutputTokens },
        };

        await recordUsage(workspaceId, task.id, 'execute', llmResult.traceId);

        const validationWarnings = issues.filter(i => i.severity === 'warning');

        sendEvent('done', {
          success: true,
          data: {
            task_id: task.id,
            task_name: task.name,
            archetype: task.archetype,
            result: llmResult.content,
            structured_result: structuredResult ?? null,
            arithmetic_check: arithmeticCheck,
            validation_warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
            caution_note: task.cautionNote ?? undefined,
            trace_id: llmResult.traceId,
            skeleton_trace: skeletonTrace,
          },
        });

        reply.raw.end();
        return reply;
      }

      // ── Standard single-call flow (streamed) ───────
      const traceStartMs = performance.now();
      const skeletonSteps: SkeletonStep[] = [];
      const llmModel = process.env.AI_TOOLS_MODEL || 'gpt-4o-mini';

      // Step 0: Input received
      const stdStep0Start = performance.now();
      sendStepEvent(skeletonSteps, '入力データ受信', stdStep0Start);

      // Step 1: LLM generation
      const stdStep1Start = performance.now();
      const llmResult = await callLlmViaProxy(fastify, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ], {
        model: llmModel,
        temperature: 0.3,
        maxTokens: 4096,
      });
      const stdStep1Details = llmStepDetails(llmModel, 0.3, llmResult.usage, systemPrompt + userContent, llmResult.content);
      sendStepEvent(skeletonSteps, 'AI生成', stdStep1Start, 'completed', stdStep1Details);

      // Step 2: Output validation
      const stdStep2Start = performance.now();
      let structuredResult: Record<string, unknown> | undefined;
      try {
        structuredResult = validateOutput(llmResult.content, archetype);
        sendStepEvent(skeletonSteps, '出力検証', stdStep2Start);
      } catch (parseError: unknown) {
        request.log.warn(
          { err: parseError instanceof Error ? parseError.message : String(parseError) },
          'Failed to parse structured LLM output, returning raw text',
        );
        sendStepEvent(skeletonSteps, '出力検証', stdStep2Start, 'error', {
          error: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }

      const totalUsage = llmResult.usage ?? {
        promptTokens: estimateTokens(systemPrompt + userContent),
        completionTokens: estimateTokens(llmResult.content),
      };
      const skeletonTrace: SkeletonTrace = {
        taskId: task.id,
        taskName: task.name,
        steps: skeletonSteps,
        totalDurationMs: Math.round(performance.now() - traceStartMs),
        totalCostYen: estimateCostYen(totalUsage),
        model: llmModel,
        tokenUsage: { input: totalUsage.promptTokens, output: totalUsage.completionTokens },
      };

      await recordUsage(workspaceId, task.id, 'execute', llmResult.traceId);

      const warnings = issues.filter(i => i.severity === 'warning');

      sendEvent('done', {
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
          skeleton_trace: skeletonTrace,
        },
      });

      reply.raw.end();
      return reply;
    } catch (error: unknown) {
      request.log.error(error, 'Office task streaming execution error');
      sendEvent('error', { error: '作業の実行中にエラーが発生しました' });
      reply.raw.end();
      return reply;
    }
  });

  // ── Original non-streaming endpoint ──
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

      // 6d. For document_check, run the 4-step arithmetic pipeline.
      // For other archetypes, use the original single-call flow.
      const isDocumentCheck = task.archetype === 'document_check';

      if (isDocumentCheck) {
        // ── 4-step arithmetic pipeline for document checks ──────────
        const traceStartMs = performance.now();
        const skeletonSteps: SkeletonStep[] = [];
        const llmModel = process.env.AI_TOOLS_MODEL || 'gpt-4o-mini';
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        // Step 0: Input received
        const step0Start = performance.now();
        const documentText = String(inputData['document_text'] ?? '');
        recordStep(skeletonSteps, '入力データ受信', step0Start);

        // Step 1: Extract numbers from document text via LLM
        const step1Start = performance.now();
        const extractPrompt = loadPromptTemplate('office-task/extract-numbers.md');
        const extractResult = await callLlmViaProxy(fastify, [
          { role: 'system', content: extractPrompt },
          { role: 'user', content: documentText },
        ], {
          model: llmModel,
          temperature: 0.0,
          maxTokens: 1024,
        });
        const step1Details = llmStepDetails(llmModel, 0.0, extractResult.usage, extractPrompt + documentText, extractResult.content);
        totalInputTokens += step1Details.inputTokens as number;
        totalOutputTokens += step1Details.outputTokens as number;
        recordStep(skeletonSteps, '数値データ抽出', step1Start, step1Details);

        // Step 2: Programmatic arithmetic check (100% accurate)
        const step2Start = performance.now();
        let arithmeticCheck = { ok: true, issues: [] as Array<{ field: string; severity: 'error'; message: string }> };
        let extractedData: ExtractedFinancialData | null = null;
        try {
          extractedData = parseLlmJson<ExtractedFinancialData>(extractResult.content);

          if (extractedData.has_financial_data) {
            arithmeticCheck = checkArithmetic(extractedData);
          }
          recordStep(skeletonSteps, '算術検証', step2Start, {
            ok: arithmeticCheck.ok,
            issueCount: arithmeticCheck.issues.length,
            issues: arithmeticCheck.issues,
          });
        } catch (extractErr: unknown) {
          request.log.warn(
            { err: extractErr instanceof Error ? extractErr.message : String(extractErr) },
            'Failed to parse extracted financial data, skipping arithmetic check',
          );
          recordErrorStep(skeletonSteps, '算術検証', step2Start, {
            ok: false,
            error: extractErr instanceof Error ? extractErr.message : String(extractErr),
          });
        }

        // Step 3: LLM form/content check (GPT-4o-mini — arithmetic is handled programmatically)
        const step3Start = performance.now();
        const llmResult = await callLlmViaProxy(fastify, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ], {
          model: llmModel,
          temperature: 0.3,
          maxTokens: 4096,
        });
        const step3Details = llmStepDetails(llmModel, 0.3, llmResult.usage, systemPrompt + userContent, llmResult.content);
        totalInputTokens += step3Details.inputTokens as number;
        totalOutputTokens += step3Details.outputTokens as number;
        recordStep(skeletonSteps, 'AI品質チェック', step3Start, step3Details);

        // Step 4: Merge arithmetic + LLM results
        const step4Start = performance.now();
        let structuredResult: Record<string, unknown> | undefined;
        try {
          structuredResult = validateOutput(llmResult.content, archetype);
        } catch (parseError: unknown) {
          request.log.warn(
            { err: parseError instanceof Error ? parseError.message : String(parseError) },
            'Failed to parse structured LLM output, returning raw text',
          );
        }

        // Strip LLM arithmetic claims — only trust programmatic results.
        // Filter by field name AND by message content (LLM may use Japanese field names).
        if (structuredResult) {
          const ARITHMETIC_FIELD_RE = /^(subtotal|tax_amount|total|items\[\d+\]\.amount|算術|小計|消費税|合計|税額)$/;
          const ARITHMETIC_MSG_RE = /計算|掛け算|足し算|一致しません|不一致|正しくは[\d,]+円|合計.*一致|小計.*一致|消費税.*一致|税額.*一致|金額.*一致/;

          const criticalIssues = structuredResult.critical_issues as Array<{ field?: string; severity: string; message: string }> | undefined;
          if (Array.isArray(criticalIssues)) {
            structuredResult.critical_issues = criticalIssues.filter(issue => {
              const field = issue.field ?? '';
              const msg = issue.message ?? '';
              // Drop if field matches arithmetic pattern
              if (ARITHMETIC_FIELD_RE.test(field)) return false;
              // Drop if message looks like an arithmetic claim
              if (ARITHMETIC_MSG_RE.test(msg)) return false;
              return true;
            });
          }

          // Also filter warnings that contain arithmetic claims
          const warnings = structuredResult.warnings as Array<{ field?: string; severity: string; message: string }> | undefined;
          if (Array.isArray(warnings)) {
            structuredResult.warnings = warnings.filter(issue => {
              const msg = issue.message ?? '';
              return !ARITHMETIC_MSG_RE.test(msg);
            });
          }

          // Inject programmatic arithmetic issues into critical_issues
          if (!arithmeticCheck.ok) {
            const existing = (structuredResult.critical_issues as Array<Record<string, unknown>>) ?? [];
            existing.push(...arithmeticCheck.issues);
            structuredResult.critical_issues = existing;
            structuredResult.status = 'error';
          }
        }

        recordStep(skeletonSteps, '結果統合', step4Start);

        const totalUsage = { promptTokens: totalInputTokens, completionTokens: totalOutputTokens };
        const skeletonTrace: SkeletonTrace = {
          taskId: task.id,
          taskName: task.name,
          steps: skeletonSteps,
          totalDurationMs: Math.round(performance.now() - traceStartMs),
          totalCostYen: estimateCostYen(totalUsage),
          model: llmModel,
          tokenUsage: { input: totalInputTokens, output: totalOutputTokens },
        };

        await recordUsage(workspaceId, task.id, 'execute', llmResult.traceId);

        const validationWarnings = issues.filter(i => i.severity === 'warning');

        return reply.code(200).send({
          success: true,
          data: {
            task_id: task.id,
            task_name: task.name,
            archetype: task.archetype,
            result: llmResult.content,
            structured_result: structuredResult ?? null,
            arithmetic_check: arithmeticCheck,
            validation_warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
            caution_note: task.cautionNote ?? undefined,
            trace_id: llmResult.traceId,
            skeleton_trace: skeletonTrace,
          },
        });
      }

      // ── Standard single-call flow for non-check archetypes ───────
      const traceStartMs = performance.now();
      const skeletonSteps: SkeletonStep[] = [];
      const llmModel = process.env.AI_TOOLS_MODEL || 'gpt-4o-mini';

      // Step 0: Input received
      const stdStep0Start = performance.now();
      recordStep(skeletonSteps, '入力データ受信', stdStep0Start);

      // Step 1: LLM generation
      const stdStep1Start = performance.now();
      const llmResult = await callLlmViaProxy(fastify, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ], {
        model: llmModel,
        temperature: 0.3,
        maxTokens: 4096,
      });
      const stdStep1Details = llmStepDetails(llmModel, 0.3, llmResult.usage, systemPrompt + userContent, llmResult.content);
      recordStep(skeletonSteps, 'AI生成', stdStep1Start, stdStep1Details);

      // Step 2: Output validation
      const stdStep2Start = performance.now();
      let structuredResult: Record<string, unknown> | undefined;
      try {
        structuredResult = validateOutput(llmResult.content, archetype);
        recordStep(skeletonSteps, '出力検証', stdStep2Start);
      } catch (parseError: unknown) {
        // If output parsing fails, still return the raw result
        request.log.warn(
          { err: parseError instanceof Error ? parseError.message : String(parseError) },
          'Failed to parse structured LLM output, returning raw text',
        );
        recordErrorStep(skeletonSteps, '出力検証', stdStep2Start, {
          error: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }

      const totalUsage = llmResult.usage ?? {
        promptTokens: estimateTokens(systemPrompt + userContent),
        completionTokens: estimateTokens(llmResult.content),
      };
      const skeletonTrace: SkeletonTrace = {
        taskId: task.id,
        taskName: task.name,
        steps: skeletonSteps,
        totalDurationMs: Math.round(performance.now() - traceStartMs),
        totalCostYen: estimateCostYen(totalUsage),
        model: llmModel,
        tokenUsage: { input: totalUsage.promptTokens, output: totalUsage.completionTokens },
      };

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
          skeleton_trace: skeletonTrace,
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
