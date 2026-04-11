/* ------------------------------------------------------------------ */
/*  AiClerkChat — Dashboard AI clerk chat interface (Redesigned)       */
/*  Inspired by ChatGPT / DeepSeek / Copilot, adapted for JP B2B      */
/* ------------------------------------------------------------------ */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Settings2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ToolCallData {
  toolName: string;
  matchType: 'exact' | 'adapted';
  adaptedFrom?: string;
  result: unknown;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCall?: ToolCallData;
  featureRequestLogged?: boolean;
  timestamp: Date;
}

interface TrialInfo {
  used: number;
  limit: number;
  remaining: number;
  isTrialExhausted: boolean;
}

interface ApiResponse {
  success: boolean;
  data: {
    conversation_id: string;
    reply: string;
    tool_call?: {
      tool_name: string;
      match_type: 'exact' | 'adapted';
      adapted_from?: string;
      result: unknown;
    };
    feature_request_logged?: boolean;
    trace_id?: string;
    trialInfo?: TrialInfo;
  };
  error?: string;
}

interface CompanyInfo {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  representative: string;
  invoiceNumber: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_INPUT_LENGTH = 2000;
const STORAGE_KEY = 'fujitrace-company-info';

const SUGGESTION_CHIPS = [
  { label: '\u898b\u7a4d\u66f8\u3092\u4f5c\u6210\u3057\u3066', icon: '\u{1f4dd}' },
  { label: '\u8acb\u6c42\u66f8\u3092\u30c1\u30a7\u30c3\u30af\u3057\u3066', icon: '\u{1f50d}' },
  { label: '\u5951\u7d04\u66f8\u3092\u78ba\u8a8d\u3057\u3066', icon: '\u{1f4c4}' },
  { label: '\u7d4c\u8cbb\u3092\u7cbe\u7b97\u3057\u3066', icon: '\u{1f4b0}' },
];

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (session) {
    if (session.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    if (session.user) {
      headers['X-User-ID'] = session.user.id;
      headers['X-User-Email'] = session.user.email || '';
    }
  }

  return headers;
}

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */

function loadCompanyInfo(): CompanyInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CompanyInfo;
  } catch { /* ignore */ }
  return { companyName: '', address: '', phone: '', email: '', representative: '', invoiceNumber: '' };
}

function saveCompanyInfo(info: CompanyInfo): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
}

