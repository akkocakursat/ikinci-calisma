import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#ffffff",
        page: "#f5f7fa",
        ink: "#0f1420",
        "ink-2": "#46526b",
        muted: "#8390a6",
        hairline: "#d9e2ef",
        brand: "#1c5cab", // kurumsal mavi
        "brand-dark": "#104281",
        "brand-deep": "#0b2f5c", // kenar çubuğu koyu mavisi
        accent: "#eda100", // sarı vurgu (SUNAR güneşi)
        "accent-soft": "#fdf4dd",
        yesil: "#1c7a3d", // olumlu/başarı vurgusu
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        kart: "0 1px 2px rgba(11,47,92,0.06), 0 4px 18px rgba(11,47,92,0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
