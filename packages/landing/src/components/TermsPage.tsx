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

export default function TermsPage() {
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
          利用規約
        </h1>
        <p className="text-sm text-text-muted mb-12">
          最終更新日: 2025年3月10日
        </p>

        <div className="space-y-10">
          {/* 前文 */}
          <div>
            <p className="text-text-secondary leading-relaxed">
              本利用規約（以下「本規約」といいます）は、FujiTrace（運営: 個人事業）（以下「当方」といいます）が提供するLLM可観測性プラットフォーム「FujiTrace」（以下「本サービス」といいます）の利用条件を定めるものです。本サービスをご利用いただくすべてのお客様（以下「ユーザー」といいます）は、本規約に同意の上、本サービスをご利用ください。
            </p>
          </div>

          {/* 第1条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第1条（適用）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. 本規約は、ユーザーと当方との間の本サービスの利用に関わる一切の関係に適用されるものとします。
              </p>
              <p>
                2. 当方は本サービスに関し、本規約のほか、ご利用にあたってのルール等、各種の定め（以下「個別規定」といいます）をすることがあります。これら個別規定はその名称のいかんに関わらず、本規約の一部を構成するものとします。
              </p>
              <p>
                3. 本規約の規定が前項の個別規定の規定と矛盾する場合には、個別規定において特段の定めなき限り、個別規定の規定が優先されるものとします。
              </p>
            </div>
          </article>

          {/* 第2条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第2条（定義）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>本規約において、以下の用語は次の意味で使用します。</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  <span className="font-medium text-text-primary">「サービス」</span>：当方が提供するLLM可観測性プラットフォーム「FujiTrace」およびそれに付随する一切のサービスをいいます。
                </li>
                <li>
                  <span className="font-medium text-text-primary">「ユーザー」</span>：本サービスを利用するすべての個人または法人をいいます。
                </li>
                <li>
                  <span className="font-medium text-text-primary">「アカウント」</span>：本サービスを利用するためにユーザーが作成する認証情報をいいます。
                </li>
                <li>
                  <span className="font-medium text-text-primary">「ワークスペース」</span>：ユーザーがトレースデータを管理する単位をいいます。
                </li>
                <li>
                  <span className="font-medium text-text-primary">「トレースデータ」</span>：本サービスを通じて記録されるLLM APIの呼び出し履歴（プロンプト、レスポンス、メタデータ等）をいいます。
                </li>
                <li>
                  <span className="font-medium text-text-primary">「コンテンツ」</span>：ユーザーが本サービスを通じて送信、保存、または表示するデータをいいます。
                </li>
              </ul>
            </div>
          </article>

          {/* 第3条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第3条（アカウント登録）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. 本サービスの利用を希望する者は、当方の定める方法によりアカウント登録を申請し、当方がこれを承認することによって、アカウント登録が完了するものとします。
              </p>
              <p>
                2. ユーザーは、登録情報について正確かつ最新の情報を提供するものとし、常にこれを更新する義務を負います。
              </p>
              <p>
                3. 1人のユーザーにつき1つのアカウントを原則とします。複数アカウントの作成は、当方が認めた場合を除き禁止します。
              </p>
              <p>
                4. ユーザーは、自己のアカウント情報を適切に管理し、第三者に利用させ、または貸与、譲渡、売買等をしてはならないものとします。
              </p>
              <p>
                5. アカウント情報の管理不十分、第三者の使用等による損害の責任はユーザーが負うものとし、当方は一切の責任を負いません。
              </p>
            </div>
          </article>

          {/* 第4条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第4条（利用料金・支払い）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. 本サービスの利用料金は、当方が別途定める料金プランに基づくものとします。料金プランは本サービスのウェブサイト上に掲載します。
              </p>
              <p>
                2. 利用料金は、基本料金と使用量に基づく従量課金（トレース数、評価回数等）により構成されます。
              </p>
              <p>
                3. 支払いは、Stripe社の決済サービスを利用して行うものとします。ユーザーは、Stripe社の利用規約にも同意するものとします。
              </p>
              <p>
                4. 有料プランは、ユーザーが解約手続きを行わない限り、契約期間の満了時に自動的に更新されるものとします。
              </p>
              <p>
                5. 一度支払われた利用料金は、当方に帰責事由がある場合を除き、返金いたしません。
              </p>
              <p>
                6. ユーザーが利用料金の支払いを遅延した場合、当方はサービスの利用を制限または停止できるものとします。
              </p>
            </div>
          </article>

          {/* 第5条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第5条（禁止事項）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>法令または公序良俗に違反する行為</li>
                <li>犯罪行為に関連する行為</li>
                <li>本サービスのリバースエンジニアリング、逆コンパイル、逆アセンブル等の行為</li>
                <li>本サービスからのデータの不正なスクレイピングまたは自動的なデータ収集</li>
                <li>当方のサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
                <li>当方のサービスの運営を妨害するおそれのある行為</li>
                <li>他のユーザーのアカウント情報を不正に取得する行為</li>
                <li>自己のアカウント情報を第三者と共有する行為</li>
                <li>当方のサービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為</li>
                <li>本サービスを利用した不正なLLM API呼び出しの中継</li>
                <li>その他、当方が不適切と判断する行為</li>
              </ul>
            </div>
          </article>

          {/* 第6条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第6条（データの取り扱い）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. 本サービスを通じて記録されるトレースデータは、ユーザーのワークスペースごとに隔離して保存されます。
              </p>
              <p>
                2. ユーザーは、自己のトレースデータに対する所有権を保持します。当方は、本サービスの提供および改善の目的でのみ当該データを処理します。
              </p>
              <p>
                3. 当方は、ユーザーのトレースデータをAIモデルの学習に使用することはありません。
              </p>
              <p>
                4. データの保存期間は、ユーザーのご利用プランに応じて異なります。詳細は料金プランをご確認ください。
              </p>
              <p>
                5. アカウント削除の際、当該ユーザーに関連するトレースデータは、当方が合理的な期間内に削除するものとします。
              </p>
            </div>
          </article>

          {/* 第7条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第7条（知的財産権）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. 本サービスおよび本サービスに関連する一切の知的財産権は、当方または当方にライセンスを許諾している者に帰属します。
              </p>
              <p>
                2. ユーザーが本サービスを通じて送信・保存したコンテンツに関する知的財産権は、ユーザーに帰属します。
              </p>
              <p>
                3. 本規約に基づく本サービスの利用許諾は、本サービスに関する当方の知的財産権の使用許諾を意味するものではありません。
              </p>
            </div>
          </article>

          {/* 第8条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第8条（サービスの変更・中断・終了）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. 当方は、ユーザーに事前に通知することなく、本サービスの内容を変更し、または本サービスの提供を中断することができるものとします。ただし、重要な変更については合理的な期間をもって事前に通知するよう努めます。
              </p>
              <p>
                2. 当方は、以下のいずれかの事由があると判断した場合、ユーザーに通知することなく本サービスの全部または一部の提供を一時的に中断することができるものとします。
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>本サービスにかかるシステムの保守点検または更新を行う場合</li>
                <li>地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合</li>
                <li>その他、当方が本サービスの提供が困難と判断した場合</li>
              </ul>
              <p>
                3. 当方は、本サービスの提供の中断または終了によりユーザーまたは第三者が被ったいかなる不利益または損害についても、一切の責任を負わないものとします。
              </p>
            </div>
          </article>

          {/* 第9条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第9条（免責事項）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. 当方は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます）がないことを明示的にも黙示的にも保証しておりません。
              </p>
              <p>
                2. 当方は、本サービスに起因してユーザーに生じたあらゆる損害について、当方の故意または重過失による場合を除き、一切の責任を負いません。
              </p>
              <p>
                3. 当方は、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。
              </p>
            </div>
          </article>

          {/* 第10条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第10条（損害賠償）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. 当方がユーザーに対して損害賠償責任を負う場合、その賠償額は、損害発生日から遡って過去12ヶ月間にユーザーが当方に支払った利用料金の総額を上限とします。
              </p>
              <p>
                2. 当方は、いかなる場合も、逸失利益、間接損害、特別損害、偶発的損害、結果的損害、懲罰的損害について責任を負わないものとします。
              </p>
            </div>
          </article>

          {/* 第11条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第11条（秘密保持）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. ユーザーおよび当方は、本サービスの利用に関連して知り得た相手方の秘密情報（技術情報、営業情報、トレースデータを含みますがこれに限りません）を、相手方の事前の書面による承諾なしに第三者に開示・漏洩してはならないものとします。
              </p>
              <p>
                2. 前項の規定にかかわらず、以下の情報は秘密情報から除外されます。
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>開示時点で既に公知であった情報</li>
                <li>開示後、受領者の責によらず公知となった情報</li>
                <li>開示時点で既に受領者が保有していた情報</li>
                <li>正当な権限を有する第三者から秘密保持義務を負うことなく入手した情報</li>
                <li>法令または裁判所の命令により開示が義務付けられた情報</li>
              </ul>
            </div>
          </article>

          {/* 第12条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第12条（反社会的勢力の排除）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. ユーザーは、現在、暴力団、暴力団員、暴力団準構成員、暴力団関係企業、総会屋等、社会運動等標ぼうゴロまたは特殊知能暴力集団等、その他これらに準ずる者（以下「反社会的勢力」といいます）のいずれにも該当しないこと、および次の各号のいずれにも該当しないことを表明し、かつ将来にわたっても該当しないことを保証するものとします。
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>反社会的勢力が経営を支配していると認められる関係を有すること</li>
                <li>反社会的勢力が経営に実質的に関与していると認められる関係を有すること</li>
                <li>自己もしくは第三者の不正の利益を図る目的または第三者に損害を加える目的をもってするなど、不当に反社会的勢力を利用していると認められる関係を有すること</li>
                <li>反社会的勢力に対して資金等を提供し、または便宜を供与するなどの関与をしていると認められる関係を有すること</li>
              </ul>
              <p>
                2. 当方は、ユーザーが前項に違反した場合、事前の催告なしに本サービスの利用を停止し、またはアカウントを削除することができるものとします。
              </p>
            </div>
          </article>

          {/* 第13条 */}
          <article>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              第13条（準拠法・管轄裁判所）
            </h2>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                1. 本規約の解釈にあたっては、日本法を準拠法とします。
              </p>
              <p>
                2. 本サービスに関して紛争が生じた場合には、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
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
