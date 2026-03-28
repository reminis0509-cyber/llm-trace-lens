import { useState, useEffect } from 'react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

  const navItems = [
    { label: '課題', href: '#problems' },
    { label: '解決策', href: '#solution' },
    { label: '機能', href: '#features' },
    { label: '導入方法', href: '#getting-started' },
    { label: '料金', href: '#pricing' },
    { label: '技術詳細', href: '/for-engineers' },
  ];

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
              {navItems.map((item) => (
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
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="px-3 py-3 text-base text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
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
