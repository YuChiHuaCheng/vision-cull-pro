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
                // Minimalist dark palette
                base: '#111111',
                panel: '#1a1a1a',
                surface: '#222222',
                border: '#2a2a2a',
                'border-hover': '#3a3a3a',

                // Muted text hierarchy
                'text-primary': '#e5e5e5',
                'text-secondary': '#a3a3a3',
                'text-muted': '#666666',

                // Status colors — low saturation, photo-first
                'status-keep': '#4ade80',       // soft green
                'status-keep-dim': 'rgba(74, 222, 128, 0.15)',
                'status-reject': '#f87171',     // soft red
                'status-reject-dim': 'rgba(248, 113, 113, 0.15)',
                'status-fail': '#fbbf24',       // amber
                'status-fail-dim': 'rgba(251, 191, 36, 0.15)',

                // Accent — subtle blue for interactive elements
                accent: '#60a5fa',
                'accent-dim': 'rgba(96, 165, 250, 0.15)',
            },
            fontFamily: {
                sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
            },
            animation: {
                'fade-in': 'fadeIn 0.2s ease-out forwards',
                'slide-up': 'slideUp 0.25s ease-out forwards',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
