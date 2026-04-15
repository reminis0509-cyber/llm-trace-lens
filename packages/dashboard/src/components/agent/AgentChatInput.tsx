/* ------------------------------------------------------------------ */
/*  AgentChatInput — Free-form input + suggestion chips for autonomous mode */
/* ------------------------------------------------------------------ */

import { useState, useRef, useEffect, useCallback } from 'react';

interface AgentChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const SUGGESTIONS: string[] = [
  'A社向けに月次保守料10万円で請求書作って',
  '株式会社サンプル商事へ¥300,000の見積書',
  'B商事から発注書、サーバー機材20万円',
];

export default function AgentChatInput({
  onSend,
  disabled = false,
  placeholder = 'AI事務員に作業を依頼してください…',
}: AgentChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-expand textarea up to 8 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = `${next}px`;
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="w-full">
      <div className="flex items-end gap-2 rounded-card border border-border bg-white p-2 focus-within:ring-2 focus-within:ring-accent">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          aria-label="AI事務員への指示"
          className="flex-1 resize-none border-0 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none disabled:opacity-50"
          style={{ minHeight: '24px', maxHeight: '200px' }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label="送信"
          className="flex-shrink-0 px-3 py-1.5 text-sm text-white bg-accent rounded-card hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          送信
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setValue(s);
              textareaRef.current?.focus();
            }}
            disabled={disabled}
            className="px-3 py-1 text-xs text-text-secondary border border-border rounded-full bg-white hover:bg-base-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
