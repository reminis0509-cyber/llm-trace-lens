function handleNavigation(e: React.MouseEvent<HTMLAnchorElement>, path: string) {
  e.preventDefault();
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

export default function Footer() {
  return (
    <footer className="py-8 sm:py-12 px-4 sm:px-6 border-t border-border">
      <div className="section-container">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm font-medium text-text-primary">FujiTrace</span>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              LLMの可観測性・検証・<br />
              AIエージェントトレースプラットフォーム
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-3">製品</h4>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><a href="#features" className="hover:text-text-primary transition-colors duration-120">機能</a></li>
              <li><a href="#pricing" className="hover:text-text-primary transition-colors duration-120">料金</a></li>
              <li><a href="#" className="hover:text-text-primary transition-colors duration-120">ドキュメント</a></li>
              <li><a href="#" className="hover:text-text-primary transition-colors duration-120">API リファレンス</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-3">会社情報</h4>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><a href="#" className="hover:text-text-primary transition-colors duration-120">会社概要</a></li>
              <li><a href="#partners" className="hover:text-text-primary transition-colors duration-120">パートナープログラム</a></li>
              <li><a href="#" className="hover:text-text-primary transition-colors duration-120">採用情報</a></li>
              <li><a href="#" className="hover:text-text-primary transition-colors duration-120">ブログ</a></li>
              <li><a href="#contact" className="hover:text-text-primary transition-colors duration-120">お問い合わせ</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-3">法的情報</h4>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>
                <a
                  href="/privacy"
                  onClick={(e) => handleNavigation(e, '/privacy')}
                  className="hover:text-text-primary transition-colors duration-120"
                >
                  プライバシーポリシー
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  onClick={(e) => handleNavigation(e, '/terms')}
                  className="hover:text-text-primary transition-colors duration-120"
                >
                  利用規約
                </a>
              </li>
              <li><a href="#" className="hover:text-text-primary transition-colors duration-120">セキュリティ</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            &copy; 2026 FujiTrace. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <a href="#" className="text-text-muted hover:text-text-primary transition-colors duration-120 p-2 hover:bg-base-elevated rounded-card">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
            <a href="#" className="text-text-muted hover:text-text-primary transition-colors duration-120 p-2 hover:bg-base-elevated rounded-card">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
