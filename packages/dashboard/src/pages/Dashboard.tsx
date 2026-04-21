import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Key, Settings as SettingsIcon, LogOut, Menu, X, Shield, Bot, Radio, HelpCircle,
  GraduationCap, Users as UsersIcon, Sun, ListChecks, Plug, Folder, Clock,
  Activity, Search, Wand2, ChevronDown, FileSpreadsheet, Mic, SpellCheck,
} from 'lucide-react';
import { Settings } from './Settings';
import { ApiKeys } from './ApiKeys';
import { AdminDashboard } from './AdminDashboard';
import { Members } from './Members';
import { ErrorBoundary } from '../components/ErrorBoundary';
import AiClerkChat from './AiClerkChat';
import { QuestSystem } from '../components/QuestSystem';
import { OnboardingTutorial } from '../components/onboarding/OnboardingTutorial';
import { shouldShowOnboarding, requestOnboardingReplay } from '../components/onboarding/onboardingState';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { WatchPane } from '../components/watch/WatchPane';
import { MorningBriefing } from './MorningBriefing';
import { TaskBoard } from './TaskBoard';
import { ConnectorSettings } from './ConnectorSettings';
import { Projects } from './Projects';
import { ProjectDetail } from './ProjectDetail';
import { ScheduleManager } from './ScheduleManager';
import { ConcurrentTaskBoard } from './ConcurrentTaskBoard';
import { WideResearch } from './WideResearch';
import { CustomMcpSettings } from './CustomMcpSettings';
import { FujiTraceApiKeys } from './FujiTraceApiKeys';
import { WebAppBuilder } from './WebAppBuilder';
import { ExcelAnalyzer } from './ExcelAnalyzer';
import { MeetingTranscriber } from './MeetingTranscriber';
import { DocumentProofreader } from './DocumentProofreader';

// Tab structure (AI Employee v2, 2026-04-20):
// Main 5 tabs: briefing (朝) → ai-clerk (依頼) → projects (永続) → tasks (進捗) → watch (監視)
// Secondary tabs remain accessible: learn / team / settings / admin
// v1 の左右線化フローは維持しつつ、projects をタスクの前段に挟む。
export type DashboardEntryTab =
  | 'briefing'
  | 'ai-clerk'
  | 'projects'
  | 'tasks'
  | 'watch'
  | 'tools'
  | 'learn'
  | 'team'
  | 'settings'
  | 'admin';
type Tab = DashboardEntryTab;

type TabItem = { id: Tab; label: string; icon: React.ReactNode };

const mainTabs: TabItem[] = [
  { id: 'briefing', label: 'ブリーフィング', icon: <Sun className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'ai-clerk', label: 'AI社員', icon: <Bot className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'projects', label: 'プロジェクト', icon: <Folder className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'tasks', label: 'タスク', icon: <ListChecks className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'watch', label: 'トレース', icon: <Radio className="w-4 h-4" strokeWidth={1.5} /> },
];

const secondaryTabs: TabItem[] = [
  { id: 'tools', label: 'ツール', icon: <Wand2 className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'learn', label: '教材', icon: <GraduationCap className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'team', label: 'チーム', icon: <UsersIcon className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'settings', label: '設定', icon: <SettingsIcon className="w-4 h-4" strokeWidth={1.5} /> },
];

const adminTab: TabItem = {
  id: 'admin', label: '管理', icon: <Shield className="w-4 h-4" strokeWidth={1.5} />,
};

function getInitialTab(override?: Tab): Tab {
  if (override) return override;
  const hash = window.location.hash.replace('#', '');
  // Backward compat for previous tab IDs — redirect to new homes.
  if (hash === 'traces' || hash === 'stats') return 'watch';
  if (hash === 'apikeys') return 'settings';
  const allTabs: Tab[] = [
    'briefing', 'ai-clerk', 'projects', 'tasks', 'watch',
    'tools', 'learn', 'team', 'settings', 'admin',
  ];
  if (allTabs.includes(hash as Tab)) return hash as Tab;
  return 'ai-clerk';
}

/**
 * Settings sub-views (2026-04-20, v2):
 *   - apikeys          : LLM プロバイダ API キー登録 (既存 ApiKeys.tsx)
 *   - general          : 一般設定
 *   - connectors       : コネクタ (7種)
 *   - custom-mcp       : カスタム MCP (v2)
 *   - fujitrace-keys   : FujiTrace 自身の API キー発行 (v2)
 */
type SettingsSubView = 'apikeys' | 'general' | 'connectors' | 'custom-mcp' | 'fujitrace-keys';

