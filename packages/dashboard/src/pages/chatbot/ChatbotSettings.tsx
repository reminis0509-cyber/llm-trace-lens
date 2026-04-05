import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft, Save, Loader2, AlertCircle, Check, Upload, Trash2,
  FileText, MessageSquare, BarChart3, Code, Settings, Palette,
  Copy, Eye, EyeOff, ChevronDown, ChevronRight, Globe, Link, RefreshCw,
} from 'lucide-react';
import type {
  ChatbotConfig, ChatbotDocument, ChatSession, ChatMessage, ChatbotStats, CrawlStatus,
} from '../../api/chatbot';
import {
  fetchChatbot, updateChatbot, deleteChatbot as deleteChatbotApi, publishChatbot,
  uploadDocument, fetchDocuments, deleteDocument,
  fetchSessions, fetchSessionMessages, fetchChatbotStats,
  startCrawl, fetchCrawlStatus, deleteCrawlData,
} from '../../api/chatbot';

interface ChatbotSettingsProps {
  chatbotId: string;
  onBack: () => void;
  onDeleted: () => void;
}

type SettingsTab = 'basic' | 'design' | 'documents' | 'sessions' | 'analytics' | 'embed';

const settingsTabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'basic', label: '基本設定', icon: <Settings className="w-4 h-4" /> },
  { id: 'design', label: 'デザイン', icon: <Palette className="w-4 h-4" /> },
  { id: 'documents', label: 'ドキュメント', icon: <FileText className="w-4 h-4" /> },
  { id: 'sessions', label: '会話履歴', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'analytics', label: '分析', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'embed', label: '埋め込み', icon: <Code className="w-4 h-4" /> },
];

export function ChatbotSettings({ chatbotId, onBack, onDeleted }: ChatbotSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic');
  const [chatbot, setChatbot] = useState<ChatbotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChatbot();
  }, [chatbotId]);

  async function loadChatbot() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChatbot(chatbotId);
      setChatbot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'チャットボットの取得に失敗しました');
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

  if (error || !chatbot) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary">
          <ArrowLeft className="w-4 h-4" /> 一覧に戻る
        </button>
        <div className="flex items-center gap-3 p-4 bg-status-fail/10 border border-status-fail/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-status-fail flex-shrink-0" />
          <p className="text-sm text-status-fail">{error || 'チャットボットが見つかりません'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-base-elevated rounded-lg transition-colors"
          aria-label="一覧に戻る"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{chatbot.name}</h2>
          <p className="text-xs text-text-muted">ID: {chatbot.id}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {settingsTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'basic' && (
        <BasicSettings chatbot={chatbot} onUpdate={setChatbot} onDelete={onDeleted} />
      )}
      {activeTab === 'design' && (
        <DesignSettings chatbot={chatbot} onUpdate={setChatbot} />
      )}
      {activeTab === 'documents' && (
        <DocumentsSection chatbotId={chatbot.id} />
      )}
      {activeTab === 'sessions' && (
        <SessionsSection chatbotId={chatbot.id} />
      )}
      {activeTab === 'analytics' && (
        <AnalyticsSection chatbotId={chatbot.id} />
      )}
      {activeTab === 'embed' && (
        <EmbedSection chatbot={chatbot} onUpdate={setChatbot} />
      )}
    </div>
  );
}

// ---- Basic Settings ----

