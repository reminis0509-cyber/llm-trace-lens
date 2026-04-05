# FujiTrace - クライアント接続ガイド

このガイドは、**FujiTrace プロキシサーバー** に接続するクライアントアプリケーション開発者向けの手順書です。

---

## クイックスタート（最短導入）

### 必要な変更: たった1行

既存のコードを**1行変更するだけ**で、FujiTrace の監視機能が有効になります。

#### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-openai-key",           # 既存のAPIキーをそのまま使用
    base_url="https://your-fujitrace.com/v1"  # ← この1行を追加
)

# 使い方は今まで通り
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

#### TypeScript / JavaScript (OpenAI SDK)

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-openai-key',           // 既存のAPIキーをそのまま使用
  baseURL: 'https://your-fujitrace.com/v1',  // ← この1行を追加
});

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

#### または環境変数で設定（コード変更不要）

```bash
export OPENAI_BASE_URL=https://your-fujitrace.com/v1
```

これだけで、すべてのLLMリクエストがFujiTraceを経由し、自動的にトレース・監視されます。

---

## 目次

1. [概要](#概要)
2. [導入方法](#導入方法)
3. [対応プロバイダー](#対応プロバイダー)
4. [言語別コード例](#言語別コード例)
5. [フレームワーク別ガイド](#フレームワーク別ガイド)
6. [API リファレンス](#api-リファレンス)
7. [ストリーミング](#ストリーミング)
8. [トラブルシューティング](#トラブルシューティング)
9. [よくある間違い](#よくある間違い)

---

## 概要

FujiTrace は、LLM API リクエストをプロキシし、自動的に以下を行います：

- **トレース記録** - すべてのリクエスト/レスポンスを保存
- **バリデーション** - PII検出、ハルシネーション検出
- **コスト追跡** - トークン使用量と費用の記録
- **ダッシュボード** - リアルタイムの監視・分析

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Your App       │────▶│  FujiTrace │────▶│  LLM Provider   │
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
export OPENAI_BASE_URL=https://your-fujitrace.com/v1

# その後、通常通りアプリを起動
python your_app.py
```

### 方法2: コードで設定（1行追加）

```python
client = OpenAI(
    api_key="sk-xxxxx",
    base_url="https://your-fujitrace.com/v1"  # ← この1行を追加
)
```

### 重要なポイント

| 項目 | 説明 |
|------|------|
| APIキー | **既存のLLM APIキー（OpenAI等）をそのまま使用** |
| プロバイダー | **モデル名から自動検出**（指定不要） |
| 変更箇所 | **base_url / baseURL のみ** |

### baseURL の正しい形式

```
✅ 正しい: https://your-fujitrace.com/v1
❌ 間違い: https://your-fujitrace.com/v1/chat/completions
```

> **重要**: `baseURL` には `/v1` までを指定してください。`/chat/completions` は含めないでください。SDKが自動的にエンドポイントパスを追加します。

---

## 対応プロバイダー

以下のプロバイダーは、モデル名から**自動検出**されます。

| Provider | モデル名の例 | 自動検出パターン |
|----------|-------------|-----------------|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1-preview` | `gpt-*`, `o1*` |
| Anthropic | `claude-opus-4-20250514`, `claude-sonnet-4-20250514`, `claude-3-5-sonnet-20241022` | `claude*` |
| Google Gemini | `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash` | `gemini*` |

> **注意**: プロバイダーを明示的に指定したい場合は、リクエストボディに `provider` パラメータを追加できます。

---

## 言語別コード例

### Python (OpenAI SDK)

```python
from openai import OpenAI

# FujiTrace 経由で接続
client = OpenAI(
    api_key="sk-your-openai-key",
    base_url="https://your-fujitrace.com/v1"
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

# FujiTrace 経由で接続
client = Anthropic(
    api_key="sk-ant-your-key",
    base_url="https://your-fujitrace.com"
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

// FujiTrace 経由で接続
const client = new OpenAI({
  apiKey: 'sk-your-openai-key',
  baseURL: 'https://your-fujitrace.com/v1',
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
curl https://your-fujitrace.com/v1/chat/completions \
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
    'https://your-fujitrace.com/v1/chat/completions',
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

## フレームワーク別ガイド

### Next.js (App Router) + Vercel

Next.js アプリケーションを Vercel にデプロイする場合の設定方法です。

#### 1. API Route の作成

`src/app/api/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.FUJITRACE_URL || 'https://your-fujitrace.com/v1',
});

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
    });

    return NextResponse.json({
      message: response.choices[0].message.content,
    });
  } catch (error: unknown) {
    console.error('OpenAI API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get response from AI', details: errorMessage },
      { status: 500 }
    );
  }
}
```

#### 2. ローカル開発用の環境変数

`.env.local`:

```bash
OPENAI_API_KEY=sk-your-openai-key
FUJITRACE_URL=https://your-fujitrace.com/v1
```

> **セキュリティ注意**: `.env.local` は `.gitignore` に含まれているため、GitHubにプッシュされません。APIキーをコードに直接書かないでください。

#### 3. Vercel での環境変数設定

1. Vercel ダッシュボード → プロジェクトを選択
2. **Settings** → **Environment Variables**
3. 以下の環境変数を追加:

| Name | Value |
|------|-------|
| `OPENAI_API_KEY` | `sk-your-openai-key` |
| `FUJITRACE_URL` | `https://your-fujitrace.com/v1` |

4. **Save** をクリック
5. **Deployments** → 最新のデプロイを **Redeploy**

#### 4. フロントエンドからの呼び出し

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello!' }]
  }),
});

