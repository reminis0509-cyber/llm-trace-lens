import { useState, useMemo, useCallback } from 'react';
import { Key, MessageSquare, List, BarChart3, TrendingUp, Link2, Settings as SettingsIcon, LogOut, Users, Menu, X, Building2, Shield } from 'lucide-react';
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
import { Benchmark } from './Benchmark';
import { AdminDashboard } from './AdminDashboard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import type { Trace } from '../types';

type Tab = 'traces' | 'stats' | 'analytics' | 'benchmark' | 'integrations' | 'settings' | 'apikeys' | 'playground' | 'members' | 'admin';

const baseTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'apikeys', label: 'APIキー', icon: <Key className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'playground', label: 'API接続テスト', icon: <MessageSquare className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'traces', label: 'トレース', icon: <List className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'stats', label: '統計', icon: <BarChart3 className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'analytics', label: '分析', icon: <TrendingUp className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'benchmark', label: 'ベンチマーク', icon: <Building2 className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'integrations', label: '連携', icon: <Link2 className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'members', label: 'メンバー', icon: <Users className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'settings', label: '設定', icon: <SettingsIcon className="w-4 h-4" strokeWidth={1.5} /> },
];

const adminTab: { id: Tab; label: string; icon: React.ReactNode } = {
  id: 'admin', label: '管理', icon: <Shield className="w-4 h-4" strokeWidth={1.5} />,
};

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('apikeys');
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const { user, signOut } = useAuth();
  const { workspaceId, isSystemAdmin } = useRole();

  // Callback for when TraceList receives a new real-time trace
  const handleNewTrace = useCallback(() => {
    setStatsRefreshTrigger((prev) => prev + 1);
  }, []);

  const tabs = useMemo(() => {
    if (isSystemAdmin) {
      // Insert admin tab before settings
      const settingsIndex = baseTabs.findIndex(t => t.id === 'settings');
      const result = [...baseTabs];
      result.splice(settingsIndex, 0, adminTab);
      return result;
    }
    return baseTabs;
  }, [isSystemAdmin]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleTabChange = (tabId: Tab) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-base">
      {/* Header - 48px height */}
      <header className="h-12 bg-base-surface border-b border-border sticky top-0 z-50">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between">
          {/* Logo - icon only */}
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
              <path d="M11.5 8 L7 22 L9.2 22 L11.5 14.5 L13.8 22 L16 22 Z" fill="#93c5fd"/>
              <path d="M20 10.5 L16.2 22 L18.4 22 L20 15.5 L21.6 22 L23.8 22 Z" fill="#60a5fa"/>
              <path d="M16 22 L15.2 22 L16 19.2 Z" fill="#2563eb" opacity="0.7"/>
            </svg>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center h-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative h-full px-4 text-nav flex items-center gap-2 transition-colors duration-120 ${
                  activeTab === tab.id
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.icon}
                <span className="hidden xl:inline">{tab.label}</span>
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-text-primary" />
                )}
              </button>
            ))}
          </nav>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center gap-4">
            <span className="text-xs text-text-muted truncate max-w-[150px]">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="p-2 text-text-muted hover:text-status-fail hover:bg-status-fail/10 rounded-card transition-colors duration-120"
              title="ログアウト"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" strokeWidth={1.5} /> : <Menu className="w-5 h-5" strokeWidth={1.5} />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border bg-base-surface">
            <nav className="px-4 py-2 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-card transition-colors duration-120 ${
                    activeTab === tab.id
                      ? 'text-text-primary bg-base-elevated'
                      : 'text-text-secondary hover:text-text-primary hover:bg-base-elevated'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted truncate">{user?.email}</span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-status-fail hover:bg-status-fail/10 rounded-card transition-colors duration-120"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.5} />
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="p-6 sm:p-10">
        <ErrorBoundary>
          {activeTab === 'apikeys' && (
            <ApiKeys onBack={() => setActiveTab('traces')} />
          )}
          {activeTab === 'traces' && (
            <>
              {/* Mobile: Show detail as overlay when selected */}
              <div className="lg:hidden">
                {selectedTrace ? (
                  <div className="fixed inset-0 z-40 bg-base">
                    <div className="h-full overflow-y-auto p-4">
                      <TraceDetail
                        trace={selectedTrace}
                        onClose={() => setSelectedTrace(null)}
                      />
                    </div>
                  </div>
                ) : (
                  <TraceList
                    onSelect={setSelectedTrace}
                    selectedId={selectedTrace?.id}
                    workspaceId={workspaceId || 'default'}
                    onNewTrace={handleNewTrace}
                  />
                )}
              </div>
              {/* Desktop: Side by side layout */}
              <div className="hidden lg:flex gap-6">
                <div className={selectedTrace ? 'w-1/2' : 'w-full'}>
                  <TraceList
                    onSelect={setSelectedTrace}
                    selectedId={selectedTrace?.id}
                    workspaceId={workspaceId || 'default'}
                    onNewTrace={handleNewTrace}
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
            </>
          )}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <StatsPanel refreshTrigger={statsRefreshTrigger} />
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
          {activeTab === 'benchmark' && (
            <Benchmark />
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
          {activeTab === 'admin' && isSystemAdmin && <AdminDashboard />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
