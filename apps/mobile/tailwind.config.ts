import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#f5c518",
        primary_dim: "#f0c110",
        background: "#0d1228",
        navy: "#0d1228",
        surface_low: "#151a31",
        surface: "#151a31",
        surface_high: "#242940",
        surface_highest: "#2f334c",
        coral: "#ffb4ab",
        muted: "#d1c5ac",
        foreground: "#dde1ff",
        outline_ghost: "rgba(78, 70, 51, 0.15)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
        "4xl": "3rem",
      },
      boxShadow: {
        glow: "0px 16px 40px rgba(245, 197, 24, 0.18)",
        floating: "0px 16px 40px rgba(0, 0, 0, 0.6)",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
