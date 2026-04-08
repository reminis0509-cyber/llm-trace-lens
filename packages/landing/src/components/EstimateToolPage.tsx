import { useState, useEffect, useCallback, useMemo } from 'react';

/* ------------------------------------------------------------------ */
/*  Auth helpers (mirrors HpCreatePage.tsx pattern)                    */
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
          const parsed = JSON.parse(raw);
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

function isLoggedIn(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.user?.email) return true;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BusinessInfo {
  id: string;
  workspace_id?: string;
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  invoice_number: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
  created_at?: string;
  updated_at?: string;
}

interface BusinessInfoFormData {
  company_name: string;
  address: string;
  phone: string;
  email: string;
  invoice_number: string;
  bank_name: string;
  bank_branch: string;
  account_type: string;
  account_number: string;
  account_holder: string;
}

interface EstimateClient {
  company_name: string;
  contact_person: string;
  honorific: string;
}

interface EstimateItem {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  subtotal: number;
}

interface EstimateData {
  estimate_number: string;
  issue_date: string;
  valid_until: string;
  client: EstimateClient;
  subject: string;
  items: EstimateItem[];
  subtotal: number;
  tax_amount: number;
  total: number;
  delivery_date: string;
  payment_terms: string;
  notes: string;
}

interface CheckIssue {
  field: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  critical_issues: CheckIssue[];
  warnings: CheckIssue[];
  suggestions: string[];
  responsibility_notice: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type TabKey = 'business-info' | 'create' | 'history';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

interface CreateApiResponse {
  estimate?: EstimateData;
  next_question?: string;
  trace_id?: string;
}

interface CheckApiResponse {
  check_result: CheckResult;
  trace_id: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const INVOICE_PATTERN = /^T\d{13}$/u;

function emptyBusinessForm(): BusinessInfoFormData {
  return {
    company_name: '',
    address: '',
    phone: '',
    email: '',
    invoice_number: '',
    bank_name: '',
    bank_branch: '',
    account_type: '',
    account_number: '',
    account_holder: '',
  };
}

function recordToFormData(record: BusinessInfo): BusinessInfoFormData {
  return {
    company_name: record.company_name ?? '',
    address: record.address ?? '',
    phone: record.phone ?? '',
    email: record.email ?? '',
    invoice_number: record.invoice_number ?? '',
    bank_name: record.bank_name ?? '',
    bank_branch: record.bank_branch ?? '',
    account_type: record.account_type ?? '',
    account_number: record.account_number ?? '',
    account_holder: record.account_holder ?? '',
  };
}

function formatYen(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `¥${value.toLocaleString('ja-JP')}`;
}

function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/* ------------------------------------------------------------------ */
/*  Login gate                                                         */
/* ------------------------------------------------------------------ */

function LoginRequired() {
  return (
    <div className="max-w-2xl mx-auto px-6 pt-32 pb-16 text-center">
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
        ログインが必要です
      </h1>
      <p className="text-slate-600 mb-8">
        AI見積書作成ツールのご利用にはFujiTraceアカウントが必要です。
        <br />
        ログイン後、初期費用・月額料金なしですぐにお試しいただけます。
      </p>
      <a
        href="/dashboard"
        className="inline-block bg-blue-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
      >
        ログインして使う
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Business Info Form                                                 */
/* ------------------------------------------------------------------ */

interface BusinessInfoFormProps {
  initial: BusinessInfoFormData;
  existingId: string | null;
  onSaved: (record: BusinessInfo) => void;
}

function BusinessInfoForm({ initial, existingId, onSaved }: BusinessInfoFormProps) {
  const [data, setData] = useState<BusinessInfoFormData>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  useEffect(() => {
    setData(initial);
  }, [initial]);

  const update = useCallback((field: keyof BusinessInfoFormData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
    if (field === 'invoice_number') {
      if (value !== '' && !INVOICE_PATTERN.test(value)) {
        setInvoiceError('インボイス番号は T+数字13桁 の形式で入力してください');
      } else {
        setInvoiceError(null);
      }
    }
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!data.company_name.trim()) {
      setErrorMessage('会社名は必須です');
      return;
    }
    if (data.invoice_number !== '' && !INVOICE_PATTERN.test(data.invoice_number)) {
      setInvoiceError('インボイス番号は T+数字13桁 の形式で入力してください');
      return;
    }

    setSubmitting(true);
    try {
      const url = existingId
        ? `/api/tools/business-info/${existingId}`
        : '/api/tools/business-info';
      const method = existingId ? 'PUT' : 'POST';
      const payload = {
        ...data,
        // Send null for empty optional fields
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        invoice_number: data.invoice_number || null,
        bank_name: data.bank_name || null,
        bank_branch: data.bank_branch || null,
        account_type: data.account_type || null,
        account_number: data.account_number || null,
        account_holder: data.account_holder || null,
      };
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json: ApiEnvelope<BusinessInfo> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        setErrorMessage(json.error ?? '事業情報の保存に失敗しました');
        return;
      }
      setSuccessMessage('事業情報を保存しました');
      onSaved(json.data);
    } catch (err) {
      setErrorMessage('通信エラーが発生しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <form onSubmit={submit} className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">事業情報</h2>
        <p className="text-sm text-slate-600">
          見積書に記載される発行元の情報です。最初に一度だけ登録すれば、以降の見積書作成で自動的に使用されます。
        </p>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-800 mb-2">基本情報</legend>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="company_name">
            会社名 / 屋号 <span className="text-red-600">*</span>
          </label>
          <input
            id="company_name"
            type="text"
            className={inputClass}
            value={data.company_name}
            onChange={(e) => update('company_name', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="address">
            住所
          </label>
          <input
            id="address"
            type="text"
            className={inputClass}
            value={data.address}
            onChange={(e) => update('address', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="phone">
              電話番号
            </label>
            <input
              id="phone"
              type="text"
              className={inputClass}
              value={data.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              className={inputClass}
              value={data.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="invoice_number">
            インボイス番号（適格請求書発行事業者登録番号）
          </label>
          <input
            id="invoice_number"
            type="text"
            placeholder="T1234567890123"
            className={inputClass}
            value={data.invoice_number}
            onChange={(e) => update('invoice_number', e.target.value)}
            aria-invalid={invoiceError !== null}
            aria-describedby="invoice_number_help"
          />
          <p id="invoice_number_help" className="text-xs text-slate-500 mt-1">
            T+数字13桁 形式（例: T1234567890123）
          </p>
          {invoiceError && (
            <p className="text-xs text-red-600 mt-1" role="alert">
              {invoiceError}
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-800 mb-2">振込先情報</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="bank_name">
              銀行名
            </label>
            <input
              id="bank_name"
              type="text"
              className={inputClass}
              value={data.bank_name}
              onChange={(e) => update('bank_name', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="bank_branch">
              支店名
            </label>
            <input
              id="bank_branch"
              type="text"
              className={inputClass}
              value={data.bank_branch}
              onChange={(e) => update('bank_branch', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="account_type">
              口座種別
            </label>
            <select
              id="account_type"
              className={inputClass}
              value={data.account_type}
              onChange={(e) => update('account_type', e.target.value)}
            >
              <option value="">選択してください</option>
              <option value="普通">普通</option>
              <option value="当座">当座</option>
            </select>
          </div>
          <div>
            <label
              className="block text-sm font-medium text-slate-700 mb-1"
              htmlFor="account_number"
            >
              口座番号
            </label>
            <input
              id="account_number"
              type="text"
              className={inputClass}
              value={data.account_number}
              onChange={(e) => update('account_number', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label
            className="block text-sm font-medium text-slate-700 mb-1"
            htmlFor="account_holder"
          >
            口座名義
          </label>
          <input
            id="account_holder"
            type="text"
            className={inputClass}
            value={data.account_holder}
            onChange={(e) => update('account_holder', e.target.value)}
          />
        </div>
      </fieldset>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700" role="alert">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md px-4 py-3 text-sm text-green-700" role="status">
          {successMessage}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white font-medium px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? '保存中...' : existingId ? '事業情報を更新' : '事業情報を登録'}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Estimate Preview                                                   */
/* ------------------------------------------------------------------ */

function EstimatePreview({ estimate }: { estimate: EstimateData | null }) {
  if (!estimate) {
    return (
      <div className="border border-slate-200 rounded-lg p-8 bg-slate-50 text-center text-sm text-slate-500 h-full min-h-[400px] flex items-center justify-center">
        <p>
          左のチャットでAIに見積もり内容を伝えると、
          <br />
          ここにリアルタイムでプレビューが表示されます
        </p>
      </div>
    );
  }
  return (
    <div className="border border-slate-200 rounded-lg p-6 bg-white text-sm text-slate-800">
      <header className="border-b border-slate-200 pb-4 mb-4">
        <p className="text-xs text-slate-500">見積番号</p>
        <p className="font-mono">{estimate.estimate_number || '-'}</p>
        <p className="mt-2 text-xs text-slate-500">発行日 / 有効期限</p>
        <p>
          {estimate.issue_date || '-'} / {estimate.valid_until || '-'}
        </p>
      </header>

      <section className="mb-4">
        <p className="text-xs text-slate-500">宛先</p>
        <p className="text-base font-bold">
          {estimate.client?.company_name || '-'} {estimate.client?.honorific || ''}
        </p>
        {estimate.client?.contact_person && (
          <p className="text-sm text-slate-700">{estimate.client.contact_person} 様</p>
        )}
      </section>

      <section className="mb-4">
        <p className="text-xs text-slate-500">件名</p>
        <p className="font-medium">{estimate.subject || '-'}</p>
      </section>

      <section className="mb-4">
        <p className="text-xs text-slate-500 mb-2">明細</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-slate-200">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-1 text-left border-b border-slate-200">項目</th>
                <th className="px-2 py-1 text-right border-b border-slate-200">数量</th>
                <th className="px-2 py-1 text-left border-b border-slate-200">単位</th>
                <th className="px-2 py-1 text-right border-b border-slate-200">単価</th>
                <th className="px-2 py-1 text-right border-b border-slate-200">税率</th>
                <th className="px-2 py-1 text-right border-b border-slate-200">小計</th>
              </tr>
            </thead>
            <tbody>
              {(estimate.items ?? []).map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="px-2 py-1">
                    <div className="font-medium">{item.name}</div>
                    {item.description && (
                      <div className="text-slate-500 text-xs">{item.description}</div>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right">{item.quantity}</td>
                  <td className="px-2 py-1">{item.unit}</td>
                  <td className="px-2 py-1 text-right">{formatYen(item.unit_price)}</td>
                  <td className="px-2 py-1 text-right">{item.tax_rate}%</td>
                  <td className="px-2 py-1 text-right">{formatYen(item.subtotal)}</td>
                </tr>
              ))}
              {(estimate.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-3 text-center text-slate-400">
                    （明細未入力）
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-slate-200 pt-3 mb-4 text-right space-y-1">
        <div>
          <span className="text-xs text-slate-500 mr-3">小計</span>
          <span className="font-medium">{formatYen(estimate.subtotal)}</span>
        </div>
        <div>
          <span className="text-xs text-slate-500 mr-3">消費税</span>
          <span className="font-medium">{formatYen(estimate.tax_amount)}</span>
        </div>
        <div className="text-base">
          <span className="text-xs text-slate-500 mr-3">合計</span>
          <span className="font-bold text-blue-700">{formatYen(estimate.total)}</span>
        </div>
      </section>

      <section className="text-xs text-slate-600 space-y-1">
        {estimate.delivery_date && (
          <p>
            <span className="text-slate-500">納期: </span>
            {estimate.delivery_date}
          </p>
        )}
        {estimate.payment_terms && (
          <p>
            <span className="text-slate-500">支払条件: </span>
            {estimate.payment_terms}
          </p>
        )}
        {estimate.notes && (
          <p>
            <span className="text-slate-500">備考: </span>
            {estimate.notes}
          </p>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Check Result Card                                                  */
/* ------------------------------------------------------------------ */

function EstimateCheckResultCard({ result }: { result: CheckResult }) {
  const statusStyles: Record<CheckResult['status'], string> = {
    ok: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };
  const statusLabel: Record<CheckResult['status'], string> = {
    ok: '問題は検出されませんでした',
    warning: '注意事項があります',
    error: '重大な問題が検出されました',
  };

  return (
    <section
      className={`border rounded-lg p-5 mt-4 ${statusStyles[result.status]}`}
      aria-label="AIチェック結果"
    >
      <h3 className="text-base font-bold mb-3">AIチェック結果: {statusLabel[result.status]}</h3>

      {result.critical_issues.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-bold text-red-700 mb-2">重大な問題</h4>
          <ul className="space-y-2">
            {result.critical_issues.map((issue, idx) => (
              <li
                key={idx}
                className="text-sm bg-white border border-red-200 rounded px-3 py-2 text-slate-800"
              >
                <span className="font-mono text-xs text-red-600 mr-2">[{issue.field}]</span>
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-bold text-amber-700 mb-2">警告</h4>
          <ul className="space-y-2">
            {result.warnings.map((issue, idx) => (
              <li
                key={idx}
                className="text-sm bg-white border border-amber-200 rounded px-3 py-2 text-slate-800"
              >
                <span className="font-mono text-xs text-amber-600 mr-2">[{issue.field}]</span>
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.suggestions.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-bold text-slate-700 mb-2">改善提案</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-800">
            {result.suggestions.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {result.responsibility_notice && (
        <div className="bg-white border border-slate-300 rounded px-4 py-3 mt-4 text-sm text-slate-800">
          <p className="font-semibold mb-1">最終確認のお願い</p>
          <p className="leading-relaxed">{result.responsibility_notice}</p>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Estimate Chat                                                      */
/* ------------------------------------------------------------------ */

interface EstimateChatProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  pending: boolean;
}

function EstimateChat({ messages, onSend, pending }: EstimateChatProps) {
  const [draft, setDraft] = useState('');

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || pending) return;
    onSend(trimmed);
    setDraft('');
  };

  return (
    <div className="border border-slate-200 rounded-lg bg-white flex flex-col h-[500px] md:h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-slate-500 text-center mt-8">
            <p>AIがいくつか質問しますので、</p>
            <p>順番にお答えください。</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500">
              AIが考えています...
            </div>
          </div>
        )}
      </div>
      <form onSubmit={submit} className="border-t border-slate-200 p-3 flex gap-2">
        <input
          type="text"
          className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="メッセージを入力..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={pending}
          aria-label="チャット入力"
        />
        <button
          type="submit"
          disabled={pending || draft.trim() === ''}
          className="bg-blue-600 text-white font-medium px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
        >
          送信
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function EstimateToolPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('create');

  // Business info state
  const [businessInfos, setBusinessInfos] = useState<BusinessInfo[]>([]);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [businessLoadError, setBusinessLoadError] = useState<string | null>(null);

  // Chat / estimate state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Check / pdf state
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setAuthChecked(true);
  }, []);

  // Fetch business info on mount (only if logged in)
  const refreshBusinessInfos = useCallback(async () => {
    setBusinessLoading(true);
    setBusinessLoadError(null);
    try {
      const res = await fetch('/api/tools/business-info', {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const json: ApiEnvelope<BusinessInfo[]> = await res.json();
      if (!res.ok || !json.success) {
        setBusinessLoadError(json.error ?? '事業情報の取得に失敗しました');
        return;
      }
      setBusinessInfos(json.data ?? []);
    } catch {
      setBusinessLoadError('通信エラーが発生しました');
    } finally {
      setBusinessLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) {
      void refreshBusinessInfos();
    }
  }, [loggedIn, refreshBusinessInfos]);

  const primaryBusinessInfo = useMemo(() => businessInfos[0] ?? null, [businessInfos]);

  const handleBusinessSaved = useCallback((record: BusinessInfo) => {
    setBusinessInfos((prev) => {
      const idx = prev.findIndex((b) => b.id === record.id);
      if (idx === -1) return [record, ...prev];
      const next = prev.slice();
      next[idx] = record;
      return next;
    });
  }, []);

  // Chat send handler
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!primaryBusinessInfo) {
        setChatError('先に事業情報を登録してください');
        return;
      }
      setChatError(null);
      const nextMessages: ChatMessage[] = [...chatMessages, { role: 'user', content }];
      setChatMessages(nextMessages);
      setChatPending(true);
      try {
        const res = await fetch('/api/tools/estimate/create', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            conversation_history: nextMessages,
            business_info_id: primaryBusinessInfo.id,
          }),
        });
        const json: ApiEnvelope<CreateApiResponse> = await res.json();
        if (!res.ok || !json.success || !json.data) {
          setChatError(json.error ?? 'AI応答の取得に失敗しました');
          return;
        }
        if (json.data.estimate) {
          setEstimate(json.data.estimate);
          // Reset prior check result whenever estimate changes
          setCheckResult(null);
        }
        if (json.data.next_question) {
          setChatMessages((prev) => [
            ...prev,
            { role: 'assistant', content: json.data!.next_question! },
          ]);
        } else if (json.data.estimate) {
          setChatMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                '見積書のドラフトを生成しました。右のプレビューをご確認のうえ、必要なら追加の指示を入力してください。',
            },
          ]);
        }
      } catch {
        setChatError('通信エラーが発生しました');
      } finally {
        setChatPending(false);
      }
    },
    [chatMessages, primaryBusinessInfo],
  );

  // Run AI check
  const handleRunCheck = useCallback(async () => {
    if (!estimate) {
      setCheckError('先に見積書を生成してください');
      return;
    }
    setCheckError(null);
    setChecking(true);
    try {
      const res = await fetch('/api/tools/estimate/check', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          estimate,
          // Include the active business profile so the AI checker can verify
          // invoice number / address etc that are not part of the estimate
          // JSON itself. The backend looks this up server-side.
          ...(primaryBusinessInfo ? { business_info_id: primaryBusinessInfo.id } : {}),
        }),
      });
      const json: ApiEnvelope<CheckApiResponse> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        setCheckError(json.error ?? 'AIチェックに失敗しました');
        return;
      }
      setCheckResult(json.data.check_result);
    } catch {
      setCheckError('通信エラーが発生しました');
    } finally {
      setChecking(false);
    }
  }, [estimate, primaryBusinessInfo]);

  // Download PDF
  const downloadPdf = useCallback(async () => {
    if (!estimate) return;
    setPdfError(null);
    setPdfDownloading(true);
    try {
      const res = await fetch('/api/tools/estimate/pdf', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ estimate, template: 'standard' }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let message = 'PDF出力に失敗しました';
        try {
          const parsed = JSON.parse(text) as ApiEnvelope<unknown>;
          if (parsed.error) message = parsed.error;
        } catch {
          // not JSON; ignore
        }
        setPdfError(message);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `見積書_${todayString()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setPdfError('通信エラーが発生しました');
    } finally {
      setPdfDownloading(false);
    }
  }, [estimate]);

  const handlePdfClick = useCallback(() => {
    const hasErrors =
      checkResult !== null &&
      (checkResult.status === 'error' || checkResult.critical_issues.length > 0);
    if (hasErrors) {
      const ok = window.confirm(
        'AIチェックで重大な問題が検出されています。本当にPDF出力しますか？',
      );
      if (!ok) return;
    }
    void downloadPdf();
  }, [checkResult, downloadPdf]);

  if (!authChecked) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-32 pb-16 text-center text-slate-500">
        読み込み中...
      </div>
    );
  }

  if (!loggedIn) {
    return <LoginRequired />;
  }

  return (
    <div className="bg-white">
        {/* Page header */}
        <section className="pt-28 pb-6 px-6 border-b border-slate-200 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <p className="text-xs text-slate-500 mb-1">FujiTrace AI Tools</p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              AI見積書作成＆チェック
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              AIと対話するだけで、計算ミス・過小見積り・インボイス制度対応の検証が済んだ見積書を生成します。
            </p>
          </div>
        </section>

        {/* Tabs */}
        <section className="px-6 border-b border-slate-200 bg-white sticky top-16 z-10">
          <div className="max-w-6xl mx-auto">
            <nav className="flex gap-1 -mb-px" aria-label="タブ">
              {(
                [
                  { key: 'business-info', label: '事業情報' },
                  { key: 'create', label: '新規作成' },
                  { key: 'history', label: '履歴' },
                ] as Array<{ key: TabKey; label: string }>
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                  aria-current={activeTab === tab.key ? 'page' : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </section>

        <section className="px-6 py-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'business-info' && (
              <div>
                {businessLoading ? (
                  <p className="text-sm text-slate-500">読み込み中...</p>
                ) : businessLoadError ? (
                  <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700 mb-6">
                    {businessLoadError}
                  </div>
                ) : null}
                <BusinessInfoForm
                  initial={
                    primaryBusinessInfo
                      ? recordToFormData(primaryBusinessInfo)
                      : emptyBusinessForm()
                  }
                  existingId={primaryBusinessInfo?.id ?? null}
                  onSaved={handleBusinessSaved}
                />
              </div>
            )}

            {activeTab === 'create' && (
              <div>
                {businessLoading ? (
                  <p className="text-sm text-slate-500">読み込み中...</p>
                ) : !primaryBusinessInfo ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 text-sm text-amber-800">
                    <p className="font-semibold mb-1">先に事業情報を登録してください</p>
                    <p>
                      見積書には発行元の会社情報・インボイス番号が必須です。
                      <button
                        type="button"
                        onClick={() => setActiveTab('business-info')}
                        className="ml-1 underline text-blue-700 hover:text-blue-900"
                      >
                        事業情報タブへ移動
                      </button>
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-700 mb-2">
                          AIとの対話
                        </h2>
                        <EstimateChat
                          messages={chatMessages}
                          onSend={handleSendMessage}
                          pending={chatPending}
                        />
                        {chatError && (
                          <div
                            className="mt-2 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700"
                            role="alert"
                          >
                            {chatError}
                          </div>
                        )}
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-slate-700 mb-2">
                          見積書プレビュー
                        </h2>
                        <EstimatePreview estimate={estimate} />
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="mt-6 sticky bottom-0 bg-white border-t border-slate-200 py-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
                      {(checkError || pdfError) && (
                        <div
                          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 sm:mr-auto"
                          role="alert"
                        >
                          {checkError ?? pdfError}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleRunCheck}
                        disabled={!estimate || checking}
                        className="bg-white border border-blue-600 text-blue-700 font-medium px-5 py-2.5 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                      >
                        {checking ? 'AIチェック中...' : 'AIチェック実行'}
                      </button>
                      <button
                        type="button"
                        onClick={handlePdfClick}
                        disabled={!estimate || pdfDownloading}
                        className={`font-medium px-5 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                          checkResult !== null &&
                          (checkResult.status === 'error' ||
                            checkResult.critical_issues.length > 0)
                            ? 'bg-amber-600 text-white hover:bg-amber-700'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {pdfDownloading ? 'PDF生成中...' : 'PDF出力'}
                      </button>
                    </div>

                    {checkResult && <EstimateCheckResultCard result={checkResult} />}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="border border-slate-200 rounded-lg p-10 bg-slate-50 text-center">
                <h2 className="text-base font-bold text-slate-800 mb-2">履歴機能は準備中です</h2>
                <p className="text-sm text-slate-600">
                  作成済み見積書の一覧・再編集機能を近日中に提供予定です。
                </p>
              </div>
            )}
          </div>
        </section>
    </div>
  );
}
