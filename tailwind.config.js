/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Softer UI Dark Mode Palette
        base: '#1e1e24',       // softer dark background
        panel: '#25252b',      // elevated panel
        surface: '#2d2d34',    // distinct card surface
        border: '#3b3b44',     // softer separators
        'border-hover': '#52525e',

        // Standard text hierarchy
        'text-primary': '#f4f4f5',
        'text-secondary': '#a1a1aa',
        'text-muted': '#71717a',

        // Softer status colors
        'status-keep': '#34d399',       // soft emerald
        'status-keep-dim': 'rgba(52, 211, 153, 0.15)',
        'status-reject': '#fb7185',     // soft rose
        'status-reject-dim': 'rgba(251, 113, 133, 0.15)',
        'status-fail': '#fbbf24',       // amber
        'status-fail-dim': 'rgba(251, 191, 36, 0.15)',

        // Action accent
        accent: '#60a5fa',              // friendly blue tone
        'accent-dim': 'rgba(96, 165, 250, 0.15)',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      boxShadow: {
        'soft-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'soft-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
}
