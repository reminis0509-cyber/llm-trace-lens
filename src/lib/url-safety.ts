/**
 * lib/url-safety.ts — SSRF mitigation helpers.
 *
 * Used by:
 *   - src/agent/wide-research.ts (fetchExcerpt + input.sources vetting)
 *   - src/routes/custom-mcp.ts  (create/patch URL validation)
 *   - src/connectors/custom-mcp.ts (execute-time defense-in-depth)
 *
 * We intentionally stay DNS-free: we only block URLs whose hostname is a
 * literal loopback/private IP or a well-known reserved name. DNS resolution
 * is out of scope (too slow for the hot path + risks TOCTOU). Callers that
 * need DNS-pinning should layer their own resolver on top.
 *
 * Blocked:
 *   - Non http/https schemes (file, gopher, ftp, javascript, data, ...)
 *   - Loopback: "localhost", "127.x.x.x", "::1"
 *   - Link-local: "169.254.x.x", "fe80::/10"
 *   - Private IPv4: 10.x, 172.16-31.x, 192.168.x
 *   - Reserved "this host": 0.x
 *   - Shared address space (CGNAT): 100.64.0.0/10
 *   - IPv6 unique local: fc00::/7 (covers fc00-fdff)
 *
 * No new npm dependencies — relies on Node's built-in `net.isIP`.
 */
import net from 'net';

/**
 * Validate that a URL points to a public HTTP(S) destination. Throws `Error`
 * with a Japanese-locale message on any violation so callers can surface it
 * via zod `.refine` or as an HTTP 400.
 */
export function assertPublicUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL の形式が不正です');
  }

  const scheme = parsed.protocol.toLowerCase();
  if (scheme !== 'http:' && scheme !== 'https:') {
    throw new Error('http または https 以外のスキームは使用できません');
  }

  // Node's WHATWG URL keeps brackets on IPv6 hostnames ("[fc00::1]"); strip
  // them before running net.isIP / string checks.
  const rawHost = parsed.hostname.toLowerCase();
  if (!rawHost) {
    throw new Error('ホスト名が空です');
  }
  const host =
    rawHost.startsWith('[') && rawHost.endsWith(']')
      ? rawHost.slice(1, -1)
      : rawHost;

  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error('ローカルホスト宛 URL は使用できません');
  }

  const ipKind = net.isIP(host);
  if (ipKind === 4) {
    if (isBlockedIPv4(host)) {
      throw new Error('プライベート/予約 IPv4 宛 URL は使用できません');
    }
    return;
  }
  if (ipKind === 6) {
    if (isBlockedIPv6(host)) {
      throw new Error('プライベート/予約 IPv6 宛 URL は使用できません');
    }
    return;
  }

  // Hostname is a DNS name — we skip resolution by design. Still catch the
  // handful of names that look syntactically like IPs but failed isIP, to
  // avoid weirdly-encoded literals slipping through.
  if (/^\d+(\.\d+){0,3}$/.test(host)) {
    throw new Error('不完全な IP 表記は使用できません');
  }
}

/**
 * Non-throwing variant for zod `.refine` / boolean checks.
 */
export function isPublicUrl(url: string): boolean {
  try {
    assertPublicUrl(url);
    return true;
  } catch {
    return false;
  }
}

function isBlockedIPv4(addr: string): boolean {
  const parts = addr.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts;
  // 0.0.0.0/8 — "this host"
  if (a === 0) return true;
  // 10.0.0.0/8 — private
  if (a === 10) return true;
  // 100.64.0.0/10 — CGNAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 — loopback
  if (a === 127) return true;
  // 169.254.0.0/16 — link-local (AWS/GCP metadata lives here)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 — private
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 — private
  if (a === 192 && b === 168) return true;
  return false;
}

function isBlockedIPv6(addr: string): boolean {
  // Normalise: lower-case + strip zone id.
  const lower = addr.toLowerCase().split('%')[0];

  // Loopback ::1 — canonicalised form is always "::1" per RFC 5952.
  if (lower === '::1') return true;
  // Unspecified ::
  if (lower === '::') return true;

  // IPv4-mapped IPv6: ::ffff:a.b.c.d (dotted) OR canonicalised
  // ::ffff:XXXX:XXXX (hex, which is what Node's URL produces).
  const mappedDotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted) return isBlockedIPv4(mappedDotted[1]);
  const mappedHex = lower.match(
    /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/,
  );
  if (mappedHex) {
    const hi = Number.parseInt(mappedHex[1], 16);
    const lo = Number.parseInt(mappedHex[2], 16);
    const a = (hi >> 8) & 0xff;
    const b = hi & 0xff;
    const c = (lo >> 8) & 0xff;
    const d = lo & 0xff;
    return isBlockedIPv4(`${a}.${b}.${c}.${d}`);
  }

  // Expand to 8 groups so prefix matching is unambiguous.
  const groups = expandIPv6(lower);
  if (!groups) {
    // Unrecognised IPv6 shape — be conservative.
    return true;
  }
  const first = groups[0];

  // fe80::/10 — link-local. First 10 bits == 1111 1110 10xx xxxx
  // => first group high byte 0xfe, low-byte top 2 bits = 10 → 0x80..0xBF.
  if ((first & 0xffc0) === 0xfe80) return true;

  // fc00::/7 — unique-local. First 7 bits == 1111 110x
  // => first group high byte in fc.. or fd..
  if ((first & 0xfe00) === 0xfc00) return true;

  return false;
}

/**
 * Expand a normalised IPv6 literal (lower-case, no zone) into 8 uint16
 * groups. Returns null if the shape is unrecognised.
 */
function expandIPv6(addr: string): number[] | null {
  let s = addr;
  // IPv4-in-IPv6 tail (e.g. "::ffff:1.2.3.4") — convert the tail to two
  // hex groups so the generic expander can handle it.
  const ipv4Tail = s.match(/^(.*?:)(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Tail) {
    const parts = ipv4Tail[2].split('.').map((p) => Number.parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) return null;
    const hi = ((parts[0] & 0xff) << 8) | (parts[1] & 0xff);
    const lo = ((parts[2] & 0xff) << 8) | (parts[3] & 0xff);
    s = `${ipv4Tail[1]}${hi.toString(16)}:${lo.toString(16)}`;
  }

  const doubleColonParts = s.split('::');
  let left: string[] = [];
  let right: string[] = [];
  if (doubleColonParts.length === 1) {
    left = s.split(':');
  } else if (doubleColonParts.length === 2) {
    left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
    right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
  } else {
    return null;
  }

  const missing = 8 - (left.length + right.length);
  if (missing < 0) return null;
  const zeros = new Array<string>(missing).fill('0');
  const all = [...left, ...zeros, ...right];
  if (all.length !== 8) return null;

  const out: number[] = [];
  for (const g of all) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(Number.parseInt(g, 16));
  }
  return out;
}
