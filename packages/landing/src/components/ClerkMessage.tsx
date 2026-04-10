/* ------------------------------------------------------------------ */
/*  ClerkMessage — Individual message bubble for AI clerk chat         */
/* ------------------------------------------------------------------ */

import ClerkToolResult from './ClerkToolResult';

interface ToolCallData {
  toolName: string;
  matchType: 'exact' | 'adapted';
  adaptedFrom?: string;
  result: unknown;
}

interface ClerkMessageProps {
  role: 'user' | 'assistant';
  content: string;
  toolCall?: ToolCallData;
  featureRequestLogged?: boolean;
  timestamp: Date;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ClerkMessage({
  role,
  content,
  toolCall,
  featureRequestLogged,
  timestamp,
}: ClerkMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] sm:max-w-[70%] ${
          isUser
            ? 'bg-blue-50 rounded-2xl rounded-br-md px-4 py-2.5'
            : 'bg-white border-l-2 border-blue-600 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm'
        }`}
      >
        {/* Message text */}
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
          {content}
        </p>

        {/* Tool call result */}
        {toolCall && (
          <ClerkToolResult
            toolName={toolCall.toolName}
            matchType={toolCall.matchType}
            adaptedFrom={toolCall.adaptedFrom}
            result={toolCall.result}
          />
        )}

        {/* Feature request logged */}
        {featureRequestLogged && (
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-600">
            ご要望を記録しました。FujiTraceチームが対応を検討します。
          </div>
        )}

        {/* Timestamp */}
        <p
          className={`text-xs mt-1 ${
            isUser ? 'text-blue-400 text-right' : 'text-gray-400'
          }`}
        >
          {formatTime(timestamp)}
        </p>
      </div>
    </div>
  );
}
