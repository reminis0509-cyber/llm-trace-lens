# メタプロンプト: AI見積書作成＆チェック

> 作成日: 2026-04-07
> 対象: FujiTrace AI Tools 第1弾
> 関連: `実行計画_FujiTraceAITools.md`, `戦略_2026.md` Section 7.5

このドキュメントは、開発エージェント（backend-engineer, frontend-engineer）に対する実装指示書兼プロンプト集。

---

## 1. 開発タスク概要（backend/frontend engineerへ）

### 1.1 ゴール

FujiTrace AI Tools プラットフォームの第1弾として「AI見積書作成＆チェック」ツールを実装する。ユーザーがAIと対話するだけで、計算ミス・過小見積り・インボイス制度対応の検証が済んだ見積書PDFを出力できる。

### 1.2 作成するファイル・ディレクトリ

```
packages/landing/src/pages/tools/
  ├── index.tsx                    # /tools プラットフォームトップ
  └── estimate/
      ├── index.tsx                # /tools/estimate 見積書ツール
      ├── ChatInput.tsx            # AIとの対話UI
      ├── EstimatePreview.tsx      # 生成結果プレビュー
      └── CheckResult.tsx          # AIチェック結果表示

src/routes/tools/
  ├── estimate-create.ts           # POST /api/tools/estimate/create
  ├── estimate-check.ts            # POST /api/tools/estimate/check
  └── estimate-pdf.ts              # POST /api/tools/estimate/pdf

src/prompts/tools/estimate/
  ├── create.md                    # 生成プロンプト（本ファイルのセクション3）
  └── check.md                     # チェックプロンプト（本ファイルのセクション4）

migrations/
  └── 010_add_ai_tools_usage.ts    # 利用履歴テーブル
```

### 1.3 共通制約

- TypeScript strict mode、`any` 型は禁止
- 全LLM呼び出しは既存のLLMプロキシ経由で行うこと（FujiTrace自動トレース対象化）
- 認証は既存のSupabase認証を再利用（ログイン済みユーザーのみアクセス可）
- 無料枠: Freeプランは月10件まで、Proは無制限
- レート制限: 1ユーザーあたり10 req/hour
- エラー時は日本語のユーザーフレンドリーなメッセージを返す

---

## 2. ユーザーフロー詳細

```
[Step 1] 事業情報の初期入力（初回のみ）
  - 会社名/屋号
  - 住所、電話番号
  - インボイス番号（T+13桁）
  - 振込先（銀行名、支店名、口座種別、口座番号、名義）
  → Supabase の user_business_info テーブルに保存

[Step 2] 見積内容をAIに伝える（チャット形式）
  AIからの質問順序:
  1. 「どんなお仕事の見積もりですか？業種と概要を教えてください」
  2. 「具体的な作業項目を教えてください（複数可）」
  3. 「各項目の単価と数量を教えてください」
  4. 「納期・有効期限はいつごろですか？」
  5. 「宛先（発注元の会社名・担当者名）を教えてください」
  6. 「その他、特記事項があれば教えてください」

[Step 3] AIが見積書ドラフト生成
  - 項目、数量、単価、小計
  - 消費税（10%/8%の判定含む）
  - 合計金額
  - 有効期限、納期、支払条件
  - 事業情報（Step 1で入力済）
  - インボイス番号記載

[Step 4] AI自己チェック（自動実行）
  - 計算ミス検出
  - 過小見積り警告（業界相場と比較）
  - 消費税計算の整合性
  - 必須項目欠落チェック
  - インボイス制度対応チェック
  - チェック結果を画面上に明示

[Step 5] ユーザーが確認・微調整

[Step 6] PDF出力 or 見積書テキストコピー
```

---

## 3. 生成プロンプト（create.md）

以下を `src/prompts/tools/estimate/create.md` に保存する。

