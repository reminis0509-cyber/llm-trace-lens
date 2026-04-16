import { useState } from 'react';
import { trackDashboardConversion } from '../utils/gtag';

interface PlanInfo {
  name: string;
  monthlyBase: number;
  tracesIncluded: number;
  evalsIncluded: number;
  traceOveragePerTenK: number;
  evalOveragePerThousand: number;
  features: string[];
  cta: string;
  ctaHref: string;
}

interface CostBreakdown {
  base: number;
  traceOverage: number;
  evalOverage: number;
  total: number;
}

const plans: PlanInfo[] = [
  {
    name: 'Free',
    monthlyBase: 0,
    tracesIncluded: 5000,
    evalsIncluded: 0,
    traceOveragePerTenK: 0,
    evalOveragePerThousand: 0,
    features: ['月間 5,000 トレース', '日本語PII検出', '7日間のデータ保持'],
    cta: '無料で始める',
    ctaHref: '/dashboard',
  },
  {
    name: 'Pro',
    monthlyBase: 9800,
    tracesIncluded: 50000,
    evalsIncluded: 1000,
    traceOveragePerTenK: 300,
    evalOveragePerThousand: 200,
    features: ['月間 50,000 トレース', 'LLM-as-Judge 品質評価', '90日間のデータ保持', 'リアルタイムアラート'],
    cta: 'AI 事務員を使い始める',
    ctaHref: '/dashboard',
  },
  {
    name: 'Enterprise Standard',
    monthlyBase: 25000,
    tracesIncluded: 100000,
    evalsIncluded: 3000,
    traceOveragePerTenK: 300,
    evalOveragePerThousand: 200,
    features: ['月間 100,000 トレース', 'SSO / SAML 対応', '180日間のデータ保持', 'SLA 99.5%'],
    cta: 'お問い合わせ',
    ctaHref: '#contact',
  },
  {
    name: 'Enterprise Plus',
    monthlyBase: 80000,
    tracesIncluded: 500000,
    evalsIncluded: 15000,
    traceOveragePerTenK: 200,
    evalOveragePerThousand: 150,
    features: ['月間 500,000 トレース', 'SSO / SAML 対応', '365日間のデータ保持', 'SLA 99.9%'],
    cta: 'お問い合わせ',
    ctaHref: '#contact',
  },
  {
    name: 'Enterprise Premium',
    monthlyBase: 200000,
    tracesIncluded: Infinity,
    evalsIncluded: Infinity,
    traceOveragePerTenK: 0,
    evalOveragePerThousand: 0,
    features: ['トレース無制限', '無制限データ保持', 'SLA 99.95%', 'オンプレミス対応'],
    cta: 'お問い合わせ',
    ctaHref: '#contact',
  },
];

function selectPlan(traces: number, evals: number): PlanInfo {
  // Free only if within Free limits
  if (traces <= 5000 && evals === 0) return plans[0];

  // For paid plans, calculate total cost for each and pick the cheapest
  const candidates = plans.slice(1); // Pro, Standard, Plus, Premium
  let bestPlan = candidates[0];
  let bestCost = Infinity;

  for (const candidate of candidates) {
    const cost = calculateCost(candidate, traces, evals);
    if (cost.total < bestCost) {
      bestCost = cost.total;
      bestPlan = candidate;
    }
  }

  return bestPlan;
}

function calculateCost(plan: PlanInfo, traces: number, evals: number): CostBreakdown {
  const traceOverage = Math.max(0, traces - plan.tracesIncluded);
  const evalOverage = Math.max(0, evals - plan.evalsIncluded);

  const traceOverageCost = plan.tracesIncluded === Infinity
    ? 0
    : Math.ceil(traceOverage / 10000) * plan.traceOveragePerTenK;
  const evalOverageCost = plan.evalsIncluded === Infinity
    ? 0
    : Math.ceil(evalOverage / 1000) * plan.evalOveragePerThousand;

  return {
    base: plan.monthlyBase,
    traceOverage: traceOverageCost,
    evalOverage: evalOverageCost,
    total: plan.monthlyBase + traceOverageCost + evalOverageCost,
  };
}

