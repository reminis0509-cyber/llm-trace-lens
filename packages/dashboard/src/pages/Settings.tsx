import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, DollarSign, Bell, Webhook } from 'lucide-react';

interface CostData {
  stats: {
    totalCost: number;
    byProvider: Record<string, number>;
  };
  budget: {
    monthlyLimit: number;
    alertThresholds: number[];
  } | null;
  percentage: number;
}

interface SettingsProps {
  onBack?: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['BLOCK']);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [testStatus, setTestStatus] = useState('');

  // Budget state
  const [monthlyBudget, setMonthlyBudget] = useState(100);
  const [alertAt80, setAlertAt80] = useState(true);
  const [alertAt95, setAlertAt95] = useState(true);
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  // Cost data state
  const [costData, setCostData] = useState<CostData | null>(null);

  useEffect(() => {
    loadWebhookConfig();
    loadBudgetConfig();
    loadCostStats();
  }, []);

  const loadWebhookConfig = async () => {
    try {
      const res = await fetch('/api/webhook/config');
      const data = await res.json();
      if (data.config) {
        setWebhookUrl(data.config.url || '');
        setSelectedEvents(data.config.events || ['BLOCK']);
      }
    } catch (error) {
      console.error('Failed to load webhook config:', error);
    }
  };

  const loadBudgetConfig = async () => {
    try {
      const res = await fetch('/api/budget/config');
      const data = await res.json();
      if (data.config) {
        setMonthlyBudget(data.config.monthlyLimit || 100);
        setAlertAt80(data.config.alertThresholds?.includes(0.8) ?? true);
        setAlertAt95(data.config.alertThresholds?.includes(0.95) ?? true);
      }
    } catch (error) {
      console.error('Failed to load budget config:', error);
    }
  };

  const loadCostStats = async () => {
    try {
      const res = await fetch('/api/budget/stats');
      const data = await res.json();
      setCostData(data);
    } catch (error) {
      console.error('Failed to load cost stats:', error);
    }
  };

  const saveWebhookConfig = async () => {
    setIsSavingWebhook(true);
    try {
      const res = await fetch('/api/webhook/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, events: selectedEvents }),
      });

      if (res.ok) {
        alert('Webhook settings saved successfully!');
      } else {
        const data = await res.json();
        alert('Failed to save webhook settings: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error saving webhook settings: ' + (error as Error).message);
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const testWebhook = async () => {
    setTestStatus('Sending...');
    try {
      const res = await fetch('/api/webhook/test', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setTestStatus('Test sent successfully!');
      } else {
        setTestStatus('Test failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      setTestStatus('Error: ' + (error as Error).message);
    }

    setTimeout(() => setTestStatus(''), 5000);
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    );
  };

  const saveBudgetConfig = async () => {
    setIsSavingBudget(true);
    try {
      const thresholds: number[] = [];
      if (alertAt80) thresholds.push(0.8);
      if (alertAt95) thresholds.push(0.95);

      const res = await fetch('/api/budget/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyLimit: monthlyBudget,
          alertThresholds: thresholds,
        }),
      });

      if (res.ok) {
        alert('Budget settings saved!');
        loadCostStats();
      } else {
        const data = await res.json();
        alert('Failed to save budget settings: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to save budget settings: ' + (error as Error).message);
    } finally {
      setIsSavingBudget(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cost Overview */}
      {costData && (
        <div className="gradient-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-accent-cyan" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Cost This Month</h2>
              <p className="text-sm text-gray-400">Current spending and budget status</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-3xl font-bold font-mono text-gray-100">
                ${costData.stats.totalCost.toFixed(2)}
              </span>
              {costData.budget && (
                <span className="text-lg text-gray-400 font-mono">
                  / ${costData.budget.monthlyLimit.toFixed(2)}
                </span>
              )}
            </div>

            {costData.budget && (
              <div className="w-full bg-navy-700 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    costData.percentage > 95
                      ? 'bg-status-fail'
                      : costData.percentage > 80
                        ? 'bg-status-warn'
                        : 'bg-status-pass'
                  }`}
                  style={{ width: `${Math.min(costData.percentage, 100)}%` }}
                />
              </div>
            )}

            {costData.budget && (
              <p className="mt-2 text-sm text-gray-400">
                {costData.percentage.toFixed(1)}% of budget used
              </p>
            )}
          </div>

          {Object.keys(costData.stats.byProvider).length > 0 && (
            <div className="mt-4 pt-4 border-t border-navy-700">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Cost by Provider</h4>
              <div className="space-y-2">
                {Object.entries(costData.stats.byProvider).map(([provider, cost]) => (
                  <div key={provider} className="flex justify-between text-sm">
                    <span className="text-gray-300 capitalize">{provider}</span>
                    <span className="font-mono text-gray-200">${cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Budget Management */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent-emerald/10 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-accent-emerald" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Budget Management</h2>
            <p className="text-sm text-gray-400">Set spending limits and alert thresholds</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Monthly Budget (USD)
          </label>
          <input
            type="number"
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(Number(e.target.value))}
            min="0"
            step="10"
            className="w-full px-4 py-2 bg-navy-800 border border-navy-600 rounded-lg text-gray-100 font-mono focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Alert Thresholds
          </label>
          <div className="space-y-3">
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={alertAt80}
                onChange={(e) => setAlertAt80(e.target.checked)}
                className="h-4 w-4 bg-navy-800 border-navy-600 rounded text-accent-cyan focus:ring-accent-cyan/50"
              />
              <span className="ml-3 text-sm text-gray-300 group-hover:text-gray-200">
                Alert at 80% of budget
              </span>
            </label>
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={alertAt95}
                onChange={(e) => setAlertAt95(e.target.checked)}
                className="h-4 w-4 bg-navy-800 border-navy-600 rounded text-accent-cyan focus:ring-accent-cyan/50"
              />
              <span className="ml-3 text-sm text-gray-300 group-hover:text-gray-200">
                Alert at 95% of budget
              </span>
            </label>
          </div>
        </div>

        <button
          onClick={saveBudgetConfig}
          disabled={isSavingBudget}
          className="px-4 py-2 bg-accent-cyan text-navy-900 rounded-lg font-medium hover:bg-accent-cyan-dim disabled:bg-navy-600 disabled:text-gray-400 disabled:cursor-not-allowed transition"
        >
          {isSavingBudget ? 'Saving...' : 'Save Budget Settings'}
        </button>
      </div>

      {/* Webhook Settings */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center">
            <Webhook className="w-5 h-5 text-accent-purple" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Webhook Notifications</h2>
            <p className="text-sm text-gray-400">Configure alerts for validation events</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Webhook URL
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full px-4 py-2 bg-navy-800 border border-navy-600 rounded-lg text-gray-100 placeholder-gray-500 font-mono text-sm focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan"
          />
          <p className="mt-1 text-sm text-gray-500">
            Supports Slack, Microsoft Teams, or any HTTP endpoint
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Trigger Events
          </label>
          <div className="space-y-3">
            {[
              { event: 'BLOCK', desc: 'Blocked requests (PII, security issues)' },
              { event: 'WARN', desc: 'Warning level issues' },
              { event: 'COST_ALERT', desc: 'Budget threshold alerts' },
            ].map(({ event, desc }) => (
              <label key={event} className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="h-4 w-4 bg-navy-800 border-navy-600 rounded text-accent-cyan focus:ring-accent-cyan/50"
                />
                <span className="ml-3 text-sm text-gray-300 group-hover:text-gray-200">
                  <span className="font-mono text-accent-cyan">{event}</span>
                  <span className="text-gray-500 ml-2">- {desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={saveWebhookConfig}
            disabled={isSavingWebhook || !webhookUrl}
            className="px-4 py-2 bg-accent-cyan text-navy-900 rounded-lg font-medium hover:bg-accent-cyan-dim disabled:bg-navy-600 disabled:text-gray-400 disabled:cursor-not-allowed transition"
          >
            {isSavingWebhook ? 'Saving...' : 'Save Settings'}
          </button>

          <button
            onClick={testWebhook}
            disabled={!webhookUrl}
            className="px-4 py-2 border border-navy-600 text-gray-300 rounded-lg font-medium hover:bg-navy-700 hover:text-gray-100 disabled:border-navy-700 disabled:text-gray-500 disabled:cursor-not-allowed transition"
          >
            Send Test
          </button>
        </div>

        {testStatus && (
          <div className={`mt-4 text-sm ${testStatus.includes('success') ? 'text-status-pass' : 'text-status-fail'}`}>
            {testStatus}
          </div>
        )}
      </div>
    </div>
  );
}
