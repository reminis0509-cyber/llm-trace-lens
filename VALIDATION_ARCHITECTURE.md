# 検証システム アーキテクチャ解説

このドキュメントでは、fujitrace の検証（Validation）システムについて解説します。

**最終更新**: 2026年2月23日（v0.5.3）

---

## 1. 全体像

```
┌─────────────────────────────────────────────────────────────────────┐
│                         リクエスト処理                               │
│  HTTPリクエスト → APIキー認証 → Workspace解決 → LLM呼び出し         │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ValidationEngine                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │ ConfidenceValidator│  │   RiskScanner   │  │    RiskScorer      │  │
│  │   (信頼度検証)   │  │  (PII検出)      │  │  (リスク採点)      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   PatternEvaluationEngine                            │
│  ┌───────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────────┐  │
│  │  Toxicity │  │PromptInjection│  │  Refusal  │  │LanguageMismatch│  │
│  │  (毒性)   │  │(インジェクション)│  │(回答拒否) │  │ (言語不一致)  │  │
│  └───────────┘  └──────────────┘  └───────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  総合判定: PASS → WARN → FAIL → BLOCK                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 検証レベルの定義

| レベル | 意味 | 動作 |
|--------|------|------|
| **PASS** | 問題なし | そのまま返却 |
| **WARN** | 軽微な問題あり | 警告付きで返却 + Webhook通知 |
| **FAIL** | 重大な問題あり | エラー返却 |
| **BLOCK** | 即座にブロック | 応答を返さない + Webhook通知 |

---

## 3. 検証コンポーネント詳細

### 3.1 ConfidenceValidator（信頼度検証）

**ファイル**: `src/validation/confidence.ts`

LLM応答の信頼度を検証し、矛盾や不整合を検出します。

#### チェック項目

| チェック内容 | 条件 | 結果 |
|------------|------|------|
| 高信頼度 + エビデンス不足 | confidence ≥ 90% かつ evidence < 2個 | WARN |
| 低信頼度 | confidence < 50% | WARN |
| 信頼度の乖離 | 外部信頼度と内部トレースの差 > 0.3 | WARN |

#### 実装例

```typescript
// 高信頼度なのにエビデンスが薄い場合
if (response.confidence >= 90 && response.evidence.length < 2) {
  issues.push(`High confidence (${response.confidence}%) with insufficient evidence`);
  status = 'WARN';
}
```

**なぜ必要か**: LLMが根拠なく高い信頼度を返すケース（ハルシネーション）を検出するため。

---

### 3.2 RiskScanner（PII検出）

**ファイル**: `src/validation/risk.ts`

応答内の個人情報（PII）やAPIキーなどの機密情報を検出します。

#### 検出パターン一覧

##### BLOCK対象（即座にブロック）

| パターン | 正規表現 | 例 |
|---------|---------|-----|
| SSN（米国社会保障番号） | `\d{3}-\d{2}-\d{4}` | 123-45-6789 |
| クレジットカード番号 | `\d{16}` | 1234567890123456 |
| OpenAI APIキー | `sk-[a-zA-Z0-9]{32,}` | sk-abc123... |
| AWS Access Key | `AKIA[A-Z0-9]{16}` | AKIAIOSFODNN7EXAMPLE |
| マイナンバー（コンテキスト付き） | `マイナンバー.*\d{4}[\s-]?\d{4}[\s-]?\d{4}` | マイナンバー: 1234-5678-9012 |
| 銀行口座（コンテキスト付き） | `口座番号.*\d{7,8}` | 口座番号: 1234567 |

##### WARN対象（警告のみ）

| パターン | 正規表現 | 例 |
|---------|---------|-----|
| メールアドレス | 標準的なemail形式 | user@example.com |
| 電話番号（日本） | `0\d{1,4}-\d{1,4}-\d{4}` | 03-1234-5678 |
| 携帯番号（日本） | `0[789]0-\d{4}-\d{4}` | 090-1234-5678 |
| 郵便番号（日本） | `\d{3}-\d{4}` | 100-0001 |
| 法人番号 | `\d{13}` | 1234567890123 |

#### カスタムパターン

ワークスペースごとに独自の検出パターンを追加可能です。

```
POST /custom-rules
{
  "pattern": "社員番号[：:]\s*\d{6}"
}
```

---

### 3.3 RiskScorer（リスク採点）

**ファイル**: `src/validation/scoring.ts`

複数の要素を加重平均してリスクスコア（0-100）を算出します。

#### リスクファクター

| ファクター | 説明 | デフォルト重み |
|-----------|------|---------------|
| confidence | LLMの信頼度（低いほど高リスク） | 40% |
| evidenceCount | エビデンス数（少ないほど高リスク） | 30% |
| hasPII | PII検出フラグ | 20% |
| hasHistoricalViolations | 過去の違反履歴 | 10% |

#### スコア計算ロジック

```
confidenceScore = 100 - confidence  // 信頼度が低いほど高スコア
evidenceScore = max(0, 100 - evidenceCount × 20)  // 5個で0になる
piiScore = hasPII ? 100 : 0
historicalScore = hasViolations ? 100 : 0

