/**
 * fetchJson — 共通 API fetch helper for AI Employee v2 screens.
 *
 * 目的:
 *   - credentials: 'include' を既定にする
 *   - { success: true, data } 形式の envelope を自動 unwrap
 *   - 非 2xx は Error を throw (caller が catch してモック fallback などに使う)
 *
 * 方針: 既存の MorningBriefing / TaskBoard と互換な最小実装。
 * この helper は backend 並行実装中のモック fallback パターン専用で、
 * 既存 supabase.from(...) 経由の storage アクセスは対象外。
 */

export interface FetchJsonOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export function unwrapEnvelope(v: unknown): unknown {
  if (typeof v !== 'object' || v === null) return v;
  const o = v as Record<string, unknown>;
  if (o.success === true && 'data' in o) return o.data;
  return v;
}

export async function fetchJson(
  path: string,
  options: FetchJsonOptions = {},
): Promise<unknown> {
  const init: RequestInit = {
    method: options.method ?? 'GET',
    credentials: 'include',
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  };
  if (options.body !== undefined) {
    init.body = typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body);
  }
  const res = await fetch(path, init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const text = await res.text();
  if (!text) return null;
  try {
    const json: unknown = JSON.parse(text);
    return unwrapEnvelope(json);
  } catch {
    return text;
  }
}

/**
 * Type-guard helper: tests whether unknown value is a non-null record.
 */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
