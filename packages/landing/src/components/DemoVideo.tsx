// TODO: Replace this constant with the actual video URL when ready
// e.g., "https://www.youtube.com/embed/VIDEO_ID" or a direct MP4 URL
const DEMO_VIDEO_URL: string | null = null;

interface FeatureCallout {
  icon: string;
  label: string;
}

const featureCallouts: FeatureCallout[] = [
  { icon: '/', label: '全プロンプト記録' },
  { icon: '~', label: 'レイテンシ計測' },
  { icon: '$', label: 'コスト追跡' },
];

export default function DemoVideo() {
  return (
    <section id="demo-video" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            Demo
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            FujiTraceの動作を確認
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            AIエージェントのトレースをリアルタイムで確認できます
          </p>
        </div>

        {/* Video area */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="relative w-full overflow-hidden rounded-card border border-border bg-base-elevated"
               style={{ aspectRatio: '16 / 9' }}>
            {DEMO_VIDEO_URL ? (
              /* TODO: Replace with <iframe> for YouTube or <video> for direct MP4 */
              <iframe
                src={DEMO_VIDEO_URL}
                title="FujiTrace デモ動画"
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              /* Placeholder when no video URL is set */
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div
                  className="w-16 h-16 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <svg
                    className="w-7 h-7 text-accent ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="text-sm text-text-muted">デモ動画準備中</p>
              </div>
            )}
          </div>
        </div>

        {/* Feature callouts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {featureCallouts.map((callout) => (
            <div
              key={callout.label}
              className="flex items-center gap-3 surface-card p-4"
            >
              <div className="w-9 h-9 rounded-card bg-accent-dim flex items-center justify-center flex-shrink-0">
                <span className="text-accent font-mono text-sm" aria-hidden="true">
                  {callout.icon}
                </span>
              </div>
              <span className="text-sm font-medium text-text-primary">
                {callout.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
