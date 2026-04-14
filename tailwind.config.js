/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#fdf6ee",
          100: "#f8e8d0",
          200: "#f0ceA0",
          300: "#e4ae6a",
          400: "#d4904a",
          500: "#c07830",
          600: "#a06030",
          700: "#824c24",
          800: "#663c1c",
          900: "#4e2e14",
        },
      },
    },
  },
  plugins: [],
};
