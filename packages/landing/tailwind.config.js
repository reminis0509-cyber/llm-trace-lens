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
        // ベース：ライトテーマ（日本BtoB SaaS標準）
        // NOTE: "base" as a color name is SAFE — it generates bg-base, text-base-surface etc.
        // "text-base" collision is handled by Tailwind: font-size utility wins over color utility
        // when both exist. But to be extra safe we avoid DEFAULT so "text-base" stays font-size only.
        'app-bg': {
          DEFAULT: '#ffffff',
          surface: '#f8fafc',
          elevated: '#f1f5f9',
        },
        border: {
          DEFAULT: '#e2e8f0',
          subtle: '#f1f5f9',
        },
        // テキスト
        text: {
          primary: '#1e293b',
          secondary: '#64748b',
          muted: '#94a3b8',
        },
        // アクセント：深いネイビー（信頼・誠実・日本企業向け）
        accent: {
          DEFAULT: '#1d3557',
          dim: 'rgba(29, 53, 87, 0.08)',
          hover: '#162a46',
        },
        // ステータス（ライトテーマ用に調整）
        status: {
          pass: '#16a34a',
          warn: '#d97706',
          fail: '#dc2626',
          block: '#7c3aed',
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
