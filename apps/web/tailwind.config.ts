import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          50: "#f0f5f4",
          100: "#d9e8e4",
          200: "#b3d1c9",
          300: "#87b5a8",
          400: "#5f9685",
          500: "#4a7e6d",
          600: "#3b6558",
          700: "#325248",
          800: "#2b433c",
          900: "#263833",
          950: "#132019",
        },
        // Editorial green palette (landing page)
        sand: {
          50: "#f7faf8",
          100: "#eef3f0",
          200: "#dfe9e4",
          300: "#c7d9d1",
          400: "#a7c1b6",
          500: "#7fa193",
          600: "#5f8374",
          700: "#49695d",
          800: "#385248",
          900: "#263833",
          950: "#132019",
        },
        warm: {
          DEFAULT: "#3b6558",
          light: "#87b5a8",
          dark: "#263833",
          muted: "#5f8374",
        },
      },
      fontFamily: {
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-instrument-serif)", "Georgia", "serif"],
      },
      animation: {
        "marquee": "marquee 40s linear infinite",
        "marquee-reverse": "marquee-reverse 40s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "marquee-reverse": {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