totalScore = confidenceScore × 0.4
           + evidenceScore × 0.3
           + piiScore × 0.2
           + historicalScore × 0.1
```

#### リスクレベル判定

| スコア範囲 | リスクレベル |
|-----------|-------------|
| 70以上 | HIGH |
| 40〜69 | MEDIUM |
| 39以下 | LOW |

---

### 3.4 PatternEvaluationEngine（パターンベース評価）

**ファイル**: `src/evaluation/runner.ts`

LLMの入出力をパターンマッチベースで評価し、問題を即座に検出します。
LLM-as-Judge（Phase 2）の前段階として、軽量・高速な評価を提供します。

#### 評価指標

| 指標 | 対象 | 説明 | スコア |
|------|------|------|--------|
| **Toxicity** | 出力 | 暴力・ヘイト・差別表現の検出（日英対応） | 0.0〜1.0 |
| **Prompt Injection** | 入力 | システムプロンプト上書き・jailbreak試行 | 0.0〜1.0 |
| **Failure to Answer** | 出力 | 回答拒否パターンの検出 | フラグのみ |
| **Language Mismatch** | 入出力 | 入力言語と出力言語の不一致 | フラグのみ |

#### Toxicity検出パターン（抜粋）

**英語:**
```
- kill (you|him|her|them)
- (hate|despise) (all|every)
- racial slurs
- violent threats
```

**日本語:**
```
- 死ね|殺す|消えろ
- クズ|バカ|アホ
- 差別的表現
```

#### Prompt Injection検出パターン（抜粋）

```
- ignore (all|previous|above) instructions
- disregard (your|the) (rules|guidelines)
- (enable|activate) DAN mode
- これまでの指示を無視
- システムプロンプトを出力
```

#### 言語検出

**ファイル**: `src/utils/language.ts`

francライブラリを使用した言語検出に加え、高速な文字ベース判定を実装。

```typescript
// 日本語の高速判定（ひらがな・カタカナ・漢字）
if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
  return 'ja';
}

// 韓国語の高速判定（ハングル）
if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) {
  return 'ko';
}
```

#### 設定オプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `enableToxicity` | 毒性検出の有効化 | true |
| `enablePromptInjection` | インジェクション検出の有効化 | true |
| `enableFailureToAnswer` | 回答拒否検出の有効化 | true |
| `enableLanguageMismatch` | 言語不一致検出の有効化 | true |

#### 環境変数

```bash
EVALUATION_SAMPLING_RATE=1.0   # サンプリング率（0.0〜1.0）
EVALUATION_TIMEOUT_MS=5000     # タイムアウト（ミリ秒）
```

---

## 4. セキュリティコンポーネント

### 4.1 Secret Manager（シークレット管理）

**ファイル**: `src/security/secret-manager.ts`

顧客のLLM APIキーを暗号化して安全に管理します。

#### セキュリティ機能

| 機能 | 説明 |
|------|------|
| **AES-256-GCM暗号化** | 業界標準の暗号化アルゴリズム |
| **アクセスログ** | 全操作（CREATE/READ/UPDATE/DELETE/ROTATE）を記録 |
| **キーローテーション** | 90日間隔の自動ローテーション提案 |
| **担当者制限** | 認可されたユーザーのみがアクセス可能 |
| **有効期限管理** | シークレットの自動失効 |

#### 暗号化パラメータ

```
アルゴリズム: AES-256-GCM
キー長: 32バイト（256ビット）
IV長: 16バイト（128ビット）
タグ長: 16バイト（128ビット）
```

#### 使用例

```typescript
// シークレット保存
await storeSecret({
  key: 'openai_key',
  value: 'sk-xxx...',
  provider: 'openai',
  workspaceId: 'ws_123',
  performedBy: 'admin@example.com',
  rotationIntervalDays: 90
});

// シークレット取得（復号）
const { value } = await retrieveSecret({
  provider: 'openai',
  workspaceId: 'ws_123',
  performedBy: 'admin@example.com'
});

