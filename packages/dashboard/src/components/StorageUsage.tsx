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
        setError('Failed to fetch storage stats');
      }
    } catch (err) {
      console.error('Failed to fetch storage stats:', err);
      setError('Failed to fetch storage stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
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
    <div
      className={`bg-white rounded-lg border p-4 ${
        isCritical
          ? 'border-red-500 bg-red-50'
          : isWarning
          ? 'border-yellow-500 bg-yellow-50'
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {isWarning && (
          <svg
            className={`w-5 h-5 ${isCritical ? 'text-red-600' : 'text-yellow-600'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        )}
        <h3 className="font-semibold text-gray-900">KV Storage Usage</h3>
      </div>

      <div className="space-y-2">
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isCritical
                ? 'bg-red-600'
                : isWarning
                ? 'bg-yellow-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            {currentCount.toLocaleString()} / {maxCount.toLocaleString()} traces
          </span>
          <span
            className={`font-semibold ${
              isCritical
                ? 'text-red-700'
                : isWarning
                ? 'text-yellow-700'
                : 'text-gray-700'
            }`}
          >
            {usagePercent}%
          </span>
        </div>

        {isWarning && (
          <div
            className={`text-sm mt-2 p-2 rounded ${
              isCritical ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            <p className="font-medium">
              {isCritical ? 'Critical: Storage almost full' : 'Warning: Storage filling up'}
            </p>
            <p className="mt-1 text-xs">
              Traces older than {maxAgeDays} days are automatically deleted. For production
              use, consider migrating to PostgreSQL.
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-2">
          Auto-cleanup: {maxAgeDays} days retention
        </p>
      </div>
    </div>
  );
}
