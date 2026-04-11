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
        // CSS-variable-backed colors — automatically respond to .dark class
        cream: {
          DEFAULT: "rgb(var(--cream-rgb) / <alpha-value>)",
          dark: "rgb(var(--cream-dark-rgb) / <alpha-value>)",
          paper: "rgb(var(--cream-paper-rgb) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          soft: "rgb(var(--ink-soft-rgb) / <alpha-value>)",
          muted: "rgb(var(--ink-muted-rgb) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "rgb(var(--gold-rgb) / <alpha-value>)",
          light: "#E8C97A",
          dim: "rgba(196,150,58,0.12)",
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
        // Custom tokens outside Tailwind's default scale
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
        // 11px — for kickers, section labels, metadata
        label: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.18em" }],
        // 13px — for secondary body text, captions
        "sm-plus": ["0.8125rem", { lineHeight: "1.45rem" }],
        // 15px — for emphasized body text
        "base-plus": ["0.9375rem", { lineHeight: "1.55rem" }],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      animation: {
        "fade-up": "fadeUp 0.45s ease forwards",
        "fade-in": "fadeIn 0.3s ease forwards",
        "slide-in": "slideIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards",
        twinkle: "twinkle 3s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        "pulse-ring": "pulseRing 2s ease-in-out infinite",
        "bar-grow": "barGrow 0.8s ease forwards",
        "ring-fill": "ringFill 1.2s ease forwards",
        "count-up": "countUp 1s ease forwards",
        "page-in": "fadeUp 0.4s ease both",
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
        card: "0 1px 8px rgba(26,23,20,0.05), 0 0 1px rgba(26,23,20,0.08)",
        "card-hover": "0 8px 28px rgba(26,23,20,0.1), 0 2px 8px rgba(26,23,20,0.06)",
        modal: "0 24px 64px rgba(26,23,20,0.18)",
        gold: "0 4px 20px rgba(196,150,58,0.22)",
        "gold-lg": "0 8px 32px rgba(196,150,58,0.28)",
      },
      backgroundImage: {
        noise:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
        "gold-gradient": "linear-gradient(135deg, #C4963A, #E8C97A)",
        "gold-radial": "radial-gradient(circle at top left, #E8C97A, #C4963A)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
