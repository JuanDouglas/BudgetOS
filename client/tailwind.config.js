/** @type {import('tailwindcss').Config} */
import { BRAND } from './src/lib/brand.js'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Dynamically built color classes (e.g. `border-${color}-500`) are not detected
  // by Tailwind's content scanner, so we safelist the patterns actually used.
  safelist: [
    {
      pattern: /(border|bg|text)-(red|green|blue)-(50|500|600)/,
    },
  ],
  theme: {
    extend: {
      colors: {
        primary: BRAND.palette.primary,
        secondary: BRAND.palette.secondary,
        accent: BRAND.palette.accent,
      },
    },
  },
  plugins: [],
}
