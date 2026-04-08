import { useState, useEffect, useRef, useCallback } from 'react';

type NavItem = {
  label: string;
  href: string;
};

type AiToolItem = {
  label: string;
  href: string;
  description: string;
  isNew?: boolean;
  isDivider?: false;
};

type AiMenuEntry = AiToolItem | { isDivider: true };

const navItems: NavItem[] = [
  { label: '課題', href: '#problems' },
  { label: '解決策', href: '#solution' },
  { label: '機能', href: '#features' },
  { label: '導入方法', href: '#getting-started' },
  { label: '料金', href: '#pricing' },
  { label: '技術詳細', href: '/for-engineers' },
];

const aiMenuEntries: AiMenuEntry[] = [
  {
    label: 'AI見積書作成＆チェック',
    href: '/tools/estimate',
    description: '見積書を自動生成・内容を自動チェック',
    isNew: true,
  },
  {
    label: '生成AIチャットボット',
    href: '/chatbot',
    description: '自社サイトに組み込めるAIチャット',
  },
  { isDivider: true },
  {
    label: 'すべてのAIツールを見る',
    href: '/tools',
    description: 'FujiTraceが提供するAI搭載ツール一覧',
  },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);
  const aiCloseTimer = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  // Close AI dropdown on Escape or outside click
  useEffect(() => {
    if (!isAiMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAiMenuOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setIsAiMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [isAiMenuOpen]);

  const clearAiCloseTimer = useCallback(() => {
    if (aiCloseTimer.current !== null) {
      window.clearTimeout(aiCloseTimer.current);
      aiCloseTimer.current = null;
    }
  }, []);

  const handleAiEnter = useCallback(() => {
    clearAiCloseTimer();
    setIsAiMenuOpen(true);
  }, [clearAiCloseTimer]);

  const handleAiLeave = useCallback(() => {
    clearAiCloseTimer();
    aiCloseTimer.current = window.setTimeout(() => {
      setIsAiMenuOpen(false);
    }, 150);
  }, [clearAiCloseTimer]);

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || isMenuOpen ? 'bg-white/95 backdrop-blur-sm border-b border-border shadow-sm' : 'bg-transparent'
      }`}>
        <div className="section-container">
          <div className="h-14 flex items-center justify-between">
            {/* Logo */}
            <a href="#" className="flex items-center gap-2 flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
                <path d="M6 26 L14.5 6 L19.7 18.2" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M16.5 26 L22 12.5 L27.5 26" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              <span className="text-sm font-medium text-text-primary">FujiTrace</span>
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center h-full">
              {navItems.slice(0, 5).map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="relative h-full px-3 xl:px-4 text-sm text-text-secondary hover:text-text-primary transition-colors duration-120 flex items-center"
                >
                  {item.label}
                </a>
              ))}

              {/* AI搭載システム dropdown */}
              <div
                ref={aiMenuRef}
                className="relative h-full flex items-center"
                onMouseEnter={handleAiEnter}
                onMouseLeave={handleAiLeave}
              >
                <button
                  type="button"
                  className="relative h-full px-3 xl:px-4 text-sm text-text-secondary hover:text-text-primary transition-colors duration-120 flex items-center gap-1"
                  aria-expanded={isAiMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setIsAiMenuOpen((v) => !v)}
                >
                  AI搭載システム
                  <svg
                    className={`w-3 h-3 transition-transform duration-150 ${isAiMenuOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {isAiMenuOpen && (
                  <div
                    role="menu"
                    aria-label="AI搭載システム"
                    className="absolute top-full left-0 mt-1 w-80 bg-white border border-border rounded-card shadow-lg py-2"
                  >
                    {aiMenuEntries.map((entry, idx) => {
                      if ('isDivider' in entry && entry.isDivider) {
                        return <div key={`divider-${idx}`} className="my-2 border-t border-border" />;
                      }
                      const tool = entry as AiToolItem;
                      return (
                        <a
                          key={tool.href}
                          href={tool.href}
                          role="menuitem"
                          className="block px-4 py-2.5 hover:bg-base-elevated transition-colors duration-120"
                          onClick={() => setIsAiMenuOpen(false)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary">{tool.label}</span>
                            {tool.isNew && (
                              <span className="bg-accent text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                                NEW
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-tertiary mt-0.5">{tool.description}</p>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {navItems.slice(5).map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="relative h-full px-3 xl:px-4 text-sm text-text-secondary hover:text-text-primary transition-colors duration-120 flex items-center"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Auth Buttons (Desktop) */}
            <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
              <a
                href="/dashboard"
                className="px-4 py-2 border border-border text-text-secondary rounded-card text-sm font-medium hover:text-text-primary hover:bg-base-elevated transition-colors duration-120"
              >
                ログイン
              </a>
              <a
                href="/dashboard"
                className="px-4 py-2 bg-accent text-white rounded-card text-sm font-semibold hover:bg-accent-hover transition-colors duration-120"
              >
                30日間無料で試す
              </a>
            </div>

            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
              aria-expanded={isMenuOpen}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 top-14 z-40 lg:hidden overflow-y-auto bg-white"
        >
          <nav className="flex flex-col gap-1 px-6 py-4">
            {navItems.slice(0, 5).map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="px-3 py-3 text-base text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}

            {/* AI搭載システム section */}
            <div className="mt-3 pt-3 border-t border-border">
              <div className="px-3 py-2 text-xs text-text-tertiary uppercase tracking-wide font-semibold">
                AI搭載システム
              </div>
              {aiMenuEntries.map((entry, idx) => {
                if ('isDivider' in entry && entry.isDivider) {
                  return <div key={`m-divider-${idx}`} className="my-2 border-t border-border mx-3" />;
                }
                const tool = entry as AiToolItem;
                return (
                  <a
                    key={tool.href}
                    href={tool.href}
                    className="block px-3 py-3 hover:bg-base-elevated rounded-card transition-colors duration-120"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base text-text-primary">{tool.label}</span>
                      {tool.isNew && (
                        <span className="bg-accent text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-tertiary mt-0.5">{tool.description}</p>
                  </a>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              {navItems.slice(5).map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="block px-3 py-3 text-base text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
              <a
                href="/dashboard"
                className="px-4 py-3 border border-border text-text-secondary rounded-card text-sm font-medium text-center hover:text-text-primary hover:bg-base-elevated transition-colors duration-120"
                onClick={() => setIsMenuOpen(false)}
              >
                ログイン
              </a>
              <a
                href="/dashboard"
                className="px-4 py-3 bg-accent text-white rounded-card text-sm font-semibold text-center hover:bg-accent-hover transition-colors duration-120"
                onClick={() => setIsMenuOpen(false)}
              >
                30日間無料で試す
              </a>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
