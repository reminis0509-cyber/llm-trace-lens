/**
 * Gmail MIME header injection guard tests (QA Finding S-02, T-09, 2026-04-20).
 *
 * LLM 出力が recipient / subject / filename に CR/LF を混入した場合、
 * `buildMimeMessage` は throw し、BCC smuggling / header injection を防止する。
 */
import { describe, it, expect } from 'vitest';
import { buildMimeMessage } from '../../connectors/gmail.js';

describe('gmail buildMimeMessage — header injection guard', () => {
  const baseParams = {
    to: 'user@example.com',
    subject: 'テスト件名',
    body: '本文です。',
  };

  it('accepts a clean message', () => {
    const raw = buildMimeMessage(baseParams);
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    expect(decoded).toContain('To: user@example.com');
    expect(decoded).toContain('Subject: =?UTF-8?B?');
  });

  it('rejects CR/LF injection in `to` (BCC smuggling)', () => {
    expect(() =>
      buildMimeMessage({
        ...baseParams,
        to: 'victim@example.com\r\nBcc: attacker@evil.example',
      }),
    ).toThrow(/to\[0\]/);
  });

  it('rejects CR/LF injection in each element of `to` array', () => {
    expect(() =>
      buildMimeMessage({
        ...baseParams,
        to: ['ok@example.com', 'bad@example.com\nBcc: attacker@evil.example'],
      }),
    ).toThrow(/to\[1\]/);
  });

  it('rejects CR/LF injection in `cc`', () => {
    expect(() =>
      buildMimeMessage({
        ...baseParams,
        cc: 'cc@example.com\r\nBcc: attacker@evil.example',
      }),
    ).toThrow(/cc\[0\]/);
  });

  it('rejects CR/LF injection in `bcc`', () => {
    expect(() =>
      buildMimeMessage({
        ...baseParams,
        bcc: 'a@b.example\r\nX-Header: injected',
      }),
    ).toThrow(/bcc\[0\]/);
  });

  it('rejects CR/LF injection in `subject`', () => {
    expect(() =>
      buildMimeMessage({
        ...baseParams,
        subject: 'Normal\r\nBcc: attacker@evil.example',
      }),
    ).toThrow(/subject/);
  });

  it('rejects quote/backslash in attachment filename (breaks header)', () => {
    expect(() =>
      buildMimeMessage({
        ...baseParams,
        attachments: [
          {
            filename: 'evil".pdf',
            mimeType: 'application/pdf',
            base64: 'AAAA',
          },
        ],
      }),
    ).toThrow(/attachment\.filename/);
  });

  it('rejects CR/LF in attachment mimeType', () => {
    expect(() =>
      buildMimeMessage({
        ...baseParams,
        attachments: [
          {
            filename: 'ok.pdf',
            mimeType: 'application/pdf\r\nX-Injected: yes',
            base64: 'AAAA',
          },
        ],
      }),
    ).toThrow(/attachment\.mimeType/);
  });

  it('builds valid multipart message with safe attachments', () => {
    const raw = buildMimeMessage({
      ...baseParams,
      attachments: [
        {
          filename: '見積書_20260420.pdf',
          mimeType: 'application/pdf',
          base64: 'JVBERi0xLjQKJeLjz9M=',
        },
      ],
    });
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    expect(decoded).toContain('multipart/mixed');
    expect(decoded).toContain('filename="見積書_20260420.pdf"');
  });
});
