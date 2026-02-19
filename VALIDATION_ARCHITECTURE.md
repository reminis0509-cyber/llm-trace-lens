# 検証システム アーキテクチャ解説

このドキュメントでは、llm-trace-lens の検証（Validation）システムについて解説します。

---

## 1. 全体像

```
┌─────────────────────────────────────────────────────────────────────┐
│                         リクエスト処理                               │
│  HTTPリクエスト → LLM呼び出し → StructuredResponse取得              │
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

## 4. 処理フロー

```
1. HTTPリクエスト受信
       │
2. API Key → Workspace ID 特定
       │
3. LLM Enforcer実行（OpenAI/Anthropic/Gemini/DeepSeek）
       │
4. StructuredResponse取得
       │
5. 検証実行（並列処理）
   ├── ConfidenceValidator.validate()
   ├── RiskScanner.scan()
   └── RiskScorer.calculateRiskScore()
       │
6. 総合判定
   └── overall = max(各ルールの結果)
       │
7. BLOCK/WARN の場合 → Webhook通知
       │
8. トレース保存（KVストレージ）
       │
9. サニタイズしたレスポンスを返却
```

---

## 5. 設定のカスタマイズ

### 5.1 スコアリング重みの変更

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

### 5.2 リスクレベルスレッショルドの変更

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

## 6. セキュリティ設計

### 6.1 Threshold Blackboxing

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

### 6.2 PII マスキング

検出されたPII値はログに残す際にマスキングされます。

```
検出: 12**********12  (実際: 123456789012)
```

### 6.3 Admin API 保護

管理APIは Bearer トークンで保護されています。

```
Authorization: Bearer {ADMIN_API_KEY}
```

---

## 7. ファイル構成

```
src/validation/
├── engine.ts          # メインエンジン（ルール管理・並列実行）
├── confidence.ts      # 信頼度検証
├── risk.ts            # PII/機密情報スキャナ
├── scoring.ts         # リスク採点エンジン
└── rules/
    ├── confidence.ts  # 信頼度ルール実装
    └── risk.ts        # リスクルール実装

src/routes/
├── custom-rules.ts    # カスタムパターン管理API
└── admin.ts           # 管理者API（スレッショルド設定）

src/kv/
└── client.ts          # KVストレージ（設定永続化）
```

---

## 8. テスト

### テストファイル

```
src/tests/validation/
├── confidence.test.ts      # 信頼度検証テスト
├── risk.test.ts            # リスク検出テスト
├── japanese-pii.test.ts    # 日本語PII検出テスト
├── scoring.test.ts         # スコアリングテスト
└── custom-patterns.test.ts # カスタムパターンテスト
```

### テスト実行

```bash
npm test
```

---

## 9. よくある質問

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

---

## 10. 関連ドキュメント

- [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md) - 設計思想
- [README.md](./README.md) - プロジェクト概要
