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
import ScenarioTutorialPage from './components/ScenarioTutorialPage';
import type { DocumentKind } from './lib/tutorial-scripts';
import EstimateDemo from './components/EstimateDemo';
import PiiDetection from './components/PiiDetection';
import LiveTraceFeed from './components/LiveTraceFeed';
import MidPageCTA from './components/MidPageCTA';
import PricingSimulator from './components/PricingSimulator';
import EducationShowcase from './components/EducationShowcase';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // fujitrace.jp でもLPを表示する（初見訪問者にサービス価値を伝えるため）
  // ログインは Header のボタンから /dashboard/ へアクセス

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
  } else if (/^\/tutorial\/(estimate|invoice|purchase-order|delivery-note|cover-letter)$/.test(currentPath)) {
    const scenarioSlug = currentPath.replace('/tutorial/', '') as DocumentKind;
    pageContent = <ScenarioTutorialPage scenario={scenarioSlug} />;
  } else if (currentPath === '/tutorial') {
    pageContent = <TutorialPage />;
  } else {
    pageContent = (
      <>
        {/* 1. Hero — 教育訴求 */}
        <Hero />
        <div className="section-divider" />

        {/* 2. デモ見積書フォーム — 即体験 */}
        <EstimateDemo />
        <div className="section-divider" />

        {/* 3. 教育ショーケース — チュートリアル/クエスト/AI事務員 */}
        <EducationShowcase />
        <div className="section-divider" />

        {/* 4. 課題 — AIが使えない壁 */}
        <Problems />
        <div className="section-divider" />

        {/* 5. 解決策 — 体験→鍛錬→実務 */}
        <Solution />
        <div className="section-divider" />

        {/* 6. 中間CTA */}
        <MidPageCTA />
        <div className="section-divider" />

        {/* 7. 機能一覧 */}
        <Features />
        <div className="section-divider" />

        {/* 8. 製品画面デモ */}
        <DemoShowcase />
        <div className="section-divider" />

        {/* 9. 機密情報検知 */}
        <PiiDetection />
        <div className="section-divider" />

        {/* 10. ライブトレースフィード */}
        <LiveTraceFeed />
        <div className="section-divider" />

        {/* 11. 料金 */}
        <Pricing />
        <div className="section-divider" />

        {/* 12. 料金シミュレーション */}
        <PricingSimulator />
        <div className="section-divider" />

        {/* 13. パートナー */}
        <Partners />

        {/* 14. 最終CTA */}
        <CTA />
      </>
    );
  }

  // Tutorial is a full-screen modal experience — it paints its own chrome
  // and must not be framed by the LP Header/Footer.
  const isTutorial = currentPath === '/tutorial' || /^\/tutorial\/(estimate|invoice|purchase-order|delivery-note|cover-letter)$/.test(currentPath);

  if (isTutorial) {
    return (
      <div className="min-h-screen bg-white overflow-x-hidden">
        <main>{pageContent}</main>
      </div>
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
