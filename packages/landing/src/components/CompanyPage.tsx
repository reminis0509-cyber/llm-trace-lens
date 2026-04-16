import { useSeo } from '../hooks/useSeo';

interface NavigationLinkProps {
  href: string;
  children: React.ReactNode;
}

function NavigationLink({ href, children }: NavigationLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo(0, 0);
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-accent hover:text-accent/80 transition-colors duration-120"
    >
      {children}
    </a>
  );
}

export default function CompanyPage() {
  useSeo({
    title: '会社概要 | 合同会社Reminis - FujiTrace運営会社',
    description: 'FujiTraceを運営する合同会社Reminisの会社概要。東京都中央区銀座。すべての日本企業にAIを届けるミッションのもと、AI導入プラットフォームを提供。',
    url: 'https://fujitrace.jp/company',
    ogTitle: '会社概要 | 合同会社Reminis',
  });

  return (
    <section className="pt-32 pb-16 sm:pb-24 px-4 sm:px-6">
      <div className="section-container max-w-3xl mx-auto">
        <div className="mb-8">
          <NavigationLink href="/">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>トップに戻る</span>
          </NavigationLink>
        </div>

        <h1 className="text-display-sm font-semibold text-text-primary mb-12">
          会社概要
        </h1>

        {/* Company info table */}
        <div className="surface-card overflow-hidden">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="px-4 sm:px-6 py-4 text-sm text-text-muted font-medium text-left whitespace-nowrap w-1/4 sm:w-1/5 align-top bg-app-bg-elevated/50">
                  会社名
                </th>
                <td className="px-4 sm:px-6 py-4 text-sm text-text-primary">
                  合同会社Reminis
                </td>
              </tr>
              <tr>
                <th className="px-4 sm:px-6 py-4 text-sm text-text-muted font-medium text-left whitespace-nowrap w-1/4 sm:w-1/5 align-top bg-app-bg-elevated/50">
                  所在地
                </th>
                <td className="px-4 sm:px-6 py-4 text-sm text-text-primary">
                  〒104-0061<br />
                  東京都中央区銀座一丁目22番11号 銀座大竹ビジデンス2F
                </td>
              </tr>
              <tr>
                <th className="px-4 sm:px-6 py-4 text-sm text-text-muted font-medium text-left whitespace-nowrap w-1/4 sm:w-1/5 align-top bg-app-bg-elevated/50">
                  代表社員
                </th>
                <td className="px-4 sm:px-6 py-4 text-sm text-text-primary">
                  村上稜空
                </td>
              </tr>
              <tr>
                <th className="px-4 sm:px-6 py-4 text-sm text-text-muted font-medium text-left whitespace-nowrap w-1/4 sm:w-1/5 align-top bg-app-bg-elevated/50">
                  事業内容
                </th>
                <td className="px-4 sm:px-6 py-4 text-sm text-text-primary">
                  AIオブザーバビリティプラットフォームの開発・運営
                </td>
              </tr>
              <tr>
                <th className="px-4 sm:px-6 py-4 text-sm text-text-muted font-medium text-left whitespace-nowrap w-1/4 sm:w-1/5 align-top bg-app-bg-elevated/50">
                  お問い合わせ
                </th>
                <td className="px-4 sm:px-6 py-4 text-sm text-text-primary">
                  <a href="mailto:reminis0509@gmail.com" className="text-accent hover:underline">
                    reminis0509@gmail.com
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
