/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./App.tsx",
        "./index.tsx",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['Chakra Petch', 'sans-serif'],
            },
            colors: {
                tactical: {
                    bg: '#121211', // Very dark brown/black
                    card: '#1C1C1A', // Slightly lighter
                    accent: '#FFD700', // Gold/Yellow
                    muted: '#5C5C50', // Olive/Gray
                    text: '#EAEAEA',
                    highlight: '#2A2A28'
                }
            }
        }
    },
    plugins: [],
}