const data = await response.json();
console.log(data.message);
```

### Express.js

```typescript
import express from 'express';
import OpenAI from 'openai';

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.FUJITRACE_URL || 'https://your-fujitrace.com/v1',
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
    });

    res.json({
      message: response.choices[0].message.content,
    });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### FastAPI (Python)

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import OpenAI
import os

app = FastAPI()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("FUJITRACE_URL", "https://your-fujitrace.com/v1")
)

class ChatRequest(BaseModel):
    messages: list

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=request.messages
        )
        return {"message": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
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

### OpenAI SDK でのストリーミング (Python)

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-key",
    base_url="https://your-fujitrace.com/v1"
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

### OpenAI SDK でのストリーミング (TypeScript)

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-key',
  baseURL: 'https://your-fujitrace.com/v1',
});

const stream = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

---

## トラブルシューティング

### 401 Unauthorized

- LLM プロバイダーのAPIキーが正しいか確認
- `Authorization: Bearer` ヘッダーが正しく設定されているか確認
- 環境変数 `OPENAI_API_KEY` が設定されているか確認

### 400 Bad Request

- `messages` 配列が正しい形式か確認
- `model` 名が正しいか確認

### 404 Not Found

- `baseURL` が正しい形式か確認（[よくある間違い](#よくある間違い)を参照）
- ブラウザで直接URLを開いた場合、GETリクエストになるため404が返されるのは正常です（POSTのみ対応）

### 502 Bad Gateway / Provider Error

- LLM プロバイダー側の問題
- しばらく待ってから再試行

### トレースが記録されない

1. **サーバーを再起動しましたか？**
   - コード変更後、開発サーバーの再起動が必要です
   - Next.js: `npm run dev` を停止して再実行

2. **キャッシュを削除しましたか？**
   - Next.js: `rm -rf .next` を実行してから `npm run dev`

3. **環境変数は正しく設定されていますか？**
   - ローカル: `.env.local` ファイルを確認
   - Vercel: Settings → Environment Variables を確認
   - Vercel環境変数変更後は **Redeploy** が必要

4. **リクエストがFujiTraceを経由しているか確認**
   - ブラウザの開発者ツール → Network タブで確認
   - リクエストURLが `your-fujitrace.com` になっているか確認

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

## よくある間違い

### 1. baseURL に `/chat/completions` を含めてしまう

```typescript
// ❌ 間違い - SDKが自動的にパスを追加するため、二重になってしまう
const client = new OpenAI({
  apiKey: 'sk-xxx',
  baseURL: 'https://your-fujitrace.com/v1/chat/completions',
});
// → リクエストURLが /v1/chat/completions/chat/completions になる

// ✅ 正しい
const client = new OpenAI({
  apiKey: 'sk-xxx',
  baseURL: 'https://your-fujitrace.com/v1',
});
```

### 2. APIキーをコードにハードコードする

```typescript
// ❌ 間違い - GitHubにプッシュするとAPIキーが漏洩する
const client = new OpenAI({
  apiKey: 'sk-proj-xxxxxxxxxxxx',
  baseURL: 'https://your-fujitrace.com/v1',
});

// ✅ 正しい - 環境変数を使用
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.FUJITRACE_URL || 'https://your-fujitrace.com/v1',
});
```

### 3. 開発サーバーを再起動しない

コードを変更した後、開発サーバーを再起動しないと変更が反映されません。

```bash
# Next.js の場合
# 1. Ctrl+C でサーバーを停止
# 2. キャッシュを削除（推奨）
rm -rf .next
# 3. サーバーを再起動
npm run dev
```

### 4. Vercel環境変数を設定後にRedeployしない

Vercelで環境変数を追加・変更した場合、**Redeploy**しないと反映されません。

1. Vercel ダッシュボード → プロジェクト
2. **Deployments** タブ
3. 最新のデプロイの **...** メニュー → **Redeploy**

---

## セキュリティベストプラクティス

### APIキーの管理

1. **環境変数を使用する** - コードにAPIキーをハードコードしない
2. **`.env.local` をGitにコミットしない** - `.gitignore` に含まれていることを確認
3. **本番環境では環境変数を使用** - Vercel/AWS/GCP等の環境変数機能を使用

### .gitignore の設定

```gitignore
# 環境変数ファイル
.env
.env.local
.env.*.local

# 依存関係
node_modules/

# ビルド出力
.next/
dist/
build/
```

---

## 接続失敗パターンと解決方法

トレースが記録されない場合、以下のフローチャートに従って問題を特定してください。

### 診断フローチャート

```
トレースが記録されない
        │
        ▼
┌─────────────────────────────────────┐
│ ローカル環境で動作確認              │
│ (npm run dev でテスト)              │
└─────────────────────────────────────┘
        │
        ├─── ローカルでも動かない ───▶ 【パターン1〜3を確認】
        │
        ▼
┌─────────────────────────────────────┐
│ ローカルでは動くが本番で動かない     │
└─────────────────────────────────────┘
        │
        ▼
    【パターン4〜7を確認】
```

---

### パターン1: baseURL の形式が間違っている

**症状**: 404 エラーが発生する、またはチャットが動かない

**原因**: `baseURL` に `/chat/completions` を含めてしまっている

```typescript
// ❌ 間違い
baseURL: 'https://your-fujitrace.com/v1/chat/completions'

// ✅ 正しい
baseURL: 'https://your-fujitrace.com/v1'
```

**解決方法**: `baseURL` は `/v1` までにする。SDKが自動的に `/chat/completions` を追加します。

---

### パターン2: 開発サーバーを再起動していない

**症状**: コードを変更したのに古い動作のまま

**原因**: Next.js等の開発サーバーがコード変更を完全に反映していない

**解決方法**:
```bash
# 1. サーバーを停止 (Ctrl+C)
# 2. キャッシュを削除
rm -rf .next
# 3. サーバーを再起動
npm run dev
```

---

### パターン3: 環境変数が読み込まれていない（ローカル）

**症状**: チャットは動くがトレースが記録されない、または認証エラー

**原因**: `.env.local` ファイルが存在しない、または値が間違っている

**解決方法**:
1. `.env.local` ファイルが存在するか確認
2. 以下の内容が正しく設定されているか確認:
```bash
OPENAI_API_KEY=sk-your-openai-key
FUJITRACE_URL=https://your-fujitrace.com/v1
```
3. サーバーを再起動

---

### パターン4: Vercel が GitHub リポジトリに接続されていない（最重要）

**症状**: ローカルでは動くが、本番環境では古いコードが動いている

**原因**: Vercel プロジェクトが GitHub に接続されていないため、`git push` してもデプロイされない

**確認方法**:
1. Vercel ダッシュボード → プロジェクト
2. **Settings** → **Git**
3. 「Connected Git Repository」が表示されているか確認

**解決方法**:
1. **Settings** → **Git** → **Connect Git Repository**
2. GitHub リポジトリを選択して接続
3. 接続後、自動的に最新のコードがデプロイされる

> **重要**: これは最もよくある原因です。Vercel で新規プロジェクトを作成する際に GitHub 接続をスキップした場合に発生します。

---

### パターン5: Vercel 環境変数のスコープが間違っている

**症状**: ローカルでは動くが、本番では環境変数が読み込まれない

**原因**: 環境変数が「Development」のみに設定されており、「Production」に含まれていない

**確認方法**:
1. Vercel ダッシュボード → プロジェクト → **Settings** → **Environment Variables**
2. 各環境変数の「Environment」欄を確認

**解決方法**:
環境変数を追加/編集する際、以下の3つすべてにチェックを入れる:
- ☑ Production
- ☑ Preview
- ☑ Development

---

### パターン6: Vercel 環境変数設定後に Redeploy していない

**症状**: 環境変数を設定したが反映されない

**原因**: 環境変数はビルド時に読み込まれるため、設定後に Redeploy が必要

**解決方法**:
1. Vercel ダッシュボード → プロジェクト → **Deployments**
2. 最新のデプロイの **...** メニュー → **Redeploy**
3. **「Use existing Build Cache」のチェックを外す**（重要！）
4. **Redeploy** をクリック

---

### パターン7: API キーをコードにハードコードして GitHub Push に失敗

**症状**: `git push` が「Push cannot contain secrets」エラーで失敗する

**原因**: GitHub Push Protection がコード内の API キーを検出してブロック

**解決方法**:
1. コードから API キーを削除し、環境変数を使用:
```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,  // ハードコードしない
  baseURL: process.env.FUJITRACE_URL || 'https://your-fujitrace.com/v1',
});
```
2. `.env.local` に API キーを設定（ローカル用）
3. Vercel の環境変数に API キーを設定（本番用）
4. コミットをやり直す:
```bash
git add .
git commit --amend -m "Remove hardcoded API key"
git push origin main
```

---

### デバッグ用コード

問題が特定できない場合、以下のデバッグコードを追加してトレースの確認を行えます:

```typescript
// route.ts
const baseURL = process.env.FUJITRACE_URL || 'https://your-fujitrace.com/v1';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: baseURL,
});

export async function POST(request: NextRequest) {
  const { messages } = await request.json();

  // デバッグログ
  console.log('Using baseURL:', baseURL);
  console.log('API Key exists:', !!process.env.OPENAI_API_KEY);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages,
  });

  // _trace の存在確認
  const rawResponse = response as unknown as { _trace?: unknown };
  console.log('Has _trace:', !!rawResponse._trace);

  return NextResponse.json({
    message: response.choices[0].message.content,
    // デバッグ情報（本番では削除）
    _debug: {
      baseURL: baseURL,
      hasTrace: !!rawResponse._trace,
    },
  });
}
```

**確認ポイント**:
- `baseURL` が正しい URL になっているか
- `hasTrace: true` なら FujiTrace を経由している

> **注意**: デバッグ確認後は `_debug` フィールドと `console.log` を削除してください。

---

### 問題解決チェックリスト

| チェック項目 | 確認方法 |
|-------------|---------|
| ☐ baseURL が `/v1` で終わっている | コードを確認 |
| ☐ API キーが環境変数で設定されている | `.env.local` と Vercel 設定を確認 |
| ☐ 開発サーバーを再起動した | `npm run dev` を再実行 |
| ☐ Vercel が GitHub に接続されている | Settings → Git で確認 |
| ☐ 環境変数のスコープに Production が含まれている | Settings → Environment Variables で確認 |
| ☐ 環境変数設定後に Redeploy した | Deployments で最新デプロイを確認 |
| ☐ Redeploy 時にキャッシュを無効化した | 「Use existing Build Cache」をオフ |

---

## サポート

- **ダッシュボード**: `https://your-fujitrace.com/` でトレースを確認
- **問題報告**: 管理者に連絡するか、ダッシュボードでエラーログを確認
- **ドキュメント**: このガイドを参照
