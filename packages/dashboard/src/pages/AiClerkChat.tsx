/* ------------------------------------------------------------------ */
/*  AiClerkChat — Dashboard AI clerk chat interface                    */
/* ------------------------------------------------------------------ */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'initial',
  role: 'assistant',
  content:
    'お仕事のご依頼をどうぞ。\n見積書の作成、請求書のチェックなど、事務作業をお手伝いします。',
  timestamp: new Date(),
};

const MAX_INPUT_LENGTH = 2000;

/* ------------------------------------------------------------------ */
/*  Tool result display                                                */
/* ------------------------------------------------------------------ */

interface ToolResultProps {
  toolName: string;
  matchType: 'exact' | 'adapted';
  adaptedFrom?: string;
  result: unknown;
}

function ToolResult({ toolName, matchType, adaptedFrom, result }: ToolResultProps) {
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
/*  Message bubble                                                     */
/* ------------------------------------------------------------------ */

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] sm:max-w-[70%] ${
          isUser
            ? 'bg-accent-dim rounded-2xl rounded-br-md px-4 py-2.5'
            : 'bg-base-surface border-l-2 border-accent rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm'
        }`}
      >
        <p className="text-sm text-text-primary whitespace-pre-wrap break-words leading-relaxed">
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
          className={`text-xs mt-1 ${
            isUser ? 'text-accent text-right' : 'text-text-muted'
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
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
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

  // Send message
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversation_id: conversationId,
          message: trimmed,
        }),
      });

      if (!res.ok) {
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
    } catch {
      setError('通信エラーが発生しました。ネットワーク接続を確認してください。');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [input, isLoading, conversationId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px - 5rem)' }}>
      {/* Header */}
      <div className="pb-4 border-b border-border mb-4 flex-shrink-0">
        <h2 className="text-xl font-semibold text-text-primary">
          FujiTrace AI 事務員
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          自然言語で事務作業を依頼できます
        </p>

        {/* Payment setup success message */}
        {setupSuccess && (
          <div className="mt-2">
            <span className="text-xs text-status-pass bg-status-pass/10 px-2 py-1 rounded-card">
              お支払い方法の登録が完了しました
            </span>
          </div>
        )}

        {/* Trial status badge */}
        {trialInfo && !isAdmin && (
          <div className="mt-2">
            {trialInfo.remaining === 0 ? (
              <div className="flex flex-col items-start gap-2">
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
            ) : trialInfo.remaining === 1 ? (
              <span className="text-xs text-status-warn bg-status-warn/10 px-2 py-1 rounded-card">
                お試し: 残り1回
              </span>
            ) : (
              <span className="text-xs text-text-secondary bg-base-elevated px-2 py-1 rounded-card">
                お試し: 残り{trialInfo.remaining}回
              </span>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4 min-h-0">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-base-surface border-l-2 border-accent rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
              <p className="text-sm text-text-muted">処理中...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="pt-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="ここに入力..."
            disabled={isLoading}
            maxLength={MAX_INPUT_LENGTH}
            className="flex-1 px-4 py-2.5 border border-border rounded-card text-sm text-text-primary placeholder-text-muted bg-base-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="メッセージ入力"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-accent text-white px-4 py-2 rounded-card text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 flex items-center gap-2"
            aria-label="送信"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">送信</span>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-2 text-sm text-status-fail" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
