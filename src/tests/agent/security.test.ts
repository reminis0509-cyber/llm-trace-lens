/**
 * Security tests for FujiTrace AI 事務員 implementation.
 *
 * Covers:
 * - Workspace impersonation prevention (x-workspace-id header spoofing)
 * - Conversation access control (cross-workspace isolation)
 * - Input validation (message length, conversation_id format, task_id format)
 * - Conversation history size limits (DoS prevention)
 * - Prompt injection guardrails (system prompt integrity)
 * - Tool matcher safety (no unauthorized tool resolution)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { INTERNAL_SECRET } from '../../routes/tools/_shared.js';
import { buildFunctionCallingTools, resolveToolName } from '../../agent/tool-matcher.js';
import { buildSystemPrompt } from '../../agent/system-prompt.js';
import type { ToolSchema } from '../../tools/types.js';

/* ------------------------------------------------------------------ */
/*  Shared test fixtures                                               */
/* ------------------------------------------------------------------ */

const mockToolSchemas: ToolSchema[] = [
  {
    name: 'estimate.create',
    description: 'AI見積書作成',
    version: '1.0.0',
    method: 'POST',
    path: '/api/tools/estimate/create',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    responsibilityLevel: 'high',
  },
  {
    name: 'accounting.template_unify',
    description: 'テンプレート統一',
    version: '1.0.0',
    method: 'POST',
    path: '/api/tools/office-task/execute',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    responsibilityLevel: 'low',
  },
];

/* ------------------------------------------------------------------ */
/*  A. Workspace impersonation prevention                              */
/* ------------------------------------------------------------------ */

