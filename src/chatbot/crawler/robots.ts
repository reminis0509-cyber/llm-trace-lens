/**
 * robots.txt Parser
 * Fetches and caches robots.txt per domain, checks URL crawl permission.
 */

interface RobotsRule {
  allow: string[];
  disallow: string[];
}

const cache = new Map<string, RobotsRule>();

function parseRobotsTxt(text: string): RobotsRule {
  const lines = text.split('\n');
  const rule: RobotsRule = { allow: [], disallow: [] };
  let relevantSection = false;

  for (const raw of lines) {
    const line = raw.trim().toLowerCase();

    // Check user-agent directives
    if (line.startsWith('user-agent:')) {
      const agent = line.slice('user-agent:'.length).trim();
      relevantSection = agent === '*' || agent === 'fujitrace-bot' || agent === 'fujitrace-bot/1.0';
      continue;
    }

    if (!relevantSection) continue;

    if (line.startsWith('disallow:')) {
      const path = line.slice('disallow:'.length).trim();
      if (path) rule.disallow.push(path);
    } else if (line.startsWith('allow:')) {
      const path = line.slice('allow:'.length).trim();
      if (path) rule.allow.push(path);
    }
  }

  return rule;
}

function matchesPath(urlPath: string, pattern: string): boolean {
  // Simple prefix matching (standard robots.txt behavior)
  if (pattern.endsWith('$')) {
    return urlPath === pattern.slice(0, -1);
  }
  return urlPath.startsWith(pattern);
}

/**
 * Check if a target URL is allowed to be crawled according to robots.txt.
 * Defaults to allowed if robots.txt is missing or unparseable.
 */
export async function isAllowed(baseUrl: string, targetUrl: string): Promise<boolean> {
  try {
    const base = new URL(baseUrl);
    const domain = base.origin;

    if (!cache.has(domain)) {
      try {
        const response = await fetch(`${domain}/robots.txt`, {
          headers: { 'User-Agent': 'FujiTrace-Bot/1.0' },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const text = await response.text();
          cache.set(domain, parseRobotsTxt(text));
        } else {
          // robots.txt not found or error - allow all
          cache.set(domain, { allow: [], disallow: [] });
        }
      } catch {
        // Network error - default to allowed
        cache.set(domain, { allow: [], disallow: [] });
      }
    }

    const rules = cache.get(domain)!;
    const target = new URL(targetUrl);
    const path = target.pathname + target.search;

    // Allow rules take precedence over disallow for same-length matches
    // Check allow first
    for (const pattern of rules.allow) {
      if (matchesPath(path, pattern)) return true;
    }

    // Check disallow
    for (const pattern of rules.disallow) {
      if (matchesPath(path, pattern)) return false;
    }

    return true;
  } catch {
    // URL parsing error - default to allowed
    return true;
  }
}
