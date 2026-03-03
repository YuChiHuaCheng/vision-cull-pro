// tailwind.config.js
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
                cyan: { 400: '#22d3ee', 500: '#06b6d4' },
                teal: { 500: '#14B8A6', 600: '#0D9488' },
                orange: { 500: '#F97316' },
            },
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
