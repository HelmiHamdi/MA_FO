/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f3eeff",
          100: "#e4d4ff",
          200: "#c9aaff",
          300: "#a87aff",
          400: "#8b4dff",
          500: "#6d28d9",
          600: "#5b21b6",
          700: "#4c1d95",
          800: "#3b1573",
          900: "#1e0a3c",
        },
        accent: {
          400: "#f472b6",
          500: "#ec4899",
          600: "#db2777",
        },
        gold: {
          400: "#fbbf24",
          500: "#f59e0b",
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #1e0a3c 0%, #3b1573 50%, #6d28d9 100%)",
        "gradient-glass": "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
        "gradient-card": "linear-gradient(145deg, rgba(109,40,217,0.15) 0%, rgba(236,72,153,0.08) 100%)",
      },
      boxShadow: {
        "glass": "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
        "card": "0 8px 32px rgba(0,0,0,0.4)",
        "glow": "0 0 40px rgba(109,40,217,0.4)",
        "glow-sm": "0 0 20px rgba(109,40,217,0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in": "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "swipe-right": "swipeRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "swipe-left": "swipeLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(24px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideIn: { "0%": { opacity: "0", transform: "translateX(-16px)" }, "100%": { opacity: "1", transform: "translateX(0)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        swipeRight: { "0%": { transform: "translateX(0) rotate(0deg)", opacity: "1" }, "100%": { transform: "translateX(120%) rotate(15deg)", opacity: "0" } },
        swipeLeft: { "0%": { transform: "translateX(0) rotate(0deg)", opacity: "1" }, "100%": { transform: "translateX(-120%) rotate(-15deg)", opacity: "0" } },
      },
      backdropBlur: { xs: "2px" },
    },
  },
  plugins: [],
};