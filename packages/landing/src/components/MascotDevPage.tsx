/**
 * MascotDevPage — 開発者向け動作確認ページ (本番リンクからは非到達)
 *
 * URL: /dev/mascot
 *  - LP メニューには出さない (Header.tsx に追加しない)
 *  - vercel.json は SPA fallback で /index.html に流すため、本番でも URL を直叩きで表示可能
 *  - 8 マーク × 3 ポーズ × 5 アニメーション の組み合わせを格子状に並べる
 *  - 非ループ系アニメ (celebrating / alarmed) を定期的に再キックする
 */

import { useEffect, useState } from 'react';
import Mascot, {
  MASCOT_ANIMATIONS,
  MASCOT_MARKS,
  MASCOT_POSES,
  type MascotAnimation,
  type MascotMark,
} from './Mascot';

export default function MascotDevPage() {
  // 非ループアニメ (celebrating 0.3s × 1 / alarmed 0.1s × 10) は
  // マウント時に 1 回しか再生されない。確認用に 3 秒おきに key を変えて
  // 強制再マウントする。
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 3000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-app-bg-surface px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-xs font-mono uppercase tracking-wider text-text-muted">
            Internal / Dev only
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary sm:text-3xl">
            Mascot コンポーネント動作確認
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            <code className="rounded bg-app-bg-elevated px-1.5 py-0.5 font-mono text-xs">
              &lt;Mascot pose mark animation size /&gt;
            </code>{' '}
            の組み合わせ。画像 (
            <code className="font-mono text-xs">/mascot/capi-*.png</code>)
            未配置時は破線プレースホルダーが出る想定。
          </p>
          <p className="mt-1 text-xs text-text-muted">
            非ループ系 (celebrating / alarmed) は 3 秒ごとに自動再生されます。
          </p>
        </header>

        {/* セクション 1: サイズ確認 */}
        <Section title="サイズ確認 (pose=default / mark=null / animation=idle)">
          <div className="flex flex-wrap items-end gap-6">
            {(['sm', 'md', 'lg', 'hero'] as const).map((s) => (
              <Cell key={s} label={`size="${s}"`}>
                <Mascot size={s} />
              </Cell>
            ))}
          </div>
        </Section>

        {/* セクション 2: ポーズ × マーク (アニメ none) */}
        <Section title="ポーズ × マーク (animation=none / size=md)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className="border border-border bg-app-bg-elevated p-2 text-left text-xs font-medium text-text-secondary">
                    pose ＼ mark
                  </th>
                  <th className="border border-border bg-app-bg-elevated p-2 text-center text-xs font-medium text-text-secondary">
                    null
                  </th>
                  {MASCOT_MARKS.map((m) => (
                    <th
                      key={m}
                      className="border border-border bg-app-bg-elevated p-2 text-center text-xs font-medium text-text-secondary"
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MASCOT_POSES.map((p) => (
                  <tr key={p}>
                    <td className="border border-border bg-app-bg-elevated p-2 text-xs font-mono text-text-secondary">
                      {p}
                    </td>
                    <td className="border border-border p-3 align-middle">
                      <div className="flex justify-center">
                        <Mascot pose={p} animation="none" mark={null} />
                      </div>
                    </td>
                    {MASCOT_MARKS.map((m) => (
                      <td
                        key={m}
                        className="border border-border p-3 align-middle"
                      >
                        <div className="flex justify-center">
                          <Mascot pose={p} animation="none" mark={m} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* セクション 3: アニメーション × ポーズ */}
        <Section title="アニメーション × ポーズ (size=md / マークは仕様上のデフォルト)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className="border border-border bg-app-bg-elevated p-2 text-left text-xs font-medium text-text-secondary">
                    animation ＼ pose
                  </th>
                  {MASCOT_POSES.map((p) => (
                    <th
                      key={p}
                      className="border border-border bg-app-bg-elevated p-2 text-center text-xs font-mono text-text-secondary"
                    >
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MASCOT_ANIMATIONS.map((a) => (
                  <tr key={a}>
                    <td className="border border-border bg-app-bg-elevated p-2 text-xs font-mono text-text-secondary">
                      {a}
                    </td>
                    {MASCOT_POSES.map((p) => (
                      <td
                        key={p}
                        className="border border-border p-3 align-middle"
                      >
                        <div className="flex justify-center">
                          <Mascot
                            // celebrating / alarmed は再生し直すために key 必須
                            key={`${a}-${p}-${shouldRekey(a) ? tick : 0}`}
                            pose={p}
                            animation={a}
                            // none / idle はマーク無し、それ以外は仕様上のデフォルト
                            mark={defaultMarkFor(a)}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* セクション 4: 完全な格子 (8 marks × 3 poses × 4 animations、idle は除外して見やすく) */}
        <Section title="マーク指定 × アニメーション × ポーズ (size=sm)">
          <p className="mb-3 text-xs text-text-muted">
            mark を明示指定した場合の挙動。idle は重複なので除外、計{' '}
            {MASCOT_MARKS.length} × {MASCOT_POSES.length} × 4 ={' '}
            {MASCOT_MARKS.length * MASCOT_POSES.length * 4} セル。
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {MASCOT_POSES.flatMap((p) =>
              (
                ['thinking', 'celebrating', 'alarmed', 'none'] as MascotAnimation[]
              ).flatMap((a) =>
                MASCOT_MARKS.map((m) => (
                  <Cell
                    key={`${p}-${a}-${m}`}
                    label={`${p} / ${a} / ${m}`}
                  >
                    <Mascot
                      key={`${p}-${a}-${m}-${shouldRekey(a) ? tick : 0}`}
                      pose={p}
                      animation={a}
                      mark={m}
                      size="sm"
                    />
                  </Cell>
                )),
              ),
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

function shouldRekey(a: MascotAnimation): boolean {
  return a === 'celebrating' || a === 'alarmed';
}

function defaultMarkFor(a: MascotAnimation): MascotMark | null {
  // resolveAnimation の forcedMark と揃える (Mascot.tsx 仕様)
  if (a === 'thinking') return null; // null で渡せば内部で 🤔 が補完される
  if (a === 'celebrating') return null; // 同 ✨
  if (a === 'alarmed') return null; // 同 💢
  return null;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10 rounded-card border border-border bg-app-bg p-4 sm:p-6">
      <h2 className="mb-4 text-base font-semibold text-text-primary sm:text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Cell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-border-subtle bg-app-bg-surface p-3">
      <div className="flex min-h-[80px] items-center justify-center">
        {children}
      </div>
      <p className="break-all text-center font-mono text-[10px] leading-tight text-text-muted">
        {label}
      </p>
    </div>
  );
}
