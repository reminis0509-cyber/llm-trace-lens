import { useState } from 'react';
import { Activity, Key, MessageSquare, List, BarChart3, TrendingUp, Link2, Settings as SettingsIcon, LogOut, Users } from 'lucide-react';
import { TraceList } from '../components/TraceList';
import { TraceDetail } from '../components/TraceDetail';
import { StatsPanel } from '../components/StatsPanel';
import { StorageUsage } from '../components/StorageUsage';
import { Settings } from './Settings';
import { Analytics } from './Analytics';
import { Integrations } from './Integrations';
import { ApiKeys } from './ApiKeys';
import { Playground } from './Playground';
import { Members } from './Members';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import type { Trace } from '../types';

type Tab = 'traces' | 'stats' | 'analytics' | 'integrations' | 'settings' | 'apikeys' | 'playground' | 'members';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'apikeys', label: 'API Keys', icon: <Key className="w-4 h-4" /> },
  { id: 'playground', label: 'Playground', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'traces', label: 'Traces', icon: <List className="w-4 h-4" /> },
  { id: 'stats', label: 'Stats', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'integrations', label: 'Integrations', icon: <Link2 className="w-4 h-4" /> },
  { id: 'members', label: 'Members', icon: <Users className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> },
];

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('apikeys');
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const { user, signOut } = useAuth();
  const { workspaceId } = useRole();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-navy-900">
      {/* Header */}
      <header className="bg-navy-800/80 backdrop-blur-xl border-b border-navy-700 sticky top-0 z-50">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-emerald flex items-center justify-center">
                <Activity className="w-5 h-5 text-navy-900" />
              </div>
              <h1 className="text-lg font-semibold text-gray-100">LLM Trace Lens</h1>
              <span className="text-xs font-mono text-navy-500 bg-navy-800 px-2 py-0.5 rounded border border-navy-700">
                v0.5.0
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'text-accent-cyan'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-cyan" />
                  )}
                </button>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <ErrorBoundary>
          {activeTab === 'apikeys' && (
            <ApiKeys onBack={() => setActiveTab('traces')} />
          )}
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
          {activeTab === 'playground' && (
            <Playground onBack={() => setActiveTab('apikeys')} />
          )}
          {activeTab === 'members' && (
            <Members
              workspaceId={workspaceId || 'default'}
              onBack={() => setActiveTab('traces')}
            />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
