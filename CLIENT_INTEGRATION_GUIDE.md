# LLM Trace Lens - クライアント接続ガイド

このガイドは、**LLM Trace Lens プロキシサーバー** に接続するクライアントアプリケーション開発者向けの手順書です。

---

## 目次

1. [概要](#概要)
2. [接続情報](#接続情報)
3. [認証](#認証)
4. [API リファレンス](#api-リファレンス)
5. [言語別コード例](#言語別コード例)
6. [既存SDKからの移行](#既存sdkからの移行)
7. [ストリーミング](#ストリーミング)
8. [トラブルシューティング](#トラブルシューティング)

---

## 概要

LLM Trace Lens は、LLM API リクエストをプロキシし、自動的に以下を行います：

- **トレース記録** - すべてのリクエスト/レスポンスを保存
- **バリデーション** - レスポンスの品質チェック（ハルシネーション検出等）
- **コスト追跡** - トークン使用量と費用の記録
- **ダッシュボード** - リアルタイムの監視・分析

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Your App       │────▶│  LLM Trace Lens │────▶│  LLM Provider   │
│  (Client)       │     │  (Proxy)        │     │  (OpenAI etc)   │
│                 │◀────│                 │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 接続情報

### エンドポイント

| 環境 | URL |
|------|-----|
| 本番 | `https://your-deployment-url.com` |
| 開発 | `http://localhost:3000` |

### 利用可能なプロバイダー

| Provider | model 例 |
|----------|----------|
| `openai` | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo` |
| `anthropic` | `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229` |
| `gemini` | `gemini-1.5-pro`, `gemini-1.5-flash` |
| `deepseek` | `deepseek-chat`, `deepseek-coder` |

---

## 認証

### 方法 1: Authorization ヘッダー（推奨）

```http
Authorization: Bearer YOUR_API_KEY
```

### 方法 2: X-API-Key ヘッダー

```http
X-API-Key: YOUR_API_KEY
```

> **注意**: API キーは管理者から発行されます。サーバー側で認証が無効化されている場合、この手順は不要です。

---

## API リファレンス

### POST `/v1/chat/completions`

LLM にチャット完了リクエストを送信します。

#### リクエスト

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello, how are you?" }
  ],
  "temperature": 0.7,
  "maxTokens": 1000,
  "stream": false
}
```

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `provider` | string | No | `openai`, `anthropic`, `gemini`, `deepseek` (デフォルト: `openai`) |
| `model` | string | Yes | 使用するモデル名 |
| `messages` | array | Yes | チャットメッセージの配列 |
| `temperature` | number | No | 0〜2 (デフォルト: 1.0) |
| `maxTokens` | integer | No | 最大出力トークン数 |
| `stream` | boolean | No | ストリーミングを有効化 (デフォルト: false) |
| `systemPrompt` | string | No | システムプロンプト（`messages` の代わりに使用可） |
| `prompt` | string | No | ユーザープロンプト（`messages` の代わりに使用可） |

#### レスポンス（通常）

```json
{
  "id": "trace_abc123",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "response": {
    "content": "Hello! I'm doing well, thank you for asking.",
    "role": "assistant"
  },
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 12,
    "total_tokens": 37
  },
  "validation": {
    "overall": "PASS",
    "checks": {
      "hallucination": { "passed": true },
      "toxicity": { "passed": true }
    }
  },
  "latency_ms": 450,
  "estimated_cost": 0.000037
}
```

---

### GET `/v1/traces`

トレース履歴を取得します。

#### クエリパラメータ

| パラメータ | 説明 |
|-----------|------|
| `limit` | 取得件数（デフォルト: 50） |
| `offset` | オフセット |
| `level` | バリデーションレベルでフィルタ |
| `provider` | プロバイダーでフィルタ |
| `model` | モデルでフィルタ |

#### レスポンス

```json
{
  "traces": [...],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

---

### GET `/v1/traces/:id`

特定のトレースを取得します。

---

### GET `/v1/stats`

統計情報を取得します。

---

### GET `/health`

ヘルスチェック。

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "0.1.0"
}
```

---

## 言語別コード例

### TypeScript / JavaScript

```typescript
// fetch を使った例
async function chat(message: string) {
  const response = await fetch('https://your-server.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY',
    },
    body: JSON.stringify({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: message }
      ],
    }),
  });

  const data = await response.json();
  return data.response.content;
}

// 使用例
const answer = await chat('日本の首都は？');
console.log(answer);
```

### Python

```python
import requests

def chat(message: str) -> str:
    response = requests.post(
        'https://your-server.com/v1/chat/completions',
        headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_API_KEY',
        },
        json={
            'provider': 'openai',
            'model': 'gpt-4o-mini',
            'messages': [
                {'role': 'user', 'content': message}
            ],
        }
    )
    data = response.json()
    return data['response']['content']

# 使用例
answer = chat('日本の首都は？')
print(answer)
```

### cURL

```bash
curl -X POST https://your-server.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

---

## 既存SDKからの移行

### OpenAI SDK (Python)

```python
from openai import OpenAI

# Before: 直接 OpenAI に接続
# client = OpenAI()

# After: LLM Trace Lens 経由
client = OpenAI(
    base_url='https://your-server.com/v1',
    api_key='YOUR_API_KEY',  # LLM Trace Lens の API キー
)

# 使い方は同じ
response = client.chat.completions.create(
    model='gpt-4o-mini',
    messages=[
        {'role': 'user', 'content': 'Hello!'}
    ]
)
print(response.choices[0].message.content)
```

### OpenAI SDK (TypeScript)

```typescript
import OpenAI from 'openai';

// Before: 直接 OpenAI に接続
// const client = new OpenAI();

// After: LLM Trace Lens 経由
const client = new OpenAI({
  baseURL: 'https://your-server.com/v1',
  apiKey: 'YOUR_API_KEY',  // LLM Trace Lens の API キー
});

// 使い方は同じ
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
});
console.log(response.choices[0].message.content);
```

> **注意**: OpenAI SDK を使う場合、`provider` パラメータを指定できないため、デフォルトで OpenAI が使用されます。他のプロバイダーを使う場合は直接 API を呼び出してください。

---

## ストリーミング

`stream: true` を指定すると、Server-Sent Events (SSE) 形式でレスポンスが返されます。

### JavaScript での例

```javascript
async function streamChat(message) {
  const response = await fetch('https://your-server.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY',
    },
    body: JSON.stringify({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: message }],
      stream: true,
    }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6); // 'data: ' を除去
      if (data === '[DONE]') return;

      const parsed = JSON.parse(data);
      const content = parsed.choices?.[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
      }
    }
  }
}
```

---

## トラブルシューティング

### 401 Unauthorized

- API キーが正しいか確認
- `Authorization: Bearer` または `X-API-Key` ヘッダーを確認

### 400 Bad Request

- `messages` 配列が正しい形式か確認
- `provider` と `model` の組み合わせが有効か確認

### 502 Bad Gateway / Provider Error

- LLM プロバイダー側の問題
- しばらく待ってから再試行
- 管理者にプロバイダーの API キー設定を確認

### CORS エラー

- ブラウザからの直接呼び出しは CORS 設定が必要
- 管理者に許可オリジンの追加を依頼

### 接続タイムアウト

- `maxTokens` を小さくする
- モデルを `gpt-4o-mini` など軽量なものに変更

---

## サポート

問題が発生した場合は、管理者に連絡するか、ダッシュボードでトレースログを確認してください。

ダッシュボード URL: `https://your-server.com/`
