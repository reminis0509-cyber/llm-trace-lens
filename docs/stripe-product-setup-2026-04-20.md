# Stripe Product / Price 設定手順書 (2026-04-20)

対象: Founder (Stripe Dashboard 手動作業)
作成: CFO (Ryo)
前提: Stripe アカウントがライブモード有効、JPY 決済対応済み
所要時間: 約 30-45 分

本書は FujiTrace 5 プラン体系 (Free / Pro / Team / Max / Enterprise) を Stripe Dashboard 上で作成するための完全仕様。コードは Price ID を環境変数から読むため、**Price 作成後に Price ID を `.env` と Vercel に登録** することが最終ステップ。

---

## 0. 前提確認

1. Stripe Dashboard にログイン (https://dashboard.stripe.com)
2. 右上のアカウント名が `FujiTrace (合同会社Reminis)` になっていることを確認
3. 左上トグルで **Live mode (本番)** が選択されていることを確認 (テストモードで作成すると本番で使えない)
4. 左サイドバー `More` → `Tax` で日本の自動税率計算が ON か確認 (OFF なら下記 Tax 設定を手動で適用)

---

## 1. 作成する Products 一覧

Stripe Dashboard `Product catalog` → `+ Add product` で以下 3 つを順に作成する。

| # | Product 名 | Description | 価格プラン |
|---|---|---|---|
| 1 | FujiTrace Pro | AI 社員プラットフォーム Pro プラン / 個人・SOHO 向け | 月額 + 年額 |
| 2 | FujiTrace Team | AI 社員プラットフォーム Team プラン / 5-20 名の中小企業向け | 月額 per seat + 年額 per seat |
| 3 | FujiTrace Max | AI 社員プラットフォーム Max プラン / パワーユーザー向け | 月額 + 年額 |

**Free は Stripe Product 不要** (¥0 のため Subscription なし)。
**Enterprise は Stripe Product 不要** (個別見積 → Stripe Invoice で都度発行 or 営業経由で契約)。

さらに従量課金 (overage) 用 Product を 1 つ、その中に 8 つの Price を作成する (詳細は Section 3)。

---

## 2. 月額 / 年額 Subscription Price 設定

### 2.1 FujiTrace Pro

**Product 作成フォーム:**

| 項目 | 値 |
|---|---|
| Name | `FujiTrace Pro` |
| Description | `AI社員プラットフォーム Pro プラン (個人・SOHO向け)。書類業務5種・LLM-as-Judge 1,000回/月・月間50,000トレース・90日保持。` |
| Image | 任意 (FujiTrace ロゴ 512x512) |
| Statement descriptor | `FUJITRACE PRO` (22 文字以内) |
| Unit label | 空欄 |
| Tax code | `txcd_10103001` (Software as a service (SaaS) - Business use) |

**Pricing (同じ Product に 2 つの Price を追加):**

Price #1 (月額):
- Pricing model: **Standard pricing**
- Price: `3000`
- Currency: `JPY (日本円)`
- Billing period: `Monthly`
- Tax behavior: `Exclusive (税抜)`
- Price description: `FujiTrace Pro 月額`
- Metadata:
  - `plan_type`: `pro`
  - `billing_cycle`: `monthly`

Price #2 (年額・10% 割引):
- Pricing model: **Standard pricing**
- Price: `32400` (¥3,000 × 12 × 0.9 = ¥32,400)
- Currency: `JPY`
- Billing period: `Yearly`
- Tax behavior: `Exclusive`
- Price description: `FujiTrace Pro 年額 (10%割引)`
- Metadata:
  - `plan_type`: `pro`
  - `billing_cycle`: `annual`

**作成後に取得する ID:**
- Product ID → Founder 控え
- Price #1 ID → `STRIPE_PRO_PRICE_ID` に登録
- Price #2 ID → `STRIPE_PRO_ANNUAL_PRICE_ID` に登録 (今 Phase では未使用、将来の年額切替用)

---

### 2.2 FujiTrace Team

**Product 作成フォーム:**

| 項目 | 値 |
|---|---|
| Name | `FujiTrace Team` |
| Description | `AI社員プラットフォーム Team プラン (中小企業5-20名向け)。共有ワークスペース・稟議承認フロー・監査ログ・最低2席。` |
| Statement descriptor | `FUJITRACE TEAM` |
| Tax code | `txcd_10103001` |

**Pricing (per seat):**

Price #1 (月額 per seat):
- Pricing model: **Standard pricing**
- Price: `6000`
- Currency: `JPY`
- Billing period: `Monthly`
- Tax behavior: `Exclusive`
- Price description: `FujiTrace Team 月額 / 席`
- Usage is metered: **OFF** (seat quantity は Checkout で指定、metered ではない)
- Metadata:
  - `plan_type`: `team`
  - `billing_cycle`: `monthly`
  - `per_seat`: `true`
  - `min_seats`: `2`

Price #2 (年額 per seat・10% 割引):
- Price: `64800` (¥6,000 × 12 × 0.9)
- Billing period: `Yearly`
- Price description: `FujiTrace Team 年額 / 席 (10%割引)`
- Metadata:
  - `plan_type`: `team`
  - `billing_cycle`: `annual`
  - `per_seat`: `true`
  - `min_seats`: `2`

**Checkout 側の挙動:**
`POST /api/billing/checkout` で `{ planType: 'team', seats: N }` を受け取り、Stripe Checkout Session の `line_items[0].quantity` に `seats` を設定する (コード実装済み: `src/routes/billing.ts`)。**N < 2 は API バリデーションで拒否**。

**環境変数:**
- Price #1 ID → `STRIPE_TEAM_PRICE_ID`
- Price #2 ID → `STRIPE_TEAM_ANNUAL_PRICE_ID`

---

### 2.3 FujiTrace Max

**Product 作成フォーム:**

| 項目 | 値 |
|---|---|
| Name | `FujiTrace Max` |
| Description | `AI社員プラットフォーム Max プラン (パワーユーザー向け)。全コネクタ・高度な分析・LLM-as-Judge 15,000回/月・365日保持・SLA 99.9%。` |
| Statement descriptor | `FUJITRACE MAX` |
| Tax code | `txcd_10103001` |

**Pricing:**

Price #1 (月額):
- Price: `15000`
- Currency: `JPY`
- Billing period: `Monthly`
- Tax behavior: `Exclusive`
- Metadata:
  - `plan_type`: `max`
  - `billing_cycle`: `monthly`

Price #2 (年額):
- Price: `162000` (¥15,000 × 12 × 0.9)
- Billing period: `Yearly`
- Metadata:
  - `plan_type`: `max`
  - `billing_cycle`: `annual`

**環境変数:**
- Price #1 ID → `STRIPE_MAX_PRICE_ID`
- Price #2 ID → `STRIPE_MAX_ANNUAL_PRICE_ID`

---

## 3. Overage (従量課金) Price 設定

**Product: `FujiTrace Usage Overage`** (単一の Product に 8 つの Price を集約、プラン別単価差を表現)

Product 作成フォーム:

| 項目 | 値 |
|---|---|
| Name | `FujiTrace Usage Overage` |
| Description | `プラン上限を超過したトレース・LLM-as-Judge評価の従量課金。月次集計でプラン別単価を適用。` |
| Statement descriptor | `FUJITRACE USAGE` |
| Tax code | `txcd_10103001` |

### 3.1 Trace Overage 4 Price (1 単位 = 10,000 トレース)

| Plan | Price (JPY) | 単位 | Price description | Metadata | 環境変数 |
|---|---|---|---|---|---|
| Pro | 300 | per 10,000 traces | `Trace Overage (Pro) / 10K` | `plan_type: pro`, `metric: trace_overage` | `STRIPE_TRACE_OVERAGE_PRO_PRICE_ID` |
| Team | 300 | per 10,000 traces | `Trace Overage (Team) / 10K` | `plan_type: team`, `metric: trace_overage` | `STRIPE_TRACE_OVERAGE_TEAM_PRICE_ID` |
| Max | 200 | per 10,000 traces | `Trace Overage (Max) / 10K` | `plan_type: max`, `metric: trace_overage` | `STRIPE_TRACE_OVERAGE_MAX_PRICE_ID` |
| Enterprise | 100 | per 10,000 traces | `Trace Overage (Enterprise) / 10K` | `plan_type: enterprise`, `metric: trace_overage` | `STRIPE_TRACE_OVERAGE_ENTERPRISE_PRICE_ID` |

各 Price 共通設定:
- Pricing model: **Usage-based pricing**
- Usage type: **Metered** (Stripe Legacy API `subscription_items.createUsageRecord()` を使用するため)
- Aggregate usage: **Sum of usage values during period**
- Charge for metered usage by: **Volume-based** (¥300 × quantity)
- Billing period: `Monthly`
- Currency: `JPY`
- Tax behavior: `Exclusive`

### 3.2 Eval Overage 4 Price (1 単位 = 1,000 評価)

| Plan | Price (JPY) | 単位 | Price description | Metadata | 環境変数 |
|---|---|---|---|---|---|
| Pro | 200 | per 1,000 evaluations | `Eval Overage (Pro) / 1K` | `plan_type: pro`, `metric: eval_overage` | `STRIPE_EVAL_OVERAGE_PRO_PRICE_ID` |
| Team | 200 | per 1,000 evaluations | `Eval Overage (Team) / 1K` | `plan_type: team`, `metric: eval_overage` | `STRIPE_EVAL_OVERAGE_TEAM_PRICE_ID` |
| Max | 150 | per 1,000 evaluations | `Eval Overage (Max) / 1K` | `plan_type: max`, `metric: eval_overage` | `STRIPE_EVAL_OVERAGE_MAX_PRICE_ID` |
| Enterprise | 100 | per 1,000 evaluations | `Eval Overage (Enterprise) / 1K` | `plan_type: enterprise`, `metric: eval_overage` | `STRIPE_EVAL_OVERAGE_ENTERPRISE_PRICE_ID` |

各 Price 共通設定は 3.1 と同じ (metered / monthly / volume-based)。

**重要:** コード側 (`src/billing/usage-reporter.ts`) は `action: 'set'` で当月累計超過量を冪等に報告するため、Stripe 側の aggregation は `Sum` ではなく **Most recent during period** に設定するのが正しい (Stripe UI の文言: `Report a single number per period and use the most recent value`)。

訂正: Aggregate usage = **Most recent during period** に設定する (Section 3.1 / 3.2 共通)。

---

## 4. Webhook エンドポイント設定

Stripe Dashboard `Developers` → `Webhooks` → `+ Add endpoint`

| 項目 | 値 |
|---|---|
| Endpoint URL | `https://www.fujitrace.jp/api/billing/webhook` |
| Description | `FujiTrace subscription & invoice events` |
| API version | `2025-02-24` (コード側で固定済み、合わせる) |
| Listen to | **Events on your account** |

**Events to send (以下をチェック):**

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

作成後に表示される `Signing secret` (`whsec_...`) を控え、`STRIPE_WEBHOOK_SECRET` に登録。

---

## 5. Customer Portal 設定

Stripe Dashboard `Settings` → `Billing` → `Customer portal`

| 項目 | 設定値 |
|---|---|
| Business information: Headline | `FujiTrace サブスクリプション管理` |
| Business information: Privacy policy URL | `https://www.fujitrace.jp/privacy` |
| Business information: Terms of service URL | `https://www.fujitrace.jp/terms` |
| Features: Customer information updates | **ON** (email / billing address / shipping address) |
| Features: Invoice history | **ON** |
| Features: Payment methods | **ON** |
| Features: Subscriptions - Cancellation | **ON** (Immediately / at period end 両方許可) |
| Features: Subscriptions - Pause | **OFF** |
| Features: Subscriptions - Update plans | **ON** (Pro / Team / Max の切替を許可) |
| Features: Subscriptions - Update quantities | **ON** (Team の seat 数変更用) |
| Features: Promotion codes | **OFF** (Phase 0 では未使用) |

Update plans に登録する Product:
- FujiTrace Pro (monthly + annual)
- FujiTrace Team (monthly + annual)
- FujiTrace Max (monthly + annual)

Default return URL: `https://www.fujitrace.jp/?tab=plan`

---

## 6. Tax (税金) 設定

Stripe Tax を有効化する場合 (推奨):

1. `More` → `Tax` → `Get started`
2. Origin address: `東京都中央区銀座` (合同会社 Reminis の登記住所)
3. Products and prices: 上記 Section 2 / 3 の全 Price について `Tax behavior = Exclusive` に設定済みであることを確認
4. Registrations: **日本の消費税 (10%)** を追加
   - Country: Japan
   - Type: `Standard` (一般課税)
   - Tax ID: 合同会社 Reminis の事業者登録番号 (T + 13 桁) を登録 (インボイス制度対応)

Stripe Tax を使わない場合:
- 全 Price の `Tax behavior` を `Exclusive` のままにしておき、Checkout で税込表示のロジックを LP 側で実装する (現在この形式)

---

## 7. 環境変数登録チェックリスト

Stripe で全 Price を作成後、以下の環境変数を **ローカル `.env` および Vercel の `llm-trace-lens-z6xv` プロジェクト** の両方に登録する。

### 7.1 Subscription Price (6 件)

```bash
STRIPE_PRO_PRICE_ID=price_xxx
STRIPE_PRO_ANNUAL_PRICE_ID=price_xxx
STRIPE_TEAM_PRICE_ID=price_xxx
STRIPE_TEAM_ANNUAL_PRICE_ID=price_xxx
STRIPE_MAX_PRICE_ID=price_xxx
STRIPE_MAX_ANNUAL_PRICE_ID=price_xxx
```

### 7.2 Overage Price (8 件)

```bash
STRIPE_TRACE_OVERAGE_PRO_PRICE_ID=price_xxx
STRIPE_TRACE_OVERAGE_TEAM_PRICE_ID=price_xxx
STRIPE_TRACE_OVERAGE_MAX_PRICE_ID=price_xxx
STRIPE_TRACE_OVERAGE_ENTERPRISE_PRICE_ID=price_xxx
STRIPE_EVAL_OVERAGE_PRO_PRICE_ID=price_xxx
STRIPE_EVAL_OVERAGE_TEAM_PRICE_ID=price_xxx
STRIPE_EVAL_OVERAGE_MAX_PRICE_ID=price_xxx
STRIPE_EVAL_OVERAGE_ENTERPRISE_PRICE_ID=price_xxx
```

### 7.3 既存 (再確認)

```bash
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_AGENT_PRICE_ID=price_xxx  # AI事務員 per-use ¥10/回 (既存、変更不要)
```

---

## 8. 検証手順 (テストモード → 本番移行)

### 8.1 テストモードで検証 (推奨)

1. 左上トグルを **Test mode** に切替
2. Section 1-3 の手順をテストモードで再実行 (Test mode 用の Product / Price が別に作成される)
3. テスト用 Price ID を `.env.local` に設定
4. ローカルで `npm run dev` を起動、`POST /api/billing/checkout` に以下をそれぞれ投げて動作確認:
   ```json
   {"planType": "pro"}
   {"planType": "team", "seats": 3}
   {"planType": "max"}
   ```
5. 返ってきた `checkoutUrl` を開き、Stripe テストカード `4242 4242 4242 4242` で決済成功させる
6. Webhook Listener (Stripe CLI: `stripe listen --forward-to localhost:3000/api/billing/webhook`) で `checkout.session.completed` が planType 通りに処理されることを確認
7. Dashboard の `/api/plan` GET で planType / limits が更新されていることを確認

### 8.2 本番移行

テストモードで全て動作を確認後、Section 1-3 の手順を **Live mode** でやり直す (テストモードの Price は本番で使えない)。本番 Price ID を Vercel の環境変数に登録し、再デプロイ。

### 8.3 本番確認

1. 本番 LP (https://www.fujitrace.jp) → Pricing → Pro 申込ボタン → Stripe Checkout へ遷移することを確認
2. 実カードで ¥3,000 決済 → Dashboard で Pro プランに切替わることを確認
3. Stripe Dashboard の `Payments` で 1 件決済されていること、Tax が自動計算されていることを確認
4. **決済後 5 分以内に同カードで返金処理** (Customer Portal からの返金 or Dashboard から手動返金) を動作確認

---

## 9. Founder 作業チェックリスト (まとめ)

以下を順に実施し、完了したら CEO (Takeshi) に報告:

- [ ] Stripe Dashboard ログイン、Live mode 確認
- [ ] Section 2.1: `FujiTrace Pro` Product 作成 + 月額/年額 Price 2 件
- [ ] Section 2.2: `FujiTrace Team` Product 作成 + 月額/年額 Price 2 件 (per seat)
- [ ] Section 2.3: `FujiTrace Max` Product 作成 + 月額/年額 Price 2 件
- [ ] Section 3.1: `FujiTrace Usage Overage` Product 作成 + Trace Overage 4 件
- [ ] Section 3.2: 同 Product に Eval Overage 4 件追加
- [ ] Section 4: Webhook endpoint 追加、Signing secret を控える
- [ ] Section 5: Customer Portal 設定
- [ ] Section 6: Tax 設定 (Stripe Tax 推奨、または LP 側で税込表示)
- [ ] Section 7: 14 個の環境変数を `.env` と Vercel に登録
- [ ] Section 8.1: テストモードで 3 プランの Checkout 動作確認
- [ ] Section 8.2: 本番移行 (Live mode で Product / Price 再作成)
- [ ] Section 8.3: 本番で実カード決済 1 件 + 返金動作確認

作業時間の目安:
- Product / Price 作成: 25 分 (Product 4 × 5-7 分)
- Webhook / Portal / Tax 設定: 10 分
- テストモード検証: 15 分
- 本番移行 + 検証: 15 分
- **合計: 約 65 分**

---

## 10. 本書で扱わない項目

- `Enterprise` プランの個別契約は Stripe Invoice で都度発行 or 営業経由で契約書を締結するため、Dashboard での事前設定は不要
- `STRIPE_AGENT_PRICE_ID` (AI 事務員 per-use ¥10/回) は既存のためそのまま利用
- Promotion code / Coupon は Phase 0 では使用しない (別途 CEO 承認後に Section 追記)
- Subscription Schedule (将来的な価格改定の予約) は Phase 0 では使用しない
