import { trackDashboardConversion } from '../utils/gtag';

export default function CTA() {
  return (
    <section id="contact" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        <div className="surface-card p-6 sm:p-8 lg:p-12 text-center">
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            書類業務、AIに任せませんか。
          </h2>
          <p className="text-lg text-text-secondary mb-4 max-w-2xl mx-auto leading-relaxed">
            見積書・請求書・納品書をAIが作成・チェック。
            <br className="hidden md:block" />
            金額ミスも記載漏れも自動検出。
            <br className="hidden md:block" />
            無料で今すぐ始められます。
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-text-muted">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-status-pass" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              初期費用・月額 0円
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-status-pass" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              クレジットカード不要
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-status-pass" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              ログインなしで試せる
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/dashboard"
              onClick={trackDashboardConversion}
              className="w-full sm:w-auto px-8 py-4 bg-accent text-white rounded-card text-base font-semibold hover:bg-accent-hover transition-colors duration-120 text-center"
            >
              無料で登録する
            </a>
            <a
              href="mailto:contact@fujitrace.com"
              className="w-full sm:w-auto px-6 py-4 text-text-secondary hover:text-text-primary border border-border rounded-card font-medium hover:bg-base-elevated transition-colors duration-120 text-center"
            >
              導入のご相談
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
