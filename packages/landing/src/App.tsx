import Header from './components/Header';
import Hero from './components/Hero';
import Problems from './components/Problems';
import Solution from './components/Solution';
import Features from './components/Features';
import Architecture from './components/Architecture';
import Providers from './components/Providers';
import Pricing from './components/Pricing';
import CTA from './components/CTA';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <Hero />
        <Problems />
        <Solution />
        <Features />
        <Architecture />
        <Providers />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
