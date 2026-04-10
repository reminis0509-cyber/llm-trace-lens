import { useState } from 'react';
import { Zap, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface TestResult {
  success: boolean;
  latencyMs: number;
  response?: string;
  model?: string;
  error?: string;
}

interface Props {
  onBack: () => void;
}

export function Playground({ onBack }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('gpt-4o-mini');
  const [provider, setProvider] = useState('openai');
  const [result, setResult] = useState<TestResult | null>(null);

  const testApi = async () => {
    if (loading) return;
    setResult(null);
    setLoading(true);

    const start = performance.now();

    try {
      const { data: keyData, error: keyError } = await supabase
        .from('api_keys')
        .select('api_key')
        .eq('user_id', user?.id)
        .eq('provider', provider)
        .single();

      if (keyError || !keyData) {
        throw new Error(`${provider}のAPIキーが見つかりません。APIキーページで追加してください。`);
      }

      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          provider,
          api_key: keyData.api_key,
          messages: [
            { role: 'user', content: 'Hello, this is a connection test. Reply with a short greeting.' },
          ],
        }),
      });

      const latencyMs = Math.round(performance.now() - start);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `APIエラー: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content || 'レスポンスなし';

      setResult({
        success: true,
        latencyMs,
        response: assistantMessage,
        model: data.model || model,
      });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      setResult({
        success: false,
        latencyMs,
        error: err instanceof Error ? err.message : '接続に失敗しました',
      });
    } finally {
      setLoading(false);
    }
  };

  const models: Record<string, string[]> = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo-0125'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
  };

  return (
    <div className="flex flex-col min-h-[400px]">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-3 sm:p-4 surface-card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setModel(models[e.target.value][0]);
            }}
            className="px-3 sm:px-4 py-2 bg-base-elevated border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-accent/50 focus:border-accent text-sm"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Google Gemini</option>
          </select>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="px-3 sm:px-4 py-2 bg-base-elevated border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-accent/50 focus:border-accent font-mono text-xs sm:text-sm"
          >
            {models[provider].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center surface-card">
        <div className="max-w-lg w-full mx-auto px-4 text-center">
          {!result && !loading && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-base-elevated flex items-center justify-center">
                <Zap className="w-10 h-10 text-text-muted" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                API接続テスト
              </h2>
              <p className="text-text-secondary mb-8">
                プロバイダーとモデルを選択して、API接続をテストします。
              </p>
              <button
                onClick={testApi}
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-base-surface rounded-lg font-medium hover:bg-accent/80 transition text-sm sm:text-base"
              >
                <Zap className="w-5 h-5" />
                API をテストする
              </button>
            </>
          )}

          {loading && (
            <div className="py-16">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-accent animate-spin" />
              <p className="text-text-secondary">{provider}に接続テスト中...</p>
            </div>
          )}

          {result && !loading && (
            <div className="text-left space-y-4">
              {/* Status Header */}
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                result.success
                  ? 'bg-status-pass/10 border-status-pass/30'
                  : 'bg-status-fail/10 border-status-fail/30'
              }`}>
                {result.success ? (
                  <CheckCircle className="w-6 h-6 text-status-pass flex-shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-status-fail flex-shrink-0" />
                )}
                <div>
                  <p className={`font-semibold ${result.success ? 'text-status-pass' : 'text-status-fail'}`}>
                    {result.success ? '接続成功' : '接続失敗'}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {provider} / {result.model || model}
                  </p>
                </div>
              </div>

              {/* Latency */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-base-elevated border border-border">
                <Clock className="w-5 h-5 text-text-secondary flex-shrink-0" />
                <div>
                  <p className="text-sm text-text-secondary">レスポンスタイム</p>
                  <p className="text-text-primary font-mono">{result.latencyMs} ms</p>
                </div>
              </div>

              {/* Response or Error */}
              {result.success && result.response && (
                <div className="p-4 rounded-lg bg-base-elevated border border-border">
                  <p className="text-sm text-text-secondary mb-2">レスポンス</p>
                  <p className="text-text-primary text-sm">{result.response}</p>
                </div>
              )}

              {!result.success && result.error && (
                <div className="p-4 rounded-lg bg-status-fail/10 border border-status-fail/30">
                  <p className="text-sm text-status-fail font-medium mb-1">エラー</p>
                  <p className="text-text-primary text-sm">{result.error}</p>
                </div>
              )}

              {/* Retry Button */}
              <button
                onClick={testApi}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent text-base-surface rounded-lg font-medium hover:bg-accent/80 transition text-sm sm:text-base"
              >
                <Zap className="w-5 h-5" />
                再テスト
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