```markdown
# AI見積書作成プロンプト

あなたは日本の中小企業・フリーランス向けの見積書作成アシスタントです。

## 役割
ユーザーとの対話から情報を抽出し、日本の商習慣に沿った正確な見積書データを生成してください。

## 入力情報
- 事業情報: {business_info_json}
- 対話履歴: {conversation_history}
- 今日の日付: {today}

## 出力形式
以下のJSON形式で出力してください:

```json
{
  "estimate_number": "見積番号（YYYYMMDD-NNN形式）",
  "issue_date": "発行日（YYYY-MM-DD）",
  "valid_until": "有効期限（YYYY-MM-DD）",
  "client": {
    "company_name": "宛先会社名",
    "contact_person": "担当者名",
    "honorific": "御中 or 様"
  },
  "subject": "件名（例: ○○システム開発の件）",
  "items": [
    {
      "name": "項目名",
      "description": "詳細説明",
      "quantity": 1,
      "unit": "式 or 時間 or 個",
      "unit_price": 100000,
      "tax_rate": 10,
      "subtotal": 100000
    }
  ],
  "subtotal": 100000,
  "tax_amount": 10000,
  "total": 110000,
  "delivery_date": "納期",
  "payment_terms": "支払条件（例: 納品後30日以内）",
  "notes": "特記事項"
}
```

## 生成ルール
1. 金額は全て整数（円単位）
2. 消費税は原則10%、軽減税率対象（飲食料品等）のみ8%
3. インボイス制度に対応（事業者登録番号を必ず含める）
4. 有効期限は発行日から30日後をデフォルト
5. 件名は具体的で分かりやすく
6. 特記事項には支払条件・納品方法等を明記

## 禁止事項
- 不明な情報を勝手に補完しない（ユーザーに質問し直す）
- 消費税の計算を間違えない
- 振込先情報を捏造しない（Step 1の入力情報のみ使用）
```

---

## 4. チェックプロンプト（check.md）

以下を `src/prompts/tools/estimate/check.md` に保存する。

```markdown
# AI見積書チェックプロンプト

あなたは日本の商習慣・税法・インボイス制度に精通した見積書レビュー専門家です。

## 役割
生成された見積書データを厳密にレビューし、問題点を日本語で明示的に指摘してください。

## 入力情報
- 見積書データ: {estimate_json}
- 業種: {industry}
- 相場データ: {market_rate_data}

## チェック項目

### 必須チェック（Critical）
1. **計算の整合性**
   - 各項目の subtotal = quantity × unit_price
   - 全体の subtotal = Σ items[].subtotal
   - tax_amount の計算（税率別に集計）
   - total = subtotal + tax_amount

2. **必須項目の欠落**
   - 見積番号、発行日、有効期限
   - 宛先（会社名・敬称）
   - 事業者情報（名称・住所・連絡先）
   - **インボイス番号（T+13桁）**
   - 支払条件

3. **インボイス制度対応**
   - インボイス番号の記載有無
   - インボイス番号の形式（T+数字13桁）
   - 税率ごとの区分記載
   - 税率ごとの消費税額記載

### 警告チェック（Warning）
4. **過小/過大見積り**
   - 業種の相場データと比較
   - ±30%を超える乖離があれば警告

5. **消費税率の妥当性**
   - 軽減税率（8%）と標準税率（10%）の使い分けが妥当か

6. **敬称・宛先**
   - 「御中」は会社宛、「様」は個人宛
   - 表記ゆれがないか

7. **特記事項の充実度**
   - 支払条件、納品方法、保証期間等の記載

## 出力形式

```json
{
  "status": "ok" | "warning" | "error",
  "critical_issues": [
    {
      "field": "tax_amount",
      "severity": "error",
      "message": "消費税計算が合いません。期待値: 10,000円, 実際: 9,800円"
    }
  ],
  "warnings": [
    {
      "field": "items[0].unit_price",
      "severity": "warning",
      "message": "業界相場（5万円/日）より40%低い単価です。過小見積りの可能性があります"
    }
  ],
  "suggestions": [
    "支払条件をより明確にすることを推奨します（例: 納品後30日以内の銀行振込）"
  ],
  "responsibility_notice": "この見積書を送付する前に、金額・宛先・インボイス番号を必ず再確認してください。誤った見積書は赤字受注や信用失墜の原因となります。"
}
```

## 振る舞いルール
1. **曖昧さを許さない** — 疑わしい箇所は必ず指摘する
2. **具体的に指摘する** — 「○○が△△になっている」と明示
3. **責任を促す** — 「送付前に再確認してください」を必ず含める
4. **日本語で丁寧に** — ユーザーが理解しやすい言葉で
```

---

## 5. API設計

### 5.1 POST /api/tools/estimate/create

**Request:**
```typescript
{
  conversation_history: Array<{ role: 'user' | 'assistant', content: string }>;
  business_info_id: string;
}
```

**Response:**
```typescript
{
  estimate: EstimateData; // セクション3のJSONスキーマ
  next_question?: string; // 情報不足時の次の質問
  trace_id: string;       // FujiTraceトレースID
}
```

### 5.2 POST /api/tools/estimate/check

**Request:**
```typescript
{
  estimate: EstimateData;
  industry?: string;
}
```

**Response:**
```typescript
{
  check_result: CheckResult; // セクション4のJSONスキーマ
  trace_id: string;
}
```

### 5.3 POST /api/tools/estimate/pdf

**Request:**
```typescript
{
  estimate: EstimateData;
  template?: 'standard' | 'simple' | 'formal';
}
```

