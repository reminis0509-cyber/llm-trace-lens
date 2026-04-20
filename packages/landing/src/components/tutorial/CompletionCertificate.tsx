import { useRef, useState } from 'react';
import DachshundNarrator from './DachshundNarrator';

interface CompletionCertificateProps {
  initialUserName?: string;
  onUserNameChange?: (name: string) => void;
  onRestart: () => void;
}

const SHARE_URL = 'https://fujitrace.jp/tutorial';
const SHARE_TEXT =
  'FujiTrace の AI 社員 基礎チュートリアルを修了しました。見積書・請求書・発注書・送付状・納品書を体験しました。';
const X_INTENT_URL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SHARE_URL)}`;

const CERT_FONT = '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif';
const CERT_WIDTH = 1200;
const CERT_HEIGHT = 800;

function formatJaDate(d: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

function buildCertificateSvg(displayName: string, dateStr: string): string {
  const name = displayName.replace(/[<>&"']/g, '');
  const W = CERT_WIDTH;
  const H = CERT_HEIGHT;

  const docLabels = ['見積書', '請求書', '納品書', '発注書', '送付状'];
  const iconsX = W / 2 - ((docLabels.length - 1) * 140) / 2;

  const icons = docLabels
    .map((lbl, i) => {
      const cx = iconsX + i * 140;
      const cy = H - 160;
      return `
        <g>
          <rect x="${cx - 36}" y="${cy - 44}" width="72" height="88" rx="6" ry="6" fill="#ffffff" stroke="#c9a04e" stroke-width="2"/>
          <line x1="${cx - 22}" y1="${cy - 24}" x2="${cx + 22}" y2="${cy - 24}" stroke="#c9a04e" stroke-width="1.5"/>
          <line x1="${cx - 22}" y1="${cy - 10}" x2="${cx + 22}" y2="${cy - 10}" stroke="#c9a04e" stroke-width="1.5"/>
          <line x1="${cx - 22}" y1="${cy + 4}" x2="${cx + 12}" y2="${cy + 4}" stroke="#c9a04e" stroke-width="1.5"/>
          <text x="${cx}" y="${cy + 72}" text-anchor="middle" font-family='${CERT_FONT}' font-size="20" fill="#475569">${lbl}</text>
        </g>
      `;
    })
    .join('');

  // Small pixel-dog silhouette (abstract, since PNG embedding is avoided)
  const dog = `
    <g transform="translate(120, ${H - 210})">
      <rect x="0"  y="30" width="14" height="14" fill="#8b5a2b"/>
      <rect x="14" y="24" width="14" height="20" fill="#8b5a2b"/>
      <rect x="28" y="24" width="56" height="16" fill="#8b5a2b"/>
      <rect x="84" y="20" width="18" height="20" fill="#8b5a2b"/>
      <rect x="96" y="12" width="10" height="10" fill="#8b5a2b"/>
      <rect x="14" y="44" width="12" height="14" fill="#5a3a1e"/>
      <rect x="70" y="44" width="12" height="14" fill="#5a3a1e"/>
      <rect x="100" y="24" width="4" height="4" fill="#ffffff"/>
    </g>
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="none" stroke="#c9a04e" stroke-width="3"/>
  <rect x="36" y="36" width="${W - 72}" height="${H - 72}" fill="none" stroke="#c9a04e" stroke-width="1" opacity="0.55"/>

  <text x="${W / 2}" y="110" text-anchor="middle" font-family='${CERT_FONT}' font-size="34" font-weight="700" fill="#1e3a8a" letter-spacing="4">FujiTrace</text>

  <text x="${W / 2}" y="220" text-anchor="middle" font-family='${CERT_FONT}' font-size="56" font-weight="700" fill="#0f172a">修了証明</text>
  <text x="${W / 2}" y="256" text-anchor="middle" font-family='${CERT_FONT}' font-size="16" fill="#64748b" letter-spacing="3">Certificate of Completion</text>

  <text x="${W / 2}" y="340" text-anchor="middle" font-family='${CERT_FONT}' font-size="26" fill="#0f172a">${name || '受講者様'}</text>
  <text x="${W / 2}" y="380" text-anchor="middle" font-family='${CERT_FONT}' font-size="20" fill="#334155">は</text>
  <text x="${W / 2}" y="418" text-anchor="middle" font-family='${CERT_FONT}' font-size="24" font-weight="600" fill="#0f172a">FujiTrace AI 社員 基礎チュートリアル</text>
  <text x="${W / 2}" y="454" text-anchor="middle" font-family='${CERT_FONT}' font-size="20" fill="#334155">を修了しました</text>

  <text x="${W / 2}" y="520" text-anchor="middle" font-family='${CERT_FONT}' font-size="18" fill="#475569">${dateStr}</text>

  ${icons}
  ${dog}

  <text x="${W / 2}" y="${H - 48}" text-anchor="middle" font-family='${CERT_FONT}' font-size="14" fill="#64748b">FujiTrace — 日本企業に安心して AI を使ってもらう</text>
