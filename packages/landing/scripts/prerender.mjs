/**
 * Post-build prerender for /tools/* SEO landing pages.
 *
 * Why this exists:
 *   FujiTrace landing SPA routes via window.location, so all routes share
 *   one initial dist/index.html. Google bot primarily indexes the initial
 *   HTML, not the JS-hydrated DOM, so SPA-only useSeo updates are
 *   insufficient for ranking on competitive keywords like "請求書 無料 作成".
 *
 *   This script runs after `vite build` and produces per-route static HTML
 *   files (e.g. dist/tools/seikyusho/index.html) with route-specific
 *   <title>, <meta description>, og:*, twitter:*, canonical, and JSON-LD
 *   embedded directly. Vercel serves these static files first; only routes
 *   without a matching file fall through to the SPA rewrite in vercel.json.
 *
 *   The React app continues to mount and hydrate as normal — useSeo will
 *   no-op overwrite the same values. So both crawler and human get the
 *   correct metadata.
 *
 * What this script does NOT do:
 *   - Render React components to HTML (we keep the body shell empty —
 *     Google parses head meta + JSON-LD without DOM rendering, and SSR
 *     is risky for browser-only React code in this codebase).
 *   - Add new top-level npm dependencies (uses esbuild, already shipped
 *     as a Vite transitive dependency).
 *
 * 戦略 doc Section 5.6 / 18.2.N (Founder 承認 2026-04-29)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');
const DIST_DIR = join(PACKAGE_ROOT, 'dist');
const TEMPLATE_PATH = join(DIST_DIR, 'index.html');
const SEO_TS_PATH = join(PACKAGE_ROOT, 'src/data/seo-tools.ts');

/* ------------------------------------------------------------------ */
/*  TS → JS bundling via esbuild (zero runtime deps)                   */
/* ------------------------------------------------------------------ */

async function loadSeoData() {
  // Bundle src/data/seo-tools.ts into a single ESM file written to a
  // temporary path, then dynamically import it. seo-tools.ts has no
  // runtime imports (only type-only imports), so the bundle is small.
  const out = await esbuild.build({
    entryPoints: [SEO_TS_PATH],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    write: false,
    sourcemap: false,
    logLevel: 'silent',
  });
  if (!out.outputFiles?.[0]) {
    throw new Error('[prerender] esbuild produced no output for seo-tools.ts');
  }
  const tmpFile = join(
    tmpdir(),
    `fujitrace-seo-tools-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`,
  );
  writeFileSync(tmpFile, out.outputFiles[0].text, 'utf8');
  const mod = await import(pathToFileURL(tmpFile).href);
  return {
    TOOLS_SEO: mod.TOOLS_SEO,
    PRERENDER_ROUTES: mod.PRERENDER_ROUTES,
    CANONICAL_ORIGIN: mod.CANONICAL_ORIGIN,
    buildAllJsonLd: mod.buildAllJsonLd,
  };
}

/* ------------------------------------------------------------------ */
/*  HTML template manipulation                                         */
/* ------------------------------------------------------------------ */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Replace the value of an existing meta tag identified by attribute key.
 * If the tag doesn't exist, leave HTML unchanged — the index.html template
 * has all required tags pre-defined, so a missed replace surfaces a real
 * regression, not a no-op.
 */
function replaceMetaContent(html, attr, key, newContent) {
  const re = new RegExp(
    `(<meta\\s+[^>]*${attr}="${key}"[^>]*content=")[^"]*(")`,
    'i',
  );
  if (!re.test(html)) {
    console.warn(`[prerender] No meta tag for ${attr}="${key}" — skipping`);
    return html;
  }
  return html.replace(re, `$1${escapeHtml(newContent)}$2`);
}

function replaceTitle(html, newTitle) {
  return html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(newTitle)}</title>`,
  );
}

function replaceCanonical(html, newUrl) {
  return html.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/i,
    `$1${escapeHtml(newUrl)}$2`,
  );
}

/**
 * Inject route-specific JSON-LD <script> blocks just before </head>.
 * Each block carries a stable id; useSeo on the client will see the same
 * id and overwrite contents in place rather than duplicating.
 */
function injectJsonLd(html, jsonLdEntries) {
  const blocks = jsonLdEntries
    .map(
      (entry) =>
        `    <script id="${entry.id}" type="application/ld+json">${JSON.stringify(entry.data)}</script>`,
    )
    .join('\n');
  return html.replace(/(<\/head>)/i, `${blocks}\n  $1`);
}

/* ------------------------------------------------------------------ */
/*  Per-route generation                                               */
/* ------------------------------------------------------------------ */

function buildRouteHtml({ template, config, canonicalOrigin, buildAllJsonLd }) {
  const url = `${canonicalOrigin}${config.path}`;
  let html = template;

  html = replaceTitle(html, config.title);
  html = replaceMetaContent(html, 'name', 'description', config.description);
  html = replaceCanonical(html, url);

  const ogTitle = config.ogTitle || config.title;
  html = replaceMetaContent(html, 'property', 'og:title', ogTitle);
  html = replaceMetaContent(html, 'property', 'og:description', config.description);
  html = replaceMetaContent(html, 'property', 'og:url', url);
  html = replaceMetaContent(html, 'name', 'twitter:title', ogTitle);
  html = replaceMetaContent(html, 'name', 'twitter:description', config.description);
  html = replaceMetaContent(html, 'name', 'twitter:url', url);

  const jsonLdEntries = buildAllJsonLd(config);
  html = injectJsonLd(html, jsonLdEntries);

  return html;
}

function writeRouteFile(routePath, html) {
  // '/tools/seikyusho' → 'dist/tools/seikyusho/index.html'
  // '/tools'           → 'dist/tools/index.html'
  const relativeDir = routePath.replace(/^\/+/, '');
  const targetDir = join(DIST_DIR, relativeDir);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  const targetFile = join(targetDir, 'index.html');
  writeFileSync(targetFile, html, 'utf8');
  return targetFile;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  if (!existsSync(TEMPLATE_PATH)) {
    console.error(
      `[prerender] dist/index.html not found at ${TEMPLATE_PATH}. Run \`vite build\` first.`,
    );
    process.exit(1);
  }

  const template = readFileSync(TEMPLATE_PATH, 'utf8');
  const { TOOLS_SEO, PRERENDER_ROUTES, CANONICAL_ORIGIN, buildAllJsonLd } =
    await loadSeoData();

  console.log(
    `[prerender] Generating ${PRERENDER_ROUTES.length} static SEO routes…`,
  );

  const generated = [];
  for (const path of PRERENDER_ROUTES) {
    const config = TOOLS_SEO[path];
    if (!config) {
      console.warn(`[prerender] Skipping ${path} — no config in TOOLS_SEO`);
      continue;
    }
    const html = buildRouteHtml({
      template,
      config,
      canonicalOrigin: CANONICAL_ORIGIN,
      buildAllJsonLd,
    });
    const file = writeRouteFile(config.path, html);
    const size = Buffer.byteLength(html, 'utf8');
    generated.push({ path: config.path, file, size });
    console.log(
      `[prerender]  ✓ ${config.path.padEnd(20)} → ${file.replace(PACKAGE_ROOT + '/', '')} (${(size / 1024).toFixed(1)} KB)`,
    );
  }

  console.log(
    `[prerender] Done. Generated ${generated.length} static HTML files.`,
  );
}

main().catch((err) => {
  console.error('[prerender] FATAL', err);
  process.exit(1);
});
