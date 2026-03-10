import { useState, useCallback } from 'react';
import { ResearchForm } from './components/ResearchForm';
import { StepTimeline } from './components/StepTimeline';
import { ReportView } from './components/ReportView';
import { runResearchAgent } from './agent/react-agent';
import type { AgentStep, ResearchInput, ResearchReport } from './agent/types';

type AppPhase = 'idle' | 'running' | 'completed' | 'error';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('idle');
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isRunning = phase === 'running';
  const hasStarted = phase !== 'idle';

  const handleStepUpdate = useCallback((step: AgentStep) => {
    setSteps((prev) => {
      const existingIndex = prev.findIndex(
        (s) => s.stepNumber === step.stepNumber
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = step;
        return updated;
      }
      return [...prev, step];
    });
  }, []);

  const handleSubmit = useCallback(
    async (input: ResearchInput) => {
      setPhase('running');
      setSteps([]);
      setReport(null);
      setErrorMessage(null);

      try {
        const result = await runResearchAgent(input, handleStepUpdate);
        setReport(result);
        setPhase('completed');
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : '不明なエラーが発生しました';
        setErrorMessage(message);
        setPhase('error');
      }
    },
    [handleStepUpdate]
  );

  const handleReset = useCallback(() => {
    setPhase('idle');
    setSteps([]);
    setReport(null);
    setErrorMessage(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-amber-500"
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
            </div>
            <div>
              <h1 className="text-base font-semibold text-zinc-100">
                FujiTrace Research Agent
              </h1>
              <p className="text-xs text-zinc-500">
                自律型AIリサーチエージェント
              </p>
            </div>
          </div>

          {hasStarted && (
            <button
              onClick={handleReset}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 rounded-md border border-zinc-700/40 hover:border-zinc-600/60"
              aria-label="新しいリサーチを開始"
            >
              新しいリサーチ
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Input form - centered when idle, top when active */}
        <div
          className={
            'layout-transition ' +
            (hasStarted
              ? 'max-w-7xl'
              : 'max-w-xl mx-auto pt-12 sm:pt-20')
          }
        >
          {/* Form section */}
          <div
            className={
              'layout-transition ' +
              (hasStarted
                ? 'bg-zinc-800/20 border border-zinc-700/30 rounded-lg p-5 mb-8'
                : '')
            }
          >
            {!hasStarted && (
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 mb-2">
                  AIリサーチエージェント
                </h2>
                <p className="text-sm text-zinc-500 max-w-md mx-auto">
                  調査テーマを入力すると、AIが自律的にWeb検索・分析を行い、
                  構造化されたレポートを生成します。
                </p>
              </div>
            )}

            <div className={hasStarted ? '' : ''}>
              <ResearchForm onSubmit={handleSubmit} isRunning={isRunning} />
            </div>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div
              className="mb-8 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3"
              role="alert"
            >
              <span className="text-red-400 shrink-0 mt-0.5" aria-hidden="true">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium text-red-300">
                  エラーが発生しました
                </p>
                <p className="text-xs text-red-400/80 mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Results area - timeline + report side by side */}
          {hasStarted && (steps.length > 0 || report) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Step Timeline - left column */}
              <div className="lg:col-span-4 xl:col-span-4">
                <div className="lg:sticky lg:top-8">
                  <StepTimeline steps={steps} />
                </div>
              </div>

              {/* Report - right column */}
              <div className="lg:col-span-8 xl:col-span-8">
                {report ? (
                  <ReportView report={report} />
                ) : isRunning ? (
                  <ReportPlaceholder />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/40 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-xs text-zinc-600 text-center">
            FujiTrace Research Agent Demo -- LLMオブザーバビリティプラットフォーム
          </p>
        </div>
      </footer>
    </div>
  );
}

function ReportPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center mb-4">
        <svg
          className="w-5 h-5 text-zinc-500 animate-pulse"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <p className="text-sm text-zinc-500">
        リサーチ実行中...
      </p>
      <p className="text-xs text-zinc-600 mt-1">
        完了するとレポートがここに表示されます
      </p>
    </div>
  );
}
