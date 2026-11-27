/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        haru: {
          primary: '#2E8B57',
          'primary-dark': '#246F46',
          'primary-light': '#3FA76B',
          secondary: '#E8F5EC',
          bg: '#F8FAF8',
          text: '#202820',
          sub: '#6B756D',
          border: '#E3E9E4',
          danger: '#D14343',
          warn: '#C9821B',
        },
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Malgun Gothic',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(32, 40, 32, 0.04), 0 4px 12px rgba(32, 40, 32, 0.06)',
        float: '0 6px 24px rgba(32, 40, 32, 0.14)',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.22s ease-out',
      },
    },
  },
  plugins: [],
};
