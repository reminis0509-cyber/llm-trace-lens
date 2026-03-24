import { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import DemoShowcase from './components/DemoShowcase';
import GettingStarted from './components/GettingStarted';
import Problems from './components/Problems';
import Solution from './components/Solution';
import Features from './components/Features';
import Architecture from './components/Architecture';
import EvaluationStandards from './components/EvaluationStandards';
import Partners from './components/Partners';
import Providers from './components/Providers';
import Pricing from './components/Pricing';
import CTA from './components/CTA';
import Footer from './components/Footer';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';
import CompanyPage from './components/CompanyPage';
import SalesPage from './components/SalesPage';
import ForEngineersPage from './components/ForEngineersPage';
import ChatWidget from './components/ChatWidget';
import ResearchWidget from './components/ResearchWidget';
import PiiDetection from './components/PiiDetection';
import MidPageCTA from './components/MidPageCTA';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
  } else {
    pageContent = (
      <>
        {/* 1. Hero: 課題提起 + 解決策 + CTA */}
        <Hero />
        <div className="section-divider" />

        {/* 2. 課題セクション: ペルソナの悩みに共感 */}
        <Problems />
        <div className="section-divider" />

        {/* 3. 解決セクション: FujiTraceの3つの価値 */}
        <Solution />
        <div className="section-divider" />

        {/* 4. 中間CTA: 課題→解決を読んだ後のアクション誘導 */}
        <MidPageCTA />
        <div className="section-divider" />

        {/* 5. 機密情報検知: コア機能の詳細 */}
        <PiiDetection />
        <div className="section-divider" />

        {/* 6. 製品画面デモ: 実際の画面イメージ */}
        <DemoShowcase />
        <div className="section-divider" />

        {/* 7. 機能一覧 */}
        <Features />
        <div className="section-divider" />

        {/* 8. 導入方法 */}
        <GettingStarted />
        <div className="section-divider" />

        {/* 9. アーキテクチャ */}
        <Architecture />
        <div className="section-divider" />

        {/* 10. 評価基準 */}
        <EvaluationStandards />
        <div className="section-divider" />

        {/* 11. 対応プロバイダー */}
        <Providers />
        <div className="section-divider" />

        {/* 12. 料金 */}
        <Pricing />

        {/* 13. パートナー */}
        <div className="section-divider" />
        <Partners />

        {/* 14. リサーチウィジェット */}
        <div className="section-divider" />
        <ResearchWidget />

        {/* 15. 最終CTA */}
        <CTA />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-base overflow-x-hidden">
      <Header />
      <main>{pageContent}</main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
