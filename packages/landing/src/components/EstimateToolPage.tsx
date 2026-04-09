import { useState, useEffect, useCallback, useMemo } from 'react';

/* ------------------------------------------------------------------ */
/*  Auth helpers                                                       */
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

interface ArithmeticCheck {
  ok: boolean;
  expected_subtotal?: number;
  actual_subtotal?: number;
  expected_tax?: number;
  actual_tax?: number;
  expected_total?: number;
  actual_total?: number;
  message?: string;
}

interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  critical_issues: CheckIssue[];
  warnings: CheckIssue[];
  suggestions: (string | CheckIssue)[];
  responsibility_notice?: string;
  arithmetic_check?: ArithmeticCheck;
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

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const INVOICE_PATTERN = /^T\d{13}$/u;

const PAYMENT_TERM_PRESETS = [
  '月末締翌月末払い',
  '月末締翌々月末払い',
  '月末締翌月10日払い',
  '月末締翌月15日払い',
  '月末締翌月20日払い',
  '月末締翌月25日払い',
  '15日締当月末払い',
  '20日締翌月20日払い',
  '納品時現金払い',
  '前金50% / 納品時50%',
] as const;
const PAYMENT_TERM_CUSTOM = 'その他 (自由入力)' as const;

const DELIVERY_DATE_PRESETS = [
  '別途ご相談',
  '即納 (発注後3日以内)',
  '発注後1週間以内',
  '発注後2週間以内',
  '発注後1ヶ月以内',
  '発注後2ヶ月以内',
  '発注後3ヶ月以内',
] as const;
const DELIVERY_DATE_BY_DATE = '日付を指定する' as const;
const DELIVERY_DATE_CUSTOM = 'その他 (自由入力)' as const;

/** Convert ISO date string (YYYY-MM-DD) to Japanese format (YYYY年M月D日). */
function formatJapaneseDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso);
  if (!match) return iso;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return `${y}年${m}月${d}日`;
}

/** Keywords that upgrade a warning into a Tier 1 critical issue. */
const TIER1_UPGRADE_KEYWORDS = [
  '誤字',
  '脱字',
  'おかしい',
  '不自然',
  '無意味',
  'テスト入力',
  '敬称',
  'インボイス',
  '日付',
  '明細',
];

/** Keywords that downgrade a warning into a Tier 3 info item. */
const TIER3_DOWNGRADE_KEYWORDS = [
  '相場',
  '業界',
  '単価',
  '過小',
  '過大',
  '業種',
  '平均',
  '市場',
];

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
/*  Analytics                                                          */
/* ------------------------------------------------------------------ */

type TrackPayload = Record<string, string | number | boolean | null | undefined>;

