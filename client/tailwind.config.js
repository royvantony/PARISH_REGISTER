/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parish: {
          bg: 'var(--bg-app)',
          surface: 'var(--bg-surface)',
          'surface-subtle': 'var(--bg-surface-subtle)',
          border: 'var(--border-color)',
          primary: 'var(--primary)',
          'primary-hover': 'var(--primary-hover)',
          'primary-light': 'var(--primary-light)',
          accent: 'var(--accent-gold)',
          text: 'var(--text-main)',
          'text-muted': 'var(--text-muted)',
          danger: 'var(--danger)',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 10px -2px rgba(27, 67, 50, 0.05), 0 1px 3px -1px rgba(0, 0, 0, 0.05)',
        'soft-hover': '0 10px 25px -5px rgba(27, 67, 50, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        'drawer': '-10px 0 30px -5px rgba(27, 67, 50, 0.1)',
      }
    },
  },
  plugins: [],
}
