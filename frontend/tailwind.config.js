/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dark Pool Theme
        dark: {
          50: "#1a1a1a",
          100: "#171717",
          200: "#0a0a0a",
          300: "#000000",
        },
        citrea: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316", // Main orange
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        // Custom semantic colors
        pool: {
          bg: "#0a0a0a",
          card: "#1a1a1a",
          border: "#2a2a2a",
          glow: "#fed7aa",
          text: "#f5f5f5",
          muted: "#a3a3a3",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Monaco", "Consolas", "monospace"],
      },
      animation: {
        glow: "glow 2s ease-in-out infinite alternate",
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        glow: {
          "0%": {
            boxShadow: "0 0 5px #f97316, 0 0 10px #f97316, 0 0 15px #f97316",
          },
          "100%": {
            boxShadow: "0 0 10px #f97316, 0 0 20px #f97316, 0 0 30px #f97316",
          },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
