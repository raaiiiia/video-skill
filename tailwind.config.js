/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0078D4",
        canvas: "#F5F7FA",
        card: "#FFFFFF",
        line: "#E5E7EB",
        ink: "#111827",
      },
      boxShadow: {
        fluent: "0 12px 28px rgba(15, 23, 42, 0.08)",
        command: "0 2px 8px rgba(15, 23, 42, 0.06)",
      },
      fontFamily: {
        ui: ["Aptos", "Segoe UI Variable", "Segoe UI", "sans-serif"],
        mono: ["Cascadia Code", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
