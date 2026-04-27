/* ------------------------------------------------------------------ */
/*  BlogPostPage — Individual blog post page at /blog/:slug            */
/* ------------------------------------------------------------------ */

import { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useSeo } from '../hooks/useSeo';
import { trackDashboardConversion } from '../utils/gtag';

/* ------------------------------------------------------------------ */
/*  Share buttons                                                      */
/* ------------------------------------------------------------------ */
function ShareButtons({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const shareX = () => {
    const text = encodeURIComponent(`${title}\n`);
    const u = encodeURIComponent(url);
    window.open(`https://x.com/intent/tweet?text=${text}&url=${u}`, '_blank', 'noopener');
  };

  const shareLine = () => {
    const u = encodeURIComponent(url);
    const text = encodeURIComponent(title);
    window.open(`https://social-plugins.line.me/lineit/share?url=${u}&text=${text}`, '_blank', 'noopener');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback for older browsers */
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <p className="text-sm font-semibold text-text-primary mb-4">この記事をシェアする</p>
      <div className="flex items-center gap-3">
        {/* X (Twitter) */}
        <button
          type="button"
          onClick={shareX}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-card text-sm text-text-secondary hover:bg-app-bg-elevated hover:text-text-primary transition-colors duration-120"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          X
        </button>

        {/* LINE */}
        <button
          type="button"
          onClick={shareLine}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-card text-sm text-text-secondary hover:bg-app-bg-elevated hover:text-text-primary transition-colors duration-120"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
          </svg>
          LINE
        </button>

        {/* Copy link */}
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-card text-sm text-text-secondary hover:bg-app-bg-elevated hover:text-text-primary transition-colors duration-120"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          {copied ? 'コピーしました' : 'リンクをコピー'}
        </button>
      </div>
    </div>
  );
}

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  keywords: string[];
}

interface BlogManifest {
  posts: BlogPost[];
}

