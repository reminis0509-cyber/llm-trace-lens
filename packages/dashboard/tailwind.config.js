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
        sans: ['Noto Sans JP', 'Geist', 'DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
        'trace-enter': 'traceEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-pass': 'pulsePass 0.6s ease-out',
        'pulse-fail': 'pulseFail 0.6s ease-out',
        'pulse-warn': 'pulseWarn 0.6s ease-out',
        'value-highlight': 'valueHighlight 1.2s ease-out',
        'live-pulse': 'livePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'live-wave': 'liveWave 1.5s ease-in-out infinite',
        'span-expand': 'spanExpand 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'waterfall-draw': 'waterfallDraw 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'detail-enter': 'detailEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        traceEnter: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulsePass: {
          '0%': { boxShadow: '0 0 0 0 rgba(74, 222, 128, 0.4)' },
          '70%': { boxShadow: '0 0 0 6px rgba(74, 222, 128, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(74, 222, 128, 0)' },
        },
        pulseFail: {
          '0%': { boxShadow: '0 0 0 0 rgba(248, 113, 113, 0.4)' },
          '70%': { boxShadow: '0 0 0 6px rgba(248, 113, 113, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(248, 113, 113, 0)' },
        },
        pulseWarn: {
          '0%': { boxShadow: '0 0 0 0 rgba(251, 191, 36, 0.4)' },
          '70%': { boxShadow: '0 0 0 6px rgba(251, 191, 36, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(251, 191, 36, 0)' },
        },
        valueHighlight: {
          '0%': { backgroundColor: 'rgba(110, 231, 183, 0.15)' },
          '100%': { backgroundColor: 'transparent' },
        },
        livePulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        liveWave: {
          '0%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
          '100%': { transform: 'scaleY(0.4)' },
        },
        spanExpand: {
          '0%': { opacity: '0', transform: 'scaleY(0.8)', transformOrigin: 'top' },
          '100%': { opacity: '1', transform: 'scaleY(1)', transformOrigin: 'top' },
        },
        waterfallDraw: {
          '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
          '100%': { transform: 'scaleX(1)', transformOrigin: 'left' },
        },
        detailEnter: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
