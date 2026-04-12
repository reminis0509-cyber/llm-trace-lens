/* ------------------------------------------------------------------ */
/*  AiClerkChat — Card-based task hub for AI clerk                     */
/*  Redesigned from chat interface to structured task forms             */
/* ------------------------------------------------------------------ */

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, X, Paperclip, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../lib/supabase';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ViewType =
  | { type: 'hub' }
  | { type: 'estimate' }
  | { type: 'invoice' }
  | { type: 'delivery-note' }
  | { type: 'purchase-order' }
  | { type: 'cover-letter' };

interface TrialInfo {
  used: number;
  limit: number;
  remaining: number;
  isTrialExhausted: boolean;
}

interface CompanyInfo {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  representative: string;
  invoiceNumber: string;
}

interface TaskCardDef {
  id: string;
  title: string;
  description: string;
  actions: Array<{
    label: string;
    view: ViewType;
  }>;
}

interface GenericFormField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'textarea' | 'items';
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface GenericFormConfig {
  title: string;
  taskId: string;
  fields: GenericFormField[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'fujitrace-company-info';

const TASK_CARDS: TaskCardDef[] = [
  {
    id: 'estimate',
    title: '見積書',
    description: '作成・チェック',
    actions: [
      { label: '開く', view: { type: 'estimate' } },
    ],
  },
  {
    id: 'invoice',
    title: '請求書',
    description: '作成・チェック',
    actions: [
      { label: '開く', view: { type: 'invoice' } },
    ],
  },
  {
    id: 'delivery-note',
    title: '納品書',
    description: '作成',
    actions: [
      { label: '開く', view: { type: 'delivery-note' } },
    ],
  },
  {
    id: 'purchase-order',
    title: '発注書',
    description: '作成',
    actions: [
      { label: '開く', view: { type: 'purchase-order' } },
    ],
  },
  {
    id: 'cover-letter',
    title: '送付状',
    description: '作成',
    actions: [
      { label: '開く', view: { type: 'cover-letter' } },
    ],
  },
];

interface TaskConfig {
  title: string;
  hasCheck: boolean;
  createConfig: GenericFormConfig;
  checkConfig?: GenericFormConfig;
}

const TASK_CONFIGS: Record<string, TaskConfig> = {
  'estimate': {
    title: '見積書',
    hasCheck: true,
    createConfig: {
      title: '見積書作成',
      taskId: 'estimate.create',
      fields: [], // Uses dedicated EstimateCreateForm
    },
    checkConfig: {
      title: '見積書チェック',
      taskId: 'accounting.estimate_check',
      fields: [
        { key: 'content', label: 'チェックしたい見積書の内容を貼り付け、またはファイルを添付してください', type: 'textarea', placeholder: '見積書の内容をここに貼り付け...', required: true },
      ],
    },
  },
  'invoice': {
    title: '請求書',
    hasCheck: true,
    createConfig: {
      title: '請求書作成',
      taskId: 'accounting.invoice_create',
      fields: [
        { key: 'client', label: '宛先（会社名）', type: 'text', placeholder: '株式会社○○', required: true },
        { key: 'invoiceNumber', label: '請求書番号', type: 'text', placeholder: 'INV-2026-001' },
        { key: 'items', label: '明細', type: 'items', required: true },
        { key: 'dueDate', label: '支払期限', type: 'date', required: true },
        { key: 'bankAccount', label: '振込先口座', type: 'textarea', placeholder: '銀行名 支店名 普通 口座番号 口座名義' },
        { key: 'paymentTerms', label: '支払条件', type: 'select', options: ['月末締め翌月末払い', '月末締め翌々月末払い', '納品後30日以内', '前払い'] },
      ],
    },
    checkConfig: {
      title: '請求書チェック',
      taskId: 'accounting.invoice_check',
      fields: [
        { key: 'content', label: 'チェックしたい請求書の内容を貼り付け、またはファイルを添付してください', type: 'textarea', placeholder: '請求書の内容をここに貼り付け...', required: true },
      ],
    },
  },
  'delivery-note': {
    title: '納品書',
    hasCheck: false,
    createConfig: {
      title: '納品書作成',
      taskId: 'accounting.delivery_note_create',
      fields: [
        { key: 'client', label: '宛先（会社名）', type: 'text', placeholder: '株式会社○○', required: true },
        { key: 'deliveryDate', label: '納品日', type: 'date', required: true },
        { key: 'items', label: '明細', type: 'items', required: true },
        { key: 'notes', label: '備考', type: 'textarea', placeholder: '特記事項があれば入力' },
      ],
    },
  },
  'purchase-order': {
    title: '発注書',
    hasCheck: false,
    createConfig: {
      title: '発注書作成',
      taskId: 'accounting.purchase_order_create',
      fields: [
        { key: 'client', label: '発注先（会社名）', type: 'text', placeholder: '株式会社○○', required: true },
        { key: 'items', label: '明細', type: 'items', required: true },
        { key: 'deliveryDate', label: '納期', type: 'date' },
        { key: 'paymentTerms', label: '支払条件', type: 'select', options: ['月末締め翌月末払い', '月末締め翌々月末払い', '納品後30日以内'] },
      ],
    },
  },
  'cover-letter': {
    title: '送付状',
    hasCheck: false,
    createConfig: {
      title: '送付状作成',
      taskId: 'general_affairs.cover_letter_create',
      fields: [
        { key: 'client', label: '宛先（会社名・担当者名）', type: 'text', placeholder: '株式会社○○ ○○様', required: true },
        { key: 'subject', label: '件名', type: 'text', placeholder: '見積書送付のご案内', required: true },
        { key: 'enclosures', label: '同封物', type: 'textarea', placeholder: '見積書 1部\nカタログ 1部' },
        { key: 'body', label: '本文（任意、空白ならAIが生成）', type: 'textarea', placeholder: '' },
      ],
    },
  },
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
/*  TaskCard                                                           */
/* ------------------------------------------------------------------ */

function TaskCard({ card, onAction }: { card: TaskCardDef; onAction: (view: ViewType) => void }) {
  return (
    <div className="surface-card p-5">
      <h3 className="text-base font-medium text-text-primary">{card.title}</h3>
      <p className="mt-1 text-sm text-text-muted">{card.description}</p>
      <div className="flex gap-2 mt-4">
        {card.actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onAction(action.view)}
            className="px-4 py-2 text-sm text-white bg-accent rounded-card hover:bg-accent/90 transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TaskViewWrapper                                                    */
/* ------------------------------------------------------------------ */

function TaskViewWrapper({ title, onBack, children, embedded }: { title: string; onBack: () => void; children: React.ReactNode; embedded?: boolean }) {
  // When embedded inside TaskWithTabs, skip the outer wrapper (header + scroll handled by parent)
  if (embedded) return <>{children}</>;
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px - 5rem)' }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onBack} className="p-1 text-text-muted hover:text-text-primary transition-colors" aria-label="戻る">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <h2 className="text-base font-medium text-text-primary">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EstimateResult — Preview + Edit + Download                         */
/* ------------------------------------------------------------------ */

function formatEstimateText(estimate: Record<string, unknown>): string {
  const e = estimate;
  const client = e.client as Record<string, unknown> | undefined;
  const estItems = (e.items as Array<Record<string, unknown>>) ?? [];
  return [
    `見積書`,
    ``,
    `見積番号: ${e.estimate_number ?? ''}`,
    `発行日: ${e.issue_date ?? ''}`,
    `有効期限: ${e.valid_until ?? ''}`,
    ``,
    `宛先: ${client?.company_name ?? ''} ${client?.honorific ?? ''}`,
    `件名: ${e.subject ?? ''}`,
    ``,
    `--- 明細 ---`,
    ...estItems.map((it, i) => `${i + 1}. ${it.name}  数量${it.quantity}  単価¥${Number(it.unit_price ?? 0).toLocaleString()}  金額¥${Number(it.subtotal ?? 0).toLocaleString()}`),
    ``,
    `小計: ¥${Number(e.subtotal ?? 0).toLocaleString()}`,
    `消費税: ¥${Number(e.tax_amount ?? 0).toLocaleString()}`,
    `合計: ¥${Number(e.total ?? 0).toLocaleString()}`,
    ``,
    e.payment_terms ? `支払条件: ${e.payment_terms}` : '',
    e.delivery_date ? `納期: ${e.delivery_date}` : '',
    e.notes ? `備考: ${e.notes}` : '',
  ].filter(Boolean).join('\n');
}

function EstimateResult({ result, onReset, onBack, embedded }: {
  result: Record<string, unknown>;
  onReset: () => void;
  onBack: () => void;
  embedded?: boolean;
}) {
  const estimate = result.estimate as Record<string, unknown> | undefined;
  const verification = result.verification as Record<string, unknown> | undefined;
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [editText, setEditText] = useState(() => estimate ? formatEstimateText(estimate) : '');

  const handleDownload = () => {
    const blob = new Blob([editText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const num = estimate ? String((estimate as Record<string, unknown>).estimate_number ?? 'draft') : 'draft';
    a.download = `見積書_${num}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TaskViewWrapper title="見積書作成" onBack={onBack} embedded={embedded}>
      <div className="space-y-4">
        {/* Preview / Edit tabs */}
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-3">
              <button
                onClick={() => setMode('preview')}
                className={`text-sm transition-colors ${mode === 'preview' ? 'text-accent font-medium border-b-2 border-accent pb-1' : 'text-text-muted hover:text-text-secondary pb-1'}`}
              >
                プレビュー
              </button>
              <button
                onClick={() => setMode('edit')}
                className={`text-sm transition-colors ${mode === 'edit' ? 'text-accent font-medium border-b-2 border-accent pb-1' : 'text-text-muted hover:text-text-secondary pb-1'}`}
              >
                編集
              </button>
            </div>
            <button onClick={handleDownload} className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent/80 transition-colors">
              <Download className="w-4 h-4" strokeWidth={1.5} />
              ダウンロード
            </button>
          </div>

          {mode === 'preview' ? (
            <div className="text-sm text-text-secondary whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-card border border-border leading-relaxed">
              {editText}
            </div>
          ) : (
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={20}
              className="w-full px-4 py-3 text-sm font-mono border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-y leading-relaxed"
            />
          )}
        </div>

        {/* Verification */}
        {verification && (
          <div className="surface-card p-5">
            <h3 className="text-sm font-medium text-text-primary mb-3">FujiTrace 品質チェック</h3>
            {Array.isArray((verification as Record<string, unknown>).critical_issues) && ((verification as Record<string, unknown>).critical_issues as Array<Record<string, unknown>>).length > 0 && (
              <div className="text-sm p-3 rounded-card border-l-2 border-status-fail bg-status-fail/5 mb-2">
                {((verification as Record<string, unknown>).critical_issues as Array<Record<string, unknown>>).map((issue, i) => (
                  <p key={i} className="text-status-fail">{String(issue.message)}</p>
                ))}
              </div>
            )}
            {Array.isArray((verification as Record<string, unknown>).warnings) && ((verification as Record<string, unknown>).warnings as Array<Record<string, unknown>>).length > 0 && (
              <div className="text-sm p-3 rounded-card border-l-2 border-status-warn bg-status-warn/5 mb-2">
                {((verification as Record<string, unknown>).warnings as Array<Record<string, unknown>>).map((issue, i) => (
                  <p key={i} className="text-status-warn">{String(issue.message)}</p>
                ))}
              </div>
            )}
            {Array.isArray((verification as Record<string, unknown>).suggestions) && ((verification as Record<string, unknown>).suggestions as string[]).length > 0 && (
              <details className="text-sm">
                <summary className="text-text-muted cursor-pointer hover:text-text-secondary">改善提案 ({((verification as Record<string, unknown>).suggestions as string[]).length}件)</summary>
                <div className="mt-2 text-text-muted pl-3">
                  {((verification as Record<string, unknown>).suggestions as string[]).map((s, i) => (
                    <p key={i}>- {s}</p>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        <button
          onClick={onReset}
          className="px-4 py-2 text-sm text-accent border border-accent rounded-card hover:bg-accent/5 transition-colors"
        >
          もう一度作成する
        </button>
      </div>
    </TaskViewWrapper>
  );
}

/* ------------------------------------------------------------------ */
/*  EstimateCreateForm                                                 */
/* ------------------------------------------------------------------ */

function EstimateCreateForm({ companyInfo, onBack, embedded }: { companyInfo: CompanyInfo; onBack: () => void; embedded?: boolean }) {
  const [clientName, setClientName] = useState('');
  const [subject, setSubject] = useState('');
  const [items, setItems] = useState([{ name: '', quantity: 1, unitPrice: '' as string | number }]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('月末締め翌月末払い');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addItem = () => setItems([...items, { name: '', quantity: 1, unitPrice: '' }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: string, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * (Number(item.unitPrice) || 0), 0);
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;

  const handleSubmit = async () => {
    if (!clientName.trim()) { setError('宛先を入力してください'); return; }
    if (items.some(i => !i.name.trim())) { setError('全ての明細に品名を入力してください'); return; }

    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();

      const ci = companyInfo;
      const parts: string[] = [];
      if (ci.companyName) parts.push(`発行元: ${ci.companyName}`);
      if (ci.address) parts.push(`住所: ${ci.address}`);
      if (ci.phone) parts.push(`電話: ${ci.phone}`);
      if (ci.email) parts.push(`メール: ${ci.email}`);
      if (ci.representative) parts.push(`代表者: ${ci.representative}`);
      if (ci.invoiceNumber) parts.push(`インボイス番号: ${ci.invoiceNumber}`);

      const itemLines = items.map(i => `- ${i.name}: ${i.quantity}個 × ¥${(Number(i.unitPrice) || 0).toLocaleString()}`).join('\n');

      const userMsg = `${parts.join('\n')}\n\n宛先: ${clientName}\n件名: ${subject || 'Webサイト制作'}\n\n明細:\n${itemLines}\n\n納期: ${deliveryDate || '未定'}\n支払条件: ${paymentTerms}`;

      const res = await fetch('/api/tools/estimate/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversation_history: [{ role: 'user', content: userMsg }],
          business_info_id: 'default',
        }),
      });

      const body = await res.json();
      if (body.success) {
        setResult(body.data);
      } else {
        setError(body.error || 'エラーが発生しました');
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <TaskViewWrapper title="見積書作成" onBack={onBack} embedded={embedded}>
        <div className="flex flex-col items-center justify-center py-16">
          <img src="/dashboard/mascot-run.gif" alt="" className="w-16 h-16" style={{ imageRendering: 'pixelated', animation: 'mascot-run 0.3s ease-in-out infinite alternate' }} />
          <p className="mt-4 text-sm text-text-secondary">見積書を作成中...</p>
        </div>
      </TaskViewWrapper>
    );
  }

  if (result) {
    return <EstimateResult result={result} onReset={() => setResult(null)} onBack={onBack} embedded={embedded} />;
  }

  return (
    <TaskViewWrapper title="見積書作成" onBack={onBack} embedded={embedded}>
      {error && (
        <div className="text-sm p-3 rounded-card border-l-2 border-status-fail bg-status-fail/5 mb-4">
          <p className="text-status-fail">{error}</p>
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">宛先（会社名）</label>
          <input
            type="text"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="株式会社○○"
            className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">件名</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Webサイト制作費用"
            className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-2">明細</label>
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-end">
              <div className="flex-1">
                {idx === 0 && <span className="text-xs text-text-muted">品名</span>}
                <input
                  type="text"
                  value={item.name}
                  onChange={e => updateItem(idx, 'name', e.target.value)}
                  placeholder="デザイン費"
                  className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div className="w-20">
                {idx === 0 && <span className="text-xs text-text-muted">数量</span>}
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div className="w-32">
                {idx === 0 && <span className="text-xs text-text-muted">単価 (円)</span>}
                <input
                  type="text"
                  inputMode="numeric"
                  value={item.unitPrice}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9]/g, '');
                    updateItem(idx, 'unitPrice', v === '' ? '' : parseInt(v));
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              {items.length > 1 && (
                <button onClick={() => removeItem(idx)} className="p-2 text-text-muted hover:text-status-fail transition-colors" aria-label="明細を削除">
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
          <button onClick={addItem} className="text-sm text-accent hover:text-accent/80 transition-colors mt-1">
            + 明細を追加
          </button>
        </div>

        <div className="surface-card p-4 text-sm">
          <div className="flex justify-between text-text-secondary"><span>小計</span><span>¥{subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between text-text-secondary mt-1"><span>消費税 (10%)</span><span>¥{tax.toLocaleString()}</span></div>
          <div className="flex justify-between font-medium text-text-primary mt-2 pt-2 border-t border-border"><span>合計</span><span>¥{total.toLocaleString()}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">納期</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={e => setDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">支払条件</label>
            <select
              value={paymentTerms}
              onChange={e => setPaymentTerms(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              <option>月末締め翌月末払い</option>
              <option>月末締め翌々月末払い</option>
              <option>納品後30日以内</option>
              <option>納品後即日</option>
              <option>前払い</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full py-3 text-sm text-white bg-accent rounded-card hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          見積書を作成
        </button>
      </div>
    </TaskViewWrapper>
  );
}

/* ------------------------------------------------------------------ */
/*  TaskWithTabs — unified create/check with tab switcher              */
/* ------------------------------------------------------------------ */

function TaskWithTabs({ taskConfig, isEstimate, companyInfo, onBack }: {
  taskConfig: TaskConfig;
  isEstimate: boolean;
  companyInfo: CompanyInfo;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<'create' | 'check'>('create');

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px - 5rem)' }}>
      {/* Header with back button */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onBack} className="p-1 text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <h2 className="text-base font-medium text-text-primary">{taskConfig.title}</h2>
      </div>

      {/* Tab switcher (only if task has check) */}
      {taskConfig.hasCheck && (
        <div className="flex border-b border-border px-4">
          <button
            onClick={() => setMode('create')}
            className={`px-4 py-2.5 text-sm transition-colors ${
              mode === 'create'
                ? 'text-accent border-b-2 border-accent font-medium'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            作成
          </button>
          <button
            onClick={() => setMode('check')}
            className={`px-4 py-2.5 text-sm transition-colors ${
              mode === 'check'
                ? 'text-accent border-b-2 border-accent font-medium'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            チェック
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">
          {mode === 'create' ? (
            isEstimate ? (
              <EstimateCreateForm companyInfo={companyInfo} onBack={onBack} embedded />
            ) : (
              <GenericDocumentForm config={taskConfig.createConfig} companyInfo={companyInfo} onBack={onBack} embedded />
            )
          ) : (
            taskConfig.checkConfig && (
              <GenericDocumentForm config={taskConfig.checkConfig} companyInfo={companyInfo} onBack={onBack} embedded />
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  GenericDocumentForm                                                 */
/* ------------------------------------------------------------------ */

interface CheckResultData {
  status?: string;
  critical_issues?: Array<{ field?: string; severity?: string; message: string }>;
  warnings?: Array<{ field?: string; severity?: string; message: string }>;
  suggestions?: string[];
  arithmetic_check?: { ok: boolean; issues: Array<{ field: string; severity: string; message: string }> };
}

function GenericDocumentForm({ config, companyInfo, onBack, embedded }: { config: GenericFormConfig; companyInfo: CompanyInfo; onBack: () => void; embedded?: boolean }) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [items, setItems] = useState([{ name: '', quantity: 1, unitPrice: 0 }]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    for (const field of config.fields) {
      if (field.required && field.type !== 'items' && !formData[field.key]) {
        setError(`${field.label}を入力してください`);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();

      // Build instruction from company info + form data
      const ci = companyInfo;
      const ciParts: string[] = [];
      if (ci.companyName) ciParts.push(`発行元: ${ci.companyName}`);
      if (ci.address) ciParts.push(`住所: ${ci.address}`);
      if (ci.phone) ciParts.push(`電話: ${ci.phone}`);
      if (ci.email) ciParts.push(`メール: ${ci.email}`);
      if (ci.representative) ciParts.push(`代表者: ${ci.representative}`);
      if (ci.invoiceNumber) ciParts.push(`インボイス番号: ${ci.invoiceNumber}`);

      const formParts: string[] = [];
      for (const field of config.fields) {
        if (field.type === 'items') {
          const itemLines = items
            .filter(i => i.name.trim())
            .map(i => `- ${i.name}: ${i.quantity}個 × ¥${i.unitPrice.toLocaleString()}`)
            .join('\n');
          if (itemLines) formParts.push(`明細:\n${itemLines}`);
        } else {
          const val = formData[field.key];
          if (val) formParts.push(`${field.label}: ${val}`);
        }
      }

      const instruction = `${ciParts.join('\n')}\n\n${config.title}を作成してください。\n\n${formParts.join('\n')}`;

      // Call office-task-execute directly (skips AI agent, avoids 60s timeout)
      const isCheckTask = config.taskId.includes('check');
      let res: Response;

      if (attachedFile) {
        // For file-attached check tasks, use agent chat (supports multipart)
        const fd = new FormData();
        fd.append('file', attachedFile);
        fd.append('message', `[会社情報]\n${ciParts.join('\n')}\n\n[依頼]\n${instruction}`);
        const uploadHeaders = { ...headers };
        delete uploadHeaders['Content-Type'];
        res = await fetch('/api/agent/chat', { method: 'POST', headers: uploadHeaders, body: fd });
      } else {
        // Direct tool execution — single LLM call, ~10s instead of ~60s
        res = await fetch('/api/tools/office-task/execute', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            task_id: config.taskId,
            instruction,
            ...(isCheckTask ? { document_text: formData['content'] as string || '' } : {}),
          }),
        });
      }

      const body = await res.json() as Record<string, unknown>;
      if (!res.ok || body.success === false) {
        setError(String(body.error || `エラーが発生しました (${res.status})`));
      } else {
        const data = (body.data ?? body) as Record<string, unknown>;
        const isCheckResponse = data.archetype === 'document_check';

        if (isCheckResponse) {
          // Parse structured check result for tiered display
          const structured = data.structured_result as CheckResultData | undefined;
          const arithmeticCheck = data.arithmetic_check as CheckResultData['arithmetic_check'] | undefined;
          if (structured) {
            const cr: CheckResultData = {
              status: structured.status as string | undefined,
              critical_issues: (structured.critical_issues as CheckResultData['critical_issues']) ?? [],
              warnings: (structured.warnings as CheckResultData['warnings']) ?? [],
              suggestions: (structured.suggestions as string[]) ?? [],
              arithmetic_check: arithmeticCheck,
            };
            setCheckResult(cr);
          } else {
            // Fallback: try parsing raw result as JSON
            try {
              const parsed = JSON.parse(data.result as string) as CheckResultData;
              parsed.arithmetic_check = arithmeticCheck;
              setCheckResult(parsed);
            } catch {
              setResult(data.result as string || JSON.stringify(data, null, 2));
            }
          }
        } else {
          // Extract the document text from the response
          let resultText = '';
          const structured = data.structured_result as Record<string, unknown> | undefined;
          if (structured?.document) {
            resultText = String(structured.document);
            if (structured.summary) resultText += '\n\n' + String(structured.summary);
            const warnings = structured.warnings as string[] | undefined;
            if (warnings?.length) resultText += '\n\n注意事項:\n' + warnings.map(w => '- ' + w).join('\n');
          } else if (data.result && typeof data.result === 'string') {
            try {
              const parsed = JSON.parse(data.result as string) as Record<string, unknown>;
              if (parsed.document) {
                resultText = String(parsed.document);
                if (parsed.summary) resultText += '\n\n' + String(parsed.summary);
              } else {
                resultText = data.result as string;
              }
            } catch {
              resultText = data.result as string;
            }
          } else if (data.reply) {
            resultText = String(data.reply);
          }
          if (!resultText) resultText = JSON.stringify(data, null, 2);
          setResult(resultText);
        }
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <TaskViewWrapper title={config.title} onBack={onBack} embedded={embedded}>
        <div className="flex flex-col items-center justify-center py-16">
          <img src="/dashboard/mascot-run.gif" alt="" className="w-16 h-16" style={{ imageRendering: 'pixelated', animation: 'mascot-run 0.3s ease-in-out infinite alternate' }} />
          <p className="mt-4 text-sm text-text-secondary">{config.title}を処理中...</p>
        </div>
      </TaskViewWrapper>
    );
  }

  if (checkResult) {
    const hasCritical = (checkResult.critical_issues?.length ?? 0) > 0;
    const hasWarnings = (checkResult.warnings?.length ?? 0) > 0;
    const hasSuggestions = (checkResult.suggestions?.length ?? 0) > 0;
    const statusLabel = checkResult.status === 'ok' ? '問題なし' : checkResult.status === 'warning' ? '要確認' : 'エラーあり';
    const statusColor = checkResult.status === 'ok' ? 'text-green-600' : checkResult.status === 'warning' ? 'text-status-warn' : 'text-status-fail';

    return (
      <TaskViewWrapper title={config.title} onBack={onBack} embedded={embedded}>
        <div className="space-y-4">
          <div className="surface-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-primary">FujiTrace 品質チェック</h3>
              <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
            </div>

            {hasCritical && (
              <div className="text-sm p-3 rounded-card border-l-2 border-status-fail bg-status-fail/5 mb-3">
                <p className="text-xs font-medium text-status-fail mb-1">重大な問題</p>
                {checkResult.critical_issues!.map((issue, i) => (
                  <p key={i} className="text-status-fail">{issue.message}</p>
                ))}
              </div>
            )}

            {hasWarnings && (
              <div className="text-sm p-3 rounded-card border-l-2 border-status-warn bg-status-warn/5 mb-3">
                <p className="text-xs font-medium text-status-warn mb-1">確認事項</p>
                {checkResult.warnings!.map((issue, i) => (
                  <p key={i} className="text-status-warn">{issue.message}</p>
                ))}
              </div>
            )}

            {hasSuggestions && (
              <details className="text-sm mb-3">
                <summary className="text-text-muted cursor-pointer hover:text-text-secondary">改善提案 ({checkResult.suggestions!.length}件)</summary>
                <div className="mt-2 text-text-muted pl-3">
                  {checkResult.suggestions!.map((s, i) => (
                    <p key={i}>- {s}</p>
                  ))}
                </div>
              </details>
            )}

            {!hasCritical && !hasWarnings && !hasSuggestions && (
              <p className="text-sm text-green-600">チェック項目に問題は見つかりませんでした。</p>
            )}
          </div>

          <button
            onClick={() => { setCheckResult(null); setFormData({}); }}
            className="px-4 py-2 text-sm text-accent border border-accent rounded-card hover:bg-accent/5 transition-colors"
          >
            もう一度チェックする
          </button>
        </div>
      </TaskViewWrapper>
    );
  }

  if (result) {
    return (
      <TaskViewWrapper title={config.title} onBack={onBack} embedded={embedded}>
        <div className="space-y-4">
          <div className="surface-card p-5">
            <h3 className="text-sm font-medium text-text-primary mb-3">結果</h3>
            <div className="text-sm text-text-secondary prose prose-sm max-w-none prose-headings:text-text-primary prose-strong:text-text-primary prose-th:text-left prose-td:px-2 prose-td:py-1 prose-th:px-2 prose-th:py-1 prose-table:border-collapse prose-td:border prose-td:border-border prose-th:border prose-th:border-border">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </div>
          </div>
          <button
            onClick={() => { setResult(null); setFormData({}); }}
            className="px-4 py-2 text-sm text-accent border border-accent rounded-card hover:bg-accent/5 transition-colors"
          >
            もう一度作成する
          </button>
        </div>
      </TaskViewWrapper>
    );
  }

  return (
    <TaskViewWrapper title={config.title} onBack={onBack} embedded={embedded}>
      {error && (
        <div className="text-sm p-3 rounded-card border-l-2 border-status-fail bg-status-fail/5 mb-4">
          <p className="text-status-fail">{error}</p>
        </div>
      )}
      <div className="space-y-4">
        {config.fields.map(field => {
          if (field.type === 'items') {
            const itemSubtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
            const itemTax = Math.floor(itemSubtotal * 0.1);
            const itemTotal = itemSubtotal + itemTax;
            return (
              <div key={field.key}>
                <label className="block text-sm text-text-secondary mb-2">{field.label}</label>
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-2 items-end">
                    <div className="flex-1">
                      {idx === 0 && <span className="text-xs text-text-muted">品名</span>}
                      <input type="text" value={item.name} onChange={e => { const u = [...items]; u[idx] = { ...u[idx], name: e.target.value }; setItems(u); }} placeholder="品名" className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
                    </div>
                    <div className="w-20">
                      {idx === 0 && <span className="text-xs text-text-muted">数量</span>}
                      <input type="number" min="1" value={item.quantity} onChange={e => { const u = [...items]; u[idx] = { ...u[idx], quantity: parseInt(e.target.value) || 1 }; setItems(u); }} className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
                    </div>
                    <div className="w-32">
                      {idx === 0 && <span className="text-xs text-text-muted">単価 (円)</span>}
                      <input type="number" min="0" value={item.unitPrice} onChange={e => { const u = [...items]; u[idx] = { ...u[idx], unitPrice: parseInt(e.target.value) || 0 }; setItems(u); }} className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="p-2 text-text-muted hover:text-status-fail transition-colors" aria-label="明細を削除"><X className="w-4 h-4" strokeWidth={1.5} /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => setItems([...items, { name: '', quantity: 1, unitPrice: 0 }])} className="text-sm text-accent hover:text-accent/80 transition-colors mt-1">+ 明細を追加</button>
                <div className="surface-card p-3 mt-3 text-sm">
                  <div className="flex justify-between text-text-secondary"><span>小計</span><span>¥{itemSubtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-text-secondary mt-1"><span>消費税 (10%)</span><span>¥{itemTax.toLocaleString()}</span></div>
                  <div className="flex justify-between font-medium text-text-primary mt-2 pt-2 border-t border-border"><span>合計</span><span>¥{itemTotal.toLocaleString()}</span></div>
                </div>
              </div>
            );
          }
          if (field.type === 'select') {
            return (
              <div key={field.key}>
                <label className="block text-sm text-text-secondary mb-1">{field.label}</label>
                <select value={(formData[field.key] as string) || field.options?.[0] || ''} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent">
                  {field.options?.map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
            );
          }
          if (field.type === 'textarea') {
            return (
              <div key={field.key}>
                <label className="block text-sm text-text-secondary mb-1">{field.label}</label>
                <textarea value={(formData[field.key] as string) || ''} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} placeholder={field.placeholder} rows={4} className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none" />
                {field.key === 'content' && (
                  <div className="mt-2">
                    <input ref={fileInputRef} type="file" accept=".txt,.csv,.pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f && f.size <= 5 * 1024 * 1024) setAttachedFile(f); e.target.value = ''; }} />
                    <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent/80 transition-colors">
                      <Paperclip className="w-4 h-4" strokeWidth={1.5} />
                      ファイルを添付
                    </button>
                    {attachedFile && (
                      <span className="ml-2 text-xs text-text-muted">
                        {attachedFile.name} ({(attachedFile.size / 1024).toFixed(0)} KB)
                        <button onClick={() => setAttachedFile(null)} className="text-status-fail ml-1" aria-label="添付ファイルを削除">x</button>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          }
          return (
            <div key={field.key}>
              <label className="block text-sm text-text-secondary mb-1">{field.label}</label>
              <input type={field.type} value={(formData[field.key] as string) || ''} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} placeholder={field.placeholder} className="w-full px-3 py-2 text-sm border border-border rounded-card bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
            </div>
          );
        })}

        <button onClick={handleSubmit} disabled={isLoading} className="w-full py-3 text-sm text-white bg-accent rounded-card hover:bg-accent/90 transition-colors disabled:opacity-50">
          {config.title.includes('チェック') ? 'チェック開始' : '作成開始'}
        </button>
      </div>
    </TaskViewWrapper>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AiClerkChat() {
  const [view, setView] = useState<ViewType>({ type: 'hub' });
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(loadCompanyInfo);
  const [hasSeenCompanySetup, setHasSeenCompanySetup] = useState(false);

  // Auto-open company info modal on mount if company info is empty
  useEffect(() => {
    if (!hasCompanyInfo(companyInfo) && !hasSeenCompanySetup) {
      setShowCompanyModal(true);
      setHasSeenCompanySetup(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleTaskAction = useCallback((targetView: ViewType) => {
    if (!hasCompanyInfo(companyInfo)) {
      setShowCompanyModal(true);
      return;
    }
    setView(targetView);
  }, [companyInfo]);

  // Hub view
  if (view.type === 'hub') {
    return (
      <div className="flex flex-col items-center" style={{ height: 'calc(100vh - 48px - 5rem)' }}>
        {/* Company Info Modal */}
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

        {/* Trial exhausted + payment setup */}
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

        {/* Error message */}
        {error && (
          <p className="mt-2 text-sm text-status-fail text-center" role="alert">
            {error}
          </p>
        )}

        {/* Header */}
        <div className="flex flex-col items-center pt-8 sm:pt-12 mb-8">
          <img
            src="/dashboard/mascot-idle.gif"
            alt=""
            className="w-16 h-16 sm:w-20 sm:h-20"
            style={{ imageRendering: 'pixelated' }}
            aria-hidden="true"
          />
          <h2 className="mt-3 text-xl font-semibold text-text-primary">FujiTrace AI 事務員</h2>
          <p className="mt-1 text-sm text-text-secondary">作業を選んで開始してください</p>

          {/* Trial badge */}
          {trialInfo && !isAdmin && trialInfo.remaining > 0 && (
            <span className="mt-2 text-xs px-2 py-1 rounded-card text-text-secondary bg-base-elevated">
              お試し: 残り{trialInfo.remaining}回
            </span>
          )}
        </div>

        {/* Task Cards Grid */}
        <div className="w-full max-w-2xl px-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TASK_CARDS.map(card => (
            <TaskCard key={card.id} card={card} onAction={handleTaskAction} />
          ))}
        </div>

        {/* Company Info Settings Button */}
        <button onClick={() => setShowCompanyModal(true)} className="mt-6 text-xs text-text-muted hover:text-accent transition-colors">
          会社情報を設定
        </button>
      </div>
    );
  }

  // Task view with integrated create/check tabs
  const taskConfig = TASK_CONFIGS[view.type];
  if (taskConfig) {
    return (
      <>
        {showCompanyModal && (
          <CompanyInfoModal
            info={companyInfo}
            onSave={handleSaveCompanyInfo}
            onClose={() => setShowCompanyModal(false)}
          />
        )}
        <TaskWithTabs
          taskConfig={taskConfig}
          isEstimate={view.type === 'estimate'}
          companyInfo={companyInfo}
          onBack={() => setView({ type: 'hub' })}
        />
      </>
    );
  }

  return null;
}
