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
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: {
          foreground: "var(--muted-foreground)",
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
      },
      fontFamily: {
        body: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
