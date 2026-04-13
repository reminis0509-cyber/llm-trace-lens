import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Key, List, BarChart3, Settings as SettingsIcon, LogOut, Menu, X, Shield, Bot, Radio, Volume2, VolumeX } from 'lucide-react';
import { TraceDetail } from '../components/TraceDetail';
import { StatsPanel } from '../components/StatsPanel';
import { StorageUsage } from '../components/StorageUsage';
import { Settings } from './Settings';
import { ApiKeys } from './ApiKeys';
import { AdminDashboard } from './AdminDashboard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import AiClerkChat from './AiClerkChat';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { TraceStream, type StreamTrace } from '../components/watch/TraceStream';
import { watchSound } from '../lib/watchSound';
import { useWatchDemoStream } from '../hooks/useWatchDemoStream';
import { useRealtimeTraces } from '../hooks/useRealtimeTraces';
import { fetchTrace, fetchTraces } from '../api/client';
import type { Trace, ValidationLevel } from '../types';

type Tab = 'traces' | 'stats' | 'analytics' | 'ai-clerk' | 'integrations' | 'settings' | 'apikeys' | 'members' | 'admin';

type TabItem = { id: Tab; label: string; icon: React.ReactNode };

const mainTabs: TabItem[] = [
  { id: 'traces', label: 'トレース', icon: <List className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'stats', label: '統計', icon: <BarChart3 className="w-4 h-4" strokeWidth={1.5} /> },
  // Hidden: フィードバック機能はユーザー需要が来たら復活
  // { id: 'analytics', label: '分析', icon: <TrendingUp className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'ai-clerk', label: 'AI事務員', icon: <Bot className="w-4 h-4" strokeWidth={1.5} /> },
];

const settingsTabs: TabItem[] = [
  { id: 'apikeys', label: 'APIキー', icon: <Key className="w-4 h-4" strokeWidth={1.5} /> },
  // Hidden: 連携タブは顧客需要が来たら復活
  // { id: 'integrations', label: '連携', icon: <Link2 className="w-4 h-4" strokeWidth={1.5} /> },
  // Hidden: メンバー機能は Enterprise 需要が来たら復活
  // { id: 'members', label: 'メンバー', icon: <Users className="w-4 h-4" strokeWidth={1.5} /> },
  { id: 'settings', label: '設定', icon: <SettingsIcon className="w-4 h-4" strokeWidth={1.5} /> },
];

const adminTab: TabItem = {
  id: 'admin', label: '管理', icon: <Shield className="w-4 h-4" strokeWidth={1.5} />,
};

function getInitialTab(): Tab {
  const hash = window.location.hash.replace('#', '');
  const validTabs: Tab[] = ['traces', 'stats', 'ai-clerk', 'apikeys', 'settings', 'admin'];
  if (validTabs.includes(hash as Tab)) return hash as Tab;
  return 'ai-clerk';
}

// --- Watch Room helpers (from WatchRoom.tsx) ---

function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('demo') === '1' || params.get('demo') === 'true';
}

function extractPreview(prompt: string): string {
  if (!prompt) return '(空のプロンプト)';
  const trimmed = prompt.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (let i = parsed.length - 1; i >= 0; i--) {
          const msg = parsed[i];
          if (msg && typeof msg === 'object' && msg.role === 'user' && typeof msg.content === 'string') {
            return msg.content;
          }
        }
      }
    } catch {
      // fall through
    }
  }
  return trimmed.length > 140 ? trimmed.slice(0, 140) + '…' : trimmed;
}

function traceToStream(t: Trace): StreamTrace {
  const level: ValidationLevel = t.validation?.overall ?? 'PASS';
  return {
    id: t.id,
    timestamp: t.timestamp,
    provider: t.provider,
    model: t.model,
    preview: extractPreview(t.prompt),
    level,
    score: t.validation?.score ?? 0,
    latencyMs: t.latencyMs ?? 0,
  };
}

interface RecentStats {
  total: number;
  passes: number;
  warns: number;
  fails: number;
}

