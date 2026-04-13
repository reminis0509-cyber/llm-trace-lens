/**
 * Standalone execution pipeline for office tasks.
 *
 * Extracts the core execution logic from the Fastify route handler
 * (`src/routes/tools/office-task-execute.ts`) into a pure function
 * with an `onStep` callback for real-time progress reporting.
 *
 * This function is framework-agnostic: it does NOT depend on Fastify,
 * HTTP request/response, auth, or quota enforcement. Those concerns
 * are the caller's responsibility.
 *
 * Primary consumer: Vercel Web Standard streaming endpoint
 * (`api/tools/office-task/execute-stream.ts`) which wraps this
 * pipeline in a ReadableStream-based SSE response.
 */

import { z } from 'zod';
import { officeTaskCatalog } from './office-tasks/catalog.js';
import { getArchetype } from './office-tasks/archetypes.js';
import { validateInput, validateOutput } from './office-tasks/validator.js';
import type { ValidationIssue } from './office-tasks/validator.js';
import {
  callLlmViaProxy,
  loadPromptTemplate,
  renderTemplate,
  parseLlmJson,
} from '../routes/tools/_shared.js';
import type { LlmTokenUsage } from '../routes/tools/_shared.js';
import { checkArithmetic } from './arithmetic-checker.js';
import type { ExtractedFinancialData } from './arithmetic-checker.js';
import type { SkeletonStep, SkeletonTrace } from '../types/skeleton-trace.js';

// ── Pricing constants (GPT-4o-mini) ────────────────────────────────

const PRICING_INPUT_USD_PER_M = 0.15;
const PRICING_OUTPUT_USD_PER_M = 0.60;
const USD_TO_JPY = 150;

// ── Public interfaces ──────────────────────────────────────────────

export interface PipelineParams {
  taskId: string;
  instruction: string;
  context?: Record<string, unknown>;
  documentText?: string;
  workspaceId: string;
  /** Extra fields from the request body (archetype-specific input data). */
  extraFields?: Record<string, unknown>;
  /** Called after each major step with timing and metadata. */
  onStep: (step: SkeletonStep) => void;
}

export interface PipelineResult {
  taskId: string;
  taskName: string;
  archetype: string;
  result: string;
  structuredResult?: Record<string, unknown>;
  arithmeticCheck?: { ok: boolean; issues: Array<{ field: string; severity: string; message: string }> };
  validationWarnings?: ValidationIssue[];
  cautionNote?: string;
  traceId: string | null;
  skeletonTrace: SkeletonTrace;
}

/** Thrown when the task is registered as forbidden (reserved for licensed professionals). */
export class ForbiddenTaskError extends Error {
  public readonly forbidden = true;
  public readonly law: string;

  constructor(message: string, law: string) {
    super(message);
    this.name = 'ForbiddenTaskError';
    this.law = law;
  }
}

/** Thrown when input validation fails with error-severity issues. */
export class ValidationError extends Error {
  public readonly validationIssues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = 'ValidationError';
    this.validationIssues = issues;
  }
}

