import { useState, useEffect } from 'react';
import { Copy, Check, Trash2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ApiKey {
  id: string;
  provider: string;
  key_preview: string;
  created_at: string;
  last_used_at: string | null;
}

interface Props {
  onBack: () => void;
}

const PROVIDER_BORDER_STYLES: Record<string, string> = {
  openai: 'border-l-emerald-400',
  anthropic: 'border-l-amber-400',
  gemini: 'border-l-blue-400',
};

export function ApiKeys({ onBack }: Props) {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState('openai');
  const [newKey, setNewKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [proxyEndpoint, setProxyEndpoint] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadKeys();
    setProxyEndpoint(`${window.location.origin}/v1/chat/completions`);
  }, [user]);

  const loadKeys = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, provider, key_preview, created_at, last_used_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKeys(data || []);
    } catch (err) {
      console.error('Failed to load keys:', err);
    } finally {
      setLoading(false);
    }
  };

  const addKey = async () => {
    if (!user || !newKey.trim()) return;

    setSaving(true);
    setError('');

    try {
      const keyPreview = newKey.length > 12
        ? `${newKey.slice(0, 8)}...${newKey.slice(-4)}`
        : newKey;

      const { error } = await supabase.from('api_keys').insert({
        user_id: user.id,
        provider: newProvider,
        api_key: newKey,
        key_preview: keyPreview,
      });

      if (error) throw error;

      setNewKey('');
      setShowAddForm(false);
      loadKeys();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'キーの追加に失敗しました';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm('このAPIキーを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      loadKeys();
    } catch (err) {
      console.error('Failed to delete key:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const providers = [
    { value: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
    { value: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
    { value: 'gemini', label: 'Google Gemini', placeholder: 'AIza...' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Proxy Endpoint - flat card */}
      <div className="surface-card p-6">
        <div className="mb-4">
          <h2 className="text-base font-medium text-text-primary">プロキシエンドポイント</h2>
          <p className="text-sm text-text-muted mt-1">
            OpenAI APIのURLの代わりにこのエンドポイントを使用してください
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 terminal-block px-4 py-3 text-sm break-all">
            <span className="text-accent">{proxyEndpoint}</span>
          </div>
          <button
            onClick={() => copyToClipboard(proxyEndpoint)}
            className="p-3 text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
            title="クリップボードにコピー"
          >
            {copied ? (
              <Check className="w-4 h-4 text-status-pass" />
            ) : (
              <Copy className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {/* Usage Example */}
      <div className="surface-card p-6">
        <h3 className="text-sm text-text-secondary mb-4 label-spacing uppercase">クイックスタート</h3>
        <pre className="terminal-block p-4 overflow-x-auto text-sm">
          <code>
            <span className="text-text-muted">from</span> <span className="text-text-primary">openai</span> <span className="text-text-muted">import</span> <span className="text-text-primary">OpenAI</span>{'\n'}
{'\n'}
<span className="text-text-primary">client</span> <span className="text-text-muted">=</span> <span className="text-text-primary">OpenAI</span>({'\n'}
{'    '}<span className="text-text-secondary">api_key</span><span className="text-text-muted">=</span><span className="text-accent">"YOUR_OPENAI_KEY"</span>,{'\n'}
{'    '}<span className="text-text-secondary">base_url</span><span className="text-text-muted">=</span><span className="text-accent">"{window.location.origin}/v1"</span>{'\n'}
){'\n'}
{'\n'}
<span className="text-text-primary">response</span> <span className="text-text-muted">=</span> <span className="text-text-primary">client</span>.<span className="text-text-secondary">chat</span>.<span className="text-text-secondary">completions</span>.<span className="text-text-secondary">create</span>({'\n'}
{'    '}<span className="text-text-secondary">model</span><span className="text-text-muted">=</span><span className="text-accent">"gpt-4"</span>,{'\n'}
{'    '}<span className="text-text-secondary">messages</span><span className="text-text-muted">=</span>[{'{'}{"\"role\""}: <span className="text-accent">"user"</span>, {"\"content\""}: <span className="text-accent">"Hello!"</span>{'}'}]{'\n'}
)
          </code>
        </pre>
      </div>

      {/* API Keys List */}
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-medium text-text-primary">APIキー一覧</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            キーを追加
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-status-fail/10 border border-status-fail/30 text-status-fail rounded-card text-sm">
            {error}
          </div>
        )}

        {/* Add Key Form */}
        {showAddForm && (
          <div className="mb-6 p-4 bg-base-elevated rounded-card">
            <h3 className="text-sm font-medium text-text-primary mb-4">新しいAPIキーを追加</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-2 label-spacing uppercase">
                  プロバイダー
                </label>
                <select
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-base-elevated"
                >
                  {providers.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-2 label-spacing uppercase">
                  APIキー
                </label>
                <input
                  type="password"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={providers.find((p) => p.value === newProvider)?.placeholder}
                  className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-base-elevated"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addKey}
                  disabled={saving || !newKey.trim()}
                  className="px-4 py-2 bg-accent text-base rounded-card text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewKey('');
                    setError('');
                  }}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-base rounded-card transition-colors duration-120"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keys List - simple list with left border */}
        {loading ? (
          <div className="text-center py-8 text-text-muted text-sm">読み込み中...</div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-text-muted">APIキーがありません</p>
            <p className="text-xs text-text-muted mt-1">追加して開始しましょう</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className={`flex items-center justify-between p-4 bg-base rounded-card border-l-2 ${
                  PROVIDER_BORDER_STYLES[key.provider] || 'border-l-text-muted'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs text-text-muted capitalize">{key.provider}</span>
                  <span className="text-sm text-text-primary font-mono">
                    {key.key_preview}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-text-muted font-mono tabular-nums">
                    {new Date(key.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </span>
                  <button
                    onClick={() => deleteKey(key.id)}
                    className="p-2 text-text-muted hover:text-status-fail hover:bg-status-fail/10 rounded-card transition-colors duration-120"
                    title="キーを削除"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