interface BlogPostPageProps {
  slug: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function navigate(href: string) {
  window.history.pushState({}, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function BlogPostPage({ slug }: BlogPostPageProps) {
  const [manifest, setManifest] = useState<BlogManifest | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const post = useMemo(
    () => manifest?.posts.find((p) => p.slug === slug) ?? null,
    [manifest, slug],
  );

  const relatedPosts = useMemo(
    () => manifest?.posts.filter((p) => p.slug !== slug) ?? [],
    [manifest, slug],
  );

  useSeo({
    title: post
      ? `${post.title} | FujiTrace ブログ`
      : 'FujiTrace ブログ',
    description: post?.description ?? '',
    url: `https://fujitrace.jp/blog/${slug}`,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [manifestRes, mdRes] = await Promise.all([
          fetch('/blog/manifest.json'),
          fetch(`/blog/posts/${slug}.md`),
        ]);

        if (cancelled) return;

        if (!manifestRes.ok || !mdRes.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const manifestData = (await manifestRes.json()) as BlogManifest;
        const mdText = await mdRes.text();

        if (cancelled) return;

        const found = manifestData.posts.some((p) => p.slug === slug);
        if (!found) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setManifest(manifestData);
        setMarkdown(mdText);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setNotFound(false);
    setMarkdown(null);
    setManifest(null);
    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleCtaClick = useCallback(() => {
    trackDashboardConversion();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="pt-16">
        <div className="max-w-3xl mx-auto px-6 py-12 animate-pulse">
          <div className="h-4 w-20 bg-slate-200 rounded mb-8" />
          <div className="h-8 w-3/4 bg-slate-200 rounded mb-4" />
          <div className="h-4 w-32 bg-slate-200 rounded mb-8" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-slate-200 rounded" />
            <div className="h-4 w-full bg-slate-200 rounded" />
            <div className="h-4 w-5/6 bg-slate-200 rounded" />
            <div className="h-4 w-full bg-slate-200 rounded" />
            <div className="h-4 w-4/5 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (notFound) {
    return (
      <div className="pt-16">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">
            記事が見つかりません
          </h1>
          <p className="text-slate-600 mb-8">
            お探しの記事は存在しないか、移動した可能性があります。
          </p>
          <a
            href="/blog"
            onClick={(e) => {
              e.preventDefault();
              navigate('/blog');
            }}
            className="inline-block text-accent hover:underline font-medium"
          >
            FujiTrace ブログに戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16">
      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Back link */}
        <a
          href="/blog"
          onClick={(e) => {
            e.preventDefault();
            navigate('/blog');
          }}
          className="inline-flex items-center text-sm text-text-muted hover:text-accent transition-colors duration-120 mb-8"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="mr-1.5"
            aria-hidden="true"
          >
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          FujiTrace ブログ
        </a>

        {/* Post header */}
        {post && (
          <header className="mb-10">
            <span className="inline-block text-xs font-medium text-accent bg-accent-dim px-2.5 py-1 rounded-full mb-4">
              {post.category}
            </span>
            <h1 className="text-2xl md:text-4xl font-bold text-text-primary leading-tight mb-4">
              {post.title}
            </h1>
            <time dateTime={post.date} className="text-sm text-text-muted">
              {formatDate(post.date)}
            </time>
          </header>
        )}

        {/* Markdown content */}
        {markdown && (
          <div className="blog-prose">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl md:text-3xl font-bold text-text-primary mt-10 mb-5">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-2xl font-bold text-text-primary mt-8 mb-4">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xl font-semibold text-text-primary mt-6 mb-3">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-base text-text-secondary leading-relaxed mb-4">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-6 mb-4 space-y-2 text-text-secondary">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-6 mb-4 space-y-2 text-text-secondary">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-base leading-relaxed">{children}</li>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-accent hover:underline"
                    target={
                      href?.startsWith('http') ? '_blank' : undefined
                    }
                    rel={
                      href?.startsWith('http')
                        ? 'noopener noreferrer'
                        : undefined
                    }
                  >
                    {children}
                  </a>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-text-primary">
                    {children}
                  </strong>
                ),
                hr: () => <hr className="my-8 border-border" />,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-accent/20 pl-4 my-4 text-text-secondary italic">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        )}

        {/* Share buttons */}
        {post && (
          <ShareButtons
            title={post.title}
            url={`https://fujitrace.jp/blog/${slug}`}
          />
        )}

        {/* CTA */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="bg-app-bg-surface border border-border rounded-card p-8">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <p className="text-xs font-semibold text-accent mb-2 tracking-wide uppercase">
                  FujiTrace おしごと AI
                </p>
                <p className="text-lg font-bold text-text-primary mb-2">
                  日々の業務、AIに任せませんか。
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                  書類作成から議事録、営業スライド、Excel分析、業界リサーチまで、日本企業のあらゆる机上業務をおしごと AIが代行します。登録番号の記載漏れ、計算ミス、記載不備もAIが自動検出します。
                </p>
              </div>
              <div className="flex flex-col gap-3 md:flex-shrink-0">
                <a
                  href="/dashboard/"
                  onClick={handleCtaClick}
                  className="inline-block bg-accent text-white font-semibold px-8 py-3 rounded-card text-center hover:bg-accent-hover transition-colors duration-120 text-sm"
                >
                  無料で試す
                </a>
                <a
                  href="/"
                  className="inline-block text-center text-sm text-text-muted hover:text-accent transition-colors duration-120"
                >
                  サービス詳細を見る
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-16 pt-8 border-t border-border">
            <h2 className="text-xl font-bold text-text-primary mb-6">
              関連記事
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relatedPosts.map((rp) => (
                <a
                  key={rp.slug}
                  href={`/blog/${rp.slug}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/blog/${rp.slug}`);
                    window.scrollTo(0, 0);
                  }}
                  className="group feature-card hover:border-accent/30 hover:shadow-md transition-all duration-200"
                >
                  <span className="inline-block text-xs font-medium text-accent bg-accent-dim px-2.5 py-1 rounded-full mb-2">
                    {rp.category}
                  </span>
                  <h3 className="text-base font-bold text-text-primary group-hover:text-accent transition-colors duration-120 mb-1">
                    {rp.title}
                  </h3>
                  <time
                    dateTime={rp.date}
                    className="text-xs text-text-muted"
                  >
                    {formatDate(rp.date)}
                  </time>
                </a>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
