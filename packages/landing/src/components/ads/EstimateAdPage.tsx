/**
 * /ads/estimate — 見積書テーマの広告着地 LP (CEO 判断 2026-04-28)
 *
 * 想定流入: Google 広告 / X 広告で「見積書 AI / 見積書 自動」軸のクリエイティブから
 * 飛んできたユーザー。1 画面で「LINE で話しかける」アクションまで導く。
 *
 * 戦略 doc Section 10.5 (広告着地 LP 必須化) に対応。
 */
import AdLandingPage from '../AdLandingPage';

export default function EstimateAdPage() {
  return (
    <AdLandingPage
      slug="estimate"
      eyebrow="見積書 AI"
      headline="見積書、3 秒で。"
      subcopy="品名と金額を LINE で送るだけ。おしごと AI が御見積書を整えて返します。桁・消費税・記載漏れもまとめてチェック。"
      trustBadges={['国内データ滞留', '消費税自動計算', '日本の商慣習に準拠']}
      mascotPose="default"
      seoTitle="見積書を 3 秒で作る AI | おしごと AI — FujiTrace"
      seoDescription="LINE で品名と金額を送るだけ。御見積書を整え、桁・消費税・記載漏れもチェック。国内データ滞留、月¥3,000 から。"
      reasons={[
        {
          title: '品名と金額だけで完成',
          body:
            '宛先・件名・明細を LINE で送ると、おしごと AI が御見積書のフォーマットに整えて返します。テンプレートを開く必要はありません。',
        },
        {
          title: '桁・消費税を自動チェック',
          body:
            '小計・消費税 (10% / 軽減税率 8%) ・合計の整合をプログラム側で検証。AI 任せにせず、算術は確実に合わせます。',
        },
        {
          title: '日本の商慣習に準拠',
          body:
            '「御中」「殿」の使い分け、令和表記、押印箇所の指摘など、日本の商習慣に合わせた書類が整います。',
        },
      ]}
    />
  );
}
