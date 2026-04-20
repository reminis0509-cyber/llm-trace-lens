/* ------------------------------------------------------------------ */
/*  ClerkChat — Main chat component for AI clerk                       */
/* ------------------------------------------------------------------ */

import { useState, useRef, useEffect, useCallback } from 'react';
import ClerkMessage from './ClerkMessage';

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
/*  Auth helpers (same pattern as EstimateToolPage)                     */
/* ------------------------------------------------------------------ */

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            access_token?: string;
            user?: { email?: string; id?: string };
          };
          // Priority 1: Send JWT for server-side verification (secure)
          if (parsed?.access_token) {
            headers['Authorization'] = `Bearer ${parsed.access_token}`;
          }
          // Fallback: send email/id headers (used only if JWT unavailable)
          const email = parsed?.user?.email;
          const userId = parsed?.user?.id;
          if (email) headers['X-User-Email'] = email;
          if (userId) headers['X-User-ID'] = userId;
        }
        break;
      }
    }
  } catch {
    // Skip auth on parse error
  }
  return headers;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const INITIAL_MESSAGE: ChatMessage = {
  id: 'initial',
  role: 'assistant',
  content:
    'お仕事のご依頼をどうぞ。\n見積書の作成、請求書のチェックなど、事務作業をお手伝いします。',
  timestamp: new Date(),
};

const MAX_INPUT_LENGTH = 2000;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ClerkChat() {
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

  // Auto-scroll to bottom on new messages
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
      const res = await fetch('/api/agent/trial-status', {
        headers: getAuthHeaders(),
      });
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
      // Silent fail — trial badge is non-critical
    }
  }, []);

  // Fetch trial status on mount
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
      // Auto-hide success message after 5 seconds
      const timer = setTimeout(() => setSetupSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [fetchTrialStatus]);

  // Redirect to Stripe Checkout for payment method registration
  const handleSetupPayment = useCallback(async () => {
    setIsSettingUp(true);
    try {
      const res = await fetch('/api/billing/agent-setup', {
        method: 'POST',
        headers: getAuthHeaders(),
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

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Add user message
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
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          conversation_id: conversationId,
          message: trimmed,
        }),
      });

      if (!res.ok) {
        if (res.status === 402) {
          const errBody = await res.json().catch(() => null) as {
            error?: string;
            trialInfo?: TrialInfo;
          } | null;
          if (errBody?.trialInfo) setTrialInfo(errBody.trialInfo);
          setError(errBody?.error ?? '無料お試しの回数が終了しました。');
          return;
        }
        if (res.status === 403) {
          setError('AI社員はProプランの機能です。');
          return;
        }
        const errBody = await res.json().catch(() => null) as {
          error?: string;
        } | null;
        setError(
          errBody?.error ?? `エラーが発生しました (${res.status})`
        );
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
      // Re-focus input after send
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
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[800px] min-h-[480px]">
      {/* Header */}
      <div className="pb-4 border-b border-gray-200 mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          FujiTrace AI 社員
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          自然言語で事務作業を依頼できます
        </p>
        {/* Payment setup success message */}
        {setupSuccess && (
          <div className="mt-2">
            <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
              お支払い方法の登録が完了しました
            </span>
          </div>
        )}
        {/* Trial status badge */}
        {trialInfo && !isAdmin && (
          <div className="mt-2">
            {trialInfo.remaining === 0 ? (
              <div className="flex flex-col items-start gap-2">
                <span className="text-xs text-red-600">
                  無料お試し（{trialInfo.limit}回）が終了しました
                </span>
                <button
                  type="button"
                  onClick={handleSetupPayment}
                  disabled={isSettingUp}
                  className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSettingUp
                    ? '処理中...'
                    : 'お支払い方法を登録する \u2192'}
                </button>
              </div>
            ) : trialInfo.remaining === 1 ? (
              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                お試し: 残り1回
              </span>
            ) : (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                お試し: 残り{trialInfo.remaining}回
              </span>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4">
        {messages.map((msg) => (
          <ClerkMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            toolCall={msg.toolCall}
            featureRequestLogged={msg.featureRequestLogged}
            timestamp={msg.timestamp}
          />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border-l-2 border-blue-600 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
              <p className="text-sm text-gray-500">処理中...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) =>
              setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))
            }
            onKeyDown={handleKeyDown}
            placeholder="ここに入力..."
            disabled={isLoading}
            maxLength={MAX_INPUT_LENGTH}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="メッセージ入力"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="送信"
          >
            送信
          </button>
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