const CheckIcon = () => (
  <svg
    className="w-4 h-4 mr-2 text-accent flex-shrink-0"
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const TRACE_MAX = 1000000;
const TRACE_STEP = 1000;
const EVAL_MAX = 50000;
const EVAL_STEP = 100;

function formatNumber(n: number): string {
  return n.toLocaleString('ja-JP');
}

function formatPrice(n: number): string {
  return `\u00A5${n.toLocaleString('ja-JP')}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function PricingSimulator() {
  const [traces, setTraces] = useState(10000);
  const [evals, setEvals] = useState(0);

  const plan = selectPlan(traces, evals);
  const cost = calculateCost(plan, traces, evals);

  const tracePercentage = (traces / TRACE_MAX) * 100;
  const evalPercentage = (evals / EVAL_MAX) * 100;

  const handleTraceInput = (value: string) => {
    const parsed = parseInt(value.replace(/,/g, ''), 10);
    if (!isNaN(parsed)) {
      setTraces(clamp(parsed, 0, TRACE_MAX));
    } else if (value === '') {
      setTraces(0);
    }
  };

  const handleEvalInput = (value: string) => {
    const parsed = parseInt(value.replace(/,/g, ''), 10);
    if (!isNaN(parsed)) {
      setEvals(clamp(parsed, 0, EVAL_MAX));
    } else if (value === '') {
      setEvals(0);
    }
  };

  return (
    <section id="pricing-simulator" className="py-16 sm:py-24 px-4 sm:px-6">
      <style>{`
        .sim-range {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: #e2e8f0;
          outline: none;
        }
        .sim-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #1d3557;
          cursor: pointer;
        }
        .sim-range::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #1d3557;
          cursor: pointer;
          border: none;
        }
      `}</style>
      <div className="section-container">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            Pricing Simulator
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            月額料金を試算する
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            想定利用量を入力すると、最適なプランと月額目安が表示されます
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Inputs */}
          <div className="surface-card p-6">
            <h3 className="text-sm font-medium text-text-muted label-spacing uppercase mb-8">
              想定利用量
            </h3>

            {/* Trace slider */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <label
                  htmlFor="trace-slider"
                  className="text-sm font-medium text-text-primary"
                >
                  月間トレース数
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(traces)}
                  onChange={(e) => handleTraceInput(e.target.value)}
                  aria-label="月間トレース数を入力"
                  className="w-32 text-right text-sm font-mono tabular-nums text-text-primary bg-base-elevated border border-border rounded px-2 py-1 outline-none focus:border-accent"
                />
              </div>
              <input
                id="trace-slider"
                type="range"
                className="sim-range"
                min={0}
                max={TRACE_MAX}
                step={TRACE_STEP}
                value={traces}
                onChange={(e) => setTraces(Number(e.target.value))}
                aria-label="月間トレース数スライダー"
                style={{
                  background: `linear-gradient(to right, #1d3557 ${tracePercentage}%, #e2e8f0 ${tracePercentage}%)`,
                }}
              />
              <div className="flex justify-between mt-1 text-xs text-text-muted font-mono tabular-nums">
                <span>0</span>
                <span>{formatNumber(TRACE_MAX)}</span>
              </div>
            </div>

            {/* Eval slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label
                  htmlFor="eval-slider"
                  className="text-sm font-medium text-text-primary"
                >
                  月間評価数
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(evals)}
                  onChange={(e) => handleEvalInput(e.target.value)}
                  aria-label="月間評価数を入力"
                  className="w-32 text-right text-sm font-mono tabular-nums text-text-primary bg-base-elevated border border-border rounded px-2 py-1 outline-none focus:border-accent"
                />
              </div>
              <input
                id="eval-slider"
                type="range"
                className="sim-range"
                min={0}
                max={EVAL_MAX}
                step={EVAL_STEP}
                value={evals}
                onChange={(e) => setEvals(Number(e.target.value))}
                aria-label="月間評価数スライダー"
                style={{
                  background: `linear-gradient(to right, #1d3557 ${evalPercentage}%, #e2e8f0 ${evalPercentage}%)`,
                }}
              />
              <div className="flex justify-between mt-1 text-xs text-text-muted font-mono tabular-nums">
                <span>0</span>
                <span>{formatNumber(EVAL_MAX)}</span>
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="surface-card p-6">
            {/* Plan badge */}
            <div className="mb-6">
              <span className="text-xs text-text-muted label-spacing uppercase">
                おすすめプラン
              </span>
              <div className="mt-2">
                <span className="inline-block px-3 py-1 text-sm font-medium text-accent bg-accent/10 rounded-card">
                  {plan.name}
                </span>
              </div>
            </div>

            {/* Price display */}
            <div className="mb-6">
              <span className="text-xs text-text-muted label-spacing uppercase">
                月額見積もり
              </span>
              <div className="mt-2">
                <span className="text-3xl font-mono tabular-nums text-text-primary">
                  {formatPrice(cost.total)}
                </span>
                <span className="ml-2 text-text-muted text-sm">/ 月</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="mb-6 border-t border-border pt-4">
              <span className="text-xs text-text-muted label-spacing uppercase">
                内訳
              </span>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-secondary">基本料金</dt>
                  <dd className="font-mono tabular-nums text-text-primary">
                    {formatPrice(cost.base)}
                  </dd>
                </div>
                {cost.traceOverage > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-text-secondary">トレース超過</dt>
                    <dd className="font-mono tabular-nums text-text-primary">
                      {formatPrice(cost.traceOverage)}
                    </dd>
                  </div>
                )}
                {cost.evalOverage > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-text-secondary">評価超過</dt>
                    <dd className="font-mono tabular-nums text-text-primary">
                      {formatPrice(cost.evalOverage)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 font-medium">
                  <dt className="text-text-primary">合計</dt>
                  <dd className="font-mono tabular-nums text-text-primary">
                    {formatPrice(cost.total)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Features */}
            <div className="mb-6 border-t border-border pt-4">
              <span className="text-xs text-text-muted label-spacing uppercase">
                含まれる機能
              </span>
              <ul className="mt-3 space-y-2">
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-center text-sm text-text-secondary"
                  >
                    <CheckIcon />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <a
              href={plan.ctaHref}
              onClick={plan.ctaHref === '/dashboard' ? trackDashboardConversion : undefined}
              className="block w-full py-2.5 px-4 rounded-card text-sm font-medium text-center transition-colors duration-120 bg-accent text-white hover:bg-accent/90"
            >
              {plan.cta}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
