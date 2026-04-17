/* ------------------------------------------------------------------ */
/*  AiClerkChat — Claude-inspired chat UI with sidebar + mascot        */
/*  Features: conversation history sidebar, inline mascot, tool call   */
/*  trace animation, usage stats, enhanced welcome screen.             */
/* ------------------------------------------------------------------ */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Paperclip,
  Send,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Settings,
  FileText,
  FileDown,
  Plus,
  MessageSquare,
  Menu,
  Clock,
  GraduationCap,
  ChevronRight,
  BookOpen,
  Check,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { EstimatePdfData } from '../lib/pdf/estimate';
import type { InvoicePdfData } from '../lib/pdf/invoice';
import type { PurchaseOrderPdfData } from '../lib/pdf/purchase-order';
import type { DeliveryNotePdfData } from '../lib/pdf/delivery-note';
import type { CoverLetterPdfData } from '../lib/pdf/cover-letter';
import type { IssuerInfo } from '../lib/pdf/base';
import { supabase } from '../lib/supabase';
import { usePlan } from '../contexts/PlanContext';
import ToolCallTrace, {
  createToolCallTraceState,
  completeAllSteps,
  type ToolCallTraceState,
} from '../components/ToolCallTrace';
import { primeAudio } from '../utils/stepSound';

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
  startedAt?: number;
  /** Multi-step trace animation state */
  traceState?: ToolCallTraceState;
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

interface StoredConversation {
  id: string;
  title: string;
  messages: SerializedMessage[];
  createdAt: string;
  updatedAt: string;
}

interface SerializedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallState[];
  attachments?: string[];
  error?: string;
}

interface RateLimitInfo {
  resetAt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COMPANY_STORAGE_KEY = 'fujitrace-company-info';
const CONVERSATIONS_KEY = 'fujitrace_conversations';

const SUGGESTION_CHIPS: { label: string; message: string }[] = [
  { label: '見積書を作成', message: '見積書を作成してください' },
  { label: '請求書をチェック', message: '請求書をチェックしてください' },
  { label: '発注書を作成', message: '発注書を作成してください' },
  { label: '納品書を作成', message: '納品書を作成してください' },
  { label: '送付状を作成', message: '送付状を作成してください' },
];

const TOOL_LABELS: Record<string, string> = {
  'estimate.create': '見積書を作成',
  'estimate.check': '見積書をチェック',
  'accounting.invoice_create': '請求書を作成',
  'accounting.invoice_check': '請求書をチェック',
  'accounting.delivery_note_create': '納品書を作成',
  'accounting.purchase_order_create': '発注書を作成',
  'general_affairs.cover_letter_create': '送付状を作成',
};

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
/*  Memory API helpers                                                 */
/* ------------------------------------------------------------------ */

async function loadMemory(): Promise<string> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/agent/memory', { headers });
    if (!res.ok) return '';
    const json = await res.json() as { data?: { content?: string } };
    return json.data?.content || '';
  } catch {
    return '';
  }
}

async function saveMemoryApi(content: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/agent/memory', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Memory Modal                                                       */
/* ------------------------------------------------------------------ */

const MEMORY_MAX_LENGTH = 2000;

function MemoryModal({ initialContent, onSave, onClose }: {
  initialContent: string;
  onSave: (content: string) => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    const ok = await saveMemoryApi(content);
    setSaving(false);
    if (ok) {
      onSave(content);
      onClose();
    } else {
      setError('保存に失敗しました。もう一度お試しください。');
    }
  }, [content, onSave, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-modal-title"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 id="memory-modal-title" className="text-base font-semibold text-text-primary">
            メモリ
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
          フジへの指示をメモしておくと、毎回の入力が楽になります。
        </p>
        <textarea
          value={content}
          onChange={(e) => {
            if (e.target.value.length <= MEMORY_MAX_LENGTH) {
              setContent(e.target.value);
            }
          }}
          placeholder={"例:\n・消費税は軽減税率8%で計算\n・支払条件は月末締め翌月末払い\n・取引先: 株式会社デプロイ 田中様"}
          rows={10}
          className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
          aria-label="メモリの内容"
        />
        <div className="flex items-center justify-between mt-2 mb-4">
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
          <p className="text-xs text-text-muted ml-auto">
            {content.length} / {MEMORY_MAX_LENGTH.toLocaleString()}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-text-secondary border border-border rounded-card hover:bg-base-elevated transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm text-white bg-accent rounded-card hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  localStorage helpers — Company info                                */
/* ------------------------------------------------------------------ */

function loadCompanyInfo(): CompanyInfo {
  try {
    const raw = localStorage.getItem(COMPANY_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CompanyInfo;
  } catch { /* ignore */ }
  return { companyName: '', address: '', phone: '', email: '', representative: '', invoiceNumber: '' };
}

function saveCompanyInfo(info: CompanyInfo): void {
  localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(info));
}

function hasCompanyInfo(info: CompanyInfo): boolean {
  return !!(info.companyName || info.address || info.phone || info.email);
}

/* ------------------------------------------------------------------ */
/*  localStorage helpers — Conversations                               */
/* ------------------------------------------------------------------ */

function loadConversations(): StoredConversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredConversation[];
      return parsed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  } catch { /* ignore */ }
  return [];
}

function saveConversations(conversations: StoredConversation[]): void {
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

function serializeMessages(messages: ChatMessage[]): SerializedMessage[] {
  return messages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
    toolCalls: m.toolCalls,
    attachments: m.attachments,
    error: m.error,
  }));
}

