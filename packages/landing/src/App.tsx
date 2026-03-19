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
import ChatWidget from './components/ChatWidget';
import ResearchWidget from './components/ResearchWidget';

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
  } else {
    pageContent = (
      <>
        <Hero />
        <div className="section-divider" />
        <DemoShowcase />
        <div className="section-divider" />
        <ResearchWidget />
        <div className="section-divider" />
        <GettingStarted />
        <div className="section-divider" />
        <Problems />
        <div className="section-divider" />
        <Solution />
        <div className="section-divider" />
        <Features />
        <div className="section-divider" />
        <Architecture />
        <div className="section-divider" />
        <EvaluationStandards />
        <div className="section-divider" />
        <Partners />
        <div className="section-divider" />
        <Providers />
        <div className="section-divider" />
        <Pricing />
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
