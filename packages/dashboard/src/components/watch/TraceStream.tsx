/**
 * Watch Room — TraceFeed (chat-style stacked feed)
 *
 * Phase W0 v3: chat-app-style direction (Slack / Discord / LINE / WhatsApp).
 * Founder's intuition: a监视員 will sit in front of this for 8 hours a day,
 * and the medium they already trust for "watch a stream of new things" is
 * a chat interface. So we mirror it exactly:
 *
 *   - Newest trace appears at the BOTTOM, pushing older ones UP
 *   - Scrolling UP shows the past (oldest at the very top)
 *   - When at the bottom, new traces stick to the bottom automatically
 *   - When the user has scrolled up to investigate, scroll position is NOT
 *     yanked when new traces arrive — and a floating "↓ 新着 N 件" badge
 *     surfaces above the bottom edge so they can hop back to live view
 *   - FAIL / BLOCK rows pulse with a persistent red glow
 *
 * Implementation: `flex-direction: column-reverse` on the list. The DOM
 * order stays oldest→newest; the visual order flips. Browsers natively
 * keep scroll anchored to the bottom edge in column-reverse, which is the
 * exact behavior chat apps rely on.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ValidationLevel } from '../../types';

export interface StreamTrace {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  preview: string;
  level: ValidationLevel;
  score: number;
  latencyMs: number;
}

interface Props {
  /** Full trace history, oldest-first (as received over time). */
  traces: StreamTrace[];
  paused?: boolean;
  onSelect?: (trace: StreamTrace) => void;
}

// Light-theme status palette — identical to the dashboard's
// `status-{pass,warn,fail,block}` tokens and the LP Hero status icons.
// These values come straight from packages/landing/tailwind.config.js.
const LEVEL_BORDER: Record<ValidationLevel, string> = {
  PASS: '#16a34a', // green-600
  WARN: '#d97706', // amber-600
  FAIL: '#dc2626', // red-600
  BLOCK: '#7c3aed', // violet-600
};

const LEVEL_GLOW: Record<ValidationLevel, string> = {
  PASS: 'rgba(22, 163, 74, 0.18)',
  WARN: 'rgba(217, 119, 6, 0.22)',
  FAIL: 'rgba(220, 38, 38, 0.28)',
  BLOCK: 'rgba(124, 58, 237, 0.28)',
};

const LEVEL_LABEL_JA: Record<ValidationLevel, string> = {
  PASS: '合格',
  WARN: '警告',
  FAIL: '失敗',
  BLOCK: 'ブロック',
};

/** Distance (px) from the bottom edge within which auto-follow stays on. */
const AUTO_FOLLOW_THRESHOLD = 64;

/** Returns true if the scroll viewport is at or near its bottom edge. */
function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= AUTO_FOLLOW_THRESHOLD;
}

