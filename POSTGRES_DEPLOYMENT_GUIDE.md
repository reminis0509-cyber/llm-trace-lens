# PostgreSQL 本番デプロイガイド

LLM Trace Lens を PostgreSQL のみで本番運用するための完全ガイドです。

## 目次

1. [前提条件](#前提条件)
2. [PostgreSQL セットアップ](#postgresql-セットアップ)
3. [スキーマ作成](#スキーマ作成)
4. [環境変数設定](#環境変数設定)
5. [デプロイ方法](#デプロイ方法)
6. [動作確認](#動作確認)
7. [運用・メンテナンス](#運用メンテナンス)

---

## 前提条件

- Node.js 18 以上
- PostgreSQL 14 以上（以下のいずれか）:
  - **Supabase** (推奨・無料枠あり)
  - **Neon** (推奨・無料枠あり)
  - **AWS RDS**
  - **Google Cloud SQL**
  - **Azure Database for PostgreSQL**
  - **Railway**
  - **自己ホスト PostgreSQL**

---

## PostgreSQL セットアップ

### オプション A: Supabase (推奨)

1. [Supabase](https://supabase.com) でアカウント作成
2. 新規プロジェクト作成
3. **Settings > Database** から接続情報を取得:

```
Host: db.xxxxxxxx.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: [プロジェクト作成時のパスワード]
```

### オプション B: Neon (推奨)

1. [Neon](https://neon.tech) でアカウント作成
2. 新規プロジェクト作成
3. Dashboard から接続文字列を取得:

```
postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb
```

### オプション C: 自己ホスト (Docker)

```bash
# PostgreSQL コンテナを起動
docker run -d \
  --name llm-trace-lens-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=llm_trace_lens \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16-alpine
```

---

## スキーマ作成

PostgreSQL に接続し、以下のSQLを実行してください。

### 方法 1: psql コマンド

```bash
# 接続
psql -h <HOST> -U <USER> -d <DATABASE>

# または接続文字列で
psql "postgresql://user:password@host:5432/database"
```

### 方法 2: Supabase/Neon の SQL Editor

ダッシュボードの SQL Editor に以下を貼り付けて実行。

---

### スキーマ SQL (これを実行)

```sql
-- =====================================================
-- LLM Trace Lens - PostgreSQL Schema for Production
-- Version: 1.0.0
-- =====================================================

-- Enable UUID extension (if needed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Core Tables
-- =====================================================

-- Workspaces (multi-tenant support)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Traces (main data table)
CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Provider/Model
  provider TEXT NOT NULL,
  model TEXT NOT NULL,

  -- Request
  prompt TEXT NOT NULL,

  -- Response (JSONB for flexibility)
  response JSONB NOT NULL DEFAULT '{}',

  -- Validation Results (JSONB)
  validation_results JSONB NOT NULL DEFAULT '{}',

  -- Metrics
  latency_ms INTEGER NOT NULL DEFAULT 0,

  -- Token Usage
  usage JSONB,  -- { prompt_tokens, completion_tokens, total_tokens }

  -- Cost
  estimated_cost DECIMAL(10, 6),

  -- LLM-as-Judge Evaluation
  evaluation JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workspace Settings
CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, key)
);

-- Workspace Costs (for budget tracking)
CREATE TABLE IF NOT EXISTS workspace_costs (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  month TEXT NOT NULL,  -- YYYY-MM format
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, month, provider, model)
);

-- API Keys (for workspace authentication)
CREATE TABLE IF NOT EXISTS api_keys (
  key TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Feedback (for validation feedback loop)
CREATE TABLE IF NOT EXISTS trace_feedback (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('false_positive', 'false_negative', 'correct')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

-- Validation Configs (threshold management)
CREATE TABLE IF NOT EXISTS validation_configs (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  config_type TEXT NOT NULL,  -- 'threshold', 'scoring_weights', 'risk_levels'
  config_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  PRIMARY KEY (workspace_id, config_type)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Traces
CREATE INDEX IF NOT EXISTS idx_traces_workspace_timestamp
  ON traces(workspace_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_traces_provider
  ON traces(provider);
CREATE INDEX IF NOT EXISTS idx_traces_model
  ON traces(model);
CREATE INDEX IF NOT EXISTS idx_traces_timestamp
  ON traces(timestamp DESC);

-- Workspace Costs
CREATE INDEX IF NOT EXISTS idx_workspace_costs_month
  ON workspace_costs(workspace_id, month);

-- API Keys
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace
  ON api_keys(workspace_id);

-- Feedback
CREATE INDEX IF NOT EXISTS idx_feedback_trace
  ON trace_feedback(trace_id);
CREATE INDEX IF NOT EXISTS idx_feedback_workspace
  ON trace_feedback(workspace_id, created_at DESC);

-- =====================================================
-- Default Workspace (for single-tenant usage)
-- =====================================================

INSERT INTO workspaces (id, name)
VALUES ('default', 'Default Workspace')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Optional: Row Level Security (RLS) for Supabase
-- =====================================================

-- Uncomment if using Supabase with RLS:
-- ALTER TABLE traces ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE workspace_costs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Maintenance Functions
-- =====================================================

-- Function to clean up old traces (call periodically)
CREATE OR REPLACE FUNCTION cleanup_old_traces(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM traces
  WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Done!
-- =====================================================
```

---

## 環境変数設定

### 必須環境変数

```bash
# =====================================================
# .env ファイルの設定
# =====================================================

# データベースタイプ (postgres固定)
DATABASE_TYPE=postgres

# PostgreSQL 接続情報
# オプション1: 個別設定
POSTGRES_HOST=your-db-host.supabase.co
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=postgres

# オプション2: 接続URL (Neon/Supabase pooler使用時)
# DATABASE_URL=postgresql://user:password@host:5432/database

# LLM プロバイダーのAPIキー (必要なもののみ)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
DEEPSEEK_API_KEY=...

# サーバー設定
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# 認証 (本番では有効化推奨)
ENABLE_AUTH=true
API_KEYS=your-api-key-1,your-api-key-2

# 管理者API (閾値管理用)
ADMIN_API_KEY=your-secure-admin-key

# LLM-as-Judge 評価 (オプション)
ENABLE_EVALUATION=true
EVALUATION_MODEL=gpt-4o-mini
```

### Vercel デプロイ時の環境変数

Vercel Dashboard > Project > Settings > Environment Variables で設定:

| Key | Value | Environment |
|-----|-------|-------------|
| `DATABASE_TYPE` | `postgres` | Production |
| `POSTGRES_HOST` | `db.xxx.supabase.co` | Production |
| `POSTGRES_PORT` | `5432` | Production |
| `POSTGRES_USER` | `postgres` | Production |
| `POSTGRES_PASSWORD` | `your_password` | Production |
| `POSTGRES_DB` | `postgres` | Production |
| `OPENAI_API_KEY` | `sk-...` | Production |
| `ENABLE_AUTH` | `true` | Production |
| `API_KEYS` | `your-api-key` | Production |

---

## デプロイ方法

### 方法 1: Vercel (推奨)

```bash
# 1. Vercel CLI インストール
npm i -g vercel

# 2. ログイン
vercel login

# 3. デプロイ
vercel --prod

# 4. 環境変数設定 (Vercel Dashboard から)
```

### 方法 2: Docker

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# ビルド & 実行
docker build -t llm-trace-lens .
docker run -d \
  --name llm-trace-lens \
  -p 3000:3000 \
  --env-file .env \
  llm-trace-lens
```

### 方法 3: Railway / Render

1. GitHubリポジトリを接続
2. 環境変数を設定
3. 自動デプロイ

---

## 動作確認

### 1. ヘルスチェック

```bash
curl https://your-domain.com/health
# 期待: {"status":"ok","timestamp":"..."}
```

### 2. プロキシ経由でリクエスト

```bash
# OpenAI経由のテスト
curl -X POST https://your-domain.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 3. ダッシュボード確認

ブラウザで `https://your-domain.com` にアクセスし、トレースが記録されていることを確認。

---

## 運用・メンテナンス

### 古いトレースのクリーンアップ

```sql
-- 30日以上古いトレースを削除
SELECT cleanup_old_traces(30);

-- 結果確認
SELECT COUNT(*) FROM traces;
```

### バックアップ

```bash
# pg_dump でバックアップ
pg_dump -h <HOST> -U <USER> -d <DATABASE> > backup_$(date +%Y%m%d).sql

# Supabase の場合は Dashboard から自動バックアップあり
```

### 監視クエリ

```sql
-- トレース数の確認
SELECT
  workspace_id,
  COUNT(*) as trace_count,
  MIN(timestamp) as oldest,
  MAX(timestamp) as newest
FROM traces
GROUP BY workspace_id;

-- プロバイダー別の使用状況
SELECT
  provider,
  model,
  COUNT(*) as requests,
  SUM(estimated_cost) as total_cost
FROM traces
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY provider, model
ORDER BY requests DESC;

-- バリデーション結果の統計
SELECT
  validation_results->>'overall' as status,
  COUNT(*) as count
FROM traces
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY validation_results->>'overall';
```

---

## トラブルシューティング

### 接続エラー

```
Error: connect ECONNREFUSED
```

**解決策**:
- ホスト名/IPが正しいか確認
- ファイアウォール設定を確認
- Supabase の場合は Connection Pooler を使用

### SSL 接続エラー

```
Error: SSL required
```

**解決策**:
```bash
# 接続URLにSSLパラメータを追加
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

### 認証エラー

```
Error: password authentication failed
```

**解決策**:
- パスワードに特殊文字がある場合はURLエンコード
- Supabase の場合は Database Password を確認

---

## アーキテクチャ

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Your App       │────▶│  LLM Trace Lens │────▶│  PostgreSQL     │
│                 │     │  (Proxy)        │     │  (Storage)      │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │
                        ┌────────▼────────┐
                        │                 │
                        │  LLM Providers  │
                        │  (OpenAI, etc)  │
                        │                 │
                        └─────────────────┘
```

---

## FAQ

### Q: Vercel KV は使わなくていいの？

**A**: PostgreSQL だけで完全に動作します。Vercel KV は不要です。

### Q: PostgreSQL の無料枠で足りる？

**A**: Supabase は 500MB、Neon は 512MB の無料枠があります。通常のテスト・小規模本番なら十分です。

### Q: マイグレーションは自動で実行される？

**A**: いいえ。初回セットアップ時に手動でスキーマSQLを実行する必要があります。

### Q: ワークスペースは必須？

**A**: いいえ。`default` ワークスペースが自動作成されるので、シングルテナントでも使えます。

---

## サポート

問題が発生した場合は GitHub Issues で報告してください:
https://github.com/anthropics/llm-trace-lens/issues
