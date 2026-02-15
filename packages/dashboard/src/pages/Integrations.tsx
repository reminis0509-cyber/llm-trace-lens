import { useState } from 'react';

interface Props {
  apiKey?: string;
  onBack: () => void;
}

type Platform = 'Slack' | 'Teams';

export function Integrations({ apiKey, onBack }: Props) {
  const [slackUrl, setSlackUrl] = useState('');
  const [teamsUrl, setTeamsUrl] = useState('');
  const [testResult, setTestResult] = useState<{ message: string; success: boolean } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const testWebhook = async (url: string, platform: Platform) => {
    if (!url) {
      setTestResult({ message: 'Please enter a webhook URL', success: false });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch('/integrations/test', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, platform }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({
          message: `${platform} connection test successful! Check your channel for the test message.`,
          success: true,
        });
      } else {
        setTestResult({
          message: data.error || `${platform} connection test failed`,
          success: false,
        });
      }
    } catch (error) {
      setTestResult({
        message: error instanceof Error ? error.message : 'Connection test failed',
        success: false,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const sendSampleNotification = async (url: string, platform: Platform) => {
    if (!url) {
      setTestResult({ message: 'Please enter a webhook URL', success: false });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch('/integrations/send-sample', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, platform, riskLevel: 'high' }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({
          message: `Sample notification sent to ${platform}! Check your channel.`,
          success: true,
        });
      } else {
        setTestResult({
          message: data.error || 'Failed to send sample notification',
          success: false,
        });
      }
    } catch (error) {
      setTestResult({
        message: error instanceof Error ? error.message : 'Failed to send sample',
        success: false,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600">Connect LLM Trace Lens to your messaging platforms</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Result Toast */}
      {testResult && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            testResult.success
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{testResult.success ? '✓' : '✕'}</span>
            <span>{testResult.message}</span>
          </div>
        </div>
      )}

      {/* Slack Integration */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">
            💬
          </div>
          <div>
            <h2 className="text-lg font-semibold">Slack</h2>
            <p className="text-sm text-gray-500">Send notifications to Slack channels</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Webhook URL
          </label>
          <input
            type="text"
            value={slackUrl}
            onChange={(e) => setSlackUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Create an Incoming Webhook in your Slack workspace settings
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => testWebhook(slackUrl, 'Slack')}
            disabled={isTesting || !slackUrl}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={() => sendSampleNotification(slackUrl, 'Slack')}
            disabled={isTesting || !slackUrl}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send Sample Alert
          </button>
        </div>
      </div>

      {/* Microsoft Teams Integration */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
            👥
          </div>
          <div>
            <h2 className="text-lg font-semibold">Microsoft Teams</h2>
            <p className="text-sm text-gray-500">Send notifications to Teams channels</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Webhook URL
          </label>
          <input
            type="text"
            value={teamsUrl}
            onChange={(e) => setTeamsUrl(e.target.value)}
            placeholder="https://outlook.office.com/webhook/..."
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Add an Incoming Webhook connector to your Teams channel
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => testWebhook(teamsUrl, 'Teams')}
            disabled={isTesting || !teamsUrl}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={() => sendSampleNotification(teamsUrl, 'Teams')}
            disabled={isTesting || !teamsUrl}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send Sample Alert
          </button>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Setup Instructions</h3>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Slack Setup</h4>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              <li>Go to your Slack workspace settings</li>
              <li>Navigate to Apps → Manage → Custom Integrations</li>
              <li>Click on "Incoming WebHooks" and add a new configuration</li>
              <li>Select the channel and copy the Webhook URL</li>
              <li>Paste the URL above and test the connection</li>
            </ol>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Microsoft Teams Setup</h4>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              <li>Open Microsoft Teams and go to your channel</li>
              <li>Click the "..." menu → Connectors</li>
              <li>Search for "Incoming Webhook" and click Configure</li>
              <li>Give it a name and copy the webhook URL</li>
              <li>Paste the URL above and test the connection</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
