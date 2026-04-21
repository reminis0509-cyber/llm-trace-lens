# FujiTrace E2E (Playwright)

AI Employee v1 / v2 / v2.1 (2026-04-21 着地予定) の回帰防止を目的とした E2E
harness。Landing / Dashboard の UI 表面のみをカバーし、backend server と DB
は起動しない。Supabase / backend API は `tests/e2e/fixtures/dashboard.ts`
で mock される。

## セットアップ (初回のみ)

```bash
# Playwright npm パッケージは package.json に含まれている
npm install

# ブラウザバイナリをダウンロード (初回 or Playwright バージョン更新時)
npx playwright install chromium
```

## 実行

```bash
# 全 spec をヘッドレスで実行 (Dashboard + Landing dev server が自動起動)
npm run test:e2e

# UI モード (デバッグ用)
npm run test:e2e:ui

# ヘッドフル (ブラウザ可視化)
npm run test:e2e:headed

# 特定 spec のみ
npx playwright test tests/e2e/rebrand.spec.ts

# 特定 test のみ
npx playwright test -g "renders all 5 plans"

# HTML レポート
npx playwright show-report
```

## ディレクトリ構成

```
tests/e2e/
├── README.md                          <- このファイル
├── fixtures/
│   └── dashboard.ts                   <- Supabase セッション偽装 / backend mock helpers
├── rebrand.spec.ts                    <- 「AI事務員」→「AI社員」リブランド pin
├── pricing.spec.ts                    <- Landing #pricing 5 プラン表示
├── briefing.spec.ts                   <- /dashboard/briefing (MorningBriefing)
├── taskboard.spec.ts                  <- /dashboard/tasks (TaskBoard)
├── connector-settings.spec.ts         <- /dashboard/settings/connectors (v1)
├── connector-v2.spec.ts               <- /dashboard/settings/connectors (v2)
├── nav.spec.ts                        <- Dashboard v1 7 タブ遷移
├── nav-v2.spec.ts                     <- Dashboard v2/v2.1 (main 5 + その他 + subnav)
├── auth.spec.ts                       <- /dashboard ログイン画面
├── api-keys.spec.ts                   <- /dashboard/settings/api-keys
├── custom-mcp.spec.ts                 <- /dashboard/settings/custom-mcp
├── projects.spec.ts                   <- /dashboard/projects
├── running.spec.ts                    <- /dashboard/running
├── schedule.spec.ts                   <- /dashboard/schedule
├── research.spec.ts                   <- /dashboard/research (ワイド リサーチ)
├── slide-builder.spec.ts              <- /dashboard/tools/slide-builder (v2.1)
├── excel-analyzer.spec.ts             <- /dashboard/tools/excel-analyzer (v2.1)
├── meeting-transcriber.spec.ts        <- /dashboard/tools/meeting-transcriber (v2.1)
└── document-proofreader.spec.ts       <- /dashboard/tools/document-proofreader (v2.1)
```

## 規模の目安

| 時点 | spec 数 | test 数 |
|------|--------|--------|
| v1 着地 (2026-04-20) | 8 | ~40 |
| v2 着地 (2026-04-20) | 16 | ~109 |
| v2.1 着地 (2026-04-21) | 19 | ~130 |

v2.1 では Web App Builder を削除しスライドビルダーに pivot、新規に Excel
分析 / 音声議事録 / 文書校正 の 3 spec を追加している。

## 新しい spec を追加する

1. 対象画面の behavior を言葉で書き出す (happy path / edge / error の3軸)
2. `tests/e2e/<feature>.spec.ts` を作成
3. 既存 spec (`briefing.spec.ts` / `pricing.spec.ts`) を参考に:
   - 認証必須ページ → `gotoAuthedDashboard(page, '/dashboard/...')`
   - backend 不在を擬似する → `stubBackendAsOffline(page)`
   - Landing → `await page.goto('/')` (baseURL が landing origin)
4. `describe` でグループ化、`it` は「主語 + 期待される振る舞い」で命名
5. `npm run test:e2e -- tests/e2e/<feature>.spec.ts` で green を確認

## 既知の制限 (2026-04-20 時点)

- **backend 実接続は行わない**。全ての `/api/**` 呼び出しは 404 を返し、
  Dashboard 側 fallback mock (`MOCK_BRIEFING`, `MOCK_TASKS`) を発火させて
  UI を描画する。本物の API レスポンス形状との差分は別の契約テスト (vitest)
  で担保する。
- **認証は Supabase localStorage への mock 注入で偽装**している
  (`fixtures/dashboard.ts`)。本物の OAuth フローはテストしない。OAuth の
  redirect を跨ぐテストが必要になったら `storageState` + サーバー mock を
  別途構築する。
- **Dashboard 7 タブのラベルは xl ブレイクポイント (>= 1280px) で表示**
  されるため、config で viewport を 1440x900 に固定している。モバイル
  テストを書く場合は個別に `page.setViewportSize` で切り替える。
- **dashboard dev server 単独起動**ではリブランドと pricing の landing
  テストが動かないため、webServer 配列で landing (port 5174) も起動する
  構成にしている。port 競合時は `lsof -i :5173 -i :5174` で占有プロセス
  を確認すること。
- **CI 統合は未対応**。Playwright をまず GitHub Actions に通す作業は別
  スプリントで実施予定。

## ポート競合時

```bash
# 占有プロセスの確認
lsof -i :5173 -i :5174 -sTCP:LISTEN

# 必要に応じて kill
kill -9 <pid>

# テスト再実行
npm run test:e2e
```

`reuseExistingServer: !process.env.CI` により、既に dev server が立って
いる場合はそれを再利用する (CI 環境では必ずクリーン起動)。

## v2 実装後に追加すべき pin 候補

- `/dashboard/briefing` で backend 実接続時の today events 表示
- `/dashboard/tasks` で backend 実接続時のタスク数と状態更新
- `/dashboard/settings/connectors` で Google OAuth 開始ボタンのリダイレクト先
- AI社員 チャット UI (AiClerkChat) の 1 ターン会話 happy path
- チュートリアル 4 章の完走 (修了証生成まで)
- Watch Room (/dashboard/watch) の ambient view
- Admin Dashboard (/dashboard/admin) RBAC 境界
- `/auth` → /dashboard への login → redirect フロー (storageState 使用)

## v2.1 以降に追加すべき pin 候補

v2.1 で新規追加した 4 ツールは backend 並行実装中のため、現時点では mock
fallback 経路のみを pin している。backend 実装が揃ったあと、以下を追加する:

- **Slide Builder (Marp / PPTX 実生成)** — `/api/agent/slide-builder` に
  POST し、返された Markdown が Marp として正しくプレビュー描画され、PPTX
  バイナリ DL ボタンが動くこと
- **Excel Analyzer (実 Excel 処理)** — `.xlsx` の multi-sheet upload で
  aggregations の数値が UI に reflect されること
- **Meeting Transcriber (Whisper 実 API 通し)** — 実 wav/mp3 を投げた際
  の言語自動判定 + 話者分離 + 議事録 6 セクション生成
- **Document Proofreader (差分ハイライト粒度)** — diff が単語単位 /
  文単位でハイライトされ、change 数カウントが表示されること
- **共通**: rate limit エラー / payload too large / file type reject 等の
  エラー経路が UI で握りつぶされずユーザーに伝わること

これらは backend 着地後、qa-engineer が本 README に追記する。