function BasicSettings({
  chatbot,
  onUpdate,
  onDelete,
}: {
  chatbot: ChatbotConfig;
  onUpdate: (c: ChatbotConfig) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(chatbot.name || '');
  const [systemPrompt, setSystemPrompt] = useState(chatbot.system_prompt || '');
  const [tone, setTone] = useState(chatbot.tone || 'polite');
  const [model, setModel] = useState(chatbot.model || 'gpt-4o-mini');
  const [temperature, setTemperature] = useState(chatbot.temperature ?? 0.3);
  const [maxTokens, setMaxTokens] = useState(chatbot.max_tokens ?? 1024);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateChatbot(chatbot.id, {
        name: name.trim(),
        system_prompt: systemPrompt.trim() || null,
        tone,
        model,
        temperature,
        max_tokens: maxTokens,
      });
      onUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteChatbotApi(chatbot.id);
      onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {error && (
        <div className="flex items-center gap-3 p-3 bg-status-fail/10 border border-status-fail/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-status-fail flex-shrink-0" />
          <p className="text-sm text-status-fail">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="settings-name" className="block text-sm font-medium text-text-primary mb-1.5">名前</label>
        <input
          id="settings-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
        />
      </div>

      <div>
        <label htmlFor="settings-prompt" className="block text-sm font-medium text-text-primary mb-1.5">システムプロンプト</label>
        <textarea
          id="settings-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="settings-tone" className="block text-sm font-medium text-text-primary mb-1.5">トーン</label>
          <select
            id="settings-tone"
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
          <label htmlFor="settings-model" className="block text-sm font-medium text-text-primary mb-1.5">モデル</label>
          <select
            id="settings-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          >
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
            <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
          </select>
        </div>

        <div>
          <label htmlFor="settings-temp" className="block text-sm font-medium text-text-primary mb-1.5">
            Temperature ({temperature.toFixed(1)})
          </label>
          <input
            id="settings-temp"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full mt-2"
          />
        </div>
      </div>

      <div className="max-w-xs">
        <label htmlFor="settings-max-tokens" className="block text-sm font-medium text-text-primary mb-1.5">最大トークン数</label>
        <input
          id="settings-max-tokens"
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(Number(e.target.value))}
          min={1}
          max={128000}
          className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? '保存しました' : '保存'}
        </button>
      </div>

      {/* Danger zone */}
      <div className="pt-6 mt-6 border-t border-border">
        <h3 className="text-sm font-medium text-status-fail mb-2">危険な操作</h3>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm text-status-fail border border-status-fail/30 rounded-lg hover:bg-status-fail/10 transition-colors"
          >
            チャットボットを削除
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-text-muted">本当に削除しますか？この操作は元に戻せません。</p>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-status-fail text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              削除する
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Design Settings ----

const BORDER_RADIUS_OPTIONS: { value: ChatbotConfig['widget_border_radius']; label: string }[] = [
  { value: 'sharp', label: 'シャープ' },
  { value: 'rounded', label: 'ラウンド' },
  { value: 'pill', label: 'ピル' },
];

const FONT_OPTIONS: { value: ChatbotConfig['widget_font']; label: string }[] = [
  { value: 'system', label: 'システム標準' },
  { value: 'noto-sans-jp', label: 'Noto Sans JP' },
  { value: 'hiragino', label: 'ヒラギノ' },
];

const BUBBLE_ICON_OPTIONS: { value: ChatbotConfig['widget_bubble_icon']; label: string }[] = [
  { value: 'chat', label: 'チャット' },
  { value: 'question', label: '質問' },
  { value: 'headset', label: 'ヘッドセット' },
  { value: 'custom', label: 'カスタム' },
];

const WINDOW_SIZE_OPTIONS: { value: ChatbotConfig['widget_window_size']; label: string }[] = [
  { value: 'compact', label: 'コンパクト' },
  { value: 'standard', label: '標準' },
  { value: 'large', label: '大きめ' },
];

const WINDOW_SIZE_MAP: Record<string, { width: number; height: number }> = {
  compact: { width: 320, height: 440 },
  standard: { width: 380, height: 520 },
  large: { width: 420, height: 600 },
};

const BORDER_RADIUS_MAP: Record<string, { main: string; sm: string }> = {
  sharp: { main: '4px', sm: '2px' },
  rounded: { main: '16px', sm: '12px' },
  pill: { main: '24px', sm: '20px' },
};

const FONT_MAP: Record<string, string> = {
  system: "system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif",
  'noto-sans-jp': "'Noto Sans JP', sans-serif",
  hiragino: "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif",
};

// SVG icons for bubble preview
const BUBBLE_SVGS: Record<string, string> = {
  chat: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z',
  question: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z',
  headset: 'M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z',
};

function DesignSettings({
  chatbot,
  onUpdate,
}: {
  chatbot: ChatbotConfig;
  onUpdate: (c: ChatbotConfig) => void;
}) {
  const [widgetColor, setWidgetColor] = useState(chatbot.widget_color || '#2563eb');
  const [secondaryColor, setSecondaryColor] = useState(chatbot.widget_secondary_color || '#f3f4f6');
  const [widgetPosition, setWidgetPosition] = useState(chatbot.widget_position || 'bottom-right');
  const [widgetLogoUrl, setWidgetLogoUrl] = useState(chatbot.widget_logo_url || '');
  const [welcomeMessage, setWelcomeMessage] = useState(chatbot.welcome_message || '');
  const [borderRadius, setBorderRadius] = useState<ChatbotConfig['widget_border_radius']>(chatbot.widget_border_radius || 'rounded');
  const [headerText, setHeaderText] = useState(chatbot.widget_header_text || '');
  const [font, setFont] = useState<ChatbotConfig['widget_font']>(chatbot.widget_font || 'system');
  const [bubbleIcon, setBubbleIcon] = useState<ChatbotConfig['widget_bubble_icon']>(chatbot.widget_bubble_icon || 'chat');
  const [bubbleIconUrl, setBubbleIconUrl] = useState(chatbot.widget_bubble_icon_url || '');
  const [windowSize, setWindowSize] = useState<ChatbotConfig['widget_window_size']>(chatbot.widget_window_size || 'standard');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewWindowSize = useMemo(() => WINDOW_SIZE_MAP[windowSize] || WINDOW_SIZE_MAP.standard, [windowSize]);
  const previewRadius = useMemo(() => BORDER_RADIUS_MAP[borderRadius] || BORDER_RADIUS_MAP.rounded, [borderRadius]);
  const previewFont = useMemo(() => FONT_MAP[font] || FONT_MAP.system, [font]);
  const displayTitle = headerText.trim() || chatbot.name;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateChatbot(chatbot.id, {
        widget_color: widgetColor,
        widget_secondary_color: secondaryColor,
        widget_position: widgetPosition,
        widget_logo_url: widgetLogoUrl.trim() || null,
        welcome_message: welcomeMessage.trim() || null,
        widget_border_radius: borderRadius,
        widget_header_text: headerText.trim() || null,
        widget_font: font,
        widget_bubble_icon: bubbleIcon,
        widget_bubble_icon_url: bubbleIconUrl.trim() || null,
        widget_window_size: windowSize,
      });
      onUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-3 p-3 bg-status-fail/10 border border-status-fail/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-status-fail flex-shrink-0" />
          <p className="text-sm text-status-fail">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Controls */}
        <div className="space-y-5">
          {/* Primary Color */}
          <div>
            <label htmlFor="design-color" className="block text-sm font-medium text-text-primary mb-1.5">プライマリーカラー</label>
            <div className="flex items-center gap-3">
              <input
                id="design-color"
                type="color"
                value={widgetColor}
                onChange={(e) => setWidgetColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <input
                type="text"
                value={widgetColor}
                onChange={(e) => setWidgetColor(e.target.value)}
                className="w-32 px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                aria-label="プライマリーカラーコード"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div>
            <label htmlFor="design-secondary-color" className="block text-sm font-medium text-text-primary mb-1.5">セカンダリーカラー</label>
            <div className="flex items-center gap-3">
              <input
                id="design-secondary-color"
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-32 px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                aria-label="セカンダリーカラーコード"
              />
            </div>
          </div>

          {/* Border Radius */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">角の丸み</label>
            <div className="flex gap-2">
              {BORDER_RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBorderRadius(opt.value)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    borderRadius === opt.value
                      ? 'border-blue-500 bg-blue-500/10 text-text-primary'
                      : 'border-border text-text-muted hover:text-text-primary hover:bg-base-elevated'
                  }`}
                  aria-pressed={borderRadius === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Header Text */}
          <div>
            <label htmlFor="design-header-text" className="block text-sm font-medium text-text-primary mb-1.5">ヘッダーテキスト</label>
            <input
              id="design-header-text"
              type="text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder={chatbot.name}
              className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-text-muted">空欄の場合、チャットボット名が表示されます</p>
          </div>

          {/* Font */}
          <div>
            <label htmlFor="design-font" className="block text-sm font-medium text-text-primary mb-1.5">フォント</label>
            <select
              id="design-font"
              value={font}
              onChange={(e) => setFont(e.target.value as ChatbotConfig['widget_font'])}
              className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            >
              {FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Bubble Icon */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">バブルアイコン</label>
            <div className="flex gap-2 flex-wrap">
              {BUBBLE_ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBubbleIcon(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    bubbleIcon === opt.value
                      ? 'border-blue-500 bg-blue-500/10 text-text-primary'
                      : 'border-border text-text-muted hover:text-text-primary hover:bg-base-elevated'
                  }`}
                  aria-pressed={bubbleIcon === opt.value}
                >
                  {opt.value !== 'custom' && (
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                      <path d={BUBBLE_SVGS[opt.value]} />
                    </svg>
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
            {bubbleIcon === 'custom' && (
              <input
                type="url"
                value={bubbleIconUrl}
                onChange={(e) => setBubbleIconUrl(e.target.value)}
                placeholder="https://example.com/icon.svg"
                className="mt-2 w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                aria-label="カスタムアイコンURL"
              />
            )}
          </div>

          {/* Window Size */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">ウィンドウサイズ</label>
            <div className="flex gap-2">
              {WINDOW_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setWindowSize(opt.value)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    windowSize === opt.value
                      ? 'border-blue-500 bg-blue-500/10 text-text-primary'
                      : 'border-border text-text-muted hover:text-text-primary hover:bg-base-elevated'
                  }`}
                  aria-pressed={windowSize === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Position */}
          <div>
            <label htmlFor="design-position" className="block text-sm font-medium text-text-primary mb-1.5">表示位置</label>
            <select
              id="design-position"
              value={widgetPosition}
              onChange={(e) => setWidgetPosition(e.target.value)}
              className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            >
              <option value="bottom-right">右下</option>
              <option value="bottom-left">左下</option>
            </select>
          </div>

          {/* Logo URL */}
          <div>
            <label htmlFor="design-logo" className="block text-sm font-medium text-text-primary mb-1.5">ロゴURL</label>
            <input
              id="design-logo"
              type="url"
              value={widgetLogoUrl}
              onChange={(e) => setWidgetLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
          </div>

          {/* Welcome Message */}
          <div>
            <label htmlFor="design-welcome" className="block text-sm font-medium text-text-primary mb-1.5">ウェルカムメッセージ</label>
            <textarea
              id="design-welcome"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={2}
              placeholder="例: こんにちは！何かお手伝いできることはありますか？"
              className="w-full px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
            />
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? '保存しました' : '保存'}
            </button>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">プレビュー</p>
          <div className="bg-base-elevated border border-border rounded-lg p-6 min-h-[500px] flex items-end justify-end relative">
            {/* Preview Widget Window */}
            <div
              className="absolute bottom-20 right-6 flex flex-col overflow-hidden"
              style={{
                width: `${Math.min(previewWindowSize.width, 320)}px`,
                height: `${Math.min(previewWindowSize.height, 420)}px`,
                borderRadius: previewRadius.main,
                boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
                border: '1px solid var(--color-border, #e5e7eb)',
                fontFamily: previewFont,
                fontSize: '13px',
                lineHeight: '1.7',
                transform: 'scale(0.85)',
                transformOrigin: 'bottom right',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 text-white flex-shrink-0"
                style={{ backgroundColor: widgetColor }}
              >
                {widgetLogoUrl ? (
                  <img
                    src={widgetLogoUrl}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.2)' }}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }} />
                )}
                <span className="text-sm font-semibold truncate flex-1">{displayTitle}</span>
              </div>
              {/* Messages area */}
              <div className="flex-1 bg-white p-3 space-y-2 overflow-hidden">
                {welcomeMessage && (
                  <div
                    className="text-xs px-3 py-2 max-w-[85%]"
                    style={{
                      backgroundColor: secondaryColor,
                      borderRadius: previewRadius.sm,
                      color: '#1a1a2e',
                    }}
                  >
                    {welcomeMessage}
                  </div>
                )}
                <div
                  className="text-xs px-3 py-2 max-w-[85%] ml-auto text-white"
                  style={{
                    backgroundColor: widgetColor,
                    borderRadius: previewRadius.sm,
                  }}
                >
                  こんにちは
                </div>
                <div
                  className="text-xs px-3 py-2 max-w-[85%]"
                  style={{
                    backgroundColor: secondaryColor,
                    borderRadius: previewRadius.sm,
                    color: '#1a1a2e',
                  }}
                >
                  ご質問をお気軽にどうぞ。
                </div>
              </div>
              {/* Input area */}
              <div className="flex items-center gap-2 px-3 py-2 border-t bg-white flex-shrink-0" style={{ borderColor: '#e5e7eb' }}>
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-400">
                  メッセージを入力...
                </div>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: widgetColor }}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </div>
              </div>
              {/* Powered by */}
              <div className="text-center py-1 bg-white text-[10px] text-gray-400 flex-shrink-0">
                Powered by FujiTrace
              </div>
            </div>

            {/* Bubble preview */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer flex-shrink-0"
              style={{ backgroundColor: widgetColor }}
              aria-label="チャットウィジェットプレビュー"
            >
              {bubbleIcon === 'custom' && bubbleIconUrl ? (
                <img src={bubbleIconUrl} alt="" className="w-6 h-6 object-contain" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                  <path d={BUBBLE_SVGS[bubbleIcon] || BUBBLE_SVGS.chat} />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Documents Section ----

function DocumentsSection({ chatbotId }: { chatbotId: string }) {
  const [documents, setDocuments] = useState<ChatbotDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crawl state
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus | null>(null);
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const crawlPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadDocuments();
    loadCrawlStatus();
    return () => {
      if (crawlPollRef.current) clearInterval(crawlPollRef.current);
    };
  }, [chatbotId]);

  // Poll crawl status when active
  useEffect(() => {
    if (crawlPollRef.current) clearInterval(crawlPollRef.current);

    if (crawlStatus && (crawlStatus.crawl_status === 'pending' || crawlStatus.crawl_status === 'crawling')) {
      crawlPollRef.current = setInterval(async () => {
        try {
          const status = await fetchCrawlStatus(chatbotId);
          setCrawlStatus(status);
          if (status.crawl_status !== 'pending' && status.crawl_status !== 'crawling') {
            if (crawlPollRef.current) clearInterval(crawlPollRef.current);
            // Reload documents after crawl completes
            loadDocuments();
          }
        } catch {
          // Ignore polling errors
        }
      }, 2000);
    }

    return () => {
      if (crawlPollRef.current) clearInterval(crawlPollRef.current);
    };
  }, [crawlStatus?.crawl_status, chatbotId]);

  async function loadCrawlStatus() {
    try {
      const status = await fetchCrawlStatus(chatbotId);
      setCrawlStatus(status);
      if (status.crawl_status !== 'idle') {
        setCrawlUrl('');
      }
    } catch {
      // No crawl data yet
    }
  }

  async function handleStartCrawl() {
    if (!crawlUrl.trim()) return;
    setCrawlLoading(true);
    setCrawlError(null);
    try {
      await startCrawl(chatbotId, crawlUrl.trim());
      setCrawlStatus({
        crawl_status: 'pending',
        crawl_progress: 0,
        crawl_error: null,
        crawled_at: null,
      });
    } catch (err) {
      setCrawlError(err instanceof Error ? err.message : 'クロールの開始に失敗しました');
    } finally {
      setCrawlLoading(false);
    }
  }

  async function handleReCrawl() {
    setCrawlLoading(true);
    setCrawlError(null);
    try {
      // Use existing URL or prompt for new one
      const url = crawlUrl.trim() || crawlStatus?.current_url || '';
      if (!url) {
        setCrawlError('URLを入力してください');
        setCrawlLoading(false);
        return;
      }
      await startCrawl(chatbotId, url);
      setCrawlStatus({
        crawl_status: 'pending',
        crawl_progress: 0,
        crawl_error: null,
        crawled_at: null,
      });
    } catch (err) {
      setCrawlError(err instanceof Error ? err.message : '再クロールに失敗しました');
    } finally {
      setCrawlLoading(false);
    }
  }

  async function handleDeleteCrawl() {
    setCrawlLoading(true);
    setCrawlError(null);
    try {
      await deleteCrawlData(chatbotId);
      setCrawlStatus(null);
      setCrawlUrl('');
      await loadDocuments();
    } catch (err) {
      setCrawlError(err instanceof Error ? err.message : 'クロールデータの削除に失敗しました');
    } finally {
      setCrawlLoading(false);
    }
  }

  async function loadDocuments() {
    setLoading(true);
    setError(null);
    try {
      const docs = await fetchDocuments(chatbotId);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ドキュメントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadDocument(chatbotId, files[i]);
      }
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDoc(docId: string) {
    try {
      await deleteDocument(chatbotId, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }, [chatbotId]);

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const statusBadge = (status: ChatbotDocument['status']) => {
    switch (status) {
      case 'ready':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">完了</span>;
      case 'processing':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">処理中</span>;
      case 'error':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-status-fail/10 text-status-fail border border-status-fail/20">エラー</span>;
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-3 p-3 bg-status-fail/10 border border-status-fail/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-status-fail flex-shrink-0" />
          <p className="text-sm text-status-fail">{error}</p>
        </div>
      )}

      {/* Crawl Section */}
      <div className="border border-border rounded-lg p-5 space-y-4 bg-base-surface">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-medium text-text-primary">Webサイトからの自動学習</h3>
        </div>

        {crawlError && (
          <div className="flex items-center gap-3 p-3 bg-status-fail/10 border border-status-fail/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-status-fail flex-shrink-0" />
            <p className="text-sm text-status-fail">{crawlError}</p>
          </div>
        )}

        {/* Crawl in progress */}
        {crawlStatus && (crawlStatus.crawl_status === 'pending' || crawlStatus.crawl_status === 'crawling') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="text-sm text-text-primary">
                {crawlStatus.crawl_status === 'pending' ? 'クロール準備中...' : 'クロール中...'}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-base-elevated rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(crawlStatus.crawl_progress * 100, 2)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>
                {crawlStatus.pages_processed !== undefined && crawlStatus.pages_found !== undefined
                  ? `${crawlStatus.pages_processed} / ${crawlStatus.pages_found} ページ処理済み`
                  : `進捗: ${Math.round(crawlStatus.crawl_progress * 100)}%`}
              </span>
              {crawlStatus.current_url && (
                <span className="truncate max-w-[300px]" title={crawlStatus.current_url}>
                  {crawlStatus.current_url}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Crawl completed */}
        {crawlStatus && crawlStatus.crawl_status === 'completed' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-emerald-600">
                クロール完了
                {crawlStatus.pages_processed !== undefined && ` (${crawlStatus.pages_processed}ページ)`}
              </span>
            </div>
            {crawlStatus.crawled_at && (
              <p className="text-xs text-text-muted">
                最終クロール: {new Date(crawlStatus.crawled_at).toLocaleString('ja-JP')}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleReCrawl}
                disabled={crawlLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-base-elevated transition-colors text-text-muted hover:text-text-primary disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                再クロール
              </button>
              <button
                onClick={handleDeleteCrawl}
                disabled={crawlLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-status-fail/30 rounded-lg hover:bg-status-fail/10 transition-colors text-status-fail disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                クロールデータ削除
              </button>
            </div>
          </div>
        )}

        {/* Crawl error */}
        {crawlStatus && crawlStatus.crawl_status === 'error' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-status-fail" />
              <span className="text-sm text-status-fail">
                クロールエラー: {crawlStatus.crawl_error || '不明なエラーが発生しました'}
              </span>
            </div>
            <button
              onClick={handleReCrawl}
              disabled={crawlLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-base-elevated transition-colors text-text-muted hover:text-text-primary disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              再試行
            </button>
          </div>
        )}

        {/* Crawl idle / input */}
        {(!crawlStatus || crawlStatus.crawl_status === 'idle') && (
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={crawlUrl}
              onChange={(e) => setCrawlUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-3 py-2 bg-base-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              aria-label="クロール対象URL"
            />
            <button
              onClick={handleStartCrawl}
              disabled={crawlLoading || !crawlUrl.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {crawlLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              クロール開始
            </button>
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-border hover:border-blue-500/50 hover:bg-base-elevated'
        }`}
        role="button"
        aria-label="ファイルをドラッグ&ドロップまたはクリックしてアップロード"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
          accept=".pdf,.txt,.md,.csv,.json,.docx"
        />
        {uploading ? (
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
        ) : (
          <Upload className="w-8 h-8 text-text-muted mx-auto mb-2" />
        )}
        <p className="text-sm text-text-primary">
          {uploading ? 'アップロード中...' : 'ファイルをドラッグ&ドロップ'}
        </p>
        <p className="text-xs text-text-muted mt-1">
          PDF, TXT, Markdown, CSV, JSON, DOCX に対応
        </p>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">
          ドキュメントがまだアップロードされていません
        </p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                {doc.file_type === 'crawl' ? (
                  <Link className="w-4 h-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-text-muted flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{doc.filename}</p>
                  <p className="text-xs text-text-muted">
                    {formatFileSize(doc.file_size)} / {doc.chunk_count} チャンク
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {statusBadge(doc.status)}
                {doc.error_message && (
                  <span className="text-xs text-status-fail max-w-[200px] truncate" title={doc.error_message}>
                    {doc.error_message}
                  </span>
                )}
                <button
                  onClick={() => handleDeleteDoc(doc.id)}
                  className="p-1.5 text-text-muted hover:text-status-fail hover:bg-status-fail/10 rounded transition-colors"
                  aria-label={`${doc.filename}を削除`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Sessions Section ----

function SessionsSection({ chatbotId }: { chatbotId: string }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [chatbotId]);

  async function loadSessions() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSessions(chatbotId);
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'セッションの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function toggleSession(sessionId: string) {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setMessages([]);
      return;
    }
    setExpandedSessionId(sessionId);
    setMessagesLoading(true);
    try {
      const msgs = await fetchSessionMessages(chatbotId, sessionId);
      setMessages(msgs);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-3 bg-status-fail/10 border border-status-fail/20 rounded-lg">
        <AlertCircle className="w-4 h-4 text-status-fail flex-shrink-0" />
        <p className="text-sm text-status-fail">{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-text-muted text-center py-12">会話履歴がまだありません</p>;
  }

  return (
    <div className="border border-border rounded-lg divide-y divide-border">
      {sessions.map((session) => (
        <div key={session.id}>
          <button
            onClick={() => toggleSession(session.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-base-elevated transition-colors"
            aria-expanded={expandedSessionId === session.id}
          >
            <div className="flex items-center gap-3">
              {expandedSessionId === session.id ? (
                <ChevronDown className="w-4 h-4 text-text-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-text-muted" />
              )}
              <div>
                <p className="text-sm text-text-primary">
                  {session.visitor_id ? `訪問者: ${session.visitor_id.slice(0, 8)}...` : 'ゲスト'}
                </p>
                <p className="text-xs text-text-muted">
                  {formatDate(session.started_at)} / {session.message_count} メッセージ
                </p>
              </div>
            </div>
          </button>
          {expandedSessionId === session.id && (
            <div className="px-4 pb-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 text-text-muted animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-xs text-text-muted py-4">メッセージがありません</p>
              ) : (
                <div className="space-y-2 ml-7">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg text-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-500/10 text-text-primary ml-8'
                          : 'bg-base-elevated text-text-primary mr-8'
                      }`}
                    >
                      <p className="text-xs text-text-muted mb-1">
                        {msg.role === 'user' ? 'ユーザー' : 'アシスタント'}
                        {msg.trace_id && (
                          <span className="ml-2 font-mono text-blue-500">trace:{msg.trace_id.slice(0, 8)}</span>
                        )}
                      </p>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Analytics Section ----

function AnalyticsSection({ chatbotId }: { chatbotId: string }) {
  const [stats, setStats] = useState<ChatbotStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, [chatbotId]);

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChatbotStats(chatbotId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '統計データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-3 bg-status-fail/10 border border-status-fail/20 rounded-lg">
        <AlertCircle className="w-4 h-4 text-status-fail flex-shrink-0" />
        <p className="text-sm text-status-fail">{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { label: '累計セッション数', value: stats.total_sessions.toLocaleString() },
    { label: '累計メッセージ数', value: stats.total_messages.toLocaleString() },
    { label: '本日のメッセージ数', value: stats.today_messages.toLocaleString() },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {statCards.map((card) => (
        <div key={card.label} className="p-5 border border-border rounded-lg bg-base-surface">
          <p className="text-xs text-text-muted mb-1">{card.label}</p>
          <p className="text-2xl font-semibold text-text-primary">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

// ---- Embed Section ----

function EmbedSection({
  chatbot,
  onUpdate,
}: {
  chatbot: ChatbotConfig;
  onUpdate: (c: ChatbotConfig) => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const [embedScript, setEmbedScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    try {
      const result = await publishChatbot(chatbot.id);
      setEmbedScript(result.embedScript);
      onUpdate({ ...chatbot, is_published: true, publish_key: result.publishKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : '公開に失敗しました');
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    setPublishing(true);
    setError(null);
    try {
      await updateChatbot(chatbot.id, { is_published: false });
      onUpdate({ ...chatbot, is_published: false });
      setEmbedScript(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '非公開に失敗しました');
    } finally {
      setPublishing(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const defaultEmbed = chatbot.publish_key
    ? `<script src="${window.location.origin}/widget.js" data-chatbot-key="${chatbot.publish_key}"></script>`
    : null;

  const scriptToShow = embedScript || defaultEmbed;

  return (
    <div className="max-w-2xl space-y-5">
      {error && (
        <div className="flex items-center gap-3 p-3 bg-status-fail/10 border border-status-fail/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-status-fail flex-shrink-0" />
          <p className="text-sm text-status-fail">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-base-surface">
        <div className="flex items-center gap-3">
          {chatbot.is_published ? (
            <Eye className="w-5 h-5 text-emerald-500" />
          ) : (
            <EyeOff className="w-5 h-5 text-text-muted" />
          )}
          <div>
            <p className="text-sm font-medium text-text-primary">
              {chatbot.is_published ? '公開中' : '非公開'}
            </p>
            <p className="text-xs text-text-muted">
              {chatbot.is_published
                ? '埋め込みスクリプトを使用してWebサイトに追加できます'
                : '公開するとWebサイトに埋め込み可能になります'}
            </p>
          </div>
        </div>
        <button
          onClick={chatbot.is_published ? handleUnpublish : handlePublish}
          disabled={publishing}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            chatbot.is_published
              ? 'bg-zinc-600 text-white hover:bg-zinc-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50`}
        >
          {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
          {chatbot.is_published ? '非公開にする' : '公開する'}
        </button>
      </div>

      {scriptToShow && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-text-primary">埋め込みコード</p>
            <button
              onClick={() => handleCopy(scriptToShow)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border rounded-lg hover:bg-base-elevated transition-colors"
              aria-label="コードをコピー"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'コピーしました' : 'コピー'}
            </button>
          </div>
          <pre className="p-4 bg-base-elevated border border-border rounded-lg text-xs text-text-primary font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {scriptToShow}
          </pre>
          <p className="mt-2 text-xs text-text-muted">
            上記のコードをWebサイトの{'<body>'}タグの閉じタグの直前に貼り付けてください。
          </p>
        </div>
      )}

      {chatbot.publish_key && (
        <div>
          <p className="text-sm font-medium text-text-primary mb-1.5">公開キー</p>
          <code className="block px-3 py-2 bg-base-elevated border border-border rounded-lg text-xs text-text-muted font-mono">
            {chatbot.publish_key}
          </code>
        </div>
      )}
    </div>
  );
}
