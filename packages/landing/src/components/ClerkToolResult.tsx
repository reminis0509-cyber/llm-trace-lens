/* ------------------------------------------------------------------ */
/*  ClerkToolResult — Tool result display for AI clerk messages        */
/* ------------------------------------------------------------------ */

interface ClerkToolResultProps {
  toolName: string;
  matchType: 'exact' | 'adapted';
  adaptedFrom?: string;
  result: unknown;
}

interface EstimateResult {
  estimate: {
    company_name?: string;
    total?: number;
    items?: unknown[];
  };
}

interface CheckResult {
  check_result: {
    status?: string;
    issues?: unknown[];
    warnings?: unknown[];
    suggestions?: unknown[];
  };
}

function isEstimateResult(r: unknown): r is EstimateResult {
  return (
    typeof r === 'object' &&
    r !== null &&
    'estimate' in r &&
    typeof (r as EstimateResult).estimate === 'object'
  );
}

function isCheckResult(r: unknown): r is CheckResult {
  return (
    typeof r === 'object' &&
    r !== null &&
    'check_result' in r &&
    typeof (r as CheckResult).check_result === 'object'
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ClerkToolResult({
  toolName,
  matchType,
  adaptedFrom,
  result,
}: ClerkToolResultProps) {
  const renderHeader = () => {
    if (matchType !== 'adapted' || !adaptedFrom) return null;
    return (
      <div className="flex items-center gap-2 mb-2 text-sm text-gray-700">
        <span>{adaptedFrom}ツールを応用</span>
        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">
          応用
        </span>
      </div>
    );
  };

  const renderContent = () => {
    if (isEstimateResult(result)) {
      const { estimate } = result;
      const itemCount = Array.isArray(estimate.items) ? estimate.items.length : 0;
      return (
        <div className="space-y-1 text-sm text-gray-700">
          {estimate.company_name && (
            <p>
              <span className="text-gray-500">宛先:</span>{' '}
              {estimate.company_name}
            </p>
          )}
          {typeof estimate.total === 'number' && (
            <p>
              <span className="text-gray-500">合計:</span>{' '}
              <span className="font-medium text-gray-900">
                {formatCurrency(estimate.total)}
              </span>
            </p>
          )}
          {itemCount > 0 && (
            <p>
              <span className="text-gray-500">品目数:</span> {itemCount}件
            </p>
          )}
        </div>
      );
    }

    if (isCheckResult(result)) {
      const { check_result } = result;
      const issueCount =
        (Array.isArray(check_result.issues) ? check_result.issues.length : 0) +
        (Array.isArray(check_result.warnings) ? check_result.warnings.length : 0);
      const status = check_result.status ?? 'unknown';

      const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
        ok: { bg: 'bg-green-50', text: 'text-green-700', label: '問題なし' },
        warning: { bg: 'bg-amber-50', text: 'text-amber-700', label: '要確認' },
        error: { bg: 'bg-red-50', text: 'text-red-700', label: 'エラーあり' },
      };
      const cfg = statusConfig[status] ?? {
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        label: status,
      };

      return (
        <div className="flex items-center gap-3 text-sm">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}
          >
            {cfg.label}
          </span>
          {issueCount > 0 && (
            <span className="text-gray-600">指摘事項: {issueCount}件</span>
          )}
        </div>
      );
    }

    // Fallback: formatted JSON
    return (
      <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto text-gray-700 whitespace-pre-wrap break-words">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  };

  return (
    <div className="mt-2 border border-gray-200 rounded-lg p-3">
      {renderHeader()}
      <p className="text-xs text-gray-400 mb-2">{toolName}</p>
      {renderContent()}
    </div>
  );
}
