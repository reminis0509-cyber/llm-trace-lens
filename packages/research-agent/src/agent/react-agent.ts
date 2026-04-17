/**
 * ReAct (Reason + Act) Research Agent
 *
 * Executes a multi-step research loop:
 *   1. Plan   - LLM generates search queries based on the research topic
 *   2. Search - Execute web searches via DuckDuckGo
 *   3. Analyze - LLM analyzes and synthesizes search results
 *   4. Report  - LLM generates a structured Markdown report
 *
 * All LLM calls are routed through the FujiTrace proxy for observability.
 */

import type {
  ResearchInput,
  AgentStep,
  ResearchReport,
  OnStepUpdate,
  ChatCompletionResponse,
  AgentTraceMetadata,
} from './types';
import { webSearch, type SearchResult } from './web-search';

const FUJITRACE_PROXY_URL =
  import.meta.env.VITE_FUJITRACE_PROXY_URL || 'http://localhost:3000';
// SECURITY WARNING: VITE_ prefixed vars are embedded in client bundles.
// This package MUST NOT be deployed as a frontend app.
// All LLM calls should route through the backend proxy in production.
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

const MODEL = 'gpt-4o-mini';
const AGENT_ID = 'research-agent-v1';
const AGENT_NAME = 'FujiTrace Research Agent';

/** GPT-4o-mini pricing per 1K tokens (USD) */
const COST_PER_1K_PROMPT = 0.00015;
const COST_PER_1K_COMPLETION = 0.0006;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function nowISO(): string {
  return new Date().toISOString();
}

function calculateCost(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens / 1000) * COST_PER_1K_PROMPT +
    (completionTokens / 1000) * COST_PER_1K_COMPLETION
  );
}

/**
 * Build the running AgentTraceMetadata that accompanies each LLM call
 * so FujiTrace can correlate all steps into a single agent trace.
 */
function buildAgentTrace(
  goal: string,
  completedSteps: AgentStep[],
  currentStepIndex: number,
  currentThought: string,
  currentAction: string
): AgentTraceMetadata {
  const traceSteps: Array<{
    stepIndex: number;
    thought: string;
    action: string;
    observation?: string;
    timestamp: string;
    durationMs?: number;
  }> = completedSteps.map((s, idx) => ({
    stepIndex: idx,
    thought: s.description,
    action: s.type as string,
    observation: s.output?.slice(0, 500),
    timestamp: s.startedAt || nowISO(),
    durationMs: s.completedAt && s.startedAt
      ? new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()
      : undefined,
  }));

  // Add the in-progress step
  traceSteps.push({
    stepIndex: currentStepIndex,
    thought: currentThought,
    action: currentAction,
    observation: undefined,
    timestamp: nowISO(),
    durationMs: undefined,
  });

  const toolCallCount = completedSteps.filter((s) => s.type === 'search').length;

  return {
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    goal,
    steps: traceSteps,
    status: 'in_progress',
    stepCount: traceSteps.length,
    toolCallCount,
  };
}

// ---------------------------------------------------------------------------
// LLM call (via FujiTrace proxy)
// ---------------------------------------------------------------------------

interface CallLLMOptions {
  messages: Array<{ role: string; content: string }>;
  agentTrace?: AgentTraceMetadata;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Send a chat completion request through the FujiTrace proxy.
 * The proxy records the trace and forwards the request to OpenAI.
 */
async function callLLM(options: CallLLMOptions): Promise<ChatCompletionResponse> {
  const { messages, agentTrace, temperature = 0.3, maxTokens = 2048 } = options;

  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    temperature,
    maxTokens,
  };

  if (agentTrace) {
    body.traceType = 'agent';
    body.agentTrace = agentTrace;
  }

