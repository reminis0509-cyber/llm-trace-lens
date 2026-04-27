/**
 * /ads/invoice — 請求書テーマの広告着地 LP (CEO 判断 2026-04-28)
 *
 * 想定流入: 「請求書 チェック / 請求書 自動」軸のクリエイティブから飛んできたユーザー。
 * インボイス制度対応をフックにする。
 *
 * 戦略 doc Section 10.5 (広告着地 LP 必須化) に対応。
 */
import AdLandingPage from '../AdLandingPage';

export default function InvoiceAdPage() {
  return (
    <AdLandingPage
      slug="invoice"
      eyebrow="請求書 AI"
      headline="請求書のチェック、AI に。"
      subcopy="受け取った請求書を LINE に送るだけ。おしごと AI がインボイス番号・税区分・金額の整合を確認して返します。"
      trustBadges={['インボイス番号確認', '税区分の整合チェック', '国内データ滞留']}
      mascotPose="real"
      seoTitle="請求書チェックを AI に任せる | おしごと AI — FujiTrace"
      seoDescription="LINE で請求書を送るだけ。インボイス番号・税区分・金額の整合をチェック。中小企業の経理担当者向け、月¥3,000 から。"
      reasons={[
        {
          title: 'インボイス番号を即確認',
          body:
            '登録番号 (T+13桁) のフォーマットを検証し、桁数・チェックデジットを確認。気付かず受け取った欠番をその場で指摘します。',
        },
        {
          title: '税区分と金額を突き合わせ',
          body:
            '10% / 軽減税率 8% / 非課税の区分が金額と整合しているか、明細レベルで照合。経理の目視チェックの前段で網にかけます。',
        },
        {
          title: '改ざん・記載漏れの兆候を検出',
          body:
            '振込先口座のずれ、押印欠落、発行者情報の記載漏れなど、よくある不備を一覧化。再発行依頼の手間を最小化します。',
        },
      ]}
    />
  );
}
