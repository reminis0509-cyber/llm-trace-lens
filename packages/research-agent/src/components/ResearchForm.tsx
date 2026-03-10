import { useState, useCallback } from 'react';
import type { ResearchInput } from '../agent/types';

interface ResearchFormProps {
  onSubmit: (input: ResearchInput) => void;
  isRunning: boolean;
}

export function ResearchForm({ onSubmit, isRunning }: ResearchFormProps) {
  const [topic, setTopic] = useState('');
  const [purpose, setPurpose] = useState('');
  const [focusAreas, setFocusAreas] = useState('');
  const [requesterInfo, setRequesterInfo] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!topic.trim() || !purpose.trim() || isRunning) return;

      const input: ResearchInput = {
        topic: topic.trim(),
        purpose: purpose.trim(),
      };

      if (focusAreas.trim()) {
        input.focusAreas = focusAreas.trim();
      }
      if (requesterInfo.trim()) {
        input.requesterInfo = requesterInfo.trim();
      }

      onSubmit(input);
    },
    [topic, purpose, focusAreas, requesterInfo, isRunning, onSubmit]
  );

  const inputBaseClass =
    'w-full bg-zinc-900/60 border border-zinc-700/60 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 ' +
    'focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all duration-150 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed';

  const labelClass = 'block text-sm font-medium text-zinc-300 mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Topic */}
      <div>
        <label htmlFor="topic" className={labelClass}>
          <span className="text-amber-400 mr-1">*</span>
          調査テーマ
        </label>
        <input
          id="topic"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="例: LLMオブザーバビリティ市場"
          className={inputBaseClass}
          disabled={isRunning}
          required
          aria-required="true"
          aria-label="調査テーマ"
        />
      </div>

      {/* Purpose */}
      <div>
        <label htmlFor="purpose" className={labelClass}>
          <span className="text-amber-400 mr-1">*</span>
          調査の目的
        </label>
        <input
          id="purpose"
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="例: 競合分析のため"
          className={inputBaseClass}
          disabled={isRunning}
          required
          aria-required="true"
          aria-label="調査の目的"
        />
      </div>

      {/* Focus Areas */}
      <div>
        <label htmlFor="focusAreas" className={labelClass}>
          特に知りたいこと
        </label>
        <textarea
          id="focusAreas"
          value={focusAreas}
          onChange={(e) => setFocusAreas(e.target.value)}
          placeholder="例: 市場規模、主要プレイヤー、今後のトレンド"
          className={`${inputBaseClass} resize-none`}
          rows={3}
          disabled={isRunning}
          aria-label="特に知りたいこと"
        />
      </div>

      {/* Requester Info */}
      <div>
        <label htmlFor="requesterInfo" className={labelClass}>
          依頼者情報
        </label>
        <input
          id="requesterInfo"
          type="text"
          value={requesterInfo}
          onChange={(e) => setRequesterInfo(e.target.value)}
          placeholder="例: 田中太郎 090-1234-5678"
          className={inputBaseClass}
          disabled={isRunning}
          aria-label="依頼者情報"
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          ※ PII検出デモ用
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isRunning || !topic.trim() || !purpose.trim()}
        className={
          'w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg font-medium text-sm ' +
          'transition-all duration-200 ' +
          (isRunning || !topic.trim() || !purpose.trim()
            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            : 'bg-amber-500 text-zinc-950 hover:bg-amber-400 active:bg-amber-600 shadow-lg shadow-amber-500/20')
        }
        aria-label="リサーチ開始"
        aria-busy={isRunning}
      >
        {isRunning ? (
          <>
            <SpinnerIcon />
            <span>リサーチ実行中...</span>
          </>
        ) : (
          <>
            <SearchIcon />
            <span>リサーチ開始</span>
          </>
        )}
      </button>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
