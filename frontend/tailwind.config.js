/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0f172a',      // slate-900
        darkCard: '#1e293b',    // slate-800
        accentBlue: '#3b82f6',  // blue-500
        accentGreen: '#10b981', // emerald-500
        accentPurple: '#8b5cf6',// violet-500
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
