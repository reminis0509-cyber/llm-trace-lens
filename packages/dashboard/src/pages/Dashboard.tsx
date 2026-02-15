import { useState } from 'react';
import { TraceList } from '../components/TraceList';
import { TraceDetail } from '../components/TraceDetail';
import { StatsPanel } from '../components/StatsPanel';
import { StorageUsage } from '../components/StorageUsage';
import { Settings } from './Settings';
import { Analytics } from './Analytics';
import { Integrations } from './Integrations';
import type { Trace } from '../types';

type Tab = 'traces' | 'stats' | 'analytics' | 'integrations' | 'settings';

interface DashboardProps {
  onNavigateToSetup?: () => void;
}

export function Dashboard({ onNavigateToSetup }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('traces');
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <h1 className="text-xl font-bold text-gray-900">LLM Trace Lens</h1>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              v0.4.0
            </span>
          </div>
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab('traces')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'traces'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Traces
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'stats'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Stats
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'analytics'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'integrations'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Integrations
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'settings'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Settings
            </button>
            {onNavigateToSetup && (
              <button
                onClick={onNavigateToSetup}
                className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                API Keys
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {activeTab === 'traces' && (
          <div className="flex gap-6">
            <div className={selectedTrace ? 'w-1/2' : 'w-full'}>
              <TraceList
                onSelect={setSelectedTrace}
                selectedId={selectedTrace?.id}
              />
            </div>
            {selectedTrace && (
              <div className="w-1/2">
                <TraceDetail
                  trace={selectedTrace}
                  onClose={() => setSelectedTrace(null)}
                />
              </div>
            )}
          </div>
        )}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <StatsPanel />
              </div>
              <div>
                <StorageUsage />
              </div>
            </div>
          </div>
        )}
        {activeTab === 'analytics' && (
          <Analytics onBack={() => setActiveTab('traces')} />
        )}
        {activeTab === 'integrations' && (
          <Integrations onBack={() => setActiveTab('traces')} />
        )}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
