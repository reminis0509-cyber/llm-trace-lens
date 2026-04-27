/**
 * TrustSection — 中小企業決裁者の不安解消 (2026-04-22 新設)
 *
 * コンプライアンス・セキュリティ・士業法遵守・Pマークロードマップなど、
 * 「社内稟議を通す」際に必要な安心材料を並べる。誇張せず、未取得は未取得と明示。
 */
interface TrustItem {
  category: string;
  title: string;
  description: string;
  status?: 'done' | 'planned';
}

const items: TrustItem[] = [
  {
    category: 'データ',
    title: '国内リージョンでの滞留保管',
    description:
      '利用データは国内リージョンに限定して保管します。Meta 傘下や海外クラウドに流れることはありません。',
    status: 'done',
  },
  {
    category: '暗号化',
    title: 'AES-256-GCM による秘匿',
    description:
      '業務システムの OAuth トークンは AES-256-GCM で暗号化。鍵管理は環境変数から切り離して管理します。',
    status: 'done',
  },
  {
    category: '士業法遵守',
    title: '独占業務は意図的に非対応',
    description:
      '税務申告・登記申請・労務手続きなど、税理士法・司法書士法・社労士法の独占業務にあたる処理はおしごと AI では実行しません。',
    status: 'done',
  },
  {
    category: '承認ワークフロー',
    title: '金銭に関わる操作は、必ずユーザー承認後',
    description:
      '送信 ・ 支払 ・ 書込みを伴う操作は、プランを提示してから実行します。書き込み前の人間確認を標準としています。',
    status: 'done',
  },
  {
    category: '認証',
    title: 'Pマーク取得に向けた運用を開始',
    description:
      'プライバシーマーク取得を目標に、規程整備と運用ログの記録を開始しています。現時点では未取得である旨を明示します。',
    status: 'planned',
  },
  {
    category: 'SLA',
    title: '稼働率と応答時間を SLA として明記',
    description:
      'Team プランで稼働率 99.5%、Max プランで 99.9%、Enterprise で 99.95% を目標とします。障害時のご連絡手段も別途ご案内します。',
    status: 'planned',
  },
];

function StatusPill({ status }: { status?: TrustItem['status'] }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-status-pass bg-status-pass/10 rounded label-spacing">
        <span className="w-1 h-1 rounded-full bg-status-pass" aria-hidden="true" />
        対応済み
      </span>
    );
  }
  if (status === 'planned') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-accent bg-accent-dim rounded label-spacing">
        <span className="w-1 h-1 rounded-full bg-accent" aria-hidden="true" />
        ロードマップ
      </span>
    );
  }
  return null;
}

export default function TrustSection() {
  return (
    <section id="trust" className="py-16 sm:py-24 px-4 sm:px-6 bg-app-bg-surface">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-5">
            セキュリティ ・ 法令遵守
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            社内稟議を通すときに、
            <br className="sm:hidden" />
            必要な材料を揃えました。
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            経営者 ・ 管理部門長が、安心して社内に提案できる情報を整理しています。
            <br className="hidden md:block" />
            未取得のものは未取得と明示しています。
          </p>
        </div>

        {/* Trust items — 2 列 x 3 行 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {items.map((item) => (
            <article
              key={item.title}
              className="bg-white border border-border rounded-card p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-text-muted label-spacing uppercase">
                  {item.category}
                </span>
                <StatusPill status={item.status} />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-2 leading-snug">
                {item.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {item.description}
              </p>
            </article>
          ))}
        </div>

        {/* 補足注記 */}
        <div className="mt-10 max-w-3xl mx-auto text-center">
          <p className="text-xs text-text-muted leading-relaxed">
            契約書類・NDA・個別 SLA が必要な場合は Enterprise プランにてご相談いただけます。
            <br className="hidden sm:block" />
            詳細は
            <a
              href="/privacy"
              className="text-accent hover:underline underline-offset-2 mx-1"
            >
              プライバシーポリシー
            </a>
            および
            <a
              href="/terms"
              className="text-accent hover:underline underline-offset-2 mx-1"
            >
              利用規約
            </a>
            をご覧ください。
          </p>
        </div>
      </div>
    </section>
  );
}