// シークレットローテーション
await rotateSecret({
  provider: 'openai',
  workspaceId: 'ws_123',
  newValue: 'sk-new...',
  performedBy: 'admin@example.com'
});
```

#### 環境変数

```bash
# 32バイトのBase64エンコードキー
SECRET_ENCRYPTION_KEY=base64_encoded_32_byte_key
```

---

### 4.2 Workspace Resolver（ワークスペース解決）

**ファイル**: `src/services/workspace-resolver.ts`

APIキーからワークスペースを高速に特定するサービスです。

#### 機能

| 機能 | 説明 |
|------|------|
| **ハッシュ検索** | SHA-256によるAPIキーのセキュアな検索 |
| **インメモリキャッシュ** | 5分間のキャッシュ（設定可能） |
| **アクセスログ** | 30日間保持 |
| **期限管理** | APIキーの有効期限・失効管理 |
| **定期クリーンアップ** | 5分ごとの期限切れエントリ削除 |

#### キャッシュ構造

```typescript
interface CacheEntry {
  data: WorkspaceInfo;
  expiresAt: number;  // Unix timestamp
}

// キャッシュキー: SHA-256(apiKey)
// キャッシュ値: { workspaceId, customerId, providers[] }
```

#### 使用例

```typescript
// APIキーからワークスペース情報を取得
const workspace = await getWorkspaceByApiKey('ltl_xxx...');
// => { workspaceId: 'ws_123', customerId: 'cust_456', providers: ['openai'] }

// APIキーマッピングを登録
await registerApiKeyMapping({
  apiKey: 'ltl_xxx...',
  workspaceId: 'ws_123',
  customerId: 'cust_456',
  provider: 'openai',
  expiryDays: 90
});

// 期限切れ間近のAPIキーを取得
const expiring = await getExpiringApiKeys(7); // 7日以内
```

#### 環境変数

```bash
API_KEY_CACHE_TTL=300          # キャッシュ有効期限（秒）
API_KEY_EXPIRY_DAYS=90         # APIキー有効期限（日）
ENABLE_API_KEY_CACHE=true      # キャッシュ有効化
```

---

## 5. 処理フロー

```
1. HTTPリクエスト受信
       │
2. API Key認証
   └── WorkspaceResolver.getWorkspaceByApiKey()
       ├── キャッシュヒット → 即時返却
       └── キャッシュミス → KV検索 → キャッシュ保存
       │
3. APIキー取得
   └── SecretManager.retrieveSecret()
       ├── 認可チェック
       └── AES-256-GCM復号
       │
4. LLM Enforcer実行（OpenAI/Anthropic/Gemini）
       │
5. StructuredResponse取得
       │
6. 検証実行（並列処理）
   ├── ConfidenceValidator.validate()
   ├── RiskScanner.scan()
   └── RiskScorer.calculateRiskScore()
       │
7. パターンベース評価（Fire-and-forget）
   ├── Toxicity検出
   ├── Prompt Injection検出
   ├── Failure to Answer検出
   └── Language Mismatch検出
       │
8. 総合判定
   └── overall = max(各ルールの結果)
       │
9. BLOCK/WARN の場合 → Webhook通知
       │
10. トレース保存（KV/PostgreSQL）
    └── 評価結果も含めて保存
       │
11. サニタイズしたレスポンスを返却
```

---

## 6. 設定のカスタマイズ

### 6.1 スコアリング重みの変更

```
PUT /admin/thresholds/{workspaceId}
{
  "configType": "scoring_weights",
  "configData": {
    "confidenceWeight": 0.5,  // 信頼度をより重視
    "evidenceWeight": 0.2,
    "piiWeight": 0.2,
    "historicalWeight": 0.1
  }
}
```

**制約**: 重みの合計は必ず 1.0 になること

### 6.2 リスクレベルスレッショルドの変更

```
PUT /admin/thresholds/{workspaceId}
{
  "configType": "risk_levels",
  "configData": {
    "highRiskMin": 80,     // より厳しく
    "mediumRiskMin": 50,
    "lowRiskMax": 49
  }
}
```

**制約**: `highRiskMin > mediumRiskMin > lowRiskMax`

---

## 7. セキュリティ設計

### 7.1 Threshold Blackboxing

クライアントへの応答では、内部のスレッショルド値を隠蔽します。

**返却されるデータ**:
```json
{
  "riskScore": 65,
  "riskLevel": "medium",
  "explanation": "中程度のリスクです",
  "passed": true
}
```

**返却されないデータ**:
- 内部の信頼度スレッショルド値
- 重み付け係数
- 詳細な検出パターン

### 7.2 PII マスキング

検出されたPII値はログに残す際にマスキングされます。

```
検出: 12**********12  (実際: 123456789012)
```

### 7.3 Admin API 保護

管理APIは Bearer トークンで保護されています。

```
Authorization: Bearer {ADMIN_API_KEY}
```

---

## 8. ファイル構成

```
src/validation/
├── engine.ts          # メインエンジン（ルール管理・並列実行）
├── confidence.ts      # 信頼度検証
├── risk.ts            # PII/機密情報スキャナ + パターンスキャン
├── scoring.ts         # リスク採点エンジン
└── rules/
    ├── confidence.ts  # 信頼度ルール実装
    └── risk.ts        # リスクルール実装

