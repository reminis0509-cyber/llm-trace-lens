/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark navy base
        navy: {
          950: '#060810',
          900: '#0a0e1a',
          800: '#0f1629',
          700: '#1a2035',
          600: '#252d45',
          500: '#3a4565',
        },
        // Accent colors
        accent: {
          cyan: '#00d4ff',
          'cyan-dim': '#00a3c7',
          emerald: '#00ff9d',
          'emerald-dim': '#00c77a',
          purple: '#a855f7',
        },
        // Validation status colors
        status: {
          pass: '#00ff9d',
          warn: '#fbbf24',
          fail: '#f97316',
          block: '#6b7280',
        },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.15)',
        'glow-emerald': '0 0 20px rgba(0, 255, 157, 0.15)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'count-up': 'countUp 0.5s ease-out forwards',
      },
      keyframes: {
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