function deserializeMessages(messages: SerializedMessage[]): ChatMessage[] {
  return messages.map(m => ({
    ...m,
    timestamp: new Date(m.timestamp),
  }));
}

function upsertConversation(
  conversations: StoredConversation[],
  id: string,
  messages: ChatMessage[],
): StoredConversation[] {
  const existing = conversations.find(c => c.id === id);
  const now = new Date().toISOString();
  const firstUserMsg = messages.find(m => m.role === 'user');
  const title = firstUserMsg
    ? firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')
    : '新しい会話';

  if (existing) {
    existing.messages = serializeMessages(messages);
    existing.updatedAt = now;
    existing.title = title;
    return [...conversations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  const newConv: StoredConversation = {
    id,
    title,
    messages: serializeMessages(messages),
    createdAt: now,
    updatedAt: now,
  };
  return [newConv, ...conversations];
}

/* ------------------------------------------------------------------ */
/*  Date grouping for sidebar                                          */
/* ------------------------------------------------------------------ */

interface ConversationGroup {
  label: string;
  conversations: StoredConversation[];
}

function groupConversations(conversations: StoredConversation[]): ConversationGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, StoredConversation[]> = {
    '今日': [],
    '昨日': [],
    '今週': [],
    'それ以前': [],
  };

  for (const conv of conversations) {
    const d = new Date(conv.updatedAt);
    if (d >= today) {
      groups['今日'].push(conv);
    } else if (d >= yesterday) {
      groups['昨日'].push(conv);
    } else if (d >= weekAgo) {
      groups['今週'].push(conv);
    } else {
      groups['それ以前'].push(conv);
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, conversations: items }));
}

/* ------------------------------------------------------------------ */
/*  Usage stats                                                        */
/* ------------------------------------------------------------------ */

interface UsageStats {
  totalConversations: number;
  totalMessages: number;
  streakDays: number;
}

function computeUsageStats(conversations: StoredConversation[]): UsageStats {
  const totalConversations = conversations.length;
  const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);

  // Calculate streak: count consecutive days with at least one conversation
  const dateSet = new Set<string>();
  for (const conv of conversations) {
    const d = new Date(conv.updatedAt);
    dateSet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }

  let streakDays = 0;
  const now = new Date();
  const check = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  while (dateSet.has(`${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`)) {
    streakDays++;
    check.setDate(check.getDate() - 1);
  }

  return { totalConversations, totalMessages, streakDays };
}

/* ------------------------------------------------------------------ */
/*  File to base64                                                     */
/* ------------------------------------------------------------------ */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
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
/*  ToolCallTraceInline — multi-step trace animation wrapper           */
/* ------------------------------------------------------------------ */

