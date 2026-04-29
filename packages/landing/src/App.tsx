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
import EducationShowcase from './components/EducationShowcase';
import Capabilities from './components/Capabilities';
import MascotDevPage from './components/MascotDevPage';
import EstimateAdPage from './components/ads/EstimateAdPage';
import InvoiceAdPage from './components/ads/InvoiceAdPage';
import MinutesAdPage from './components/ads/MinutesAdPage';
import SlideAdPage from './components/ads/SlideAdPage';
import SeikyushoPage from './pages/tools/SeikyushoPage';

// 広告着地 LP slug → component の対応表 (CEO 判断 2026-04-28 / Q10 完全 chromeless)
const AD_LANDING_PAGES: Record<string, React.ComponentType> = {
  estimate: EstimateAdPage,
  invoice: InvoiceAdPage,
  minutes: MinutesAdPage,
  slide: SlideAdPage,
};

/**
 * トップ LP — 王道シンプル LP (2026-04-28 完全作り直し、戦略 doc Section 18.2.M)
 *
 * 旧 17 セクション詰め込みから 5 セクションに圧縮:
 *   Hero → 悩み → 解決 → 料金 → 末尾 CTA
 *
 * 削除したセクションは各サブページに移動:
 *   Capabilities / Differentiation / DemoShowcase / EducationShowcase → /features
 *   FAQ → /pricing
 *   EstimateDemo → /demo
 *   TrustSection → /how-it-works
 *   LongTermFuture → 削除 (Phase A1 以降で再考)
 *   MidPageCTA → 末尾 CTA に統合
 */
function HomePage() {
  return (
    <>
      <Hero />
      <div className="section-divider" />
      <Problems />
      <div className="section-divider" />
      <Solution />
      <div className="section-divider" />
      <Pricing />
      <div className="section-divider" />
      <CTA />
    </>
  );
}

/**
 * /features — 機能詳細ページ (2026-04-28 新設、Section 18.2.M)
 *
 * トップ LP の機能訴求セクションを集約:
 *   Capabilities (全 12 機能) + Differentiation (海外 AI 比較) +
 *   DemoShowcase (書類サンプル) + EducationShowcase (教育訴求)
 */
function FeaturesPage() {
  return (
    <>
      <div className="pt-24 pb-8 px-4 sm:px-6">
        <div className="section-container">
          <h1 className="text-display-md font-semibold tracking-tight text-text-primary">
            おしごと AI でできること。
          </h1>
          <p className="mt-3 text-text-secondary text-base sm:text-lg max-w-2xl">
            机上の事務作業を AI が肩代わり。机に向かう時間を、判断と提案に使う時間に変えます。
          </p>
        </div>
      </div>
      <Capabilities />
      <div className="section-divider" />
      <Differentiation />
      <div className="section-divider" />
      <DemoShowcase />
      <div className="section-divider" />
      <EducationShowcase />
    </>
  );
}

/**
 * /pricing — 料金詳細ページ (2026-04-28 新設、Section 18.2.M)
 */
function PricingPage() {
  return (
    <>
      <div className="pt-24 pb-8 px-4 sm:px-6">
        <div className="section-container">
          <h1 className="text-display-md font-semibold tracking-tight text-text-primary">
            シンプルな 5 プラン。
          </h1>
          <p className="mt-3 text-text-secondary text-base sm:text-lg max-w-2xl">
            個人から大企業まで、規模に合わせて選べます。会計ソフトと同じ価格帯から始められます。
          </p>
        </div>
      </div>
      <Pricing />
      <div className="section-divider" />
      <FAQ />
    </>
  );
}

/**
 * /demo — 見積書デモフォームページ (2026-04-28 新設、Section 18.2.M)
 */
function DemoPage() {
  return (
    <>
      <div className="pt-24 pb-8 px-4 sm:px-6">
        <div className="section-container">
          <h1 className="text-display-md font-semibold tracking-tight text-text-primary">
            無料で、見積書を 1 枚作ってみる。
          </h1>
          <p className="mt-3 text-text-secondary text-base sm:text-lg max-w-2xl">
            登録不要・クレジットカード不要。実際にどんな出力になるか、その手触りで判断してください。
          </p>
        </div>
      </div>
      <EstimateDemo />
    </>
  );
}

/**
 * /how-it-works — 技術詳細ページ (2026-04-28 新設、Section 18.2.M)
 *
 * セキュリティ + 監査統制 + 国内データ滞留 + 機密情報マネジメント。
 * Enterprise 訴求の中核ページ。
 */
function HowItWorksPage() {
  return (
    <>
      <div className="pt-24 pb-8 px-4 sm:px-6">
        <div className="section-container">
          <h1 className="text-display-md font-semibold tracking-tight text-text-primary">
            国内で完結する、AI 運用基盤。
          </h1>
          <p className="mt-3 text-text-secondary text-base sm:text-lg max-w-2xl">
            機密情報を社外に出さない設計、人間承認後に実行する運用、すべての操作を記録する監査統制 —
            おしごと AI を中小企業の業務に乗せるための基盤です。
          </p>
        </div>
      </div>
      <TrustSection />
    </>
  );
}

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
  } else if (currentPath === '/tools/seikyusho') {
    // Freemium 第 1 層 Phase A — 請求書テンプレート (戦略 doc Section 5.6 / 18.2.N)
    pageContent = <SeikyushoPage />;
  } else if (currentPath === '/tools') {
    pageContent = <ToolsIndexPage />;
  } else if (currentPath === '/blog') {
    pageContent = <BlogPage />;
  } else if (currentPath.startsWith('/blog/')) {
    pageContent = <BlogPostPage slug={currentPath.replace('/blog/', '')} />;
  } else if (/^\/tutorial\/(estimate|invoice|purchase-order|delivery-note|cover-letter)$/.test(currentPath)) {
    const scenarioSlug = currentPath.replace('/tutorial/', '') as DocumentKind;
    pageContent = <ScenarioTutorialPage scenario={scenarioSlug} />;
  } else if (currentPath === '/tutorial' || currentPath === '/liff/tutorial') {
    pageContent = <TutorialPage />;
  } else if (currentPath === '/dev/mascot') {
    pageContent = <MascotDevPage />;
  } else if (currentPath.startsWith('/ads/')) {
    const slug = currentPath.replace('/ads/', '');
    const AdPage = AD_LANDING_PAGES[slug];
    pageContent = AdPage ? <AdPage /> : null;
  } else if (currentPath === '/features') {
    pageContent = <FeaturesPage />;
  } else if (currentPath === '/pricing') {
    pageContent = <PricingPage />;
  } else if (currentPath === '/demo') {
    pageContent = <DemoPage />;
  } else if (currentPath === '/how-it-works') {
    pageContent = <HowItWorksPage />;
  } else {
    // トップ LP — 王道シンプル 5 セクション (Section 18.2.M)
    pageContent = <HomePage />;
  }

  // Tutorial is a full-screen modal experience — it paints its own chrome
  // and must not be framed by the LP Header/Footer.
  // /liff/tutorial is the LINE in-app browser variant and also chromeless.
  // /dev/mascot is an internal-only dev preview; also chromeless.
  // /ads/* are ad-targeted landing pages; also chromeless (Q10).
  const isChromeless =
    currentPath === '/tutorial' ||
    currentPath === '/liff/tutorial' ||
    currentPath === '/dev/mascot' ||
    currentPath.startsWith('/ads/') ||
    /^\/tutorial\/(estimate|invoice|purchase-order|delivery-note|cover-letter)$/.test(currentPath);

  if (isChromeless) {
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
