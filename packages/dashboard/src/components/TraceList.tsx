import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, List, Wifi, WifiOff } from 'lucide-react';
import { fetchTraces, fetchTrace } from '../api/client';
import type { Trace, ValidationLevel } from '../types';
import { useRealtimeTraces, type NewTracePayload } from '../hooks/useRealtimeTraces';

interface Props {
  onSelect: (trace: Trace) => void;
  selectedId?: string;
  workspaceId?: string;
}

const LEVEL_STYLES: Record<ValidationLevel, string> = {
  PASS: 'bg-status-pass/10 text-status-pass border-status-pass/30',
  WARN: 'bg-status-warn/10 text-status-warn border-status-warn/30',
  FAIL: 'bg-status-fail/10 text-status-fail border-status-fail/30',
  BLOCK: 'bg-status-block/10 text-status-block border-status-block/30',
};

const PROVIDER_STYLES: Record<string, string> = {
  openai: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  anthropic: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
  gemini: 'bg-blue-400/10 text-blue-400 border-blue-400/30',
  deepseek: 'bg-purple-400/10 text-purple-400 border-purple-400/30',
};

export function TraceList({ onSelect, selectedId, workspaceId }: Props) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  // Handle new trace from realtime subscription
  const handleNewTrace = useCallback(async (payload: NewTracePayload) => {
    // Fetch the full trace data
    try {
      const fullTrace = await fetchTrace(payload.id);
      setTraces((prev) => {
        // Check if trace already exists
        if (prev.some((t) => t.id === payload.id)) {
          return prev;
        }
        // Add to beginning of list
        return [fullTrace, ...prev];
      });
      setTotal((prev) => prev + 1);
    } catch (error) {
      console.error('[Realtime] Failed to fetch new trace:', error);
      // Fallback: trigger a full refresh
      loadTraces();
    }
  }, []);

  // Subscribe to realtime updates
  const { isConnected } = useRealtimeTraces({
    workspaceId: workspaceId || null,
    onNewTrace: handleNewTrace,
    enabled: true,
  });

  useEffect(() => {
    loadTraces();
  }, [filter, providerFilter]);

  async function loadTraces() {
    setLoading(true);
    try {
      const result = await fetchTraces({
        limit: 50,
        level: filter === 'all' ? undefined : filter,
        provider: providerFilter === 'all' ? undefined : providerFilter,
      });
      setTraces(result.traces);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load traces:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'PASS', label: 'Pass' },
    { value: 'WARN', label: 'Warn' },
    { value: 'FAIL', label: 'Fail' },
    { value: 'BLOCK', label: 'Block' },
  ];

  return (
    <div className="glass-card">
      {/* Header */}
      <div className="p-4 border-b border-navy-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-100">
              Traces <span className="text-gray-400 font-mono text-sm ml-2">({total})</span>
            </h2>
            {workspaceId && (
              <span
                className={`flex items-center gap-1 text-xs ${
                  isConnected ? 'text-green-400' : 'text-gray-500'
                }`}
                title={isConnected ? 'Real-time updates active' : 'Real-time updates inactive'}
              >
                {isConnected ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                {isConnected ? 'Live' : 'Polling'}
              </span>
            )}
          </div>
          <button
            onClick={loadTraces}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-accent-cyan hover:bg-accent-cyan/10 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex gap-1">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`px-3 py-1.5 text-sm rounded-full transition border ${
                  filter === option.value
                    ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30'
                    : 'bg-navy-800 text-gray-400 border-navy-700 hover:border-navy-600 hover:text-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="text-sm bg-navy-800 border border-navy-600 rounded-lg px-3 py-1.5 text-gray-100 focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan"
          >
            <option value="all">All Providers</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-navy-700 max-h-[calc(100vh-280px)] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : traces.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-navy-700 flex items-center justify-center">
              <List className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400">No traces found</p>
          </div>
        ) : (
          traces.map((trace) => (
            <div
              key={trace.id}
              onClick={() => onSelect(trace)}
              className={`p-4 cursor-pointer transition-all border-l-2 ${
                selectedId === trace.id
                  ? 'bg-accent-cyan/5 border-l-accent-cyan'
                  : 'border-l-transparent hover:bg-navy-800/50 hover:border-l-accent-cyan/50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded border ${
                      PROVIDER_STYLES[trace.provider] || 'bg-gray-400/10 text-gray-400 border-gray-400/30'
                    }`}
                  >
                    {trace.provider}
                  </span>
                  <span className="text-sm text-gray-400 font-mono">{trace.model}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded border ${
                      LEVEL_STYLES[trace.validation.overall]
                    }`}
                  >
                    {trace.validation.overall}
                  </span>
                  <span className="text-sm text-gray-500 font-mono">
                    {trace.validation.score}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-300 line-clamp-2 mb-2">
                {trace.prompt}
              </p>

              <p className="text-sm text-gray-100 font-medium line-clamp-1 mb-2">
                {trace.structured.answer}
              </p>

              <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                <span>Conf: {(trace.structured.confidence * 100).toFixed(0)}%</span>
                <span>Evd: {trace.structured.evidence.length}</span>
                <span>{trace.latencyMs}ms</span>
                <span>{formatTime(trace.timestamp)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