src/evaluation/
├── index.ts           # 評価エンジン（LLM-as-Judge）
├── runner.ts          # パターンベース評価ランナー [NEW]
├── prompts.ts         # LLM-as-Judge用プロンプト
└── types.ts           # 評価結果型定義

src/security/
└── secret-manager.ts  # 暗号化シークレット管理 [NEW]

src/services/
└── workspace-resolver.ts  # APIキー→ワークスペース解決 [NEW]

src/utils/
└── language.ts        # 言語検出ユーティリティ [NEW]

src/routes/
├── custom-rules.ts    # カスタムパターン管理API
└── admin.ts           # 管理者API（スレッショルド設定）

src/kv/
└── client.ts          # KVストレージ（設定永続化）
```

---

## 9. テスト

### テストファイル

```
src/tests/validation/
├── confidence.test.ts      # 信頼度検証テスト (5)
├── risk.test.ts            # リスク検出テスト (6)
├── japanese-pii.test.ts    # 日本語PII検出テスト (16)
├── scoring.test.ts         # スコアリングテスト (13)
└── custom-patterns.test.ts # カスタムパターンテスト (11)

src/tests/evaluation/
├── faithfulness.test.ts    # LLM-as-Judge評価テスト (8)
└── runner.test.ts          # パターンベース評価テスト (26) [NEW]
```

### テスト実行

```bash
npm test

# 評価関連のみ
npm test -- --grep "evaluation"

# 検証関連のみ
npm test -- --grep "validation"
```

---

## 10. よくある質問

### Q: なぜZodを使わないのか？

A: このプロジェクトでは、LLM応答の**内容検証**（PII検出、信頼度チェック）が主目的です。
Zodはスキーマ検証（型チェック）に適していますが、正規表現ベースのコンテンツスキャンや
複数ファクターの重み付け計算には、カスタム実装の方が柔軟性があります。

### Q: カスタムパターンはどこに保存される？

A: Vercel KV（Redis互換）の Set データ構造に保存されます。
キー形式: `workspace:{workspaceId}:custom_patterns`

### Q: 検証ルールを追加するには？

A: `ValidationRule` インターフェースを実装したクラスを作成し、
`ValidationEngine` のコンストラクタに渡します。

```typescript
class MyCustomRule implements ValidationRule {
  name = 'my-custom-rule';

  async validate(response, trace): Promise<RuleResult> {
    // 検証ロジック
  }
}

const engine = new ValidationEngine([
  new ConfidenceValidator(),
  new RiskScanner(),
  new MyCustomRule(),  // 追加
]);
```

### Q: パターンベース評価とLLM-as-Judgeの違いは？

A:

| 項目 | パターンベース評価 | LLM-as-Judge |
|------|-------------------|--------------|
| 実行速度 | 高速（ミリ秒単位） | 低速（秒単位） |
| コスト | 無料 | LLM API課金 |
| 精度 | 既知パターンのみ検出 | 文脈理解による高精度検出 |
| 用途 | 即座のリスク検出 | 詳細な品質評価 |

現在はPhase 1としてパターンベース評価を実装。Phase 2でLLM-as-Judgeを追加予定。

### Q: Secret Managerの暗号化キーはどう生成する？

A: 32バイト（256ビット）のランダムキーをBase64エンコードします。

```bash
# Node.jsで生成
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# OpenSSLで生成
openssl rand -base64 32
```

生成したキーを `SECRET_ENCRYPTION_KEY` 環境変数に設定してください。

### Q: APIキーキャッシュを無効化するには？

A: 環境変数で無効化できます。

```bash
ENABLE_API_KEY_CACHE=false
```

無効化すると、リクエストごとにKVストレージを参照します。
開発時のデバッグや、即座にAPIキー無効化を反映したい場合に有効です。

---

## 11. 関連ドキュメント

- [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md) - 設計思想
- [README.md](./README.md) - プロジェクト概要
- [REPORT.md](./REPORT.md) - 実装状況レポート
