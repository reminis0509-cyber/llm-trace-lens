import { useState } from 'react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-gray-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">LLM Trace Lens</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#problems" className="text-gray-600 hover:text-gray-900 transition-colors">課題</a>
            <a href="#solution" className="text-gray-600 hover:text-gray-900 transition-colors">ソリューション</a>
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">機能</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">料金</a>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <a
              href="#contact"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              お問い合わせ
            </a>
            <a
              href="#demo"
              className="gradient-bg text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              デモを見る
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200/50">
            <nav className="flex flex-col space-y-4">
              <a href="#problems" className="text-gray-600 hover:text-gray-900">課題</a>
              <a href="#solution" className="text-gray-600 hover:text-gray-900">ソリューション</a>
              <a href="#features" className="text-gray-600 hover:text-gray-900">機能</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900">料金</a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900">お問い合わせ</a>
              <a href="#demo" className="gradient-bg text-white px-4 py-2 rounded-lg font-medium text-center">
                デモを見る
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
