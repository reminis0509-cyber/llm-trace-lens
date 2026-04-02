import { useState } from 'react';
import { X } from 'lucide-react';

interface FeedbackButtonProps {
  traceId: string;
  apiKey?: string;
  onFeedbackSubmitted?: (type: string) => void;
}

type FeedbackType = 'correct' | 'false_positive' | 'false_negative';

export function FeedbackButton({
  traceId,
  apiKey,
  onFeedbackSubmitted,
}: FeedbackButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!feedbackType) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch(`/traces/${traceId}/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          feedbackType,
          reason: reason.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('フィードバックの送信に失敗しました');
      }

      setSubmitted(true);
      setShowModal(false);
      setReason('');
      onFeedbackSubmitted?.(feedbackType);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openModal = (type: FeedbackType) => {
    setFeedbackType(type);
    setShowModal(true);
    setError(null);
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-status-pass">
        <span>フィードバックありがとうございます</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => openModal('correct')}
          className="px-3 py-1.5 text-sm text-text-secondary hover:text-status-pass hover:bg-status-pass/10 rounded-card transition-colors duration-120"
          title="このバリデーションは正確でした"
        >
          正確
        </button>
        <button
          onClick={() => openModal('false_positive')}
          className="px-3 py-1.5 text-sm text-text-secondary hover:text-status-warn hover:bg-status-warn/10 rounded-card transition-colors duration-120"
          title="誤ってフラグされました（偽陽性）"
        >
          偽陽性
        </button>
        <button
          onClick={() => openModal('false_negative')}
          className="px-3 py-1.5 text-sm text-text-secondary hover:text-status-fail hover:bg-status-fail/10 rounded-card transition-colors duration-120"
          title="フラグされるべきでした（偽陰性）"
        >
          偽陰性
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-base/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="surface-card p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-text-primary">
                フィードバックを送信
                <span className="ml-2 text-sm font-normal text-text-muted">
                  ({feedbackType?.replace('_', ' ')})
                </span>
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setReason('');
                  setError(null);
                }}
                className="p-1 text-text-muted hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-text-muted mb-2 label-spacing uppercase">
                理由（任意）
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="フィードバックの理由を説明してください..."
                className="w-full bg-base border border-border-subtle rounded-card p-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-base-surface"
                rows={4}
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-status-fail/10 border-l-2 border-l-status-fail text-status-fail text-sm rounded-card">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowModal(false);
                  setReason('');
                  setError(null);
                }}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
                disabled={isSubmitting}
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-accent text-base rounded-card text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
              >
                {isSubmitting ? '送信中...' : '送信'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