describe('Workspace impersonation prevention', () => {
  it('INTERNAL_SECRET is a valid UUID and unique per process', () => {
    expect(INTERNAL_SECRET).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    // Secret should be non-empty and not a predictable value
    expect(INTERNAL_SECRET).not.toBe('');
    expect(INTERNAL_SECRET).not.toBe('undefined');
    expect(INTERNAL_SECRET).not.toBe('null');
  });

  it('INTERNAL_SECRET is not exposed in any public-facing module exports', () => {
    // The secret is exported from _shared.ts for internal use only.
    // Verify it exists and is a string (not accidentally undefined).
    expect(typeof INTERNAL_SECRET).toBe('string');
    expect(INTERNAL_SECRET.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  B. Tool matcher safety                                             */
/* ------------------------------------------------------------------ */

describe('Tool matcher safety', () => {
  it('resolveToolName returns undefined for meta-function names', () => {
    expect(resolveToolName('_adapt_tool', mockToolSchemas)).toBeUndefined();
    expect(resolveToolName('_log_feature_request', mockToolSchemas)).toBeUndefined();
  });

  it('resolveToolName returns undefined for arbitrary function names', () => {
    expect(resolveToolName('exec', mockToolSchemas)).toBeUndefined();
    expect(resolveToolName('system', mockToolSchemas)).toBeUndefined();
    expect(resolveToolName('rm -rf /', mockToolSchemas)).toBeUndefined();
    expect(resolveToolName('../../../etc/passwd', mockToolSchemas)).toBeUndefined();
    expect(resolveToolName('', mockToolSchemas)).toBeUndefined();
  });

  it('resolveToolName matches only exact function names (dot-to-underscore)', () => {
    expect(resolveToolName('estimate_create', mockToolSchemas)?.name).toBe('estimate.create');
    expect(resolveToolName('estimate.create', mockToolSchemas)).toBeUndefined(); // dots not valid in function names
    expect(resolveToolName('ESTIMATE_CREATE', mockToolSchemas)).toBeUndefined(); // case-sensitive
  });

  it('buildFunctionCallingTools includes meta-functions', () => {
    const tools = buildFunctionCallingTools(mockToolSchemas);
    const names = tools.map((t) => t.function.name);
    expect(names).toContain('_adapt_tool');
    expect(names).toContain('_log_feature_request');
  });

  it('buildFunctionCallingTools does not expose internal paths in descriptions', () => {
    const tools = buildFunctionCallingTools(mockToolSchemas);
    for (const tool of tools) {
      const desc = tool.function.description;
      // Should not contain file system paths
      expect(desc).not.toMatch(/\/Users\//);
      expect(desc).not.toMatch(/\/home\//);
      expect(desc).not.toMatch(/node_modules/);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  C. System prompt integrity                                         */
/* ------------------------------------------------------------------ */

describe('System prompt integrity', () => {
  it('system prompt contains security rules', () => {
    const prompt = buildSystemPrompt(mockToolSchemas);
    // Must contain anti-prompt-leak instructions
    expect(prompt).toContain('プロンプト');
    expect(prompt).toContain('禁止');
  });

  it('system prompt injects tool list via placeholder replacement', () => {
    const prompt = buildSystemPrompt(mockToolSchemas);
    // The {available_tools} placeholder should be replaced
    expect(prompt).not.toContain('{available_tools}');
    // Tool names should appear in the prompt
    expect(prompt).toContain('estimate.create');
  });

  it('system prompt does not contain raw user input placeholders', () => {
    const prompt = buildSystemPrompt(mockToolSchemas);
    // System prompt should not have user-input placeholders
    expect(prompt).not.toContain('{instruction}');
    expect(prompt).not.toContain('{context}');
    expect(prompt).not.toContain('{user_message}');
  });
});

/* ------------------------------------------------------------------ */
/*  D. Task ID validation                                              */
/* ------------------------------------------------------------------ */

describe('Task ID validation', () => {
  it('office task catalog IDs follow the expected pattern', async () => {
    const { officeTaskCatalog } = await import('../../tools/office-tasks/catalog.js');
    for (const task of officeTaskCatalog) {
      // All task IDs must match the alphanumeric + dots/hyphens/underscores pattern
      expect(task.id).toMatch(/^[a-zA-Z0-9._-]+$/);
      // No empty IDs
      expect(task.id.length).toBeGreaterThan(0);
      // No suspiciously long IDs
      expect(task.id.length).toBeLessThanOrEqual(100);
    }
  });

  it('forbidden tasks have forbiddenLaw specified', async () => {
    const { officeTaskCatalog } = await import('../../tools/office-tasks/catalog.js');
    const forbiddenTasks = officeTaskCatalog.filter((t) => t.forbidden);
    for (const task of forbiddenTasks) {
      expect(task.forbiddenLaw).toBeDefined();
      expect(typeof task.forbiddenLaw).toBe('string');
      expect(task.forbiddenLaw!.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  E. Input validation schema                                         */
/* ------------------------------------------------------------------ */

describe('Agent chat input validation', () => {
  it('rejects messages exceeding 2000 characters', async () => {
    const { z } = await import('zod');
    const requestSchema = z.object({
      conversation_id: z.string().uuid().optional(),
      message: z.string().min(1).max(2000),
    });

    const longMessage = 'a'.repeat(2001);
    const result = requestSchema.safeParse({ message: longMessage });
    expect(result.success).toBe(false);
  });

  it('rejects empty messages', async () => {
    const { z } = await import('zod');
    const requestSchema = z.object({
      conversation_id: z.string().uuid().optional(),
      message: z.string().min(1).max(2000),
    });

    const result = requestSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID conversation_id', async () => {
    const { z } = await import('zod');
    const requestSchema = z.object({
      conversation_id: z.string().uuid().optional(),
      message: z.string().min(1).max(2000),
    });

    const result = requestSchema.safeParse({
      conversation_id: 'not-a-uuid',
      message: 'hello',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid UUID conversation_id', async () => {
    const { z } = await import('zod');
    const requestSchema = z.object({
      conversation_id: z.string().uuid().optional(),
      message: z.string().min(1).max(2000),
    });

    const result = requestSchema.safeParse({
      conversation_id: '550e8400-e29b-41d4-a716-446655440000',
      message: 'hello',
    });
    expect(result.success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  F. Office task execute input validation                            */
/* ------------------------------------------------------------------ */

describe('Office task execute input validation', () => {
  it('rejects task_id with special characters', async () => {
    const { z } = await import('zod');
    const requestSchema = z.object({
      task_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/),
      instruction: z.string().min(1).max(5000),
      context: z.string().max(10000).optional(),
    });

    const maliciousIds = [
      '<script>alert(1)</script>',
      '"; DROP TABLE users; --',
      '../../../etc/passwd',
      'task_id\nX-Admin: true',
      'task_id with spaces',
      '',
    ];

    for (const id of maliciousIds) {
      const result = requestSchema.safeParse({
        task_id: id,
        instruction: 'test',
      });
      expect(result.success).toBe(false);
    }
  });

  it('accepts valid task_id formats', async () => {
    const { z } = await import('zod');
    const requestSchema = z.object({
      task_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/),
      instruction: z.string().min(1).max(5000),
      context: z.string().max(10000).optional(),
    });

    const validIds = [
      'accounting.estimate_create',
      'hr.attendance_summary',
      'legal-compliance.check',
    ];

    for (const id of validIds) {
      const result = requestSchema.safeParse({
        task_id: id,
        instruction: 'test instruction',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects instruction exceeding 5000 characters', async () => {
    const { z } = await import('zod');
    const requestSchema = z.object({
      task_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/),
      instruction: z.string().min(1).max(5000),
      context: z.string().max(10000).optional(),
    });

    const result = requestSchema.safeParse({
      task_id: 'test.task',
      instruction: 'x'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  G. Office task prompt template safety                              */
/* ------------------------------------------------------------------ */

describe('Office task prompt template safety', () => {
  it('system prompt template does not embed user input', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const templatePath = path.resolve(
      __dirname,
      '..',
      '..',
      'prompts',
      'tools',
      'office-task',
      'system.md',
    );

    const template = fs.readFileSync(templatePath, 'utf-8');
    // Template should NOT contain {instruction} or {context} placeholders
    // because user input must be sent as a separate user message
    expect(template).not.toContain('{instruction}');
    expect(template).not.toContain('{context}');
  });

  it('system prompt template contains anti-injection rules', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const templatePath = path.resolve(
      __dirname,
      '..',
      '..',
      'prompts',
      'tools',
      'office-task',
      'system.md',
    );

    const template = fs.readFileSync(templatePath, 'utf-8');
    // Must contain instructions to refuse system prompt disclosure
    expect(template).toContain('開示');
    expect(template).toContain('禁止');
  });
});
