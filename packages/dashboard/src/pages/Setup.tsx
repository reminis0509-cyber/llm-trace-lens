import { useState } from 'react';
import { saveConfig, type AppConfig, type StorageType } from '../api/settings';

interface SetupProps {
  onComplete: () => void;
}

export function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState(1);
  const [storageType, setStorageType] = useState<StorageType>('postgres');
  const [config, setConfig] = useState<Partial<AppConfig>>({
    providers: {},
    validation: {
      requireHighConfidence: true,
      blockInsufficientEvidence: true,
      blockPII: true,
    },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState('');

  const handleProviderChange = (provider: string, value: string) => {
    setConfig({
      ...config,
      providers: {
        ...config.providers,
        [provider]: value,
      },
    });
  };

  const handleValidationChange = (key: string, value: boolean) => {
    setConfig({
      ...config,
      validation: {
        ...config.validation!,
        [key]: value,
      },
    });
  };

  const handleNext = () => {
    if (step === 2) {
      const hasAtLeastOneKey = Object.values(config.providers || {}).some(
        key => key && key.trim()
      );
      if (!hasAtLeastOneKey) {
        setError('Please provide at least one API key');
        return;
      }
    }
    setError(null);
    setStep(step + 1);
  };

  const handleComplete = async () => {
    setSaving(true);
    setError(null);

    try {
      await saveConfig({
        ...config,
        storageType,
        setupCompleted: true,
      });

      const baseUrl = window.location.origin;
      setEndpoint(`${baseUrl}/v1/chat/completions`);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">🔧</span>
        <h1 className="text-2xl font-bold text-gray-900">LLM Trace Lens Setup</h1>
      </div>

      {/* Progress Indicator */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`flex-1 h-1 rounded ${
              i <= step ? 'bg-green-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Step 1: Storage Selection */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Step 1: Select Storage Backend</h2>
          <p className="text-gray-600 mb-6">
            Choose where to store your traces and configuration.
          </p>

          <div className="space-y-3">
            <label
              className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition ${
                storageType === 'postgres'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="storageType"
                value="postgres"
                checked={storageType === 'postgres'}
                onChange={e => setStorageType(e.target.value as StorageType)}
                className="w-5 h-5 text-green-600"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">
                  PostgreSQL <span className="text-green-600 text-sm">(Recommended)</span>
                </div>
                <div className="text-sm text-gray-600">
                  Supabase, Neon, AWS RDS - Best for production
                </div>
              </div>
            </label>

            <label
              className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition ${
                storageType === 'kv'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="storageType"
                value="kv"
                checked={storageType === 'kv'}
                onChange={e => setStorageType(e.target.value as StorageType)}
                className="w-5 h-5 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Vercel KV</div>
                <div className="text-sm text-gray-600">
                  Development & small-scale testing only (storage limits apply)
                </div>
              </div>
            </label>
          </div>

          {storageType === 'kv' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Vercel KV has storage limits. Traces older than 30 days or exceeding 5,000 per workspace will be automatically deleted. For production use, please select PostgreSQL.
              </p>
            </div>
          )}

          <button
            onClick={() => setStep(2)}
            className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
          >
            Next
          </button>
        </div>
      )}

      {/* Step 2: API Keys */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Step 2: Configure API Keys</h2>
          <p className="text-gray-600 mb-6">
            Enter API keys for the LLM providers you want to use. At least one is required.
          </p>

          {[
            { key: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
            { key: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
            { key: 'gemini', label: 'Google Gemini', placeholder: 'AIza...' },
            { key: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...' },
          ].map(provider => (
            <div key={provider.key} className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {provider.label}
              </label>
              <input
                type="password"
                placeholder={provider.placeholder}
                value={(config.providers as Record<string, string>)?.[provider.key] || ''}
                onChange={e => handleProviderChange(provider.key, e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          ))}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Validation Rules */}
      {step === 3 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Step 3: Validation Rules</h2>
          <p className="text-gray-600 mb-6">
            Configure quality and safety checks for LLM responses.
          </p>

          {[
            {
              key: 'requireHighConfidence',
              label: 'Require High Confidence',
              desc: 'Block responses below 70% confidence',
            },
            {
              key: 'blockInsufficientEvidence',
              label: 'Block Insufficient Evidence',
              desc: 'Require supporting evidence in responses',
            },
            {
              key: 'blockPII',
              label: 'Block PII',
              desc: 'Prevent personally identifiable information leaks',
            },
          ].map(rule => (
            <div
              key={rule.key}
              className="mb-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    config.validation?.[rule.key as keyof typeof config.validation] as boolean ?? true
                  }
                  onChange={e => handleValidationChange(rule.key, e.target.checked)}
                  className="w-5 h-5 mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">{rule.label}</div>
                  <div className="text-sm text-gray-500">{rule.desc}</div>
                </div>
              </label>
            </div>
          ))}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Back
            </button>
            <button
              onClick={handleComplete}
              disabled={saving}
              className={`flex-1 px-6 py-2 bg-green-600 text-white rounded-lg font-medium transition ${
                saving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-700'
              }`}
            >
              {saving ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 4 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">✅</span>
            <h2 className="text-xl font-semibold">Setup Complete!</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Your LLM Trace Lens is ready. Use the endpoint below to send requests.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proxy Endpoint
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={endpoint}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(endpoint)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Example cURL
            </label>
            <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-sm font-mono">
{`curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4",
    "provider": "openai",
    "messages": [
      {"role": "user", "content": "What is quantum computing?"}
    ]
  }'`}
            </pre>
            <button
              onClick={() =>
                copyToClipboard(
                  `curl -X POST ${endpoint} -H "Content-Type: application/json" -d '{"model": "gpt-4", "provider": "openai", "messages": [{"role": "user", "content": "What is quantum computing?"}]}'`
                )
              }
              className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
            >
              Copy cURL
            </button>
          </div>

          <button
            onClick={onComplete}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-lg"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
