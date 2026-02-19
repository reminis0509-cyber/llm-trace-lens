import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  onBack: () => void;
}

export function Playground({ onBack }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('gpt-4');
  const [provider, setProvider] = useState('openai');
  const [error, setError] = useState('');

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Get user's API key for the selected provider
      const { data: keyData, error: keyError } = await supabase
        .from('api_keys')
        .select('api_key')
        .eq('user_id', user?.id)
        .eq('provider', provider)
        .single();

      if (keyError || !keyData) {
        throw new Error(`No ${provider} API key found. Please add one in API Keys.`);
      }

      // Call the proxy endpoint
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keyData.api_key}`,
        },
        body: JSON.stringify({
          model,
          provider,
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content || 'No response';

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError('');
  };

  const models: Record<string, string[]> = {
    openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    gemini: ['gemini-pro', 'gemini-1.5-pro'],
    deepseek: ['deepseek-chat', 'deepseek-coder'],
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <h1 className="text-xl font-bold text-gray-900">Playground</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Provider Select */}
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setModel(models[e.target.value][0]);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Google Gemini</option>
              <option value="deepseek">DeepSeek</option>
            </select>

            {/* Model Select */}
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {models[provider].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <button
              onClick={clearChat}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Clear
            </button>
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Back
            </button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                Test your LLM API
              </h2>
              <p className="text-gray-500">
                Select a provider and model, then start chatting!
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
