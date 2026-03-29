import { useState, useEffect } from 'react';
import { Plus, Bot, Globe, FileText, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import type { ChatbotConfig, ChatbotStats } from '../../api/chatbot';
import { fetchChatbots, fetchChatbotStats } from '../../api/chatbot';

interface ChatbotListProps {
  onCreateNew: () => void;
  onSelect: (chatbot: ChatbotConfig) => void;
}

interface ChatbotWithStats extends ChatbotConfig {
  stats?: ChatbotStats;
}

export function ChatbotList({ onCreateNew, onSelect }: ChatbotListProps) {
  const [chatbots, setChatbots] = useState<ChatbotWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChatbots();
  }, []);

  async function loadChatbots() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchChatbots();
      // Load stats for each chatbot
      const withStats = await Promise.all(
        list.map(async (bot) => {
          try {
            const stats = await fetchChatbotStats(bot.id);
            return { ...bot, stats };
          } catch {
            return { ...bot };
          }
        })
      );
      setChatbots(withStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'チャットボット一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-status-fail/10 border border-status-fail/20 rounded-lg">
        <AlertCircle className="w-5 h-5 text-status-fail flex-shrink-0" />
        <p className="text-sm text-status-fail">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">チャットbot一覧</h2>
          <p className="text-sm text-text-muted mt-1">
            RAGチャットボットを作成し、Webサイトに埋め込むことができます
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          aria-label="新規チャットボットを作成"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      {chatbots.length === 0 ? (
        <div className="text-center py-20 border border-border rounded-lg bg-base-surface">
          <Bot className="w-12 h-12 text-text-muted mx-auto mb-4" strokeWidth={1} />
          <p className="text-text-muted text-sm">チャットボットがまだありません</p>
          <button
            onClick={onCreateNew}
            className="mt-4 text-sm text-blue-500 hover:text-blue-400 transition-colors"
          >
            最初のチャットボットを作成する
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {chatbots.map((bot) => (
            <button
              key={bot.id}
              onClick={() => onSelect(bot)}
              className="text-left p-5 border border-border rounded-lg bg-base-surface hover:border-blue-500/50 transition-colors group"
              aria-label={`${bot.name}の設定を開く`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-text-muted group-hover:text-blue-500 transition-colors" strokeWidth={1.5} />
                  <h3 className="font-medium text-text-primary truncate">{bot.name}</h3>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${
                    bot.is_published
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-zinc-500/10 text-text-muted border border-border'
                  }`}
                >
                  {bot.is_published ? '公開中' : '下書き'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  {bot.model}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  {bot.stats?.total_sessions ?? 0} セッション
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {bot.stats?.total_messages ?? 0} メッセージ
                </span>
              </div>

              {bot.system_prompt && (
                <p className="mt-3 text-xs text-text-muted line-clamp-2">
                  {bot.system_prompt}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
