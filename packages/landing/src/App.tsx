import { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import DemoShowcase from './components/DemoShowcase';
import GettingStarted from './components/GettingStarted';
import Problems from './components/Problems';
import Solution from './components/Solution';
import Features from './components/Features';
import Architecture from './components/Architecture';
import Partners from './components/Partners';
import Providers from './components/Providers';
import Pricing from './components/Pricing';
import CTA from './components/CTA';
import Footer from './components/Footer';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (currentPath === '/terms') {
    return (
      <div className="min-h-screen bg-base overflow-x-hidden">
        <Header />
        <main>
          <TermsPage />
        </main>
        <Footer />
      </div>
    );
  }

  if (currentPath === '/privacy') {
    return (
      <div className="min-h-screen bg-base overflow-x-hidden">
        <Header />
        <main>
          <PrivacyPage />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base overflow-x-hidden">
      <Header />
      <main>
        <Hero />
        <div className="section-divider" />
        <DemoShowcase />
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
        <Partners />
        <div className="section-divider" />
        <Providers />
        <div className="section-divider" />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