/**
 * Tools sub-view (2026-04-21, v2.1):
 *   - research            : Wide Research (SSE)
 *   - slide-builder       : スライドビルダー (旧 Web App Builder pivot)
 *   - excel-analyzer      : Excel 分析
 *   - meeting-transcriber : 音声議事録
 *   - document-proofreader: 文書校正
 */
type ToolsSubView =
  | 'research'
  | 'slide-builder'
  | 'excel-analyzer'
  | 'meeting-transcriber'
  | 'document-proofreader';

type TasksSubView = 'board' | 'running' | 'schedule';

/**
 * Entry-level view selector.
 *   - tab           : 既存のタブ構造
 *   - connectors    : /dashboard/settings/connectors 直リンク (v1)
 *   - settings-sub  : /dashboard/settings/{custom-mcp, api-keys}
 *   - projects / project-detail / schedule / running / research / web-app-builder :
 *     v2 追加の直リンクルート
 */
export type DashboardEntry =
  | { kind: 'tab'; tab?: DashboardEntryTab }
  | { kind: 'connectors' }
  | { kind: 'projects' }
  | { kind: 'project-detail'; projectId: string }
  | { kind: 'schedule' }
  | { kind: 'running' }
  | { kind: 'research' }
  | { kind: 'slide-builder' }
  | { kind: 'excel-analyzer' }
  | { kind: 'meeting-transcriber' }
  | { kind: 'document-proofreader' }
  | { kind: 'settings-sub'; sub: 'custom-mcp' | 'fujitrace-keys' };

interface DashboardProps {
  entry?: DashboardEntry;
}

