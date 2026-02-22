import { useState } from 'react';
import { Link2, CheckCircle, XCircle, Send } from 'lucide-react';

interface Props {
  apiKey?: string;
  onBack: () => void;
}

type Platform = 'Slack' | 'Teams';

// Simple SVG icons for Slack and Teams
function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  );
}

function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.625 8.743h-6.281V5.556c0-2.001 1.614-3.617 3.609-3.617s3.609 1.616 3.609 3.617v2.25c0 .463-.375.937-.937.937zm-1.828-3.187a1.828 1.828 0 1 0-3.656 0 1.828 1.828 0 0 0 3.656 0zM13.5 9.562H3.375c-.516 0-.938.422-.938.938v7.313c0 2.484 2.016 4.5 4.5 4.5h2.25c2.484 0 4.5-2.016 4.5-4.5v-7.313c0-.516-.422-.938-.937-.938H3.375zm6.75 0h-.938v7.313c0 3.094-2.203 5.672-5.109 6.281a6.608 6.608 0 0 0 4.922-6.281V9.562zm1.125-5.625a2.438 2.438 0 1 0 0 4.876 2.438 2.438 0 0 0 0-4.876zm-9.188 9c0 1.035.84 1.875 1.875 1.875s1.875-.84 1.875-1.875-.84-1.875-1.875-1.875-1.875.84-1.875 1.875z"/>
    </svg>
  );
}

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-accent-cyan" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Integrations</h1>
          <p className="text-sm text-gray-400">Connect LLM Trace Lens to your messaging platforms</p>
        </div>
      </div>

      {/* Result Toast */}
      {testResult && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            testResult.success
              ? 'bg-status-pass/10 border border-status-pass/30 text-status-pass'
              : 'bg-status-fail/10 border border-status-fail/30 text-status-fail'
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Slack Integration */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#4A154B]/20 flex items-center justify-center">
            <SlackIcon className="w-5 h-5 text-[#E01E5A]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Slack</h2>
            <p className="text-sm text-gray-400">Send notifications to Slack channels</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Webhook URL
          </label>
          <input
            type="text"
            value={slackUrl}
            onChange={(e) => setSlackUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full px-4 py-2 bg-navy-800 border border-navy-600 rounded-lg text-gray-100 placeholder-gray-500 font-mono text-sm focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan"
          />
          <p className="mt-1 text-xs text-gray-500">
            Create an Incoming Webhook in your Slack workspace settings
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => testWebhook(slackUrl, 'Slack')}
            disabled={isTesting || !slackUrl}
            className="flex items-center gap-2 px-4 py-2 border border-accent-cyan text-accent-cyan rounded-lg font-medium hover:bg-accent-cyan/10 disabled:border-navy-600 disabled:text-gray-500 disabled:cursor-not-allowed transition"
          >
            <Link2 className="w-4 h-4" />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={() => sendSampleNotification(slackUrl, 'Slack')}
            disabled={isTesting || !slackUrl}
            className="flex items-center gap-2 px-4 py-2 border border-navy-600 text-gray-300 rounded-lg font-medium hover:bg-navy-700 hover:text-gray-100 disabled:border-navy-700 disabled:text-gray-500 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
            Send Sample Alert
          </button>
        </div>
      </div>

      {/* Microsoft Teams Integration */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#464EB8]/20 flex items-center justify-center">
            <TeamsIcon className="w-5 h-5 text-[#6264A7]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Microsoft Teams</h2>
            <p className="text-sm text-gray-400">Send notifications to Teams channels</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Webhook URL
          </label>
          <input
            type="text"
            value={teamsUrl}
            onChange={(e) => setTeamsUrl(e.target.value)}
            placeholder="https://outlook.office.com/webhook/..."
            className="w-full px-4 py-2 bg-navy-800 border border-navy-600 rounded-lg text-gray-100 placeholder-gray-500 font-mono text-sm focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan"
          />
          <p className="mt-1 text-xs text-gray-500">
            Add an Incoming Webhook connector to your Teams channel
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => testWebhook(teamsUrl, 'Teams')}
            disabled={isTesting || !teamsUrl}
            className="flex items-center gap-2 px-4 py-2 border border-accent-cyan text-accent-cyan rounded-lg font-medium hover:bg-accent-cyan/10 disabled:border-navy-600 disabled:text-gray-500 disabled:cursor-not-allowed transition"
          >
            <Link2 className="w-4 h-4" />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={() => sendSampleNotification(teamsUrl, 'Teams')}
            disabled={isTesting || !teamsUrl}
            className="flex items-center gap-2 px-4 py-2 border border-navy-600 text-gray-300 rounded-lg font-medium hover:bg-navy-700 hover:text-gray-100 disabled:border-navy-700 disabled:text-gray-500 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
            Send Sample Alert
          </button>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Setup Instructions</h3>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <SlackIcon className="w-4 h-4 text-[#E01E5A]" />
              <h4 className="font-medium text-gray-200">Slack Setup</h4>
            </div>
            <ol className="space-y-2 ml-6">
              {[
                'Go to your Slack workspace settings',
                'Navigate to Apps > Manage > Custom Integrations',
                'Click on "Incoming WebHooks" and add a new configuration',
                'Select the channel and copy the Webhook URL',
                'Paste the URL above and test the connection',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="text-accent-cyan font-mono">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="border-t border-navy-700 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <TeamsIcon className="w-4 h-4 text-[#6264A7]" />
              <h4 className="font-medium text-gray-200">Microsoft Teams Setup</h4>
            </div>
            <ol className="space-y-2 ml-6">
              {[
                'Open Microsoft Teams and go to your channel',
                'Click the "..." menu > Connectors',
                'Search for "Incoming Webhook" and click Configure',
                'Give it a name and copy the webhook URL',
                'Paste the URL above and test the connection',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="text-accent-cyan font-mono">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
