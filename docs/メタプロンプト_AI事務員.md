# FujiTrace AI 事務員（枠組み型エージェント）実装メタプロンプト

> 作成: 2026-04-10
> 担当: Backend Engineer + Frontend Engineer（並列実行可）
> 前提ドキュメント: `docs/戦略_2026.md` Section 12, `docs/事務作業カタログ_v2.md`
> 既存実装: `src/tools/` (ToolSchema + OpenAPI), `src/routes/tools/` (estimate 2 endpoints)

---

## 1. 目的

FujiTrace AI 事務員のMVPを実装する。ユーザーがチャットで自然言語の作業依頼を送ると、AI事務員が登録済みツール（型）の中から一致するものを特定し、ツールを呼び出して作業を完了する。完全一致するツールがない場合でも、応用可能な既存ツールがあればそれを適応して対応する。

---

## 2. コアコンセプト: 3層マッチング

```
ユーザー: "○○して"
    ↓
┌─ Layer 1: 完全一致 ─────────────────────────────┐
│  toolSchemaのnameまたはdescriptionに直接対応      │
│  例: "見積書作って" → estimate.create             │
│  → そのまま実行。信頼度: 高                       │
└─────────────────────────────────────────────────┘
    ↓ 一致なし
┌─ Layer 2: 応用マッチ ───────────────────────────┐
│  既存ツールのスキーマを転用して対応可能           │
│  例: "納品書作って" → estimate.createを応用       │
│  → 応用である旨を明示して実行。信頼度: 中         │
│  → 欲望DBにも記録（専用ツール化の優先度データ）   │
└─────────────────────────────────────────────────┘
    ↓ 応用も不可
┌─ Layer 3: 欲望データベース ─────────────────────┐
│  "まだ対応していない作業です。ご要望として記録    │
│   しました。FujiTraceチームが対応を検討します。"  │
│  → feature_requests テーブルに保存               │
└─────────────────────────────────────────────────┘
```

---

## 3. Backend 実装仕様

### 3.1 新規ファイル構成

```
src/
  agent/
    clerk.ts              ← AI事務員のコアロジック（エントリーポイント）
    system-prompt.ts       ← システムプロンプト生成
    tool-matcher.ts        ← 3層マッチングロジック
    desire-db.ts           ← 欲望データベース操作
  routes/
    agent/
      chat.ts              ← POST /api/agent/chat エンドポイント
  prompts/
    agent/
      system.md            ← AI事務員システムプロンプト
migrations/
  0XX_add_agent_tables.ts  ← agent_conversations + feature_requests テーブル
```

### 3.2 データベーススキーマ

#### `agent_conversations` テーブル

| column | type | note |
|--------|------|------|
| id | string (UUID) | PK |
| workspace_id | string | INDEX, NOT NULL |
| messages | text (JSON) | 会話履歴全体 |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `feature_requests` テーブル（欲望データベース）

| column | type | note |
|--------|------|------|
| id | string (UUID) | PK |
| workspace_id | string | INDEX, NOT NULL |
| user_message | text | ユーザーの原文 |
| matched_tool | string, nullable | 応用マッチ時の元ツール名 |
| match_type | string | 'exact' / 'adapted' / 'none' |
| created_at | timestamp | |

### 3.3 POST /api/agent/chat エンドポイント

```typescript
// リクエスト
{
  conversation_id?: string;     // 既存会話の継続時
  message: string;              // ユーザーの自然言語入力
}

// レスポンス
{
  success: true,
  data: {
    conversation_id: string;
    reply: string;              // AI事務員の応答テキスト
    tool_call?: {
      tool_name: string;        // 呼び出したツール名
      match_type: 'exact' | 'adapted';  // 一致種別
      adapted_from?: string;    // 応用元ツール名（adapted時のみ）
      result: unknown;          // ツールの実行結果
    };
    feature_request_logged?: boolean;  // 欲望DBに記録したか
    trace_id?: string;          // Layer 2 トレースID
  }
}
```

