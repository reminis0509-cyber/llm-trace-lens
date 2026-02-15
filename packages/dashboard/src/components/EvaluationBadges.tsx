import type { TraceEvaluations } from '../types';

interface BadgeProps {
  label: string;
  flagged: boolean;
  score?: number;
  details?: string;
}

function EvaluationBadge({ label, flagged, score, details }: BadgeProps) {
  const colorClass = flagged
    ? 'border-l-status-fail text-status-fail'
    : 'border-l-status-pass text-status-pass';

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-base rounded-card border-l-2 text-xs font-mono ${colorClass} cursor-default`}
      title={details ?? (flagged ? '問題を検出' : '問題なし')}
    >
      <span>{label}</span>
      {score !== undefined && score > 0 && (
        <span className="text-text-muted tabular-nums">{(score * 100).toFixed(0)}%</span>
      )}
    </div>
  );
}

interface EvaluationBadgesProps {
  evaluations?: TraceEvaluations;
}

export function EvaluationBadges({ evaluations }: EvaluationBadgesProps) {
  if (!evaluations) return null;

  const hasAnyResult =
    evaluations.toxicity ||
    evaluations.promptInjection ||
    evaluations.failureToAnswer ||
    evaluations.languageMismatch;

  if (!hasAnyResult) return null;

  return (
    <div className="mt-3">
      <p className="text-xs text-text-muted mb-2 label-spacing uppercase">パターンベース評価</p>
      <div className="flex flex-wrap gap-2">
        {evaluations.toxicity && (
          <EvaluationBadge
            label="毒性"
            flagged={evaluations.toxicity.flagged}
            score={evaluations.toxicity.score}
            details={evaluations.toxicity.details}
          />
        )}
        {evaluations.promptInjection && (
          <EvaluationBadge
            label="プロンプトインジェクション"
            flagged={evaluations.promptInjection.flagged}
            score={evaluations.promptInjection.score}
            details={evaluations.promptInjection.details}
          />
        )}
        {evaluations.failureToAnswer && (
          <EvaluationBadge
            label="回答拒否"
            flagged={evaluations.failureToAnswer.flagged}
            details={evaluations.failureToAnswer.details}
          />
        )}
        {evaluations.languageMismatch && (
          <EvaluationBadge
            label="言語不一致"
            flagged={evaluations.languageMismatch.flagged}
            details={evaluations.languageMismatch.details}
          />
        )}
      </div>
      {evaluations.meta && (
        <p className="text-xs text-text-muted mt-2 font-mono tabular-nums">
          評価日時: {new Date(evaluations.meta.evaluatedAt).toLocaleString()}
          {' '}({evaluations.meta.durationMs}ms)
        </p>
      )}
    </div>
  );
}
