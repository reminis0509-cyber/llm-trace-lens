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

  const navItems = [
    { label: '課題', href: '#problems' },
    { label: 'ソリューション', href: '#solution' },
    { label: '機能', href: '#features' },
    { label: 'Agent対応', href: '#architecture' },
    { label: '料金', href: '#pricing' },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-base-surface/95 backdrop-blur-sm border-b border-border' : 'bg-transparent'
    }`}>
      <div className="section-container">
        <div className="h-14 flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-sm font-medium text-text-primary">FujiTrace</span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center h-full">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="relative h-full px-4 text-sm text-text-secondary hover:text-text-primary transition-colors duration-120 flex items-center"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="#contact"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-120"
            >
              お問い合わせ
            </a>
            <a
              href="#demo"
              className="px-4 py-2 bg-accent text-base rounded-card text-sm font-medium hover:bg-accent/90 transition-colors duration-120"
            >
              デモを見る
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
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

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col gap-1">
              {[...navItems, { label: 'お問い合わせ', href: '#contact' }].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#demo"
                className="mt-2 px-4 py-2.5 bg-accent text-base rounded-card text-sm font-medium text-center"
                onClick={() => setIsMenuOpen(false)}
              >
                デモを見る
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
