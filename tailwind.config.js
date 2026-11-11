/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        darkBg: '#0b0c16',
        darkSurface: '#1a1b2f',
        lightBg: '#e2e8f0',
        lightSurface: '#f8fafc',
        primary: '#5b55f9',
        secondary: '#9038f4',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

