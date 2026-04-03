import { useEffect } from 'react';

interface SeoConfig {
  title: string;
  description: string;
  url: string;
  ogTitle?: string;
  jsonLd?: Array<{ id: string; data: Record<string, unknown> }>;
}

function setMetaTag(attr: string, key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (el) {
    el.setAttribute('content', content);
  } else {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute('content', content);
    document.head.appendChild(el);
  }
}

function addJsonLd(id: string, data: Record<string, unknown>) {
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.setAttribute('type', 'application/ld+json');
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export function useSeo(config: SeoConfig) {
  useEffect(() => {
    const prevTitle = document.title;
    const ogTitle = config.ogTitle ?? config.title;

    // Title
    document.title = config.title;

    // Meta
    setMetaTag('name', 'description', config.description);

    // Canonical
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const prevCanonical = canonical?.href ?? '';
    if (canonical) {
      canonical.href = config.url;
    }

    // OG
    setMetaTag('property', 'og:title', ogTitle);
    setMetaTag('property', 'og:description', config.description);
    setMetaTag('property', 'og:url', config.url);

    // Twitter
    setMetaTag('name', 'twitter:title', ogTitle);
    setMetaTag('name', 'twitter:description', config.description);

    // JSON-LD
    const jsonLdIds: string[] = [];
    if (config.jsonLd) {
      for (const entry of config.jsonLd) {
        addJsonLd(entry.id, entry.data);
        jsonLdIds.push(entry.id);
      }
    }

    return () => {
      document.title = prevTitle;
      if (canonical) canonical.href = prevCanonical;
      for (const id of jsonLdIds) {
        document.getElementById(id)?.remove();
      }
    };
  }, [config.title, config.description, config.url, config.ogTitle, config.jsonLd]);
}
