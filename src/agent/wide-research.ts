/**
 * agent/wide-research.ts — Manus "Wide Research" mode.
 *
 * Unlike the Contract-β office-task runtime (which is strictly bounded to
 * whitelisted document tools), Wide Research is an open-ended research
 * agent that:
 *   - Runs up to MAX_ITER=20 tool calls
 *   - Has a 600-second wall-clock timeout
 *   - Can use `web_search` and `web_fetch` primitives
 *   - Writes a structured report to task_timeline when it finishes
 *
 * Implementation note: we do NOT reuse the Contract-β runtime — that
 * enforces the 8-tool whitelist by design. Instead this module provides a
 * small loop + SSE generator of its own. The whitelist is loosened to the
 * wide-research toolset but is still a closed set (never the LLM's choice
 * of arbitrary HTTP).
 */
import { randomBytes, randomUUID } from 'crypto';
import { webSearch, type SearchResult } from './web-search.js';
import { getKnex } from '../storage/knex-client.js';
import { assertPublicUrl } from '../lib/url-safety.js';

export const WIDE_RESEARCH_MAX_ITER = 20;
export const WIDE_RESEARCH_TIMEOUT_MS = 600_000;
export const WIDE_RESEARCH_FETCH_TIMEOUT_MS = 30_000;

export type WideResearchSseEvent =
  | { type: 'run_started'; runId: string }
  | { type: 'search_start'; query: string }
  | { type: 'search_result'; query: string; results: SearchResult[] }
  | { type: 'fetch_start'; url: string }
  | { type: 'fetch_result'; url: string; status: number; excerpt: string }
  | { type: 'final'; report: WideResearchReport }
  | { type: 'error'; code: 'TIMEOUT' | 'INTERNAL' | 'INVALID_INPUT'; message: string };

export interface WideResearchReport {
  query: string;
  sources: WideResearchSource[];
  summary: string;
}

export interface WideResearchSource {
  title: string;
  url: string;
  snippet: string;
  excerpt?: string;
  fetchedAt: string;
}

export interface WideResearchInput {
  query: string;
  sources?: string[]; // optional caller-supplied URLs
  userId: string;
  workspaceId?: string | null;
  projectId?: string | null;
}

async function fetchExcerpt(url: string): Promise<{ status: number; excerpt: string }> {
  // SSRF guard — reject private / loopback / non-http targets before any
  // socket activity. The excerpt is surfaced in the SSE `fetch_result` event
  // so the caller has visibility into why a URL was skipped.
  try {
    assertPublicUrl(url);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'blocked';
    return { status: 0, excerpt: `[blocked: private or non-http url] ${reason}` };
  }

  // Per-fetch wall-clock ceiling (S-04 mitigation). The outer generator
  // still has its own 600 s budget; this just stops a single slow host
  // from burning all of it.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WIDE_RESEARCH_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FujiTraceBot/1.0)',
        Accept: 'text/html,text/plain;q=0.9,*/*;q=0.1',
      },
      signal: controller.signal,
    });
    const buf = await res.arrayBuffer();
    const text = Buffer.from(buf)
      .toString('utf8')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { status: res.status, excerpt: text.slice(0, 500) };
  } catch (err) {
    return { status: 0, excerpt: err instanceof Error ? err.message : 'fetch error' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run a wide-research pass and yield SSE events. The yielded `final` event
 * carries the canonical `WideResearchReport`.
 */
export async function* runWideResearch(
  input: WideResearchInput,
): AsyncGenerator<WideResearchSseEvent, void, void> {
  if (!input.query || input.query.length < 2) {
    yield { type: 'error', code: 'INVALID_INPUT', message: 'query is required' };
    return;
  }

  const runId = randomUUID();
  const deadline = Date.now() + WIDE_RESEARCH_TIMEOUT_MS;
  yield { type: 'run_started', runId };

  const sources: WideResearchSource[] = [];
  let iterations = 0;

  // Pre-vet caller-supplied source URLs so SSRF-blocked entries are dropped
  // before we count them against MAX_ITER. DuckDuckGo-returned URLs are
  // vetted inside fetchExcerpt so we can preserve a record of why they
  // were skipped in the SSE stream.
  const vettedUserSources = (input.sources ?? []).filter((u) => {
    try {
      assertPublicUrl(u);
      return true;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'blocked';
      // eslint-disable-next-line no-console -- best-effort visibility
      console.log(`[wide-research] dropped caller URL: ${u} (${reason})`);
      return false;
    }
  });

  // ── Web search phase ───────────────────────────────────────────────
  try {
    yield { type: 'search_start', query: input.query };
    const results = await webSearch(input.query, 10);
    iterations++;
    yield { type: 'search_result', query: input.query, results };

    const candidates = [
      ...results.slice(0, 5).map((r) => r.url),
      ...vettedUserSources.slice(0, 5),
    ];

    for (const url of candidates) {
      if (iterations >= WIDE_RESEARCH_MAX_ITER) break;
      if (Date.now() > deadline) {
        yield { type: 'error', code: 'TIMEOUT', message: 'wide-research timeout (600s)' };
        return;
      }
      iterations++;
      yield { type: 'fetch_start', url };
      const { status, excerpt } = await fetchExcerpt(url);
      yield { type: 'fetch_result', url, status, excerpt };
      const matched = results.find((r) => r.url === url);
      sources.push({
        title: matched?.title ?? url,
        url,
        snippet: matched?.snippet ?? '',
        excerpt,
        fetchedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    yield {
      type: 'error',
      code: 'INTERNAL',
      message: err instanceof Error ? err.message : 'wide-research error',
    };
    return;
  }

  const report: WideResearchReport = {
    query: input.query,
    sources,
    summary: `${sources.length} 件のソースから情報を収集しました。`,
  };

  // Persist to task_timeline so Kanban / briefing can surface it.
  try {
    const db = getKnex();
    await db('task_timeline').insert({
      id: randomBytes(16).toString('hex'),
      user_id: input.userId,
      task_type: 'wide_research',
      title: `Wide Research: ${input.query}`.slice(0, 200),
      status: 'done',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      result_ref: runId,
      connector_refs: JSON.stringify({ report }),
      project_id: input.projectId ?? null,
      workspace_id: input.workspaceId ?? null,
    });
  } catch {
    // Best-effort; don't fail the generator on persistence issues.
  }

  yield { type: 'final', report };
}
