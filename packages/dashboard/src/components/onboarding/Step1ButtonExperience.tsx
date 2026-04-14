/* ------------------------------------------------------------------ */
/*  Step1ButtonExperience — 30s button-AI experience                   */
/*                                                                     */
/*  Stage 1 (responsibility AI tools) hands-on trial:                  */
/*  minimal estimate form (client + 1 line item) that actually calls   */
/*  /api/tools/estimate/create-stream (with fallback to /create).      */
/*  No mocks. Result is rendered as plain text for simplicity.          */
/* ------------------------------------------------------------------ */

import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Props {
  onComplete: () => void;
}

interface EstimateResult {
  estimate_number?: string;
  subject?: string;
  client?: { company_name?: string; honorific?: string };
  items?: Array<{ name?: string; quantity?: number; unit_price?: number; subtotal?: number }>;
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  payment_terms?: string;
  delivery_date?: string;
}

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session) {
    if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    if (session.user) {
      headers['X-User-ID'] = session.user.id;
      headers['X-User-Email'] = session.user.email || '';
    }
  }
  return headers;
}

function formatYen(value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  return `¥${Number(value).toLocaleString('ja-JP')}`;
}

export function Step1ButtonExperience({ onComplete }: Props) {
  const [clientName, setClientName] = useState('');
  const [itemName, setItemName] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    clientName.trim().length > 0 &&
    itemName.trim().length > 0 &&
    unitPrice.trim().length > 0 &&
    !isRunning;

  const handleUnitPrice = (raw: string) => {
    setUnitPrice(raw.replace(/[^0-9]/g, ''));
  };

  const runGeneration = async () => {
    setError(null);
    setResult(null);
    setIsRunning(true);
    try {
      const headers = await buildAuthHeaders();
      const userMsg = [
        `宛先: ${clientName.trim()}`,
        `件名: オンボーディング体験見積`,
        ``,
        `明細:`,
        `- ${itemName.trim()}: 1個 × ¥${Number(unitPrice).toLocaleString('ja-JP')}`,
      ].join('\n');

      const body = JSON.stringify({
        conversation_history: [{ role: 'user', content: userMsg }],
        business_info_id: 'default',
      });

      // Try SSE streaming endpoint; fall back to non-streaming.
      let finalPayload: Record<string, unknown> | null = null;
      const streamRes = await fetch('/api/tools/estimate/create-stream', {
        method: 'POST',
        headers,
        body,
      });

      if (streamRes.ok && streamRes.body) {
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
                if (currentEvent === 'done') {
                  const d = data as { success?: boolean; data?: Record<string, unknown>; error?: string };
                  if (d.success && d.data) {
                    finalPayload = d.data;
                  } else if (d.error) {
                    setError(String(d.error));
                  }
                } else if (currentEvent === 'error') {
                  const d = data as { error?: string };
                  setError(String(d.error || '生成に失敗しました'));
                }
              } catch {
                /* ignore parse errors */
              }
              currentEvent = '';
            }
          }
        }
      } else {
        const res = await fetch('/api/tools/estimate/create', {
          method: 'POST',
          headers,
          body,
        });
        const json = await res.json() as { success?: boolean; data?: Record<string, unknown>; error?: string };
        if (json.success && json.data) {
          finalPayload = json.data;
        } else {
          setError(String(json.error || '生成に失敗しました'));
        }
      }

      if (finalPayload) {
        const estimate = (finalPayload.estimate as EstimateResult | undefined) ?? (finalPayload as EstimateResult);
        setResult(estimate || null);
      } else if (!error) {
        setError('AIからの応答が空でした。もう一度お試しください。');
      }
    } catch (err) {
      console.error('[onboarding/step1] generation failed:', err);
      setError('通信エラーが発生しました。ネットワーク接続をご確認ください。');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-slate-600 leading-relaxed">
          責任AIツールの中核である「見積書作成」を、実際に動かしてみましょう。最小限の入力で AI が見積書を組み立てます。
        </p>
      </div>

      {/* Minimal form */}
      <div className="space-y-3 p-4 rounded-lg border border-slate-200 bg-slate-50">
        <div>
          <label htmlFor="obd-client" className="block text-xs font-medium text-slate-700 mb-1">
            取引先名
          </label>
          <input
            id="obd-client"
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="株式会社サンプル"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="取引先名"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="obd-item" className="block text-xs font-medium text-slate-700 mb-1">
              品目
            </label>
            <input
              id="obd-item"
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Webサイト制作費"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="品目"
            />
          </div>
          <div>
            <label htmlFor="obd-price" className="block text-xs font-medium text-slate-700 mb-1">
              単価（円）
            </label>
            <input
              id="obd-price"
              type="text"
              inputMode="numeric"
              value={unitPrice}
              onChange={(e) => handleUnitPrice(e.target.value)}
              placeholder="300000"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
              aria-label="単価（円）"
            />
          </div>
        </div>
      </div>

      {/* Action / status */}
      {!result && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={runGeneration}
            disabled={!canSubmit}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? 'AIが作成中...' : 'AIで見積書を生成する'}
          </button>
          {isRunning && (
            <span className="inline-flex items-center gap-2 text-xs text-slate-500">
              <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              実運用のAPIを呼び出しています
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md border-l-2 border-red-500 bg-red-50 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="p-4 rounded-lg border border-slate-200 bg-white">
            <div className="text-xs font-medium text-slate-500 mb-2">AIが生成した見積書</div>
            <div className="space-y-1.5 text-sm text-slate-800">
              <div>
                <span className="text-slate-500">見積番号:</span> {result.estimate_number || '—'}
              </div>
              <div>
                <span className="text-slate-500">宛先:</span>{' '}
                {result.client?.company_name || clientName} {result.client?.honorific || '御中'}
              </div>
              <div>
                <span className="text-slate-500">件名:</span> {result.subject || '—'}
              </div>
              {result.items && result.items.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  {result.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{it.name}</span>
                      <span className="tabular-nums">{formatYen(it.subtotal ?? (it.unit_price ?? 0) * (it.quantity ?? 1))}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-2 border-t border-slate-100 flex justify-between">
                <span className="text-slate-500">小計</span>
                <span className="tabular-nums">{formatYen(result.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">消費税</span>
                <span className="tabular-nums">{formatYen(result.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-slate-900">
                <span>合計</span>
                <span className="tabular-nums">{formatYen(result.total)}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            これがステージ1「責任AIツール」の基本動作です。ボタン1つでAIが書類を組み立て、最終確認は必ず人間が行います。
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors"
            >
              次へ進む
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