function hasCompanyInfo(info: CompanyInfo): boolean {
  return !!(info.companyName || info.address || info.phone || info.email);
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ------------------------------------------------------------------ */
/*  Tool result display                                                */
/* ------------------------------------------------------------------ */

function ToolResult({ toolName, matchType, adaptedFrom, result }: {
  toolName: string;
  matchType: 'exact' | 'adapted';
  adaptedFrom?: string;
  result: unknown;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 border border-border rounded-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-secondary bg-base-elevated hover:bg-base transition-colors"
        aria-expanded={expanded}
      >
        <span className="font-medium">
          {toolName}
          {matchType === 'adapted' && adaptedFrom && (
            <span className="ml-1 text-text-muted">({adaptedFrom})</span>
          )}
        </span>
        <span>{expanded ? '-' : '+'}</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 text-xs font-mono text-text-secondary bg-base overflow-x-auto max-h-48 overflow-y-auto">
          <pre className="whitespace-pre-wrap break-words">
            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Company Info Modal                                                 */
/* ------------------------------------------------------------------ */

function CompanyInfoModal({ info, onSave, onClose }: {
  info: CompanyInfo;
  onSave: (info: CompanyInfo) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CompanyInfo>(info);

  const fields: { key: keyof CompanyInfo; label: string; placeholder: string }[] = [
    { key: 'companyName', label: '\u4f1a\u793e\u540d', placeholder: '\u682a\u5f0f\u4f1a\u793e\u25cb\u25cb' },
    { key: 'address', label: '\u4f4f\u6240', placeholder: '\u6771\u4eac\u90fd\u6e2f\u533a...' },
    { key: 'phone', label: '\u96fb\u8a71\u756a\u53f7', placeholder: '03-XXXX-XXXX' },
    { key: 'email', label: '\u30e1\u30fc\u30eb', placeholder: 'info@example.co.jp' },
    { key: 'representative', label: '\u4ee3\u8868\u8005\u540d', placeholder: '\u5c71\u7530 \u592a\u90ce' },
    { key: 'invoiceNumber', label: '\u30a4\u30f3\u30dc\u30a4\u30b9\u767b\u9332\u756a\u53f7', placeholder: 'T1234567890123' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary">
            会社基本情報
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary rounded transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
        <p className="text-xs text-text-secondary mb-4">
          設定した情報は見積書や請求書の作成時に自動で使用されます
        </p>
        <div className="space-y-3">
          {fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                {label}
              </label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-text-secondary border border-border rounded-card hover:bg-base-elevated transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => { onSave(form); onClose(); }}
            className="flex-1 px-4 py-2 text-sm text-white bg-accent rounded-card hover:bg-accent/90 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Message component                                                  */
/* ------------------------------------------------------------------ */

function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] ${
          isUser
            ? 'bg-accent text-white rounded-2xl rounded-br-sm px-4 py-2.5'
            : 'bg-base-surface rounded-2xl rounded-bl-sm px-4 py-3'
        }`}
      >
        <p className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${
          isUser ? 'text-white' : 'text-text-primary'
        }`}>
          {message.content}
        </p>

        {message.toolCall && (
          <ToolResult
            toolName={message.toolCall.toolName}
            matchType={message.toolCall.matchType}
            adaptedFrom={message.toolCall.adaptedFrom}
            result={message.toolCall.result}
          />
        )}

        {message.featureRequestLogged && (
          <div className="mt-2 bg-base-elevated border border-border rounded-card p-3 text-sm text-text-secondary">
            ご要望を記録しました。FujiTraceチームが対応を検討します。
          </div>
        )}

        <p
          className={`text-[10px] mt-1.5 ${
            isUser ? 'text-white/60 text-right' : 'text-text-muted'
          }`}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AiClerkChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(loadCompanyInfo);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSeenCompanySetup, setHasSeenCompanySetup] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-open company info modal on mount if company info is empty
  useEffect(() => {
    if (!hasCompanyInfo(companyInfo) && !hasSeenCompanySetup) {
      setShowCompanyModal(true);
      setHasSeenCompanySetup(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  // Fetch trial status
  const fetchTrialStatus = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/agent/trial-status', { headers });
      if (res.ok) {
        const body = (await res.json()) as {
          success: boolean;
          data: { trialInfo: TrialInfo; isAdmin?: boolean };
        };
        if (body.success && body.data?.trialInfo) {
          setTrialInfo(body.data.trialInfo);
          if (body.data.isAdmin) setIsAdmin(true);
        }
      }
    } catch {
      // Silent fail -- trial badge is non-critical
    }
  }, []);

  useEffect(() => {
    fetchTrialStatus();
  }, [fetchTrialStatus]);

  // Handle ?setup=success return from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('setup') === 'success') {
      setError(null);
      setSetupSuccess(true);
      window.history.replaceState({}, '', window.location.pathname);
      fetchTrialStatus();
      const timer = setTimeout(() => setSetupSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [fetchTrialStatus]);

  // Redirect to Stripe Checkout for payment method registration
  const handleSetupPayment = useCallback(async () => {
    setIsSettingUp(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/billing/agent-setup', {
        method: 'POST',
        headers,
      });
      const body = (await res.json()) as {
        setupUrl?: string;
        error?: string;
      };
      if (body.setupUrl) {
        window.location.href = body.setupUrl;
      } else {
        setError(body.error || 'お支払い方法の登録に失敗しました。');
      }
    } catch {
      setError('お支払い方法の登録に失敗しました。');
    } finally {
      setIsSettingUp(false);
    }
  }, []);

  // Save company info
  const handleSaveCompanyInfo = useCallback((info: CompanyInfo) => {
    setCompanyInfo(info);
    saveCompanyInfo(info);
  }, []);

  // Send message
  const handleSend = useCallback(async (text?: string) => {
    if (!hasCompanyInfo(companyInfo)) {
      setShowCompanyModal(true);
      return;
    }

    const trimmed = (text || input).trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setError(null);
    setIsLoading(true);
    setIsProcessing(true);

    try {
      const headers = await getAuthHeaders();

      // Build message with company info context if available
      let messageContent = trimmed;
      const ci = companyInfo;
      if (hasCompanyInfo(ci)) {
        const parts: string[] = [];
        if (ci.companyName) parts.push(`会社名: ${ci.companyName}`);
        if (ci.address) parts.push(`住所: ${ci.address}`);
        if (ci.phone) parts.push(`電話: ${ci.phone}`);
        if (ci.email) parts.push(`メール: ${ci.email}`);
        if (ci.representative) parts.push(`代表者: ${ci.representative}`);
        if (ci.invoiceNumber) parts.push(`インボイス登録番号: ${ci.invoiceNumber}`);
        messageContent = `[会社情報]\n${parts.join('\n')}\n\n[依頼]\n${trimmed}`;
      }

      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...(conversationId ? { conversation_id: conversationId } : {}),
          message: messageContent,
        }),
      });

      if (!res.ok) {
        setIsProcessing(false);
        if (res.status === 401) {
          setError('認証エラーが発生しました。再ログインしてください。');
          return;
        }
        if (res.status === 402) {
          const errBody = (await res.json().catch(() => null)) as {
            error?: string;
            trialInfo?: TrialInfo;
          } | null;
          if (errBody?.trialInfo) setTrialInfo(errBody.trialInfo);
          setError(errBody?.error ?? '無料トライアルが終了しました。');
          return;
        }
        if (res.status === 403) {
          setError('AI事務員はProプランの機能です。');
          return;
        }
        const errBody = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(errBody?.error ?? `エラーが発生しました (${res.status})`);
        return;
      }

      const body = (await res.json()) as ApiResponse;

      if (!body.success || !body.data) {
        setIsProcessing(false);
        setError(body.error ?? 'レスポンスの形式が不正です。');
        return;
      }

      const { data } = body;
      setConversationId(data.conversation_id);
      if (data.trialInfo) setTrialInfo(data.trialInfo);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply,
        toolCall: data.tool_call
          ? {
              toolName: data.tool_call.tool_name,
              matchType: data.tool_call.match_type,
              adaptedFrom: data.tool_call.adapted_from,
              result: data.tool_call.result,
            }
          : undefined,
        featureRequestLogged: data.feature_request_logged,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      setIsProcessing(false);
    } catch {
      setIsProcessing(false);
      setError('通信エラーが発生しました。ネットワーク接続を確認してください。');
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [input, isLoading, conversationId, companyInfo]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const isWelcome = messages.length === 0;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px - 5rem)' }}>
      {/* Company info modal */}
      {showCompanyModal && (
        <CompanyInfoModal
          info={companyInfo}
          onSave={handleSaveCompanyInfo}
          onClose={() => setShowCompanyModal(false)}
        />
      )}

      {/* Payment setup success message */}
      {setupSuccess && (
        <div className="flex-shrink-0 mb-2">
          <span className="text-xs text-status-pass bg-status-pass/10 px-2 py-1 rounded-card">
            お支払い方法の登録が完了しました
          </span>
        </div>
      )}

      {/* Trial status badge */}
      {trialInfo && !isAdmin && trialInfo.remaining === 0 && (
        <div className="flex-shrink-0 mb-3 flex flex-col items-center gap-2">
          <span className="text-xs text-status-fail">
            無料トライアル（{trialInfo.limit}回）が終了しました
          </span>
          <button
            type="button"
            onClick={handleSetupPayment}
            disabled={isSettingUp}
            className="text-sm text-white bg-accent hover:bg-accent/90 px-4 py-2 rounded-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="お支払い方法を登録する"
          >
            {isSettingUp ? '処理中...' : 'お支払い方法を登録する'}
          </button>
        </div>
      )}

      {/* Messages area — centered like ChatGPT */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-3xl mx-auto px-4">
          {isWelcome ? (
            /* Welcome screen */
            <div className="flex flex-col items-center justify-center h-full pt-16 sm:pt-24">
              <img
                src="/dashboard/mascot-idle.gif"
                alt=""
                className="w-16 h-16 sm:w-20 sm:h-20"
                style={{ imageRendering: 'pixelated' }}
                aria-hidden="true"
              />
              <h2 className="mt-4 text-xl font-semibold text-text-primary">
                FujiTrace AI 事務員
              </h2>
              <p className="mt-2 text-sm text-text-secondary text-center max-w-sm">
                {hasCompanyInfo(companyInfo)
                  ? '事務作業をお手伝いします。下のボタンから始めるか、自由に入力してください。'
                  : '事務作業をお手伝いします。まずは会社情報を設定してから、下のボタンで始めるか自由に入力してください。'}
              </p>

              {/* Trial remaining badge */}
              {trialInfo && !isAdmin && trialInfo.remaining > 0 && (
                <span className={`mt-3 text-xs px-2 py-1 rounded-card ${
                  trialInfo.remaining === 1
                    ? 'text-status-warn bg-status-warn/10'
                    : 'text-text-secondary bg-base-elevated'
                }`}>
                  お試し: 残り{trialInfo.remaining}回
                </span>
              )}

              {/* Suggestion chips */}
              <div className="flex flex-wrap justify-center gap-2 mt-8">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleSend(chip.label)}
                    disabled={isLoading}
                    className="px-4 py-2.5 text-sm text-text-secondary bg-white border border-border rounded-full hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat messages */
            <div className="flex flex-col gap-4 py-6">
              {messages.map((msg) => (
                <Message key={msg.id} message={msg} />
              ))}

              {/* Loading indicator with running mascot */}
              {isLoading && (
                <div className="flex justify-start items-end gap-2">
                  <img
                    src="/dashboard/mascot-run.gif"
                    alt=""
                    className="w-10 h-10"
                    style={{
                      imageRendering: 'pixelated' as const,
                      animation: 'mascot-run 0.3s ease-in-out infinite alternate',
                    }}
                    aria-hidden="true"
                  />
                  <div className="bg-base-surface rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom input area */}
      <div className="flex-shrink-0 border-t border-border bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {/* Suggestion chips (after messages) */}
          {!isWelcome && !isLoading && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleSend(chip.label)}
                  className="px-3 py-1 text-xs text-text-secondary bg-base-elevated border border-border-subtle rounded-full hover:border-accent hover:text-accent transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">
            {/* Company info button */}
            <button
              type="button"
              onClick={() => setShowCompanyModal(true)}
              className={`flex-shrink-0 p-2 rounded-card transition-colors ${
                hasCompanyInfo(companyInfo)
                  ? 'text-accent hover:bg-accent-dim'
                  : 'text-text-muted hover:text-text-secondary hover:bg-base-elevated'
              }`}
              title="会社基本情報を設定"
              aria-label="会社基本情報を設定"
            >
              <Settings2 className="w-5 h-5" strokeWidth={1.5} />
            </button>

            {/* Textarea */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value.slice(0, MAX_INPUT_LENGTH));
                  adjustTextarea();
                }}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力..."
                disabled={isLoading}
                rows={1}
                className="w-full px-4 py-2.5 border border-border rounded-xl text-sm text-text-primary placeholder-text-muted bg-base-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden"
                style={{ minHeight: '42px', maxHeight: '160px' }}
                aria-label="メッセージ入力"
              />
            </div>

            {/* Send button */}
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="flex-shrink-0 p-2.5 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="送信"
            >
              <Send className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Error message */}
          {error && (
            <p className="mt-2 text-sm text-status-fail text-center" role="alert">
              {error}
            </p>
          )}

          {/* Trial remaining (inline, when messages exist) */}
          {!isWelcome && trialInfo && !isAdmin && trialInfo.remaining > 0 && (
            <p className="mt-1.5 text-[10px] text-text-muted text-center">
              お試し: 残り{trialInfo.remaining}回
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
