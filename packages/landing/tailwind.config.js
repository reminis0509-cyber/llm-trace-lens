/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // ベース：温かみのあるニュートラル
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
        // アクセント：セージグリーン
        accent: {
          DEFAULT: '#6ee7b7',
          dim: 'rgba(110, 231, 183, 0.12)',
        },
        // ステータス
        status: {
          pass: '#4ade80',
          warn: '#fbbf24',
          fail: '#f87171',
          block: '#a78bfa',
        },
      },
      fontSize: {
        'display': ['4rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-sm': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      borderRadius: {
        'card': '6px',
      },
      transitionDuration: {
        '120': '120ms',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
