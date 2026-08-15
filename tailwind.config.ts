import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#05070a",
        panel: "#0b1017",
        ink: "#f6f8fb",
        muted: "#8f9aa8",
        line: "rgba(255,255,255,0.1)",
        accent: "#56f2c3",
        amber: "#f6c56f",
        violet: "#8ea7ff",
      },
      boxShadow: {
        glow: "0 0 40px rgba(86, 242, 195, 0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
