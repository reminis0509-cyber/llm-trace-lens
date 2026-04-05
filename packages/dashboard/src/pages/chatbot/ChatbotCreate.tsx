import { useState } from 'react';
import { ArrowLeft, Loader2, AlertCircle, Globe } from 'lucide-react';
import { createChatbot, startCrawl } from '../../api/chatbot';
import type { ChatbotConfig, CreateChatbotData } from '../../api/chatbot';

interface ChatbotCreateProps {
  onBack: () => void;
  onCreated: (chatbot: ChatbotConfig) => void;
}

export function ChatbotCreate({ onBack, onCreated }: ChatbotCreateProps) {
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [tone, setTone] = useState<'polite' | 'casual' | 'business'>('polite');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const data: CreateChatbotData = {
        name: name.trim(),
        tone,
      };
      if (systemPrompt.trim()) data.system_prompt = systemPrompt.trim();
      if (welcomeMessage.trim()) data.welcome_message = welcomeMessage.trim();

      const chatbot = await createChatbot(data);

      // Start crawl if URL provided
      if (crawlUrl.trim()) {
        try {
          await startCrawl(chatbot.id, crawlUrl.trim());
        } catch {
          // Crawl failure is non-blocking; user can retry in settings
        }
      }

      onCreated(chatbot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'チャットボットの作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-base-elevated rounded-lg transition-colors"
          aria-label="一覧に戻る"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">新規チャットbot作成</h2>
          <p className="text-sm text-text-muted mt-0.5">基本情報を入力してチャットボットを作成します</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-status-fail/10 border border-status-fail/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-status-fail flex-shrink-0" />
          <p className="text-sm text-status-fail">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="chatbot-name" className="block text-sm font-medium text-text-primary mb-1.5">
            名前 <span className="text-status-fail">*</span>
          </label>
          <input
            id="chatbot-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: カスタマーサポートbot"
            required
            className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="chatbot-system-prompt" className="block text-sm font-medium text-text-primary mb-1.5">
            システムプロンプト
          </label>
          <textarea
            id="chatbot-system-prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="チャットボットの振る舞いを指示するプロンプトを入力..."
            rows={5}
            className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
          />
          <p className="mt-1 text-xs text-text-muted">省略した場合、デフォルトのプロンプトが使用されます</p>
        </div>

        <div>
          <label htmlFor="chatbot-tone" className="block text-sm font-medium text-text-primary mb-1.5">
            トーン
          </label>
          <select
            id="chatbot-tone"
            value={tone}
            onChange={(e) => setTone(e.target.value as 'polite' | 'casual' | 'business')}
            className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          >
            <option value="polite">丁寧語</option>
            <option value="casual">カジュアル</option>
            <option value="business">ビジネス</option>
          </select>
        </div>

        <div>
          <label htmlFor="chatbot-welcome" className="block text-sm font-medium text-text-primary mb-1.5">
            ウェルカムメッセージ
          </label>
          <textarea
            id="chatbot-welcome"
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="例: こんにちは！何かお手伝いできることはありますか？"
            rows={2}
            className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
          />
        </div>

        {/* HP Auto-Learning */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-text-muted" />
            <label htmlFor="chatbot-crawl-url" className="text-sm font-medium text-text-primary">
              HPから自動学習（オプション）
            </label>
          </div>
          <p className="text-xs text-text-muted">
            URLを入力すると、Webサイトのコンテンツを自動的に取得して学習します
          </p>
          <input
            id="chatbot-crawl-url"
            type="url"
            value={crawlUrl}
            onChange={(e) => setCrawlUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            作成
          </button>
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