/** Thrown when the requested task_id does not exist in the catalog. */
export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task "${taskId}" not found in catalog`);
    this.name = 'TaskNotFoundError';
  }
}

// ── Input validation schema ────────────────────────────────────────

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
}).passthrough();

// ── Internal helpers ───────────────────────────────────────────────

function estimateCostYen(usage: LlmTokenUsage): number {
  const inputCost = (usage.promptTokens / 1_000_000) * PRICING_INPUT_USD_PER_M * USD_TO_JPY;
  const outputCost = (usage.completionTokens / 1_000_000) * PRICING_OUTPUT_USD_PER_M * USD_TO_JPY;
  return Math.round((inputCost + outputCost) * 10000) / 10000;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

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

function makeStep(
  index: number,
  name: string,
  startMs: number,
  status: 'completed' | 'error' = 'completed',
  details?: Record<string, unknown>,
): SkeletonStep {
  return {
    index,
    name,
    status,
    durationMs: Math.round(performance.now() - startMs),
    details,
  };
}

// ── Regex patterns for stripping LLM arithmetic hallucinations ─────

const ARITHMETIC_FIELD_RE = /^(subtotal|tax_amount|total|items\[\d+\]\.amount|算術|小計|消費税|合計|税額)$/;
const ARITHMETIC_MSG_RE = /計算|掛け算|足し算|一致しません|不一致|正しくは[\d,]+円|合計.*一致|小計.*一致|消費税.*一致|税額.*一致|金額.*一致/;

// ── Main pipeline ──────────────────────────────────────────────────

/**
 * Execute an office task through the archetype pipeline.
 *
 * Caller responsibilities (NOT handled here):
 *   - Authentication (resolve workspaceId before calling)
 *   - Free-plan quota enforcement (check before calling)
 *   - Usage recording (call recordUsage after success)
 *   - HTTP response formatting
 *
 * @throws {TaskNotFoundError} if taskId is not in the catalog
 * @throws {ForbiddenTaskError} if the task is reserved for licensed professionals
 * @throws {ValidationError} if input validation fails with error-severity issues
 * @throws {Error} for Zod parsing failures or LLM call failures
 */
export async function executeOfficeTaskPipeline(params: PipelineParams): Promise<PipelineResult> {
  const { taskId, instruction, context, extraFields, onStep } = params;

  // ── 1. Zod validation on taskId / instruction ────────────────────

  const parsed = requestSchema.safeParse({
    task_id: taskId,
    instruction,
    context: typeof context === 'string' ? context : context ? JSON.stringify(context) : undefined,
    ...extraFields,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map(i => i.message).join('; '));
  }

  const contextStr = parsed.data.context;
  const {
    task_id: _taskId,
    instruction: _instruction,
    context: _context,
    ...parsedExtraFields
  } = parsed.data;

  // ── 2. Catalog lookup ────────────────────────────────────────────

  const task = officeTaskCatalog.find(t => t.id === taskId);
  if (!task) {
    throw new TaskNotFoundError(taskId);
  }

  // ── 3. Forbidden check ───────────────────────────────────────────

  if (task.forbidden) {
    throw new ForbiddenTaskError(
      `この作業は士業独占業務（${task.forbiddenLaw ?? '関連法令'}）のため、FujiTraceでは対応できません。専門家にご相談ください。`,
      task.forbiddenLaw ?? '',
    );
  }

  // ── 4. Archetype resolution & input validation ───────────────────

  const archetype = getArchetype(task.archetype);

  const allRules = [
    ...archetype.validationRules,
    ...(task.taskSpecificValidation ?? []),
  ];

  const inputData = parsedExtraFields as Record<string, unknown>;

  // Auto-fill title from task name if not provided
  if (!inputData['title'] && archetype.inputFields.some(f => f.name === 'title')) {
    inputData['title'] = task.name;
  }

  const issues = validateInput(inputData, allRules);
  const errors = issues.filter(i => i.severity === 'error');
  if (errors.length > 0) {
    throw new ValidationError(
      errors.map(e => e.message).join('; '),
      issues,
    );
  }

  // ── 5. Build prompts ─────────────────────────────────────────────

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

  // Build user message with structured fields
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
  if (contextStr) {
    userContent += `\n\n--- 参考情報 ---\n${contextStr}`;
  }

  // ── 6. Execute the appropriate pipeline ──────────────────────────

  const isDocumentCheck = task.archetype === 'document_check';
  const llmModel = process.env.AI_TOOLS_MODEL || 'gpt-4o-mini';

  if (isDocumentCheck) {
    return executeDocumentCheckPipeline({
      task,
      llmModel,
      systemPrompt,
      userContent,
      inputData,
      issues,
      archetype,
      onStep,
    });
  }

  return executeStandardPipeline({
    task,
    llmModel,
    systemPrompt,
    userContent,
    issues,
    archetype,
    onStep,
  });
}

// ── Document check pipeline (4-step with arithmetic) ───────────────

interface InternalPipelineContext {
  task: (typeof officeTaskCatalog)[number];
  llmModel: string;
  systemPrompt: string;
  userContent: string;
  inputData?: Record<string, unknown>;
  issues: ValidationIssue[];
  archetype: ReturnType<typeof getArchetype>;
  onStep: (step: SkeletonStep) => void;
}

async function executeDocumentCheckPipeline(ctx: InternalPipelineContext): Promise<PipelineResult> {
  const { task, llmModel, systemPrompt, userContent, inputData, issues, archetype, onStep } = ctx;
  const traceStartMs = performance.now();
  const skeletonSteps: SkeletonStep[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let stepIndex = 0;

  // Step 0: Input received
  const step0Start = performance.now();
  const documentText = String(inputData?.['document_text'] ?? '');
  const step0 = makeStep(stepIndex++, '入力データ受信', step0Start);
  skeletonSteps.push(step0);
  onStep(step0);

  // Step 1: Extract numbers via LLM
  const step1Start = performance.now();
  const extractPrompt = loadPromptTemplate('office-task/extract-numbers.md');
  const extractResult = await callLlmViaProxy(
    null as never, // fastify instance unused — callLlmViaProxy calls OpenAI directly
    [
      { role: 'system', content: extractPrompt },
      { role: 'user', content: documentText },
    ],
    { model: llmModel, temperature: 0.0, maxTokens: 1024 },
  );
  const step1Details = llmStepDetails(llmModel, 0.0, extractResult.usage, extractPrompt + documentText, extractResult.content);
  totalInputTokens += step1Details.inputTokens as number;
  totalOutputTokens += step1Details.outputTokens as number;
  const step1 = makeStep(stepIndex++, '数値データ抽出', step1Start, 'completed', step1Details);
  skeletonSteps.push(step1);
  onStep(step1);

  // Step 2: Programmatic arithmetic check
  const step2Start = performance.now();
  let arithmeticCheck = { ok: true, issues: [] as Array<{ field: string; severity: 'error'; message: string }> };
  let step2: SkeletonStep;
  try {
    const extractedData = parseLlmJson<ExtractedFinancialData>(extractResult.content);
    if (extractedData.has_financial_data) {
      arithmeticCheck = checkArithmetic(extractedData);
    }
    step2 = makeStep(stepIndex++, '算術検証', step2Start, 'completed', {
      ok: arithmeticCheck.ok,
      issueCount: arithmeticCheck.issues.length,
      issues: arithmeticCheck.issues,
    });
  } catch (extractErr: unknown) {
    step2 = makeStep(stepIndex++, '算術検証', step2Start, 'error', {
      ok: false,
      error: extractErr instanceof Error ? extractErr.message : String(extractErr),
    });
  }
  skeletonSteps.push(step2);
  onStep(step2);

  // Step 3: LLM form/content check
  const step3Start = performance.now();
  const llmResult = await callLlmViaProxy(
    null as never,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    { model: llmModel, temperature: 0.3, maxTokens: 4096 },
  );
  const step3Details = llmStepDetails(llmModel, 0.3, llmResult.usage, systemPrompt + userContent, llmResult.content);
  totalInputTokens += step3Details.inputTokens as number;
  totalOutputTokens += step3Details.outputTokens as number;
  const step3 = makeStep(stepIndex++, 'AI品質チェック', step3Start, 'completed', step3Details);
  skeletonSteps.push(step3);
  onStep(step3);

  // Step 4: Merge results
  const step4Start = performance.now();
  let structuredResult: Record<string, unknown> | undefined;
  try {
    structuredResult = validateOutput(llmResult.content, archetype);
  } catch {
    // If parsing fails, structuredResult remains undefined — raw text is returned
  }

  // Strip LLM arithmetic hallucinations, inject programmatic results
  if (structuredResult) {
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

  const step4 = makeStep(stepIndex++, '結果統合', step4Start);
  skeletonSteps.push(step4);
  onStep(step4);

  // Build final trace
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

  const validationWarnings = issues.filter(i => i.severity === 'warning');

  return {
    taskId: task.id,
    taskName: task.name,
    archetype: task.archetype,
    result: llmResult.content,
    structuredResult: structuredResult ?? undefined,
    arithmeticCheck,
    validationWarnings: validationWarnings.length > 0 ? validationWarnings : undefined,
    cautionNote: task.cautionNote ?? undefined,
    traceId: llmResult.traceId,
    skeletonTrace,
  };
}

// ── Standard single-call pipeline ──────────────────────────────────

async function executeStandardPipeline(ctx: InternalPipelineContext): Promise<PipelineResult> {
  const { task, llmModel, systemPrompt, userContent, issues, archetype, onStep } = ctx;
  const traceStartMs = performance.now();
  const skeletonSteps: SkeletonStep[] = [];
  let stepIndex = 0;

  // Step 0: Input received
  const step0Start = performance.now();
  const step0 = makeStep(stepIndex++, '入力データ受信', step0Start);
  skeletonSteps.push(step0);
  onStep(step0);

  // Step 1: LLM generation
  const step1Start = performance.now();
  const llmResult = await callLlmViaProxy(
    null as never,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    { model: llmModel, temperature: 0.3, maxTokens: 4096 },
  );
  const step1Details = llmStepDetails(llmModel, 0.3, llmResult.usage, systemPrompt + userContent, llmResult.content);
  const step1 = makeStep(stepIndex++, 'AI生成', step1Start, 'completed', step1Details);
  skeletonSteps.push(step1);
  onStep(step1);

  // Step 2: Output validation
  const step2Start = performance.now();
  let structuredResult: Record<string, unknown> | undefined;
  let step2: SkeletonStep;
  try {
    structuredResult = validateOutput(llmResult.content, archetype);
    step2 = makeStep(stepIndex++, '出力検証', step2Start);
  } catch (parseError: unknown) {
    step2 = makeStep(stepIndex++, '出力検証', step2Start, 'error', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
    });
  }
  skeletonSteps.push(step2);
  onStep(step2);

  // Build final trace
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

  const warnings = issues.filter(i => i.severity === 'warning');

  return {
    taskId: task.id,
    taskName: task.name,
    archetype: task.archetype,
    result: llmResult.content,
    structuredResult: structuredResult ?? undefined,
    validationWarnings: warnings.length > 0 ? warnings : undefined,
    cautionNote: task.cautionNote ?? undefined,
    traceId: llmResult.traceId,
    skeletonTrace,
  };
}
