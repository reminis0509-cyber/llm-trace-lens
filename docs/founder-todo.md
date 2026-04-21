# FujiTrace Founder TODO — 2026-04-21 時点

v1 (cff2260) / v2 (4968885) / v2.1 (edde5aa) / OAuth env (6e18ab9) 全て本番反映済。
以降はこのファイルを更新しながら段階的に有効化していく。

## 現状サマリ

Founder指示「**最低限のAIエージェント**」と聞かれたが、実態は**主要機能9割稼働**。
残タスクは Connector の OAuth app 登録と決済系の設定が中心。

### 🟢 本番稼働済 (すぐ使える)

| 機能 | 動作条件 |
|---|---|
| **AI社員チャット** (汎用、132項目カタログ、自律 β) | 既存 OPENAI_API_KEY で動作 |
| **書類5種作成/チェック** (見積/請求/納品/発注/送付状) | 同上 |
| **Wide Research** (深いリサーチ, SSE) | 同上 + url-safety guard |
| **Slide Builder (β)** (スライド生成, Marp→HTML/PPTX) | 同上 + pptxgenjs |
| **Excel Analyzer** (.xlsx upload + LLM分析) | 同上 + xlsx lib |
| **Meeting Transcriber** (Whisper 音声議事録) | 同上 (Whisper権限必要) |
| **Document Proofreader** (日本語ビジネス校正) | 同上 |
| **Projects** (永続ワークスペース + files) | DB稼働 |
| **Scheduled Tasks** (cron) | runner稼働 |
| **Concurrent Task Queue** | user scope済 |
| **Watch Room** (監視員モード) | 既存通り |
| **Google Calendar / Gmail / Drive** | 2026-04-21 OAuth Client登録済 (テストユーザー限定) |
| **タスクボード / 朝のブリーフィング** | workspace API稼働 |
| **Custom MCP 登録** (user自前 API接続) | 稼働、URL SSRF guard済 |
| **External API** (外部プログラマティック、`fjk_` API key) | 稼働 |
| **料金プラン5種** (Free/Pro/Team/Max/Enterprise) | 型定義稼働、Stripe物理設定は要 |

### 🟡 コード完成、Founder作業待ち (credential登録で即稼働)

| 機能 | 必要credential | 作業場所 |
|---|---|---|
| **Slack 連携** | OAuth Client ID/Secret | https://api.slack.com/apps |
| **freee 連携** | OAuth Client ID/Secret | https://app.secure.freee.co.jp/developers |
| **Notion 連携** | OAuth Client ID/Secret | https://www.notion.so/my-integrations |
| **GitHub 連携** | OAuth Client ID/Secret | https://github.com/settings/developers |
| **LINE Messaging** | Channel Access Token (user per-connect) | https://developers.line.biz |
| **Stripe Team/Enterprise 課金** | Product/Price ID × 14 | Stripe Dashboard (65分作業) |

### 🟠 任意 / 将来判断

| 機能 | 判断理由 |
|---|---|
| **E2B VM Sandbox** | タスクあたり ¥7-15 infra増、Max層の価値を見てから |
| **Google App Verification** | テストユーザー超えて一般公開時に必須 (審査数週〜数ヶ月) |

---

## Founder やることリスト (優先順)

### 🔴 最優先 (営業行脚前に必須)

#### ① Google OAuth 動作確認 (5分)
- https://www.fujitrace.jp/dashboard/settings/connectors にログイン
- Google Calendar/Gmail/Drive の「接続する」ボタンをそれぞれテスト
- 想定: テストユーザー (info@fujitrace.jp / reminis0509@gmail.com) は認可画面→接続成功
- 警告画面「このアプリは確認されていません」→「詳細」→ 進む で許可 (テスト中挙動)

#### ② Slack OAuth App 作成
1. https://api.slack.com/apps → Create New App → "From scratch"
2. App Name: `FujiTrace`
3. OAuth & Permissions → Redirect URLs:
   - `https://www.fujitrace.jp/api/auth/oauth/slack/callback`
4. Bot Token Scopes 追加: `chat:write`, `channels:read`, `groups:read`, `im:read`
5. Basic Information → Client ID / Client Secret を CEO に共有 → Vercel env登録

#### ③ freee OAuth App 作成
1. https://app.secure.freee.co.jp/developers → アプリ作成
2. アプリ名: `FujiTrace`
3. コールバックURL: `https://www.fujitrace.jp/api/auth/oauth/freee/callback`
4. スコープ: `read` (読み取り中心、書き込みは後期で有効化判断)
5. Client ID / Client Secret を CEO に共有

#### ④ Notion Integration 作成
1. https://www.notion.so/my-integrations → + New integration
2. Integration type: **Public integration**
3. Name: `FujiTrace`
4. Redirect URIs: `https://www.fujitrace.jp/api/auth/oauth/notion/callback`
5. OAuth client ID / secret を CEO に共有

#### ⑤ GitHub OAuth App 作成
1. https://github.com/settings/developers → OAuth Apps → New
2. Application name: `FujiTrace`
3. Homepage URL: `https://www.fujitrace.jp`
4. Authorization callback URL: `https://www.fujitrace.jp/api/auth/oauth/github/callback`
5. Client ID / Client Secret を CEO に共有

