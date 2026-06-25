import type { Config } from "tailwindcss";

// Palette mirrored EXACTLY from the mobile app (FE/lib/theme.ts) so web reads as
// the same brand: warm cream canvas, ink text, terracotta primary action, white
// fields. `accent` = mobile `primary` (terracotta) for actions/links/active
// states; `success` = mobile `success` (green) for positive amounts.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F4EFE7",
        surface: "#FBF8F2",
        field: "#FFFFFF",
        ink: "#2A2724",
        "ink-soft": "#6F685E",
        "ink-faint": "#A89F92",
        border: "#E4DCCE",
        accent: "#D8623E",
        "accent-pressed": "#BE5031",
        success: "#2E7D5B",
        danger: "#C0492B",
        warning: "#B5832A", // amber — "needs attention but not an error" (e.g. a held remit)
      },
      fontFamily: {
        serif: ["Georgia", "ui-serif", "serif"],
      },
      borderRadius: {
        card: "16px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,26,23,0.04), 0 8px 24px rgba(28,26,23,0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
