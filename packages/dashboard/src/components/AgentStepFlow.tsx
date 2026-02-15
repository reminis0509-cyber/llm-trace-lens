import { useState } from 'react';
import type { AgentTrace, AgentStep, ToolCall } from '../types';

interface Props {
  agentTrace: AgentTrace;
}

export function AgentStepFlow({ agentTrace }: Props) {
  return (
    <div className="space-y-4">
      {/* Goal */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <span className="text-sm font-semibold text-blue-700">目標:</span>
        <span className="text-blue-900">{agentTrace.goal}</span>
      </div>

      {/* Agent Info */}
      {(agentTrace.agentId || agentTrace.agentName) && (
        <div className="flex gap-4 text-sm text-gray-600">
          {agentTrace.agentName && (
            <span>
              <span className="font-medium">エージェント:</span> {agentTrace.agentName}
            </span>
          )}
          {agentTrace.agentId && (
            <span className="font-mono text-xs text-gray-400">
              {agentTrace.agentId}
            </span>
          )}
        </div>
      )}

      {/* Steps Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        {agentTrace.steps.map((step, index) => (
          <StepCard
            key={step.stepIndex}
            step={step}
            isLast={index === agentTrace.steps.length - 1}
          />
        ))}
      </div>

      {/* Final Answer */}
      {agentTrace.finalAnswer && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="text-sm font-semibold text-green-700 mb-1">
            最終回答
          </div>
          <p className="text-green-900 text-sm whitespace-pre-wrap">
            {agentTrace.finalAnswer}
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600 pt-4 border-t border-gray-200">
        <span>
          <span className="font-medium">実行時間:</span>{' '}
          {agentTrace.totalDurationMs.toLocaleString()}ms
        </span>
        <span>
          <span className="font-medium">ステップ数:</span> {agentTrace.stepCount}
        </span>
        <span>
          <span className="font-medium">ツール呼び出し:</span>{' '}
          {agentTrace.toolCallCount}
        </span>
        <span
          className={`font-medium ${
            agentTrace.status === 'completed'
              ? 'text-green-600'
              : agentTrace.status === 'failed'
                ? 'text-red-600'
                : 'text-yellow-600'
          }`}
        >
          {agentTrace.status === 'completed' && '✓ '}
          {agentTrace.status === 'failed' && '✗ '}
          {agentTrace.status === 'in_progress' && '⋯ '}
          {agentTrace.status}
        </span>
      </div>

      {/* Error */}
      {agentTrace.error && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <span className="text-sm font-semibold text-red-700">Error: </span>
          <span className="text-red-900">{agentTrace.error}</span>
        </div>
      )}
    </div>
  );
}

function StepCard({ step, isLast }: { step: AgentStep; isLast: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`relative pl-10 ${isLast ? '' : 'pb-6'}`}>
      {/* Step marker */}
      <div className="absolute left-2 w-4 h-4 rounded-full bg-cyan-500 border-2 border-white shadow" />

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Header - always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">
              ステップ {step.stepIndex + 1}
            </span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {step.action}
            </span>
            {step.toolCalls.length > 0 && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {step.toolCalls.length} tool
                {step.toolCalls.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{step.durationMs}ms</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="p-4 pt-0 space-y-3 border-t border-gray-100">
            {/* Thought */}
            <div>
              <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">
                思考
              </div>
              <p className="text-sm text-gray-700 bg-purple-50 p-2 rounded whitespace-pre-wrap">
                {step.thought}
              </p>
            </div>

            {/* Action */}
            <div>
              <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">
                アクション
              </div>
              <p className="text-sm text-gray-700 bg-orange-50 p-2 rounded">
                {step.action}
              </p>
            </div>

            {/* Tool Calls */}
            {step.toolCalls.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                  ツール呼び出し ({step.toolCalls.length})
                </div>
                <div className="space-y-2">
                  {step.toolCalls.map((tool) => (
                    <ToolCallCard key={tool.id} toolCall={tool} />
                  ))}
                </div>
              </div>
            )}

            {/* Observation */}
            <div>
              <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">
                観測結果
              </div>
              <p className="text-sm text-gray-700 bg-green-50 p-2 rounded whitespace-pre-wrap">
                {step.observation}
              </p>
            </div>

            {/* Timestamp */}
            <div className="text-xs text-gray-400 pt-2">
              {new Date(step.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [showResult, setShowResult] = useState(false);

  return (
    <div className="bg-blue-50 rounded p-2 text-xs border border-blue-100">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono font-semibold text-blue-700">
          {toolCall.name}
        </span>
        <div className="flex items-center gap-2">
          {toolCall.durationMs && (
            <span className="text-gray-500">{toolCall.durationMs}ms</span>
          )}
          {toolCall.error && (
            <span className="text-red-500 text-xs">エラー</span>
          )}
        </div>
      </div>

      {/* Arguments */}
      <div className="mb-2">
        <div className="text-gray-500 mb-0.5">引数:</div>
        <pre className="text-gray-700 bg-white p-1 rounded overflow-x-auto text-xs">
          {JSON.stringify(toolCall.arguments, null, 2)}
        </pre>
      </div>

      {/* Result toggle */}
      {(toolCall.result !== undefined || toolCall.error) && (
        <div>
          <button
            onClick={() => setShowResult(!showResult)}
            className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
          >
            {showResult ? '非表示' : '表示'}
            <svg
              className={`w-3 h-3 transition-transform ${showResult ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showResult && (
            <div className="mt-1">
              {toolCall.error ? (
                <div className="text-red-600 bg-red-50 p-1 rounded">
                  {toolCall.error}
                </div>
              ) : (
                <pre className="text-gray-700 bg-white p-1 rounded overflow-x-auto text-xs max-h-40 overflow-y-auto">
                  {typeof toolCall.result === 'string'
                    ? toolCall.result
                    : JSON.stringify(toolCall.result, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
