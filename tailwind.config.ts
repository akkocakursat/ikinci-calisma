import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#ffffff",
        page: "#f4f5f1",
        ink: "#161a17",
        "ink-2": "#4d5651",
        muted: "#8b938c",
        hairline: "#e4e6df",
        brand: "#189a4d", // canlı kurumsal yeşil
        "brand-dark": "#12793c",
        "brand-deep": "#0c2919", // kenar çubuğu koyu orman yeşili
        accent: "#e7b93c", // amber vurgu
        "accent-soft": "#faf3dc",
        yesil: "#12793c",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        baslik: ["Georgia", "'Times New Roman'", "serif"],
      },
      boxShadow: {
        kart: "0 1px 2px rgba(22,26,23,0.04), 0 8px 24px rgba(22,26,23,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
