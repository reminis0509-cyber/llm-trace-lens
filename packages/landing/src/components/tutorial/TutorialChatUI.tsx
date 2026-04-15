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
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export default function TutorialChatUI({
  messages,
  onSend,
  suggestions = [],
  isTyping = false,
  disabled = false,
  placeholder = 'メッセージを入力...',
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
    setValue(text);
    textareaRef.current?.focus();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div
        ref={listRef}
        className="max-h-[420px] min-h-[240px] overflow-y-auto p-4 space-y-3 bg-slate-50"
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">
            下のチップをタップするか、自由に入力して送信してください。
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-800'
              }`}
            >
              <p>{m.content}</p>
              {m.footnote && (
                <p
                  className={`mt-1.5 text-[11px] ${
                    m.role === 'user' ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {m.footnote}
                </p>
              )}
              {m.extra && <div className="mt-2">{m.extra}</div>}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
              <span className="inline-flex gap-1" aria-label="考え中">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:120ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSuggestion(s)}
              disabled={disabled}
              className="text-xs rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-blue-400 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-slate-200 bg-white">
        <div className="flex items-end gap-2">
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
            className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || value.trim().length === 0}
            aria-label="送信"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 text-white w-10 h-10 flex-shrink-0 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          Enterで送信 / Shift+Enterで改行
        </p>
      </div>
    </div>
  );
}