export function Dashboard({ entry = { kind: 'tab' } }: DashboardProps) {
  const initialTab: Tab | undefined = (() => {
    switch (entry.kind) {
      case 'tab': return entry.tab;
      case 'connectors':
      case 'settings-sub':
        return 'settings';
      case 'projects':
      case 'project-detail':
        return 'projects';
      case 'schedule':
      case 'running':
        return 'tasks';
      case 'research':
      case 'slide-builder':
      case 'excel-analyzer':
      case 'meeting-transcriber':
      case 'document-proofreader':
        return 'tools';
      default:
        return undefined;
    }
  })();

  const initialSettingsSubView: SettingsSubView = (() => {
    if (entry.kind === 'connectors') return 'connectors';
    if (entry.kind === 'settings-sub') return entry.sub;
    return 'apikeys';
  })();

  const initialToolsSubView: ToolsSubView = (() => {
    switch (entry.kind) {
      case 'slide-builder': return 'slide-builder';
      case 'excel-analyzer': return 'excel-analyzer';
      case 'meeting-transcriber': return 'meeting-transcriber';
      case 'document-proofreader': return 'document-proofreader';
      case 'research': return 'research';
      default: return 'research';
    }
  })();

  const initialTasksSubView: TasksSubView = (() => {
    if (entry.kind === 'running') return 'running';
    if (entry.kind === 'schedule') return 'schedule';
    return 'board';
  })();

  const [activeTab, setActiveTab] = useState<Tab>(() => getInitialTab(initialTab));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [settingsSubView, setSettingsSubView] = useState<SettingsSubView>(initialSettingsSubView);
  const [toolsSubView, setToolsSubView] = useState<ToolsSubView>(initialToolsSubView);
  const [tasksSubView, setTasksSubView] = useState<TasksSubView>(initialTasksSubView);
  const [secondaryMenuOpen, setSecondaryMenuOpen] = useState(false);
  // Active project detail id (reset to null when leaving project-detail entry
  // via the projects tab). Initialized from URL entry.
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    entry.kind === 'project-detail' ? entry.projectId : null,
  );
  const { user, signOut } = useAuth();
  const { workspaceId, isSystemAdmin } = useRole();

  // First-login onboarding: auto-show for new users.
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
    // Leaving projects tab via header: clear any active project detail so the
    // next visit to "projects" shows the list, not the last-opened detail.
    if (tabId === 'projects' && activeTab === 'projects') {
      setActiveProjectId(null);
    } else if (tabId !== 'projects') {
      setActiveProjectId(null);
    }
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    setSecondaryMenuOpen(false);
  };

  const watchTabActive = activeTab === 'watch';

  return (
    <div className="min-h-screen bg-base">
      <header className="h-12 bg-base-surface border-b border-border sticky top-0 z-50">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between">
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
                onClick={() => handleTabChange(tab.id)}
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

            {/* Secondary dropdown (ツール / 教材 / チーム / 設定) */}
            <div className="relative h-full">
              <button
                type="button"
                onClick={() => setSecondaryMenuOpen((v) => !v)}
                onBlur={() => setTimeout(() => setSecondaryMenuOpen(false), 150)}
                aria-haspopup="true"
                aria-expanded={secondaryMenuOpen}
                className={`relative h-full px-4 text-nav flex items-center gap-1.5 transition-colors duration-120 ${
                  secondaryTabs.some((t) => t.id === activeTab)
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <span className="hidden xl:inline">その他</span>
                <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                {secondaryTabs.some((t) => t.id === activeTab) && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-text-primary" />
                )}
              </button>
              {secondaryMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-base-surface border border-border rounded-card shadow-lg py-1 z-50">
                  {secondaryTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onMouseDown={(e) => { e.preventDefault(); handleTabChange(tab.id); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors duration-120 ${
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
                      onMouseDown={(e) => { e.preventDefault(); handleTabChange(tab.id); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors duration-120 ${
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
              )}
            </div>
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
            <button
              type="button"
              onClick={() => handleTabChange('briefing')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border hover:border-accent/40 rounded-card transition-colors duration-120"
              title="今日のブリーフィングを開く"
              aria-label="今日のブリーフィング"
            >
              <Sun className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span className="hidden xl:inline">今日のブリーフィング</span>
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

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border bg-base-surface">
            <nav className="px-4 py-2 space-y-1">
              {[...mainTabs, ...secondaryTabs, ...adminTabs].map((tab) => (
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

      {/* Main Content */}
      {watchTabActive ? (
        <ErrorBoundary>
          <WatchPane />
        </ErrorBoundary>
      ) : (
      <main className="p-6 sm:p-10">
        <ErrorBoundary>
          {activeTab === 'briefing' && <MorningBriefing />}
          {activeTab === 'ai-clerk' && <AiClerkChat />}
          {activeTab === 'projects' && (
            activeProjectId
              ? <ProjectDetail projectId={activeProjectId} />
              : <Projects />
          )}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <TasksSubViewPills current={tasksSubView} onChange={setTasksSubView} />
              {tasksSubView === 'board' && <TaskBoard />}
              {tasksSubView === 'running' && <ConcurrentTaskBoard />}
              {tasksSubView === 'schedule' && <ScheduleManager />}
            </div>
          )}
          {activeTab === 'tools' && (
            <div className="space-y-6">
              <ToolsSubViewPills current={toolsSubView} onChange={setToolsSubView} />
              {toolsSubView === 'research' && <WideResearch />}
              {toolsSubView === 'slide-builder' && <WebAppBuilder />}
              {toolsSubView === 'excel-analyzer' && <ExcelAnalyzer />}
              {toolsSubView === 'meeting-transcriber' && <MeetingTranscriber />}
              {toolsSubView === 'document-proofreader' && <DocumentProofreader />}
            </div>
          )}
          {activeTab === 'learn' && (
            <QuestSystem onSwitchToClerk={() => setActiveTab('ai-clerk')} />
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
              {settingsSubView === 'connectors' && <ConnectorSettings />}
              {settingsSubView === 'custom-mcp' && <CustomMcpSettings />}
              {settingsSubView === 'fujitrace-keys' && <FujiTraceApiKeys />}
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
    { id: 'apikeys', label: 'LLMキー', icon: <Key className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { id: 'general', label: '一般', icon: <SettingsIcon className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { id: 'connectors', label: 'コネクタ', icon: <Plug className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { id: 'custom-mcp', label: 'カスタムMCP', icon: <Plug className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { id: 'fujitrace-keys', label: 'APIキー', icon: <Key className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-base-elevated rounded-card border border-border flex-wrap">
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

interface ToolsPillsProps {
  current: ToolsSubView;
  onChange: (v: ToolsSubView) => void;
}

function ToolsSubViewPills({ current, onChange }: ToolsPillsProps) {
  const items: { id: ToolsSubView; label: string; icon: React.ReactNode }[] = [
    { id: 'research', label: 'ワイド リサーチ', icon: <Search className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { id: 'slide-builder', label: 'スライドビルダー (β)', icon: <Wand2 className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { id: 'excel-analyzer', label: 'Excel 分析', icon: <FileSpreadsheet className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { id: 'meeting-transcriber', label: '音声議事録', icon: <Mic className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { id: 'document-proofreader', label: '文書校正', icon: <SpellCheck className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-base-elevated rounded-card border border-border flex-wrap">
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

interface TasksPillsProps {
  current: TasksSubView;
  onChange: (v: TasksSubView) => void;
}

function TasksSubViewPills({ current, onChange }: TasksPillsProps) {
  const items: { id: TasksSubView; label: string; icon: React.ReactNode }[] = [
    { id: 'board', label: 'ボード', icon: <ListChecks className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { id: 'running', label: '実行中', icon: <Activity className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    { id: 'schedule', label: '定期', icon: <Clock className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-base-elevated rounded-card border border-border flex-wrap">
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
