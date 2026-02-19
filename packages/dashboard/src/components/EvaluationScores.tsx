interface EvaluationResult {
  faithfulness: number | null;
  answerRelevance: number | null;
  evaluatedAt: string;
  evaluationModel: string;
  error?: string;
}

interface Props {
  evaluation: EvaluationResult;
}

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? 'bg-green-500' : score >= 0.4 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={score < 0.5 ? 'text-red-600 font-bold' : 'text-gray-600'}>
          {pct}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EvaluationScores({ evaluation }: Props) {
  if (evaluation.error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        Evaluation Error: {evaluation.error}
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">
        LLM-as-Judge Auto Evaluation
        <span className="ml-2 text-xs font-normal text-gray-400">
          {evaluation.evaluationModel} · {new Date(evaluation.evaluatedAt).toLocaleString()}
        </span>
      </h3>
      <ScoreBar label="Answer Relevance" score={evaluation.answerRelevance} />
      <ScoreBar label="Faithfulness" score={evaluation.faithfulness} />
      {evaluation.faithfulness === null && evaluation.answerRelevance === null && (
        <p className="text-xs text-gray-400">No scores available</p>
      )}
    </div>
  );
}
