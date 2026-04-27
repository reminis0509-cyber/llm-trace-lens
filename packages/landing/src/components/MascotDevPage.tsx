/**
 * /dev/mascot — Mascot コンポーネント動作確認ページ(内部 dev only)
 *
 * 2026-04-28 リファクタ後: mark / heavy animation を撤去し、サイズ確認と
 * ポーズ確認のみに簡素化。汎用絵文字オーバーレイで世界観を壊すリスクを
 * 排除し、感情表現は別レイヤー(AI 応答 + カピぶちょーフキダシ、
 * `src/line/capi-bucho.ts`)が担当する設計に変更。
 *
 * 本ページは Header/Footer なしの chromeless 描画(App.tsx で制御)。
 * 本番には到達可能(Vercel SPA fallback)だが Header からのリンクは無し。
 */

import Mascot, {
  MASCOT_POSES,
  MASCOT_SIZES,
  type MascotPose,
  type MascotSize,
} from './Mascot';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        marginTop: 48,
        padding: 24,
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.1)',
        backgroundColor: '#ffffff',
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 24,
          fontSize: 20,
          fontWeight: 600,
          color: 'rgba(0,0,0,0.95)',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const POSE_LABEL: Record<MascotPose, string> = {
  default: '通常立ち絵',
  real: 'リアル化版',
  onsen: '温泉立ち絵',
};

const SIZE_PX: Record<MascotSize, number> = {
  sm: 64,
  md: 128,
  lg: 256,
  hero: 768,
};

export default function MascotDevPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#f6f5f4',
        color: 'rgba(0,0,0,0.95)',
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif',
        padding: '40px 20px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: '0.15em',
              fontFamily:
                '"SourceCodePro", "SFMono-Regular", "Menlo", monospace',
              color: '#a39e98',
            }}
          >
            INTERNAL / DEV ONLY
          </p>
          <h1
            style={{
              margin: '8px 0 12px',
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
            }}
          >
            Mascot コンポーネント動作確認
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: '#615d59',
              maxWidth: 720,
            }}
          >
            <code
              style={{
                fontFamily:
                  '"SourceCodePro", "SFMono-Regular", "Menlo", monospace',
                fontSize: 12,
                backgroundColor: '#ffffff',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 4,
                padding: '2px 6px',
              }}
            >
              {'<Mascot pose size />'}
            </code>{' '}
            の組み合わせ。画像 (
            <code
              style={{
                fontFamily:
                  '"SourceCodePro", "SFMono-Regular", "Menlo", monospace',
                fontSize: 12,
              }}
            >
              /mascot/capi-*.png
            </code>
            ) 未配置時は破線プレースホルダー想定。
          </p>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 13,
              lineHeight: 1.6,
              color: '#615d59',
              maxWidth: 720,
            }}
          >
            2026-04-28 リファクタ: 汎用絵文字マーク重ね合わせを撤去。感情表現は
            別レイヤー(AI 応答 + カピぶちょーフキダシ)が担当する。詳細は{' '}
            <code
              style={{
                fontFamily:
                  '"SourceCodePro", "SFMono-Regular", "Menlo", monospace',
                fontSize: 12,
              }}
            >
              docs/戦略_2026.md
            </code>{' '}
            Section 7.3。
          </p>
        </header>

        {/* ── サイズ確認 ── */}
        <Section title="サイズ確認 (pose=default / animation=idle)">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 32,
              alignItems: 'flex-end',
            }}
          >
            {MASCOT_SIZES.map((s) => (
              <div
                key={s}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Mascot pose="default" size={s} />
                <code
                  style={{
                    fontFamily:
                      '"SourceCodePro", "SFMono-Regular", "Menlo", monospace',
                    fontSize: 11,
                    color: '#615d59',
                  }}
                >
                  size="{s}" ({SIZE_PX[s]}px)
                </code>
              </div>
            ))}
          </div>
        </Section>

        {/* ── ポーズ × アニメーション ── */}
        <Section title="ポーズ × アニメーション (size=md)">
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      width: 140,
                      fontWeight: 500,
                      color: '#615d59',
                    }}
                  >
                    animation \ pose
                  </th>
                  {MASCOT_POSES.map((p) => (
                    <th
                      key={p}
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        fontWeight: 500,
                        color: 'rgba(0,0,0,0.95)',
                      }}
                    >
                      {POSE_LABEL[p]}
                      <br />
                      <code
                        style={{
                          fontFamily:
                            '"SourceCodePro", "SFMono-Regular", "Menlo", monospace',
                          fontSize: 10,
                          color: '#a39e98',
                          fontWeight: 400,
                        }}
                      >
                        pose="{p}"
                      </code>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['idle', 'none'] as const).map((a) => (
                  <tr
                    key={a}
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
                  >
                    <td
                      style={{
                        padding: '16px 12px',
                        textAlign: 'center',
                        color: 'rgba(0,0,0,0.95)',
                      }}
                    >
                      <code
                        style={{
                          fontFamily:
                            '"SourceCodePro", "SFMono-Regular", "Menlo", monospace',
                          fontSize: 11,
                        }}
                      >
                        animation="{a}"
                      </code>
                    </td>
                    {MASCOT_POSES.map((p) => (
                      <td
                        key={`${p}-${a}`}
                        style={{
                          padding: '16px 12px',
                          textAlign: 'center',
                        }}
                      >
                        <Mascot pose={p} size="md" animation={a} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p
            style={{
              marginTop: 16,
              fontSize: 12,
              color: '#615d59',
              lineHeight: 1.6,
            }}
          >
            <code
              style={{
                fontFamily:
                  '"SourceCodePro", "SFMono-Regular", "Menlo", monospace',
                fontSize: 11,
              }}
            >
              idle
            </code>{' '}
            は 0.5px 上下の控えめな呼吸(4 秒周期)。
            <code
              style={{
                fontFamily:
                  '"SourceCodePro", "SFMono-Regular", "Menlo", monospace',
                fontSize: 11,
              }}
            >
              none
            </code>{' '}
            は完全静止。カピバラ静的設計原則に従い、立ち絵自体は派手に動かさない。
          </p>
        </Section>

        <footer
          style={{
            marginTop: 64,
            paddingTop: 24,
            borderTop: '1px solid rgba(0,0,0,0.1)',
            fontSize: 11,
            color: '#a39e98',
            textAlign: 'center',
          }}
        >
          internal preview — 本番リンク無し / Header からの導線無し
        </footer>
      </div>
    </main>
  );
}
