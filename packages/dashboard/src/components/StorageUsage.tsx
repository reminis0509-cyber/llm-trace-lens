import { useEffect, useState } from 'react';

interface StorageStats {
  currentCount: number;
  maxCount: number;
  maxAgeDays: number;
  oldestDate: string | null;
  usagePercent: number;
  storageType: string;
}

export function StorageUsage() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/storage/usage', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setError(null);
      } else {
        setError('ストレージ統計の取得に失敗しました');
      }
    } catch (err) {
      console.error('Failed to fetch storage stats:', err);
      setError('ストレージ統計の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="surface-card p-5">
        <div className="space-y-3">
          <div className="h-4 w-1/3 skeleton rounded" />
          <div className="h-2 w-full skeleton rounded-full" />
          <div className="h-3 w-2/3 skeleton rounded" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return null;
  }

  // Don't show for PostgreSQL (unlimited storage)
  if (stats.storageType !== 'kv' || stats.maxCount === -1) {
    return null;
  }

  const { usagePercent, currentCount, maxCount, maxAgeDays } = stats;
  const isWarning = usagePercent >= 80;
  const isCritical = usagePercent >= 95;

  return (
    <div className={`surface-card p-5 ${
      isCritical
        ? 'border-l-2 border-l-status-fail'
        : isWarning
        ? 'border-l-2 border-l-status-warn'
        : ''
    }`}>
      <h3 className="text-sm text-text-secondary mb-4 label-spacing uppercase">KVストレージ使用量</h3>

      <div className="space-y-3">
        {/* Progress bar */}
        <div className="w-full bg-base-elevated rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isCritical
                ? 'bg-status-fail'
                : isWarning
                ? 'bg-status-warn'
                : 'bg-accent'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-text-muted font-mono tabular-nums">
            {(currentCount ?? 0).toLocaleString('ja-JP')} / {(maxCount ?? 0).toLocaleString('ja-JP')} トレース
          </span>
          <span className={`font-mono tabular-nums ${
            isCritical
              ? 'text-status-fail'
              : isWarning
              ? 'text-status-warn'
              : 'text-text-primary'
          }`}>
            {usagePercent}%
          </span>
        </div>

        {isWarning && (
          <div className={`text-sm p-3 rounded-card ${
            isCritical
              ? 'bg-status-fail/10 border-l-2 border-l-status-fail'
              : 'bg-status-warn/10 border-l-2 border-l-status-warn'
          }`}>
            <p className={`text-sm font-medium ${isCritical ? 'text-status-fail' : 'text-status-warn'}`}>
              {isCritical ? '危険: ストレージがほぼ満杯です' : '警告: ストレージが逼迫しています'}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {maxAgeDays}日以上前のトレースは自動的に削除されます。
            </p>
          </div>
        )}

        <p className="text-xs text-text-muted">
          自動クリーンアップ: {maxAgeDays}日間保持
        </p>
      </div>
    </div>
  );
}
