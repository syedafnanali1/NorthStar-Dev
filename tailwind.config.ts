import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#F7F3EE",
          dark: "#EDE7DE",
          paper: "#FAF7F3",
        },
        ink: {
          DEFAULT: "#1A1714",
          soft: "#3D3732",
          muted: "#8C857D",
        },
        gold: {
          DEFAULT: "#C4963A",
          light: "#E8C97A",
          dim: "rgba(196,150,58,0.15)",
        },
        sage: "#6B8C7A",
        rose: "#B5705B",
        sky: "#5B7EA6",
        violet: "#7B6FA0",
        dark: {
          bg: "#0E0C0A",
          surface: "#1C1917",
          border: "#2A2522",
        },
      },
      fontFamily: {
        serif: ["'Playfair Display'", "Georgia", "serif"],
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease forwards",
        "fade-in": "fadeIn 0.3s ease forwards",
        "slide-in": "slideIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards",
        twinkle: "twinkle 3s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        "pulse-ring": "pulseRing 2s ease-in-out infinite",
        "bar-grow": "barGrow 0.8s ease forwards",
        "ring-fill": "ringFill 1.2s ease forwards",
        "count-up": "countUp 1s ease forwards",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateY(16px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.2", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.5)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.95)", opacity: "0.8" },
          "50%": { transform: "scale(1.05)", opacity: "0.4" },
          "100%": { transform: "scale(0.95)", opacity: "0.8" },
        },
        barGrow: {
          from: { height: "0" },
          to: { height: "var(--bar-height)" },
        },
        ringFill: {
          from: { strokeDashoffset: "226.2" },
          to: { strokeDashoffset: "var(--ring-offset)" },
        },
        countUp: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      boxShadow: {
        "card": "0 2px 12px rgba(26,23,20,0.06), 0 1px 3px rgba(26,23,20,0.04)",
        "card-hover": "0 8px 28px rgba(26,23,20,0.1), 0 2px 8px rgba(26,23,20,0.06)",
        "modal": "0 24px 64px rgba(26,23,20,0.18)",
        "gold": "0 4px 20px rgba(196,150,58,0.2)",
      },
      backgroundImage: {
        "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
        "gold-gradient": "linear-gradient(135deg, #C4963A, #E8C97A)",
      },
    },
  },
  plugins: [],
};

export default config;
