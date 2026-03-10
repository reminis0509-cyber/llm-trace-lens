/**
 * DuckDuckGo web search via Vite dev server proxy.
 *
 * The Vite config rewrites `/api/search` to `https://html.duckduckgo.com/html/`
 * so that browser requests avoid CORS restrictions.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Parse DuckDuckGo HTML search results into structured data.
 * Extracts titles, URLs, and snippets from the `.result` elements.
 */
function parseDuckDuckGoHTML(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // DuckDuckGo HTML results are wrapped in elements with class "result"
  const resultElements = doc.querySelectorAll('.result');

  for (const el of resultElements) {
    // Title and URL are in the .result__a anchor
    const anchor = el.querySelector('.result__a');
    // Snippet text is in .result__snippet
    const snippetEl = el.querySelector('.result__snippet');

    if (!anchor) continue;

    const title = (anchor.textContent || '').trim();
    const href = anchor.getAttribute('href') || '';
    const snippet = (snippetEl?.textContent || '').trim();

    // Skip empty or ad results
    if (!title || !href) continue;

    // DuckDuckGo wraps URLs in a redirect; extract the actual URL
    const url = extractRealUrl(href);

    results.push({ title, url, snippet });
  }

  return results;
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
 * Execute a web search query using DuckDuckGo via the Vite proxy.
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
  const url = `/api/search?q=${encodedQuery}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'text/html',
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
