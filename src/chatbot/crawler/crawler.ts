/**
 * Website Crawler
 * BFS traversal with robots.txt respect, rate limiting, and progress callbacks.
 */
import { isAllowed } from './robots.js';
import { extractContent, decodeHtml, type ExtractedPage } from './html-extractor.js';

export interface CrawlOptions {
  maxPages: number;
  delayMs: number;
  maxContentPerPage: number;
  timeoutMs: number;
}

export interface CrawlResult {
  pages: ExtractedPage[];
  errors: Array<{ url: string; error: string }>;
}

export interface CrawlProgress {
  pagesFound: number;
  pagesProcessed: number;
  currentUrl: string;
}

export type CrawlProgressCallback = (progress: CrawlProgress) => void;

const DEFAULT_OPTIONS: CrawlOptions = {
  maxPages: 20,
  delayMs: 1000,
  maxContentPerPage: 10240,
  timeoutMs: 10000,
};

/** File extensions to skip (binary/media/asset files) */
const BINARY_EXTENSIONS = new Set([
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dmg', '.msi', '.deb', '.rpm',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.css', '.js', '.map',
]);

/** Maximum number of query parameters before skipping URL */
const MAX_QUERY_PARAMS = 3;

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href.replace(/\/+$/, '');
  } catch {
    return url;
  }
}

function shouldSkipUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only HTTP(S)
    if (!parsed.protocol.startsWith('http')) return true;

    // Check binary extensions
    const pathname = parsed.pathname.toLowerCase();
    for (const ext of BINARY_EXTENSIONS) {
      if (pathname.endsWith(ext)) return true;
    }

    // Skip query-heavy URLs (likely pagination/filters with no unique content)
    const paramCount = Array.from(parsed.searchParams).length;
    if (paramCount > MAX_QUERY_PARAMS) return true;

    return false;
  } catch {
    return true;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Crawl a website using BFS traversal.
 * Respects robots.txt, rate limits, and reports progress.
 */
export async function crawlSite(
  startUrl: string,
  options?: Partial<CrawlOptions>,
  onProgress?: CrawlProgressCallback
): Promise<CrawlResult> {
  const opts: CrawlOptions = { ...DEFAULT_OPTIONS, ...options };
  const visited = new Set<string>();
  const queue: string[] = [normalizeUrl(startUrl)];
  const pages: ExtractedPage[] = [];
  const errors: Array<{ url: string; error: string }> = [];
  const startHostname = new URL(startUrl).hostname;

  while (queue.length > 0 && pages.length < opts.maxPages) {
    const url = queue.shift()!;
    const normalized = normalizeUrl(url);

    if (visited.has(normalized)) continue;
    visited.add(normalized);

    // Same hostname check
    try {
      if (new URL(normalized).hostname !== startHostname) continue;
    } catch {
      continue;
    }

    // Skip binary/unwanted URLs
    if (shouldSkipUrl(normalized)) continue;

    // Respect robots.txt
    const allowed = await isAllowed(startUrl, normalized);
    if (!allowed) continue;

    // Report progress
    if (onProgress) {
      onProgress({
        pagesFound: visited.size + queue.length,
        pagesProcessed: pages.length,
        currentUrl: normalized,
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);

      const response = await fetch(normalized, {
        headers: {
          'User-Agent': 'FujiTrace-Bot/1.0',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ja,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        errors.push({ url: normalized, error: `HTTP ${response.status}` });
        continue;
      }

      // Check content type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        continue;
      }

      // Decode with proper charset handling
      const buffer = await response.arrayBuffer();
      const html = decodeHtml(buffer, contentType);

      const page = extractContent(html, normalized);

      // Truncate if needed
      if (page.content.length > opts.maxContentPerPage) {
        page.content = page.content.slice(0, opts.maxContentPerPage);
        page.contentLength = opts.maxContentPerPage;
      }

      if (page.content.length > 0) {
        pages.push(page);
      }

      // Add discovered links to queue
      for (const link of page.links) {
        const normLink = normalizeUrl(link);
        if (!visited.has(normLink) && !queue.includes(normLink)) {
          queue.push(normLink);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'クロール中にエラーが発生しました';
      errors.push({ url: normalized, error: message });
    }

    // Rate limit: 1 request per second
    if (queue.length > 0 && pages.length < opts.maxPages) {
      await delay(opts.delayMs);
    }
  }

  return { pages, errors };
}
