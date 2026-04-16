import { useState, useMemo, useCallback, useEffect } from 'react';
import { Key, Settings as SettingsIcon, LogOut, Menu, X, Shield, Bot, Radio, HelpCircle, GraduationCap, Users as UsersIcon } from 'lucide-react';
import { Settings } from './Settings';
import { ApiKeys } from './ApiKeys';
import { AdminDashboard } from './AdminDashboard';
import { Members } from './Members';
import { ErrorBoundary } from '../components/ErrorBoundary';
import AiClerkChat from './AiClerkChat';
import { OnboardingTutorial } from '../components/onboarding/OnboardingTutorial';
import { shouldShowOnboarding, requestOnboardingReplay } from '../components/onboarding/onboardingState';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { WatchPane } from '../components/watch/WatchPane';

// Tab structure (2026-04-14): 5-tab regime — left-to-right = visit frequency.
// ai-clerk → watch → learn → team → settings (+ admin at far right when applicable)
type Tab = 'ai-clerk' | 'watch' | 'learn' | 'team' | 'settings' | 'admin';

type TabItem = { id: Tab; label: string; icon: React.ReactNode };

const mainTabs: TabItem[] = [
  { id: 'ai-clerk', label: 'AI事務員', icon: <Bot className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'watch', label: 'トレース', icon: <Radio className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'learn', label: '教材', icon: <GraduationCap className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'team', label: 'チーム', icon: <UsersIcon className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'settings', label: '設定', icon: <SettingsIcon className="w-4 h-4" strokeWidth={1.5} /> },
];

const adminTab: TabItem = {
  id: 'admin', label: '管理', icon: <Shield className="w-4 h-4" strokeWidth={1.5} />,
};

function getInitialTab(): Tab {
  const hash = window.location.hash.replace('#', '');
  // Backward compat for previous tab IDs — redirect to new homes.
  if (hash === 'traces' || hash === 'stats') return 'watch';
  if (hash === 'apikeys') return 'settings';
  const validTabs: Tab[] = ['ai-clerk', 'watch', 'learn', 'team', 'settings', 'admin'];
  if (validTabs.includes(hash as Tab)) return hash as Tab;
  return 'ai-clerk';
}

