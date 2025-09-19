/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Keep custom colors if needed, or remove entirely to use standard Tailwind colors
      },
    },
  },
  plugins: [],
}
