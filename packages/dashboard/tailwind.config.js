/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ベース：温かみのあるニュートラル（純粋な黒/白を避ける）
        base: {
          DEFAULT: '#0d0d0f',
          surface: '#111113',
          elevated: '#18181b',
        },
        border: {
          DEFAULT: '#27272a',
          subtle: '#1f1f22',
        },
        // テキスト
        text: {
          primary: '#f4f4f5',
          secondary: '#a1a1aa',
          muted: '#52525b',
        },
        // アクセント：1色のみ、落ち着いたセージグリーン
        accent: {
          DEFAULT: '#6ee7b7',
          dim: 'rgba(110, 231, 183, 0.12)',
        },
        // ステータス：彩度を下げた自然なトーン
        status: {
          pass: '#4ade80',
          warn: '#fbbf24',
          fail: '#f87171',
          block: '#a78bfa',
        },
        // チャート用（単色グレーベース）
        chart: {
          bar: '#3f3f46',
          grid: 'rgba(63, 63, 70, 0.3)',
        },
      },
      fontFamily: {
        mono: ['Geist Mono', 'IBM Plex Mono', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['Geist', 'DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'nav': ['13px', { lineHeight: '1.5', fontWeight: '450' }],
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '40px',
        '2xl': '64px',
      },
      borderRadius: {
        'card': '6px',
      },
      transitionDuration: {
        '120': '120ms',
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
