import { readFileSync, writeFileSync } from "node:fs";
import { dairaTokens } from "../lib/design-system/palette";
const aliases = {
  "--background": "var(--daira-page-bg)",
  "--foreground": "var(--daira-heading)",
  "--card": "var(--daira-surface)",
  "--card-foreground": "var(--daira-heading)",
  "--popover": "var(--daira-surface)",
  "--popover-foreground": "var(--daira-heading)",
  "--primary": "var(--daira-primary)",
  "--primary-foreground": "var(--daira-inverse-text)",
  "--secondary": "var(--daira-section-alt)",
  "--secondary-foreground": "var(--daira-text)",
  "--muted": "var(--daira-neutral-bg)",
  "--muted-foreground": "var(--daira-text-secondary)",
  "--accent": "var(--daira-brand-100)",
  "--accent-foreground": "var(--daira-heading)",
  "--destructive": "var(--daira-error)",
  "--destructive-foreground": "var(--daira-inverse-text)",
  "--border": "var(--daira-border)",
  "--input": "var(--daira-input-border)",
  "--ring": "var(--daira-primary)",
  "--radius": "0.6rem"
} as const;
const output = "/* GENERATED: edit lib/design-system/palette.ts, then run npm run theme:generate. */\n:root {\n" +
  Object.entries({ ...dairaTokens, ...aliases }).map(([key,value]) => "  " + key + ": " + value + ";").join("\n") +
  "\n}\n";
const target = "app/daira-tokens.css";
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== output) throw Error("Daira tokens are out of sync. Run npm run theme:generate.");
  console.log("DAIRA_TOKENS_SYNCHRONIZED", Object.keys(dairaTokens).length);
} else {
  writeFileSync(target, output);
  console.log("DAIRA_TOKENS_GENERATED", Object.keys(dairaTokens).length);
}
