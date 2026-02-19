import { useState, useEffect } from 'react';
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
      // Create preview (first 8 and last 4 chars)
      const keyPreview = newKey.length > 12
        ? `${newKey.slice(0, 8)}...${newKey.slice(-4)}`
        : newKey;

      const { error } = await supabase.from('api_keys').insert({
        user_id: user.id,
        provider: newProvider,
        api_key: newKey, // Will be encrypted by Supabase RLS or trigger
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
  };

  const providers = [
    { value: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
    { value: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
    { value: 'gemini', label: 'Google Gemini', placeholder: 'AIza...' },
    { value: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔑</span>
            <h1 className="text-xl font-bold text-gray-900">API Keys</h1>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Proxy Endpoint */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white">
          <h2 className="text-lg font-semibold mb-2">Your Proxy Endpoint</h2>
          <p className="text-blue-100 text-sm mb-4">
            Use this endpoint instead of the OpenAI API URL
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={proxyEndpoint}
              readOnly
              className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white font-mono text-sm"
            />
            <button
              onClick={() => copyToClipboard(proxyEndpoint)}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Usage Example */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Start</h3>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your API Keys</h2>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              + Add Key
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Add Key Form */}
          {showAddForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-medium mb-3">Add New API Key</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provider
                  </label>
                  <select
                    value={newProvider}
                    onChange={(e) => setNewProvider(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {providers.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder={providers.find((p) => p.value === newProvider)?.placeholder}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addKey}
                    disabled={saving || !newKey.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
                  >
                    {saving ? 'Saving...' : 'Save Key'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewKey('');
                      setError('');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Keys List */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🔐</div>
              <p className="text-gray-500">No API keys yet. Add one to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{key.provider}</span>
                      <span className="text-gray-500 font-mono text-sm">
                        {key.key_preview}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Added {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at && (
                        <> • Last used {new Date(key.last_used_at).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteKey(key.id)}
                    className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
