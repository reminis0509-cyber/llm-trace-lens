import { useState, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Polyfill for String.prototype.replaceAll (ES2020 target) */
function replaceAll(source: string, search: string, replacement: string): string {
  return source.split(search).join(replacement);
}

/**
 * Read Supabase session from localStorage to get auth headers.
 * Dashboard and LP share the same domain, so localStorage is shared.
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    // Supabase stores session in localStorage with a key pattern
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
    // localStorage not available or parse error — skip auth
  }
  return headers;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HpFormData {
  businessName: string;
  address: string;
  phone: string;
  hours: string;
  catchcopy: string;
  menuItems: Array<{ name: string; price: string }>;
  stylists: Array<{ name: string }>;
  services: Array<{ name: string; price: string }>;
  representativeName: string;
  qualification: string;
}

type TemplateType = 'restaurant' | 'salon' | 'office';
type StepNumber = 1 | 2 | 3;

interface ValidationErrors {
  businessName?: string;
  address?: string;
  phone?: string;
}

interface GenerationError {
  type: 'auth' | 'rate-limit' | 'total-limit' | 'network' | 'unknown';
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_CATCHCOPY: Record<TemplateType, string> = {
  restaurant: '心を込めた手作り料理でおもてなし',
  salon: 'あなたの美しさを引き出すプロフェッショナルサロン',
  office: '確かな専門知識で、あなたの未来をサポート',
};

const TEMPLATE_INFO: Record<TemplateType, { label: string; description: string; catchcopyPlaceholder: string }> = {
  restaurant: {
    label: '飲食店',
    description: 'レストラン・カフェ・居酒屋など飲食店向け',
    catchcopyPlaceholder: '例: 心を込めた手作り料理でおもてなし',
  },
  salon: {
    label: '美容サロン',
    description: '美容室・ネイルサロン・エステなど美容系',
    catchcopyPlaceholder: '例: あなたの美しさを引き出すプロフェッショナルサロン',
  },
  office: {
    label: '士業事務所',
    description: '弁護士・税理士・行政書士などの士業',
    catchcopyPlaceholder: '例: 確かな専門知識で、あなたの未来をサポート',
  },
};

const PHONE_PATTERN = /^[\d\-（）()\s]+$/;

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

function UtensilsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  );
}

function ScissorsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: create empty form data                                     */
/* ------------------------------------------------------------------ */

function createEmptyFormData(): HpFormData {
  return {
    businessName: '',
    address: '',
    phone: '',
    hours: '',
    catchcopy: '',
    menuItems: Array.from({ length: 6 }, () => ({ name: '', price: '' })),
    stylists: [{ name: '' }, { name: '' }],
    services: Array.from({ length: 4 }, () => ({ name: '', price: '' })),
    representativeName: '',
    qualification: '',
  };
}

/* ------------------------------------------------------------------ */
/*  Step Indicator                                                     */
/* ------------------------------------------------------------------ */

interface StepIndicatorProps {
  currentStep: StepNumber;
}

function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps: Array<{ num: StepNumber; label: string }> = [
    { num: 1, label: '業種を選択' },
    { num: 2, label: '事業情報を入力' },
    { num: 3, label: 'ダウンロード' },
  ];

  return (
    <nav aria-label="作成ステップ" className="flex items-center justify-center mb-12">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors duration-120 ${
                step.num <= currentStep
                  ? 'bg-accent text-white'
                  : 'bg-base-elevated text-text-muted border border-border'
              }`}
              aria-current={step.num === currentStep ? 'step' : undefined}
            >
              {step.num}
            </div>
            <span
              className={`text-sm font-medium hidden sm:inline ${
                step.num <= currentStep ? 'text-text-primary' : 'text-text-muted'
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-8 sm:w-16 h-px mx-2 sm:mx-4 ${
                step.num < currentStep ? 'bg-accent' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1: Template Selection                                         */
/* ------------------------------------------------------------------ */

interface TemplateSelectionProps {
  onSelect: (template: TemplateType) => void;
}

function TemplateSelection({ onSelect }: TemplateSelectionProps) {
  const templates: Array<{
    type: TemplateType;
    icon: (props: { className?: string }) => React.JSX.Element;
  }> = [
    { type: 'restaurant', icon: UtensilsIcon },
    { type: 'salon', icon: ScissorsIcon },
    { type: 'office', icon: BriefcaseIcon },
  ];

  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {templates.map(({ type, icon: Icon }) => {
        const info = TEMPLATE_INFO[type];
        return (
          <div key={type} className="surface-card p-6 text-center">
            <div className="flex justify-center mb-4">
              <Icon className="w-10 h-10 text-accent" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              {info.label}
            </h3>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              {info.description}
            </p>
            <button
              type="button"
              onClick={() => onSelect(type)}
              className="w-full py-2.5 px-4 rounded-card text-sm font-medium text-center transition-colors duration-120 bg-accent text-white hover:bg-accent-hover"
              aria-label={`${info.label}テンプレートで作成`}
            >
              このテンプレートで作成
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2: Business Info Form                                         */
/* ------------------------------------------------------------------ */

interface BusinessFormProps {
  template: TemplateType;
  formData: HpFormData;
  errors: ValidationErrors;
  onChangeField: (field: keyof HpFormData, value: string) => void;
  onChangeMenuItem: (index: number, field: 'name' | 'price', value: string) => void;
  onChangeStylist: (index: number, value: string) => void;
  onChangeService: (index: number, field: 'name' | 'price', value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  visibleMenuRows: number;
  onShowMoreMenu: () => void;
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-text-primary mb-1.5">
        {label}
        {required && <span className="text-status-fail ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-status-fail" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
  type,
  hasError,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
  hasError?: boolean;
  ariaLabel?: string;
}) {
  return (
    <input
      type={type || 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      aria-label={ariaLabel}
      className={`w-full px-3 py-2 text-sm text-text-primary bg-white border rounded-card outline-none transition-colors duration-120 focus:border-accent ${
        hasError ? 'border-status-fail' : 'border-border'
      }`}
    />
  );
}

function BusinessForm({
  template,
  formData,
  errors,
  onChangeField,
  onChangeMenuItem,
  onChangeStylist,
  onChangeService,
  onBack,
  onSubmit,
  visibleMenuRows,
  onShowMoreMenu,
}: BusinessFormProps) {
  const info = TEMPLATE_INFO[template];

  return (
    <div className="surface-card p-6 sm:p-8">
      {/* Selected template header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="inline-block px-3 py-1 text-sm font-medium text-accent bg-accent/10 rounded-card">
            {info.label}
          </span>
          <span className="text-sm text-text-secondary">テンプレート選択済み</span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-120"
          aria-label="テンプレート選択に戻る"
        >
          変更
        </button>
      </div>

      {/* Common fields */}
      <FormField label="事業名" required error={errors.businessName}>
        <TextInput
          value={formData.businessName}
          onChange={(v) => onChangeField('businessName', v)}
          maxLength={100}
          hasError={!!errors.businessName}
          ariaLabel="事業名"
        />
      </FormField>

      <FormField label="住所" required error={errors.address}>
        <TextInput
          value={formData.address}
          onChange={(v) => onChangeField('address', v)}
          maxLength={200}
          hasError={!!errors.address}
          ariaLabel="住所"
        />
      </FormField>

      <FormField label="電話番号" required error={errors.phone}>
        <TextInput
          value={formData.phone}
          onChange={(v) => onChangeField('phone', v)}
          type="tel"
          hasError={!!errors.phone}
          ariaLabel="電話番号"
        />
      </FormField>

      <FormField label="営業時間">
        <TextInput
          value={formData.hours}
          onChange={(v) => onChangeField('hours', v)}
          placeholder="例: 11:00-22:00"
          maxLength={100}
          ariaLabel="営業時間"
        />
      </FormField>

      <FormField label="キャッチコピー">
        <TextInput
          value={formData.catchcopy}
          onChange={(v) => onChangeField('catchcopy', v)}
          placeholder={info.catchcopyPlaceholder}
          maxLength={100}
          ariaLabel="キャッチコピー"
        />
      </FormField>

      {/* Template-specific fields */}
      {(template === 'restaurant' || template === 'salon') && (
        <div className="mt-8 pt-6 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-4">
            メニュー項目
          </h4>
          {formData.menuItems.slice(0, visibleMenuRows).map((item, index) => (
            <div key={index} className="flex gap-3 mb-3">
              <input
                type="text"
                value={item.name}
                onChange={(e) => onChangeMenuItem(index, 'name', e.target.value)}
                placeholder="メニュー名"
                aria-label={`メニュー${index + 1}の名前`}
                className="flex-1 px-3 py-2 text-sm text-text-primary bg-white border border-border rounded-card outline-none focus:border-accent transition-colors duration-120"
              />
              <input
                type="text"
                value={item.price}
                onChange={(e) => onChangeMenuItem(index, 'price', e.target.value)}
                placeholder="価格（例: 900円）"
                aria-label={`メニュー${index + 1}の価格`}
                className="w-36 px-3 py-2 text-sm text-text-primary bg-white border border-border rounded-card outline-none focus:border-accent transition-colors duration-120"
              />
            </div>
          ))}
          {visibleMenuRows < 6 && (
            <button
              type="button"
              onClick={onShowMoreMenu}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-120 mt-1"
              aria-label="メニュー入力欄を追加"
            >
              + メニューを追加
            </button>
          )}
        </div>
      )}

      {template === 'salon' && (
        <div className="mt-8 pt-6 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-4">
            スタイリスト名
          </h4>
          {formData.stylists.map((stylist, index) => (
            <div key={index} className="mb-3">
              <input
                type="text"
                value={stylist.name}
                onChange={(e) => onChangeStylist(index, e.target.value)}
                placeholder={`スタイリスト${index + 1}`}
                aria-label={`スタイリスト${index + 1}の名前`}
                className="w-full px-3 py-2 text-sm text-text-primary bg-white border border-border rounded-card outline-none focus:border-accent transition-colors duration-120"
              />
            </div>
          ))}
        </div>
      )}

      {template === 'office' && (
        <>
          <div className="mt-8 pt-6 border-t border-border">
            <h4 className="text-sm font-medium text-text-primary mb-4">
              取扱業務
            </h4>
            {formData.services.slice(0, 4).map((service, index) => (
              <div key={index} className="mb-3">
                <input
                  type="text"
                  value={service.name}
                  onChange={(e) => onChangeService(index, 'name', e.target.value)}
                  placeholder={`業務${index + 1}`}
                  aria-label={`取扱業務${index + 1}`}
                  className="w-full px-3 py-2 text-sm text-text-primary bg-white border border-border rounded-card outline-none focus:border-accent transition-colors duration-120"
                />
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <h4 className="text-sm font-medium text-text-primary mb-4">
              料金目安
            </h4>
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex gap-3 mb-3">
                <input
                  type="text"
                  value={formData.services[index]?.name || ''}
                  onChange={(e) => onChangeService(index, 'name', e.target.value)}
                  placeholder="業務名"
                  aria-label={`料金目安${index + 1}の業務名`}
                  className="flex-1 px-3 py-2 text-sm text-text-primary bg-white border border-border rounded-card outline-none focus:border-accent transition-colors duration-120"
                />
                <input
                  type="text"
                  value={formData.services[index]?.price || ''}
                  onChange={(e) => onChangeService(index, 'price', e.target.value)}
                  placeholder="価格（例: 30,000円〜）"
                  aria-label={`料金目安${index + 1}の価格`}
                  className="w-40 px-3 py-2 text-sm text-text-primary bg-white border border-border rounded-card outline-none focus:border-accent transition-colors duration-120"
                />
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <FormField label="代表者名">
              <TextInput
                value={formData.representativeName}
                onChange={(v) => onChangeField('representativeName', v)}
                ariaLabel="代表者名"
              />
            </FormField>
            <FormField label="資格">
              <TextInput
                value={formData.qualification}
                onChange={(v) => onChangeField('qualification', v)}
                placeholder="例: 弁護士"
                ariaLabel="資格"
              />
            </FormField>
          </div>
        </>
      )}

      {/* Submit */}
      <div className="mt-8 pt-6 border-t border-border">
        <button
          type="button"
          onClick={onSubmit}
          className="w-full sm:w-auto px-8 py-3 bg-accent text-white rounded-card text-sm font-semibold hover:bg-accent-hover transition-colors duration-120"
          aria-label="次のステップへ進む"
        >
          次へ進む
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3: Generate & Download                                        */
/* ------------------------------------------------------------------ */

interface GenerateStepProps {
  template: TemplateType;
  formData: HpFormData;
  isGenerating: boolean;
  progress: number;
  isComplete: boolean;
  error: GenerationError | null;
  onGenerate: () => void;
  onDismissError: () => void;
  onBack: () => void;
  downloadUrl: string | null;
  downloadFileName: string;
}

function GenerateStep({
  template,
  formData,
  isGenerating,
  progress,
  isComplete,
  error,
  onGenerate,
  onDismissError,
  onBack,
  downloadUrl,
  downloadFileName,
}: GenerateStepProps) {
  return (
    <div className="surface-card p-6 sm:p-8">
      {/* Summary */}
      <div className="mb-8 pb-6 border-b border-border">
        <h3 className="text-sm font-medium text-text-muted label-spacing uppercase mb-4">
          作成内容の確認
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex">
            <dt className="w-24 text-text-secondary flex-shrink-0">テンプレート</dt>
            <dd className="text-text-primary">{TEMPLATE_INFO[template].label}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-text-secondary flex-shrink-0">事業名</dt>
            <dd className="text-text-primary">{formData.businessName}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-text-secondary flex-shrink-0">住所</dt>
            <dd className="text-text-primary">{formData.address}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-text-secondary flex-shrink-0">電話番号</dt>
            <dd className="text-text-primary">{formData.phone}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 text-sm text-text-secondary hover:text-text-primary transition-colors duration-120"
          aria-label="入力内容を修正する"
        >
          入力内容を修正する
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div
          className="mb-6 p-4 border border-status-fail/30 bg-status-fail/5 rounded-card flex items-start justify-between"
          role="alert"
        >
          <p className="text-sm text-status-fail">{error.message}</p>
          <button
            type="button"
            onClick={onDismissError}
            className="ml-4 text-status-fail/60 hover:text-status-fail flex-shrink-0"
            aria-label="エラーメッセージを閉じる"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Generate button / progress / complete */}
      {!isComplete && !isGenerating && (
        <button
          type="button"
          onClick={onGenerate}
          className="w-full sm:w-auto px-8 py-3 bg-accent text-white rounded-card text-sm font-semibold hover:bg-accent-hover transition-colors duration-120"
          aria-label="ホームページを生成する"
        >
          ホームページを生成する
        </button>
      )}

      {isGenerating && (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">生成中...</p>
          <div className="w-full h-2 bg-base-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="生成進捗"
            />
          </div>
        </div>
      )}

      {isComplete && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-6 h-6 text-status-pass" />
            <span className="text-lg font-medium text-text-primary">ダウンロード完了</span>
          </div>

          {downloadUrl && (
            <a
              href={downloadUrl}
              download={downloadFileName}
              className="inline-block px-6 py-2.5 bg-accent text-white rounded-card text-sm font-medium hover:bg-accent-hover transition-colors duration-120"
              aria-label="zipをダウンロード"
            >
              zipをダウンロード
            </a>
          )}

          {/* Quick guide */}
          <div className="mt-6 p-5 bg-base-elevated rounded-card">
            <h4 className="text-sm font-medium text-text-primary mb-4">
              ご利用ガイド
            </h4>
            <ol className="space-y-3 text-sm text-text-secondary">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-accent text-white text-xs flex items-center justify-center flex-shrink-0">
                  1
                </span>
                <span>zipを解凍する</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-accent text-white text-xs flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <span>お使いのサーバーにフォルダごとアップロードする</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-accent text-white text-xs flex items-center justify-center flex-shrink-0">
                  3
                </span>
                <span>完了 -- チャットbotは自動で動き始めます</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */

export default function HpCreatePage() {
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);
  const [formData, setFormData] = useState<HpFormData>(createEmptyFormData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [visibleMenuRows, setVisibleMenuRows] = useState(2);

  // Step 3 state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [generationError, setGenerationError] = useState<GenerationError | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  /* -- Field change handlers -- */

  const handleChangeField = useCallback((field: keyof HpFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof ValidationErrors];
        return next;
      });
    }
  }, [errors]);

  const handleChangeMenuItem = useCallback((index: number, field: 'name' | 'price', value: string) => {
    setFormData((prev) => {
      const items = [...prev.menuItems];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, menuItems: items };
    });
  }, []);

  const handleChangeStylist = useCallback((index: number, value: string) => {
    setFormData((prev) => {
      const stylists = [...prev.stylists];
      stylists[index] = { name: value };
      return { ...prev, stylists };
    });
  }, []);

  const handleChangeService = useCallback((index: number, field: 'name' | 'price', value: string) => {
    setFormData((prev) => {
      const services = [...prev.services];
      services[index] = { ...services[index], [field]: value };
      return { ...prev, services };
    });
  }, []);

  /* -- Template selection -- */

  const handleSelectTemplate = useCallback((template: TemplateType) => {
    setSelectedTemplate(template);
    setCurrentStep(2);
  }, []);

  /* -- Validation -- */

  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    if (!formData.businessName.trim()) {
      newErrors.businessName = '事業名は必須です';
    }
    if (!formData.address.trim()) {
      newErrors.address = '住所は必須です';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = '電話番号は必須です';
    } else if (!PHONE_PATTERN.test(formData.phone)) {
      newErrors.phone = '電話番号の形式が正しくありません';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  /* -- Step navigation -- */

  const handleFormSubmit = useCallback(() => {
    if (validate()) {
      setCurrentStep(3);
    }
  }, [validate]);

  const handleBackToStep1 = useCallback(() => {
    setCurrentStep(1);
    setSelectedTemplate(null);
    setErrors({});
  }, []);

  const handleBackToStep2 = useCallback(() => {
    setCurrentStep(2);
    setIsComplete(false);
    setIsGenerating(false);
    setProgress(0);
    setGenerationError(null);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
  }, [downloadUrl]);

  /* -- Generation -- */

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) return;

    setIsGenerating(true);
    setProgress(0);
    setGenerationError(null);

    try {
      // Step 1: Call backend API for publish_key
      setProgress(10);
      const apiResponse = await fetch('/api/hp-generate', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          business_name: formData.businessName,
          template: selectedTemplate,
          business_info: {
            address: formData.address,
            phone: formData.phone,
            hours: formData.hours,
            catchcopy: formData.catchcopy,
            menu_items: formData.menuItems.filter((m) => m.name.trim()),
            stylists: formData.stylists.filter((s) => s.name.trim()),
            services: formData.services.filter((s) => s.name.trim()),
            representative_name: formData.representativeName,
            qualification: formData.qualification,
          },
        }),
      });

      if (!apiResponse.ok) {
        if (apiResponse.status === 401) {
          setGenerationError({
            type: 'auth',
            message: 'ログインが必要です。無料アカウントを作成してください。',
          });
          setIsGenerating(false);
          return;
        }
        if (apiResponse.status === 429) {
          const body = await apiResponse.text();
          const isTotalLimit = body.includes('上限');
          setGenerationError({
            type: isTotalLimit ? 'total-limit' : 'rate-limit',
            message: isTotalLimit
              ? 'HP生成回数の上限（10回）に達しました。'
              : 'リクエスト制限を超えました。しばらくお待ちください。',
          });
          setIsGenerating(false);
          return;
        }
        throw new Error(await apiResponse.text());
      }

      const { publish_key } = (await apiResponse.json()) as { publish_key: string };
      setProgress(30);

      // Step 2: Fetch template files
      const [htmlRes, cssRes] = await Promise.all([
        fetch(`/hp-templates/${selectedTemplate}/index.html`),
        fetch(`/hp-templates/${selectedTemplate}/style.css`),
      ]);

      if (!htmlRes.ok || !cssRes.ok) {
        throw new Error('テンプレートファイルの取得に失敗しました');
      }

      let html = await htmlRes.text();
      const css = await cssRes.text();
      setProgress(50);

      // Step 3: Replace placeholders
      const catchcopy = formData.catchcopy.trim() || DEFAULT_CATCHCOPY[selectedTemplate];

      html = replaceAll(html, '{{business_name}}', formData.businessName);
      html = replaceAll(html, '{{address}}', formData.address);
      html = replaceAll(html, '{{phone}}', formData.phone);
      html = replaceAll(html, '{{hours}}', formData.hours || '');
      html = replaceAll(html, '{{catchcopy}}', catchcopy);
      html = replaceAll(html, '{{chatbot_publish_key}}', publish_key);

      // Menu items
      const filledMenu = formData.menuItems.filter((m) => m.name.trim());
      filledMenu.forEach((item, i) => {
        html = replaceAll(html, `{{menu_name_${i + 1}}}`, item.name);
        html = replaceAll(html, `{{menu_price_${i + 1}}}`, item.price);
      });
      // Clear unused menu placeholders
      for (let i = filledMenu.length; i < 6; i++) {
        html = replaceAll(html, `{{menu_name_${i + 1}}}`, '');
        html = replaceAll(html, `{{menu_price_${i + 1}}}`, '');
      }

      // Stylists
      const filledStylists = formData.stylists.filter((s) => s.name.trim());
      filledStylists.forEach((s, i) => {
        html = replaceAll(html, `{{stylist_name_${i + 1}}}`, s.name);
      });
      for (let i = filledStylists.length; i < 2; i++) {
        html = replaceAll(html, `{{stylist_name_${i + 1}}}`, '');
      }

      // Services
      const filledServices = formData.services.filter((s) => s.name.trim());
      filledServices.forEach((s, i) => {
        html = replaceAll(html, `{{service_name_${i + 1}}}`, s.name);
        html = replaceAll(html, `{{service_price_${i + 1}}}`, s.price);
      });
      for (let i = filledServices.length; i < 4; i++) {
        html = replaceAll(html, `{{service_name_${i + 1}}}`, '');
        html = replaceAll(html, `{{service_price_${i + 1}}}`, '');
      }

      // Office-specific
      html = replaceAll(html, '{{representative_name}}', formData.representativeName);
      html = replaceAll(html, '{{qualification}}', formData.qualification);

      setProgress(70);

      // Step 4: Create zip (dynamic import to allow tree-shaking)
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      zip.file('index.html', html);
      zip.file('style.css', css);

      setProgress(85);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);

      setProgress(95);

      // Step 5: Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formData.businessName}-homepage.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setDownloadUrl(url);
      setProgress(100);
      setIsComplete(true);
      setIsGenerating(false);
    } catch (err: unknown) {
      setIsGenerating(false);
      if (!generationError) {
        const message =
          err instanceof Error ? err.message : '通信エラーが発生しました。もう一度お試しください。';
        setGenerationError({ type: 'network', message });
      }
    }
  }, [selectedTemplate, formData, generationError]);

  const downloadFileName = `${formData.businessName || 'homepage'}-homepage.zip`;

  return (
    <div className="min-h-screen bg-white pt-20 pb-20">
      {/* Auth banner */}
      <div className="bg-base-elevated border-b border-border">
        <div className="section-container py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-text-secondary text-center sm:text-left">
            HP無料制作を利用するには、まず無料アカウントを作成してください
          </p>
          <a
            href="/dashboard"
            className="flex-shrink-0 px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-card hover:bg-accent-hover transition-colors duration-120"
            aria-label="無料アカウント作成ページへ"
          >
            無料アカウント作成
          </a>
        </div>
      </div>

      {/* Hero */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="section-container text-center">
          <h1 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            AIチャットbot付きホームページを
            <br className="hidden sm:block" />
            無料で作成
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            業種を選んで情報を入力するだけ。プロ品質のHPが5分で完成します。
          </p>
        </div>
      </section>

      {/* Step indicator + content */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="section-container">
          <StepIndicator currentStep={currentStep} />

          {currentStep === 1 && (
            <TemplateSelection onSelect={handleSelectTemplate} />
          )}

          {currentStep === 2 && selectedTemplate && (
            <BusinessForm
              template={selectedTemplate}
              formData={formData}
              errors={errors}
              onChangeField={handleChangeField}
              onChangeMenuItem={handleChangeMenuItem}
              onChangeStylist={handleChangeStylist}
              onChangeService={handleChangeService}
              onBack={handleBackToStep1}
              onSubmit={handleFormSubmit}
              visibleMenuRows={visibleMenuRows}
              onShowMoreMenu={() => setVisibleMenuRows((prev) => Math.min(prev + 2, 6))}
            />
          )}

          {currentStep === 3 && selectedTemplate && (
            <GenerateStep
              template={selectedTemplate}
              formData={formData}
              isGenerating={isGenerating}
              progress={progress}
              isComplete={isComplete}
              error={generationError}
              onGenerate={handleGenerate}
              onDismissError={() => setGenerationError(null)}
              onBack={handleBackToStep2}
              downloadUrl={downloadUrl}
              downloadFileName={downloadFileName}
            />
          )}
        </div>
      </section>
    </div>
  );
}
