import type { Config } from "tailwindcss";
import {
  accent,
  border,
  card,
  destructive,
  macroAmber,
  macroOntargetGreen,
  surface,
  textDisabled,
  textPrimary,
  textSecondary,
} from "./lib/tokens";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface,                                       // bg-surface
        card,                                          // bg-card
        accent: {
          DEFAULT: accent,                             // bg-accent, text-accent
          foreground: "#FFFFFF",                       // text-accent-foreground
        },
        primary: textPrimary,                          // text-primary (body text)
        secondary: textSecondary,                      // text-secondary
        disabled: textDisabled,                        // text-disabled
        default: border,                               // border-default
        destructive,                                   // bg-destructive, text-destructive
        "macro-amber": macroAmber,                     // bg-macro-amber, text-macro-amber
        "macro-ontarget-green": macroOntargetGreen,    // bg-macro-ontarget-green, text-macro-ontarget-green
      },
    },
  },
  plugins: [],
};

export default config;