### 3.4 システムプロンプト設計 (`src/prompts/agent/system.md`)

```markdown
あなたは「FujiTrace AI 事務員」です。日本企業の事務作業を代行する専門の事務員として振る舞います。

## あなたの役割
- ユーザーから事務作業の依頼を受け、利用可能なツールを使って作業を完了します
- 事務作業に関する質問には丁寧に回答します
- 事務作業以外の依頼（雑談、プログラミング、翻訳等）には対応しません

## ツール選択ルール

### 完全一致
利用可能なツールの中に、依頼内容と直接対応するものがある場合、そのツールを呼び出してください。

### 応用マッチ
完全一致するツールがない場合でも、既存ツールのスキーマを応用して対応できるか判断してください。
応用可能と判断した場合:
1. 「{tool_name}ツールを応用して対応します。専用ツールではないため、結果を必ずご確認ください。」と伝える
2. ツールを呼び出す際、パラメータを依頼内容に合わせて調整する
3. responsibilityLevel が high のツールを応用する場合は、実行前に必ずユーザーの確認を取る

応用の判断基準:
- 入出力のデータ構造が類似している（例: 見積書と納品書は明細・金額・宛先の構造が共通）
- ツールの検証ロジックが転用可能（例: 見積書チェックの算術検証は請求書にも適用可能）
- 業務フローとして隣接している（例: 見積書→発注書→納品書→請求書の流れ）

応用してはいけないケース:
- データ構造が根本的に異なる（例: 見積書ツールで議事録を作る）
- responsibilityLevel が異なる方向への応用（low のツールを high の用途に応用しない）

### 対応不可
応用もできない場合:
- 「この作業にはまだ対応していません。ご要望として記録しましたので、FujiTraceチームが対応を検討します。」と伝える
- 可能であれば代替案を提示する

## 利用可能なツール
{available_tools}

## 制約
- 金銭に関わる操作（PDF出力、送信、保存）は必ずユーザーの承認を得てから実行すること
- 金銭操作では2回の確認を要求すること（「本当によろしいですか？」）
- 事務作業以外のリクエストには「事務作業に関するご依頼をお願いします」と回答すること
- 不確実な情報を断定的に述べないこと
- 応答は簡潔に、ビジネス文書のトーンで
```

### 3.5 tool-matcher.ts の実装方針

```typescript
import { allToolSchemas } from '../../tools/index.js';
import type { ToolSchema } from '../../tools/types.js';

export interface MatchResult {
  type: 'exact' | 'adapted' | 'none';
  tool?: ToolSchema;
  adaptedFrom?: string;
  confidence: number;       // 0.0 - 1.0
  adaptationNote?: string;  // 応用時のユーザー向け説明
}

/**
 * LLM function calling で使う tools 配列を生成する。
 * allToolSchemas から OpenAI function calling 形式に変換。
 *
 * ポイント: LLM 自体が「どのツールを呼ぶか」「応用できるか」を判断する。
 * tool-matcher はLLMの判断結果を構造化するレイヤー。
 *
 * LLMに渡す tools には以下を含める:
 * 1. 全登録ツール（そのまま function calling の tools として）
 * 2. 特殊関数 `_log_feature_request` — 対応不可時にLLMが呼ぶ
 * 3. 特殊関数 `_adapt_tool` — 応用マッチ時にLLMが呼ぶ
 */
```

### 3.6 clerk.ts のコアフロー

```
1. ユーザーメッセージ受信
2. 会話履歴を取得（or 新規作成）
3. システムプロンプト生成（available_tools を動的注入）
4. LLM に会話履歴 + システムプロンプト + tools（function calling）を送信
5. LLM のレスポンスを解析:
   a. tool_call あり → 該当ツールの HTTP エンドポイントを fastify.inject で呼び出し
   b. _adapt_tool 呼び出し → 応用元ツールを実行 + 応用フラグ付与
   c. _log_feature_request → 欲望DBに記録
   d. テキストのみ → そのまま応答
6. ツール実行結果をLLMに返し、ユーザー向け応答を生成
7. 会話履歴を更新
8. Layer 2 トレースとして全操作を記録
9. 欲望DBへの記録（adapted / none の場合）
```

