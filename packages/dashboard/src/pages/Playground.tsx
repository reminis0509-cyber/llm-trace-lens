import { useState } from 'react';
import { Send, Trash2, MessageSquare } from 'lucide-react';
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
  const [model, setModel] = useState('gpt-4o-mini');
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
      const { data: keyData, error: keyError } = await supabase
        .from('api_keys')
        .select('api_key')
        .eq('user_id', user?.id)
        .eq('provider', provider)
        .single();

      if (keyError || !keyData) {
        throw new Error(`No ${provider} API key found. Please add one in API Keys.`);
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
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo-0125'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
    deepseek: ['deepseek-chat', 'deepseek-coder'],
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-4 p-4 glass-card">
        <div className="flex items-center gap-4">
          {/* Provider Select */}
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setModel(models[e.target.value][0]);
            }}
            className="px-4 py-2 bg-navy-800 border border-navy-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan"
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
            className="px-4 py-2 bg-navy-800 border border-navy-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan font-mono text-sm"
          >
            {models[provider].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={clearChat}
          className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-gray-200 hover:bg-navy-700 rounded-lg transition"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto glass-card p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-navy-700 flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-gray-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-200 mb-2">
                Test your LLM API
              </h2>
              <p className="text-gray-400">
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
                    ? 'bg-navy-700 text-gray-100'
                    : 'gradient-border text-gray-100'
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-navy-800 border border-navy-600 px-4 py-3 rounded-2xl">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-bounce [animation-delay:0.1s]" />
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="mt-4 p-4 glass-card">
        <div className="max-w-3xl mx-auto flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-4 py-3 bg-navy-800 border border-navy-600 rounded-xl text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan resize-none transition"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-accent-cyan text-navy-900 rounded-xl font-medium hover:bg-accent-cyan-dim disabled:bg-navy-600 disabled:text-gray-500 disabled:cursor-not-allowed transition flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