export function TraceStream({ traces, paused = false, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [detached, setDetached] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const lastSeenIdRef = useRef<string | null>(null);
  const lastNewestIdRef = useRef<string | null>(null);

  // Render order is oldest → newest. The list element uses
  // `flex-direction: column-reverse`, so the newest item visually appears
  // at the BOTTOM of the container — the chat-app convention.
  const ordered = useMemo(() => {
    return traces.length > 300 ? traces.slice(-300) : traces;
  }, [traces]);

  // Detect when new traces arrive → update unseen badge if user is scrolled away.
  useEffect(() => {
    const newest = ordered[ordered.length - 1];
    if (!newest) return;
    if (newest.id === lastNewestIdRef.current) return;
    const wasFirstLoad = lastNewestIdRef.current === null;
    lastNewestIdRef.current = newest.id;
    if (wasFirstLoad) {
      lastSeenIdRef.current = newest.id;
      return;
    }
    if (!detached) {
      lastSeenIdRef.current = newest.id;
    } else {
      // count how many unseen are after lastSeenId (towards the newest end)
      let count = 0;
      for (let i = ordered.length - 1; i >= 0; i--) {
        if (ordered[i].id === lastSeenIdRef.current) break;
        count++;
      }
      setUnseenCount(count);
    }
  }, [ordered, detached]);

  // Auto-follow: when the user is near the bottom (live edge), pin scrollTop
  // to scrollHeight on every new trace so the newest row stays visible at
  // the bottom. When the user has scrolled up to investigate history, leave
  // scrollTop alone — the floating "新着 N 件" badge handles re-engagement.
  // This is the same pattern Slack / Discord / iMessage use.
  useLayoutEffect(() => {
    if (paused) return;
    if (detached) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [ordered, detached, paused]);

  // Detect scroll — flip detached state when the user pulls away from the
  // live (bottom) edge, and re-engage when they return.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = isNearBottom(el);
    if (atBottom && detached) {
      setDetached(false);
      setUnseenCount(0);
      lastSeenIdRef.current = ordered[ordered.length - 1]?.id ?? null;
    } else if (!atBottom && !detached) {
      setDetached(true);
    }
  }, [detached, ordered]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    // Optimistically clear detached on smooth-scroll
    setTimeout(() => {
      setDetached(false);
      setUnseenCount(0);
      lastSeenIdRef.current = ordered[ordered.length - 1]?.id ?? null;
    }, 400);
  }, [ordered]);

  return (
    <div className="watch-feed-root">
      <div
        ref={scrollRef}
        className="watch-feed-scroll"
        onScroll={handleScroll}
      >
        {ordered.length === 0 ? (
          <div className="watch-feed-empty">
            {/* Skeleton loading cards */}
            <ul className="watch-feed-list" style={{ opacity: 0.45 }}>
              {[...Array(5)].map((_, i) => (
                <li key={i} className="watch-feed-row" style={{ pointerEvents: 'none' }}>
                  <div className="watch-feed-outer-time">
                    <div style={{ width: 32, height: 10, borderRadius: 3, background: '#e2e8f0' }} />
                  </div>
                  <div className="watch-feed-card" style={{ borderLeftColor: '#e2e8f0' }}>
                    <div className="watch-feed-row-main">
                      <div className="watch-feed-row-head" style={{ marginBottom: 8 }}>
                        <div style={{ width: 36, height: 14, borderRadius: 3, background: '#e2e8f0' }} />
                        <div style={{ width: 80, height: 10, borderRadius: 3, background: '#e2e8f0' }} />
                      </div>
                      <div style={{ width: '70%', height: 14, borderRadius: 3, background: '#e2e8f0', marginBottom: 4 }} />
                      <div style={{ width: '45%', height: 14, borderRadius: 3, background: '#e2e8f0' }} />
                    </div>
                    <div className="watch-feed-row-score">
                      <div style={{ width: 32, height: 28, borderRadius: 3, background: '#e2e8f0' }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="watch-feed-empty-pulse" />
            <div className="watch-feed-empty-text">トレース待機中</div>
          </div>
        ) : (
          <ul className="watch-feed-list">
            {ordered.map((trace, idx) => (
              <FeedRow
                key={trace.id}
                trace={trace}
                isNewest={idx === ordered.length - 1}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>

      {detached && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="watch-feed-unseen-badge"
          aria-label="最新を表示"
        >
          <ChevronDown className="w-4 h-4" />
          {unseenCount > 0 ? (
            <span>新着 {unseenCount} 件</span>
          ) : (
            <span>最新へ戻る</span>
          )}
        </button>
      )}
    </div>
  );
}

interface FeedRowProps {
  trace: StreamTrace;
  isNewest: boolean;
  onSelect?: (trace: StreamTrace) => void;
}

function FeedRow({ trace, isNewest, onSelect }: FeedRowProps) {
  const isCritical = trace.level === 'FAIL' || trace.level === 'BLOCK';

  // Inline border + glow live on the inner card so the outer wrapper can
  // host the timestamp gutter without inheriting card chrome.
  const cardStyle: React.CSSProperties = {
    borderLeftColor: LEVEL_BORDER[trace.level],
    boxShadow: isCritical ? `0 0 28px -6px ${LEVEL_GLOW[trace.level]}` : undefined,
  };

  const handleClick = () => {
    onSelect?.(trace);
  };

  const time = useMemo(() => {
    try {
      return new Date(trace.timestamp).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [trace.timestamp]);

  return (
    <li
      className={`watch-feed-row watch-feed-row--${trace.level.toLowerCase()} ${
        isNewest ? 'watch-feed-row--newest' : ''
      } ${isCritical ? 'watch-feed-row--critical' : ''}`}
      onClick={handleClick}
    >
      {/* Timestamp gutter — sits OUTSIDE the card, LINE-style */}
      <span className="watch-feed-outer-time" aria-label="受信時刻">
        {time}
      </span>

      {/* The actual card */}
      <div className="watch-feed-card" style={cardStyle}>
        <div className="watch-feed-row-main">
          <div className="watch-feed-row-head">
            <span
              className="watch-feed-badge"
              style={{ color: LEVEL_BORDER[trace.level], borderColor: LEVEL_BORDER[trace.level] }}
            >
              {LEVEL_LABEL_JA[trace.level]}
            </span>
            <span className="watch-feed-provider">
              {trace.provider}
              {trace.model ? ` · ${trace.model}` : ''}
            </span>
            <span className="watch-feed-latency">{trace.latencyMs}ms</span>
          </div>
          <div className="watch-feed-preview">{trace.preview}</div>
        </div>
        <div className="watch-feed-row-score">
          <div className="watch-feed-score-num">{Math.round(trace.score * 100)}</div>
          <div className="watch-feed-score-label">点</div>
        </div>
      </div>
    </li>
  );
}
