/**
 * FujiTrace AI 社員 — Comprehensive test suite.
 *
 * Covers:
 *   1. tool-matcher: buildFunctionCallingTools / resolveToolName
 *   2. system-prompt: buildSystemPrompt
 *   3. 事務作業カタログ coverage (3-layer routing validation)
 *   4. desire-db: logFeatureRequest / ensureAgentTables
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  buildFunctionCallingTools,
  resolveToolName,
} from '../tool-matcher.js';
import { buildSystemPrompt } from '../system-prompt.js';
import { allToolSchemas } from '../../tools/index.js';
import type { ToolSchema } from '../../tools/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Path to the system prompt template used by buildSystemPrompt. */
const SYSTEM_PROMPT_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'prompts',
  'agent',
  'system.md',
);

/** Minimal ToolSchema factory for isolated tests. */
function makeSchema(overrides: Partial<ToolSchema> = {}): ToolSchema {
  return {
    name: 'test.tool',
    description: 'テスト用ツール',
    version: '1.0.0',
    method: 'POST',
    path: '/api/test',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    responsibilityLevel: 'low',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. tool-matcher unit tests
// ---------------------------------------------------------------------------

describe('buildFunctionCallingTools', () => {
  it('should generate dedicated estimate functions + dispatcher + two meta-functions', () => {
    // Phase 0 behaviour: only `estimate.*` schemas get dedicated functions,
    // all other office tasks route through a single `office_task_execute`
    // dispatcher to keep well under OpenAI's 128-tool limit.
    const schemas = [
      makeSchema({ name: 'estimate.create' }),
      makeSchema({ name: 'estimate.check' }),
      makeSchema({ name: 'accounting.invoice_check' }), // filtered (routes via dispatcher)
    ];
    const tools = buildFunctionCallingTools(schemas);
    // 2 dedicated estimate.* + office_task_execute + _adapt_tool + _log_feature_request = 5
    expect(tools).toHaveLength(5);
    expect(tools.every((t) => t.type === 'function')).toBe(true);
    expect(tools.find((t) => t.function.name === 'office_task_execute')).toBeDefined();
  });

  it('should include _adapt_tool meta-function', () => {
    const tools = buildFunctionCallingTools([]);
    const adapt = tools.find((t) => t.function.name === '_adapt_tool');
    expect(adapt).toBeDefined();
    expect(adapt!.function.parameters).toHaveProperty('properties');
    const props = adapt!.function.parameters['properties'] as Record<string, unknown>;
    expect(props).toHaveProperty('base_tool');
    expect(props).toHaveProperty('adaptation_reason');
    expect(props).toHaveProperty('adapted_params');
  });

  it('should include _log_feature_request meta-function', () => {
    const tools = buildFunctionCallingTools([]);
    const log = tools.find((t) => t.function.name === '_log_feature_request');
    expect(log).toBeDefined();
    const props = log!.function.parameters['properties'] as Record<string, unknown>;
    expect(props).toHaveProperty('user_request_summary');
  });

  it('should convert dotted tool names to underscored function names', () => {
    const schemas = [makeSchema({ name: 'estimate.create' })];
    const tools = buildFunctionCallingTools(schemas);
    const toolFn = tools.find((t) => t.function.name === 'estimate_create');
    expect(toolFn).toBeDefined();
  });

  it('should include responsibilityLevel in the function description', () => {
    // Only estimate.* schemas get dedicated functions, so use estimate.create
    // to verify the responsibility-level injection behaviour.
    const schemas = [
      makeSchema({ name: 'estimate.create', description: 'テスト', responsibilityLevel: 'high' }),
    ];
    const tools = buildFunctionCallingTools(schemas);
    const fn = tools.find((t) => t.function.name === 'estimate_create');
    expect(fn).toBeDefined();
    expect(fn!.function.description).toContain('[responsibility: high]');
  });

  it('should sanitize zodToJsonSchema wrapper format with $ref/definitions', () => {
    // estimate.* prefix required for dedicated function generation.
    const wrappedSchema: ToolSchema = makeSchema({
      name: 'estimate.wraptest',
      inputSchema: {
        definitions: {
          WrapTest: { type: 'object', properties: { foo: { type: 'string' } } },
        },
        $ref: '#/definitions/WrapTest',
      },
    });
    const tools = buildFunctionCallingTools([wrappedSchema]);
    const fn = tools.find((t) => t.function.name === 'estimate_wraptest');
    expect(fn).toBeDefined();
    // Should have resolved $ref to the definition content directly
    expect(fn!.function.parameters).toHaveProperty('type', 'object');
    expect(fn!.function.parameters).toHaveProperty('properties');
    // Should NOT have $ref or definitions at top level
    expect(fn!.function.parameters).not.toHaveProperty('$ref');
    expect(fn!.function.parameters).not.toHaveProperty('definitions');
  });

  it('should pass through a direct object schema without $ref unchanged', () => {
    const directSchema: ToolSchema = makeSchema({
      name: 'estimate.directtest',
      inputSchema: { type: 'object', properties: { bar: { type: 'number' } } },
    });
    const tools = buildFunctionCallingTools([directSchema]);
    const fn = tools.find((t) => t.function.name === 'estimate_directtest');
    expect(fn).toBeDefined();
    expect(fn!.function.parameters).toEqual({
      type: 'object',
      properties: { bar: { type: 'number' } },
    });
  });
});

describe('resolveToolName', () => {
  const schemas = [
    makeSchema({ name: 'estimate.create' }),
    makeSchema({ name: 'estimate.check' }),
  ];

  it('should resolve estimate_create to estimate.create schema', () => {
    const result = resolveToolName('estimate_create', schemas);
    expect(result).toBeDefined();
    expect(result!.name).toBe('estimate.create');
  });

  it('should resolve estimate_check to estimate.check schema', () => {
    const result = resolveToolName('estimate_check', schemas);
    expect(result).toBeDefined();
    expect(result!.name).toBe('estimate.check');
  });

  it('should return undefined for _adapt_tool', () => {
    const result = resolveToolName('_adapt_tool', schemas);
    expect(result).toBeUndefined();
  });

  it('should return undefined for _log_feature_request', () => {
    const result = resolveToolName('_log_feature_request', schemas);
    expect(result).toBeUndefined();
  });

  it('should return undefined for unknown function names', () => {
    const result = resolveToolName('nonexistent_tool', schemas);
    expect(result).toBeUndefined();
  });

  it('should return undefined for an empty string', () => {
    const result = resolveToolName('', schemas);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. system-prompt tests
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  it('should load the template file and produce a non-empty string', () => {
    const prompt = buildSystemPrompt(allToolSchemas);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('should inject tool names for all non-forbidden registered tools', () => {
    // Phase 0 behaviour: system-prompt lists `estimate.*` with full description
    // and all other non-対応不可 tasks in a compact form. Descriptions are
    // truncated to 60 characters for the compact list. 対応不可 (士業独占業務)
    // schemas are deliberately excluded from the agent-visible tools list.
    const prompt = buildSystemPrompt(allToolSchemas);
    for (const schema of allToolSchemas) {
      if (schema.description.startsWith('[対応不可')) continue;
      expect(prompt).toContain(schema.name);
    }
  });

  it('dedicated estimate.* tools have full descriptions in the prompt', () => {
    const prompt = buildSystemPrompt(allToolSchemas);
    const dedicated = allToolSchemas.filter((s) => s.name.startsWith('estimate.'));
    for (const schema of dedicated) {
      expect(prompt).toContain(schema.description);
    }
  });

  it('should contain the 3-layer matching rules', () => {
    const prompt = buildSystemPrompt(allToolSchemas);
    expect(prompt).toContain('完全一致');
    expect(prompt).toContain('応用マッチ');
    expect(prompt).toContain('_adapt_tool');
    expect(prompt).toContain('_log_feature_request');
  });

  it('should contain constraints about forbidden tasks', () => {
    const prompt = buildSystemPrompt(allToolSchemas);
    // AI社員化 (2026-04-21): 業務スコープを事務作業から業務全般に拡張後、
    // 対応不可ケースは「_log_feature_request」に落とす方針。
    expect(prompt).toContain('_log_feature_request');
    expect(prompt).toContain('対応不可');
  });

  it('should contain the constraint about monetary operations requiring approval', () => {
    const prompt = buildSystemPrompt(allToolSchemas);
    expect(prompt).toContain('承認');
  });

  it('should NOT contain the {available_tools} placeholder after injection', () => {
    const prompt = buildSystemPrompt(allToolSchemas);
    expect(prompt).not.toContain('{available_tools}');
  });

  it('should contain routing guidance referencing the dispatcher and function calling', () => {
    // Phase 0 behaviour: individual HTTP method/path is NOT injected per tool.
    // All non-dedicated tools route via `office_task_execute` dispatcher, so
    // the prompt only references the routing mechanism, not each endpoint.
    const prompt = buildSystemPrompt(allToolSchemas);
    expect(prompt).toContain('office_task_execute');
  });

  it('should contain adaptation guidelines (OK and NOT OK cases)', () => {
    const prompt = buildSystemPrompt(allToolSchemas);
    // The prompt template defines when adaptation is acceptable
    expect(prompt).toContain('応用の判断基準');
    expect(prompt).toContain('応用が禁止されているケース');
  });
});

// ---------------------------------------------------------------------------
// 3. 事務作業カタログ coverage — 3-layer routing validation
// ---------------------------------------------------------------------------

describe('事務作業カタログ coverage', () => {
  /**
   * The 17 forbidden task categories from the catalog. These correspond to
   * tasks prohibited by professional licensing laws (士業独占業務).
   * NONE of these must be registered as tools.
   */
  const FORBIDDEN_TASK_KEYWORDS = [
    '決算書',           // 税理士法52条
    '確定申告',         // 税理士法52条
    '法人税',           // 税理士法52条
    '消費税申告',       // 税理士法52条
    '労働条件通知書',   // 社労士法27条
    '給与計算',         // 社労士法27条
    '36協定',           // 社労士法27条
    '会社設立登記',     // 司法書士法73条
    '許認可申請',       // 行政書士法1条の2
    '契約書レビュー',   // 弁護士法72条
    '契約書修正提案',   // 弁護士法72条
    '投資助言',         // 金商法29条
    'マイナンバー',     // 個情法/マイナンバー法
  ];

  /** Tasks that should be exact-match routed (Layer 1). */
  const EXACT_MATCH_TASKS = [
    { input: '見積書を作成して', expectedTool: 'estimate.create' },
    { input: '見積書をチェックして', expectedTool: 'estimate.check' },
    { input: '見積書の検証をお願いします', expectedTool: 'estimate.check' },
  ];

  /** Tasks that could plausibly be adapted from existing tools (Layer 2). */
  const EXPECTED_ADAPTED_TASKS = [
    '納品書を作成して',       // Similar item/amount structure to estimate.create
    '注文請書を作って',       // Similar to estimate.create
  ];

  /**
   * Tasks where no matching tool exists and no adaptation is possible (Layer 3).
   * These should trigger _log_feature_request.
   */
  const EXPECTED_FEATURE_REQUEST_TASKS = [
    '請求書をチェックして',
    '経費申請をチェックして',
    '議事録を作成して',
    '給与計算して',           // Also forbidden
    '確定申告書を作成して',   // Also forbidden
    '契約書をレビューして',   // Also forbidden
  ];

  /** Tasks outside the office-work domain. Should be entirely rejected. */
  const NON_OFFICE_TASKS = [
    '今日の天気は？',
    'Pythonのコードを書いて',
    '英語に翻訳して',
  ];

  it('system prompt mentions all non-forbidden registered tools by name', () => {
    // 対応不可 (士業独占業務) schemas are deliberately excluded from the
    // agent-visible tools list so the LLM does not try to execute them.
    const prompt = buildSystemPrompt(allToolSchemas);
    for (const schema of allToolSchemas) {
      if (schema.description.startsWith('[対応不可')) continue;
      expect(prompt).toContain(schema.name);
    }
  });

  it('forbidden tasks are registered but marked as 対応不可', () => {
    // Forbidden tasks ARE registered for exact matching, but their descriptions
    // must contain the [対応不可] prefix so the agent knows not to execute them
    const forbiddenSchemas = allToolSchemas.filter((s) =>
      s.description.includes('対応不可'),
    );
    // There should be at least 10 forbidden tasks registered
    expect(forbiddenSchemas.length).toBeGreaterThanOrEqual(10);
    // All forbidden schemas should mention 士業独占業務
    for (const schema of forbiddenSchemas) {
      expect(schema.description).toContain('士業独占業務');
    }
  });

  it('system prompt includes adaptation guidelines', () => {
    const prompt = buildSystemPrompt(allToolSchemas);
    // The prompt must contain rules for when adaptation is OK / not OK
    expect(prompt).toContain('応用の判断基準');
    expect(prompt).toContain('応用が禁止されているケース');
    // The responsibilityLevel constraint for adaptation must be present
    expect(prompt).toContain('responsibilityLevel');
  });

  it('system prompt includes fallback for unsupported requests', () => {
    // AI社員化 (2026-04-21): 業務スコープ拡張に伴い、対応不可リクエストは
    // `_log_feature_request` 経由で欲望DBに落とす方針。
    const prompt = buildSystemPrompt(allToolSchemas);
    expect(prompt).toContain('対応不可');
    expect(prompt).toContain('_log_feature_request');
  });

  it('tool schemas have correct responsibilityLevel', () => {
    const createSchema = allToolSchemas.find((s) => s.name === 'estimate.create');
    const checkSchema = allToolSchemas.find((s) => s.name === 'estimate.check');

    expect(createSchema).toBeDefined();
    expect(createSchema!.responsibilityLevel).toBe('high');

    expect(checkSchema).toBeDefined();
    expect(checkSchema!.responsibilityLevel).toBe('high');
  });

  it('function calling tools include responsibility level in description', () => {
    const tools = buildFunctionCallingTools(allToolSchemas);
    // Filter out meta-functions
    const realTools = tools.filter(
      (t) =>
        t.function.name !== '_adapt_tool' &&
        t.function.name !== '_log_feature_request',
    );

    for (const tool of realTools) {
      expect(tool.function.description).toMatch(
        /\[responsibility: (high|medium|low)\]/,
      );
    }
  });

  it('exact-match tasks have corresponding tools registered', () => {
    for (const task of EXACT_MATCH_TASKS) {
      const schema = allToolSchemas.find((s) => s.name === task.expectedTool);
      expect(
        schema,
        `Expected tool "${task.expectedTool}" to be registered for task "${task.input}"`,
      ).toBeDefined();
    }
  });

  it('adapted tasks reference tools that actually exist', () => {
    // Adapted tasks for estimate-like documents (納品書, 注文請書) should
    // be able to reference estimate.create since the data structures overlap.
    const estimateCreate = allToolSchemas.find(
      (s) => s.name === 'estimate.create',
    );
    expect(
      estimateCreate,
      'estimate.create must exist for adaptation of 納品書/注文請書',
    ).toBeDefined();
  });

  it('all catalog tasks have matching tools registered', () => {
    // With 132+ tasks registered, every catalog category should have tools
    const allToolNames = allToolSchemas.map((s) => s.name);
    // Verify key tasks from different categories exist
    const expectedCategories = ['estimate.', 'accounting.', 'hr.', 'legal.', 'sales.', 'it.', 'management.'];
    for (const prefix of expectedCategories) {
      const hasCategory = allToolNames.some((n) => n.startsWith(prefix));
      expect(hasCategory, `Should have tools in category ${prefix}`).toBe(true);
    }
    // Total tools should be 100+ (all catalog items registered)
    expect(allToolSchemas.length).toBeGreaterThanOrEqual(100);
  });

  it('non-office tasks have no matching tools; prompt routes them via feature-request', () => {
    // AI社員化 (2026-04-21): 業務全般スコープに拡張後、天気/翻訳等の明確に業務外
    // なリクエストは、ツール不在 + _log_feature_request 経路に落とす方針。
    const prompt = buildSystemPrompt(allToolSchemas);
    expect(prompt).toContain('_log_feature_request');

    // No registered tool should handle weather, coding, or translation
    const allNames = allToolSchemas.map((s) => s.name).join(' ');
    const allDescs = allToolSchemas.map((s) => s.description).join(' ');
    for (const task of NON_OFFICE_TASKS) {
      const keyword = task.replace(/[？?！!を]/g, '');
      // Tool names/descriptions should not match non-office keywords
      expect(allNames).not.toContain(keyword);
      // Descriptions should not suggest handling non-office tasks
      expect(allDescs).not.toContain(keyword);
    }
  });

  it('catalog tasks are categorizable by the 3-layer system', () => {
    // Static analysis: verify the setup allows GPT-4o to make correct routing
    // decisions for ALL task categories.

    // 1. The function-calling array must contain at least the 2 meta-functions
    const tools = buildFunctionCallingTools(allToolSchemas);
    const functionNames = tools.map((t) => t.function.name);
    expect(functionNames).toContain('_adapt_tool');
    expect(functionNames).toContain('_log_feature_request');

    // 2. Every registered tool must be resolvable back from its function name
    for (const schema of allToolSchemas) {
      const fnName = schema.name.replace(/\./g, '_');
      const resolved = resolveToolName(fnName, allToolSchemas);
      expect(resolved).toBeDefined();
      expect(resolved!.name).toBe(schema.name);
    }

    // 3. Meta-functions must NOT resolve to a ToolSchema (they are handled specially)
    expect(resolveToolName('_adapt_tool', allToolSchemas)).toBeUndefined();
    expect(resolveToolName('_log_feature_request', allToolSchemas)).toBeUndefined();

    // 4. The system prompt must contain all 3 routing instructions
    const prompt = buildSystemPrompt(allToolSchemas);
    expect(prompt).toContain('完全一致');   // Layer 1
    expect(prompt).toContain('応用マッチ'); // Layer 2
    expect(prompt).toContain('対応不可');   // Layer 3
  });

  it('all registered tool schemas have required fields populated', () => {
    for (const schema of allToolSchemas) {
      expect(schema.name).toBeTruthy();
      expect(schema.description).toBeTruthy();
      expect(schema.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).toContain(schema.method);
      expect(schema.path).toMatch(/^\/api\//);
      expect(schema.inputSchema).toBeDefined();
      expect(schema.outputSchema).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(schema.responsibilityLevel);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. desire-db tests (mocked database)
// ---------------------------------------------------------------------------

describe('desire-db', () => {
  // We mock the knex-client module so no real database connection is made.
  // vi.hoisted ensures these are available when vi.mock is hoisted.

  const { mockInsert, mockHasTable, mockCreateTable, mockKnex } = vi.hoisted(() => {
    const mockInsert = vi.fn().mockResolvedValue([1]);
    const mockHasTable = vi.fn().mockResolvedValue(true);
    const mockCreateTable = vi.fn();

    const mockKnex = vi.fn(() => ({
      insert: mockInsert,
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(1),
    }));

    // Attach schema builder to the mock
    (mockKnex as unknown as Record<string, unknown>)['schema'] = {
      hasTable: mockHasTable,
      createTable: mockCreateTable,
    };
    (mockKnex as unknown as Record<string, unknown>)['fn'] = {
      now: vi.fn().mockReturnValue('NOW()'),
    };

    return { mockInsert, mockHasTable, mockCreateTable, mockKnex };
  });

  vi.mock('../../storage/knex-client.js', () => ({
    getKnex: () => mockKnex,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the agentTablesReady flag by re-importing
    // Since we cannot reset module-level state directly, we rely on
    // the mock returning true for hasTable so ensureAgentTables is a no-op
    // after the first call.
    mockHasTable.mockResolvedValue(true);
  });

  it('logFeatureRequest should insert into feature_requests table', async () => {
    // Dynamic import to pick up the mocked knex-client
    const { logFeatureRequest } = await import('../desire-db.js');

    await logFeatureRequest('ws-123', '請求書を作りたい', null, 'none');

    expect(mockKnex).toHaveBeenCalledWith('feature_requests');
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const insertedRow = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedRow).toHaveProperty('workspace_id', 'ws-123');
    expect(insertedRow).toHaveProperty('user_message', '請求書を作りたい');
    expect(insertedRow).toHaveProperty('matched_tool', null);
    expect(insertedRow).toHaveProperty('match_type', 'none');
    expect(insertedRow).toHaveProperty('id');
    expect(insertedRow).toHaveProperty('created_at');
  });

  it('logFeatureRequest should handle match_type "exact"', async () => {
    const { logFeatureRequest } = await import('../desire-db.js');

    await logFeatureRequest('ws-456', '見積書を作成', 'estimate.create', 'exact');

    const insertedRow = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedRow).toHaveProperty('match_type', 'exact');
    expect(insertedRow).toHaveProperty('matched_tool', 'estimate.create');
  });

  it('logFeatureRequest should handle match_type "adapted"', async () => {
    const { logFeatureRequest } = await import('../desire-db.js');

    await logFeatureRequest('ws-789', '納品書を作成', 'estimate.create', 'adapted');

    const insertedRow = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedRow).toHaveProperty('match_type', 'adapted');
    expect(insertedRow).toHaveProperty('matched_tool', 'estimate.create');
  });

  it('logFeatureRequest should store workspace_id correctly', async () => {
    const { logFeatureRequest } = await import('../desire-db.js');
    const workspaceId = 'workspace-unique-id-abc';

    await logFeatureRequest(workspaceId, 'テスト', null, 'none');

    const insertedRow = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedRow).toHaveProperty('workspace_id', workspaceId);
  });

  it('ensureAgentTables should create tables when they do not exist', async () => {
    // Reset module state by using a fresh dynamic import
    // Force hasTable to return false so tables need to be created
    mockHasTable.mockResolvedValue(false);

    // We need to reset the module-level agentTablesReady flag.
    // Since vi.mock is hoisted, we re-import with resetModules.
    vi.resetModules();

    // Re-mock after resetModules
    vi.doMock('../../storage/knex-client.js', () => ({
      getKnex: () => mockKnex,
    }));

    const { ensureAgentTables } = await import('../desire-db.js');
    await ensureAgentTables();

    expect(mockHasTable).toHaveBeenCalledWith('agent_conversations');
    expect(mockHasTable).toHaveBeenCalledWith('feature_requests');
    // 3 tables: agent_conversations, feature_requests, workspace_memory
    // (workspace_memory added when AI社員 v2 expanded the agent memory model)
    expect(mockCreateTable).toHaveBeenCalledTimes(3);
  });

  it('ensureAgentTables should skip creation when tables already exist', async () => {
    mockHasTable.mockResolvedValue(true);

    vi.resetModules();
    vi.doMock('../../storage/knex-client.js', () => ({
      getKnex: () => mockKnex,
    }));

    const { ensureAgentTables } = await import('../desire-db.js');
    await ensureAgentTables();

    expect(mockHasTable).toHaveBeenCalled();
    expect(mockCreateTable).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. System prompt template file integrity
// ---------------------------------------------------------------------------

describe('system prompt template file', () => {
  it('should exist on disk', () => {
    expect(fs.existsSync(SYSTEM_PROMPT_PATH)).toBe(true);
  });

  it('should contain the {available_tools} placeholder', () => {
    const template = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');
    expect(template).toContain('{available_tools}');
  });

  it('should be non-empty and contain core agent identity', () => {
    const template = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');
    expect(template.length).toBeGreaterThan(50);
    // AI社員化 (2026-04-21): system prompt identity is 「フジ」.
    expect(template).toContain('「フジ」');
  });
});
