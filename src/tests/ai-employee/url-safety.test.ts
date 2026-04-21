/**
 * url-safety.test.ts — SSRF guard unit tests.
 *
 * Covers `assertPublicUrl` / `isPublicUrl` from `src/lib/url-safety.ts`.
 * These are the shared helpers used by:
 *   - src/agent/wide-research.ts (fetchExcerpt + input.sources vetting)
 *   - src/routes/custom-mcp.ts (POST/PATCH zod refine)
 *   - src/connectors/custom-mcp.ts (execute-time defense-in-depth)
 */
import { describe, it, expect } from 'vitest';
import { assertPublicUrl, isPublicUrl } from '../../lib/url-safety.js';

describe('url-safety: public URLs pass', () => {
  it('accepts https://example.com/foo', () => {
    expect(() => assertPublicUrl('https://example.com/foo')).not.toThrow();
    expect(isPublicUrl('https://example.com/foo')).toBe(true);
  });

  it('accepts http://example.jp with query', () => {
    expect(isPublicUrl('http://example.jp/search?q=1')).toBe(true);
  });

  it('accepts a public IPv4 literal', () => {
    expect(isPublicUrl('https://8.8.8.8/')).toBe(true);
  });

  it('accepts a public IPv6 literal', () => {
    expect(isPublicUrl('https://[2001:db8::1]/')).toBe(true);
  });
});

describe('url-safety: loopback rejected', () => {
  it('rejects http://127.0.0.1', () => {
    expect(() => assertPublicUrl('http://127.0.0.1/')).toThrow();
    expect(isPublicUrl('http://127.0.0.1/')).toBe(false);
  });

  it('rejects http://127.0.0.1:8080/admin', () => {
    expect(isPublicUrl('http://127.0.0.1:8080/admin')).toBe(false);
  });

  it('rejects http://127.5.6.7', () => {
    expect(isPublicUrl('http://127.5.6.7/')).toBe(false);
  });

  it('rejects http://localhost', () => {
    expect(isPublicUrl('http://localhost/')).toBe(false);
  });

  it('rejects http://api.localhost', () => {
    expect(isPublicUrl('http://api.localhost/')).toBe(false);
  });
});

describe('url-safety: private IPv4 rejected', () => {
  it('rejects 10.0.0.1', () => {
    expect(isPublicUrl('http://10.0.0.1/')).toBe(false);
  });

  it('rejects 192.168.1.1', () => {
    expect(isPublicUrl('http://192.168.1.1/')).toBe(false);
  });

  it('rejects 172.16.0.1 (edge of 172.16/12)', () => {
    expect(isPublicUrl('http://172.16.0.1/')).toBe(false);
  });

  it('rejects 172.31.255.255 (other edge of 172.16/12)', () => {
    expect(isPublicUrl('http://172.31.255.255/')).toBe(false);
  });

  it('accepts 172.15.0.1 (just below 172.16/12)', () => {
    expect(isPublicUrl('http://172.15.0.1/')).toBe(true);
  });

  it('accepts 172.32.0.1 (just above 172.16/12)', () => {
    expect(isPublicUrl('http://172.32.0.1/')).toBe(true);
  });

  it('rejects 0.0.0.0 (this host)', () => {
    expect(isPublicUrl('http://0.0.0.0/')).toBe(false);
  });

  it('rejects 100.64.0.1 (CGNAT)', () => {
    expect(isPublicUrl('http://100.64.0.1/')).toBe(false);
  });
});

describe('url-safety: cloud metadata rejected', () => {
  it('rejects AWS metadata 169.254.169.254', () => {
    expect(isPublicUrl('http://169.254.169.254/latest/')).toBe(false);
  });

  it('rejects GCP metadata link-local', () => {
    expect(isPublicUrl('http://169.254.1.1/')).toBe(false);
  });
});

describe('url-safety: non-http schemes rejected', () => {
  it('rejects file:///etc/passwd', () => {
    expect(isPublicUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects gopher://x', () => {
    expect(isPublicUrl('gopher://example.com/')).toBe(false);
  });

  it('rejects javascript:', () => {
    expect(isPublicUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data:', () => {
    expect(isPublicUrl('data:text/plain,hi')).toBe(false);
  });

  it('rejects ftp://example.com', () => {
    expect(isPublicUrl('ftp://example.com/')).toBe(false);
  });
});

describe('url-safety: IPv6 rejected', () => {
  it('rejects IPv6 loopback http://[::1]/', () => {
    expect(isPublicUrl('http://[::1]/')).toBe(false);
  });

  it('rejects IPv6 unspecified http://[::]/', () => {
    expect(isPublicUrl('http://[::]/')).toBe(false);
  });

  it('rejects IPv6 link-local fe80::', () => {
    expect(isPublicUrl('http://[fe80::1]/')).toBe(false);
  });

  it('rejects IPv6 unique-local fc00::', () => {
    expect(isPublicUrl('http://[fc00::1]/')).toBe(false);
  });

  it('rejects IPv6 unique-local fd00::', () => {
    expect(isPublicUrl('http://[fd12:3456::1]/')).toBe(false);
  });

  it('rejects IPv4-mapped IPv6 ::ffff:127.0.0.1', () => {
    expect(isPublicUrl('http://[::ffff:127.0.0.1]/')).toBe(false);
  });
});

describe('url-safety: malformed URLs rejected', () => {
  it('rejects empty string', () => {
    expect(isPublicUrl('')).toBe(false);
  });

  it('rejects not-a-url', () => {
    expect(isPublicUrl('not-a-url')).toBe(false);
  });

  it('rejects partial IP like "10."', () => {
    // URL(http://10.) is not a valid URL, so it parses as hostname "10."
    // which then gets flagged as an incomplete IP literal.
    expect(isPublicUrl('http://10./')).toBe(false);
  });
});
