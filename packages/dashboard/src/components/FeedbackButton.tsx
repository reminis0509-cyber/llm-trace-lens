import { useState } from 'react';

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
        throw new Error('Failed to submit feedback');
      }

      setSubmitted(true);
      setShowModal(false);
      setReason('');
      onFeedbackSubmitted?.(feedbackType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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
      <div className="flex items-center gap-2 text-sm text-green-600">
        <span>Thank you for your feedback</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => openModal('correct')}
          className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
          title="This validation was correct"
        >
          Correct
        </button>
        <button
          onClick={() => openModal('false_positive')}
          className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded hover:bg-amber-600 transition-colors"
          title="This was incorrectly flagged (false positive)"
        >
          False Positive
        </button>
        <button
          onClick={() => openModal('false_negative')}
          className="px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
          title="This should have been flagged (false negative)"
        >
          False Negative
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">
              Submit Feedback
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({feedbackType?.replace('_', ' ')})
              </span>
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please explain why this feedback is appropriate..."
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
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
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
