/* ------------------------------------------------------------------ */
/*  BlogPage — Blog listing page at /blog                              */
/* ------------------------------------------------------------------ */

import { useState, useEffect } from 'react';
import { useSeo } from '../hooks/useSeo';

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function navigate(href: string) {
  window.history.pushState({}, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSeo({
    title: 'ブログ | FujiTrace - AI事務員・業務効率化の情報メディア',
    description:
      'AI事務員、見積書・請求書の作成、バックオフィス業務の効率化に関する最新情報をお届けします。',
    url: 'https://fujitrace.jp/blog',
  });

  useEffect(() => {
    fetch('/blog/manifest.json')
      .then((res) => {
        if (!res.ok) throw new Error('記事一覧の取得に失敗しました');
        return res.json() as Promise<BlogManifest>;
      })
      .then((data) => {
        setPosts(data.posts);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="pt-16">
      {/* Header */}
      <section className="py-16 px-6 bg-gradient-to-b from-blue-50/40 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-medium text-blue-600 mb-3 tracking-wide">
            FUJITRACE BLOG
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight mb-4">
            FujiTrace ブログ
          </h1>
          <p className="text-lg text-slate-600">
            AI x バックオフィスの最新情報
          </p>
        </div>
      </section>

      {/* Post list */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse"
                >
                  <div className="h-4 w-16 bg-slate-200 rounded mb-4" />
                  <div className="h-6 w-3/4 bg-slate-200 rounded mb-3" />
                  <div className="h-4 w-full bg-slate-200 rounded mb-2" />
                  <div className="h-4 w-2/3 bg-slate-200 rounded mb-4" />
                  <div className="h-3 w-24 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-slate-600">{error}</p>
            </div>
          )}

          {!loading && !error && posts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-600">記事はまだありません。</p>
            </div>
          )}

          {!loading && !error && posts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {posts.map((post) => (
                <a
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/blog/${post.slug}`);
                  }}
                  className="group bg-white rounded-xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                >
                  <span className="inline-block text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full mb-3">
                    {post.category}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    {post.description}
                  </p>
                  <time
                    dateTime={post.date}
                    className="text-xs text-slate-400"
                  >
                    {formatDate(post.date)}
                  </time>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
