import { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import DemoShowcase from './components/DemoShowcase';
import Problems from './components/Problems';
import Solution from './components/Solution';
import Differentiation from './components/Differentiation';
import TrustSection from './components/TrustSection';
import FAQ from './components/FAQ';
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
import MidPageCTA from './components/MidPageCTA';
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
        {/* 1. Hero — 書類業務に、AI社員を */}
        <Hero />
        <div className="section-divider" />

        {/* 2. 課題共感 — 中小企業 DX ペイン */}
        <Problems />
        <div className="section-divider" />

        {/* 3. 解決策 — AI 社員の 3 カテゴリ */}
        <Solution />
        <div className="section-divider" />

        {/* 4. 差別化 — ChatGPT/海外AI との比較 */}
        <Differentiation />
        <div className="section-divider" />

        {/* 5. デモ見積書フォーム — 即体験 */}
        <EstimateDemo />
        <div className="section-divider" />

        {/* 6. 出力サンプル — 実書類の雰囲気 */}
        <DemoShowcase />
        <div className="section-divider" />

        {/* 7. 中間CTA */}
        <MidPageCTA />
        <div className="section-divider" />

        {/* 8. 安心材料 — セキュリティ・法令遵守 */}
        <TrustSection />
        <div className="section-divider" />

        {/* 9. 教育ショーケース — チュートリアル訴求 */}
        <EducationShowcase />
        <div className="section-divider" />

        {/* 10. 料金 */}
        <Pricing />
        <div className="section-divider" />

        {/* 11. FAQ */}
        <FAQ />

        {/* 12. 最終CTA */}
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
