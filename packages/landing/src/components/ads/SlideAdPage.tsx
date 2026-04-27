/**
 * /ads/slide — スライド (社内資料) テーマの広告着地 LP (CEO 判断 2026-04-28)
 *
 * 想定流入: 「資料作成 AI / プレゼン 自動」軸のクリエイティブから飛んできたユーザー。
 *
 * 戦略 doc Section 10.5 (広告着地 LP 必須化) に対応。
 */
import AdLandingPage from '../AdLandingPage';

export default function SlideAdPage() {
  return (
    <AdLandingPage
      slug="slide"
      eyebrow="スライド AI"
      headline="社内資料、骨子から。"
      subcopy="伝えたいことを LINE で話すだけ。おしごと AI が章立て・一行サマリ・想定質問まで含めたスライド骨子を返します。"
      trustBadges={['章立て自動生成', '想定質問の網羅', '日本企業の資料作法']}
      mascotPose="onsen"
      seoTitle="社内資料の骨子を整える AI | おしごと AI — FujiTrace"
      seoDescription="LINE で伝えたいことを話すだけ。章立て・一行サマリ・想定質問まで含めたスライド骨子を返します。月¥3,000 から。"
      reasons={[
        {
          title: '章立てから始める',
          body:
            '結論先出しか、背景積み上げか、目的に合わせて章立てを提案。各章の一行サマリも返すので、編集の起点に困りません。',
        },
        {
          title: '想定質問を先に潰す',
          body:
            '上司・取引先から飛んでくる質問を先回りして列挙。質問への回答案も併記し、当日の心理的負担を軽くします。',
        },
        {
          title: '日本企業の資料作法に',
          body:
            '余計な装飾を排した、社内回覧に耐える落ち着いた構成。表紙・目次・本論・まとめの四部構成を基本に整えます。',
        },
      ]}
    />
  );
}
