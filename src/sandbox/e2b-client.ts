/**
 * sandbox/e2b-client.ts — VM sandbox interface + stub client.
 *
 * Real E2B integration is gated on `E2B_API_KEY`. When the env var is set
 * AND the optional peer dependency `@e2b/code-interpreter` is installed,
 * callers get a real VM-backed code interpreter. Otherwise every `run()`
 * call returns `{ ok: false, error: 'sandbox_not_configured' }`.
 *
 * The dynamic import is used so the peer dep is not a hard requirement at
 * build time — typecheck passes even if the package is absent.
 */

export interface SandboxRunResult {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  result?: unknown;
  error?: string;
}

export interface SandboxClient {
  run(code: string, language?: 'python' | 'node'): Promise<SandboxRunResult>;
}

class NotConfiguredSandboxClient implements SandboxClient {
  async run(_code: string, _language: 'python' | 'node' = 'python'): Promise<SandboxRunResult> {
    return {
      ok: false,
      error: 'sandbox_not_configured',
    };
  }
}

class E2BBackedSandboxClient implements SandboxClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async run(code: string, language: 'python' | 'node' = 'python'): Promise<SandboxRunResult> {
    try {
      // Dynamic import: keeps @e2b/code-interpreter a truly optional dep.
      // The type assertion is necessary because the package is optional.
      type E2BModule = {
        CodeInterpreter: {
          create(opts: { apiKey: string }): Promise<{
            notebook: {
              execCell(code: string, opts?: { kernelName?: string }): Promise<{
                results?: unknown[];
                logs?: { stdout?: string[]; stderr?: string[] };
                error?: { name: string; value: string };
              }>;
            };
            close(): Promise<void>;
          }>;
        };
      };
      // Optional peer dep — install `@e2b/code-interpreter` to enable.
      // The `@ts-ignore` is necessary because the package is not a hard
      // dependency and may be absent at typecheck time.
      // @ts-ignore: optional peer dependency
      const imported = await import('@e2b/code-interpreter');
      const mod = imported as unknown as E2BModule;
      const sbx = await mod.CodeInterpreter.create({ apiKey: this.apiKey });
      try {
        const out = await sbx.notebook.execCell(code, {
          kernelName: language === 'node' ? 'javascript' : 'python3',
        });
        return {
          ok: !out.error,
          stdout: (out.logs?.stdout ?? []).join(''),
          stderr: (out.logs?.stderr ?? []).join(''),
          result: out.results,
          error: out.error ? `${out.error.name}: ${out.error.value}` : undefined,
        };
      } finally {
        await sbx.close();
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'sandbox error',
      };
    }
  }
}

export function getSandboxClient(): SandboxClient {
  const key = process.env.E2B_API_KEY;
  if (key && key.length > 0) {
    return new E2BBackedSandboxClient(key);
  }
  return new NotConfiguredSandboxClient();
}
