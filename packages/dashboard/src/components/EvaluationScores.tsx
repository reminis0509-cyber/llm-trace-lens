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
  const color = score >= 0.7 ? 'bg-status-pass' : score >= 0.4 ? 'bg-status-warn' : 'bg-status-fail';

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-text-secondary">{label}</span>
        <span className={`font-mono tabular-nums ${score < 0.5 ? 'text-status-fail' : 'text-text-primary'}`}>
          {pct}%
        </span>
      </div>
      <div className="w-full bg-base-elevated rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EvaluationScores({ evaluation }: Props) {
  if (evaluation.error) {
    return (
      <div className="p-4 bg-status-fail/10 border-l-2 border-l-status-fail rounded-card text-sm text-status-fail">
        評価エラー: {evaluation.error}
      </div>
    );
  }

  return (
    <div className="p-4 bg-base rounded-card">
      <h3 className="text-xs text-text-muted mb-4 label-spacing uppercase">
        LLM-as-Judge 自動評価
        <span className="ml-2 text-xs font-normal text-text-muted">
          {evaluation.evaluationModel} · {new Date(evaluation.evaluatedAt).toLocaleString('ja-JP')}
        </span>
      </h3>
      <ScoreBar label="回答関連性" score={evaluation.answerRelevance} />
      <ScoreBar label="忠実性" score={evaluation.faithfulness} />
      {evaluation.faithfulness === null && evaluation.answerRelevance === null && (
        <p className="text-xs text-text-muted">スコアがありません</p>
      )}
    </div>
  );
}
