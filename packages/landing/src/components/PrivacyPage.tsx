interface NavigationLinkProps {
  href: string;
  children: React.ReactNode;
}

function NavigationLink({ href, children }: NavigationLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo(0, 0);
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-accent hover:text-accent/80 transition-colors duration-120"
    >
      {children}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <section className="pt-24 pb-16 px-4 sm:px-6">
      <div className="section-container">
        <div className="mb-8">
          <NavigationLink href="/">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>トップに戻る</span>
          </NavigationLink>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
          プライバシーポリシー
        </h1>
        <p className="text-sm text-text-muted mb-12">
          最終更新日: 2025年3月10日
        </p>

        <div className="space-y-10">
          {/* 前文 */}
          <div>
            <p className="text-text-secondary leading-relaxed">
              FujiTrace（運営: 個人事業）（以下「当方」といいます）は、当方が提供するLLM可観測性プラットフォーム「FujiTrace」（以下「本サービス」といいます）における個人情報の取り扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
            </p>
          </div>

          {/* 1. 個人情報の収集 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              1. 個人情報の収集
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>当方は、本サービスの提供にあたり、以下の個人情報を収集することがあります。</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  <span className="font-medium text-text-primary">アカウント情報</span>：氏名、メールアドレス、会社名、部署名等の登録情報
                </li>
                <li>
                  <span className="font-medium text-text-primary">決済情報</span>：Stripe社を通じて処理されるクレジットカード情報等の支払い情報（当方はカード番号等を直接保持しません）
                </li>
                <li>
                  <span className="font-medium text-text-primary">利用データ</span>：サービスの利用状況、ログイン履歴、機能利用状況等
                </li>
                <li>
                  <span className="font-medium text-text-primary">LLMトレースデータ</span>：本サービスを通じて記録されるLLM APIの呼び出し履歴（プロンプト、レスポンス、トークン数、レイテンシ等のメタデータ）
                </li>
                <li>
                  <span className="font-medium text-text-primary">通信情報</span>：IPアドレス、ブラウザ情報、デバイス情報等
                </li>
              </ul>
            </div>
          </article>

          {/* 2. 利用目的 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              2. 利用目的
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>当方は、収集した個人情報を以下の目的で利用します。</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>本サービスの提供、運営、維持および改善</li>
                <li>利用料金の請求および決済処理</li>
                <li>ユーザーサポートの提供</li>
                <li>サービスの利用状況の分析および統計処理</li>
                <li>セキュリティの確保および不正利用の防止</li>
                <li>サービスに関する重要なお知らせの送信</li>
                <li>新機能やアップデートに関する情報の提供（ユーザーの同意がある場合）</li>
              </ul>
            </div>
          </article>

          {/* 3. 第三者提供 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              3. 第三者提供
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                当方は、ユーザーの個人情報を第三者に販売することはありません。ただし、本サービスの提供に必要な範囲で、以下の第三者にデータを共有する場合があります。
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  <span className="font-medium text-text-primary">Stripe社</span>：決済処理のため
                </li>
                <li>
                  <span className="font-medium text-text-primary">Supabase社</span>：認証サービスの提供のため
                </li>
                <li>
                  <span className="font-medium text-text-primary">クラウドホスティングプロバイダー</span>：サービスのインフラストラクチャ提供のため
                </li>
              </ul>
              <p>
                上記の第三者は、当方との間で適切なデータ保護に関する契約を締結しており、提供されたデータを本サービスの提供に必要な範囲でのみ利用します。
              </p>
              <p>
                また、法令に基づく場合、人の生命・身体・財産の保護に必要な場合等、個人情報保護法で認められた場合には、ユーザーの同意なく個人情報を第三者に提供することがあります。
              </p>
            </div>
          </article>

          {/* 4. LLMトレースデータの取り扱い */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              4. LLMトレースデータの取り扱い
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                本サービスの中核機能であるLLMトレースデータの取り扱いについて、以下のとおり定めます。
              </p>
              <div className="surface-card p-6 space-y-3 my-4">
                <p>
                  <span className="font-medium text-text-primary">データの所有権：</span>
                  トレースデータ（プロンプト、レスポンス等）の所有権は、ユーザーに帰属します。
                </p>
                <p>
                  <span className="font-medium text-text-primary">AIモデル学習への不使用：</span>
                  当方は、ユーザーのトレースデータをAIモデルの学習目的で使用することはありません。
                </p>
                <p>
                  <span className="font-medium text-text-primary">データの隔離：</span>
                  トレースデータはワークスペースごとに論理的に隔離して保存され、他のユーザーからアクセスすることはできません。
                </p>
                <p>
                  <span className="font-medium text-text-primary">PII検出機能：</span>
                  本サービスは、トレースデータ内の個人情報（PII）を検出する機能を提供しています。本機能はユーザーがデータ内の個人情報を特定・管理するためのツールとして提供するものであり、検出の完全性を保証するものではありません。
                </p>
              </div>
            </div>
          </article>

          {/* 5. データの保管・セキュリティ */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              5. データの保管・セキュリティ
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>当方は、個人情報およびトレースデータの保護のため、以下のセキュリティ対策を講じています。</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>保管時および通信時のデータ暗号化（TLS/SSL）</li>
                <li>アクセス制御とロールベースの権限管理</li>
                <li>定期的なセキュリティ監査</li>
                <li>不正アクセスの検知と防止</li>
              </ul>
              <p>
                データの保存期間は、ユーザーのご利用プランに応じて異なります。プラン別のデータ保存期間は、料金ページをご確認ください。
              </p>
            </div>
          </article>

          {/* 6. 個人情報の開示・訂正・削除 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              6. 個人情報の開示・訂正・削除
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. ユーザーは、当方に対して、自己の個人情報の開示、訂正、追加、削除、利用停止または消去を請求することができます。
              </p>
              <p>
                2. 上記の請求を行う場合は、当方の定める方法により本人確認を行った上で対応いたします。
              </p>
              <p>
                3. トレースデータの削除は、本サービスのダッシュボードから行うことができます。また、アカウント削除時には、関連するすべてのデータを合理的な期間内に削除いたします。
              </p>
            </div>
          </article>

          {/* 7. Cookieの使用 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              7. Cookieの使用
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                本サービスでは、以下の目的でCookieおよび類似の技術を使用しています。
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  <span className="font-medium text-text-primary">セッション管理</span>：ユーザーのログイン状態を維持するため
                </li>
                <li>
                  <span className="font-medium text-text-primary">アクセス解析</span>：サービスの利用状況を把握し、改善するため（最小限のデータのみ収集）
                </li>
              </ul>
              <p>
                ユーザーは、ブラウザの設定によりCookieの受け入れを拒否することができますが、その場合、本サービスの一部の機能が正常に動作しない場合があります。
              </p>
            </div>
          </article>

          {/* 8. プライバシーポリシーの変更 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              8. プライバシーポリシーの変更
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. 当方は、必要に応じて本ポリシーを変更することがあります。
              </p>
              <p>
                2. 重要な変更を行う場合は、本サービス上での通知またはメールにより、変更内容をユーザーに通知します。
              </p>
              <p>
                3. 変更後のプライバシーポリシーは、本サービスのウェブサイト上に掲載した時点から効力を生じるものとします。
              </p>
            </div>
          </article>

          {/* 9. お問い合わせ */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              9. お問い合わせ
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                本ポリシーに関するお問い合わせは、本サービスのお問い合わせフォームよりご連絡ください。
              </p>
            </div>
          </article>

          {/* 末尾 */}
          <div className="pt-6 border-t border-border">
            <p className="text-sm text-text-muted">
              以上
            </p>
            <p className="text-sm text-text-muted mt-2">
              FujiTrace（運営: 個人事業）
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