function ToolCallTraceInline({
  toolCall,
  onTraceUpdate,
}: {
  toolCall: ToolCallState;
  onTraceUpdate: (index: number, updated: ToolCallTraceState) => void;
}) {
  const handleUpdate = useCallback(
    (updated: ToolCallTraceState) => onTraceUpdate(toolCall.index, updated),
    [toolCall.index, onTraceUpdate],
  );

  if (toolCall.traceState) {
    return (
      <ToolCallTrace
        traceState={toolCall.traceState}
        onTraceUpdate={handleUpdate}
      />
    );
  }

  // Fallback for tool calls without trace state (shouldn't happen normally)
  const label = TOOL_LABELS[toolCall.tool] || toolCall.tool;
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
      toolCall.status === 'running'
        ? 'bg-blue-50 border border-blue-100'
        : toolCall.status === 'ok'
          ? 'bg-green-50 border border-green-100'
          : 'bg-red-50 border border-red-100'
    }`}>
      {toolCall.status === 'running' && (
        <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" strokeWidth={1.5} />
      )}
      {toolCall.status === 'ok' && (
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" strokeWidth={1.5} />
      )}
      {toolCall.status === 'error' && (
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={1.5} />
      )}
      <Wrench className="w-3.5 h-3.5 flex-shrink-0 opacity-50" strokeWidth={1.5} />
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {toolCall.status === 'ok' && (
        <span className="text-xs text-green-600 ml-auto">完了</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Document PDF extraction + download (all 5 types)                   */
/* ------------------------------------------------------------------ */

type DocumentType = 'estimate' | 'invoice' | 'purchase-order' | 'delivery-note' | 'cover-letter';

interface DocumentPdfData {
  type: DocumentType;
  data: EstimatePdfData | InvoicePdfData | PurchaseOrderPdfData | DeliveryNotePdfData | CoverLetterPdfData;
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  'estimate': '見積書',
  'invoice': '請求書',
  'purchase-order': '発注書',
  'delivery-note': '納品書',
  'cover-letter': '送付状',
};

/** Normalize items array — ensure each item has required PdfLineItem fields. */
function normalizeItems(items: unknown[]): { name: string; quantity: number; unit_price: number; subtotal: number }[] {
  return items.map((item: unknown) => {
    const it = item as Record<string, unknown>;
    return {
      name: String(it.name || it.description || ''),
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      subtotal: Number(it.subtotal) || (Number(it.quantity || 1) * Number(it.unit_price || 0)),
    };
  });
}

/** Try to find structured data for a specific document key at common paths. */
function findDataAtKey(result: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const r = result;
  const fromData = (r?.data as Record<string, unknown>)?.[key];
  if (fromData && typeof fromData === 'object') return fromData as Record<string, unknown>;
  const fromRoot = r?.[key];
  if (fromRoot && typeof fromRoot === 'object') return fromRoot as Record<string, unknown>;
  return null;
}

/**
 * Detect the tool name from the result or tool call metadata to infer document type.
 */
function inferTypeFromToolName(toolName: string): DocumentType | null {
  if (toolName.includes('estimate')) return 'estimate';
  if (toolName.includes('invoice')) return 'invoice';
  if (toolName.includes('purchase_order')) return 'purchase-order';
  if (toolName.includes('delivery_note')) return 'delivery-note';
  if (toolName.includes('cover_letter')) return 'cover-letter';
  return null;
}

function extractDocumentData(result: Record<string, unknown>, toolName?: string): DocumentPdfData | null {
  try {
    // 1. Try estimate
    const est = findDataAtKey(result, 'estimate') ||
      (result?.items && result?.client ? result : null);
    if (est) {
      const data = est as EstimatePdfData;
      if (data.items && Array.isArray(data.items)) {
        data.items = normalizeItems(data.items);
      }
      return { type: 'estimate', data };
    }

    // 2. Try invoice
    const inv = findDataAtKey(result, 'invoice');
    if (inv) {
      const data = inv as InvoicePdfData;
      if (data.items && Array.isArray(data.items)) {
        data.items = normalizeItems(data.items);
      }
      return { type: 'invoice', data };
    }

    // 3. Try purchase order
    const po = findDataAtKey(result, 'purchase_order') || findDataAtKey(result, 'purchaseOrder');
    if (po) {
      const data = po as PurchaseOrderPdfData;
      if (data.items && Array.isArray(data.items)) {
        data.items = normalizeItems(data.items);
      }
      return { type: 'purchase-order', data };
    }

    // 4. Try delivery note
    const dn = findDataAtKey(result, 'delivery_note') || findDataAtKey(result, 'deliveryNote');
    if (dn) {
      const data = dn as DeliveryNotePdfData;
      if (data.items && Array.isArray(data.items)) {
        data.items = normalizeItems(data.items);
      }
      return { type: 'delivery-note', data };
    }

    // 5. Try cover letter
    const cl = findDataAtKey(result, 'cover_letter') || findDataAtKey(result, 'coverLetter');
    if (cl) {
      return { type: 'cover-letter', data: cl as CoverLetterPdfData };
    }

    // 6. If none matched by key, try inferring from tool name + generic data
    if (toolName) {
      const inferred = inferTypeFromToolName(toolName);
      if (inferred) {
        // The data might be at a generic path
        const genericData = (result?.data as Record<string, unknown>) || result;
        if (genericData && typeof genericData === 'object') {
          // Only use if it has meaningful fields (items, client, subject, body)
          const gd = genericData as Record<string, unknown>;
          if (gd.items || gd.client || gd.subject || gd.body || gd.enclosures) {
            if (inferred === 'cover-letter') {
              return { type: 'cover-letter', data: gd as CoverLetterPdfData };
            }
            if (Array.isArray(gd.items)) {
              (gd as Record<string, unknown>).items = normalizeItems(gd.items as unknown[]);
            }
            return { type: inferred, data: gd as EstimatePdfData };
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Generate PDF blob for any document type. */
async function generateDocumentPdf(
  docType: DocumentType,
  data: DocumentPdfData['data'],
  issuer: IssuerInfo,
): Promise<Blob> {
  switch (docType) {
    case 'estimate': {
      const { generateEstimatePdf } = await import('../lib/pdf/estimate');
      return generateEstimatePdf(data as EstimatePdfData, issuer);
    }
    case 'invoice': {
      const { generateInvoicePdf } = await import('../lib/pdf/invoice');
      return generateInvoicePdf(data as InvoicePdfData, issuer);
    }
    case 'purchase-order': {
      const { generatePurchaseOrderPdf } = await import('../lib/pdf/purchase-order');
      return generatePurchaseOrderPdf(data as PurchaseOrderPdfData, issuer);
    }
    case 'delivery-note': {
      const { generateDeliveryNotePdf } = await import('../lib/pdf/delivery-note');
      return generateDeliveryNotePdf(data as DeliveryNotePdfData, issuer);
    }
    case 'cover-letter': {
      const { generateCoverLetterPdf } = await import('../lib/pdf/cover-letter');
      return generateCoverLetterPdf(data as CoverLetterPdfData, issuer);
    }
  }
}

/** Get a suitable filename prefix for the document number. */
function getDocumentNumber(docType: DocumentType, data: DocumentPdfData['data']): string {
  const d = data as Record<string, unknown>;
  switch (docType) {
    case 'estimate': return String(d.estimate_number || '');
    case 'invoice': return String(d.invoice_number || '');
    case 'purchase-order': return String(d.order_number || '');
    case 'delivery-note': return String(d.delivery_number || '');
    case 'cover-letter': return '';
  }
}

function PdfPreviewCard({
  documentData,
  issuerInfo,
}: {
  documentData: DocumentPdfData;
  issuerInfo: IssuerInfo;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(true);
  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef<string | null>(null);

  const isMobileView = window.innerWidth < 640;
  const docLabel = DOCUMENT_LABELS[documentData.type];

  // Auto-generate PDF on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const blob = await generateDocumentPdf(documentData.type, documentData.data, issuerInfo);
        if (cancelled) return;
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setBlobUrl(url);
      } catch (err) {
        console.error('[PdfPreviewCard] PDF generation failed:', err, { documentData, issuerInfo });
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [documentData, issuerInfo]);

  const handleDownload = useCallback(() => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement('a');
    a.href = url;
    const docNum = getDocumentNumber(documentData.type, documentData.data);
    const suffix = docNum || new Date().toISOString().slice(0, 10);
    a.download = `${docLabel}_${suffix}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [documentData, docLabel]);

  const handleOpenInNewTab = useCallback(() => {
    if (!blobUrl) return;
    window.open(blobUrl, '_blank');
  }, [blobUrl]);

  // Loading state
  if (generating) {
    return (
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex items-center gap-2.5 text-sm text-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin text-accent" strokeWidth={1.5} />
          PDFを準備中...
        </div>
      </div>
    );
  }

  // Error state
  if (error || !blobUrl) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          PDFの生成に失敗しました
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      {/* Preview area */}
      {previewVisible && !isMobileView && (
        <div className="p-3 pb-0">
          <iframe
            src={blobUrl}
            title={`${docLabel}プレビュー`}
            className="w-full rounded-lg border border-border bg-gray-50"
            style={{ height: '500px' }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 p-3">
        {/* Download button (primary) */}
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/90 transition-colors"
          aria-label={`${docLabel}のPDFをダウンロード`}
        >
          <Download className="w-4 h-4" strokeWidth={1.5} />
          PDFをダウンロード
        </button>

        {isMobileView ? (
          /* Mobile: open in new tab */
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary border border-border rounded-lg hover:bg-base-elevated transition-colors"
            aria-label="PDFを別タブで開く"
          >
            <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
            PDFをプレビュー
          </button>
        ) : (
          /* Desktop: toggle preview visibility */
          <button
            type="button"
            onClick={() => setPreviewVisible((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary border border-border rounded-lg hover:bg-base-elevated transition-colors"
            aria-label={previewVisible ? 'プレビューを閉じる' : 'プレビューを表示'}
          >
            {previewVisible ? (
              <>
                <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                プレビューを閉じる
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" strokeWidth={1.5} />
                プレビューを表示
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Confirmation detection                                             */
/* ------------------------------------------------------------------ */

const CONFIRMATION_PATTERNS = [
  'よろしいでしょうか',
  'よろしいですか',
  'お知らせください',
  'お願いします',
  '確認させてください',
  '進めてよろしい',
  '問題ありません',
  'いかがでしょうか',
  'いかがですか',
  'ご確認ください',
];

function isConfirmationMessage(content: string): boolean {
  const last200 = content.slice(-200);
  return CONFIRMATION_PATTERNS.some(p => last200.includes(p));
}

/* ------------------------------------------------------------------ */
/*  ApprovalBar                                                        */
/* ------------------------------------------------------------------ */

function ApprovalBar({ onApprove, onCustomSend }: {
  onApprove: () => void;
  onCustomSend: (text: string) => void;
}) {
  const [customText, setCustomText] = useState('');

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        type="button"
        onClick={onApprove}
        className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 text-sm font-medium whitespace-nowrap transition-colors"
        aria-label="承認する"
      >
        <Check className="w-4 h-4" strokeWidth={1.5} />
        承認する
      </button>
      <div className="flex-1 flex items-center gap-2">
        <input
          type="text"
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && customText.trim()) {
              onCustomSend(customText.trim());
              setCustomText('');
            }
          }}
          placeholder="修正指示を入力..."
          className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 bg-white text-text-primary placeholder-text-muted"
          aria-label="修正指示"
        />
        <button
          type="button"
          onClick={() => { if (customText.trim()) { onCustomSend(customText.trim()); setCustomText(''); } }}
          disabled={!customText.trim()}
          className="px-3 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-base-elevated disabled:opacity-50 transition-colors whitespace-nowrap"
          aria-label="修正指示を送信"
        >
          送信
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PDF export button for assistant messages                           */
/* ------------------------------------------------------------------ */

function PdfExportButton({ content, companyName }: { content: string; companyName?: string }) {
  const [generating, setGenerating] = useState(false);

  const handleExport = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const { generateMarkdownPdf } = await import('../lib/pdf/markdown-pdf');
      const blob = await generateMarkdownPdf(content, {
        companyName: companyName || undefined,
      });
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `フジ_レポート_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[PdfExportButton] PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }, [content, companyName, generating]);

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={generating}
      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-text-muted hover:text-accent rounded-md hover:bg-accent/5 disabled:opacity-50 transition-colors"
      aria-label="PDFで出力"
    >
      {generating ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
          <span>PDF生成中...</span>
        </>
      ) : (
        <>
          <FileDown className="w-3 h-3" strokeWidth={1.5} />
          <span>PDFで出力</span>
        </>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  ChatBubble                                                         */
/* ------------------------------------------------------------------ */

function ChatBubble({ message, isThinking, onTraceUpdate, companyInfo, isLastAssistant, isConfirmation, onApprove, onCustomSend }: {
  message: ChatMessage;
  isThinking?: boolean;
  onTraceUpdate: (msgId: string, toolIndex: number, updated: ToolCallTraceState) => void;
  companyInfo: CompanyInfo;
  isLastAssistant?: boolean;
  isConfirmation?: boolean;
  onApprove?: () => void;
  onCustomSend?: (text: string) => void;
}) {
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
  const showRunningMascot = isThinking || (message.isStreaming && !message.content && (!message.toolCalls || message.toolCalls.length === 0));
  const mascotSrc = showRunningMascot ? '/dashboard/mascot-run.gif' : '/dashboard/mascot-idle.gif';

  return (
    <div className="flex justify-start mb-4 gap-2">
      {/* Mascot avatar */}
      <div className="flex-shrink-0 mt-1">
        <img
          src={mascotSrc}
          alt=""
          width={32}
          height={32}
          className="rounded-full"
          style={{ imageRendering: 'pixelated' }}
          aria-hidden="true"
        />
      </div>

      <div className="max-w-[82%] sm:max-w-[72%] min-w-0">
        {/* Tool call trace */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {message.toolCalls.map((tc, i) => (
              <ToolCallTraceInline
                key={`${tc.index}-${i}`}
                toolCall={tc}
                onTraceUpdate={(toolIndex, updated) =>
                  onTraceUpdate(message.id, toolIndex, updated)
                }
              />
            ))}
          </div>
        )}

        {/* PDF download button — shown when a tool_result contains structured document data */}
        {message.toolCalls && message.toolCalls.some(tc => tc.status === 'ok' && tc.result && extractDocumentData(tc.result, tc.tool)) && (() => {
          const completedTool = message.toolCalls!.find(tc => tc.status === 'ok' && tc.result && extractDocumentData(tc.result, tc.tool));
          const docData = completedTool?.result ? extractDocumentData(completedTool.result, completedTool.tool) : null;
          if (!docData) return null;
          const issuerInfo: IssuerInfo = {
            companyName: companyInfo.companyName || undefined,
            address: companyInfo.address || undefined,
            phone: companyInfo.phone || undefined,
            email: companyInfo.email || undefined,
            representative: companyInfo.representative || undefined,
            invoiceNumber: companyInfo.invoiceNumber || undefined,
          };
          return (
            <div className="mb-2">
              <PdfPreviewCard documentData={docData} issuerInfo={issuerInfo} />
            </div>
          );
        })()}

        {/* Message content */}
        {message.content && (
          <div className="bg-white border border-border px-4 py-3 rounded-2xl rounded-tl-md text-sm text-text-primary">
            <div className="prose prose-sm max-w-none prose-headings:text-text-primary prose-strong:text-text-primary prose-th:text-left prose-td:px-2 prose-td:py-1 prose-th:px-2 prose-th:py-1 prose-table:border-collapse prose-td:border prose-td:border-border prose-th:border prose-th:border-border">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Streaming / thinking indicator */}
        {message.isStreaming && !message.content && (!message.toolCalls || message.toolCalls.length === 0) && (
          <div className="bg-white border border-border px-4 py-3 rounded-2xl rounded-tl-md">
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

        {/* Timestamp + PDF export */}
        {!message.isStreaming && message.content && (
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-text-muted">
              {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {message.content.length > 50 && (
              <PdfExportButton
                content={message.content}
                companyName={companyInfo.companyName}
              />
            )}
          </div>
        )}

        {/* Approval bar for confirmation messages */}
        {isLastAssistant && isConfirmation && !message.isStreaming && onApprove && onCustomSend && (
          <ApprovalBar onApprove={onApprove} onCustomSend={onCustomSend} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */

function Sidebar({
  conversations,
  activeConversationId,
  stats,
  onNewConversation,
  onSelectConversation,
  onClose,
  isMobile,
}: {
  conversations: StoredConversation[];
  activeConversationId: string | null;
  stats: UsageStats;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onClose: () => void;
  isMobile: boolean;
}) {
  const groups = useMemo(() => groupConversations(conversations), [conversations]);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${
          isMobile
            ? 'fixed inset-y-0 left-0 z-40 w-72'
            : 'relative w-[260px] flex-shrink-0'
        } flex flex-col bg-gray-50 border-r border-border h-full`}
      >
        {/* New conversation button */}
        <div className="p-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => { onNewConversation(); if (isMobile) onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-text-primary bg-white border border-border rounded-lg hover:bg-base-elevated transition-colors"
            aria-label="新しい会話を開始"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            新しい会話
          </button>
        </div>

        {/* Usage stats */}
        <div className="px-3 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 bg-white border border-border rounded-lg text-xs text-text-secondary">
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3 opacity-50" strokeWidth={1.5} />
              <span>{stats.totalConversations}</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1">
              <FileText className="w-3 h-3 opacity-50" strokeWidth={1.5} />
              <span>{stats.totalMessages}</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 opacity-50" strokeWidth={1.5} />
              <span>{stats.streakDays}日</span>
            </div>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2">
          {groups.length === 0 && (
            <p className="text-xs text-text-muted text-center py-8">
              会話履歴はまだありません
            </p>
          )}

          {groups.map(group => (
            <div key={group.label} className="mb-3">
              <p className="px-2 py-1.5 text-[11px] font-medium text-text-muted uppercase tracking-wider">
                {group.label}
              </p>
              {group.conversations.map(conv => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => { onSelectConversation(conv.id); if (isMobile) onClose(); }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-sm truncate transition-colors mb-0.5 ${
                    activeConversationId === conv.id
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-text-secondary hover:bg-white hover:text-text-primary'
                  }`}
                  title={conv.title}
                  aria-current={activeConversationId === conv.id ? 'true' : undefined}
                >
                  {conv.title}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Mobile close affordance */}
        {isMobile && (
          <div className="p-3 border-t border-border flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full px-3 py-2 text-xs text-text-muted text-center hover:text-text-primary transition-colors"
              aria-label="サイドバーを閉じる"
            >
              閉じる
            </button>
          </div>
        )}
      </aside>
    </>
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
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<StoredConversation[]>(loadConversations);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(loadCompanyInfo);
  const [hasSeenCompanySetup, setHasSeenCompanySetup] = useState(false);

  const [showProModal, setShowProModal] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);

  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryLoaded, setMemoryLoaded] = useState(false);

  const { loading: planLoading } = usePlan();

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stats = useMemo(() => computeUsageStats(conversations), [conversations]);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load memory from server on mount
  useEffect(() => {
    let cancelled = false;
    loadMemory().then(content => {
      if (!cancelled) {
        setMemoryContent(content);
        setMemoryLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // On desktop, show sidebar by default
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
  }, [isMobile]);

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

  // Persist conversations when messages change
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      const updated = upsertConversation(conversations, conversationId, messages);
      setConversations(updated);
      saveConversations(updated);
    }
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveCompanyInfo = useCallback((info: CompanyInfo) => {
    setCompanyInfo(info);
    saveCompanyInfo(info);
  }, []);

  const handleOpenMemoryModal = useCallback(async () => {
    // Refresh from server before opening
    const content = await loadMemory();
    setMemoryContent(content);
    setShowMemoryModal(true);
  }, []);

  const handleSaveMemory = useCallback((content: string) => {
    setMemoryContent(content);
  }, []);

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const generateConvId = () => `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  /* ---------------------------------------------------------------- */
  /*  Conversation management                                          */
  /* ---------------------------------------------------------------- */

  const handleNewConversation = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setMessages([]);
    setConversationId(null);
    setInputValue('');
    setIsStreaming(false);
    setAttachedFile(null);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setMessages(deserializeMessages(conv.messages));
      setConversationId(id);
      setInputValue('');
      setIsStreaming(false);
      setAttachedFile(null);
    }
  }, [conversations]);

  /* ---------------------------------------------------------------- */
  /*  SSE Chat Streaming                                               */
  /* ---------------------------------------------------------------- */

  const handleSend = useCallback(async (overrideMessage?: string) => {
    const text = (overrideMessage || inputValue).trim();
    if (!text || isStreaming) return;

    // Prime audio context on user interaction (needed for mobile browsers)
    primeAudio();

    // Check company info before first message
    if (messages.length === 0 && !hasCompanyInfo(companyInfo)) {
      setShowCompanyModal(true);
      return;
    }

    // Assign conversation ID if starting new conversation
    const currentConvId = conversationId || generateConvId();
    if (!conversationId) {
      setConversationId(currentConvId);
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

      // Build request body with conversation history for context continuity
      const history = messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content && m.content.length > 0 && !m.isStreaming)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        .slice(-20); // Last 20 messages for context

      const body: Record<string, unknown> = {
        message: messageToSend,
        history,
      };
      // Use conversation_id from server if available
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
                  break;

                case 'tool_start': {
                  const toolName = event.tool as string;
                  const toolIndex = event.index as number;
                  const traceState = createToolCallTraceState(toolName, toolIndex);
                  setMessages(prev => prev.map(m => {
                    if (m.id !== assistantId) return m;
                    const newToolCall: ToolCallState = {
                      tool: toolName,
                      index: toolIndex,
                      status: 'running',
                      startedAt: Date.now(),
                      traceState,
                    };
                    return {
                      ...m,
                      toolCalls: [...(m.toolCalls || []), newToolCall],
                    };
                  }));
                  break;
                }

                case 'tool_result': {
                  const resultIndex = event.index as number;
                  const resultStatus = (event.status as string) === 'ok' ? 'ok' as const : 'error' as const;
                  const resultData = event.result as Record<string, unknown> | undefined;
                  setMessages(prev => prev.map(m => {
                    if (m.id !== assistantId) return m;
                    const updatedToolCalls = (m.toolCalls || []).map(tc => {
                      if (tc.index !== resultIndex) return tc;
                      const updatedTrace = tc.traceState
                        ? completeAllSteps(tc.traceState, resultStatus, resultData)
                        : undefined;
                      return {
                        ...tc,
                        status: resultStatus,
                        result: resultData,
                        traceState: updatedTrace,
                      };
                    });
                    return { ...m, toolCalls: updatedToolCalls };
                  }));
                  break;
                }

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
    handleSend(message);
  }, [isStreaming, handleSend]);

  /** Called by ToolCallTrace animation to update trace step progress */
  const handleTraceUpdate = useCallback((
    msgId: string,
    toolIndex: number,
    updatedTrace: ToolCallTraceState,
  ) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const updatedToolCalls = (m.toolCalls || []).map(tc =>
        tc.index === toolIndex ? { ...tc, traceState: updatedTrace } : tc
      );
      return { ...m, toolCalls: updatedToolCalls };
    }));
  }, []);

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
  const isAssistantThinking = isStreaming && messages.length > 0 &&
    messages[messages.length - 1]?.role === 'assistant' &&
    messages[messages.length - 1]?.isStreaming === true;

  return (
    <div className="flex" style={{ height: 'calc(100vh - 48px - 5rem)' }}>
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
      {showMemoryModal && (
        <MemoryModal
          initialContent={memoryContent}
          onSave={handleSaveMemory}
          onClose={() => setShowMemoryModal(false)}
        />
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <Sidebar
          conversations={conversations}
          activeConversationId={conversationId}
          stats={stats}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
          onClose={() => setSidebarOpen(false)}
          isMobile={isMobile}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Hamburger menu for mobile / sidebar toggle */}
            {(!sidebarOpen || isMobile) && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-base-elevated transition-colors"
                aria-label="会話履歴を表示"
              >
                <Menu className="w-4.5 h-4.5" strokeWidth={1.5} />
              </button>
            )}
            <h2 className="text-base font-medium text-text-primary">AI 事務員</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleOpenMemoryModal}
              className="relative p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-base-elevated transition-colors"
              aria-label="メモリを編集"
            >
              <BookOpen className="w-4.5 h-4.5" strokeWidth={1.5} />
              {memoryLoaded && memoryContent.trim().length > 0 && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full"
                  aria-label="メモリが設定されています"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowCompanyModal(true)}
              className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-base-elevated transition-colors"
              aria-label="会社情報を設定"
            >
              <Settings className="w-4.5 h-4.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!hasMessages ? (
            /* Welcome state */
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto">
              <img
                src="/dashboard/mascot-idle.gif"
                alt=""
                className="w-20 h-20 sm:w-24 sm:h-24"
                style={{ imageRendering: 'pixelated' }}
                aria-hidden="true"
              />
              <h3 className="mt-4 text-lg font-semibold text-text-primary">
                何をお手伝いしましょうか?
              </h3>
              <p className="mt-1.5 text-sm text-text-secondary text-center">
                見積書や請求書の作成、書類チェックなど、事務作業をお手伝いします。
              </p>
              {hasCompanyInfo(companyInfo) && (
                <p className="mt-2 text-xs text-text-muted">
                  会社: {companyInfo.companyName || '未設定'}
                </p>
              )}

              {/* Suggestion chips in welcome */}
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {SUGGESTION_CHIPS.map(chip => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleChipClick(chip.message)}
                    disabled={isStreaming || planLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-sm text-text-secondary border border-border rounded-xl bg-white hover:bg-base-elevated hover:border-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    <ChevronRight className="w-3.5 h-3.5 opacity-40" strokeWidth={1.5} />
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Tutorial link */}
              <a
                href="/tutorial"
                className="mt-6 flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5" strokeWidth={1.5} />
                使い方を学ぶ
              </a>
            </div>
          ) : (
            /* Message list */
            <div className="max-w-2xl mx-auto">
              {messages.map((msg, idx) => {
                // Determine if this is the last assistant message with no user message after it
                const isLastAssistant = msg.role === 'assistant' &&
                  !messages.slice(idx + 1).some(m => m.role === 'user');
                return (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    isThinking={
                      isAssistantThinking &&
                      idx === messages.length - 1 &&
                      msg.role === 'assistant' &&
                      !!msg.isStreaming &&
                      !!msg.toolCalls &&
                      msg.toolCalls.some(tc => tc.status === 'running')
                    }
                    onTraceUpdate={handleTraceUpdate}
                    companyInfo={companyInfo}
                    isLastAssistant={isLastAssistant}
                    isConfirmation={isLastAssistant && isConfirmationMessage(msg.content) && !(msg.toolCalls && msg.toolCalls.length > 0)}
                    onApprove={() => handleSend('承認します。この内容で進めてください。')}
                    onCustomSend={(text) => handleSend(text)}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom input area */}
        <div className="flex-shrink-0 border-t border-border bg-white px-4 py-3">
          <div className="max-w-2xl mx-auto">
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
    </div>
  );
}
