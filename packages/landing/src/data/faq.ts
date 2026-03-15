export interface FaqEntry {
  id: string;
  keywords: string[];
  question: string;
  answer: string;
  priority: number;
}

export const FAQ_DATA: FaqEntry[] = [
  {
    id: 'pricing-overview',
    keywords: ['料金', '価格', 'プラン', 'いくら', '費用', 'price', 'plan', 'free'],
    question: '料金プランについて教えてください',
    answer:
      'FujiTraceは5つのプランをご用意しています。Free（無料）、Pro（月額9,800円）、Enterprise Standard（年額300,000円）、Enterprise Plus（年額960,000円）、Enterprise Premium（年額2,400,000円〜）です。すべてのEnterpriseプランは年次契約となります。詳細は料金ページをご確認ください。',
    priority: 10,
  },
  {
    id: 'free-plan',
    keywords: ['無料', 'フリー', 'free', 'タダ', '0円'],
    question: '無料プランの内容を教えてください',
    answer:
      'Freeプランでは月間5,000トレース、7日間のデータ保持、1シート、コミュニティサポートをご利用いただけます。クレジットカード登録不要で、すぐにお試しいただけます。個人開発や検証用途に最適です。',
    priority: 9,
  },
  {
    id: 'pro-plan',
    keywords: ['pro', 'プロ', '9800', '個人'],
    question: 'Proプランの内容を教えてください',
    answer:
      'Proプランは月額9,800円（年額105,840円で10%割引）です。月間50,000トレース、LLM-as-Judge評価（月1,000回）、90日間のデータ保持、無制限シート、日本語メールサポートが含まれます。本番運用チームにおすすめです。',
    priority: 8,
  },
  {
    id: 'enterprise',
    keywords: ['エンタープライズ', 'enterprise', '法人', '企業', '年契約'],
    question: 'Enterpriseプランについて教えてください',
    answer:
      'Enterpriseプランは3つのグレードがあります。Standard（年額300,000円、月10万トレース、SLA 99.5%）、Plus（年額960,000円、月50万トレース、SSO対応、SLA 99.9%）、Premium（年額2,400,000円〜、無制限保持、オンプレ対応、SLA 99.95%）。すべて年次契約のみで、業界ベンチマーク機能が付属します。',
    priority: 8,
  },
  {
    id: 'getting-started',
    keywords: ['始め方', '導入', '使い方', 'スタート', 'セットアップ', '設定', '始める', '使う'],
    question: '導入方法を教えてください',
    answer:
      'FujiTraceの導入は3ステップで完了します。(1) アカウントを作成し、APIキーを取得します。(2) お使いのAI APIのbaseURLをFujiTraceのエンドポイントに変更します（1行の変更のみ）。(3) ダッシュボードでトレースをリアルタイムに確認できます。SDKの導入は不要で、プロキシ方式により既存コードへの影響を最小限に抑えます。',
    priority: 9,
  },
  {
    id: 'providers',
    keywords: ['プロバイダー', '対応', 'openai', 'anthropic', 'gemini', 'claude', 'gpt', 'モデル'],
    question: '対応しているAIプロバイダーは？',
    answer:
      'FujiTraceはOpenAI（GPT-4o、GPT-4o-miniなど）、Anthropic（Claude 3.5 Sonnet、Claude 3.5 Haikuなど）、Google（Gemini）に対応しています。なお、DeepSeekは中国データセキュリティ法のリスクを考慮し、意図的に非対応としています。データ主権を守るプロバイダーのみをサポートしています。',
    priority: 7,
  },
  {
    id: 'pii-detection',
    keywords: ['pii', '個人情報', 'マイナンバー', '検出', '漏洩', '情報漏洩'],
    question: 'PII検出機能について教えてください',
    answer:
      'FujiTraceは日本語に特化した15種類以上のPII（個人情報）検出パターンを搭載しています。マイナンバー、住所、電話番号、メールアドレス、パスポート番号、健康保険証番号、運転免許証番号、クレジットカード番号、銀行口座番号などを自動検出し、ブロックまたはマスキングが可能です。国産ならではの日本語PII対応は、海外ツールにはない強みです。',
    priority: 7,
  },
  {
    id: 'llm-judge',
    keywords: ['評価', 'judge', '品質', 'スコア', 'ハルシネーション', '幻覚'],
    question: 'LLM-as-Judge評価について教えてください',
    answer:
      'LLM-as-Judgeは、LLMの出力品質を別のLLMが自動評価する機能です。忠実性（hallucination検出）と関連性のスコアリングを行います。OpenAI（GPT-4o-mini）およびAnthropic（Claude Haiku）の両方を評価モデルとして利用可能です。RAG評価では4つのメトリクスを自動測定します。Proプラン以上でご利用いただけます。',
    priority: 6,
  },
  {
    id: 'agent-trace',
    keywords: ['エージェント', 'agent', 'トレース', 'trace', '追跡', '可視化'],
    question: 'エージェントトレースについて教えてください',
    answer:
      'FujiTraceはReActパターンに対応したエージェントトレース機能を提供しています。thought（思考）、action（行動）、observation（観察）の各ステップを可視化し、エージェントの意思決定プロセスを詳細に追跡できます。複雑なマルチステップのエージェント実行をタイムライン形式で確認可能です。',
    priority: 6,
  },
  {
    id: 'docker',
    keywords: ['docker', 'セルフホスト', '自前', 'オンプレ', 'oss'],
    question: 'セルフホスト（OSS版）について教えてください',
    answer:
      'FujiTraceはOSS版を提供しており、Docker Composeで簡単にセルフホストできます。「docker compose up -d」のワンコマンドで起動可能です。OSS版は全機能無料でご利用いただけます。データを社内に保持したい場合や、検証環境として利用したい場合に最適です。',
    priority: 6,
  },
  {
    id: 'data-retention',
    keywords: ['保持', '保存', 'データ', '期間', '何日'],
    question: 'データ保持期間はどのくらいですか？',
    answer:
      'データ保持期間はプランによって異なります。Free: 7日間、Pro: 90日間、Enterprise Standard: 180日間、Enterprise Plus: 365日間、Enterprise Premium: 無制限です。保持期間を過ぎたデータは自動的に削除されます。長期間のトレンド分析が必要な場合は、上位プランへのアップグレードをご検討ください。',
    priority: 5,
  },
  {
    id: 'security',
    keywords: ['セキュリティ', '安全', '暗号', '認証', 'rbac'],
    question: 'セキュリティ対策について教えてください',
    answer:
      'FujiTraceは多層的なセキュリティ対策を実装しています。fail-closed方式の予算ガード（異常時はリクエストを遮断）、RBAC（ロールベースアクセス制御）、APIキーの暗号化保存、CSP（Content Security Policy）ヘッダーの設定、入力バリデーションによるインジェクション防止などを標準搭載しています。Enterprise Plus以上ではSSO/SAML認証にも対応しています。',
    priority: 5,
  },
  {
    id: 'contact',
    keywords: ['問い合わせ', '連絡', 'メール', '相談', 'デモ', '質問'],
    question: 'お問い合わせ方法を教えてください',
    answer:
      'お問い合わせはcontact@fujitrace.comまでメールでお送りください。製品デモのご希望やご質問など、Zoom面談にも対応しております。Enterpriseプランの詳細やお見積もりについてもお気軽にご相談ください。',
    priority: 4,
  },
  {
    id: 'company',
    keywords: ['会社', '運営', '誰', 'reminis', 'レミニス'],
    question: '運営会社について教えてください',
    answer:
      'FujiTraceは合同会社Reminisが開発・運営しています。所在地は東京都中央区銀座です。国産初のAIオブザーバビリティプラットフォームとして、日本のエンタープライズ市場に特化したサービスを提供しています。',
    priority: 4,
  },
  {
    id: 'comparison',
    keywords: ['比較', '違い', 'langsmith', 'langfuse', 'datadog', 'braintrust', '競合'],
    question: '他のツールとの違いは？',
    answer:
      'FujiTraceは国産唯一のAIオブザーバビリティプラットフォームです。主な強みは、日本語UIと日本語サポート、15種類以上の日本語PII検出パターン、国内データ保持、そして競合の1/4〜1/9の価格設定です。また、全プランでシート数無制限（Freeプラン除く）のため、チーム規模に関わらず追加費用が発生しません。',
    priority: 7,
  },
  {
    id: 'proxy',
    keywords: ['プロキシ', 'proxy', '仕組み', 'アーキテクチャ', 'sdk'],
    question: 'プロキシ方式の仕組みを教えてください',
    answer:
      'FujiTraceはプロキシ方式を採用しており、SDK不要で導入できます。既存のAI APIコールのbaseURLをFujiTraceのエンドポイントに変更するだけで、1行の変更で全トラフィックを可視化できます。プロキシがリクエストとレスポンスを記録し、ダッシュボードでリアルタイムに確認可能です。アプリケーションコードへの影響は最小限です。',
    priority: 6,
  },
];

export function matchFaq(input: string): FaqEntry | null {
  const normalized = input.toLowerCase().trim();
  let bestMatch: FaqEntry | null = null;
  let bestScore = 0;

  for (const entry of FAQ_DATA) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    if (
      score > bestScore ||
      (score === bestScore && entry.priority > (bestMatch?.priority ?? 0))
    ) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestScore >= 1 ? bestMatch : null;
}
