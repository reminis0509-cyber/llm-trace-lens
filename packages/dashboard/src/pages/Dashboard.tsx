import { useState, useMemo, useCallback } from 'react';
import { Key, MessageSquare, List, BarChart3, TrendingUp, Link2, Settings as SettingsIcon, LogOut, Users, Menu, X, Shield, Bot, Radio } from 'lucide-react';
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
import { AdminDashboard } from './AdminDashboard';
import { ChatbotIndex } from './chatbot/ChatbotIndex';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import type { Trace } from '../types';

type Tab = 'traces' | 'stats' | 'analytics' | 'chatbot' | 'integrations' | 'settings' | 'apikeys' | 'playground' | 'members' | 'admin';

type TabItem = { id: Tab; label: string; icon: React.ReactNode };

const mainTabs: TabItem[] = [
  { id: 'traces', label: 'トレース', icon: <List className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'stats', label: '統計', icon: <BarChart3 className="w-4 h-4" strokeWidth={1.5} /> },
  // Hidden: フィードバック機能はユーザー需要が来たら復活
  // { id: 'analytics', label: '分析', icon: <TrendingUp className="w-4 h-4" strokeWidth={1.5} /> },
];

const settingsTabs: TabItem[] = [
  { id: 'apikeys', label: 'APIキー', icon: <Key className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'playground', label: 'API接続テスト', icon: <MessageSquare className="w-4 h-4" strokeWidth={1.5} /> },
  // Hidden: 連携タブは顧客需要が来たら復活
  // { id: 'integrations', label: '連携', icon: <Link2 className="w-4 h-4" strokeWidth={1.5} /> },
  // Hidden: メンバー機能は Enterprise 需要が来たら復活
  // { id: 'members', label: 'メンバー', icon: <Users className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'settings', label: '設定', icon: <SettingsIcon className="w-4 h-4" strokeWidth={1.5} /> },
];

const chatbotTab: TabItem = {
  id: 'chatbot', label: 'チャットbot', icon: <Bot className="w-4 h-4" strokeWidth={1.5} />,
};

const adminTab: TabItem = {
  id: 'admin', label: '管理', icon: <Shield className="w-4 h-4" strokeWidth={1.5} />,
};

function getInitialTab(): Tab {
  const hash = window.location.hash.replace('#', '');
  const validTabs: Tab[] = ['traces', 'stats', 'analytics', 'chatbot', 'integrations', 'settings', 'apikeys', 'playground', 'members', 'admin'];
  if (validTabs.includes(hash as Tab)) return hash as Tab;
  return 'traces';
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const { user, signOut } = useAuth();
  const { workspaceId, isSystemAdmin } = useRole();

  // Callback for when TraceList receives a new real-time trace
  const handleNewTrace = useCallback(() => {
    setStatsRefreshTrigger((prev) => prev + 1);
  }, []);

  const adminTabs = useMemo(() => {
    return isSystemAdmin ? [adminTab] : [];
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
              <path d="M6 26 L14.5 6 L19.7 18.2" stroke="#93c5fd" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M16.5 26 L22 12.5 L27.5 26" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center h-full">
            {mainTabs.map((tab) => (
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
            <button
              key={chatbotTab.id}
              onClick={() => setActiveTab(chatbotTab.id)}
              className={`relative h-full px-4 text-nav flex items-center gap-2 transition-colors duration-120 ${
                activeTab === chatbotTab.id
                  ? 'text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {chatbotTab.icon}
              <span className="hidden xl:inline">{chatbotTab.label}</span>
              {activeTab === chatbotTab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-text-primary" />
              )}
            </button>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
            {settingsTabs.map((tab) => (
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
            {adminTabs.map((tab) => (
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
            <a
              href="/dashboard/watch"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border hover:border-accent/40 rounded-card transition-colors duration-120"
              title="ウォッチルームを開く"
            >
              <Radio className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span className="hidden xl:inline">ウォッチルーム</span>
            </a>
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
              {mainTabs.map((tab) => (
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
              <div className="pt-2 mt-2 border-t border-border">
                {settingsTabs.map((tab) => (
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
              </div>
              <div className="pt-2 mt-2 border-t border-border">
                <span className="block px-3 pb-1 text-xs text-text-muted">AIアプリ</span>
                <button
                  onClick={() => handleTabChange(chatbotTab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-card transition-colors duration-120 ${
                    activeTab === chatbotTab.id
                      ? 'text-text-primary bg-base-elevated'
                      : 'text-text-secondary hover:text-text-primary hover:bg-base-elevated'
                  }`}
                >
                  {chatbotTab.icon}
                  <span>{chatbotTab.label}</span>
                </button>
              </div>
              {adminTabs.map((tab) => (
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
          {/* Hidden: フィードバック機能はユーザー需要が来たら復活 */}
          {/* {activeTab === 'analytics' && (
            <Analytics onBack={() => setActiveTab('traces')} />
          )} */}
          {/* Hidden: 連携タブは顧客需要が来たら復活 */}
          {/* {activeTab === 'integrations' && (
            <Integrations onBack={() => setActiveTab('traces')} />
          )} */}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'playground' && (
            <Playground onBack={() => setActiveTab('apikeys')} />
          )}
          {/* Hidden: メンバー機能は Enterprise 需要が来たら復活 */}
          {/* {activeTab === 'members' && (
            <Members
              workspaceId={workspaceId || 'default'}
              onBack={() => setActiveTab('traces')}
            />
          )} */}
          {activeTab === 'chatbot' && <ChatbotIndex />}
          {activeTab === 'admin' && isSystemAdmin && <AdminDashboard />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
