# LLM Trace Lens - クライアント接続ガイド

このガイドは、**LLM Trace Lens プロキシサーバー** に接続するクライアントアプリケーション開発者向けの手順書です。

---

## クイックスタート（最短導入）

### 必要な変更: たった1行

既存のコードを**1行変更するだけ**で、LLM Trace Lens の監視機能が有効になります。

#### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-openai-key",           # 既存のAPIキーをそのまま使用
    base_url="https://your-trace-lens.com/v1"  # ← この1行を追加
)

# 使い方は今まで通り
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

#### または環境変数で設定（コード変更不要）

```bash
export OPENAI_BASE_URL=https://your-trace-lens.com/v1
```

これだけで、すべてのLLMリクエストがLLM Trace Lensを経由し、自動的にトレース・監視されます。

---

## 目次

1. [概要](#概要)
2. [導入方法](#導入方法)
3. [対応プロバイダー](#対応プロバイダー)
4. [言語別コード例](#言語別コード例)
5. [API リファレンス](#api-リファレンス)
6. [ストリーミング](#ストリーミング)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

LLM Trace Lens は、LLM API リクエストをプロキシし、自動的に以下を行います：

- **トレース記録** - すべてのリクエスト/レスポンスを保存
- **バリデーション** - PII検出、ハルシネーション検出
- **コスト追跡** - トークン使用量と費用の記録
- **ダッシュボード** - リアルタイムの監視・分析

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Your App       │────▶│  LLM Trace Lens │────▶│  LLM Provider   │
│  (Client)       │     │  (Proxy)        │     │  (OpenAI etc)   │
│                 │◀────│                 │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        トレース記録
                        バリデーション
                        コスト追跡
```

---

## 導入方法

### 方法1: 環境変数（推奨・コード変更不要）

既存のコードを一切変更せず、環境変数だけで設定できます。

```bash
# OpenAI SDK用
export OPENAI_BASE_URL=https://your-trace-lens.com/v1

# その後、通常通りアプリを起動
python your_app.py
```

### 方法2: コードで設定（1行追加）

```python
client = OpenAI(
    api_key="sk-xxxxx",
    base_url="https://your-trace-lens.com/v1"  # ← この1行を追加
)
```

### 重要なポイント

| 項目 | 説明 |
|------|------|
| APIキー | **既存のLLM APIキー（OpenAI等）をそのまま使用** |
| プロバイダー | **モデル名から自動検出**（指定不要） |
| 変更箇所 | **base_url のみ** |

---

## 対応プロバイダー

以下のプロバイダーは、モデル名から**自動検出**されます。

| Provider | モデル名の例 | 自動検出パターン |
|----------|-------------|-----------------|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1-preview` | `gpt-*`, `o1*` |
| Anthropic | `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229` | `claude*` |
| Google Gemini | `gemini-1.5-pro`, `gemini-1.5-flash` | `gemini*` |
| DeepSeek | `deepseek-chat`, `deepseek-coder` | `deepseek*` |

> **注意**: プロバイダーを明示的に指定したい場合は、リクエストボディに `provider` パラメータを追加できます。

---

## 言語別コード例

### Python (OpenAI SDK)

```python
from openai import OpenAI

# LLM Trace Lens 経由で接続
client = OpenAI(
    api_key="sk-your-openai-key",
    base_url="https://your-trace-lens.com/v1"
)

# 通常通り使用 - すべてのリクエストが自動的にトレースされます
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "日本の首都は？"}
    ]
)

print(response.choices[0].message.content)
```

### Python (Anthropic SDK)

```python
from anthropic import Anthropic

# LLM Trace Lens 経由で接続
client = Anthropic(
    api_key="sk-ant-your-key",
    base_url="https://your-trace-lens.com"
)

response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.content[0].text)
```

### TypeScript / JavaScript (OpenAI SDK)

```typescript
import OpenAI from 'openai';

// LLM Trace Lens 経由で接続
const client = new OpenAI({
  apiKey: 'sk-your-openai-key',
  baseURL: 'https://your-trace-lens.com/v1',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
});

console.log(response.choices[0].message.content);
```

### cURL

```bash
curl https://your-trace-lens.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-openai-key" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Python (requests)

```python
import requests

response = requests.post(
    'https://your-trace-lens.com/v1/chat/completions',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-your-openai-key',
    },
    json={
        'model': 'gpt-4o-mini',
        'messages': [
            {'role': 'user', 'content': 'Hello!'}
        ],
    }
)

data = response.json()
print(data['choices'][0]['message']['content'])
```

---

## API リファレンス

### POST `/v1/chat/completions`

OpenAI互換のチャット完了エンドポイント。

#### リクエストヘッダー

| ヘッダー | 説明 |
|---------|------|
| `Authorization` | `Bearer YOUR_LLM_API_KEY` (OpenAI/Anthropic等のAPIキー) |
| `Content-Type` | `application/json` |

#### リクエストボディ

```json
{
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}
```

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `model` | string | Yes | モデル名（プロバイダーは自動検出） |
| `messages` | array | Yes | チャットメッセージの配列 |
| `temperature` | number | No | 0〜2 (デフォルト: 1.0) |
| `max_tokens` | integer | No | 最大出力トークン数 |
| `stream` | boolean | No | ストリーミングを有効化 |
| `provider` | string | No | 明示的にプロバイダーを指定（通常不要） |

#### レスポンス

```json
{
  "id": "req_1234567890",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  },
  "_trace": {
    "requestId": "req_1234567890",
    "validationResults": {
      "overall": "PASS",
      "riskLevel": "low"
    }
  }
}
```

---

### GET `/v1/traces`

トレース履歴を取得します。

| クエリパラメータ | 説明 |
|-----------------|------|
| `limit` | 取得件数（デフォルト: 50） |
| `offset` | オフセット |
| `level` | バリデーションレベルでフィルタ（PASS/WARN/FAIL/BLOCK） |
| `provider` | プロバイダーでフィルタ |

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

## ストリーミング

`stream: true` を指定すると、Server-Sent Events (SSE) 形式でレスポンスが返されます。

### OpenAI SDK でのストリーミング

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-key",
    base_url="https://your-trace-lens.com/v1"
)

stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True
)

for chunk in stream:
    content = chunk.choices[0].delta.content
    if content:
        print(content, end="", flush=True)
```

---

## トラブルシューティング

### 401 Unauthorized

- LLM プロバイダーのAPIキーが正しいか確認
- `Authorization: Bearer` ヘッダーが正しく設定されているか確認

### 400 Bad Request

- `messages` 配列が正しい形式か確認
- `model` 名が正しいか確認

### 502 Bad Gateway / Provider Error

- LLM プロバイダー側の問題
- しばらく待ってから再試行

### プロバイダーが正しく検出されない

リクエストボディに `provider` を明示的に指定してください：

```json
{
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "messages": [...]
}
```

---

## サポート

- **ダッシュボード**: `https://your-trace-lens.com/` でトレースを確認
- **問題報告**: 管理者に連絡するか、ダッシュボードでエラーログを確認