type SettingsSubView = 'apikeys' | 'general';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [settingsSubView, setSettingsSubView] = useState<SettingsSubView>('apikeys');
  const { user, signOut } = useAuth();
  const { workspaceId, isSystemAdmin } = useRole();

  // First-login onboarding: auto-show for new users (account created < 7 days,
  // no completion/skip flag). See docs/戦略_2026.md Section 13.2.
  useEffect(() => {
    if (!user) return;
    if (shouldShowOnboarding({ userCreatedAt: user.created_at })) {
      setShowOnboarding(true);
    }
  }, [user]);

  const handleReplayOnboarding = useCallback(() => {
    requestOnboardingReplay();
    setShowOnboarding(true);
    setMobileMenuOpen(false);
  }, []);

  const handleOnboardingFinish = useCallback(() => {
    setActiveTab('ai-clerk');
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

  // Watch tab uses a fixed-height layout (handled internally by WatchPane in
  // ambient sub-view). We still need to suppress the outer padding wrapper so
  // the pane can use `calc(100vh - 48px)` cleanly.
  const watchTabActive = activeTab === 'watch';

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

          {/* Desktop Navigation — single row, no separator (5-tab regime) */}
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
            <button
              type="button"
              onClick={handleReplayOnboarding}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border hover:border-accent/40 rounded-card transition-colors duration-120"
              title="チュートリアルをもう一度見る"
            >
              <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span className="hidden xl:inline">チュートリアル</span>
            </button>
            <a
              href="/dashboard/watch"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border hover:border-accent/40 rounded-card transition-colors duration-120"
              title="全画面で開く"
            >
              <Radio className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span className="hidden xl:inline">全画面</span>
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

        {/* Mobile Navigation Drawer — single row, no separator */}
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
            <div className="px-4 py-2 border-t border-border">
              <button
                type="button"
                onClick={handleReplayOnboarding}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
              >
                <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
                <span>チュートリアルをもう一度見る</span>
              </button>
            </div>
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

      {/* Main Content — watch tab uses no outer padding (WatchPane manages its
           own fixed-height layout); other views use the standard padded shell */}
      {watchTabActive ? (
        <ErrorBoundary>
          <WatchPane />
        </ErrorBoundary>
      ) : (
      <main className="p-6 sm:p-10">
        <ErrorBoundary>
          {activeTab === 'ai-clerk' && (
            <AiClerkChat />
          )}
          {activeTab === 'learn' && (
            <div className="max-w-2xl mx-auto py-12">
              <div className="text-center mb-8">
                <GraduationCap className="w-12 h-12 text-text-muted mx-auto mb-4" strokeWidth={1.5} />
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h2 className="text-xl font-semibold text-text-primary">教材</h2>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                    Pro 特典
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                    Phase A1 公開予定
                  </span>
                </div>
                <p className="text-sm text-text-secondary">
                  チュートリアルで触った AI 事務員を使いこなすハンズオン教材を順次公開予定。
                </p>
              </div>

              <div className="rounded-card border border-border bg-base-surface p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  付録クエスト候補
                </h3>
                <ol className="space-y-3">
                  {[
                    { title: '経費精算の一括処理', desc: '複数領収書 → 経費明細の自動整形' },
                    { title: '請求書の月次バッチ生成', desc: '取引先リスト → 一斉請求書' },
                    { title: '見積書の相場感を磨く', desc: '業種別相場 + チェック機能の活用' },
                    { title: 'Watch Room でチームの AI 利用を可視化', desc: '' },
                    { title: '自律型 AI 事務員β を業務に組み込む', desc: '複雑指示の書き方' },
                  ].map((q, i) => (
                    <li key={q.title} className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-base-elevated text-xs font-mono font-semibold text-text-primary flex-shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{q.title}</p>
                        {q.desc && (
                          <p className="text-xs text-text-secondary mt-0.5">{q.desc}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 pt-4 border-t border-border space-y-1">
                  <p className="text-xs text-text-secondary">
                    各クエストは 10-15 分、ハンズオン + 実務 Tips で構成予定。
                  </p>
                  <p className="text-xs text-text-secondary">
                    全クリアで「FujiTrace AI 事務員 応用修了」証を発行します。
                  </p>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'team' && (
            <Members
              workspaceId={workspaceId || 'default'}
              onBack={() => setActiveTab('ai-clerk')}
            />
          )}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <SettingsSubViewPills current={settingsSubView} onChange={setSettingsSubView} />
              {settingsSubView === 'apikeys' && (
                <ApiKeys onBack={() => setActiveTab('ai-clerk')} />
              )}
              {settingsSubView === 'general' && <Settings />}
            </div>
          )}
          {activeTab === 'admin' && isSystemAdmin && <AdminDashboard />}
        </ErrorBoundary>
      </main>
      )}

      {showOnboarding && (
        <OnboardingTutorial
          onClose={() => setShowOnboarding(false)}
          onFinish={handleOnboardingFinish}
        />
      )}
    </div>
  );
}

// --- Sub-view pill components ---

interface SettingsPillsProps {
  current: SettingsSubView;
  onChange: (v: SettingsSubView) => void;
}

function SettingsSubViewPills({ current, onChange }: SettingsPillsProps) {
  const items: { id: SettingsSubView; label: string; icon: React.ReactNode }[] = [
    { id: 'apikeys', label: 'APIキー', icon: <Key className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { id: 'general', label: '一般', icon: <SettingsIcon className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-base-elevated rounded-card border border-border">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-card transition-colors duration-120 ${
            current === item.id
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          aria-pressed={current === item.id}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
