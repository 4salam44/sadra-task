/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#5C6EF8',
          primaryDark: '#4353D3',
          secondary: '#48C4B7',
          accent: '#FFB4A2',
          highlight: '#8EC5FF',
          soft: '#F8FAFF',
          muted: '#E4E9FB',
          ink: '#243055',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans Arabic"', 'system-ui', 'sans-serif'],
        display: ['"Montserrat"', '"Cairo"', 'system-ui'],
      },
      boxShadow: {
        soft: '0 18px 45px -20px rgba(92, 110, 248, 0.45)',
        subtle: '0 12px 30px -18px rgba(36, 48, 85, 0.2)',
      },
    },
  },
  plugins: [],
}