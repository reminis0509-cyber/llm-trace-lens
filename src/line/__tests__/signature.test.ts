/**
 * Unit tests for LINE signature verification and webhook body handling.
 *
 * Covers:
 *   1. Valid HMAC-SHA256 signature → `validateSignature` returns true.
 *   2. Tampered signature → returns false.
 *
 * These guard the critical security boundary of `POST /webhook/line` —
 * any regression here lets an attacker inject arbitrary events.
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { validateSignature } from '@line/bot-sdk';

/**
 * Build a base64 HMAC-SHA256 signature as LINE does.
 * Reference: https://developers.line.biz/en/reference/messaging-api/#signature-validation
 */
function sign(body: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64');
}

const SECRET = 'test-channel-secret';
const BODY = JSON.stringify({
  destination: 'Uaaaa',
  events: [
    {
      type: 'message',
      webhookEventId: '01HABCDE',
      timestamp: 1_700_000_000_000,
      source: { type: 'user', userId: 'U11111111111111111111111111111111' },
      mode: 'active',
      deliveryContext: { isRedelivery: false },
      replyToken: 'token-123',
      message: {
        id: 'm1',
        type: 'text',
        text: 'hello',
        quoteToken: 'q1',
      },
    },
  ],
});

describe('LINE signature verification', () => {
  it('accepts a properly signed body', () => {
    const sig = sign(BODY, SECRET);
    expect(validateSignature(BODY, SECRET, sig)).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const sig = sign(BODY, SECRET);
    // Flip one character in the signature.
    const tampered = sig.startsWith('A') ? `B${sig.slice(1)}` : `A${sig.slice(1)}`;
    expect(validateSignature(BODY, SECRET, tampered)).toBe(false);
  });

  it('rejects a body that has been modified post-signing', () => {
    const sig = sign(BODY, SECRET);
    const mutatedBody = BODY.replace('hello', 'evil');
    expect(validateSignature(mutatedBody, SECRET, sig)).toBe(false);
  });
});
