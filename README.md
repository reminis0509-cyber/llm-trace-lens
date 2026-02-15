# FujiTrace

**AIエージェント・LLMアプリケーションのためのオブザーバビリティプラットフォーム**

FujiTrace は、LLM の入出力をリアルタイムで監視・評価・保護するプロキシ型オブザーバビリティツールです。
エンドポイントURLを変えるだけで導入でき、既存コードの修正は不要です。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 特徴

- **1行で導入** — プロキシ型アーキテクチャ。SDKの組み込み不要、URLを変えるだけ
- **AIエージェント対応** — ReActパターンのステップ・ツール呼び出し・判断プロセスを完全トレース
- **LLM-as-Judge評価** — OpenAI / Claude 両対応。忠実性・回答関連性を自動スコアリング
- **日本語PII検出** — マイナンバー、住所、電話番号、パスポート、保険証、免許証を検出・ブロック
- **マルチプロバイダー** — OpenAI、Anthropic、Gemini に対応
- **プラン課金基盤** — Free / Pro / Enterprise の3段階。月次トレースカウント・自動制限
- **セキュリティ** — fail-closed 予算ガード、入力検証（SQLi/XSS）、CSP、RBAC

## 対応プロバイダー

| プロバイダー | ステータス | ストリーミング |
|-------------|-----------|-------------|
| OpenAI (GPT-4, GPT-4o, etc.) | ✅ | ✅ |
| Anthropic (Claude 3.5, Claude 3, etc.) | ✅ | ✅ |
| Google Gemini | ✅ | ✅ |

## クイックスタート

```bash
# 1. リポジトリをクローン
git clone https://github.com/your-org/fujitrace.git
cd fujitrace

# 2. 依存関係をインストール
npm install

# 3. 環境変数を設定
cp .env.example .env
# .env を編集してAPIキーとDB接続情報を設定

# 4. 起動
npm run dev
```

サーバーが `http://localhost:3000` で起動します。

## 使い方

### 基本的なリクエスト

既存のLLM APIコールのURLを `localhost:3000` に向けるだけ:

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "東京の天気を教えて"}
    ]
  }'
```

### ストリーミング

```bash
curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "stream": true,
    "messages": [
      {"role": "user", "content": "1から5まで数えて"}
    ]
  }'
```

### エージェントトレース

AIエージェントの判断プロセスを構造化して記録:

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "traceType": "agent",
    "agentTrace": {
      "goal": "売上レポートを作成する",
      "steps": [],
      "status": "in_progress",
      "stepCount": 0,
      "toolCallCount": 0,
      "totalDurationMs": 0
    },
    "messages": [
      {"role": "user", "content": "先月の売上データを集計して"}
    ]
  }'
```

## アーキテクチャ

```
クライアント → FujiTrace (プロキシ) → LLMプロバイダー
                    │
                    ├── トレース記録
                    ├── バリデーション（信頼性・リスク）
                    ├── PII検出・ブロック
                    ├── LLM-as-Judge評価
                    ├── コスト追跡・予算管理
                    └── ダッシュボード表示
```

## 環境変数

```bash
# データベース（PostgreSQL推奨）
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:password@localhost:5432/fujitrace

# プロバイダーAPIキー（使用するものだけ設定）
OPENAI_API_KEY=sk-your-api-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_API_KEY=your-google-key

# サーバー設定
PORT=3000
LOG_LEVEL=info

# 認証（オプション）
ENABLE_AUTH=false
API_KEYS=your-secret-key-1,your-secret-key-2

# LLM-as-Judge評価（オプション）
ENABLE_EVALUATION=true
EVALUATION_MODEL=gpt-4o-mini
EVALUATION_PROVIDER=openai        # openai or anthropic
EVALUATION_SAMPLING_RATE=1.0      # 0.0〜1.0
EVALUATION_TIMEOUT_MS=5000

# 予算管理（オプション）
BUDGET_LIMIT=100                  # USD
BUDGET_WARN_THRESHOLD=0.9         # 90%で警告
```

全ての設定項目は [`.env.example`](.env.example) を参照してください。

## ストレージ

| ストレージ | 用途 | 設定 |
|-----------|------|------|
| **PostgreSQL** | 本番環境推奨 | `DATABASE_TYPE=postgres` |
| **Vercel KV** | 開発・プロトタイピング | `DATABASE_TYPE=kv` |

> 本番環境では必ずPostgreSQLを使用してください。

## テスト

```bash
# ユニットテスト
npm test

# カバレッジ付き
npm run test:coverage
```

## プラン

| | Free | Pro | Enterprise |
|---|---|---|---|
| 月額 | 無料 | ¥9,800 | お問い合わせ |
| 月間トレース | 5,000 | 50,000 | 無制限 |
| LLM-as-Judge | - | 月1,000回 | 無制限 |
| データ保持 | 7日 | 90日 | 365日 |
| SSO | - | - | 対応 |

## セキュリティ

- **fail-closed 予算ガード**: エラー時はリクエストをブロック（安全側に倒す）
- **入力検証**: SQLインジェクション・XSSパターンを検出・拒否
- **CSP**: Content Security Policy で `unsafe-inline` 排除
- **RBAC**: ワークスペース単位のロールベースアクセス制御
- **日本語PII検出**: マイナンバー、住所、電話番号、パスポート、保険証、免許証

## ライセンス

[MIT](LICENSE)

## コントリビューション

Issue・Pull Request を歓迎します。