### 3.7 LLM function calling 定義

```typescript
// allToolSchemas から自動生成する関数定義
function toolSchemaToFunction(schema: ToolSchema) {
  return {
    type: 'function',
    function: {
      name: schema.name.replace('.', '_'),  // estimate.create → estimate_create
      description: schema.description,
      parameters: schema.inputSchema,
    },
  };
}

// 特殊関数: 応用マッチ
const adaptToolFunction = {
  type: 'function',
  function: {
    name: '_adapt_tool',
    description: '完全一致するツールがないが、既存ツールを応用して対応できる場合に呼び出す。応用元のツールを指定し、パラメータを調整して実行する。',
    parameters: {
      type: 'object',
      properties: {
        base_tool: { type: 'string', description: '応用元のツール名（例: estimate_create）' },
        adaptation_reason: { type: 'string', description: '応用する理由の説明（ユーザーに表示）' },
        adapted_params: { type: 'object', description: '調整後のパラメータ' },
      },
      required: ['base_tool', 'adaptation_reason', 'adapted_params'],
    },
  },
};

// 特殊関数: 欲望DB記録
const logFeatureRequestFunction = {
  type: 'function',
  function: {
    name: '_log_feature_request',
    description: '対応できない作業の要望を記録する。応用も不可能な場合にのみ呼び出す。',
    parameters: {
      type: 'object',
      properties: {
        user_request_summary: { type: 'string', description: '要望の要約' },
        suggested_tool_category: { type: 'string', description: '将来作るべきツールのカテゴリ' },
      },
      required: ['user_request_summary'],
    },
  },
};
```

### 3.8 認証・クォータ

- 認証: 既存の `resolveWorkspaceId()` を流用
- クォータ: AI事務員は **Pro プラン専用機能**。Free プランユーザーがアクセスした場合は「AI事務員はProプランの機能です。個別ツールは引き続きご利用いただけます。」と返す
- 利用記録: `recordUsage()` で `tool_name: 'agent.chat'` として記録

### 3.9 禁止事項（Backend）

- `any` 型の使用は禁止。明示的な型または `unknown` を使用すること
- LLM のレスポンスを未検証のまま返却することは禁止。必ず `parseLlmJson` 等で構造化すること
- ツール実行時の認証情報を LLM のコンテキストに含めることは禁止（Section 7.8.5.1 Requirement 6）
- conversation_id がリクエスト元の workspace_id と一致しない場合は 403 を返すこと
- 1回の会話ターンでのツール呼び出しは最大2回まで（無限ループ防止）

---

## 4. Frontend 実装仕様

### 4.1 新規ファイル構成

```
packages/landing/src/
  components/
    ClerkChat.tsx          ← AI事務員チャットUI（メインコンポーネント）
    ClerkMessage.tsx       ← 個別メッセージコンポーネント
    ClerkToolResult.tsx    ← ツール実行結果の表示コンポーネント
  pages/
    ClerkPage.tsx          ← /tools/clerk ページ
```

### 4.2 ルーティング

- パス: `/tools/clerk`
- LP ヘッダーのメニューに「AI事務員」として追加
- ダッシュボードからもアクセス可能にする（将来）

### 4.3 チャットUI仕様

#### レイアウト

