/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b0c0f',
          900: '#111317',
          800: '#171a1f',
          700: '#20242b',
          600: '#2c313a',
          500: '#3a404b',
        },
        accent: { DEFAULT: '#f2b84b', hover: '#f7c968', dim: '#f2b84b26' },
      },
      fontFamily: {
        sans: ['"Schibsted Grotesk"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
