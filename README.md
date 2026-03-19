# FujiTrace

**AIエージェント・LLMアプリケーションのためのオブザーバビリティプラットフォーム**

FujiTrace は、LLM の入出力をリアルタイムで監視・評価・保護するプロキシ型オブザーバビリティツールです。
エンドポイントURLを変えるだけで導入でき、既存コードの修正は不要です。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 特徴

- **1行で導入** -- プロキシ型アーキテクチャ。SDKの組み込み不要、URLを変えるだけ
- **AIエージェント対応** -- ReActパターンのステップ・ツール呼び出し・判断プロセスを完全トレース
- **LLM-as-Judge評価** -- Faithfulness / Answer Relevance / Context Utilization / Hallucination Rate を自動スコアリング
- **日本語PII検出** -- マイナンバー、住所、電話番号、パスポート、保険証、免許証、郵便番号を検出・ブロック（15+パターン）
- **マルチプロバイダー** -- OpenAI、Anthropic、Google Gemini に対応（ストリーミング完全対応）
- **5段階プラン課金** -- Free / Pro / Enterprise Standard / Plus / Premium
- **ダッシュボード** -- トレース一覧・統計・エージェントステップ可視化・業界ベンチマーク
- **Webhook通知** -- Slack・Teams・メール連携。ブロック・警告・コストアラート自動通知
- **セキュリティ** -- fail-closed 予算ガード、入力検証（SQLi/XSS）、CSP、RBAC、暗号化APIキー管理

## 対応プロバイダー

| プロバイダー | 対応モデル | ストリーミング |
|-------------|-----------|-------------|
| OpenAI | GPT-4o, GPT-4o-mini, GPT-4, o1, o1-mini | ✅ |
| Anthropic | Claude Opus 4, Claude Sonnet 4, Claude 3.5 Sonnet, Claude 3 Haiku | ✅ |
| Google Gemini | Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash | ✅ |

## クイックスタート

### Docker Compose（推奨）

```bash
# 1. リポジトリをクローン
git clone https://github.com/reminis0509-cyber/llm-trace-lens.git
cd llm-trace-lens

# 2. 環境変数を設定
cp .env.example .env
# .env を編集してAPIキーを設定

# 3. 起動（プロキシ + Redis + ダッシュボード）
docker compose up -d
```

- プロキシサーバー: `http://localhost:3000`
- ダッシュボード: `http://localhost:8080`

### ローカル開発

```bash
# 1. リポジトリをクローン
git clone https://github.com/reminis0509-cyber/llm-trace-lens.git
cd llm-trace-lens

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

既存のLLM APIコールのURLを FujiTrace に向けるだけ:

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-openai-key",
    base_url="http://localhost:3000/v1"  # この1行を追加
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "東京の天気を教えて"}]
)
```

詳しくは [クライアント接続ガイド](docs/client-integration-guide.md) を参照してください。

## アーキテクチャ

```
クライアント → FujiTrace (プロキシ) → LLMプロバイダー
                    │
                    ├── トレース記録
                    ├── バリデーション（信頼性・リスク）
                    ├── PII検出・ブロック
                    ├── LLM-as-Judge評価（RAG品質含む）
                    ├── コスト追跡・予算管理
                    ├── Webhook通知（Slack/Teams/Email）
                    └── ダッシュボード表示
```

## プラン

| | Free | Pro | Enterprise |
|---|---|---|---|
| 月額 | 無料 | ¥9,800 | ¥25,000〜 |
| 月間トレース | 5,000 | 50,000 | 100,000〜無制限 |
| LLM-as-Judge | - | 月1,000回 | 月3,000回〜無制限 |
| データ保持 | 7日 | 90日 | 180日〜無制限 |
| ワークスペース | 1 | 3 | 無制限 |
| メンバー | 2名 | 10名 | 無制限 |
| SSO | - | - | Plus以上 |
| SLA | - | 99.5% | 99.5%〜99.95% |

Enterprise は年契約のみ（Standard / Plus / Premium の3段階）。
OSSセルフホスト版は全機能無料で利用可能です。

## ドキュメント

| ドキュメント | 内容 |
|------------|------|
| [製品概要](docs/product-overview.md) | 機能一覧・FAQ・詳細仕様 |
| [設計思想](docs/design-philosophy.md) | 3つの設計原則 |
| [検証アーキテクチャ](docs/validation-architecture.md) | バリデーション・PII検出の技術詳細 |
| [クライアント接続ガイド](docs/client-integration-guide.md) | SDK別の導入手順・フレームワーク別ガイド |
| [デプロイガイド](docs/deployment-guide.md) | PostgreSQL本番環境のセットアップ |
| [料金モデル](docs/pricing-model.md) | 5段階プラン設計・コスト構造 |
| [GTM戦略](docs/strategy-2026.md) | 市場分析・競合分析・Go-to-Market戦略 |

## テスト

```bash
# ユニットテスト
npm test

# カバレッジ付き
npm run test:coverage
```

142テストケース（バリデーション、評価、ミドルウェア、ストレージ）。

## セキュリティ

- **fail-closed 予算ガード**: エラー時はリクエストをブロック（安全側に倒す）
- **入力検証**: SQLインジェクション・XSSパターンを検出・拒否
- **CSP**: Content Security Policy で `unsafe-inline` 排除
- **RBAC**: ワークスペース単位のロールベースアクセス制御（owner / admin / member）
- **暗号化APIキー管理**: プロバイダーAPIキーをAES-256-GCM暗号化で保存・ローテーション対応
- **日本語PII検出**: マイナンバー、住所、電話番号、パスポート、保険証、免許証、郵便番号（15+パターン）
- **タイミングセーフ認証**: SHA-256ベースのAPIキー比較でタイミング攻撃を防止

## 技術スタック

- **Backend**: Fastify 5 + TypeScript (ESM)
- **Frontend**: React 18 + Vite + TailwindCSS + Recharts
- **Landing Page**: React 18 + Vite + Three.js
- **Database**: PostgreSQL (本番) / SQLite (開発)
- **Auth**: Supabase, Google OAuth, Azure AD
- **Payments**: Stripe
- **Testing**: Vitest (142テストケース)

## ライセンス

[MIT](LICENSE)

## コントリビューション

Issue・Pull Request を歓迎します。
