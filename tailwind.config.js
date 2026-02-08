/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#faf7f4",
          100: "#f4ece5",
          200: "#e9d6c7",
          300: "#d9b79c",
          400: "#c88e6b",
          500: "#a86b45",
          600: "#8d5435",
          700: "#70412a",
          800: "#563222",
          900: "#3c241a"
        }
      }
    }
  },
  plugins: []
};
