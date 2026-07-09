import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#ffffff",
        page: "#f6f7f2",
        ink: "#101410",
        "ink-2": "#4c534c",
        muted: "#848a82",
        hairline: "#e3e5dd",
        brand: "#1c7a3d", // kurumsal yeşil
        "brand-dark": "#14612f",
        "brand-deep": "#0d3b20", // kenar çubuğu koyu yeşili
        accent: "#eda100", // sarı vurgu
        "accent-soft": "#fdf4dd",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        kart: "0 1px 2px rgba(13,59,32,0.05), 0 4px 16px rgba(13,59,32,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
