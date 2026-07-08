import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#fcfcfb",
        page: "#f9f9f7",
        ink: "#0b0b0b",
        "ink-2": "#52514e",
        muted: "#898781",
        hairline: "#e1e0d9",
        brand: "#2a78d6",
        "brand-dark": "#1c5cab",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
