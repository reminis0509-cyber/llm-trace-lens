/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ベース：日本BtoB SaaS標準ライトテーマ
        base: {
          DEFAULT: '#FFFFFF',
          surface: '#F8FAFC',
          elevated: '#F1F5F9',
        },
        border: {
          DEFAULT: '#E2E8F0',
          subtle: '#F1F5F9',
        },
        // テキスト
        text: {
          primary: '#111827',
          secondary: '#6B7280',
          muted: '#9CA3AF',
        },
        // アクセント：コーポレートブルー（LP統一）
        accent: {
          DEFAULT: '#2563EB',
          dim: 'rgba(37, 99, 235, 0.08)',
        },
        // ステータス：白背景でのコントラスト確保
        status: {
          pass: '#16A34A',
          warn: '#D97706',
          fail: '#DC2626',
          block: '#7C3AED',
        },
        // チャート用
        chart: {
          bar: '#CBD5E1',
          grid: 'rgba(226, 232, 240, 0.6)',
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
          '0%': { boxShadow: '0 0 0 0 rgba(22, 163, 74, 0.3)' },
          '70%': { boxShadow: '0 0 0 6px rgba(22, 163, 74, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(22, 163, 74, 0)' },
        },
        pulseFail: {
          '0%': { boxShadow: '0 0 0 0 rgba(220, 38, 38, 0.3)' },
          '70%': { boxShadow: '0 0 0 6px rgba(220, 38, 38, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(220, 38, 38, 0)' },
        },
        pulseWarn: {
          '0%': { boxShadow: '0 0 0 0 rgba(217, 119, 6, 0.3)' },
          '70%': { boxShadow: '0 0 0 6px rgba(217, 119, 6, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(217, 119, 6, 0)' },
        },
        valueHighlight: {
          '0%': { backgroundColor: 'rgba(37, 99, 235, 0.10)' },
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
