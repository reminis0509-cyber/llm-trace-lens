/* ------------------------------------------------------------------ */
/*  BlogPostPage — Individual blog post page at /blog/:slug            */
/* ------------------------------------------------------------------ */

import { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useSeo } from '../hooks/useSeo';
import { trackDashboardConversion } from '../utils/gtag';

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
            className="inline-block text-blue-600 hover:underline font-medium"
          >
            ブログ一覧に戻る
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
          className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 transition-colors mb-8"
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
          ブログ一覧に戻る
        </a>

        {/* Post header */}
        {post && (
          <header className="mb-10">
            <span className="inline-block text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full mb-4">
              {post.category}
            </span>
            <h1 className="text-2xl md:text-4xl font-bold text-slate-900 leading-tight mb-4">
              {post.title}
            </h1>
            <time dateTime={post.date} className="text-sm text-slate-400">
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
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-10 mb-5">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-base text-slate-700 leading-relaxed mb-4">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-6 mb-4 space-y-2 text-slate-700">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-6 mb-4 space-y-2 text-slate-700">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-base leading-relaxed">{children}</li>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-blue-600 hover:underline"
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
                  <strong className="font-semibold text-slate-900">
                    {children}
                  </strong>
                ),
                hr: () => <hr className="my-8 border-slate-200" />,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-200 pl-4 my-4 text-slate-600 italic">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-lg font-bold text-slate-900 mb-3">
            FujiTrace AI事務員を無料で試す
          </p>
          <p className="text-sm text-slate-600 mb-6">
            見積書・請求書の作成からチェックまで、AIが自動で行います。
          </p>
          <a
            href="/dashboard/"
            onClick={handleCtaClick}
            className="inline-block bg-blue-600 text-white font-medium px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            FujiTraceを無料で試す
          </a>
        </div>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-16 pt-8 border-t border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
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
                  className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                >
                  <span className="inline-block text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full mb-2">
                    {rp.category}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-1">
                    {rp.title}
                  </h3>
                  <time
                    dateTime={rp.date}
                    className="text-xs text-slate-400"
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