```
┌────────────────────────────────────────────────┐
│  FujiTrace AI 事務員                           │
│  ─────────────────────────────────────────── │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │                                          │ │
│  │  （会話エリア）                            │ │
│  │                                          │ │
│  │  AI: お仕事のご依頼をどうぞ。             │ │
│  │      見積書の作成、請求書のチェックなど、  │ │
│  │      事務作業をお手伝いします。            │ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ ここに入力...                     [送信] │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

#### 初回表示メッセージ

```
お仕事のご依頼をどうぞ。
見積書の作成、請求書のチェックなど、事務作業をお手伝いします。
```

補足: Phase 0 ではサジェスト機能なし。チャット欄1つのみ（戦略 Section 12.13.1 確定済み）。
ただし初回メッセージで「見積書の作成、請求書のチェックなど」と具体例を挙げることで、ユーザーが何を依頼できるかのヒントを自然に提供する。

#### メッセージ表示

- ユーザーメッセージ: 右寄せ、薄い青背景
- AI事務員メッセージ: 左寄せ、白背景 + 左ボーダー（`border-l-2 border-blue-600`）
- ツール実行結果: AI メッセージ内にカード形式で埋め込み
  - 完全一致: カードヘッダー無し（自然に結果を表示）
  - 応用マッチ: カードヘッダーに「{tool_name}ツールを応用」とグレーのラベル表示
  - 欲望DB記録: 「ご要望を記録しました」のインフォメッセージ

#### ツール実行結果の表示

estimate.create の結果が返った場合:
- 見積書プレビューをカード内にコンパクトに表示
- 「PDFダウンロード」ボタン
- 検証結果（FujiTrace品質チェック）をTier表示（既存EstimateToolPage.tsxのロジックを流用）

estimate.check の結果が返った場合:
- 検証結果をTier 1/2/3で表示（既存と同じUI）

#### 応用マッチ時のUI

```
┌──────────────────────────────────────────────┐
│ 見積書作成ツールを応用                  [応用] │
│ ─────────────────────────────────────────── │
│ 納品書は見積書と同じデータ構造のため、       │
│ 見積書作成ツールを応用して作成しました。     │
│ 結果を必ずご確認ください。                   │
│                                              │
│ （結果表示）                                  │
└──────────────────────────────────────────────┘
```

「応用」ラベルは `bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded` のスタイル。

### 4.4 状態管理

```typescript
interface ClerkState {
  conversationId: string | null;
  messages: ClerkMessage[];
  isLoading: boolean;
  error: string | null;
}

interface ClerkMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCall?: {
    toolName: string;
    matchType: 'exact' | 'adapted';
    adaptedFrom?: string;
    result: unknown;
  };
  featureRequestLogged?: boolean;
  timestamp: Date;
}
```

### 4.5 デザイン原則

- 全体のカラーはダッシュボードと統一（白基調 + `#2563eb` アクセント）
- 絵文字は使用禁止（Founder指示: 一気に安っぽくなる）
- フォント: Noto Sans JP
- LINE的シンプルさを意識: 余計な装飾なし、メッセージ中心
- レスポンシブ対応は最低限（PC前提、モバイルは崩れなければ可）

### 4.6 禁止事項（Frontend）

- サジェスト機能、カテゴリ一覧、機能リストの表示は禁止（Section 12.13 確定済み）
- 「132の事務作業に対応」等の数字の露出は禁止
- 「AI」を前面に出すUI表現は禁止（「AI事務員」は製品名として可、「AIが分析しました」等は不可）
- ローディング中に「考え中...」等のAI的表現は使わない。「処理中...」を使用

---

## 5. 実装順序

### Phase 1: Backend コア（Backend Engineer）

1. マイグレーション作成（`agent_conversations` + `feature_requests`）
2. `src/agent/system-prompt.ts` — システムプロンプト生成（allToolSchemas から available_tools を動的構築）
3. `src/agent/tool-matcher.ts` — LLM function calling 定義の生成 + 応用マッチ用特殊関数
4. `src/agent/desire-db.ts` — 欲望データベース CRUD
5. `src/agent/clerk.ts` — コアロジック（会話管理 + LLM呼び出し + ツール実行 + 結果整形）
6. `src/routes/agent/chat.ts` — HTTPエンドポイント（認証 + Pro プランゲート + レート制限）
7. `src/routes/agent/index.ts` — ルーター登録
8. `src/server.ts` にルート追加