### 💰 課金系 (Team/Enterprise 営業開始時)

#### ⑥ Stripe Dashboard 設定 (約65分)
- 手順書: `docs/stripe-product-setup-2026-04-20.md` Section 9 のチェックリスト
- Product 4個 / Price 14個 / Webhook / Tax / Portal 設定
- 完成後の price_id 14個を CEO に共有 → Vercel env 登録

### 📜 公開準備

#### ⑦ Privacy Policy 法務レビュー
- 対象: `/privacy` ページ (2026-04-21改訂版)
- 誰が: 法務 or 外部弁護士、個人情報保護法準拠確認

#### ⑧ 特定商取引法に基づく表記の確認
- 既存ページの有無確認、合同会社Reminis 情報で更新

#### ⑨ Google App Verification 申請 (一般公開時)
- Gmail/Calendar scope が restricted のため審査必須
- https://console.cloud.google.com/auth/branding → 本番公開 → 審査申請
- 所要: 数週〜数ヶ月、完了まで「テストユーザー」限定運用継続

### 🧪 任意

#### ⑩ LINE Messaging API (顧客要望発生時)
- https://developers.line.biz → Channel作成 → Messaging API
- Channel Access Token を CEO に共有 (後日、ユーザー別登録も可)

#### ⑪ E2B VM Sandbox 有効化 (Max層利用が明確になったら)
1. https://e2b.dev → アカウント+課金登録 → API key取得
2. CEO が `@e2b/code-interpreter` install + `E2B_API_KEY` + `SANDBOX_ENABLED=1` 設定

#### ⑫ Playwright ローカル E2E green 確認
```
cd /Users/murakamiriku/L2/llm-trace-lens
npx playwright install chromium
npm run test:e2e
```
19 spec / ~130 test が green であることを確認。

---

## CEO (Takeshi) 側の未完タスク

### 💻 コード実装 (後続sprint候補)

P1 残3件 + P2 9件 + P3 9件 (QA Phase 2 で検出、`docs/qa-findings-2026-04-20.md` は未作成、以下要約):

#### P1 残3件
- **S-02**: `api-key-auth.ts` の user.id/email conflation 整理
- **S-04**: Wide Research以外の fetch call site も 30s timeout 付与
- **S-06**: Projects ファイル upload の user合計容量 quota

#### P2 (9件)
- S-07 API key timing-safe比較 / S-08 pending queue MAX_PENDING / S-09 scheduler cron parse fail挙動 / S-10 ts-ignore→expect-error / S-11 sandbox RBAC / S-12 file upload magic bytes / S-13 scheduled_tasks params size cap / S-14 Projects workspace scope / S-15 Custom MCP response size limit

#### P3 (9件)
- S-16〜S-24: UX polish / memoize / index最適化

### 🎯 Manus feature parity 深掘り

| ギャップ | 現状 | 深掘り時期 |
|---|---|---|
| VM sandbox 実稼働 | E2B stub | Max層ニーズ確認後 |
| Web App Builder → Slide Builderに pivot済 | β stub → 実LLM codegen余地 | Phase A1 |
| Wide Research 精度 | 動くがManusと同等品質には要チューニング | プロンプト反復 |
| Live View 完成度 | SkeletonTrace upgrade済、tool screenshot未 | 営業受けで判断 |
| Manus Team機能 (共有credit pool) | 型定義のみ | Team契約者発生後 |

### 🛠 机上作業カバレッジ (Founder理想)

現状 ~90%。残10%の候補 (優先度降順):

| # | ツール | 工数 | 価値 |
|---|---|---|---|
| 1 | **OCR/紙書類デジタル化専用UI** (既存 GPT-4o Vision を活用、印鑑位置指摘) | 1-2日 | 高 (Founder理想symbol feature) |
| 2 | **稟議書/議案書/議事録 専用フォーム** | 2-3日 | 中 |
| 3 | **提案書/プレスリリース テンプレ** | 1-2日 | 中 |
| 4 | **名刺OCR (Eight風)** | 1日 | 低 |
| 5 | **Excel スプレッドシート直接編集** (現状は分析のみ) | 3-5日 | 中 |

---

## 参考 docs

- `docs/戦略_2026.md` — Section 12.14 「AI社員構想」
- `docs/stripe-product-setup-2026-04-20.md` — Stripe設定手順
- `docs/pricing-model.md` — 5プラン仕様 (gitignore対象、内部用)
- `docs/pricing-copy-2026-04-20.md` — LP Pricing UI コピー (gitignore対象、内部用)
- memory `manus_research_2026-04-20.md` — Manus調査
- memory `vision_ai_employee.md` — AI社員構想本体
- memory `ai_employee_v2_complete_2026-04-21.md` — v2実装完了記録
- memory `enterprise_contract_clauses_2026-04-20.md` — Enterprise契約条項

---

## 更新履歴

- **2026-04-21 創設**: AI社員 v2.1 + Google OAuth env 登録完了時点で Founder引き継ぎ用に作成