  const response = await fetch(`${FUJITRACE_PROXY_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `FujiTrace proxy error (${response.status}): ${errorText}`
    );
  }

  const data: unknown = await response.json();
  return data as ChatCompletionResponse;
}

/**
 * Extract the text content from a ChatCompletionResponse.
 * Throws if the response contains no content.
 */
function extractContent(response: ChatCompletionResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM response contained no content');
  }
  return content;
}

// ---------------------------------------------------------------------------
// Step: Plan research
// ---------------------------------------------------------------------------

interface ResearchPlan {
  searchQueries: string[];
  reasoning: string;
}

async function planResearch(
  input: ResearchInput,
  completedSteps: AgentStep[]
): Promise<{ plan: ResearchPlan; response: ChatCompletionResponse }> {
  const agentTrace = buildAgentTrace(
    `${input.topic}についての調査`,
    completedSteps,
    0,
    '調査計画を立案中',
    'plan'
  );

  const systemPrompt = [
    'あなたは調査計画アシスタントです。',
    'ユーザーから与えられた調査テーマに基づいて、効果的なウェブ検索クエリを3つ生成してください。',
    '',
    '以下のJSON形式で回答してください（他のテキストは含めないでください）:',
    '{',
    '  "reasoning": "なぜこれらのクエリを選んだかの簡潔な説明",',
    '  "searchQueries": ["クエリ1", "クエリ2", "クエリ3"]',
    '}',
  ].join('\n');

  const userPromptParts = [
    `調査テーマ: ${input.topic}`,
    `目的: ${input.purpose}`,
  ];
  if (input.focusAreas) {
    userPromptParts.push(`特に知りたいこと: ${input.focusAreas}`);
  }
  if (input.requesterInfo) {
    userPromptParts.push(`依頼者情報: ${input.requesterInfo}`);
  }

  const response = await callLLM({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPromptParts.join('\n') },
    ],
    agentTrace,
    temperature: 0.4,
    maxTokens: 512,
  });

  const content = extractContent(response);

  // Parse the JSON plan from LLM output (handle markdown code fences)
  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let plan: ResearchPlan;
  try {
    const parsed: unknown = JSON.parse(cleaned);
    const obj = parsed as Record<string, unknown>;
    const queries = obj.searchQueries;
    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error('searchQueries is empty or missing');
    }
    plan = {
      searchQueries: queries.map(String),
      reasoning: typeof obj.reasoning === 'string' ? obj.reasoning : '',
    };
  } catch (parseError) {
    // Fallback: generate basic queries from the topic
    plan = {
      searchQueries: [
        `${input.topic} 概要`,
        `${input.topic} 最新動向 2025`,
        `${input.topic} ${input.purpose}`,
      ],
      reasoning: 'LLMの出力をパースできなかったため、基本的なクエリを生成しました',
    };
  }

  return { plan, response };
}

// ---------------------------------------------------------------------------
// Step: Execute web searches
// ---------------------------------------------------------------------------

interface SearchStepResult {
  query: string;
  results: SearchResult[];
  error?: string;
}

async function executeSearch(query: string): Promise<SearchStepResult> {
  try {
    const results = await webSearch(query, 5);
    return { query, results };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { query, results: [], error: message };
  }
}

// ---------------------------------------------------------------------------
// Step: Analyze search results
// ---------------------------------------------------------------------------

async function analyzeResults(
  input: ResearchInput,
  searchResults: SearchStepResult[],
  completedSteps: AgentStep[]
): Promise<{ analysis: string; response: ChatCompletionResponse }> {
  const agentTrace = buildAgentTrace(
    `${input.topic}についての調査`,
    completedSteps,
    completedSteps.length,
    '検索結果を分析中',
    'analyze'
  );

  const systemPrompt = [
    'あなたは調査分析アシスタントです。',
    'ウェブ検索の結果を分析し、重要な情報を抽出・整理してください。',
    '',
    '以下の観点で分析してください:',
    '1. 主要な事実と数値',
    '2. 情報源間の矛盾や相違点',
    '3. 信頼性の高い情報と不確実な情報の区別',
    '4. 重要度によるランキング',
    '',
    '分析結果を構造化されたテキストで出力してください。',
  ].join('\n');

  // Format search results for the LLM
  const formattedResults = searchResults
    .map((sr) => {
      const resultLines = sr.results.map(
        (r, i) => `  ${i + 1}. [${r.title}](${r.url})\n     ${r.snippet}`
      );
      const errorNote = sr.error ? `\n  (エラー: ${sr.error})` : '';
      return `検索クエリ: "${sr.query}"${errorNote}\n${resultLines.join('\n')}`;
    })
    .join('\n\n');

  const userPrompt = [
    `調査テーマ: ${input.topic}`,
    `目的: ${input.purpose}`,
    '',
    '--- 検索結果 ---',
    formattedResults,
  ].join('\n');

  const response = await callLLM({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    agentTrace,
    temperature: 0.3,
    maxTokens: 2048,
  });

  const analysis = extractContent(response);
  return { analysis, response };
}

// ---------------------------------------------------------------------------
// Step: Generate final report
// ---------------------------------------------------------------------------

async function generateReport(
  input: ResearchInput,
  analysis: string,
  completedSteps: AgentStep[]
): Promise<{ markdown: string; title: string; response: ChatCompletionResponse }> {
  const agentTrace = buildAgentTrace(
    `${input.topic}についての調査`,
    completedSteps,
    completedSteps.length,
    '調査レポートを生成中',
    'report'
  );

  const systemPrompt = [
    'あなたは調査レポートライターです。',
    '分析結果を基に、構造化されたMarkdownレポートを生成してください。',
    '',
    '以下のセクションを含めてください:',
    '## エグゼクティブサマリー',
    '(3-5文で調査結果の概要)',
    '',
    '## 市場概況',
    '(市場規模、成長率、主要トレンド)',
    '',
    '## 主要プレイヤー',
    '(競合他社・関連企業の一覧と特徴)',
    '',
    '## トレンド・将来展望',
    '(今後の動向予測)',
    '',
    '## 所見',
    '(調査者としての見解・推奨事項)',
    '',
    'レポートは日本語で作成してください。',
    'Markdownのみを出力してください（コードフェンスで囲まないでください）。',
  ].join('\n');

  const userPrompt = [
    `調査テーマ: ${input.topic}`,
    `目的: ${input.purpose}`,
    input.focusAreas ? `注目ポイント: ${input.focusAreas}` : '',
    '',
    '--- 分析結果 ---',
    analysis,
  ]
    .filter(Boolean)
    .join('\n');

  const response = await callLLM({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    agentTrace,
    temperature: 0.5,
    maxTokens: 3000,
  });

  const markdown = extractContent(response);

  // Extract title from the first heading, or generate one
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch
    ? titleMatch[1]
    : `${input.topic} 調査レポート`;

  return { markdown, title, response };
}

// ---------------------------------------------------------------------------
// Helper: create and emit a step
// ---------------------------------------------------------------------------

function createStep(
  stepNumber: number,
  type: AgentStep['type'],
  description: string,
  input?: string
): AgentStep {
  return {
    stepNumber,
    type,
    description,
    input,
    status: 'pending',
  };
}

function markRunning(step: AgentStep, onUpdate: OnStepUpdate): AgentStep {
  const updated: AgentStep = {
    ...step,
    status: 'running',
    startedAt: nowISO(),
  };
  onUpdate(updated);
  return updated;
}

function markCompleted(
  step: AgentStep,
  output: string,
  response: ChatCompletionResponse | null,
  onUpdate: OnStepUpdate
): AgentStep {
  const usage = response?.usage;
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;

  const updated: AgentStep = {
    ...step,
    status: 'completed',
    output,
    completedAt: nowISO(),
    tokenUsage: usage
      ? {
          prompt: promptTokens,
          completion: completionTokens,
          total: usage.total_tokens,
        }
      : undefined,
    cost: usage ? calculateCost(promptTokens, completionTokens) : undefined,
  };
  onUpdate(updated);
  return updated;
}

function markError(
  step: AgentStep,
  error: string,
  onUpdate: OnStepUpdate
): AgentStep {
  const updated: AgentStep = {
    ...step,
    status: 'error',
    output: error,
    completedAt: nowISO(),
  };
  onUpdate(updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the full ReAct research agent loop.
 *
 * @param input - Research parameters (topic, purpose, etc.)
 * @param onStepUpdate - Callback invoked whenever a step changes status
 * @returns The final structured research report
 */
export async function runResearchAgent(
  input: ResearchInput,
  onStepUpdate: OnStepUpdate
): Promise<ResearchReport> {
  const startTime = Date.now();
  const completedSteps: AgentStep[] = [];
  let totalTokens = 0;
  let totalCost = 0;

  // =========================================================================
  // Step 1: Plan research queries
  // =========================================================================
  let step1 = createStep(1, 'think', '調査計画を立案中...', input.topic);
  step1 = markRunning(step1, onStepUpdate);

  let plan: ResearchPlan;
  try {
    const planResult = await planResearch(input, completedSteps);
    plan = planResult.plan;
    const tokens = planResult.response.usage?.total_tokens ?? 0;
    totalTokens += tokens;
    const cost = calculateCost(
      planResult.response.usage?.prompt_tokens ?? 0,
      planResult.response.usage?.completion_tokens ?? 0
    );
    totalCost += cost;

    step1 = markCompleted(
      step1,
      `検索クエリ: ${plan.searchQueries.join(', ')}\n理由: ${plan.reasoning}`,
      planResult.response,
      onStepUpdate
    );
    completedSteps.push(step1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    step1 = markError(step1, `計画立案エラー: ${message}`, onStepUpdate);
    completedSteps.push(step1);

    // Use fallback queries so the agent can continue
    plan = {
      searchQueries: [
        `${input.topic} 概要`,
        `${input.topic} 最新動向`,
        `${input.topic} ${input.purpose}`,
      ],
      reasoning: 'LLM呼び出しに失敗したため、基本クエリを使用',
    };
  }

  // =========================================================================
  // Step 2: Execute web searches
  // =========================================================================
  const allSearchResults: SearchStepResult[] = [];

  for (let i = 0; i < plan.searchQueries.length; i++) {
    const query = plan.searchQueries[i];
    const stepNum = 2 + i;

    let searchStep = createStep(
      stepNum,
      'search',
      `ウェブ検索中: "${query}"`,
      query
    );
    searchStep = markRunning(searchStep, onStepUpdate);

    try {
      const result = await executeSearch(query);
      allSearchResults.push(result);

      const resultSummary = result.results
        .map((r) => `- ${r.title}`)
        .join('\n');
      const output = result.error
        ? `検索エラー: ${result.error}`
        : `${result.results.length}件の結果を取得:\n${resultSummary}`;

      searchStep = markCompleted(searchStep, output, null, onStepUpdate);
      completedSteps.push(searchStep);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      searchStep = markError(
        searchStep,
        `検索エラー: ${message}`,
        onStepUpdate
      );
      completedSteps.push(searchStep);
      allSearchResults.push({ query, results: [], error: message });
    }
  }

  // =========================================================================
  // Step N+1: Analyze search results
  // =========================================================================
  const analyzeStepNum = 2 + plan.searchQueries.length;
  let analyzeStep = createStep(
    analyzeStepNum,
    'analyze',
    '検索結果を分析・統合中...'
  );
  analyzeStep = markRunning(analyzeStep, onStepUpdate);

  let analysis = '';
  try {
    const analyzeResult = await analyzeResults(
      input,
      allSearchResults,
      completedSteps
    );
    analysis = analyzeResult.analysis;
    const tokens = analyzeResult.response.usage?.total_tokens ?? 0;
    totalTokens += tokens;
    const cost = calculateCost(
      analyzeResult.response.usage?.prompt_tokens ?? 0,
      analyzeResult.response.usage?.completion_tokens ?? 0
    );
    totalCost += cost;

    analyzeStep = markCompleted(
      analyzeStep,
      analysis.slice(0, 500) + (analysis.length > 500 ? '...' : ''),
      analyzeResult.response,
      onStepUpdate
    );
    completedSteps.push(analyzeStep);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    analyzeStep = markError(
      analyzeStep,
      `分析エラー: ${message}`,
      onStepUpdate
    );
    completedSteps.push(analyzeStep);

    // Build a minimal analysis from raw search results so report can proceed
    analysis = allSearchResults
      .flatMap((sr) =>
        sr.results.map((r) => `${r.title}: ${r.snippet}`)
      )
      .join('\n');
  }

  // =========================================================================
  // Step N+2: Generate final report
  // =========================================================================
  const reportStepNum = analyzeStepNum + 1;
  let reportStep = createStep(
    reportStepNum,
    'report',
    '調査レポートを生成中...'
  );
  reportStep = markRunning(reportStep, onStepUpdate);

  let reportMarkdown = '';
  let reportTitle = `${input.topic} 調査レポート`;

  try {
    const reportResult = await generateReport(
      input,
      analysis,
      completedSteps
    );
    reportMarkdown = reportResult.markdown;
    reportTitle = reportResult.title;
    const tokens = reportResult.response.usage?.total_tokens ?? 0;
    totalTokens += tokens;
    const cost = calculateCost(
      reportResult.response.usage?.prompt_tokens ?? 0,
      reportResult.response.usage?.completion_tokens ?? 0
    );
    totalCost += cost;

    reportStep = markCompleted(
      reportStep,
      'レポート生成完了',
      reportResult.response,
      onStepUpdate
    );
    completedSteps.push(reportStep);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportStep = markError(
      reportStep,
      `レポート生成エラー: ${message}`,
      onStepUpdate
    );
    completedSteps.push(reportStep);

    // Provide a minimal fallback report
    reportMarkdown = [
      `# ${input.topic} 調査レポート`,
      '',
      '## エグゼクティブサマリー',
      'レポート生成中にエラーが発生しました。以下は収集された生データです。',
      '',
      '## 収集データ',
      analysis || '(データなし)',
    ].join('\n');
  }

  // =========================================================================
  // Assemble final result
  // =========================================================================
  const totalDuration = Date.now() - startTime;

  return {
    title: reportTitle,
    markdown: reportMarkdown,
    steps: completedSteps,
    totalCost,
    totalTokens,
    totalDuration,
  };
}
