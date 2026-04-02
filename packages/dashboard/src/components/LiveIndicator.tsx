interface LiveIndicatorProps {
  isConnected: boolean;
  newTraceCount: number;
}

/**
 * Animated indicator showing real-time connection status.
 * Displays a pulsing dot and waveform bars when connected,
 * or a static polling label when disconnected.
 */
export function LiveIndicator({ isConnected, newTraceCount }: LiveIndicatorProps) {
  if (!isConnected) {
    return (
      <span className="text-xs text-text-muted font-mono">
        ポーリング (30s)
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Pulsing dot + label */}
      <span className="flex items-center gap-1.5 text-xs text-status-pass font-mono">
        <span
          className="relative flex h-2 w-2"
          role="status"
          aria-label="リアルタイム接続中"
        >
          <span className="animate-live-pulse absolute inline-flex h-full w-full rounded-full bg-status-pass opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-status-pass" />
        </span>
        リアルタイム
      </span>

      {/* Waveform bars */}
      <div
        className="flex items-center gap-px h-3"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-[2px] h-full rounded-full bg-status-pass/60 animate-live-wave"
            style={{
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>

      {/* New trace count badge */}
      {newTraceCount > 0 && (
        <span className="animate-trace-enter text-xs text-accent font-mono tabular-nums">
          +{newTraceCount} 新着
        </span>
      )}
    </div>
  );
}
