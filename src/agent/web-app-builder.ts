/**
 * agent/web-app-builder.ts — Web App Builder (β stub).
 *
 * Receives a natural-language product spec and returns a Markdown-formatted
 * Next.js scaffolding outline. This is deliberately minimal for v2 — the
 * full generator is a Phase A1 deliverable. The stub's job is to expose
 * the shape of the feature (endpoint, schema, response type) so the frontend
 * can render a placeholder.
 */

export interface WebAppBuilderInput {
  spec: string;
  name?: string;
}

export interface WebAppBuilderOutput {
  name: string;
  scaffold: string;
  isBeta: true;
  warnings: string[];
}

/**
 * Produce a deterministic Markdown scaffold. No LLM call — this keeps the
 * stub free and offline. Real generation will be added in Phase A1.
 */
export function buildWebAppScaffold(input: WebAppBuilderInput): WebAppBuilderOutput {
  const name = (input.name ?? 'fujitrace-app').slice(0, 60);
  const scaffold = [
    `# ${name} (β)`,
    '',
    '> FujiTrace Web App Builder は β 版です。生成されるスキャフォールドは最小限で、本番利用は非推奨です。',
    '',
    '## 仕様メモ',
    '',
    input.spec.slice(0, 4000),
    '',
    '## 推奨ディレクトリ構成 (Next.js 14, App Router)',
    '',
    '```',
    `${name}/`,
    '├── app/',
    '│   ├── layout.tsx',
    '│   ├── page.tsx',
    '│   └── api/',
    '│       └── hello/route.ts',
    '├── components/',
    '├── lib/',
    '├── public/',
    '├── package.json',
    '└── tsconfig.json',
    '```',
    '',
    '## 次のステップ',
    '',
    '1. このスキャフォールドを元に `npx create-next-app@latest` で雛形を作成',
    '2. 仕様メモに沿って `app/` 配下を実装',
    '3. Phase A1 リリース後は実コード生成に置換予定',
  ].join('\n');

  return {
    name,
    scaffold,
    isBeta: true,
    warnings: [
      'v2 stub: actual code generation is not yet implemented.',
      'Phase A1 replaces this with real scaffolding output.',
    ],
  };
}
