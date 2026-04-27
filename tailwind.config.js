/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#080B14',
          elevated: '#0D1117',
          surface: '#111827',
          glass: 'rgba(17,24,39,0.7)',
        },
        accent: {
          DEFAULT: '#6366F1',
          glow: 'rgba(99,102,241,0.4)',
          muted: 'rgba(99,102,241,0.15)',
        },
        cyan: {
          glow: 'rgba(34,211,238,0.3)',
        },
        text: {
          primary: '#EEF0FF',
          secondary: '#8890B0',
          muted: '#4B5368',
        },
        success: '#22C55E',
        danger: '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(99,102,241,0.4)',
        'glow-lg': '0 0 40px rgba(99,102,241,0.3)',
        'glow-cyan': '0 0 20px rgba(34,211,238,0.3)',
        glass: '0 8px 32px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'aurora': 'aurora 8s ease-in-out infinite alternate',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        fadeIn: {
          from: { opacity: 0, transform: 'translateY(4px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        aurora: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