</svg>`;
}

async function svgToPngBlob(svgString: string): Promise<Blob> {
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load certificate SVG'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = CERT_WIDTH;
    canvas.height = CERT_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2d context unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CERT_WIDTH, CERT_HEIGHT);
    ctx.drawImage(img, 0, 0, CERT_WIDTH, CERT_HEIGHT);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
        'image/png',
        0.95,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function CompletionCertificate({
  initialUserName = '',
  onUserNameChange,
  onRestart,
}: CompletionCertificateProps) {
  const [name, setName] = useState(initialUserName);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lastUrl = useRef<string | null>(null);

  const handleNameChange = (v: string) => {
    setName(v);
    onUserNameChange?.(v);
  };

  const handleIssue = async () => {
    setGenerating(true);
    setError(null);
    try {
      const displayName = name.trim() || '受講者様';
      const dateStr = formatJaDate(new Date());
      const svg = buildCertificateSvg(displayName, dateStr);
      const blob = await svgToPngBlob(svg);
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      const url = URL.createObjectURL(blob);
      lastUrl.current = url;
      setPngUrl(url);
    } catch (e) {
      setError(
        e instanceof Error
          ? `修了証の生成に失敗しました: ${e.message}`
          : '修了証の生成に失敗しました',
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('この URL をコピーしてください', SHARE_URL);
    }
  };

  const downloadName = `fujitrace-certificate-${new Date().toISOString().slice(0, 10)}.png`;

  return (
    <section aria-labelledby="cert-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">修了証</p>
        <h2 id="cert-title" className="mt-1 text-2xl font-bold text-slate-900">
          お疲れさま！
        </h2>
      </header>

      <DachshundNarrator
        state="happy"
        message={'お疲れさま！\n\nこれで基本は\n完璧だよ。'}
        actionHint="お名前を入れて修了証を発行できます"
      />

      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">
            お名前（任意）
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="例: 山田 太郎 / 株式会社サンプル"
            maxLength={40}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            未入力の場合は「受講者様」と表示されます
          </span>
        </label>

        <button
          type="button"
          onClick={handleIssue}
          disabled={generating}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              発行中...
            </>
          ) : (
            '修了証を発行'
          )}
        </button>

        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}

        {pngUrl && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <img
              src={pngUrl}
              alt="FujiTrace AI 社員 基礎チュートリアル 修了証"
              className="w-full max-w-[480px] mx-auto border border-slate-200 rounded-md"
              width={CERT_WIDTH}
              height={CERT_HEIGHT}
            />
            <div className="flex justify-center">
              <a
                href={pngUrl}
                download={downloadName}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                PNG をダウンロード
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6 shadow-sm space-y-4">
        <header>
          <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            次のステップ
          </p>
          <h3 className="mt-1 text-lg sm:text-xl font-bold text-slate-900">
            本物の AI 社員を、毎日の業務に。
          </h3>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed">
            チュートリアルで触った AI 社員を、あなたの会社情報で毎日使えます。
          </p>
        </header>

        <div className="rounded-lg bg-white border border-blue-100 p-4 sm:p-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-slate-900">Pro プラン</span>
            <span className="text-sm text-slate-700">
              <span className="text-lg font-bold text-slate-900">¥3,000</span>
              <span className="text-xs text-slate-500"> / 月</span>
            </span>
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            {[
              '見積書 / 請求書 / 納品書 / 発注書 / 送付状 の作成・チェックを無制限',
              '自律型 AI 社員（β）で複数タスクを自動化',
              'Watch Room で AI 実行をチームで可視化',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{item}</span>
              </li>
            ))}
            <li className="flex items-start gap-2 pt-1 border-t border-blue-100">
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 flex-shrink-0 mt-0.5"
                aria-label="付録特典"
              >
                付録
              </span>
              <span>
                応用クエスト教材
                <span className="text-xs text-slate-500">（Phase A1 公開予定）</span>
                <span className="block text-xs text-slate-600 mt-0.5">
                  チュートリアルの続編。経費一括処理・月次請求書バッチなど、実務で AI を使いこなすハンズオン 5 本。
                </span>
              </span>
            </li>
          </ul>
        </div>

        <div className="flex justify-center">
          <a
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700"
          >
            AI 社員を使い始める
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={X_INTENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            修了証を X でシェア
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {copied ? 'コピーしました' : '稟議書用 URL をコピー'}
          </button>
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onRestart}
            className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            最初からもう一度
          </button>
        </div>
      </div>
    </section>
  );
}