function trackEvent(eventName: string, payload: TrackPayload = {}): void {
  // Placeholder for PostHog / GA4. Swap the console.log with the real SDK call
  // when analytics is wired up (see docs/ファネル設計_AI見積書.md).
  // eslint-disable-next-line no-console
  console.log('[event]', eventName, payload);
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

function normalizeIssue(item: string | CheckIssue): CheckIssue {
  if (typeof item === 'string') {
    return { field: '', severity: 'info', message: item };
  }
  return item;
}

function matchesKeyword(message: string, keywords: readonly string[]): boolean {
  return keywords.some((kw) => message.includes(kw));
}

interface TierBuckets {
  tier1: CheckIssue[];
  tier2: CheckIssue[];
  tier3: CheckIssue[];
}

function classifyIssues(result: CheckResult): TierBuckets {
  const tier1: CheckIssue[] = [...result.critical_issues];
  const tier2: CheckIssue[] = [];
  const tier3: CheckIssue[] = [];

  // Arithmetic failure is always Tier 1
  if (result.arithmetic_check && result.arithmetic_check.ok === false) {
    tier1.unshift({
      field: 'arithmetic',
      severity: 'error',
      message:
        result.arithmetic_check.message ??
        '合計金額の計算に不整合があります。明細を再確認してください。',
    });
  }

  for (const warning of result.warnings) {
    const msg = warning.message ?? '';
    if (matchesKeyword(msg, TIER1_UPGRADE_KEYWORDS)) {
      tier1.push(warning);
    } else if (matchesKeyword(msg, TIER3_DOWNGRADE_KEYWORDS)) {
      tier3.push(warning);
    } else {
      tier2.push(warning);
    }
  }

  for (const sug of result.suggestions) {
    tier3.push(normalizeIssue(sug));
  }

  return { tier1, tier2, tier3 };
}

function EstimateCheckResultCard({ result }: { result: CheckResult }) {
  const buckets = useMemo(() => classifyIssues(result), [result]);

  const handleProClick = () => {
    trackEvent('conversion.pro.click', { from: 'estimate_tool_verify_card' });
  };

  const statusBadge: Record<CheckResult['status'], { className: string; label: string }> = {
    ok: { className: 'bg-green-100 text-green-800', label: '問題なし' },
    warning: { className: 'bg-amber-100 text-amber-800', label: '確認事項あり' },
    error: { className: 'bg-red-100 text-red-800', label: '要修正' },
  };
  const badge = statusBadge[result.status];

  return (
    <section
      className="border border-slate-200 rounded-lg bg-white mt-4 overflow-hidden"
      aria-label="FujiTrace 品質チェック結果"
    >
      {/* Header — 業務的な淡い灰色 */}
      <header className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">FujiTrace 品質チェック</h3>
          <p className="text-xs text-slate-600 mt-0.5">
            書類の成立性・日本語品質・インボイス整合性を確認しました
          </p>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}
          role="status"
        >
          {badge.label}
        </span>
      </header>

      <div className="p-5 space-y-4">
        {/* Tier 1 — Critical (必ず展開) */}
        {buckets.tier1.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-md px-4 py-3 text-red-900">
            <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold"
                aria-hidden="true"
              >
                !
              </span>
              書類の不備 ({buckets.tier1.length}件)
            </h4>
            <ul className="space-y-2">
              {buckets.tier1.map((issue, idx) => (
                <li
                  key={`t1-${idx}`}
                  className="text-sm bg-white border border-red-200 rounded px-3 py-2 text-slate-800"
                >
                  {issue.field && (
                    <span className="font-mono text-xs text-red-600 mr-2">[{issue.field}]</span>
                  )}
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tier 2 — Warning (デフォルト展開、0件なら非表示) */}
        {buckets.tier2.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-amber-900">
            <h4 className="text-sm font-bold mb-2">
              記載事項の確認 ({buckets.tier2.length}件)
            </h4>
            <ul className="space-y-2">
              {buckets.tier2.map((issue, idx) => (
                <li
                  key={`t2-${idx}`}
                  className="text-sm bg-white border border-amber-200 rounded px-3 py-2 text-slate-800"
                >
                  {issue.field && (
                    <span className="font-mono text-xs text-amber-700 mr-2">[{issue.field}]</span>
                  )}
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tier 3 — Info (折りたたみ、デフォルト閉) */}
        {buckets.tier3.length > 0 && (
          <details className="bg-slate-50 border border-slate-200 rounded-md text-slate-700">
            <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 rounded-md">
              参考情報 ({buckets.tier3.length}件)
            </summary>
            <div className="px-4 pb-3 pt-1 space-y-2">
              <p className="text-xs text-slate-500 italic">
                AI による相場推定はあくまで参考値です。SaaS
                や独自商品の場合は信頼できないことがあります。
              </p>
              <ul className="space-y-1.5">
                {buckets.tier3.map((issue, idx) => (
                  <li
                    key={`t3-${idx}`}
                    className="text-sm bg-white border border-slate-200 rounded px-3 py-2 text-slate-700"
                  >
                    {issue.field && (
                      <span className="font-mono text-xs text-slate-500 mr-2">
                        [{issue.field}]
                      </span>
                    )}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}

        {/* OK ケース */}
        {buckets.tier1.length === 0 &&
          buckets.tier2.length === 0 &&
          buckets.tier3.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-md px-4 py-3 text-sm text-green-800">
              チェック項目に問題は検出されませんでした。
            </div>
          )}

        {/* 責任の閾値 — Tier の下に配置 */}
        {result.responsibility_notice && (
          <div className="bg-white border border-slate-300 rounded px-4 py-3 text-sm text-slate-800">
            <p className="font-semibold mb-1">最終確認のお願い</p>
            <p className="leading-relaxed">{result.responsibility_notice}</p>
          </div>
        )}

        {/* Pro upsell footer */}
        <div className="pt-4 border-t border-slate-200">
          <div className="text-sm text-slate-700">
            <p className="leading-relaxed">
              このチェックは無料版で1回のみ実行されました。
              <br className="hidden sm:inline" />
              <span className="text-slate-600">
                Proでは全AI出力を継続監視し、過去のパターンと照合して異常を自動検出します。
              </span>
            </p>
            <a
              href="/pricing"
              onClick={handleProClick}
              className="inline-block mt-2 text-blue-700 hover:text-blue-900 font-medium text-sm underline-offset-2 hover:underline"
            >
              FujiTrace Pro を見る →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Estimate Chat                                                      */
/*  NOTE: Chat UI has been removed from EstimateToolPage (2026-04-09). */
/*  Component definition kept for reuse in future responsibility AI    */
/*  tools where a form-first workflow may not fit.                     */
/*  TODO: reuse in other tools                                         */
/* ------------------------------------------------------------------ */

interface EstimateChatProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  pending: boolean;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export function EstimateChat({ messages, onSend, pending }: EstimateChatProps) {
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
/* eslint-enable @typescript-eslint/no-unused-vars */

/* ------------------------------------------------------------------ */
/*  Estimate Form (Form-First UX, 2026-04-09)                          */
/* ------------------------------------------------------------------ */

function defaultEstimateNumber(): string {
  return `EST-${todayString()}-001`;
}

function defaultIssueDate(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function emptyItem(): EstimateItem {
  return {
    name: '',
    description: '',
    quantity: 1,
    unit: '式',
    unit_price: 0,
    tax_rate: 10,
    subtotal: 0,
  };
}

function emptyEstimateData(): EstimateData {
  return {
    estimate_number: defaultEstimateNumber(),
    issue_date: defaultIssueDate(),
    valid_until: defaultValidUntil(),
    client: {
      company_name: '',
      contact_person: '',
      honorific: '御中',
    },
    subject: '',
    items: [emptyItem()],
    subtotal: 0,
    tax_amount: 0,
    total: 0,
    delivery_date: DELIVERY_DATE_PRESETS[0],
    payment_terms: PAYMENT_TERM_PRESETS[0],
    notes: '',
  };
}

function recomputeTotals(data: EstimateData): EstimateData {
  const items = data.items.map((it) => ({
    ...it,
    subtotal: Math.round((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)),
  }));
  const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0);
  const tax_amount = items.reduce(
    (sum, it) => sum + Math.floor((it.subtotal * (Number(it.tax_rate) || 0)) / 100),
    0,
  );
  const total = subtotal + tax_amount;
  return { ...data, items, subtotal, tax_amount, total };
}

interface EstimateFormProps {
  data: EstimateData;
  onChange: (next: EstimateData) => void;
  onVerify: () => void;
  verifying: boolean;
  validationError: string | null;
}

function EstimateForm({
  data,
  onChange,
  onVerify,
  verifying,
  validationError,
}: EstimateFormProps) {
  const inputClass =
    'w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  // Payment terms: preset / custom mode detection
  const isPaymentPreset = (PAYMENT_TERM_PRESETS as readonly string[]).includes(data.payment_terms);
  const [paymentCustomMode, setPaymentCustomMode] = useState<boolean>(
    !isPaymentPreset && data.payment_terms !== '',
  );

  // Delivery date: preset / by-date / custom mode detection
  const isDeliveryPreset = (DELIVERY_DATE_PRESETS as readonly string[]).includes(
    data.delivery_date,
  );
  const looksLikeJapaneseDate = /^\d{4}年\d{1,2}月\d{1,2}日$/u.test(data.delivery_date);
  type DeliveryMode = 'preset' | 'by-date' | 'custom';
  const initialDeliveryMode: DeliveryMode = isDeliveryPreset
    ? 'preset'
    : looksLikeJapaneseDate
      ? 'by-date'
      : data.delivery_date !== ''
        ? 'custom'
        : 'preset';
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(initialDeliveryMode);
  const [deliveryIsoDate, setDeliveryIsoDate] = useState<string>('');

  const updateField = <K extends keyof EstimateData>(field: K, value: EstimateData[K]) => {
    onChange(recomputeTotals({ ...data, [field]: value }));
  };

  const updateClient = <K extends keyof EstimateClient>(field: K, value: EstimateClient[K]) => {
    onChange(recomputeTotals({ ...data, client: { ...data.client, [field]: value } }));
  };

  const updateItem = <K extends keyof EstimateItem>(
    index: number,
    field: K,
    value: EstimateItem[K],
  ) => {
    const items = data.items.slice();
    items[index] = { ...items[index], [field]: value };
    onChange(recomputeTotals({ ...data, items }));
  };

  const addItem = () => {
    onChange(recomputeTotals({ ...data, items: [...data.items, emptyItem()] }));
  };

  const removeItem = (index: number) => {
    if (data.items.length <= 1) return;
    const items = data.items.slice();
    items.splice(index, 1);
    onChange(recomputeTotals({ ...data, items }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onVerify();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="見積書フォーム">
      {/* Header section: subject / dates / number */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-800 mb-1">基本情報</legend>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ef-subject">
            件名 <span className="text-red-600">*</span>
          </label>
          <input
            id="ef-subject"
            type="text"
            className={inputClass}
            value={data.subject}
            onChange={(e) => updateField('subject', e.target.value)}
            placeholder="例: 〇〇システム開発一式"
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ef-number">
              見積番号
            </label>
            <input
              id="ef-number"
              type="text"
              className={inputClass}
              value={data.estimate_number}
              onChange={(e) => updateField('estimate_number', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ef-issue">
              発行日
            </label>
            <input
              id="ef-issue"
              type="date"
              className={inputClass}
              value={data.issue_date}
              onChange={(e) => updateField('issue_date', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ef-valid">
              有効期限
            </label>
            <input
              id="ef-valid"
              type="date"
              className={inputClass}
              value={data.valid_until}
              onChange={(e) => updateField('valid_until', e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {/* Client section */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-800 mb-1">宛先</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ef-client-company">
              会社名 <span className="text-red-600">*</span>
            </label>
            <input
              id="ef-client-company"
              type="text"
              className={inputClass}
              value={data.client.company_name}
              onChange={(e) => updateClient('company_name', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ef-client-honorific">
              敬称
            </label>
            <select
              id="ef-client-honorific"
              className={inputClass}
              value={data.client.honorific}
              onChange={(e) => updateClient('honorific', e.target.value)}
            >
              <option value="御中">御中</option>
              <option value="様">様</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ef-client-contact">
            担当者名
          </label>
          <input
            id="ef-client-contact"
            type="text"
            className={inputClass}
            value={data.client.contact_person}
            onChange={(e) => updateClient('contact_person', e.target.value)}
            placeholder="例: 山田 太郎"
          />
        </div>
      </fieldset>

      {/* Items section */}
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-slate-800 mb-1">明細</legend>
        <div className="space-y-3">
          {data.items.map((item, idx) => (
            <div
              key={idx}
              className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">明細 {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  disabled={data.items.length <= 1}
                  className="text-xs text-red-600 hover:text-red-800 disabled:text-slate-400 disabled:cursor-not-allowed"
                  aria-label={`明細 ${idx + 1} を削除`}
                >
                  行を削除
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor={`ef-item-name-${idx}`}>
                  品名 <span className="text-red-600">*</span>
                </label>
                <input
                  id={`ef-item-name-${idx}`}
                  type="text"
                  className={inputClass}
                  value={item.name}
                  onChange={(e) => updateItem(idx, 'name', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor={`ef-item-desc-${idx}`}>
                  説明
                </label>
                <input
                  id={`ef-item-desc-${idx}`}
                  type="text"
                  className={inputClass}
                  value={item.description}
                  onChange={(e) => updateItem(idx, 'description', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor={`ef-item-qty-${idx}`}>
                    数量
                  </label>
                  <input
                    id={`ef-item-qty-${idx}`}
                    type="number"
                    min={0}
                    step={1}
                    className={inputClass}
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor={`ef-item-unit-${idx}`}>
                    単位
                  </label>
                  <input
                    id={`ef-item-unit-${idx}`}
                    type="text"
                    className={inputClass}
                    value={item.unit}
                    onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor={`ef-item-price-${idx}`}>
                    単価
                  </label>
                  <input
                    id={`ef-item-price-${idx}`}
                    type="number"
                    min={0}
                    step={1}
                    className={inputClass}
                    value={item.unit_price}
                    onChange={(e) => updateItem(idx, 'unit_price', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor={`ef-item-tax-${idx}`}>
                    税率
                  </label>
                  <select
                    id={`ef-item-tax-${idx}`}
                    className={inputClass}
                    value={item.tax_rate}
                    onChange={(e) => updateItem(idx, 'tax_rate', Number(e.target.value))}
                  >
                    <option value={10}>10%</option>
                    <option value={8}>8%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">小計</label>
                  <div
                    className="w-full border border-slate-200 bg-slate-100 rounded-md px-3 py-2 text-sm text-slate-800 text-right tabular-nums"
                    aria-label={`明細 ${idx + 1} の小計`}
                  >
                    {formatYen(item.subtotal)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="text-sm text-blue-700 hover:text-blue-900 font-medium border border-dashed border-blue-300 hover:border-blue-500 rounded-md px-4 py-2 w-full"
        >
          ＋ 行を追加
        </button>
      </fieldset>

      {/* Footer fields */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-800 mb-1">取引条件</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ef-delivery">
              納期
            </label>
            <select
              id="ef-delivery"
              className={inputClass}
              value={
                deliveryMode === 'by-date'
                  ? DELIVERY_DATE_BY_DATE
                  : deliveryMode === 'custom'
                    ? DELIVERY_DATE_CUSTOM
                    : (DELIVERY_DATE_PRESETS as readonly string[]).includes(data.delivery_date)
                      ? data.delivery_date
                      : DELIVERY_DATE_PRESETS[0]
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === DELIVERY_DATE_BY_DATE) {
                  setDeliveryMode('by-date');
                  // Keep current date if already set, otherwise clear
                  if (deliveryIsoDate) {
                    updateField('delivery_date', formatJapaneseDate(deliveryIsoDate));
                  } else {
                    updateField('delivery_date', '');
                  }
                } else if (v === DELIVERY_DATE_CUSTOM) {
                  setDeliveryMode('custom');
                  updateField('delivery_date', '');
                } else {
                  setDeliveryMode('preset');
                  updateField('delivery_date', v);
                }
              }}
            >
              {DELIVERY_DATE_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
              <option value={DELIVERY_DATE_BY_DATE}>{DELIVERY_DATE_BY_DATE}</option>
              <option value={DELIVERY_DATE_CUSTOM}>{DELIVERY_DATE_CUSTOM}</option>
            </select>
            {deliveryMode === 'by-date' && (
              <input
                type="date"
                className={`${inputClass} mt-2`}
                value={deliveryIsoDate}
                onChange={(e) => {
                  const iso = e.target.value;
                  setDeliveryIsoDate(iso);
                  updateField('delivery_date', iso ? formatJapaneseDate(iso) : '');
                }}
                aria-label="納期の日付"
              />
            )}
            {deliveryMode === 'custom' && (
              <input
                type="text"
                className={`${inputClass} mt-2`}
                value={data.delivery_date}
                onChange={(e) => updateField('delivery_date', e.target.value)}
                placeholder="例: 2026年5月末日"
                aria-label="納期 (自由入力)"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ef-payment">
              支払条件
            </label>
            <select
              id="ef-payment"
              className={inputClass}
              value={
                paymentCustomMode
                  ? PAYMENT_TERM_CUSTOM
                  : (PAYMENT_TERM_PRESETS as readonly string[]).includes(data.payment_terms)
                    ? data.payment_terms
                    : PAYMENT_TERM_PRESETS[0]
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === PAYMENT_TERM_CUSTOM) {
                  setPaymentCustomMode(true);
                  updateField('payment_terms', '');
                } else {
                  setPaymentCustomMode(false);
                  updateField('payment_terms', v);
                }
              }}
            >
              {PAYMENT_TERM_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
              <option value={PAYMENT_TERM_CUSTOM}>{PAYMENT_TERM_CUSTOM}</option>
            </select>
            {paymentCustomMode && (
              <input
                type="text"
                className={`${inputClass} mt-2`}
                value={data.payment_terms}
                onChange={(e) => updateField('payment_terms', e.target.value)}
                placeholder="例: 月末締め翌々月15日払い"
                aria-label="支払条件 (自由入力)"
              />
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ef-notes">
            備考
          </label>
          <textarea
            id="ef-notes"
            className={`${inputClass} min-h-[80px]`}
            value={data.notes}
            onChange={(e) => updateField('notes', e.target.value)}
          />
        </div>
      </fieldset>

      {/* Live totals summary */}
      <div
        className="border border-slate-300 rounded-lg bg-slate-50 p-4"
        aria-label="合計金額サマリー"
        aria-live="polite"
      >
        <div className="flex justify-between text-sm text-slate-700 mb-1">
          <span>小計</span>
          <span className="tabular-nums">{formatYen(data.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-700 mb-2">
          <span>消費税</span>
          <span className="tabular-nums">{formatYen(data.tax_amount)}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-300 pt-2">
          <span>合計</span>
          <span className="tabular-nums text-blue-700">{formatYen(data.total)}</span>
        </div>
      </div>

      {validationError && (
        <div
          className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {validationError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={verifying}
          className="bg-blue-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          aria-label="見積書をAIで検証する"
        >
          {verifying ? 'AIが検証中...' : '見積書を検証'}
        </button>
      </div>
    </form>
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

  // Form state (form-first UX, 2026-04-09)
  const [estimateForm, setEstimateForm] = useState<EstimateData>(() =>
    recomputeTotals(emptyEstimateData()),
  );
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Check / pdf state
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  // 判断B: PDF DL を critical 時にブロックする承知チェックボックス
  const [acknowledgeDownload, setAcknowledgeDownload] = useState(false);

  // The estimate used for downstream actions (PDF) is the form data itself.
  const estimate: EstimateData = estimateForm;

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

  // Form change handler — clears stale verification when the user edits.
  const handleFormChange = useCallback((next: EstimateData) => {
    setEstimateForm(next);
    setCheckResult(null);
    setCheckError(null);
    setAcknowledgeDownload(false);
    setPdfError(null);
  }, []);

  // Form-side AI verification handler
  const handleVerifyEstimate = useCallback(async () => {
    setFormValidationError(null);
    setCheckError(null);
    setPdfError(null);

    // Client-side validation
    if (!estimateForm.subject.trim()) {
      setFormValidationError('件名を入力してください');
      return;
    }
    if (!estimateForm.client.company_name.trim()) {
      setFormValidationError('宛先の会社名を入力してください');
      return;
    }
    if (!estimateForm.items.length) {
      setFormValidationError('明細を1行以上入力してください');
      return;
    }
    for (let i = 0; i < estimateForm.items.length; i += 1) {
      const it = estimateForm.items[i];
      if (!it.name.trim()) {
        setFormValidationError(`明細 ${i + 1} の品名を入力してください`);
        return;
      }
      if (!(it.quantity > 0)) {
        setFormValidationError(`明細 ${i + 1} の数量は1以上にしてください`);
        return;
      }
    }

    const normalized = recomputeTotals(estimateForm);
    setEstimateForm(normalized);

    setVerifying(true);
    trackEvent('tool.estimate.verify.form_submit', {
      item_count: normalized.items.length,
      total: normalized.total,
    });
    try {
      const res = await fetch('/api/tools/estimate/check', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          estimate: normalized,
          business_info_id: primaryBusinessInfo?.id,
        }),
      });
      const json: ApiEnvelope<{
        check_result: CheckResult;
        trace_id: string | null;
        arithmetic_check?: ArithmeticCheck;
      }> = await res.json();
      if (!res.ok || !json.success || !json.data) {
        setCheckError(json.error ?? 'AIチェックに失敗しました');
        return;
      }
      const verification = json.data.check_result;
      // Surface arithmetic_check from the top-level field on the envelope
      // through the same CheckResult shape used by the card.
      if (json.data.arithmetic_check && !verification.arithmetic_check) {
        verification.arithmetic_check = {
          ok: json.data.arithmetic_check.ok,
        };
      }
      setCheckResult(verification);
      setAcknowledgeDownload(false);
      trackEvent('tool.estimate.verify.complete', {
        trace_id: json.data.trace_id ?? null,
        status: verification.status,
        critical_count: verification.critical_issues?.length ?? 0,
        warning_count: verification.warnings?.length ?? 0,
      });
      if (
        verification.status === 'error' ||
        (verification.critical_issues && verification.critical_issues.length > 0)
      ) {
        trackEvent('tool.estimate.verify.critical', {
          trace_id: json.data.trace_id ?? null,
          critical_count: verification.critical_issues?.length ?? 0,
        });
      }
    } catch {
      setCheckError('通信エラーが発生しました');
    } finally {
      setVerifying(false);
    }
  }, [estimateForm, primaryBusinessInfo]);

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
      trackEvent('tool.estimate.download', {
        status: checkResult?.status ?? 'unknown',
        acknowledged: acknowledgeDownload,
      });
    } catch {
      setPdfError('通信エラーが発生しました');
    } finally {
      setPdfDownloading(false);
    }
  }, [estimate, checkResult, acknowledgeDownload]);

  // 判断B: critical 時は承知チェックボックスを経由して DL
  const hasCriticalIssues = useMemo(
    () =>
      checkResult !== null &&
      (checkResult.status === 'error' || checkResult.critical_issues.length > 0),
    [checkResult],
  );

  const pdfButtonDisabled =
    !estimate ||
    pdfDownloading ||
    verifying ||
    !checkResult ||
    (hasCriticalIssues && !acknowledgeDownload);

  const handlePdfClick = useCallback(() => {
    if (!estimate) return;
    if (hasCriticalIssues && !acknowledgeDownload) return;
    void downloadPdf();
  }, [estimate, hasCriticalIssues, acknowledgeDownload, downloadPdf]);

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
                  { key: 'create', label: '新規作成' },
                  { key: 'business-info', label: '事業情報' },
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
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      <div className="lg:col-span-3">
                        <h2 className="text-sm font-semibold text-slate-700 mb-2">
                          見積書フォーム
                        </h2>
                        <EstimateForm
                          data={estimateForm}
                          onChange={handleFormChange}
                          onVerify={handleVerifyEstimate}
                          verifying={verifying}
                          validationError={formValidationError}
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <h2 className="text-sm font-semibold text-slate-700 mb-2">
                          見積書プレビュー
                        </h2>
                        <EstimatePreview estimate={estimate} />
                      </div>
                    </div>

                    {/* Verification in progress */}
                    {verifying && (
                      <div
                        className="mt-6 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 flex items-center gap-2"
                        role="status"
                        aria-live="polite"
                      >
                        <span
                          className="inline-block w-3 h-3 rounded-full bg-blue-500 animate-pulse"
                          aria-hidden="true"
                        />
                        AIが見積書を検証中...
                      </div>
                    )}

                    {/* Verification result — large area, FujiTrace differentiator */}
                    {checkResult && (
                      <div className="mt-8">
                        <div className="border-l-4 border-blue-600 pl-4 mb-3">
                          <h2 className="text-xl font-bold text-slate-900">
                            FujiTrace 品質チェック
                          </h2>
                          <p className="text-sm text-slate-600 mt-1">
                            書類の成立性・日本語品質・インボイス整合性を確認しました
                          </p>
                        </div>
                        <EstimateCheckResultCard result={checkResult} />
                      </div>
                    )}

                    {/* Action bar */}
                    <div className="mt-6 sticky bottom-0 bg-white border-t border-slate-200 py-4 flex flex-col gap-3">
                      {(checkError || pdfError) && (
                        <div
                          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2"
                          role="alert"
                        >
                          {checkError ?? pdfError}
                        </div>
                      )}

                      {/* 判断B: critical 時のみ承知チェックボックスを出現 */}
                      {hasCriticalIssues && (
                        <label className="flex items-start gap-2 text-sm text-slate-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                          <input
                            type="checkbox"
                            checked={acknowledgeDownload}
                            onChange={(e) => setAcknowledgeDownload(e.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-red-600"
                            aria-label="重大な問題を確認し、自己責任でダウンロードすることに同意する"
                          />
                          <span className="leading-relaxed">
                            内容を確認し、<strong>自己責任でダウンロードします</strong>
                            <br className="sm:hidden" />
                            <span className="text-xs text-slate-600">
                              （AIチェックで重大な問題が検出されています）
                            </span>
                          </span>
                        </label>
                      )}

                      {!checkResult && !verifying && (
                        <p className="text-xs text-slate-500">
                          PDF出力の前に「見積書を検証」ボタンでAIチェックを実行してください。
                        </p>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handlePdfClick}
                          disabled={pdfButtonDisabled}
                          className={`font-medium px-5 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                            hasCriticalIssues
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          aria-label="見積書をPDF形式でダウンロード"
                        >
                          {pdfDownloading ? 'PDF生成中...' : 'PDF出力'}
                        </button>
                      </div>
                    </div>
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
