import { useState, useEffect } from 'react';
import { Key, Copy, Check, Trash2, Plus, Lock } from 'lucide-react';
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to add key';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

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
    { value: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...' },
  ];

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'openai': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
      case 'anthropic': return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
      case 'gemini': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'deepseek': return 'text-purple-400 bg-purple-400/10 border-purple-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Proxy Endpoint */}
      <div className="gradient-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
            <Key className="w-5 h-5 text-accent-cyan" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Your Proxy Endpoint</h2>
            <p className="text-sm text-gray-400">
              Use this endpoint instead of the OpenAI API URL
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 terminal-block px-4 py-3 text-accent-cyan">
            {proxyEndpoint}
          </div>
          <button
            onClick={() => copyToClipboard(proxyEndpoint)}
            className="px-4 py-2 bg-navy-700 border border-navy-600 rounded-lg hover:bg-navy-600 transition flex items-center justify-center"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-5 h-5 text-status-pass" />
            ) : (
              <Copy className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Usage Example */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Quick Start</h3>
        <pre className="terminal-block p-4 overflow-x-auto text-gray-300">
{`from openai import OpenAI

client = OpenAI(
    api_key="YOUR_OPENAI_KEY",  # or use key from below
    base_url="${window.location.origin}/v1"
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)`}
        </pre>
      </div>

      {/* API Keys List */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-100">Your API Keys</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 border border-accent-cyan text-accent-cyan rounded-lg font-medium hover:bg-accent-cyan/10 transition"
          >
            <Plus className="w-4 h-4" />
            Add Key
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Add Key Form */}
        {showAddForm && (
          <div className="mb-6 p-4 bg-navy-800 rounded-lg border border-navy-600">
            <h3 className="font-medium text-gray-100 mb-3">Add New API Key</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Provider
                </label>
                <select
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value)}
                  className="w-full px-4 py-2 bg-navy-900 border border-navy-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan"
                >
                  {providers.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={providers.find((p) => p.value === newProvider)?.placeholder}
                  className="w-full px-4 py-2 bg-navy-900 border border-navy-600 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addKey}
                  disabled={saving || !newKey.trim()}
                  className="px-4 py-2 bg-accent-cyan text-navy-900 rounded-lg font-medium hover:bg-accent-cyan-dim disabled:bg-navy-600 disabled:text-gray-400 transition"
                >
                  {saving ? 'Saving...' : 'Save Key'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewKey('');
                    setError('');
                  }}
                  className="px-4 py-2 bg-navy-700 text-gray-300 rounded-lg font-medium hover:bg-navy-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keys List */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-navy-700 flex items-center justify-center">
              <Lock className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400">No API keys yet. Add one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 bg-navy-800 rounded-lg border border-navy-700 hover:border-navy-600 transition"
              >
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full border capitalize ${getProviderColor(key.provider)}`}>
                    {key.provider}
                  </span>
                  <span className="text-gray-300 font-mono text-sm">
                    {key.key_preview}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500">
                    Added {new Date(key.created_at).toLocaleDateString()}
                    {key.last_used_at && (
                      <span className="ml-2">
                        Last used {new Date(key.last_used_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteKey(key.id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                    title="Delete key"
                  >
                    <Trash2 className="w-4 h-4" />
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
