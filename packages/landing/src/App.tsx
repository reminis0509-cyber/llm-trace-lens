import { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import DemoShowcase from './components/DemoShowcase';
import Problems from './components/Problems';
import Solution from './components/Solution';
import Features from './components/Features';
import Partners from './components/Partners';
import Pricing from './components/Pricing';
import CTA from './components/CTA';
import Footer from './components/Footer';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';
import CompanyPage from './components/CompanyPage';
import SalesPage from './components/SalesPage';
import ForEngineersPage from './components/ForEngineersPage';
import ToolsIndexPage from './components/ToolsIndexPage';
import ClerkPage from './components/ClerkPage';
import BlogPage from './components/BlogPage';
import BlogPostPage from './components/BlogPostPage';
import TutorialPage from './components/TutorialPage';
import EstimateDemo from './components/EstimateDemo';
import PiiDetection from './components/PiiDetection';
import LiveTraceFeed from './components/LiveTraceFeed';
import MidPageCTA from './components/MidPageCTA';
import PricingSimulator from './components/PricingSimulator';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Instagram型URL構造: メインドメインではルートをダッシュボード（ログイン画面）にリダイレクト
  // about.fujitrace.jp と localhost / 127.0.0.1（開発）ではLPをそのまま表示
  const hostname = window.location.hostname;
  const isAboutSubdomain = hostname.startsWith('about.');
  const isLocalDev = hostname === 'localhost' || hostname.startsWith('127.0.0.1');
  if (currentPath === '/' && !isAboutSubdomain && !isLocalDev) {
    window.location.href = '/dashboard/';
    return null;
  }

  let pageContent: React.ReactNode;

  if (currentPath === '/terms') {
    pageContent = <TermsPage />;
  } else if (currentPath === '/privacy') {
    pageContent = <PrivacyPage />;
  } else if (currentPath === '/company') {
    pageContent = <CompanyPage />;
  } else if (currentPath === '/sales') {
    pageContent = <SalesPage />;
  } else if (currentPath === '/for-engineers') {
    pageContent = <ForEngineersPage />;
  } else if (currentPath === '/tools/clerk') {
    pageContent = <ClerkPage />;
  } else if (currentPath === '/tools') {
    pageContent = <ToolsIndexPage />;
  } else if (currentPath === '/blog') {
    pageContent = <BlogPage />;
  } else if (currentPath.startsWith('/blog/')) {
    pageContent = <BlogPostPage slug={currentPath.replace('/blog/', '')} />;
  } else if (currentPath === '/tutorial') {
    pageContent = <TutorialPage />;
  } else {
    pageContent = (
      <>
        {/* 1. Hero */}
        <Hero />
        <div className="section-divider" />

        {/* 1.5 デモ見積書フォーム */}
        <EstimateDemo />
        <div className="section-divider" />

        {/* 2. 課題 */}
        <Problems />
        <div className="section-divider" />

        {/* 3. 解決策 */}
        <Solution />
        <div className="section-divider" />

        {/* 4. 中間CTA */}
        <MidPageCTA />
        <div className="section-divider" />

        {/* 5. 機密情報検知 */}
        <PiiDetection />
        <div className="section-divider" />

        {/* 6. ライブトレースフィード */}
        <LiveTraceFeed />
        <div className="section-divider" />

        {/* 7. 製品画面デモ */}
        <DemoShowcase />
        <div className="section-divider" />

        {/* 8. 機能一覧 */}
        <Features />
        <div className="section-divider" />


        {/* 9. 料金 */}
        <Pricing />
        <div className="section-divider" />

        {/* 9.5 料金シミュレーション */}
        <PricingSimulator />
        <div className="section-divider" />

        {/* 10. パートナー */}
        <Partners />

        {/* 11. 最終CTA */}
        <CTA />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Header />
      <main>{pageContent}</main>
      <Footer />
    </div>
  );
}
