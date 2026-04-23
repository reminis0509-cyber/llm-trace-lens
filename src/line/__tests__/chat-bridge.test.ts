/**
 * Unit tests for the LINE chat bridge — specifically the message composition
 * logic that decides between "text only" and "text + PDF Flex bubble".
 *
 * The bridge end-to-end is exercised via higher-level tests, but the pure
 * composition function is the correctness hot-spot for Monday's demo: if we
 * get this wrong the Founder shows the wrong artefact to a potential lead.
 *
 * Covered:
 *   1. final event with pdf_url → text + Flex (2 messages)
 *   2. final event without pdf_url → text only (1 message)
 *   3. filename inference picks the right label by keyword
 */
import { describe, it, expect } from 'vitest';
import {
  composeFinalMessages,
  firstPdfAttachment,
  inferFileName,
} from '../chat-bridge.js';
import type { AgentSseEvent } from '../../agent/contract-agent.types.js';

function finalEvent(
  reply: string,
  attachments?: Array<{ kind: string; url?: string }>,
): Extract<AgentSseEvent, { type: 'final' }> {
  return { type: 'final', reply, attachments };
}

describe('composeFinalMessages — pdf branch', () => {
  it('emits a text + flex bubble when a pdf_url is present', () => {
    const msgs = composeFinalMessages(
      '見積書を株式会社テスト宛に作って',
      finalEvent('作成しました。', [
        { kind: 'pdf', url: 'https://example.com/estimate.pdf' },
      ]),
    );
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toEqual(
      expect.objectContaining({ type: 'text', text: '作成しました。' }),
    );
    expect(msgs[1]).toEqual(
      expect.objectContaining({ type: 'flex' }),
    );
  });
});

describe('composeFinalMessages — text-only branch', () => {
  it('emits a single text message when there is no pdf attachment', () => {
    const msgs = composeFinalMessages(
      'メール文案を考えて',
      finalEvent('お世話になっております。…'),
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual(
      expect.objectContaining({
        type: 'text',
        text: 'お世話になっております。…',
      }),
    );
  });
});

describe('firstPdfAttachment', () => {
  it('returns null when there is no pdf attachment', () => {
    expect(firstPdfAttachment([])).toBeNull();
    expect(firstPdfAttachment(undefined)).toBeNull();
    expect(
      firstPdfAttachment([{ kind: 'image', url: 'https://x/y.png' }]),
    ).toBeNull();
  });

  it('returns the first pdf attachment when one is present', () => {
    const result = firstPdfAttachment([
      { kind: 'image', url: 'https://x/y.png' },
      { kind: 'pdf', url: 'https://x/y.pdf' },
      { kind: 'pdf', url: 'https://x/z.pdf' },
    ]);
    expect(result?.url).toBe('https://x/y.pdf');
  });
});

describe('inferFileName', () => {
  it('labels 見積 prompts as 見積書', () => {
    expect(inferFileName('見積書作って 株式会社テスト宛')).toMatch(
      /^見積書_\d{8}\.pdf$/,
    );
  });
  it('labels 議事録 prompts as 議事録', () => {
    expect(inferFileName('議事録書いて')).toMatch(/^議事録_\d{8}\.pdf$/);
  });
  it('falls back to a generic label when no keyword matches', () => {
    expect(inferFileName('雑談しよう')).toMatch(/^書類_\d{8}\.pdf$/);
  });
});
