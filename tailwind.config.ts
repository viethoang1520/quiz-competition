import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "#7C3AED",
        secondary: "#A78BFA",
        accent: "#F43F5E",
        "game-bg": "#0F0F23",
        "game-text": "#E2E8F0",
        "game-border": "#374151",
        success: "#22C55E",
        warning: "#FFA500",
        danger: "#FF0000"
      },
      animation: {
        'pulse-glow': 'pulse 2s infinite',
        'buzz': 'buzz 0.3s ease-in-out',
        'star-glow': 'star-glow 2s ease-in-out infinite'
      },
      keyframes: {
        buzz: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' }
        },
        'star-glow': {
          '0%, 100%': {
            boxShadow: '0 0 10px #FBBF24, 0 0 20px #FBBF24, 0 0 30px #FBBF24'
          },
          '50%': {
            boxShadow: '0 0 20px #FBBF24, 0 0 30px #FBBF24, 0 0 40px #FBBF24'
          }
        }
      }
    },
  },
  plugins: [],
} satisfies Config;