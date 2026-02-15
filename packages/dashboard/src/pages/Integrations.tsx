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
      setTestResult({ message: 'Webhook URLを入力してください', success: false });
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
          message: `${platform}の接続テスト成功！チャンネルでテストメッセージを確認してください。`,
          success: true,
        });
      } else {
        setTestResult({
          message: data.error || `${platform}の接続テスト失敗`,
          success: false,
        });
      }
    } catch (error) {
      setTestResult({
        message: error instanceof Error ? error.message : '接続テストに失敗しました',
        success: false,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const sendSampleNotification = async (url: string, platform: Platform) => {
    if (!url) {
      setTestResult({ message: 'Webhook URLを入力してください', success: false });
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
          message: `${platform}にサンプル通知を送信しました！チャンネルを確認してください。`,
          success: true,
        });
      } else {
        setTestResult({
          message: data.error || 'サンプル通知の送信に失敗しました',
          success: false,
        });
      }
    } catch (error) {
      setTestResult({
        message: error instanceof Error ? error.message : 'サンプルの送信に失敗しました',
        success: false,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-base font-medium text-text-primary">連携</h1>
        <p className="text-sm text-text-muted mt-1">FujiTraceをメッセージングプラットフォームに接続</p>
      </div>

      {/* Result Toast */}
      {testResult && (
        <div
          className={`p-3 rounded-card flex items-center gap-3 text-sm ${
            testResult.success
              ? 'bg-status-pass/10 border border-status-pass/30 text-status-pass'
              : 'bg-status-fail/10 border border-status-fail/30 text-status-fail'
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          ) : (
            <XCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Slack Integration - left border style */}
      <div className="surface-card p-6 border-l-2 border-l-[#E01E5A]">
        <div className="flex items-center gap-3 mb-4">
          <SlackIcon className="w-5 h-5 text-[#E01E5A]" />
          <div>
            <h2 className="text-sm font-medium text-text-primary">Slack</h2>
            <p className="text-xs text-text-muted">Slackチャンネルに通知を送信</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-text-muted mb-2 label-spacing uppercase">
            Webhook URL
          </label>
          <input
            type="text"
            value={slackUrl}
            onChange={(e) => setSlackUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full px-3 py-2 bg-base border border-border-subtle rounded-card text-sm text-text-primary placeholder-text-muted font-mono focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-base-surface"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => testWebhook(slackUrl, 'Slack')}
            disabled={isTesting || !slackUrl}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
          >
            <Link2 className="w-4 h-4" strokeWidth={1.5} />
            {isTesting ? 'テスト中...' : '接続テスト'}
          </button>
          <button
            onClick={() => sendSampleNotification(slackUrl, 'Slack')}
            disabled={isTesting || !slackUrl}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
            サンプルアラートを送信
          </button>
        </div>
      </div>

      {/* Microsoft Teams Integration - left border style */}
      <div className="surface-card p-6 border-l-2 border-l-blue-500">
        <div className="flex items-center gap-3 mb-4">
          <TeamsIcon className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="text-sm font-medium text-text-primary">Microsoft Teams</h2>
            <p className="text-xs text-text-muted">Teamsチャンネルに通知を送信</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-text-muted mb-2 label-spacing uppercase">
            Webhook URL
          </label>
          <input
            type="text"
            value={teamsUrl}
            onChange={(e) => setTeamsUrl(e.target.value)}
            placeholder="https://outlook.office.com/webhook/..."
            className="w-full px-3 py-2 bg-base border border-border-subtle rounded-card text-sm text-text-primary placeholder-text-muted font-mono focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-base-surface"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => testWebhook(teamsUrl, 'Teams')}
            disabled={isTesting || !teamsUrl}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
          >
            <Link2 className="w-4 h-4" strokeWidth={1.5} />
            {isTesting ? 'テスト中...' : '接続テスト'}
          </button>
          <button
            onClick={() => sendSampleNotification(teamsUrl, 'Teams')}
            disabled={isTesting || !teamsUrl}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
            サンプルアラートを送信
          </button>
        </div>
      </div>

      {/* Setup Instructions - plain text bullets instead of numbered list */}
      <div className="surface-card p-6">
        <h3 className="text-sm text-text-secondary mb-4 label-spacing uppercase">セットアップ手順</h3>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <SlackIcon className="w-4 h-4 text-[#E01E5A]" />
              <span className="text-sm font-medium text-text-primary">Slackの設定</span>
            </div>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>Slackワークスペースの設定に移動</li>
              <li>アプリ → 管理 → カスタムインテグレーションに移動</li>
              <li>Incoming WebHooksをクリックし、新しい設定を追加</li>
              <li>チャンネルを選択してWebhook URLをコピー</li>
              <li>上記にURLを貼り付けて接続テスト</li>
            </ul>
          </div>

          <div className="border-t border-border-subtle pt-6">
            <div className="flex items-center gap-2 mb-3">
              <TeamsIcon className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-text-primary">Microsoft Teamsの設定</span>
            </div>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>Microsoft Teamsを開いてチャンネルに移動</li>
              <li>メニューをクリックし、コネクタを選択</li>
              <li>Incoming Webhookを検索して構成をクリック</li>
              <li>名前を付けてWebhook URLをコピー</li>
              <li>上記にURLを貼り付けて接続テスト</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
