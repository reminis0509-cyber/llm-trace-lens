/**
 * /ads/minutes — 議事録テーマの広告着地 LP (CEO 判断 2026-04-28)
 *
 * 想定流入: 「議事録 AI / ミーティング 自動要約」軸のクリエイティブから飛んできたユーザー。
 *
 * 戦略 doc Section 10.5 (広告着地 LP 必須化) に対応。
 */
import AdLandingPage from '../AdLandingPage';

export default function MinutesAdPage() {
  return (
    <AdLandingPage
      slug="minutes"
      eyebrow="議事録 AI"
      headline="議事録、会議の終わりに。"
      subcopy="録音テキストを LINE に送るだけ。おしごと AI が決定事項・宿題・期限を箇条書きにまとめます。社内共有のフォーマット付き。"
      trustBadges={['決定事項の自動抽出', '宿題と期限の見える化', '日本語ビジネス文体']}
      mascotPose="default"
      seoTitle="議事録を会議の終わりに仕上げる AI | おしごと AI — FujiTrace"
      seoDescription="録音テキストを LINE で送るだけ。決定事項・宿題・期限を整理し、社内共有用フォーマットで返します。月¥3,000 から。"
      reasons={[
        {
          title: '決定事項を最上段に',
          body:
            '「何が決まったか」を冒頭に箇条書き。雑談や寄り道は要約から外し、後から読み返した人に必要な情報だけを残します。',
        },
        {
          title: '宿題と期限を別建てで',
          body:
            '誰が・いつまでに・何をするのかを別ブロックに整理。次の会議までのトラッキングがそのまま使えます。',
        },
        {
          title: 'ビジネス日本語で整文',
          body:
            'カジュアルな話し言葉を、社内共有に耐える落ち着いた文体に整えます。固有名詞や数字は原文の表記を尊重します。',
        },
      ]}
    />
  );
}
