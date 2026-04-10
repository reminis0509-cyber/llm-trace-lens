/**
 * Watch Room Mode — Phase W0 Prototype
 *
 * Strategy: docs/戦略_2026.md Section 11
 *
 * This is the fullscreen "residence" view — the goal is for an operator to
 * leave this running on a wall-mounted display all day. Minimal chrome,
 * dark theme, flowing traces, ambient sonic feedback.
 *
 * Phase W0 scope (from Section 11.8):
 *   ✓ New route /dashboard/watch
 *   ✓ Minimal flowing animation (CSS)
 *   ✓ Notification sound (Web Audio synth)
 *   ✓ Fullscreen support
 *   → Founder films X demo video
 *
 * Out of scope (Phase W1+):
 *   - Physics-based easing
 *   - Ambient anomaly background shift (simplified version only)
 *   - Pro-designed sound samples
 *   - Operator action workflows
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Maximize2, Minimize2, Volume2, VolumeX, Activity } from 'lucide-react';
import { fetchTraces } from '../api/client';
import { useRealtimeTraces } from '../hooks/useRealtimeTraces';
import { useWatchDemoStream } from '../hooks/useWatchDemoStream';
import { TraceStream, type StreamTrace } from '../components/watch/TraceStream';
import { watchSound } from '../lib/watchSound';
import { useRole } from '../contexts/RoleContext';
import type { Trace, ValidationLevel } from '../types';

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
  errorRate: number; // 0..1 over last window
  flowSpeed: number; // 0..1 (unused in W0, reserved for W1)
}

interface RecentStats {
  total: number;
  passes: number;
  warns: number;
  fails: number;
  tick: number;
}

export function WatchRoom() {
  const { workspaceId } = useRole();
  const demoMode = useMemo(() => isDemoMode(), []);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.55);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveTraces, setLiveTraces] = useState<StreamTrace[]>([]);
  const [ambient, setAmbient] = useState<AmbientState>({ errorRate: 0, flowSpeed: 0.5 });
  const [stats, setStats] = useState<RecentStats>({
    total: 0,
    passes: 0,
    warns: 0,
    fails: 0,
    tick: 0,
  });
  const rootRef = useRef<HTMLDivElement>(null);
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

  // Track which trace levels have arrived recently → compute ambient error rate + topbar stats.
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

  // Initial load of real traces (skipped in pure demo mode to keep canvas clean)
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
        console.warn('[WatchRoom] initial fetch failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  // Realtime subscription for new traces
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
    } catch (err) {
      console.warn('[WatchRoom] realtime fetch failed:', err);
    }
  }, [demoMode, recordLevel]);

  useRealtimeTraces({
    workspaceId: workspaceId || 'default',
    onNewTrace: handleNewTrace,
    onPoll: handleNewTrace,
    fallbackPollingInterval: 15000,
    enabled: !demoMode,
  });

  // React to demo stream: play sound + record level for ambient
  const lastDemoIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!demoMode || !demo.latest) return;
    if (demo.latest.id === lastDemoIdRef.current) return;
    lastDemoIdRef.current = demo.latest.id;
    recordLevel(demo.latest.level);
    watchSound.playForLevel(demo.latest.level);
  }, [demoMode, demo.latest, recordLevel]);

  const streamTraces = demoMode ? demo.traces : liveTraces;

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    watchSound.resume(); // first user gesture — unlock audio
    try {
      if (!document.fullscreenElement) {
        await rootRef.current?.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('[WatchRoom] fullscreen toggle failed:', err);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleExit = () => {
    window.location.href = '/dashboard/';
  };

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

  // Ambient tint: a barely-visible warm-white lift as error rate climbs.
  // The base is identical to the LP (fujitrace.jp) hero wash — pure white
  // at the bottom fading up into a slate-50 top edge. Errors pull the top
  // edge toward a gentle rose-white so monitors can *feel* the mood shift
  // without the UI looking alarming.
  const ambientStyle = useMemo<React.CSSProperties>(() => {
    const r = ambient.errorRate;
    // #f1f5f9 (slate-50) when calm → pull slightly toward #fef2f2 (red-50)
    // Mix channel-by-channel. Clamp the red mix at 0.55 of errorRate so
    // even a 100% error rate reads as "warm white", not "red".
    const mix = Math.min(r, 0.55);
    const rCh = Math.round(241 + (254 - 241) * mix); // 241 → 254
    const gCh = Math.round(245 + (242 - 245) * mix); // 245 → 242
    const bCh = Math.round(249 + (242 - 249) * mix); // 249 → 242
    const top = `rgb(${rCh}, ${gCh}, ${bCh})`;
    const bg = `radial-gradient(ellipse at 50% -10%, ${top} 0%, #ffffff 55%)`;
    return { background: bg };
  }, [ambient.errorRate]);

  return (
    <div ref={rootRef} className="watch-room-root" style={ambientStyle}>
      {/* Top bar — minimal chrome */}
      <header className="watch-topbar">
        <div className="watch-topbar-left">
          <button
            onClick={handleExit}
            className="watch-icon-btn"
            title="ダッシュボードへ戻る"
          >
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
            onToggle={() => {
              watchSound.resume();
              setSoundEnabled((v) => !v);
            }}
            onVolumeChange={(v) => {
              watchSound.resume();
              setVolume(v);
            }}
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

      {/* Stacked, scrollable trace feed */}
      <div className="watch-stream-container">
        <TraceStream
          traces={streamTraces}
          onSelect={(t) => {
            // Phase W0: click is a placeholder for the W2 detail pane.
            // Logging is enough for the prototype + demo video.
            console.log('[WatchRoom] selected trace', t.id, t.level, t.preview);
          }}
        />
      </div>

      {/* Bottom heartbeat — AI is alive */}
      <footer className="watch-footer">
        <div className="watch-heartbeat">
          <Activity className="w-4 h-4" />
          <span className="watch-heartbeat-dot" />
          <span className="watch-heartbeat-label">
            {demoMode ? 'デモ信号を受信中' : 'リアルタイム監視中'}
          </span>
        </div>
        <div className="watch-footer-meta">
          FujiTrace トレース
        </div>
      </footer>
    </div>
  );
}

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
