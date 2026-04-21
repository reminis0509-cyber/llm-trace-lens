/**
 * document-proofreader.test.ts — AI 社員 v2.1 Japanese proofreader tests.
 *
 * Covers the rule-based pre-pass (pure, no LLM), the apply-corrections
 * helper, and the overall proofreadDocument flow with the LLM stubbed to
 * return zero additional findings. The LLM layer is exercised separately;
 * this test focuses on the deterministic rule engine so we can pin its
 * behaviour against regressions as we add new rules.
 */
import { describe, it, expect, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Stub the LLM proxy so proofreadDocument never hits the network.
vi.mock('../../routes/tools/_shared.js', async () => {
  const actual = await vi.importActual<typeof import('../../routes/tools/_shared.js')>(
    '../../routes/tools/_shared.js',
  );
  return {
    ...actual,
    callLlmViaProxy: vi.fn(async () => ({
      content: '{"corrections":[]}',
      traceId: 'test',
      usage: null,
    })),
  };
});

const {
  runRulePass,
  applyCorrections,
  proofreadDocument,
} = await import('../../agent/document-proofreader.js');

const fakeFastify = {} as FastifyInstance;

describe('document-proofreader: rule pass', () => {
  it('detects 二重敬語「お伺いさせていただきます」', () => {
    const text = '明日、お伺いさせていただきます。';
    const findings = runRulePass(text, 'light');
    const dup = findings.find((f) => f.reason.includes('二重敬語'));
    expect(dup).toBeDefined();
    expect(dup?.before).toBe('お伺いさせていただきます');
    expect(dup?.after).toBe('伺います');
    expect(dup?.position).toBeGreaterThanOrEqual(0);
    expect(dup?.source).toBe('rule');
  });

  it('does NOT flag 冗長表現 in light mode', () => {
    const text = '弊社ではそれを達成することができます。';
    const light = runRulePass(text, 'light');
    expect(light.find((c) => c.reason.includes('冗長'))).toBeUndefined();
  });

  it('flags 冗長表現 only in strict mode', () => {
    const text = '弊社ではそれを達成することができます。';
    const strict = runRulePass(text, 'strict');
    const verbose = strict.find((c) => c.reason.includes('冗長'));
    expect(verbose).toBeDefined();
    expect(verbose?.after).toBe('できます');
  });

  it('detects multiple offences in one document', () => {
    const text = 'お伺いさせていただく予定です。また、拝見させていただきました。';
    const findings = runRulePass(text, 'strict');
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.every((f) => f.source === 'rule')).toBe(true);
  });
});

describe('document-proofreader: applyCorrections', () => {
  it('applies replacements in reverse-offset order', () => {
    const text = 'お伺いさせていただきます。拝見させていただきました。';
    const corrections = runRulePass(text, 'strict');
    const fixed = applyCorrections(text, corrections);
    expect(fixed).toContain('伺います');
    expect(fixed).toContain('拝見しました');
    expect(fixed).not.toContain('お伺いさせていただき');
  });
});

describe('document-proofreader: end-to-end with LLM stubbed empty', () => {
  it('returns rule findings plus a summary sentence', async () => {
    const out = await proofreadDocument(fakeFastify, {
      text: '明日、お伺いさせていただきます。することが可能です。',
      style: 'business',
      checkLevel: 'strict',
    });
    expect(out.corrections.length).toBeGreaterThanOrEqual(2);
    expect(out.corrected).not.toContain('お伺いさせていただき');
    expect(out.summary).toContain('件の指摘');
  });

  it('returns a clean summary when input has no issues', async () => {
    const out = await proofreadDocument(fakeFastify, {
      text: '本日の会議は有意義でした。',
      style: 'business',
      checkLevel: 'light',
    });
    expect(out.corrections).toEqual([]);
    expect(out.summary).toBe('校正の指摘はありません。');
  });
});
