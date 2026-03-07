import Header from './components/Header';
import Hero from './components/Hero';
import Problems from './components/Problems';
import Solution from './components/Solution';
import Features from './components/Features';
import Architecture from './components/Architecture';
import Partners from './components/Partners';
import Providers from './components/Providers';
import Pricing from './components/Pricing';
import CTA from './components/CTA';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-base">
      <Header />
      <main>
        <Hero />
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
