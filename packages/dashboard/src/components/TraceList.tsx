import { useState, useEffect } from 'react';
import { fetchTraces } from '../api/client';
import type { Trace, ValidationLevel } from '../types';

interface Props {
  onSelect: (trace: Trace) => void;
  selectedId?: string;
}

const LEVEL_COLORS: Record<ValidationLevel, string> = {
  PASS: 'bg-green-100 text-green-800',
  WARN: 'bg-yellow-100 text-yellow-800',
  FAIL: 'bg-orange-100 text-orange-800',
  BLOCK: 'bg-red-100 text-red-800',
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'bg-emerald-100 text-emerald-800',
  anthropic: 'bg-amber-100 text-amber-800',
  gemini: 'bg-blue-100 text-blue-800',
  deepseek: 'bg-purple-100 text-purple-800',
};

export function TraceList({ onSelect, selectedId }: Props) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Traces ({total})</h2>
          <button
            onClick={loadTraces}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex gap-1">
            {['all', 'PASS', 'WARN', 'FAIL', 'BLOCK'].map((level) => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-3 py-1 text-sm rounded-full transition ${
                  filter === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1"
          >
            <option value="all">All Providers</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-100 max-h-[calc(100vh-280px)] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : traces.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No traces found</div>
        ) : (
          traces.map((trace) => (
            <div
              key={trace.id}
              onClick={() => onSelect(trace)}
              className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                selectedId === trace.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      PROVIDER_COLORS[trace.provider] || 'bg-gray-100'
                    }`}
                  >
                    {trace.provider}
                  </span>
                  <span className="text-sm text-gray-600">{trace.model}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      LEVEL_COLORS[trace.validation.overall]
                    }`}
                  >
                    {trace.validation.overall}
                  </span>
                  <span className="text-sm text-gray-500">
                    {trace.validation.score}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                {trace.prompt}
              </p>

              <p className="text-sm text-gray-900 font-medium line-clamp-1 mb-2">
                {trace.structured.answer}
              </p>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>Confidence: {(trace.structured.confidence * 100).toFixed(0)}%</span>
                <span>Evidence: {trace.structured.evidence.length}</span>
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
