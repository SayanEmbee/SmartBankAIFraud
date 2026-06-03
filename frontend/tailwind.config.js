/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        space: ['Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 15px rgba(59, 130, 246, 0.35)',
        'glow-red': '0 0 15px rgba(239, 68, 68, 0.45)',
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.35)',
      }
    },
  },
  plugins: [],
}
