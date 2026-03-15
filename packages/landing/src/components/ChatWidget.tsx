import { useState, useRef, useEffect, useCallback } from 'react';
import { matchFaq } from '../data/faq';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'faq' | 'ai';
}

const SUGGESTIONS = [
  '料金について教えてください',
  '導入方法を知りたい',
  '対応プロバイダーは？',
  'セキュリティについて',
];

const WELCOME_MESSAGE =
  'FujiTraceについてご質問があればお気軽にどうぞ。よくある質問はすぐにお答えします。';

const FALLBACK_MESSAGE =
  '申し訳ございません、現在回答を生成できません。詳細についてはcontact@fujitrace.comまでお問い合わせください。';

function ChatBubbleIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function LoadingDots() {
  return (
    <div className="mr-12 bg-[#18181b] border border-[#27272a] rounded-lg p-3 flex items-center gap-1">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#a1a1aa] animate-[dotPulse_1.4s_ease-in-out_0s_infinite]" />
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#a1a1aa] animate-[dotPulse_1.4s_ease-in-out_0.2s_infinite]" />
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#a1a1aa] animate-[dotPulse_1.4s_ease-in-out_0.4s_infinite]" />
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = text || input.trim();
      if (!messageText || isLoading) return;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: messageText,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');

      const faqMatch = matchFaq(messageText);
      if (faqMatch) {
        const botMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: faqMatch.answer,
          source: 'faq',
        };
        setMessages((prev) => [...prev, botMsg]);
        return;
      }

      setIsLoading(true);
      try {
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch('/api/chatbot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText, history }),
        });

        if (res.ok) {
          const data: { answer: string; source: 'faq' | 'ai' } = await res.json();
          const botMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.answer,
            source: data.source,
          };
          setMessages((prev) => [...prev, botMsg]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: FALLBACK_MESSAGE,
              source: 'faq',
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: FALLBACK_MESSAGE,
            source: 'faq',
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const showSuggestions = messages.length === 0;

  return (
    <>
      {/* Floating bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#60a5fa] hover:bg-[#3b82f6] transition-colors flex items-center justify-center cursor-pointer shadow-lg text-white"
          aria-label="チャットを開く"
        >
          <ChatBubbleIcon />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-6 z-50 w-[calc(100vw-2rem)] sm:w-[360px] max-h-[500px] flex flex-col bg-[#111113] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden"
          role="dialog"
          aria-label="FujiTrace サポートチャット"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-12 border-b border-[#27272a] bg-[#18181b] flex-shrink-0">
            <span className="text-sm font-medium text-[#f4f4f5]">
              FujiTrace サポート
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
              aria-label="チャットを閉じる"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[350px]">
            {/* Welcome message */}
            <div className="mr-12 bg-[#18181b] border border-[#27272a] rounded-lg p-3">
              <p className="text-sm text-[#f4f4f5]">{WELCOME_MESSAGE}</p>
            </div>

            {/* Suggestions */}
            {showSuggestions && (
              <div className="flex flex-wrap gap-2 mt-3">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="px-3 py-1.5 text-xs border border-[#27272a] rounded-full text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#60a5fa]/50 cursor-pointer transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  <div className="ml-12 bg-[#60a5fa]/10 border border-[#60a5fa]/20 rounded-lg p-3">
                    <p className="text-sm text-[#f4f4f5]">{msg.content}</p>
                  </div>
                ) : (
                  <div className="mr-12 bg-[#18181b] border border-[#27272a] rounded-lg p-3">
                    <p className="text-sm text-[#f4f4f5]">{msg.content}</p>
                    {msg.source && (
                      <p className="text-[10px] text-[#a1a1aa] mt-1">
                        {msg.source === 'faq' ? 'FAQ' : 'AI'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && <LoadingDots />}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-[#27272a] p-3 flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="質問を入力..."
              className="flex-1 bg-[#0d0d0f] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#f4f4f5] placeholder-[#52525b] focus:outline-none focus:border-[#60a5fa]/50"
              aria-label="メッセージ入力"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="text-[#60a5fa] disabled:text-[#52525b] transition-colors flex-shrink-0 p-1"
              aria-label="送信"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