### Phase 2: Frontend チャットUI（Frontend Engineer、Phase 1 と並列可能）

1. `ClerkMessage.tsx` — メッセージコンポーネント
2. `ClerkToolResult.tsx` — ツール結果表示（EstimateToolPage.tsx から検証結果UIを抽出・共通化）
3. `ClerkChat.tsx` — チャットUIメイン
4. `ClerkPage.tsx` — ページコンポーネント
5. ルーティング追加（App.tsx）
6. LPヘッダーにメニュー追加

### Phase 3: 結合テスト

1. 完全一致: 「見積書作って」→ estimate.create 実行 → 結果表示
2. 応用マッチ: 「納品書作って」→ estimate.create 応用 → 応用ラベル付き結果表示
3. 対応不可: 「確定申告して」→ 欲望DB記録 → 対応不可メッセージ
4. Pro ゲート: Free プランで拒否される
5. 連続会話: 複数ターンの会話が正常に動作する

---

## 6. 受入基準

### Must（リリースブロッカー）

- [ ] ユーザーが自然言語で事務作業を依頼できる
- [ ] 登録済みツール（estimate.create, estimate.check）が正しく呼び出される
- [ ] 応用マッチが動作し、応用であることがUIで明示される
- [ ] 対応不可時に欲望DBに記録され、ユーザーにフィードバックされる
- [ ] Pro プラン限定。Free プランユーザーには案内メッセージを表示
- [ ] 全操作が Layer 2（FujiTrace Obs）にトレースされる
- [ ] 金銭操作（PDF出力等）は人間承認を要求する
- [ ] 会話履歴が保持される（ページリロードで消えない）
- [ ] responsibilityLevel: high の応用マッチでは実行前にユーザー確認を2回要求する

### Should（初回リリース後に改善）

- [ ] ストリーミングレスポンス（現在はバッチ応答で可）
- [ ] 会話履歴の一覧・削除機能
- [ ] 欲望DBの管理画面（admin向け）
- [ ] 応用マッチの精度チューニング

### Must Not

- [ ] 132項目のリスト表示
- [ ] サジェスト・カテゴリ選択UI
- [ ] Free プランでのエージェント利用
- [ ] LLMコンテキストへの認証情報混入
- [ ] 事務作業以外への応答（雑談・翻訳・コーディング等）

---

## 7. 技術的補足

### LLM モデル選択

- システムプロンプト + function calling: `gpt-4o`（精度重視、応用判断に4o-miniは不十分）
- コスト見積: 1ターン約 ¥5-15（ツール定義が増えるとトークン増）
- 将来: ツール数が10+になったら、事前にカテゴリ分類（軽量モデル）→ 該当カテゴリのツールのみ4oに渡す2段階方式を検討

### ToolSchema 拡張

現在の `ToolSchema` に `responsibilityLevel` フィールドを追加する:

```typescript
export interface ToolSchema<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  version: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  cost?: ToolCostEstimate;
  responsibilityLevel: 'high' | 'medium' | 'low';  // 追加
}
```

estimate ツールは両方とも `responsibilityLevel: 'high'` を設定。

### 既存コードとの関係

- `src/routes/tools/` — 変更なし。エージェントは `fastify.inject()` 経由で既存エンドポイントを呼ぶ
- `src/tools/` — `ToolSchema` に `responsibilityLevel` 追加のみ
- `packages/landing/src/components/EstimateToolPage.tsx` — 変更なし。検証結果UIのコンポーネントを抽出して共通化する際にリファクタリングする可能性あり

### vercel.json リライト

```json
{ "source": "/tools/clerk", "destination": "/index.html" }
```

既存のSPAリライトパターンに追加。
