/**
 * DuckDuckGo web search — server-side implementation.
 *
 * Fetches DuckDuckGo HTML search results directly (no browser proxy needed)
 * and parses them with regex-based HTML extraction.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Strip HTML tags from a string and collapse whitespace.
 */
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * DuckDuckGo's HTML results sometimes use redirect URLs like:
 * //duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com&rut=...
 * This function extracts the actual destination URL.
 */
function extractRealUrl(href: string): string {
  try {
    // Handle protocol-relative URLs
    const fullUrl = href.startsWith('//') ? `https:${href}` : href;
    const parsed = new URL(fullUrl);
    const uddg = parsed.searchParams.get('uddg');
    if (uddg) {
      return decodeURIComponent(uddg);
    }
    return fullUrl;
  } catch {
    // If URL parsing fails, return as-is
    return href;
  }
}

/**
 * Parse DuckDuckGo HTML search results into structured data using regex.
 */
function parseDuckDuckGoHTML(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Match result blocks
  const resultBlockRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
  // Extract link and title from result__a
  const linkRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/;
  // Extract snippet from result__snippet
  const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/;

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = resultBlockRegex.exec(html)) !== null) {
    const block = blockMatch[0];

    const linkMatch = linkRegex.exec(block);
    if (!linkMatch) continue;

    const rawHref = linkMatch[1];
    const rawTitle = linkMatch[2];

    const title = stripHtml(rawTitle);
    const href = rawHref;

    if (!title || !href) continue;

    const url = extractRealUrl(href);

    const snippetMatch = snippetRegex.exec(block);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : '';

    results.push({ title, url, snippet });
  }

  return results;
}

/**
 * Execute a web search query using DuckDuckGo HTML endpoint.
 *
 * @param query - Search query string
 * @param maxResults - Maximum number of results to return (default: 5)
 * @returns Array of search results with title, URL, and snippet
 */
export async function webSearch(
  query: string,
  maxResults: number = 5
): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'text/html',
      'User-Agent': 'Mozilla/5.0 (compatible; FujiTraceBot/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(
      `DuckDuckGo search failed: ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();
  const results = parseDuckDuckGoHTML(html);

  return results.slice(0, maxResults);
}