// --- End Watch Room helpers ---

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const { user, signOut } = useAuth();
  const { workspaceId, isSystemAdmin } = useRole();

  // --- Watch Room inline state ---
  const demoMode = useMemo(() => isDemoMode(), []);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.55);
  // Restore cached traces for instant display, then refresh from API
  const [liveTraces, setLiveTraces] = useState<StreamTrace[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = sessionStorage.getItem('fujitrace-traces-cache');
      if (cached) return JSON.parse(cached) as StreamTrace[];
    } catch { /* ignore */ }
    return [];
  });
  const [watchStats, setWatchStats] = useState<RecentStats>({ total: 0, passes: 0, warns: 0, fails: 0 });
  const [loadingTrace, setLoadingTrace] = useState(false);
  const recentLevelsRef = useRef<ValidationLevel[]>([]);

  // Demo stream (used only when ?demo=1)
  const demo = useWatchDemoStream({ enabled: demoMode, tracesPerMinute: 28 });

  // Sync sound engine with UI state
  useEffect(() => {
    watchSound.setEnabled(soundEnabled);
  }, [soundEnabled]);
  useEffect(() => {
    watchSound.setVolume(volume);
  }, [volume]);

  // Track levels for stats
  const recordLevel = useCallback((level: ValidationLevel) => {
    recentLevelsRef.current.push(level);
    if (recentLevelsRef.current.length > 40) {
      recentLevelsRef.current = recentLevelsRef.current.slice(-40);
    }
    const recent = recentLevelsRef.current;
    const fails = recent.filter((l) => l === 'FAIL' || l === 'BLOCK').length;
    const warns = recent.filter((l) => l === 'WARN').length;
    const total = recent.length;
    const passes = total - fails - warns;
    setWatchStats({ total, passes, warns, fails });
  }, []);

  // Persist traces to sessionStorage for instant load on next visit
  useEffect(() => {
    if (demoMode || liveTraces.length === 0) return;
    try {
      // Keep only the last 12 traces to stay small
      const toCache = liveTraces.slice(-12);
      sessionStorage.setItem('fujitrace-traces-cache', JSON.stringify(toCache));
    } catch { /* quota exceeded — ignore */ }
  }, [liveTraces, demoMode]);

  // Initial load of real traces (refreshes over cached data)
  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchTraces({ limit: 20 });
        if (cancelled) return;
        const converted = result.traces.slice(0, 12).reverse().map(traceToStream);
        setLiveTraces(converted);
      } catch (err) {
        console.warn('[Dashboard/Watch] initial fetch failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [demoMode]);

  // Realtime subscription for new traces
  const handleNewWatchTrace = useCallback(async () => {
    if (demoMode) return;
    try {
      const result = await fetchTraces({ limit: 5 });
      const newest = result.traces[0];
      if (!newest) return;
      const stream = traceToStream(newest);
      setLiveTraces((prev) => {
        if (prev.some((t) => t.id === stream.id)) return prev;
        return [...prev, stream].slice(-200);
      });
      recordLevel(stream.level);
      watchSound.playForLevel(stream.level);
      setStatsRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.warn('[Dashboard/Watch] realtime fetch failed:', err);
    }
  }, [demoMode, recordLevel]);

  useRealtimeTraces({
    workspaceId: workspaceId || 'default',
    onNewTrace: handleNewWatchTrace,
    onPoll: handleNewWatchTrace,
    fallbackPollingInterval: 15000,
    enabled: !demoMode,
  });

  // React to demo stream
  const lastDemoIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!demoMode || !demo.latest) return;
    if (demo.latest.id === lastDemoIdRef.current) return;
    lastDemoIdRef.current = demo.latest.id;
    recordLevel(demo.latest.level);
    watchSound.playForLevel(demo.latest.level);
  }, [demoMode, demo.latest, recordLevel]);

  const streamTraces = demoMode ? demo.traces : liveTraces;

  // First-gesture audio unlock
  useEffect(() => {
    const unlock = () => watchSound.resume();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Handle trace selection from TraceStream
  const handleStreamSelect = useCallback(async (stream: StreamTrace) => {
    setLoadingTrace(true);
    try {
      const fullTrace = await fetchTrace(stream.id);
      setSelectedTrace(fullTrace);
    } catch (err) {
      console.warn('[Dashboard/Watch] failed to fetch trace detail:', err);
    } finally {
      setLoadingTrace(false);
    }
  }, []);

  // --- End Watch Room inline state ---

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

      {/* Main Content — traces tab uses fixed layout to prevent scroll conflicts;
           other tabs use normal scrollable padding layout */}
      {activeTab === 'traces' ? (
        <main className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
          <ErrorBoundary>
            {/* Topbar: stats + volume */}
            <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 border-b border-border bg-base-surface">
              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                <span className="text-text-secondary">
                  直近 <span className="font-mono font-semibold text-text-primary">{watchStats.total}</span>
                </span>
                <span className="text-status-pass">
                  正常 <span className="font-mono font-semibold">{watchStats.passes}</span>
                </span>
                <span className="text-status-warn">
                  警告 <span className="font-mono font-semibold">{watchStats.warns}</span>
                </span>
                <span className="text-status-fail">
                  異常 <span className="font-mono font-semibold">{watchStats.fails}</span>
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => {
                    watchSound.resume();
                    setSoundEnabled((v) => !v);
                  }}
                  className="p-1.5 text-text-secondary hover:text-text-primary rounded-card transition-colors duration-120"
                  title={soundEnabled ? '音を消す' : '音を鳴らす'}
                  aria-label={soundEnabled ? '音を消す' : '音を鳴らす'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  disabled={!soundEnabled}
                  onChange={(e) => {
                    watchSound.resume();
                    setVolume(Number(e.target.value));
                  }}
                  className="w-16 sm:w-20 h-1 accent-accent"
                  aria-label="音量"
                />
              </div>
            </div>

            {/* Mobile: Show detail as overlay when selected */}
            <div className="lg:hidden flex-1 relative overflow-hidden">
              {selectedTrace ? (
                <div className="absolute inset-0 z-40 bg-base overflow-y-auto">
                  <div className="p-4">
                    <TraceDetail
                      trace={selectedTrace}
                      onClose={() => setSelectedTrace(null)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <TraceStream
                    traces={streamTraces}
                    onSelect={handleStreamSelect}
                  />
                  {loadingTrace && (
                    <div className="absolute inset-0 flex items-center justify-center bg-base/50 z-10">
                      <div className="text-sm text-text-secondary">読み込み中...</div>
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Desktop: Side by side layout */}
            <div className="hidden lg:flex gap-6 flex-1 overflow-hidden px-6 py-4">
              <div className={`${selectedTrace ? 'w-1/2' : 'w-full'} relative`}>
                <TraceStream
                  traces={streamTraces}
                  onSelect={handleStreamSelect}
                />
                {loadingTrace && (
                  <div className="absolute inset-0 flex items-center justify-center bg-base/50 z-10">
                    <div className="text-sm text-text-secondary">読み込み中...</div>
                  </div>
                )}
              </div>
              {selectedTrace && (
                <div className="w-1/2 overflow-y-auto">
                  <TraceDetail
                    trace={selectedTrace}
                    onClose={() => setSelectedTrace(null)}
                  />
                </div>
              )}
            </div>
          </ErrorBoundary>
        </main>
      ) : (
      <main className="p-6 sm:p-10">
        <ErrorBoundary>
          {activeTab === 'apikeys' && (
            <ApiKeys onBack={() => setActiveTab('traces')} />
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
          {activeTab === 'ai-clerk' && (
            <AiClerkChat />
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
          {/* Hidden: メンバー機能は Enterprise 需要が来たら復活 */}
          {/* {activeTab === 'members' && (
            <Members
              workspaceId={workspaceId || 'default'}
              onBack={() => setActiveTab('traces')}
            />
          )} */}
          {activeTab === 'admin' && isSystemAdmin && <AdminDashboard />}
        </ErrorBoundary>
      </main>
      )}
    </div>
  );
}
