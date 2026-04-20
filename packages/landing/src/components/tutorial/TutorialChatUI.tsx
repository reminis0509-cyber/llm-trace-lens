import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  footnote?: string;
  extra?: ReactNode;
}

interface TutorialChatUIProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  suggestions?: string[];
  isTyping?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
    </svg>
  );
}

export default function TutorialChatUI({
  messages,
  onSend,
  suggestions = [],
  isTyping = false,
  disabled = false,
  placeholder = 'AI社員に指示を出す...',
}: TutorialChatUIProps) {
  const [value, setValue] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text: string) => {
    onSend(text);
  };

  const showSuggestions = messages.length === 0 && suggestions.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Message area */}
      <div
        ref={listRef}
        className="max-h-[480px] min-h-[200px] overflow-y-auto px-4 py-6"
        role="log"
        aria-live="polite"
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Suggestions shown only when no messages yet */}
          {showSuggestions && (
            <div className="flex flex-col items-center py-8">
              <p className="text-sm text-slate-500 mb-4">試してみましょう</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestion(s)}
                    disabled={disabled}
                    className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
            >
              {/* AI avatar */}
              {m.role === 'assistant' && (
                <img
                  src="/tutorial/dachshund-idle.gif"
                  alt="AI社員"
                  className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
                />
              )}

              <div
                className={`max-w-[80%] ${
                  m.role === 'user'
                    ? 'rounded-2xl rounded-br-md bg-blue-600 text-white px-4 py-2.5'
                    : 'rounded-2xl rounded-bl-md bg-slate-100 text-slate-800 px-4 py-2.5'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                {m.extra && <div className="mt-2">{m.extra}</div>}
                {m.footnote && (
                  <p className="mt-1.5 text-xs text-slate-400">{m.footnote}</p>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start gap-2">
              <img
                src="/tutorial/dachshund-idle.gif"
                alt="AI社員"
                className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
              />
              <div className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3">
                <span className="inline-flex gap-1" aria-label="考え中">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:120ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:240ms]" />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-slate-100 px-4 py-3 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:text-slate-500 py-1"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || value.trim().length === 0}
              aria-label="送信"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white w-8 h-8 flex-shrink-0 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            Enterで送信 / Shift+Enterで改行
          </p>
        </div>
      </div>
    </div>
  );
}
