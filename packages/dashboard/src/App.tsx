import { useState, useEffect } from 'react';
import { Setup } from './pages/Setup';
import { Dashboard } from './pages/Dashboard';
import { checkSetupStatus } from './api/settings';

type View = 'loading' | 'setup' | 'dashboard';

export default function App() {
  const [view, setView] = useState<View>('loading');

  useEffect(() => {
    checkSetupStatus()
      .then(completed => {
        setView(completed ? 'dashboard' : 'setup');
      })
      .catch(() => {
        setView('setup');
      });
  }, []);

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (view === 'setup') {
    return <Setup onComplete={() => setView('dashboard')} />;
  }

  return <Dashboard onNavigateToSetup={() => setView('setup')} />;
}
