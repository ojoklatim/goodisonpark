/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gp-black': '#0A0A0A',
        'gp-dark': '#111111',
        'gp-mid': '#1C1C1C',
        'gp-border-dark': '#2A2A2A',
        'gp-white': '#FFFFFF',
        'gp-off-white': '#F5F5F5',
        'gp-muted': '#9CA3AF',
        'gp-blue': '#38BDF8',
        'gp-blue-dim': '#0EA5E9',
        'gp-red': '#EF4444',
        'gp-green': '#22C55E',
        'gp-amber': '#F59E0B',
        'gp-purple': '#A78BFA',
        'gp-border-light': '#E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0',
        none: '0',
        sm: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        full: '0',
      },
    },
  },
  plugins: [],
}
