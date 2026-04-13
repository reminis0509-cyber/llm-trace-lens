/* ------------------------------------------------------------------ */
/*  ClerkPage — Page wrapper for /tools/clerk                          */
/* ------------------------------------------------------------------ */

import EstimateDemo from './EstimateDemo';
import { useSeo } from '../hooks/useSeo';

export default function ClerkPage() {
  useSeo({
    title: 'AI事務員 | FujiTrace - 見積書・請求書・納品書をAIが作成・チェック',
    description:
      '見積書・請求書・納品書・発注書・送付状をAIが自動作成し、金額ミスや記載漏れをリアルタイムで検証。無料で使える業務AIアシスタント。',
    url: 'https://fujitrace.jp/tools/clerk',
  });

  return (
    <div className="pt-16">
      {/* Hero section */}
      <section className="py-16 px-6 bg-gradient-to-b from-blue-50/40 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-medium text-blue-600 mb-3 tracking-wide">
            FUJITRACE AI TOOLS
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight mb-6">
            AI事務員
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-4 leading-relaxed">
            見積書・請求書・納品書・発注書・送付状を
            <br className="hidden md:inline" />
            AIが作成し、金額ミス・記載漏れを自動検出します。
          </p>
          <div className="inline-block bg-white border border-blue-200 rounded-full px-6 py-3 shadow-sm">
            <p className="text-sm md:text-base font-medium text-slate-800">
              初期費用 0円・月額 0円・AI利用量に応じた従量課金のみ
            </p>
          </div>
        </div>
      </section>

      {/* Demo form */}
      <EstimateDemo />

      {/* Feature cards */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6 text-center">
            なぜFujiTrace AI事務員か
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-2">AIに二度書かせる</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                生成と検証を別プロンプトで実行。一度書いた結果を別のAIが厳密にレビューします。
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-2">全行動をトレース</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                全AI呼び出しがFujiTrace基盤で記録されます。「いつ・誰が・何を生成したか」を後から検証できます。
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-2">人間が最終責任</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                AIはあくまで下書き・チェック係。送付・提出の最終判断は必ず人間が行う設計です。
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
