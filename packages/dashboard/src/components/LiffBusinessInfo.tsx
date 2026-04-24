/**
 * LiffBusinessInfo — LIFF-hosted "会社情報" form.
 *
 * Rendered at `/liff/business-info` inside the LINE in-app browser. Triggered
 * from the LINE Rich Menu's "🏢 会社情報" button so a LINE user can set or
 * update the company basic info (`user_business_info` row) through a
 * structured form instead of the conversational onboarding in
 * `src/line/onboarding.ts`.
 *
 * Flow:
 *   1. Wait for the LIFF SDK, call `liff.getProfile()` to obtain
 *      `lineUserId`.
 *   2. `GET /api/line/liff-business-info?lineUserId=...` — if a row exists,
 *      pre-fill the form.
 *   3. User edits fields → `POST /api/line/liff-business-info` with
 *      `{ lineUserId, ...fields }`.
 *   4. On success, show a green confirmation banner + "LINEに戻る" button
 *      that calls `closeLiffWindow()`.
 *
 * Deliberately self-contained — types, fetch helpers, and the LIFF profile
 * bootstrap all live here so the LIFF surface does not pull in the
 * AiClerkChat modal hierarchy. Mirrors the minimalist slate styling used by
 * LiffDoc.
 */
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import liff from '@line/liff';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { closeLiffWindow } from '../lib/liff-detect';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AccountType = '普通' | '当座' | '';

interface BusinessInfoFields {
  company_name: string;
  address: string;
  phone: string;
  email: string;
  invoice_number: string;
  bank_name: string;
  bank_branch: string;
  account_type: AccountType;
  account_number: string;
  account_holder: string;
}

