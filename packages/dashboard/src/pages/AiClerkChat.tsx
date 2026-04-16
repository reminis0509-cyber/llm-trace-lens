/* ------------------------------------------------------------------ */
/*  AiClerkChat — Unified chat interface for AI clerk (chat-v2)        */
/*  Single chat experience with SSE streaming, tool call display,      */
/*  and suggestion chips for common tasks.                              */
/* ------------------------------------------------------------------ */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Paperclip,
  Send,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Settings,
  FileText,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../lib/supabase';
import { usePlan } from '../contexts/PlanContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CompanyInfo {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  representative: string;
  invoiceNumber: string;
}

interface ToolCallState {
  tool: string;
  index: number;
  status: 'running' | 'ok' | 'error';
  result?: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCallState[];
  attachments?: string[];
  isStreaming?: boolean;
  error?: string;
}

interface RateLimitInfo {
  resetAt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'fujitrace-company-info';

const SUGGESTION_CHIPS: { label: string; message: string }[] = [
  { label: '見積書を作成', message: '見積書を作成してください' },
  { label: '請求書をチェック', message: '請求書をチェックしてください' },
  { label: '発注書を作成', message: '発注書を作成してください' },
  { label: '納品書を作成', message: '納品書を作成してください' },
  { label: '送付状を作成', message: '送付状を作成してください' },
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
/*  File to base64                                                     */
/* ------------------------------------------------------------------ */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove "data:...;base64," prefix
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
    { key: 'companyName', label: '会社名', placeholder: '株式会社○○' },
    { key: 'address', label: '住所', placeholder: '東京都港区...' },
    { key: 'phone', label: '電話番号', placeholder: '03-XXXX-XXXX' },
    { key: 'email', label: 'メール', placeholder: 'info@example.co.jp' },
    { key: 'representative', label: '代表者名', placeholder: '山田 太郎' },
    { key: 'invoiceNumber', label: 'インボイス登録番号', placeholder: 'T1234567890123' },
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
/*  ProUpgradeModal                                                    */
/* ------------------------------------------------------------------ */

function ProUpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-upgrade-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="pro-upgrade-title" className="text-base font-semibold text-text-primary">
            Pro プラン限定機能です
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
        <p className="text-sm text-text-secondary mb-6">
          アップグレードすると AI が自律的にタスクを実行します。複数のツールを組み合わせた高度な処理が可能になります。
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-text-secondary border border-border rounded-card hover:bg-base-elevated transition-colors"
          >
            閉じる
          </button>
          <a
            href="/dashboard/settings"
            className="flex-1 px-4 py-2 text-sm text-white bg-accent rounded-card hover:bg-accent/90 transition-colors text-center"
          >
            プランを確認
          </a>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RateLimitModal                                                     */
/* ------------------------------------------------------------------ */

function RateLimitModal({ resetAt, onClose }: { resetAt: string; onClose: () => void }) {
  const resetDate = new Date(resetAt);
  const formatted = resetDate.toLocaleString('ja-JP', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-limit-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="rate-limit-title" className="text-base font-semibold text-text-primary">
            利用制限に達しました
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
        <p className="text-sm text-text-secondary mb-2">
          {formatted} にリセットされます。
        </p>
        <p className="text-sm text-text-secondary mb-6">
          Pro プランにアップグレードすると無制限でご利用いただけます。
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-text-secondary border border-border rounded-card hover:bg-base-elevated transition-colors"
          >
            閉じる
          </button>
          <a
            href="/dashboard/settings"
            className="flex-1 px-4 py-2 text-sm text-white bg-accent rounded-card hover:bg-accent/90 transition-colors text-center"
          >
            Pro にアップグレード
          </a>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ToolCallIndicator                                                  */
/* ------------------------------------------------------------------ */

function ToolCallIndicator({ toolCall }: { toolCall: ToolCallState }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
      toolCall.status === 'running'
        ? 'bg-blue-50 text-blue-700 border border-blue-100'
        : toolCall.status === 'ok'
          ? 'bg-green-50 text-green-700 border border-green-100'
          : 'bg-red-50 text-red-700 border border-red-100'
    }`}>
      {toolCall.status === 'running' && (
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" strokeWidth={1.5} />
      )}
      {toolCall.status === 'ok' && (
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
      )}
      {toolCall.status === 'error' && (
        <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
      )}
      <Wrench className="w-3.5 h-3.5 flex-shrink-0 opacity-60" strokeWidth={1.5} />
      <span className="font-mono text-xs truncate">{toolCall.tool}</span>
      {toolCall.status === 'running' && (
        <span className="text-xs opacity-70">実行中...</span>
      )}
      {toolCall.status === 'ok' && (
        <span className="text-xs opacity-70">完了</span>
      )}
      {toolCall.status === 'error' && (
        <span className="text-xs opacity-70">エラー</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ChatBubble                                                         */
/* ------------------------------------------------------------------ */

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] sm:max-w-[70%]">
          <div className="bg-accent text-white px-4 py-3 rounded-2xl rounded-br-md text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
          <p className="text-[10px] text-text-muted mt-1 text-right">
            {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] sm:max-w-[75%]">
        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {message.toolCalls.map((tc, i) => (
              <ToolCallIndicator key={`${tc.index}-${i}`} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <div className="bg-white border border-border px-4 py-3 rounded-2xl rounded-bl-md text-sm text-text-primary">
            <div className="prose prose-sm max-w-none prose-headings:text-text-primary prose-strong:text-text-primary prose-th:text-left prose-td:px-2 prose-td:py-1 prose-th:px-2 prose-th:py-1 prose-table:border-collapse prose-td:border prose-td:border-border prose-th:border prose-th:border-border">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Streaming indicator */}
        {message.isStreaming && !message.content && (!message.toolCalls || message.toolCalls.length === 0) && (
          <div className="bg-white border border-border px-4 py-3 rounded-2xl rounded-bl-md">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              考え中...
            </div>
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent border border-accent/30 rounded-lg hover:bg-accent/5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
                <Download className="w-3 h-3" strokeWidth={1.5} />
                添付ファイル {i + 1}
              </a>
            ))}
          </div>
        )}

        {/* Error */}
        {message.error && (
          <div className="mt-2 text-sm p-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {message.error}
            </div>
          </div>
        )}

        {/* Timestamp */}
        {!message.isStreaming && message.content && (
          <p className="text-[10px] text-text-muted mt-1">
            {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AiClerkChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  // conversation_id can be set when the server returns one in future iterations
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);

  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(loadCompanyInfo);
  const [hasSeenCompanySetup, setHasSeenCompanySetup] = useState(false);

  const [showProModal, setShowProModal] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);

  const { loading: planLoading } = usePlan();

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-open company info modal on mount if empty
  useEffect(() => {
    if (!hasCompanyInfo(companyInfo) && !hasSeenCompanySetup) {
      setShowCompanyModal(true);
      setHasSeenCompanySetup(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-expand textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 160);
    el.style.height = `${next}px`;
  }, [inputValue]);

  const handleSaveCompanyInfo = useCallback((info: CompanyInfo) => {
    setCompanyInfo(info);
    saveCompanyInfo(info);
  }, []);

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  /* ---------------------------------------------------------------- */
  /*  SSE Chat Streaming                                               */
  /* ---------------------------------------------------------------- */

  const handleSend = useCallback(async (overrideMessage?: string) => {
    const text = (overrideMessage || inputValue).trim();
    if (!text || isStreaming) return;

    // Check company info before first message
    if (messages.length === 0 && !hasCompanyInfo(companyInfo)) {
      setShowCompanyModal(true);
      return;
    }

    // Build user message with company info context if this is the first message
    let messageToSend = text;
    if (messages.length === 0 && hasCompanyInfo(companyInfo)) {
      const ci = companyInfo;
      const parts: string[] = [];
      if (ci.companyName) parts.push(`会社名: ${ci.companyName}`);
      if (ci.address) parts.push(`住所: ${ci.address}`);
      if (ci.phone) parts.push(`電話: ${ci.phone}`);
      if (ci.email) parts.push(`メール: ${ci.email}`);
      if (ci.representative) parts.push(`代表者: ${ci.representative}`);
      if (ci.invoiceNumber) parts.push(`インボイス番号: ${ci.invoiceNumber}`);
      if (parts.length > 0) {
        messageToSend = `[会社情報]\n${parts.join('\n')}\n\n[依頼]\n${text}`;
      }
    }

    // Add user message to chat
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const assistantId = generateId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      toolCalls: [],
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInputValue('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const headers = await getAuthHeaders();

      // Build request body
      const body: Record<string, unknown> = {
        message: messageToSend,
      };
      if (conversationId) {
        body.conversation_id = conversationId;
      }
      if (attachedFile) {
        const base64 = await fileToBase64(attachedFile);
        body.file = {
          name: attachedFile.name,
          type: attachedFile.type,
          content_base64: base64,
        };
        setAttachedFile(null);
      }

      const res = await fetch('/api/agent/chat-v2', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // Handle error responses
      if (res.status === 429) {
        try {
          const errorBody = await res.json() as { code?: string; resetAt?: string };
          if (errorBody.code === 'FREE_LIMIT' && errorBody.resetAt) {
            setRateLimitInfo({ resetAt: errorBody.resetAt });
          }
        } catch { /* ignore */ }
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, isStreaming: false, error: '利用制限に達しました。しばらくお待ちください。' }
            : m
        ));
        setIsStreaming(false);
        return;
      }

      if (res.status === 403) {
        try {
          const errorBody = await res.json() as { code?: string };
          if (errorBody.code === 'PRO_REQUIRED') {
            setShowProModal(true);
          }
        } catch { /* ignore */ }
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, isStreaming: false, error: 'この機能は Pro プラン以上でご利用いただけます。' }
            : m
        ));
        setIsStreaming(false);
        return;
      }

      if (!res.ok || !res.body) {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, isStreaming: false, error: `サーバーエラーが発生しました (${res.status})` }
            : m
        ));
        setIsStreaming(false);
        return;
      }

      // Parse SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on double newlines (SSE event boundary)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            if (payload === '[DONE]') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, isStreaming: false } : m
              ));
              setIsStreaming(false);
              return;
            }

            try {
              const event = JSON.parse(payload) as Record<string, unknown>;
              const eventType = event.type as string;

              switch (eventType) {
                case 'message_start':
                  // No-op, stream has started
                  break;

                case 'tool_start':
                  setMessages(prev => prev.map(m => {
                    if (m.id !== assistantId) return m;
                    const newToolCall: ToolCallState = {
                      tool: event.tool as string,
                      index: event.index as number,
                      status: 'running',
                    };
                    return {
                      ...m,
                      toolCalls: [...(m.toolCalls || []), newToolCall],
                    };
                  }));
                  break;

                case 'tool_result':
                  setMessages(prev => prev.map(m => {
                    if (m.id !== assistantId) return m;
                    const updatedToolCalls = (m.toolCalls || []).map(tc =>
                      tc.index === (event.index as number)
                        ? {
                            ...tc,
                            status: (event.status as string) === 'ok' ? 'ok' as const : 'error' as const,
                            result: event.result as Record<string, unknown> | undefined,
                          }
                        : tc
                    );
                    return { ...m, toolCalls: updatedToolCalls };
                  }));
                  break;

                case 'message':
                  setMessages(prev => prev.map(m => {
                    if (m.id !== assistantId) return m;
                    return {
                      ...m,
                      content: event.content as string || '',
                      attachments: event.attachments as string[] | undefined,
                    };
                  }));
                  break;

                case 'error':
                  setMessages(prev => prev.map(m => {
                    if (m.id !== assistantId) return m;
                    return {
                      ...m,
                      isStreaming: false,
                      error: (event.message as string) || 'エラーが発生しました',
                    };
                  }));
                  setIsStreaming(false);
                  return;

                default:
                  break;
              }
            } catch {
              /* ignore parse errors */
            }
          }
        }
      }

      // If we exit the while loop without [DONE], mark as done
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false } : m
      ));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, isStreaming: false, error: '通信エラーが発生しました' }
            : m
        ));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [inputValue, isStreaming, messages.length, companyInfo, conversationId, attachedFile]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleChipClick = useCallback((message: string) => {
    if (isStreaming) return;
    setInputValue(message);
    // Directly send the message
    handleSend(message);
  }, [isStreaming, handleSend]);

  const handleFileAttach = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.size <= 5 * 1024 * 1024) {
      setAttachedFile(f);
    }
    e.target.value = '';
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px - 5rem)' }}>
      {/* Modals */}
      {showCompanyModal && (
        <CompanyInfoModal
          info={companyInfo}
          onSave={handleSaveCompanyInfo}
          onClose={() => setShowCompanyModal(false)}
        />
      )}
      {showProModal && (
        <ProUpgradeModal onClose={() => setShowProModal(false)} />
      )}
      {rateLimitInfo && (
        <RateLimitModal
          resetAt={rateLimitInfo.resetAt}
          onClose={() => setRateLimitInfo(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium text-text-primary">AI 事務員</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowCompanyModal(true)}
          className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-base-elevated transition-colors"
          aria-label="会社情報を設定"
        >
          <Settings className="w-4.5 h-4.5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!hasMessages ? (
          /* Welcome state */
          <div className="flex flex-col items-center justify-center h-full">
            <img
              src="/dashboard/mascot-idle.gif"
              alt=""
              className="w-16 h-16 sm:w-20 sm:h-20"
              style={{ imageRendering: 'pixelated' }}
              aria-hidden="true"
            />
            <h3 className="mt-3 text-lg font-semibold text-text-primary">
              何をお手伝いしましょうか?
            </h3>
            <p className="mt-1 text-sm text-text-secondary text-center max-w-md">
              見積書や請求書の作成、書類チェックなど、事務作業をお手伝いします。
            </p>
            {hasCompanyInfo(companyInfo) && (
              <p className="mt-2 text-xs text-text-muted">
                会社: {companyInfo.companyName || '未設定'}
              </p>
            )}
          </div>
        ) : (
          /* Message list */
          <div className="max-w-2xl mx-auto">
            {messages.map(msg => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom input area */}
      <div className="flex-shrink-0 border-t border-border bg-white px-4 py-3">
        <div className="max-w-2xl mx-auto">
          {/* Suggestion chips */}
          {!hasMessages && (
            <div className="flex flex-wrap gap-2 mb-3">
              {SUGGESTION_CHIPS.map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleChipClick(chip.message)}
                  disabled={isStreaming || planLoading}
                  className="px-3 py-1.5 text-xs text-text-secondary border border-border rounded-full bg-white hover:bg-base-elevated hover:border-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Attached file indicator */}
          {attachedFile && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-base-elevated rounded-lg text-xs text-text-secondary">
              <Paperclip className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
              <span className="truncate">{attachedFile.name}</span>
              <span className="text-text-muted">({(attachedFile.size / 1024).toFixed(0)} KB)</span>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="ml-auto p-0.5 text-text-muted hover:text-status-fail transition-colors"
                aria-label="添付ファイルを削除"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">
            {/* File attach button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileAttach}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className="flex-shrink-0 p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-base-elevated disabled:opacity-40 transition-colors"
              aria-label="ファイルを添付"
            >
              <Paperclip className="w-5 h-5" strokeWidth={1.5} />
            </button>

            {/* Textarea */}
            <div className="flex-1 flex items-end rounded-xl border border-border bg-white focus-within:ring-2 focus-within:ring-accent focus-within:border-transparent px-3 py-2">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力..."
                disabled={isStreaming}
                rows={1}
                aria-label="AI事務員への指示"
                className="flex-1 resize-none border-0 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none disabled:opacity-50"
                style={{ minHeight: '24px', maxHeight: '160px' }}
              />
            </div>

            {/* Send button */}
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isStreaming || (!inputValue.trim() && !attachedFile)}
              className="flex-shrink-0 p-2 text-white bg-accent rounded-xl hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="送信"
            >
              <Send className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
