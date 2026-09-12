import type { Config } from "tailwindcss";

// Command-center theme tokens. Colours live in globals.css as CSS variables so the
// dark remap and the components share one source of truth.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 900: "#0a0e14", 800: "#12161f", 700: "#1a2130" },
        saffron: { 500: "#f28c28", 400: "#f6a24f" },
        accent: { DEFAULT: "#22e8c8", cyan: "#00d9ff" },
        ink: { DEFAULT: "#e6edf3", muted: "#9fb0c3", dim: "#8b9bb0" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        pulseDanger: { "0%, 100%": { boxShadow: "0 0 0 0 rgba(248,113,113,0.0), 0 0 12px rgba(248,113,113,0.35)" }, "50%": { boxShadow: "0 0 0 3px rgba(248,113,113,0.12), 0 0 22px rgba(248,113,113,0.7)" } },
        panelIn: { "0%": { opacity: "0", transform: "translateY(6px) scale(0.985)" }, "100%": { opacity: "1", transform: "translateY(0) scale(1)" } },
        scan: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(300%)" } },
        sweep: { "0%": { backgroundPosition: "0% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        "pulse-danger": "pulseDanger 2.2s ease-in-out infinite",
        "panel-in": "panelIn 180ms ease-out both",
        scan: "scan 1.4s linear infinite",
        sweep: "sweep 3s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
