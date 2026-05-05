import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
        secondary: "#0f766e",
        success: "#16a34a",
        warning: "#ca8a04",
        danger: "#dc2626",
      },
    },
  },
  plugins: [forms, typography],
};

