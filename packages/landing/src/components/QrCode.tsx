/**
 * QrCode — URL を QR コード化して `<img>` (data URL) で描画する。
 *
 * 設計意図 (CEO 判断 2026-04-28):
 *   - 静的 PNG ではなく動的生成。env (`VITE_LINE_OFFICIAL_URL`) 変更だけで反映可能
 *   - 広告着地 LP (Q9) でユーザーがスマホ QR を読んで LINE 公式アカウントに直行する想定
 *   - bundle 影響は qrcode が ~20KB (gzip) の範囲。LP 全体 680KB に対し 3% 未満
 *
 * 失敗時は graceful fallback (テキストのみ表示) で UI 破綻を防ぐ。
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  /** QR エンコード対象 URL */
  value: string;
  /** 描画サイズ (px)。デフォルト 192 */
  size?: number;
  /** ARIA ラベル (テキスト読み上げ向け、URL は読み上げない) */
  ariaLabel?: string;
  /** 追加クラス */
  className?: string;
}

export default function QrCode({
  value,
  size = 192,
  ariaLabel = 'LINE 友だち追加 QR コード',
  className,
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      color: {
        dark: '#1a1a1a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  const wrapperClass =
    'inline-block bg-white border border-border rounded-card p-2' +
    (className ? ` ${className}` : '');

  if (failed) {
    return (
      <div
        className={wrapperClass}
        style={{ width: size + 16, height: size + 16 }}
        role="img"
        aria-label={ariaLabel}
      >
        <div
          style={{
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: '#a39e98',
            textAlign: 'center',
            padding: 8,
            lineHeight: 1.4,
          }}
        >
          QR コードを表示できませんでした。
          <br />
          ボタンから LINE で開いてください。
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass} role="img" aria-label={ariaLabel}>
      {dataUrl ? (
        <img
          src={dataUrl}
          width={size}
          height={size}
          alt={ariaLabel}
          draggable={false}
          style={{ display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            backgroundColor: '#f6f5f4',
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
