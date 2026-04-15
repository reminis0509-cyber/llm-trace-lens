/**
 * WatchPane — Unified watch logic for both the dashboard "watch" tab and the
 * fullscreen /dashboard/watch route. Prior to this component, the same logic
 * (liveTraces state, realtime subscription, demo stream, sessionStorage
 * caching, ambient tint, stats header, volume control) lived in both
 * `pages/WatchRoom.tsx` and `pages/Dashboard.tsx`. Any bugfix had to be
 * applied in two places. This component is the single source of truth.
 *
 * Props:
 *   fullscreen — when true, renders the ambient/residence layout used at
 *                /dashboard/watch (own top/footer chrome, ambient tint,
 *                stacked stream, fullscreen toggle). When false/undefined,
 *                renders the embedded layout used inside the dashboard
 *                shell (ambient/stats sub-view pill row, side-by-side
 *                TraceDetail, no own chrome).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, Maximize2, Minimize2, Volume2, VolumeX, Activity } from 'lucide-react';
import { fetchTrace, fetchTraces } from '../../api/client';
import { useRealtimeTraces } from '../../hooks/useRealtimeTraces';
import { useWatchDemoStream } from '../../hooks/useWatchDemoStream';
import { TraceStream, type StreamTrace } from './TraceStream';
import { watchSound } from '../../lib/watchSound';
import { useRole } from '../../contexts/RoleContext';
import { TraceDetail } from '../TraceDetail';
import { StatsPanel } from '../StatsPanel';
import { StorageUsage } from '../StorageUsage';
import type { Trace, ValidationLevel } from '../../types';

const TRACE_CACHE_KEY = 'fujitrace-traces-cache';

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

interface AmbientState {
  errorRate: number;
  flowSpeed: number;
}

interface RecentStats {
  total: number;
  passes: number;
  warns: number;
  fails: number;
  tick: number;
}

export type WatchSubView = 'ambient' | 'stats';

export interface WatchPaneProps {
  fullscreen?: boolean;
}

export function WatchPane({ fullscreen = false }: WatchPaneProps) {
  const { workspaceId } = useRole();
  const demoMode = useMemo(() => isDemoMode(), []);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.55);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [subView, setSubView] = useState<WatchSubView>('ambient');
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);

  // Restore cached traces (embedded mode only — fullscreen route starts clean
  // to match its "residence" aesthetic).
  const [liveTraces, setLiveTraces] = useState<StreamTrace[]>(() => {
    if (fullscreen) return [];
    if (typeof window === 'undefined') return [];
    try {
      const cached = sessionStorage.getItem(TRACE_CACHE_KEY);
      if (cached) return JSON.parse(cached) as StreamTrace[];
    } catch { /* ignore */ }
    return [];
  });

  const [ambient, setAmbient] = useState<AmbientState>({ errorRate: 0, flowSpeed: 0.5 });
  const [stats, setStats] = useState<RecentStats>({
    total: 0, passes: 0, warns: 0, fails: 0, tick: 0,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const recentLevelsRef = useRef<ValidationLevel[]>([]);

  const demo = useWatchDemoStream({ enabled: demoMode, tracesPerMinute: 28 });

  useEffect(() => {
    watchSound.setEnabled(soundEnabled);
  }, [soundEnabled]);
  useEffect(() => {
    watchSound.setVolume(volume);
  }, [volume]);

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
    const errorRate = (fails + warns) / Math.max(total, 1);
    setAmbient((prev) => ({ ...prev, errorRate }));
    setStats((prev) => ({ total, passes, warns, fails, tick: prev.tick + 1 }));
  }, []);

  // Persist traces to sessionStorage (embedded mode only)
  useEffect(() => {
    if (fullscreen || demoMode || liveTraces.length === 0) return;
    try {
      const toCache = liveTraces.slice(-12);
      sessionStorage.setItem(TRACE_CACHE_KEY, JSON.stringify(toCache));
    } catch { /* quota — ignore */ }
  }, [liveTraces, demoMode, fullscreen]);

  // Initial load — merge with cached data (ID-dedup) to avoid flicker
  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchTraces({ limit: 20 });
        if (cancelled) return;
        const converted = result.traces.slice(0, 12).reverse().map(traceToStream);
        setLiveTraces((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const merged = [...prev];
          for (const t of converted) {
            if (!existingIds.has(t.id)) merged.push(t);
          }
          return merged.slice(-200);
        });
      } catch (err) {
        console.warn('[WatchPane] initial fetch failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [demoMode]);

  const handleNewTrace = useCallback(async () => {
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
      console.warn('[WatchPane] realtime fetch failed:', err);
    }
  }, [demoMode, recordLevel]);

  useRealtimeTraces({
    workspaceId: workspaceId || 'default',
    onNewTrace: handleNewTrace,
    onPoll: handleNewTrace,
    fallbackPollingInterval: 15000,
    enabled: !demoMode,
  });

  const lastDemoIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!demoMode || !demo.latest) return;
    if (demo.latest.id === lastDemoIdRef.current) return;
    lastDemoIdRef.current = demo.latest.id;
    recordLevel(demo.latest.level);
    watchSound.playForLevel(demo.latest.level);
  }, [demoMode, demo.latest, recordLevel]);

  const streamTraces = demoMode ? demo.traces : liveTraces;

  const toggleFullscreen = useCallback(async () => {
    watchSound.resume();
    try {
      if (!document.fullscreenElement) {
        await rootRef.current?.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('[WatchPane] fullscreen toggle failed:', err);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

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

  const handleStreamSelect = useCallback(async (stream: StreamTrace) => {
    if (fullscreen) {
      // Fullscreen route has no detail pane (Phase W0). Log for telemetry.
      console.log('[WatchPane] selected trace', stream.id, stream.level, stream.preview);
      return;
    }
    setLoadingTrace(true);
    try {
      const fullTrace = await fetchTrace(stream.id);
      setSelectedTrace(fullTrace);
    } catch (err) {
      console.warn('[WatchPane] failed to fetch trace detail:', err);
    } finally {
      setLoadingTrace(false);
    }
  }, [fullscreen]);

  const handleExit = () => {
    window.location.href = '/dashboard/';
  };

  // Ambient tint for fullscreen residence view
  const ambientStyle = useMemo<CSSProperties>(() => {
    const r = ambient.errorRate;
    const mix = Math.min(r, 0.55);
    const rCh = Math.round(241 + (254 - 241) * mix);
    const gCh = Math.round(245 + (242 - 245) * mix);
    const bCh = Math.round(249 + (242 - 249) * mix);
    const top = `rgb(${rCh}, ${gCh}, ${bCh})`;
    const bg = `radial-gradient(ellipse at 50% -10%, ${top} 0%, #ffffff 55%)`;
    return { background: bg };
  }, [ambient.errorRate]);

  if (fullscreen) {
    return (
      <div ref={rootRef} className="watch-room-root" style={ambientStyle}>
        <header className="watch-topbar">
          <div className="watch-topbar-left">
            <button onClick={handleExit} className="watch-icon-btn" title="ダッシュボードへ戻る">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="watch-brand">
              <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
                <path d="M6 26 L14.5 6 L19.7 18.2" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M16.5 26 L22 12.5 L27.5 26" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              <div className="watch-brand-stack">
                <span className="watch-brand-title">FujiTrace トレース</span>
                <span className="watch-brand-sub">Traces</span>
              </div>
              {demoMode && <span className="watch-demo-badge">デモ</span>}
            </div>
          </div>

          <div className="watch-stats-row">
            <Stat label="直近" value={stats.total} />
            <Stat label="正常" value={stats.passes} tone="pass" />
            <Stat label="警告" value={stats.warns} tone="warn" />
            <Stat label="異常" value={stats.fails} tone="fail" />
          </div>

          <div className="watch-topbar-right">
            <VolumeControl
              enabled={soundEnabled}
              volume={volume}
              onToggle={() => { watchSound.resume(); setSoundEnabled((v) => !v); }}
              onVolumeChange={(v) => { watchSound.resume(); setVolume(v); }}
            />
            <button
              onClick={toggleFullscreen}
              className="watch-icon-btn"
              title={isFullscreen ? '全画面を終了' : '全画面にする'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <div className="watch-stream-container">
          <TraceStream traces={streamTraces} onSelect={handleStreamSelect} />
        </div>

        <footer className="watch-footer">
          <div className="watch-heartbeat">
            <Activity className="w-4 h-4" />
            <span className="watch-heartbeat-dot" />
            <span className="watch-heartbeat-label">
              {demoMode ? 'デモ信号を受信中' : 'リアルタイム監視中'}
            </span>
          </div>
          <div className="watch-footer-meta">FujiTrace トレース</div>
        </footer>
      </div>
    );
  }

  // Embedded mode — renders inside Dashboard shell. Caller decides the outer
  // layout (fixed-height vs normal). We return two branches via subView.

  if (subView === 'stats') {
    return (
      <div className="space-y-6">
        <WatchSubViewPills current={subView} onChange={setSubView} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <StatsPanel refreshTrigger={statsRefreshTrigger} />
          </div>
          <div>
            <StorageUsage />
          </div>
        </div>
      </div>
    );
  }

  // ambient sub-view (default embedded)
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 border-b border-border bg-base-surface">
        <WatchSubViewPills current={subView} onChange={setSubView} />
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
          <span className="text-text-secondary">
            直近 <span className="font-mono font-semibold text-text-primary">{stats.total}</span>
          </span>
          <span className="text-status-pass">
            正常 <span className="font-mono font-semibold">{stats.passes}</span>
          </span>
          <span className="text-status-warn">
            警告 <span className="font-mono font-semibold">{stats.warns}</span>
          </span>
          <span className="text-status-fail">
            異常 <span className="font-mono font-semibold">{stats.fails}</span>
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { watchSound.resume(); setSoundEnabled((v) => !v); }}
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
            onChange={(e) => { watchSound.resume(); setVolume(Number(e.target.value)); }}
            className="w-16 sm:w-20 h-1 accent-accent"
            aria-label="音量"
          />
        </div>
      </div>

      {/* Mobile: overlay detail */}
      <div className="lg:hidden flex-1 relative overflow-hidden">
        {selectedTrace ? (
          <div className="absolute inset-0 z-40 bg-base overflow-y-auto">
            <div className="p-4">
              <TraceDetail trace={selectedTrace} onClose={() => setSelectedTrace(null)} />
            </div>
          </div>
        ) : (
          <>
            <TraceStream traces={streamTraces} onSelect={handleStreamSelect} />
            {loadingTrace && (
              <div className="absolute inset-0 flex items-center justify-center bg-base/50 z-10">
                <div className="text-sm text-text-secondary">読み込み中...</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Desktop: side by side */}
      <div className="hidden lg:flex gap-6 flex-1 overflow-hidden px-6 py-4">
        <div className={`${selectedTrace ? 'w-1/2' : 'w-full'} relative`}>
          <TraceStream traces={streamTraces} onSelect={handleStreamSelect} />
          {loadingTrace && (
            <div className="absolute inset-0 flex items-center justify-center bg-base/50 z-10">
              <div className="text-sm text-text-secondary">読み込み中...</div>
            </div>
          )}
        </div>
        {selectedTrace && (
          <div className="w-1/2 overflow-y-auto">
            <TraceDetail trace={selectedTrace} onClose={() => setSelectedTrace(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

// --- Helper subcomponents ---

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'pass' | 'warn' | 'fail' }) {
  const toneClass = tone ? `watch-stat--${tone}` : '';
  return (
    <div className={`watch-stat ${toneClass}`}>
      <div className="watch-stat-value">{value}</div>
      <div className="watch-stat-label">{label}</div>
    </div>
  );
}

function VolumeControl({
  enabled,
  volume,
  onToggle,
  onVolumeChange,
}: {
  enabled: boolean;
  volume: number;
  onToggle: () => void;
  onVolumeChange: (v: number) => void;
}) {
  return (
    <div className="watch-volume">
      <button onClick={onToggle} className="watch-icon-btn" title={enabled ? '音を消す' : '音を鳴らす'}>
        {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        disabled={!enabled}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
        className="watch-volume-slider"
        aria-label="音量"
      />
    </div>
  );
}

interface WatchPillsProps {
  current: WatchSubView;
  onChange: (v: WatchSubView) => void;
}

function WatchSubViewPills({ current, onChange }: WatchPillsProps): ReactNode {
  const items: { id: WatchSubView; label: string }[] = [
    { id: 'ambient', label: 'ambient' },
    { id: 'stats', label: '統計' },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-base-elevated rounded-card border border-border">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`px-3 py-1 text-xs font-medium rounded-card transition-colors duration-120 ${
            current === item.id
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          aria-pressed={current === item.id}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
