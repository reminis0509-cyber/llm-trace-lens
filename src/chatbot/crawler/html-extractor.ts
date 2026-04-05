/**
 * HTML Content Extractor
 * Uses cheerio to parse HTML and extract meaningful text content.
 */
import * as cheerio from 'cheerio';

const MAX_CONTENT_LENGTH = 10 * 1024; // 10KB

const REMOVE_SELECTORS = [
  'script',
  'style',
  'nav',
  'footer',
  'header',
  'aside',
  'noscript',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
];

export interface ExtractedPage {
  url: string;
  title: string;
  content: string;
  links: string[];
  contentLength: number;
}

/**
 * Detect charset from HTML meta tags or Content-Type header value.
 */
export function detectCharset(html: string, contentType?: string): string {
  // Check Content-Type header
  if (contentType) {
    const match = contentType.match(/charset=([^\s;]+)/i);
    if (match) return match[1].toLowerCase();
  }

  // Check meta charset
  const metaCharset = html.match(/<meta[^>]+charset=["']?([^"'\s;>]+)/i);
  if (metaCharset) return metaCharset[1].toLowerCase();

  // Check meta http-equiv
  const httpEquiv = html.match(/<meta[^>]+http-equiv=["']?content-type["']?[^>]+content=["']?[^"']*charset=([^"'\s;>]+)/i);
  if (httpEquiv) return httpEquiv[1].toLowerCase();

  return 'utf-8';
}

/**
 * Decode binary response to string with proper charset handling.
 */
export function decodeHtml(buffer: ArrayBuffer, contentType?: string): string {
  // First decode as UTF-8 to check meta tags
  const preliminary = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const charset = detectCharset(preliminary, contentType);

  // Map common charset aliases
  const charsetMap: Record<string, string> = {
    'shift_jis': 'shift_jis',
    'shift-jis': 'shift_jis',
    'sjis': 'shift_jis',
    'euc-jp': 'euc-jp',
    'eucjp': 'euc-jp',
    'iso-2022-jp': 'iso-2022-jp',
    'utf-8': 'utf-8',
    'utf8': 'utf-8',
  };

  const resolvedCharset = charsetMap[charset] || charset;

  try {
    return new TextDecoder(resolvedCharset, { fatal: false }).decode(buffer);
  } catch {
    // Fallback to UTF-8
    return preliminary;
  }
}

/**
 * Extract meaningful text content and internal links from HTML.
 */
export function extractContent(html: string, baseUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  for (const selector of REMOVE_SELECTORS) {
    $(selector).remove();
  }

  // Extract title
  const title = $('title').first().text().trim() || '';

  // Extract text from content areas (priority: main > article > body)
  let contentEl = $('main');
  if (contentEl.length === 0) contentEl = $('article');
  if (contentEl.length === 0) contentEl = $('body');

  let content = contentEl.text()
    .replace(/\s+/g, ' ')
    .trim();

  // Truncate to 10KB
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.slice(0, MAX_CONTENT_LENGTH);
  }

  // Collect internal links (same-origin only)
  const links: string[] = [];
  const baseOrigin = new URL(baseUrl).origin;

  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');
    if (!href) return;

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.origin === baseOrigin && resolved.protocol.startsWith('http')) {
        // Normalize: strip hash
        resolved.hash = '';
        const normalized = resolved.href.replace(/\/+$/, '');
        if (!links.includes(normalized)) {
          links.push(normalized);
        }
      }
    } catch {
      // Invalid URL - skip
    }
  });

  return {
    url: baseUrl,
    title,
    content,
    links,
    contentLength: content.length,
  };
}