**Response:** PDFバイナリ（application/pdf）

---

## 6. データベーススキーマ

### 6.1 user_business_info テーブル

```sql
CREATE TABLE user_business_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  invoice_number TEXT, -- T+13桁
  bank_name TEXT,
  bank_branch TEXT,
  account_type TEXT,
  account_number TEXT,
  account_holder TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 6.2 ai_tools_usage テーブル

```sql
CREATE TABLE ai_tools_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL, -- 'estimate', 'invoice', 'email' 等
  action TEXT NOT NULL,    -- 'create', 'check', 'pdf'
  trace_id TEXT,           -- FujiTraceのトレースID
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_tools_usage_user_created ON ai_tools_usage(user_id, created_at);
```

---

## 7. UI要件

### 7.1 `/tools` プラットフォームトップ

- ヘッダー: 「FujiTrace AI Tools — 責任あるAI利用プラットフォーム」
- ツール一覧カード:
  - AI見積書作成＆チェック（NEW）
  - AI請求書作成＆チェック（Coming Soon）
  - AIビジネスメール作成＆チェック（Coming Soon）
- 料金表示: 「初期費用0円・月額0円・AI利用量に応じた従量課金のみ」
- プラットフォームの説明（ミッション・差別化ポイント）

### 7.2 `/tools/estimate` 見積書ツール

**画面構成（1画面完結）:**

```
┌─────────────────────────────────────────┐
│ FujiTrace AI Tools / AI見積書             │
├─────────────────────────────────────────┤
│                                          │
│  [事業情報]  [新規作成]  [履歴]            │
│                                          │
│  ┌───────────────┬──────────────────┐  │
│  │ チャット       │ プレビュー          │  │
│  │               │                    │  │
│  │ AI: どんなお仕事│ （リアルタイムで     │  │
│  │   の見積もり？  │   見積書が生成       │  │
│  │               │   される）           │  │
│  │ You: 〇〇〇    │                    │  │
│  │               │                    │  │
│  │ AI: ...        │                    │  │
│  │               │                    │  │
│  └───────────────┴──────────────────┘  │
│                                          │
│  [ AIチェック実行 ]  [ PDF出力 ]           │
│                                          │
│  ┌──────────────────────────────────┐  │
│  │ ⚠ AIチェック結果                    │  │
│  │ - 計算の整合性: ✓ OK                │  │
│  │ - インボイス対応: ✓ OK              │  │
│  │ - 相場比較: ⚠ 業界相場より30%低い     │  │
│  └──────────────────────────────────┘  │
│                                          │
└─────────────────────────────────────────┘
```

### 7.3 デザイン原則

- 既存のLP（ライトテーマ、Deep Blue #2563eb）と統一
- フォント: Noto Sans JP
- エモジ禁止（Memory方針）
- モバイル対応必須

---

## 8. QA要件（qa-engineerへ）

### 8.1 必須テストケース

- [ ] 対話から見積書JSONが正しく生成される
- [ ] 計算ミスが検出される
- [ ] インボイス番号欠落が検出される
- [ ] 過小見積りが警告される
- [ ] PDF出力が正しい書式で生成される
- [ ] 無料枠制限が機能する（Freeプラン月10件）
- [ ] レート制限が機能する（1ユーザー10 req/hour）
- [ ] FujiTraceトレースが記録される
- [ ] 未ログインユーザーはアクセスできない

### 8.2 セキュリティチェック

- [ ] 他ユーザーの事業情報にアクセスできない（RLS）
- [ ] プロンプトインジェクション耐性
- [ ] PII（インボイス番号、口座番号）の適切な取扱い
- [ ] XSS対策

---

## 9. 実装の優先順位

```
Week 1 (2026-04-07〜04-13):
  Day 1-2: DB migration + 事業情報CRUD + 認証統合
  Day 3-4: 対話UI + 生成プロンプト実装
  Day 5-6: チェックプロンプト実装 + 結果表示UI
  Day 7:   PDF出力 + /tools トップページ

Week 2 (2026-04-14〜04-20):
  Day 1-2: 自社内テスト・バグ修正
  Day 3-4: QAレビュー・セキュリティ確認
  Day 5:   本番デプロイ
  Day 6-7: X投稿・初期反応観測
```

---

## 10. 成功基準（MVPリリース後2週間）

| 指標 | 目標 |
|-----|------|
| ユーザー登録 | 50件以上 |
| 見積書作成数 | 100件以上 |
| X反応 | 100いいね以上 |
| Critical バグ | 0件 |
| FujiTraceトレース連携成功率 | 100% |

未達の場合の対応は `実行計画_FujiTraceAITools.md` セクション6.2参照。