const EMPTY_FIELDS: BusinessInfoFields = {
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

interface GetResponseBody {
  success?: boolean;
  data?: Partial<BusinessInfoFields> | null;
  error?: string;
}

interface PostResponseBody {
  success?: boolean;
  error?: string;
}

type BootState =
  | { kind: 'booting' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'loading'; lineUserId: string }
  | {
      kind: 'ready';
      lineUserId: string;
      initial: BusinessInfoFields;
    };

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const LIFF_UNAVAILABLE_MESSAGE =
  'このページはLINE内で開いてください。';
const LOAD_ERROR_MESSAGE =
  '会社情報の取得に失敗しました。通信環境を確認して再度お試しください。';
const SUBMIT_ERROR_FALLBACK =
  '会社情報の保存に失敗しました。時間をおいて再度お試しください。';
const COMPANY_NAME_REQUIRED_MESSAGE = '会社名を入力してください。';

/**
 * Normalise raw DB row (any shape, possibly with extra columns) into the
 * form shape. Any string that isn't a string or is empty becomes the empty
 * string. `account_type` is constrained to the allowed select values.
 */
function coerceFields(raw: Partial<BusinessInfoFields> | null | undefined): BusinessInfoFields {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const acc = str(r.account_type);
  const accountType: AccountType =
    acc === '普通' || acc === '当座' ? acc : '';
  return {
    company_name: str(r.company_name),
    address: str(r.address),
    phone: str(r.phone),
    email: str(r.email),
    invoice_number: str(r.invoice_number),
    bank_name: str(r.bank_name),
    bank_branch: str(r.bank_branch),
    account_type: accountType,
    account_number: str(r.account_number),
    account_holder: str(r.account_holder),
  };
}

/**
 * Build the POST body. Trim all strings; empty becomes `''` which the
 * backend treats as optional. `company_name` is the only required field.
 */
function buildSubmitBody(
  lineUserId: string,
  fields: BusinessInfoFields,
): Record<string, string> {
  return {
    lineUserId,
    company_name: fields.company_name.trim(),
    address: fields.address.trim(),
    phone: fields.phone.trim(),
    email: fields.email.trim(),
    invoice_number: fields.invoice_number.trim(),
    bank_name: fields.bank_name.trim(),
    bank_branch: fields.bank_branch.trim(),
    account_type: fields.account_type.trim(),
    account_number: fields.account_number.trim(),
    account_holder: fields.account_holder.trim(),
  };
}

/**
 * Resolve the current LINE user id via the LIFF SDK.
 *
 * Poll-retries up to ~2s so we work whether main.tsx's init finished before
 * or after this component mounts. Returns null if LIFF is unavailable
 * (e.g. page opened in a regular desktop browser for QA).
 */
async function resolveLineUserId(): Promise<string | null> {
  const maxAttempts = 10;
  const intervalMs = 200;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      // liff.ready resolves after liff.init() completes; if init never ran
      // the promise will never resolve, hence the Promise.race timeout.
      await Promise.race([
        liff.ready,
        new Promise<void>((resolve) => setTimeout(resolve, intervalMs)),
      ]);
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        if (profile && typeof profile.userId === 'string' && profile.userId) {
          return profile.userId;
        }
      }
    } catch {
      // keep polling — SDK may still be initialising.
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LiffBusinessInfo() {
  const [bootState, setBootState] = useState<BootState>({ kind: 'booting' });
  const [fields, setFields] = useState<BusinessInfoFields>(EMPTY_FIELDS);
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });
  const [clientError, setClientError] = useState<string | null>(null);

  /* --- Bootstrap: resolve LINE user + fetch existing row ----------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const lineUserId = await resolveLineUserId();
      if (cancelled) return;
      if (!lineUserId) {
        setBootState({ kind: 'unavailable', message: LIFF_UNAVAILABLE_MESSAGE });
        return;
      }
      setBootState({ kind: 'loading', lineUserId });

      try {
        const res = await fetch(
          `/api/line/liff-business-info?lineUserId=${encodeURIComponent(lineUserId)}`,
          { headers: { Accept: 'application/json' } },
        );
        if (cancelled) return;
        if (!res.ok) {
          setBootState({ kind: 'unavailable', message: LOAD_ERROR_MESSAGE });
          return;
        }
        const body = (await res.json()) as GetResponseBody;
        if (cancelled) return;
        if (!body.success) {
          setBootState({ kind: 'unavailable', message: body.error ?? LOAD_ERROR_MESSAGE });
          return;
        }
        const initial = coerceFields(body.data);
        setFields(initial);
        setBootState({ kind: 'ready', lineUserId, initial });
      } catch {
        if (!cancelled) {
          setBootState({ kind: 'unavailable', message: LOAD_ERROR_MESSAGE });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* --- Field change handlers --------------------------------------- */
  const handleChange = useCallback(
    (key: keyof BusinessInfoFields) =>
      (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const value = e.target.value;
        setFields((prev) => {
          if (key === 'account_type') {
            const next: AccountType =
              value === '普通' || value === '当座' ? value : '';
            return { ...prev, account_type: next };
          }
          return { ...prev, [key]: value };
        });
        // Clear inline client-side error once the user resumes editing.
        if (clientError) setClientError(null);
      },
    [clientError],
  );

  /* --- Submit handler ---------------------------------------------- */
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (bootState.kind !== 'ready' && bootState.kind !== 'loading') return;
      const lineUserId =
        bootState.kind === 'ready' || bootState.kind === 'loading'
          ? bootState.lineUserId
          : null;
      if (!lineUserId) return;

      // Client-side required-field check (matches the server contract).
      if (!fields.company_name.trim()) {
        setClientError(COMPANY_NAME_REQUIRED_MESSAGE);
        return;
      }
      setClientError(null);
      setSubmitState({ kind: 'submitting' });

      try {
        const res = await fetch('/api/line/liff-business-info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(buildSubmitBody(lineUserId, fields)),
        });
        const body = (await res.json().catch(() => ({}))) as PostResponseBody;
        if (!res.ok || !body.success) {
          setSubmitState({
            kind: 'error',
            message: body.error ?? SUBMIT_ERROR_FALLBACK,
          });
          return;
        }
        setSubmitState({ kind: 'success' });
      } catch {
        setSubmitState({ kind: 'error', message: SUBMIT_ERROR_FALLBACK });
      }
    },
    [bootState, fields],
  );

  const handleClose = useCallback(() => {
    try {
      closeLiffWindow();
    } catch {
      // noop — in a regular browser closeLiffWindow is already a noop.
    }
  }, []);

  /* --- Render guards ----------------------------------------------- */
  if (bootState.kind === 'booting' || bootState.kind === 'loading') {
    return <LoadingView />;
  }

  if (bootState.kind === 'unavailable') {
    return <UnavailableView message={bootState.message} onClose={handleClose} />;
  }

  // bootState.kind === 'ready' from here on.
  const submitting = submitState.kind === 'submitting';
  const succeeded = submitState.kind === 'success';
  const serverError =
    submitState.kind === 'error' ? submitState.message : null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="px-5 pt-6 pb-4 bg-white border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">会社情報</h1>
        <p className="mt-1 text-sm text-slate-500">
          見積書・請求書に使用されます
        </p>
      </header>

      <main className="flex-1 px-5 py-5 pb-[120px]">
        {succeeded ? (
          <SuccessView onClose={handleClose} />
        ) : (
          <form
            className="space-y-6"
            onSubmit={handleSubmit}
            noValidate
            aria-labelledby="liff-business-info-heading"
          >
            <h2 id="liff-business-info-heading" className="sr-only">
              会社情報入力フォーム
            </h2>

            {/* --- 基本情報 -------------------------------------- */}
            <FieldSection title="基本情報">
              <FormField
                id="company_name"
                label="会社名"
                required
                placeholder="株式会社○○"
                value={fields.company_name}
                onChange={handleChange('company_name')}
                autoComplete="organization"
              />
              <FormField
                id="address"
                label="住所"
                placeholder="東京都港区..."
                value={fields.address}
                onChange={handleChange('address')}
                autoComplete="street-address"
              />
              <FormField
                id="phone"
                label="電話番号"
                type="tel"
                placeholder="03-1234-5678"
                value={fields.phone}
                onChange={handleChange('phone')}
                autoComplete="tel"
              />
              <FormField
                id="email"
                label="メール"
                type="email"
                placeholder="info@example.co.jp"
                value={fields.email}
                onChange={handleChange('email')}
                autoComplete="email"
              />
              <FormField
                id="invoice_number"
                label="インボイス登録番号"
                placeholder="T1234567890123"
                value={fields.invoice_number}
                onChange={handleChange('invoice_number')}
              />
            </FieldSection>

            {/* --- 振込先 ---------------------------------------- */}
            <FieldSection title="振込先">
              <FormField
                id="bank_name"
                label="銀行名"
                placeholder="三井住友銀行"
                value={fields.bank_name}
                onChange={handleChange('bank_name')}
              />
              <FormField
                id="bank_branch"
                label="支店名"
                placeholder="渋谷支店"
                value={fields.bank_branch}
                onChange={handleChange('bank_branch')}
              />
              <div>
                <label
                  htmlFor="account_type"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  口座種別
                </label>
                <select
                  id="account_type"
                  name="account_type"
                  value={fields.account_type}
                  onChange={handleChange('account_type')}
                  className="w-full h-11 px-3 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="">選択してください</option>
                  <option value="普通">普通</option>
                  <option value="当座">当座</option>
                </select>
              </div>
              <FormField
                id="account_number"
                label="口座番号"
                placeholder="1234567"
                value={fields.account_number}
                onChange={handleChange('account_number')}
                inputMode="numeric"
              />
              <FormField
                id="account_holder"
                label="口座名義"
                placeholder="カ）○○"
                value={fields.account_holder}
                onChange={handleChange('account_holder')}
              />
            </FieldSection>

            {(clientError || serverError) && (
              <div
                className="flex items-start gap-2 p-3 border border-red-200 bg-red-50 rounded-lg"
                role="alert"
              >
                <AlertTriangle
                  className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5"
                  strokeWidth={1.75}
                />
                <p className="text-sm text-red-700">
                  {clientError ?? serverError}
                </p>
              </div>
            )}

            {/* Sticky bottom action bar */}
            <div
              className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-5 py-3"
              style={{
                paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              }}
            >
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 active:bg-slate-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                aria-label="会社情報を保存する"
              >
                {submitting ? (
                  <>
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      strokeWidth={1.75}
                    />
                    保存中…
                  </>
                ) : (
                  '保存する'
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-views                                                          */
/* ------------------------------------------------------------------ */

function FieldSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-900 tracking-wide">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: 'numeric' | 'text' | 'tel' | 'email' | 'none';
}

function FormField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  autoComplete,
  inputMode,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-slate-700 mb-1.5"
      >
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-required={required ? 'true' : undefined}
        className="w-full h-11 px-3 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
      />
    </div>
  );
}

function LoadingView() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6"
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="w-6 h-6 text-slate-500 animate-spin mb-3"
        strokeWidth={1.75}
      />
      <p className="text-sm text-slate-600">読み込み中…</p>
    </div>
  );
}

function UnavailableView({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
        <AlertTriangle
          className="w-6 h-6 text-amber-600"
          strokeWidth={1.75}
        />
      </div>
      <h1 className="text-base font-semibold text-slate-900 mb-2">
        会社情報を開けません
      </h1>
      <p className="text-sm text-slate-600 max-w-sm mb-6">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
        aria-label="LINEに戻る"
      >
        LINEに戻る
      </button>
    </div>
  );
}

function SuccessView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-10">
      <div
        className="flex items-start gap-2 p-4 border border-emerald-200 bg-emerald-50 rounded-lg w-full mb-6"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2
          className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5"
          strokeWidth={1.75}
        />
        <p className="text-sm text-emerald-800 text-left">
          会社情報を保存しました。LINEに戻ってご依頼ください。
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 active:bg-slate-700 transition-colors"
        aria-label="LINEに戻る"
      >
        LINEに戻る
      </button>
    </div>
  );
}

export default LiffBusinessInfo;
